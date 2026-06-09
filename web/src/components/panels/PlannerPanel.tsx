/**
 * PlannerPanel — Panel lateral derecho de planificación temporal.
 *
 * Modelo de datos (v2 — sin time blocks separados):
 *   - Nodos con `due` + hora → aparecen en el timeline. El nodo NO se mueve.
 *   - Nodos con `due` sin hora (medianoche local) → aparecen en la franja all-day.
 *   - GCal events: timed → timeline, allDay → franja all-day.
 *
 * Drag desde el árbol: asigna due+hora al nodo original. No crea duplicados.
 * GCal sync: si el usuario tiene GCal conectado, crear/actualizar evento al programar.
 *
 * Backward compat: nodos legacy _timeBlock:"1" se siguen mostrando en timeline.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import {
  getCalendarEventsRange,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from '../../api/googleCalendar'
import { GCalEventEditor } from './DiaryRightPanel'
import { useUserStore } from '../../store/userStore'

// ── Geometría fija ────────────────────────────────────────────────────────
const HOUR_START      = 6
const HOUR_END        = 24
const TOTAL_HOURS     = HOUR_END - HOUR_START
const AXIS_W          = 40
const ALL_DAY_H       = 28   // altura de la franja all-day por item
const ALL_DAY_MIN_H   = 32   // mínimo px de la franja all-day
const DEFAULT_SLOT_H  = 40   // px por 30 min
const DEFAULT_DAY_CNT = 5
const MIN_SLOT_H      = 14
const MAX_SLOT_H      = 110
const MIN_DAY_CNT     = 2
const MAX_DAY_CNT     = 7
const PRE_DAYS        = 10

// ── Helpers ────────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r }
function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
function fmtHH(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

/** Devuelve true si el ISO tiene hora local distinta de medianoche (= tiene hora asignada). */
function hasTime(isoStr: string): boolean {
  const d = new Date(isoStr)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/** ISO a medianoche local del día dado. */
function toMidnight(day: Date): string {
  const d = new Date(day); d.setHours(0,0,0,0); return d.toISOString()
}

const DAYS_S   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MONTHS_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function dayLabel(d: Date) { return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}` }

type ViewMode = 'day' | 'year'

// Bloque con hora en el timeline
interface Block {
  kind: 'task' | 'standalone' | 'gcal'
  id: string          // nodeId para task/standalone; gcalId para gcal
  text: string
  start: Date
  end: Date
  color: string
  nodeId?: string     // id del nodo original (para task)
  gcalEvent?: CalendarEvent
}

// Ítem all-day (franja superior)
interface AllDayItem {
  kind: 'task' | 'gcal'
  id: string          // nodeId para task; gcalId para gcal
  text: string
  color: string
  gcalEvent?: CalendarEvent
}

// ── Leer bloques con hora (timeline) ─────────────────────────────────────
function getTimedBlocks(day: Date, gcalEvents: CalendarEvent[]): Block[] {
  const blocks: Block[] = []

  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt) continue
    const start = new Date(n.due)
    if (!sameDay(start, day)) continue

    try {
      const ed = JSON.parse(n.extraData || '{}')

      // Legacy: nodo _timeBlock separado (backward compat)
      if (ed._timeBlock === '1') {
        const linked = ed._linkedTaskId ? store.getNode(ed._linkedTaskId) : null
        const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
        blocks.push({
          kind: ed._linkedTaskId ? 'task' : 'standalone',
          id: n.id,
          text: linked ? linked.text : n.text,
          start, end,
          color: n.color || (ed._linkedTaskId ? 'var(--accent)' : '#8b5cf6'),
          nodeId: ed._linkedTaskId || n.id,
        })
        continue
      }
    } catch {}

    // Nuevo modelo: nodo con due + hora asignada
    if (!hasTime(n.due)) continue
    const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
    blocks.push({
      kind: 'task',
      id: n.id,
      text: n.text,
      start, end,
      color: n.color || 'var(--accent)',
      nodeId: n.id,
    })
  }

  // GCal timed — excluir eventos creados por Fromly (ya aparecen como bloque 'task')
  const fromGcalIds = new Set(
    store.allActive().map(n => n.gcalEventId).filter(Boolean)
  )
  for (const ev of gcalEvents) {
    if (ev.allDay) continue
    if (fromGcalIds.has(ev.id)) continue // deduplicar: ya está como bloque Fromly
    const start = new Date(ev.start)
    if (!sameDay(start, day)) continue
    blocks.push({
      kind: 'gcal',
      id: ev.id,
      text: ev.title,
      start, end: new Date(ev.end),
      color: ev.backgroundColor || '#4a90d9',
      gcalEvent: ev,
    })
  }

  return blocks.sort((a, b) => a.start.getTime() - b.start.getTime())
}

// ── Leer ítems all-day ─────────────────────────────────────────────────
function getAllDayItems(day: Date, gcalEvents: CalendarEvent[]): AllDayItem[] {
  const items: AllDayItem[] = []

  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt) continue
    // Solo nodos con status (tareas/eventos) que tengan due sin hora
    if (n.status === null && !n.isEvent) continue
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (ed._timeBlock === '1') continue // legacy time blocks no van aquí
    } catch {}
    const d = new Date(n.due)
    if (!sameDay(d, day)) continue
    if (hasTime(n.due)) continue // si tiene hora, va al timeline
    items.push({
      kind: 'task',
      id: n.id,
      text: n.text,
      color: n.color || 'var(--accent)',
    })
  }

  // GCal all-day
  for (const ev of gcalEvents) {
    if (!ev.allDay) continue
    const d = new Date(ev.start)
    if (!sameDay(d, day)) continue
    items.push({ kind: 'gcal', id: ev.id, text: ev.title, color: ev.backgroundColor || '#4a90d9', gcalEvent: ev })
  }

  return items
}

// ══════════════════════════════════════════════════════════════════════════
// PlannerPanel
// ══════════════════════════════════════════════════════════════════════════

interface Props { onClose: () => void }

export default function PlannerPanel({ onClose }: Props) {
  const s        = useStore()
  const us       = useUserStore()
  const navigate = useNavigate()

  const today = startOfDay(new Date())
  const [viewMode,      setViewMode]      = useState<ViewMode>('day')
  const [centerDate,    setCenterDate]    = useState(today)
  const [slotH,         setSlotH]         = useState(DEFAULT_SLOT_H)
  const [visibleDayCnt, setVisibleDayCnt] = useState(DEFAULT_DAY_CNT)

  const hourH    = slotH * 2
  const pxPerMin = slotH / 30
  const snapPx   = (y: number) => Math.round(y / (slotH / 2)) * (slotH / 2)
  const topPx    = (d: Date)   => Math.max(0, (d.getHours()*60 + d.getMinutes() - HOUR_START*60) * pxPerMin)
  const heightPx = (s: number, e: number) => Math.max(slotH/2, (e-s)/60000 * pxPerMin)
  const pxToTime = (px: number, day: Date) => {
    const mins = snapPx(Math.max(0, px)) / pxPerMin + HOUR_START * 60
    const d = new Date(day); d.setHours(Math.floor(mins/60), Math.min(59, mins%60), 0, 0); return d
  }

  const [gcalEvents,  setGcalEvents]  = useState<CalendarEvent[]>([])
  const [editingGcal, setEditingGcal] = useState<CalendarEvent | null>(null)
  const [ctxMenu, setCtxMenu]         = useState<{x:number;y:number;b:Block}|null>(null)
  const [newBlock, setNewBlock]       = useState<{day:Date;start:Date;top:number;text:string}|null>(null)
  const newBlockRef                   = useRef<HTMLInputElement>(null)
  const [snapLine, setSnapLine]       = useState<{dayKey:string;top:number}|null>(null)

  // ── GCal ──────────────────────────────────────────────────────────────────
  const [gcalError, setGcalError] = useState('')
  useEffect(() => {
    if (!us.googleConnected) return
    setGcalError('')
    getCalendarEventsRange(addDays(centerDate,-14), addDays(centerDate,14))
      .then(evs => { setGcalEvents(evs); setGcalError('') })
      .catch(e => {
        console.error('[PlannerPanel] GCal error:', e)
        setGcalError('Error cargando Google Calendar')
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('token') || msg.includes('401') || msg.includes('refresh')) {
          us.markGoogleDisconnected()
        }
      })
  }, [us.googleConnected, centerDate.toDateString()]) // eslint-disable-line

  useEffect(() => {
    us.refreshGoogleStatus?.()
  }, []) // eslint-disable-line

  // ── GCal sync helper ──────────────────────────────────────────────────────
  async function syncNodeToGcal(nodeId: string, start: Date, end: Date) {
    if (!us.googleConnected) return
    const node = store.getNode(nodeId)
    if (!node) return
    try {
      if (node.gcalEventId) {
        const updated = await updateCalendarEvent(node.gcalEventId, {
          title: node.text,
          start: start.toISOString(),
          end: end.toISOString(),
        })
        setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x))
      } else {
        const created = await createCalendarEvent({
          title: node.text,
          start: start.toISOString(),
          end: end.toISOString(),
        })
        store.updateNode(nodeId, { gcalEventId: created.id })
        setGcalEvents(p => [...p, created])
      }
    } catch (e) {
      console.error('[PlannerPanel] GCal sync error:', e)
    }
  }

  async function removeNodeFromGcal(nodeId: string) {
    if (!us.googleConnected) return
    const node = store.getNode(nodeId)
    if (!node?.gcalEventId) return
    try {
      await deleteCalendarEvent(node.gcalEventId)
      setGcalEvents(p => p.filter(x => x.id !== node.gcalEventId))
      store.updateNode(nodeId, { gcalEventId: null })
    } catch (e) {
      console.error('[PlannerPanel] GCal delete error:', e)
    }
  }

  // ── colW dinámico ─────────────────────────────────────────────────────────
  const [colW, setColW] = useState(120)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function update() {
      if (!timelineRef.current) return
      const avail = timelineRef.current.clientWidth - AXIS_W - 2
      setColW(Math.max(60, Math.floor(avail / visibleDayCnt)))
    }
    update()
    const ro = new ResizeObserver(update)
    if (timelineRef.current) ro.observe(timelineRef.current)
    return () => ro.disconnect()
  }, [visibleDayCnt])

  // ── Zoom Y (eje vertical) ────────────────────────────────────────────────
  function handleAxisDrag(e: React.MouseEvent) {
    e.preventDefault()
    const startY     = e.clientY
    const startSlotH = slotH
    const scrollEl   = scrollVRef.current
    const scrollFrac = scrollEl ? scrollEl.scrollTop / (TOTAL_HOURS * startSlotH * 2) : 0
    function onMove(ev: MouseEvent) {
      const delta   = startY - ev.clientY
      const minSlot = scrollEl ? Math.max(8, Math.floor(scrollEl.clientHeight / (TOTAL_HOURS * 2))) : 8
      const newSlot = Math.max(minSlot, Math.min(MAX_SLOT_H, startSlotH + delta * 0.5))
      setSlotH(newSlot)
      if (scrollEl) scrollEl.scrollTop = scrollFrac * TOTAL_HOURS * newSlot * 2
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Zoom X (cabecera días) ────────────────────────────────────────────────
  function handleHeadersDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.pp-col-head')) return
    e.preventDefault()
    const startX   = e.clientX
    const startCnt = visibleDayCnt
    function onMove(ev: MouseEvent) {
      const steps = Math.round((ev.clientX - startX) / 40)
      setVisibleDayCnt(Math.max(MIN_DAY_CNT, Math.min(MAX_DAY_CNT, startCnt + steps)))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function resetZoom() { setSlotH(DEFAULT_SLOT_H); setVisibleDayCnt(DEFAULT_DAY_CNT) }

  // ── Días visibles ─────────────────────────────────────────────────────────
  const visibleDays = useMemo(() =>
    Array.from({ length: PRE_DAYS*2+1 }, (_, i) => addDays(centerDate, i - PRE_DAYS))
  , [centerDate.toDateString()]) // eslint-disable-line

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollHRef = useRef<HTMLDivElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const scrollVRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (viewMode !== 'day' || !scrollHRef.current) return
    const pos = Math.max(0, PRE_DAYS * colW - (scrollHRef.current.clientWidth - AXIS_W) / 2 + colW / 2)
    scrollHRef.current.scrollLeft = pos
  }, [viewMode, centerDate.toDateString(), colW]) // eslint-disable-line

  useLayoutEffect(() => {
    if (!scrollVRef.current) return
    scrollVRef.current.scrollTop = Math.max(0, topPx(new Date()) - 100)
  }, [viewMode])

  function centerNow() {
    if (!scrollHRef.current) return
    const pos = Math.max(0, PRE_DAYS * colW - (scrollHRef.current.clientWidth - AXIS_W) / 2 + colW / 2)
    scrollHRef.current.scrollTo({ left: pos, behavior: 'smooth' })
    if (scrollVRef.current) scrollVRef.current.scrollTo({ top: Math.max(0, topPx(new Date()) - 120), behavior: 'smooth' })
  }

  function isAlreadyCentered(): boolean {
    if (!scrollHRef.current) return true
    const expected = Math.max(0, PRE_DAYS * colW - (scrollHRef.current.clientWidth - AXIS_W) / 2 + colW / 2)
    return Math.abs(scrollHRef.current.scrollLeft - expected) < colW * 0.4
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || viewMode !== 'day') return
      // Prioridad 1: cerrar input de nuevo bloque
      if (newBlock) {
        e.stopPropagation()
        e.preventDefault()
        setNewBlock(null)
        return
      }
      // Prioridad 2: centrar el scroll si no está centrado
      if (!isAlreadyCentered()) { e.stopPropagation(); centerNow() }
      // Si ya está centrado, dejar propagar → comportamiento normal de Escape
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [viewMode, colW, slotH, newBlock]) // eslint-disable-line

  // ── Refs drag/resize ──────────────────────────────────────────────────────
  const justResized  = useRef(false)
  const justDragged  = useRef(false)
  const resizeRef    = useRef<{id:string; startMs:number; gcalEvent?:CalendarEvent}|null>(null)
  // Offset del cursor respecto al top del bloque al iniciar el drag (px).
  // Se usa en dragOver para posicionar la snap line en el inicio real del bloque.
  const dragOffsetY  = useRef(0)

  // ── Drop en columna timeline ──────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, day: Date, colEl: HTMLElement) {
    e.preventDefault()
    const nodeId  = e.dataTransfer.getData('plannerTaskId')
                 || e.dataTransfer.getData('nodeId')
                 || e.dataTransfer.getData('text/plain')
    const blockId = e.dataTransfer.getData('plannerBlockId')
    const rect    = colEl.getBoundingClientRect()

    if (nodeId) {
      const node = store.getNode(nodeId)
      if (!node) return
      const rawY = e.clientY - rect.top
      const rawStart = pxToTime(rawY, day)
      const clampedHour = Math.max(HOUR_START, Math.min(HOUR_END - 1, rawStart.getHours()))
      const start = new Date(rawStart)
      if (rawStart.getHours() < HOUR_START || rawStart.getHours() >= HOUR_END) {
        start.setHours(clampedHour, 0, 0, 0)
      }
      const end = new Date(start.getTime() + 3600000)

      // Nuevo modelo: solo actualizar due+dueEnd en el nodo original. Sin mover, sin duplicar.
      store.updateNode(nodeId, {
        due:    start.toISOString(),
        dueEnd: end.toISOString(),
        // Asegurar que tiene status para que aparezca como tarea
        status: node.status ?? 'pending',
      })

      // GCal sync
      syncNodeToGcal(nodeId, start, end)

    } else if (blockId) {
      // Mover bloque legacy (_timeBlock) o bloque nuevo
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const start   = pxToTime(e.clientY - rect.top - offsetY, day)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
      const n = store.getNode(blockId)
      if (!n?.due) return
      const dur = n.dueEnd ? new Date(n.dueEnd).getTime() - new Date(n.due).getTime() : 3600000
      const end = new Date(start.getTime() + dur)

      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._timeBlock === '1') {
          // Legacy: mover el time block + mover el nodo vinculado al nuevo día diary
          store.updateNode(blockId, { due: start.toISOString(), dueEnd: end.toISOString(), parentId: ensureDayPath(day).id })
          return
        }
      } catch {}

      // Nuevo modelo: actualizar due en el nodo original
      store.updateNode(blockId, { due: start.toISOString(), dueEnd: end.toISOString() })
      syncNodeToGcal(blockId, start, end)

    } else {
      // GCal event arrastrado
      const gcalId = e.dataTransfer.getData('plannerGcalId')
      if (!gcalId) return
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const newStart = pxToTime(e.clientY - rect.top - offsetY, day)
      if (newStart.getHours() < HOUR_START || newStart.getHours() >= HOUR_END) return
      const ev = gcalEvents.find(x => x.id === gcalId)
      if (!ev) return
      const dur = new Date(ev.end).getTime() - new Date(ev.start).getTime()
      const newEnd = new Date(newStart.getTime() + dur)
      const optimistic: CalendarEvent = { ...ev, start: newStart.toISOString(), end: newEnd.toISOString() }
      setGcalEvents(p => p.map(x => x.id === gcalId ? optimistic : x))
      updateCalendarEvent(gcalId, { start: newStart.toISOString(), end: newEnd.toISOString() })
        .then(updated => setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x)))
        .catch(() => setGcalEvents(p => p.map(x => x.id === gcalId ? ev : x)))
    }
  }

  // ── Drop en zona all-day ──────────────────────────────────────────────────
  function handleAllDayDrop(e: React.DragEvent, day: Date) {
    e.preventDefault()
    e.stopPropagation()
    const nodeId = e.dataTransfer.getData('plannerTaskId')
                || e.dataTransfer.getData('nodeId')
                || e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    const node = store.getNode(nodeId)
    if (!node) return
    // Asignar due = medianoche del día (sin hora) → aparece en all-day
    store.updateNode(nodeId, {
      due:    toMidnight(day),
      dueEnd: null,
      status: node.status ?? 'pending',
    })
    // Si tenía GCal event → eliminarlo (ya no tiene hora)
    removeNodeFromGcal(nodeId)
  }

  // ── Slot clic → nuevo bloque standalone ──────────────────────────────────
  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if (justResized.current || justDragged.current) return
    if ((e.target as HTMLElement).closest('.pp-block') || (e.target as HTMLElement).closest('.pp-new-block')) return
    const rawY  = e.clientY - colEl.getBoundingClientRect().top
    const start = pxToTime(rawY, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    setNewBlock({ day, start, top: snapPx(rawY), text: '' })
    setTimeout(() => newBlockRef.current?.focus(), 20)
  }

  function commitNewBlock() {
    if (!newBlock) return
    if (newBlock.text.trim()) {
      const start = newBlock.start
      const end   = new Date(start.getTime() + 3600000)
      // Crear nodo standalone con due+hora (sin _timeBlock)
      const newNode = store.createNode({
        text:     newBlock.text.trim(),
        parentId: ensureDayPath(newBlock.day).id,
        due:      start.toISOString(),
        isTask:   true,
      })
      store.updateNode(newNode.id, { dueEnd: end.toISOString() })
      syncNodeToGcal(newNode.id, start, end)
    }
    setNewBlock(null)
  }

  // ── Drag bloque en timeline ───────────────────────────────────────────────
  function handleBlockDragStart(e: React.DragEvent, b: Block) {
    const el = e.currentTarget as HTMLElement
    const offsetY = String(Math.round(e.clientY - el.getBoundingClientRect().top))
    if (b.kind === 'gcal') {
      e.dataTransfer.setData('plannerGcalId', b.id)
    } else {
      // Usar el nodeId real del nodo (no el id del legacy time block)
      const realId = b.nodeId || b.id
      e.dataTransfer.setData('plannerBlockId', realId)
    }
    e.dataTransfer.setData('plannerBlockOffsetY', offsetY)
    e.dataTransfer.effectAllowed = 'move'
    dragOffsetY.current = parseFloat(offsetY)  // para corregir snap line en dragOver
    justDragged.current = false
    const onEnd = () => {
      justDragged.current = true
      dragOffsetY.current = 0  // reset tras soltar
      setTimeout(()=>{justDragged.current=false},200)
      el.removeEventListener('dragend',onEnd)
    }
    el.addEventListener('dragend', onEnd)
  }

  // ── Resize bloque ─────────────────────────────────────────────────────────
  function handleBlockResize(e: React.MouseEvent, b: Block) {
    e.stopPropagation(); e.preventDefault()
    const startMs = b.start.getTime()
    resizeRef.current = { id: b.nodeId || b.id, startMs, gcalEvent: b.kind === 'gcal' ? b.gcalEvent : undefined }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const realId = resizeRef.current.id
      const el = document.querySelector(`[data-pp-block="${b.id}"]`) as HTMLElement
      const col = el?.closest('.pp-col') as HTMLElement
      if (!el || !col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(resizeRef.current.startMs)))
      el.style.height = h + 'px'
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const { id, startMs: sMs, gcalEvent } = resizeRef.current; resizeRef.current = null
      const col = document.querySelector(`[data-pp-block="${b.id}"]`)?.closest('.pp-col') as HTMLElement
      if (!col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(sMs)))
      const newEnd = new Date(sMs + h / pxPerMin * 60000)
      if (gcalEvent) {
        const optimistic = { ...gcalEvent, end: newEnd.toISOString() }
        setGcalEvents(p => p.map(x => x.id === gcalEvent.id ? optimistic : x))
        updateCalendarEvent(gcalEvent.id, { end: newEnd.toISOString() })
          .then(updated => setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x)))
          .catch(() => setGcalEvents(p => p.map(x => x.id === gcalEvent.id ? gcalEvent : x)))
      } else {
        store.updateNode(id, { dueEnd: newEnd.toISOString() })
        const n = store.getNode(id)
        if (n?.due) syncNodeToGcal(id, new Date(n.due), newEnd)
      }
      justResized.current = true; setTimeout(()=>{justResized.current=false}, 200)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Render bloque ─────────────────────────────────────────────────────────
  function renderBlock(b: Block) {
    return (
      <div key={b.id} data-pp-block={b.id}
        className={`pp-block pp-block--${b.kind}`}
        style={{ top: topPx(b.start), height: heightPx(b.start.getTime(), b.end.getTime()),
          background: b.color, left: 2, right: 2 }}
        draggable
        onDragStart={e => handleBlockDragStart(e, b)}
        onClick={e => {
          e.stopPropagation()
          if (justResized.current || justDragged.current) return
          if (b.kind === 'gcal' && b.gcalEvent) setEditingGcal(b.gcalEvent)
          else if (b.nodeId) navigate(`/node/${b.nodeId}`)
        }}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({x:e.clientX,y:e.clientY,b}) }}
        title={`${b.text}\n${fmtHH(b.start)} – ${fmtHH(b.end)}`}
      >
        <div className="pp-block-time">{fmtHH(b.start)}</div>
        <div className="pp-block-text">{b.text || 'Sin título'}</div>
        <div className="pp-block-resize" onMouseDown={e=>handleBlockResize(e,b)} />
      </div>
    )
  }

  // ── Render franja all-day ─────────────────────────────────────────────────
  function renderAllDayStrip(day: Date) {
    const items = getAllDayItems(day, gcalEvents)
    const stripH = Math.max(ALL_DAY_MIN_H, items.length * ALL_DAY_H + 4)
    return (
      <div
        className="pp-allday-strip"
        style={{ height: stripH, width: colW, flexShrink: 0 }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => handleAllDayDrop(e, day)}
      >
        {items.map(item => (
          <div
            key={item.id}
            className={`pp-allday-item pp-allday-item--${item.kind}`}
            style={{ background: item.color }}
            draggable={item.kind === 'task'}
            onDragStart={e => {
              if (item.kind !== 'task') return
              e.dataTransfer.setData('plannerTaskId', item.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={e => {
              e.stopPropagation()
              if (item.kind === 'task') navigate(`/node/${item.id}`)
              else if (item.gcalEvent) setEditingGcal(item.gcalEvent)
            }}
            title={item.text}
          >
            <span className="pp-allday-text">{item.text}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Render columna ────────────────────────────────────────────────────────
  function renderCol(day: Date) {
    const isToday  = sameDay(day, today)
    const nowTop   = topPx(new Date())
    return (
      <div key={day.toISOString()} className="pp-col-wrap" style={{ width: colW, flexShrink: 0 }}>
        <div className="pp-col" style={{ height: TOTAL_HOURS * hourH }}
          onDragOver={e=>{ e.preventDefault(); e.currentTarget.classList.add('pp-col--drag-over')
            const rawY = e.clientY - e.currentTarget.getBoundingClientRect().top
            // Restar el offset del cursor dentro del bloque para que la línea marque el inicio real
            const topY = rawY - dragOffsetY.current
            setSnapLine({ dayKey: day.toISOString(), top: snapPx(Math.max(0, topY)) })
          }}
          onDragLeave={e=>{ e.currentTarget.classList.remove('pp-col--drag-over'); setSnapLine(null) }}
          onDrop={e=>{ e.currentTarget.classList.remove('pp-col--drag-over'); setSnapLine(null); handleDrop(e, day, e.currentTarget) }}
          onClick={e=>handleSlotClick(e, day, e.currentTarget)}
        >
          {Array.from({length: TOTAL_HOURS*4}, (_,i) => (
            <div key={i} className={`pp-slot ${i%4===0?'pp-slot--hr':i%2===0?'pp-slot--half':'pp-slot--qtr'}`} style={{top: i*(slotH/2)}} />
          ))}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS*hourH && <div className="pp-now" style={{top:nowTop}} />}
          {snapLine?.dayKey === day.toISOString() && (
            <div className="pp-snap-line" style={{ top: snapLine.top }} />
          )}
          {getTimedBlocks(day, gcalEvents).map(renderBlock)}

          {newBlock && sameDay(newBlock.day, day) && (
            <div className="pp-new-block" style={{ top: newBlock.top, left: 2, right: 2 }}>
              <div className="pp-block-time">{fmtHH(newBlock.start)}</div>
              <input
                ref={newBlockRef}
                className="pp-new-block-input"
                value={newBlock.text}
                placeholder="Nombre…"
                onChange={e => setNewBlock(b => b ? {...b, text: e.target.value} : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewBlock() }
                  if (e.key === 'Escape') setNewBlock(null)
                }}
                onBlur={commitNewBlock}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Vista año ─────────────────────────────────────────────────────────────
  function renderYear() {
    const year = centerDate.getFullYear()
    return (
      <div className="pp-year-grid">
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const firstOfMonth = new Date(year, monthIdx, 1)
          const totalDays    = daysInMonth(firstOfMonth)
          const firstDow     = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
          const cells: (number | null)[] = []
          for (let i = 0; i < firstDow; i++) cells.push(null)
          for (let d = 1; d <= totalDays; d++) cells.push(d)
          return (
            <div key={monthIdx} className="pp-year-month">
              <div className="pp-year-month-name">{MONTHS_L[monthIdx]}</div>
              <div className="pp-year-dow-row">
                {['L','M','X','J','V','S','D'].map(d => <div key={d} className="pp-year-dow">{d}</div>)}
              </div>
              <div className="pp-year-days">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="pp-year-day pp-year-day--empty" />
                  const date  = new Date(year, monthIdx, d)
                  const isTod = sameDay(date, today)
                  const hasGcal = gcalEvents.some(ev => !ev.allDay && sameDay(new Date(ev.start), date))
                  const hasTasks = [...store.allActive()].some(n => n.due && sameDay(new Date(n.due), date) && n.status !== null)
                  return (
                    <div key={d}
                      className={`pp-year-day ${isTod?'pp-year-day--today':''}`}
                      onClick={() => { const dayNode = ensureDayPath(date); navigate(`/node/${dayNode.id}`); setCenterDate(date); setViewMode('day') }}
                      title={date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })}
                    >
                      {d}
                      {(hasGcal || hasTasks) && <div className="pp-year-day-dot" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navTitle = viewMode === 'day'
    ? centerDate.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })
    : `${centerDate.getFullYear()}`

  function navDelta(d: number) {
    setCenterDate(prev => viewMode === 'day' ? addDays(prev, d) : new Date(prev.getFullYear() + d, prev.getMonth(), 1))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pp-root" style={{ width: '100%' }}>

      {/* Header */}
      <div className="pp-header">
        <div className="pp-view-tabs">
          {(['day','year'] as ViewMode[]).map(m => (
            <button key={m} className={`pp-tab ${viewMode===m?'pp-tab--active':''}`} onClick={()=>setViewMode(m)}>
              {m==='day'?'Día':'Año'}
            </button>
          ))}
        </div>
        <button className="pp-nav-btn" onClick={()=>navDelta(-1)}>‹</button>
        <span className="pp-nav-title">{navTitle}</span>
        <button className="pp-nav-btn" onClick={()=>navDelta(1)}>›</button>
        <button className="pp-today-btn" onClick={()=>setCenterDate(today)}>Hoy</button>
        <button className="pp-today-btn pp-reset-btn" onClick={resetZoom}
          title={`Restablecer zoom — ahora: ${visibleDayCnt} días`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>

      {gcalError && (
        <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--warning)', background: 'rgba(239,68,68,0.06)', flexShrink: 0 }}>
          ⚠️ {gcalError} — <button onClick={() => navigate('/settings?tab=google')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11 }}>Reconectar</button>
        </div>
      )}

      {/* Timeline */}
      <div className="pp-timeline" ref={el => {
        (scrollVRef as any).current = el
        ;(scrollHRef as any).current = el
        ;(timelineRef as any).current = el
        if (el && !(el as any)._wheelBound) {
          (el as any)._wheelBound = true
          el.addEventListener('wheel', (ev: WheelEvent) => {
            if (!ev.shiftKey || viewMode !== 'day') return
            ev.preventDefault()
            const dir = ev.deltaY > 0 ? 1 : -1
            setSlotH(prev => {
              const minSlot = Math.max(8, Math.floor(el.clientHeight / (TOTAL_HOURS * 2)))
              const frac    = el.scrollTop / (TOTAL_HOURS * prev * 2)
              const next    = Math.max(minSlot, Math.min(MAX_SLOT_H, prev - dir * 4))
              setTimeout(() => { el.scrollTop = frac * TOTAL_HOURS * next * 2 }, 0)
              return next
            })
          }, { passive: false })
        }
      }}>
        {viewMode === 'year' ? renderYear() : (
          <>
            {/* Cabeceras */}
            <div className="pp-heads" ref={headRef} onMouseDown={handleHeadersDrag}
              title="Arrastra izq/der para ver más/menos días (2–7)">
              <div style={{width: AXIS_W, flexShrink:0, position:'sticky', left:0, background:'var(--bg-primary)', zIndex:10}} />
              {visibleDays.map(d => (
                <div key={d.toISOString()} className={`pp-col-head ${sameDay(d,today)?'pp-col-head--today':''} ${sameDay(d,centerDate)?'pp-col-head--center':''}`}
                  style={{width:colW, flexShrink:0}}>
                  {dayLabel(d)}
                </div>
              ))}
            </div>

            {/* Franja all-day */}
            <div className="pp-allday-row">
              <div className="pp-allday-axis" style={{width: AXIS_W, flexShrink: 0}}>
                <span className="pp-allday-label">Todo el día</span>
              </div>
              {visibleDays.map(d => renderAllDayStrip(d))}
            </div>

            {/* Grid de horas */}
            <div className="pp-grid">
              <div className="pp-axis" style={{width:AXIS_W, height: TOTAL_HOURS*hourH}}
                onMouseDown={handleAxisDrag} title="Arrastra arriba/abajo para hacer zoom">
                {Array.from({length:TOTAL_HOURS+1},(_,i) => (
                  <div key={i} className="pp-axis-label" style={{top: i*hourH-8}}>
                    {String(HOUR_START+i).padStart(2,'0')}:00
                  </div>
                ))}
              </div>
              <div style={{display:'flex'}}>
                {visibleDays.map(d => renderCol(d))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:998}} onClick={()=>setCtxMenu(null)} />
          <div className="pp-ctx" style={{left:ctxMenu.x,top:ctxMenu.y}}>
            {ctxMenu.b.kind === 'gcal' && (
              <button onClick={()=>{
                const d = ensureDayPath(ctxMenu.b.start)
                store.createNode({text:ctxMenu.b.text, parentId:d.id})
                setCtxMenu(null)
              }}>📄 Crear nodo</button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{ navigate(`/node/${ctxMenu.b.nodeId!}`); setCtxMenu(null) }}>
                → Ir al nodo
              </button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{
                const nodeId = ctxMenu.b.nodeId!
                const day = ctxMenu.b.start
                store.updateNode(nodeId, { due: toMidnight(day), dueEnd: null })
                removeNodeFromGcal(nodeId)
                setCtxMenu(null)
              }}>
                ⊘ Quitar hora (→ todo el día)
              </button>
            )}
            {/* Color picker */}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <div style={{padding:'6px 8px 2px', borderTop:'1px solid var(--border)', marginTop:4}}>
                <div style={{fontSize:10,color:'var(--text-secondary)',marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Color</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {[
                    {c:'#3b82f6',n:'Azul'},{c:'#10b981',n:'Verde'},{c:'#f59e0b',n:'Naranja'},
                    {c:'#ef4444',n:'Rojo'},{c:'#8b5cf6',n:'Morado'},{c:'#ec4899',n:'Rosa'},
                    {c:'#06b6d4',n:'Cian'},{c:'#64748b',n:'Gris'}
                  ].map(({c,n})=>(
                    <div key={c} title={n}
                      style={{width:20,height:20,borderRadius:'50%',background:c,cursor:'pointer',
                        border: ctxMenu.b.color===c ? '2px solid var(--text)' : '2px solid transparent', boxSizing:'border-box'}}
                      onClick={()=>{ if (ctxMenu.b.nodeId) store.updateNode(ctxMenu.b.nodeId, {color:c}); setCtxMenu(null) }}
                    />
                  ))}
                </div>
              </div>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{
                store.updateNode(ctxMenu.b.nodeId!, { due: null, dueEnd: null })
                removeNodeFromGcal(ctxMenu.b.nodeId!)
                setCtxMenu(null)
              }}>
                Quitar del planificador
              </button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button className="pp-ctx-danger" style={{marginTop:4}} onClick={()=>{
                const nodeId = ctxMenu.b.nodeId!
                removeNodeFromGcal(nodeId)
                store.deleteNode(nodeId)
                setCtxMenu(null)
              }}>
                Eliminar evento
              </button>
            )}
            {ctxMenu.b.kind === 'gcal' && (
              <button className="pp-ctx-danger" onClick={async ()=>{
                try { await deleteCalendarEvent(ctxMenu.b.id) } catch {}
                setGcalEvents(p => p.filter(x => x.id !== ctxMenu.b.id))
                setCtxMenu(null)
              }}>
                Eliminar evento
              </button>
            )}
          </div>
        </>
      )}

      {editingGcal && (
        <GCalEventEditor event={editingGcal} modal onClose={()=>setEditingGcal(null)}
          onUpdated={ev=>{setGcalEvents(p=>p.map(x=>x.id===ev.id?ev:x));setEditingGcal(null)}}
          onDeleted={id=>{setGcalEvents(p=>p.filter(x=>x.id!==id));setEditingGcal(null)}} />
      )}
    </div>
  )
}
