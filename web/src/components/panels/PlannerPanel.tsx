/**
 * PlannerPanel — Panel lateral derecho de planificación temporal.
 *
 * Se abre desde el botón de calendario en el top-bar.
 * Muestra únicamente el timeline (Día / Semana / Mes) sin columna de tareas:
 * el árbol central de From sirve como lista de tareas.
 *
 * Redimensionable arrastrando el borde izquierdo.
 * Time blocks: nodos _timeBlock:"1". GCal events como time blocks.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import { getCalendarEventsRange, updateCalendarEvent, type CalendarEvent } from '../../api/googleCalendar'
import { GCalEventEditor } from './DiaryRightPanel'
import { useUserStore } from '../../store/userStore'

// ── Geometría fija ────────────────────────────────────────────────────────
const HOUR_START    = 6
const HOUR_END      = 24
const TOTAL_HOURS   = HOUR_END - HOUR_START
const AXIS_W        = 40
const DEFAULT_W     = 840
const MIN_W         = 280
const MAX_W         = 1400
const DEFAULT_SLOT_H  = 40   // px por 30 min (zoom por defecto)
const DEFAULT_DAY_CNT = 5    // columnas de día visibles por defecto
const MIN_SLOT_H    = 14     // zoom out máximo (18h en pantalla pequeña)
const MAX_SLOT_H    = 110    // zoom in máximo (~3h visibles)
const MIN_DAY_CNT   = 2
const MAX_DAY_CNT   = 7
const PRE_DAYS      = 10     // días pre-renderizados a cada lado

// ── Helpers ────────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
function fmtHH(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

const DAYS_S   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MONTHS_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function dayLabel(d: Date) { return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}` }

type ViewMode = 'day' | 'year'
interface Block { kind:'task'|'standalone'|'gcal'; id:string; text:string; start:Date; end:Date; color:string; linkedId?:string; gcalEvent?:CalendarEvent }

// ── Leer time blocks ───────────────────────────────────────────────────────
function getBlocks(day: Date, gcalEvents: CalendarEvent[]): Block[] {
  const blocks: Block[] = []
  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt) continue
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (ed._timeBlock !== '1') continue
      const start = new Date(n.due)
      if (!sameDay(start, day)) continue
      const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
      const linked = ed._linkedTaskId ? store.getNode(ed._linkedTaskId) : null
      blocks.push({ kind: ed._linkedTaskId ? 'task' : 'standalone', id: n.id,
        text: linked ? linked.text : n.text, start, end,
        color: n.color || (ed._linkedTaskId ? 'var(--accent)' : '#8b5cf6'), linkedId: ed._linkedTaskId })
    } catch {}
  }
  for (const ev of gcalEvents) {
    if (ev.allDay) continue
    const start = new Date(ev.start)
    if (!sameDay(start, day)) continue
    blocks.push({ kind:'gcal', id:ev.id, text:ev.title, start, end: new Date(ev.end),
      color: ev.backgroundColor || '#4a90d9', gcalEvent: ev })
  }
  return blocks.sort((a,b) => a.start.getTime() - b.start.getTime())
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
  const [viewMode,       setViewMode]       = useState<ViewMode>('day')
  const [centerDate,     setCenterDate]     = useState(today)
  // Zoom vertical (altura de slot 30 min) y horizontal (días visibles)
  const [slotH,          setSlotH]          = useState(DEFAULT_SLOT_H)
  const [visibleDayCnt,  setVisibleDayCnt]  = useState(DEFAULT_DAY_CNT)

  // Geometría derivada del zoom actual
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
  // Bloque inline en creación: posición + texto en progreso
  const [newBlock, setNewBlock]       = useState<{day:Date;start:Date;top:number;text:string}|null>(null)
  const newBlockRef                   = useRef<HTMLInputElement>(null)
  // Indicador snap durante drag-over: {dayKey, top}
  const [snapLine, setSnapLine]       = useState<{dayKey:string;top:number}|null>(null)

  // El ancho del panel lo gestiona MainLayout (right-panel-unified).
  // PlannerPanel usa width: 100% y el ResizeObserver adapta colW automáticamente.

  // ── GCal ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!us.googleConnected) return
    getCalendarEventsRange(addDays(centerDate,-14), addDays(centerDate,14)).then(setGcalEvents).catch(()=>{})
  }, [us.googleConnected, centerDate.toDateString()]) // eslint-disable-line

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

  // ── Drag eje vertical → zoom Y ────────────────────────────────────────────
  function handleAxisDrag(e: React.MouseEvent) {
    e.preventDefault()
    const startY     = e.clientY
    const startSlotH = slotH
    const scrollEl   = scrollVRef.current
    const scrollFrac = scrollEl ? scrollEl.scrollTop / (TOTAL_HOURS * startSlotH * 2) : 0
    function onMove(ev: MouseEvent) {
      const delta   = startY - ev.clientY   // arriba = zoom in
      // Mínimo dinámico: que las 18h quepan exactamente en el contenedor
      const minSlot = scrollEl ? Math.max(8, Math.floor(scrollEl.clientHeight / (TOTAL_HOURS * 2))) : 8
      const newSlot = Math.max(minSlot, Math.min(MAX_SLOT_H, startSlotH + delta * 0.5))
      setSlotH(newSlot)
      if (scrollEl) scrollEl.scrollTop = scrollFrac * TOTAL_HOURS * newSlot * 2
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Drag cabecera → zoom X ────────────────────────────────────────────────
  function handleHeadersDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.pp-col-head')) return
    e.preventDefault()
    const startX   = e.clientX
    const startCnt = visibleDayCnt
    function onMove(ev: MouseEvent) {
      const steps = Math.round((ev.clientX - startX) / 40)  // derecha = menos días
      setVisibleDayCnt(Math.max(MIN_DAY_CNT, Math.min(MAX_DAY_CNT, startCnt + steps)))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function resetZoom() { setSlotH(DEFAULT_SLOT_H); setVisibleDayCnt(DEFAULT_DAY_CNT) }

  // ── Días visibles — pre-renderizamos PRE_DAYS a cada lado ────────────────
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
    if (headRef.current) headRef.current.scrollLeft = pos
  }, [viewMode, centerDate.toDateString(), colW]) // eslint-disable-line

  useEffect(() => {
    const grid = scrollHRef.current; if (!grid) return
    const sync = () => { if (headRef.current) headRef.current.scrollLeft = grid.scrollLeft }
    grid.addEventListener('scroll', sync, {passive:true})
    return () => grid.removeEventListener('scroll', sync)
  }, [viewMode])

  useLayoutEffect(() => {
    if (!scrollVRef.current) return
    scrollVRef.current.scrollTop = Math.max(0, topPx(new Date()) - 100)
  }, [viewMode])

  // ── Función centrar en hoy ────────────────────────────────────────────────
  function centerNow() {
    if (!scrollHRef.current) return
    const pos = Math.max(0, PRE_DAYS * colW - (scrollHRef.current.clientWidth - AXIS_W) / 2 + colW / 2)
    scrollHRef.current.scrollTo({ left: pos, behavior: 'smooth' })
    if (scrollVRef.current) {
      scrollVRef.current.scrollTo({ top: Math.max(0, topPx(new Date()) - 120), behavior: 'smooth' })
    }
  }

  function isAlreadyCentered(): boolean {
    if (!scrollHRef.current) return true
    const expected = Math.max(0, PRE_DAYS * colW - (scrollHRef.current.clientWidth - AXIS_W) / 2 + colW / 2)
    return Math.abs(scrollHRef.current.scrollLeft - expected) < colW * 0.4
  }

  // ── Escape: centrar si no está centrado, si ya lo está → propagar ─────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || viewMode !== 'day') return
      if (!isAlreadyCentered()) {
        e.stopPropagation()
        centerNow()
      }
      // Si ya está centrado, dejar propagar → comportamiento normal de Escape
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [viewMode, colW, slotH]) // eslint-disable-line

  // ── Refs para drag/resize de bloques ─────────────────────────────────────
  const justResized = useRef(false)
  const justDragged = useRef(false)
  const resizeRef   = useRef<{id:string; startMs:number; gcalEvent?:CalendarEvent}|null>(null)

  // ── Drop en columna ───────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, day: Date, colEl: HTMLElement) {
    e.preventDefault()
    // Acepta: drag desde CalendarPlanner (plannerTaskId), drag desde planner column (nodeId),
    // y drag desde el handle ⋮⋮ del outliner (text/plain con el nodeId)
    const taskId  = e.dataTransfer.getData('plannerTaskId')
                 || e.dataTransfer.getData('nodeId')
                 || e.dataTransfer.getData('text/plain')
    const blockId = e.dataTransfer.getData('plannerBlockId')
    const rect    = colEl.getBoundingClientRect()

    if (taskId) {
      const rawY = e.clientY - rect.top
      // Clamp al rango visible en lugar de descartar el drop
      const rawStart = pxToTime(rawY, day)
      const clampedHour = Math.max(HOUR_START, Math.min(HOUR_END - 1, rawStart.getHours()))
      const start = new Date(rawStart)
      if (rawStart.getHours() < HOUR_START || rawStart.getHours() >= HOUR_END) {
        start.setHours(clampedHour, rawStart.getHours() < HOUR_START ? 0 : 45, 0, 0)
      }
      const node = store.getNode(taskId)
      if (!node) return
      const diaryNode = ensureDayPath(day)

      // Solo mover al nuevo día si es una TAREA (status !== null) bajo otro diary day
      if (node.status !== null) {
        let curParent = node.parentId ? store.getNode(node.parentId) : null
        while (curParent) {
          if (curParent.isDiaryEntry) {
            if (!sameDay(new Date(curParent.diaryDate!), day)) store.updateNode(taskId, { parentId: diaryNode.id })
            break
          }
          curParent = curParent.parentId ? store.getNode(curParent.parentId) : null
        }
      }
      // Para cualquier nodo (tarea, proyecto, nota…): crear time block vinculado
      store.createNode({ text: node.text || 'Time block', parentId: diaryNode.id,
        due: start.toISOString(), extraData: { _timeBlock:'1', _linkedTaskId: taskId } })
    } else if (blockId) {
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const start   = pxToTime(e.clientY - rect.top - offsetY, day)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
      const n = store.getNode(blockId)
      if (!n?.due) return
      const dur = n.dueEnd ? new Date(n.dueEnd).getTime() - new Date(n.due).getTime() : 3600000
      store.updateNode(blockId, { due: start.toISOString(), dueEnd: new Date(start.getTime()+dur).toISOString(),
        parentId: ensureDayPath(day).id })
    } else {
      // ── Evento GCal arrastrado ────────────────────────────────────────────
      const gcalId = e.dataTransfer.getData('plannerGcalId')
      if (!gcalId) return
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const newStart = pxToTime(e.clientY - rect.top - offsetY, day)
      if (newStart.getHours() < HOUR_START || newStart.getHours() >= HOUR_END) return
      const ev = gcalEvents.find(x => x.id === gcalId)
      if (!ev) return
      const dur = new Date(ev.end).getTime() - new Date(ev.start).getTime()
      const newEnd = new Date(newStart.getTime() + dur)
      // Optimistic update inmediato
      const optimistic: CalendarEvent = { ...ev, start: newStart.toISOString(), end: newEnd.toISOString() }
      setGcalEvents(p => p.map(x => x.id === gcalId ? optimistic : x))
      // Sync GCal en background, revertir si falla
      updateCalendarEvent(gcalId, { start: newStart.toISOString(), end: newEnd.toISOString() })
        .then(updated => setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x)))
        .catch(() => setGcalEvents(p => p.map(x => x.id === gcalId ? ev : x)))
    }
  }

  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
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
      store.createNode({
        text:      newBlock.text.trim(),
        parentId:  ensureDayPath(newBlock.day).id,
        due:       newBlock.start.toISOString(),
        extraData: { _timeBlock: '1' },
      })
    }
    setNewBlock(null)
  }

  // ── Drag bloque ───────────────────────────────────────────────────────────
  function handleBlockDragStart(e: React.DragEvent, b: Block) {
    const el = e.currentTarget as HTMLElement
    const offsetY = String(Math.round(e.clientY - el.getBoundingClientRect().top))
    if (b.kind === 'gcal') {
      e.dataTransfer.setData('plannerGcalId', b.id)
    } else {
      e.dataTransfer.setData('plannerBlockId', b.id)
    }
    e.dataTransfer.setData('plannerBlockOffsetY', offsetY)
    e.dataTransfer.effectAllowed = 'move'
    justDragged.current = false
    const onEnd = () => { justDragged.current = true; setTimeout(()=>{justDragged.current=false},200); el.removeEventListener('dragend',onEnd) }
    el.addEventListener('dragend', onEnd)
  }

  // ── Resize bloque ─────────────────────────────────────────────────────────
  function handleBlockResize(e: React.MouseEvent, b: Block) {
    e.stopPropagation(); e.preventDefault()
    const startMs = b.start.getTime()
    resizeRef.current = { id: b.id, startMs, gcalEvent: b.kind === 'gcal' ? b.gcalEvent : undefined }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const el = document.querySelector(`[data-pp-block="${resizeRef.current.id}"]`) as HTMLElement
      const col = el?.closest('.pp-col') as HTMLElement
      if (!el || !col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(resizeRef.current.startMs)))
      el.style.height = h + 'px'
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const { id, startMs: sMs, gcalEvent } = resizeRef.current; resizeRef.current = null
      const col = document.querySelector(`[data-pp-block="${id}"]`)?.closest('.pp-col') as HTMLElement
      if (!col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(sMs)))
      const newEnd = new Date(sMs + h / pxPerMin * 60000)
      if (gcalEvent) {
        // Optimistic update inmediato + sync GCal en background
        const optimistic = { ...gcalEvent, end: newEnd.toISOString() }
        setGcalEvents(p => p.map(x => x.id === id ? optimistic : x))
        updateCalendarEvent(id, { end: newEnd.toISOString() })
          .then(updated => setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x)))
          .catch(() => setGcalEvents(p => p.map(x => x.id === id ? gcalEvent : x)))
      } else {
        const n = store.getNode(id); if (!n?.due) return
        store.updateNode(id, { dueEnd: newEnd.toISOString() })
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
          else if (b.linkedId) navigate(`/node/${b.linkedId}`)
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

  // ── Render columna ────────────────────────────────────────────────────────
  function renderCol(day: Date) {
    const isToday  = sameDay(day, today)
    const isCenter = sameDay(day, centerDate)
    const nowTop   = topPx(new Date())
    return (
      <div key={day.toISOString()} className="pp-col-wrap" style={{ width: colW, flexShrink: 0 }}>
        <div className="pp-col" style={{ height: TOTAL_HOURS * hourH }}
          onDragOver={e=>{ e.preventDefault(); e.currentTarget.classList.add('pp-col--drag-over')
            const rawY = e.clientY - e.currentTarget.getBoundingClientRect().top
            setSnapLine({ dayKey: day.toISOString(), top: snapPx(rawY) })
          }}
          onDragLeave={e=>{ e.currentTarget.classList.remove('pp-col--drag-over'); setSnapLine(null) }}
          onDrop={e=>{ e.currentTarget.classList.remove('pp-col--drag-over'); setSnapLine(null); handleDrop(e, day, e.currentTarget) }}
          onClick={e=>handleSlotClick(e, day, e.currentTarget)}
        >
          {Array.from({length: TOTAL_HOURS*4}, (_,i) => (
            <div key={i} className={`pp-slot ${i%4===0?'pp-slot--hr':i%2===0?'pp-slot--half':'pp-slot--qtr'}`} style={{top: i*(slotH/2)}} />
          ))}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS*hourH && <div className="pp-now" style={{top:nowTop}} />}
          {/* Indicador de snap durante drag-over */}
          {snapLine?.dayKey === day.toISOString() && (
            <div className="pp-snap-line" style={{ top: snapLine.top }} />
          )}
          {getBlocks(day, gcalEvents).map(renderBlock)}

          {/* Bloque inline en creación */}
          {newBlock && sameDay(newBlock.day, day) && (
            <div
              className="pp-new-block"
              style={{ top: newBlock.top, left: 2, right: 2 }}
            >
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

  // ── Año — cuadrícula 3×4 con los 12 meses ────────────────────────────────
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
              {/* Nombre del mes */}
              <div className="pp-year-month-name">{MONTHS_L[monthIdx]}</div>
              {/* Cabecera días de la semana */}
              <div className="pp-year-dow-row">
                {['L','M','X','J','V','S','D'].map(d => (
                  <div key={d} className="pp-year-dow">{d}</div>
                ))}
              </div>
              {/* Días */}
              <div className="pp-year-days">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="pp-year-day pp-year-day--empty" />
                  const date    = new Date(year, monthIdx, d)
                  const isTod   = sameDay(date, today)
                  const hasGcal = gcalEvents.some(ev => !ev.allDay && sameDay(new Date(ev.start), date))
                  return (
                    <div
                      key={d}
                      className={`pp-year-day ${isTod ? 'pp-year-day--today' : ''}`}
                      onClick={() => {
                        const dayNode = ensureDayPath(date)
                        navigate(`/node/${dayNode.id}`)
                      }}
                      title={date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })}
                    >
                      {d}
                      {hasGcal && <div className="pp-year-day-dot" />}
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

  // ── Nav title ─────────────────────────────────────────────────────────────
    const navTitle = viewMode === 'day'
    ? centerDate.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })
    : `${centerDate.getFullYear()}`

  function navDelta(d: number) {
    setCenterDate(prev => viewMode === 'day'
      ? addDays(prev, d)
      : new Date(prev.getFullYear() + d, prev.getMonth(), 1)
    )
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

      {/* Timeline */}
      <div className="pp-timeline" ref={el => {
        (scrollVRef as any).current = el
        // Shift+wheel → zoom Y. Rueda normal → scroll vertical estándar (no interceptar)
        if (el && !(el as any)._wheelBound) {
          (el as any)._wheelBound = true
          el.addEventListener('wheel', (ev: WheelEvent) => {
            if (!ev.shiftKey || viewMode !== 'day') return   // solo Shift+rueda
            ev.preventDefault()
            const dir = ev.deltaY > 0 ? 1 : -1  // abajo = zoom out
            setSlotH(prev => {
              // Mínimo dinámico: que el día completo quepa en el contenedor
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
            {/* Cabeceras sync */}
            <div className="pp-heads" ref={headRef} onMouseDown={handleHeadersDrag}
              title="Arrastra izq/der para ver más/menos días (2–7)">
              {/* Espacio para alinear con el eje de horas */}
              <div style={{width: AXIS_W, flexShrink:0}} />
              {visibleDays.map(d => (
                <div key={d.toISOString()} className={`pp-col-head ${sameDay(d,today)?'pp-col-head--today':''} ${sameDay(d,centerDate)?'pp-col-head--center':''}`}
                  style={{width:colW, flexShrink:0}}>
                  {dayLabel(d)}
                </div>
              ))}
            </div>
            {/* Grid horizontal */}
            <div className={`pp-grid ${viewMode==='day'?'pp-grid--scroll':''}`} ref={el => { (scrollHRef as any).current = el; (timelineRef as any).current = el }}>
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
            {ctxMenu.b.kind==='gcal' && <button onClick={()=>{ const d=ensureDayPath(ctxMenu.b.start); store.createNode({text:ctxMenu.b.text,parentId:d.id}); setCtxMenu(null) }}>📄 Crear nodo</button>}
            {ctxMenu.b.kind==='task' && ctxMenu.b.linkedId && <button onClick={()=>{navigate(`/node/${ctxMenu.b.linkedId!}`);setCtxMenu(null)}}>→ Ir a la tarea</button>}
            {ctxMenu.b.kind==='standalone' && <button onClick={()=>{ const d=ensureDayPath(ctxMenu.b.start); store.createNode({text:ctxMenu.b.text,parentId:d.id,isTask:true}); store.deleteNode(ctxMenu.b.id); setCtxMenu(null) }}>✓ Convertir a tarea</button>}
            {/* Color picker — funciona para time blocks y GCal */}
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
                      border: ctxMenu.b.color===c ? '2px solid var(--text)' : '2px solid transparent',
                      boxSizing:'border-box'}}
                    onClick={()=>{
                      if (ctxMenu.b.kind!=='gcal') {
                        store.updateNode(ctxMenu.b.id, {color: c})
                      }
                      setCtxMenu(null)
                    }}
                  />
                ))}
              </div>
            </div>
            {ctxMenu.b.kind!=='gcal' && <button className="pp-ctx-danger" style={{marginTop:6}} onClick={()=>{store.deleteNode(ctxMenu.b.id);setCtxMenu(null)}}>Eliminar time block</button>}
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
