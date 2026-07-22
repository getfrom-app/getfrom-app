/**
 * PlannerPanel — Panel lateral derecho de planificación temporal.
 *
 * Modelo de datos (v2 — sin time blocks separados):
 *   - Nodos con `due` + hora → aparecen en el timeline. El nodo NO se mueve.
 *   - Nodos con `due` sin hora NO aparecen aquí (viven en la sección «Tu día»
 *     de la nota diaria). GCal: solo eventos con hora (allDay tampoco se pinta).
 *   - Vistas: Día (solo hoy, 1 columna) · Semana (2–7 columnas) · Año.
 *
 * Drag desde el árbol: asigna due+hora al nodo original. No crea duplicados.
 * GCal sync: si el usuario tiene GCal conectado, crear/actualizar evento al programar.
 *
 * Backward compat: nodos legacy _timeBlock:"1" se siguen mostrando en timeline.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import { bumpReschedule } from '../../utils/dailyCockpit'
import { isInPapelera } from '../../utils/papeleraHelper'
import { gcalEventNodeId } from '../../utils/deterministicId'
import { firstContextOf, contextColor } from '../../utils/cajones'
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
const DEFAULT_SLOT_H  = 40   // px por 30 min
const DEFAULT_DAY_CNT = 5
const MIN_SLOT_H      = 14
const MAX_SLOT_H      = 110
const MIN_DAY_CNT     = 2
const MAX_DAY_CNT     = 7
const PRE_DAYS        = 10
const MIN_BLOCK_H_FOR_TIME = 28 // px — por debajo de esto, la hora se oculta y solo queda el título

// ── Helpers ────────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r }
function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
function fmtHH(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

// ── Pastel: hace cualquier color suave (menos saturado, más claro) ──────────
function parseColor(input: string): [number, number, number] | null {
  const s = (input || '').trim()
  const hex = s.match(/^#?([0-9a-f]{6})$/i)
  if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  const rgb = s.match(/rgba?\(([^)]+)\)/i)
  if (rgb) { const p = rgb[1].split(',').map(x => parseFloat(x)); return [p[0], p[1], p[2]] }
  return null
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0; const l = (mx + mn) / 2; let sat = 0
  if (mx !== mn) {
    const d = mx - mn
    sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  return [h, sat, l]
}
function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
/** ¿Color gris/desaturado? (los eventos GCal sin color propio vuelven grises). */
function isGreyish(input: string): boolean {
  const rgb = parseColor(input)
  if (!rgb) return false
  return rgbToHsl(rgb[0], rgb[1], rgb[2])[1] < 0.12
}
/** Versión PASTEL de un color (claro y poco saturado). */
function pastelize(input: string): string {
  const rgb = parseColor(input)
  if (!rgb) return '#cdbdf2'
  const [h, s0] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const s = Math.min(0.62, Math.max(0.42, s0))
  return hslToHex(h, s, 0.80)
}

/** Devuelve true si el ISO tiene hora local distinta de medianoche (= tiene hora asignada). */
function hasTime(isoStr: string): boolean {
  const d = new Date(isoStr)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/** ISO a medianoche local del día dado. */
function toMidnight(day: Date): string {
  const d = new Date(day); d.setHours(0,0,0,0); return d.toISOString()
}

// Nombres de día/mes según el idioma activo de la interfaz (antes fijos en español).
function dayLabel(d: Date, locale: string) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d)
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d)
  return `${weekday} ${d.getDate()} ${month}`
}
function monthLabel(d: Date, locale: string) { return new Intl.DateTimeFormat(locale, { month: 'long' }).format(d) }

// 'day' = solo hoy (1 col) · 'week' = multi-día · 'month' = rejilla mensual · 'year' = anual
type ViewMode = 'day' | 'week' | 'month' | 'year'

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

// ── Leer bloques con hora (timeline) ─────────────────────────────────────
function getTimedBlocks(day: Date, gcalEvents: CalendarEvent[]): Block[] {
  const blocks: Block[] = []

  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt || isInPapelera(n.id)) continue
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
          color: n.color || 'var(--accent)',
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
    if (fromGcalIds.has(ev.id)) continue // deduplicar: ya hay un nodo local enlazado a este evento
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

  // Dedup defensivo: un evento recurrente de Google puede llegar con un id de
  // INSTANCIA que no coincide con el gcalEventId maestro guardado en el nodo
  // local, así que fromGcalIds no lo detecta y el mismo evento se pinta dos
  // veces (nodo local 'task' + crudo 'gcal'). Nos quedamos con la versión
  // editable (nodo local) cuando coinciden título+hora de inicio.
  const byKey = new Map<string, Block>()
  for (const b of blocks) {
    const key = `${b.text.trim().toLowerCase()}|${b.start.getTime()}`
    const existing = byKey.get(key)
    if (!existing || (existing.kind === 'gcal' && b.kind !== 'gcal')) byKey.set(key, b)
  }

  return [...byKey.values()].sort((a, b) => a.start.getTime() - b.start.getTime())
}

// ══════════════════════════════════════════════════════════════════════════
// PlannerPanel
// ══════════════════════════════════════════════════════════════════════════

interface Props {
  onClose: () => void
  initialView?: ViewMode
  initialDays?: number
  /** Qué pestañas día/semana/mes/año se muestran en el selector. Por defecto, las 4
      (v1 y el overlay embebido del planner). El tab «Día» de la columna derecha v2
      pasa solo ['day'] (Alberto, 21 jul: «quitamos Día del planificador, va a su
      propio tab») y el overlay del planificador (v2, abierto desde el tab Agenda)
      pasa ['week','month','year'] — Día ya no vive ahí. */
  viewTabs?: ViewMode[]
}

const ALL_VIEW_TABS: ViewMode[] = ['day', 'week', 'month', 'year']

export default function PlannerPanel({ onClose, initialView, initialDays, viewTabs = ALL_VIEW_TABS }: Props) {
  const s        = useStore()
  const us       = useUserStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const today = startOfDay(new Date())
  const [viewMode,      setViewMode]      = useState<ViewMode>(initialView ?? viewTabs[0] ?? 'day')
  const [centerDate,    setCenterDate]    = useState(today)
  const [slotH,         setSlotH]         = useState(DEFAULT_SLOT_H)
  const [visibleDayCnt, setVisibleDayCnt] = useState(initialDays ?? DEFAULT_DAY_CNT)
  // Auto-fit: el día completo (HOUR_START–HOUR_END) cuadra en el alto del timeline,
  // sin scroll. Se desactiva al hacer zoom manual (rueda/arrastre) y vuelve con «reset».
  const [autoFit, setAutoFit] = useState(true)
  const autoFitRef = useRef(true)
  useEffect(() => { autoFitRef.current = autoFit }, [autoFit])

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
  const [newAllDay, setNewAllDay]     = useState<{day:Date;text:string}|null>(null)
  const newAllDayRef                  = useRef<HTMLInputElement>(null)
  const [snapLine, setSnapLine]       = useState<{dayKey:string;top:number}|null>(null)

  // ── GCal ──────────────────────────────────────────────────────────────────
  // Instantánea local, NO reactiva al store: borrar/mover una tarea enlazada a
  // Google desde fuera (p.ej. el botón de eliminar de "Eventos de hoy" en
  // DayColumn) actualiza el nodo local al instante, pero el bloque 'gcal' crudo
  // — deduplicado por título+hora contra ese nodo — se queda huérfano aquí
  // hasta que esta instantánea se refresque, así que el bloque parece no
  // borrarse/moverse hasta hacer refresh (Alberto, 22 jul). `pushEventToGcal`/
  // `deleteGcalEventForNode` disparan `from:gcal-events-changed` al escribir en
  // Google — la escuchamos aquí para refrescar sin esperar al date-change.
  const [gcalError, setGcalError] = useState('')
  const fetchGcalEvents = () => {
    if (!us.googleConnected) return
    setGcalError('')
    getCalendarEventsRange(addDays(centerDate,-14), addDays(centerDate,14))
      .then(evs => { setGcalEvents(evs); setGcalError('') })
      .catch(e => {
        console.error('[PlannerPanel] GCal error:', e)
        setGcalError(t('tip.gcalLoadError'))
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('token') || msg.includes('401') || msg.includes('refresh')) {
          us.markGoogleDisconnected()
        }
      })
  }
  useEffect(fetchGcalEvents, [us.googleConnected, centerDate.toDateString()]) // eslint-disable-line
  useEffect(() => {
    window.addEventListener('from:gcal-events-changed', fetchGcalEvents)
    return () => window.removeEventListener('from:gcal-events-changed', fetchGcalEvents)
  }) // eslint-disable-line

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
      const el = timelineRef.current
      if (!el) return
      const avail = el.clientWidth - AXIS_W - 2
      const cnt = viewMode === 'day' ? 1 : visibleDayCnt
      setColW(Math.max(60, Math.floor(avail / cnt)))
      // Auto-fit del alto: que el día entero quepa sin scroll. Resta lo que ocupan
      // la cabecera de días + la franja «todo el día» (viven dentro del scroll, así
      // que el grid solo dispone de clientHeight − offset de la rejilla).
      if (autoFitRef.current && (viewMode === 'day' || viewMode === 'week') && el.clientHeight > 0) {
        const gridEl = el.querySelector('.pp-grid') as HTMLElement | null
        const offset = gridEl ? gridEl.offsetTop : 64
        setSlotH(Math.max(6, Math.floor((el.clientHeight - offset - 2) / (TOTAL_HOURS * 2))))
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (timelineRef.current) ro.observe(timelineRef.current)
    return () => ro.disconnect()
  }, [visibleDayCnt, viewMode, autoFit])

  // ── Zoom Y (eje vertical) ────────────────────────────────────────────────
  function handleAxisDrag(e: React.MouseEvent) {
    e.preventDefault()
    setAutoFit(false)
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
    if (viewMode === 'day') return // vista día: una sola columna, sin zoom X
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

  function resetZoom() {
    setVisibleDayCnt(initialDays ?? DEFAULT_DAY_CNT)
    setAutoFit(true)
    const el = timelineRef.current
    if (el && el.clientHeight > 0) {
      const gridEl = el.querySelector('.pp-grid') as HTMLElement | null
      const offset = gridEl ? gridEl.offsetTop : 64
      setSlotH(Math.max(6, Math.floor((el.clientHeight - offset - 2) / (TOTAL_HOURS * 2))))
    } else setSlotH(DEFAULT_SLOT_H)
    if (scrollVRef.current) scrollVRef.current.scrollTop = 0
  }

  // ── Días visibles ─────────────────────────────────────────────────────────
  const visibleDays = useMemo(() =>
    viewMode === 'day'
      ? [centerDate]
      : Array.from({ length: PRE_DAYS*2+1 }, (_, i) => addDays(centerDate, i - PRE_DAYS))
  , [centerDate.toDateString(), viewMode]) // eslint-disable-line

  // Días de pre-carga a la izquierda del centro (0 en vista día: única columna)
  const preDays = viewMode === 'day' ? 0 : PRE_DAYS

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollHRef = useRef<HTMLDivElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const scrollVRef = useRef<HTMLDivElement>(null)

  // Posición de scroll que deja la columna de HOY (centerDate) pegada al borde
  // DERECHO del viewport — no centrada. Alberto: quiere poder arrastrar tareas a
  // «hoy» sin tener que buscarlo, siempre en el mismo sitio predecible (la derecha).
  // Los días anteriores quedan visibles a la izquierda como contexto reciente.
  function todayRightPos(): number {
    if (!scrollHRef.current) return 0
    return Math.max(0, (preDays + 1) * colW - (scrollHRef.current.clientWidth - AXIS_W))
  }

  useLayoutEffect(() => {
    if (viewMode === 'year' || !scrollHRef.current) return
    scrollHRef.current.scrollLeft = todayRightPos()
  }, [viewMode, centerDate.toDateString(), colW]) // eslint-disable-line

  useLayoutEffect(() => {
    if (!scrollVRef.current) return
    // Con auto-fit el día entero cabe → sin scroll. Si hay zoom manual, centra en ahora.
    scrollVRef.current.scrollTop = autoFit ? 0 : Math.max(0, topPx(new Date()) - 100)
  }, [viewMode, autoFit])

  function centerNow() {
    if (!scrollHRef.current) return
    scrollHRef.current.scrollTo({ left: todayRightPos(), behavior: 'smooth' })
    if (scrollVRef.current) scrollVRef.current.scrollTo({ top: Math.max(0, topPx(new Date()) - 120), behavior: 'smooth' })
  }

  function isAlreadyCentered(): boolean {
    if (!scrollHRef.current) return true
    return Math.abs(scrollHRef.current.scrollLeft - todayRightPos()) < colW * 0.4
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || viewMode === 'year') return
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
      const hadDate = !!node.due // ya tenía fecha → es un REAGENDADO (cuenta para el badge)
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

      if (hadDate) bumpReschedule(nodeId)

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

  // ── Nueva tarea «todo el día» (fecha sin hora) ───────────────────────────
  function commitNewAllDay(keepOpen = false) {
    if (!newAllDay) return
    const day = newAllDay.day
    if (newAllDay.text.trim()) {
      store.createNode({
        text:     newAllDay.text.trim(),
        parentId: ensureDayPath(day).id,
        due:      toMidnight(day),   // medianoche = todo el día (sin hora)
        isTask:   true,
      })
    }
    // keepOpen: encadenar varias tareas el mismo día sin reabrir
    if (keepOpen) setNewAllDay({ day, text: '' })
    else setNewAllDay(null)
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

  // Color base del planner: el de Ajustes (`from_planner_color`) o el acento del
  // tema. Los bloques se pintan en su versión PASTEL (suave, poco saturada).
  const plannerBase = (typeof document !== 'undefined'
    ? (localStorage.getItem('from_planner_color') || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
    : '') || '#3E5C76'
  const taskPastel = pastelize(plannerBase)

  // ── Render bloque ─────────────────────────────────────────────────────────
  function renderBlock(b: Block) {
    // Solo los eventos de Google llevan relleno de color (gris propio → pastel base;
    // color propio → ese color en pastel). Las tareas NO son eventos: sin fondo,
    // solo borde fino + barra de acento a la izquierda para verlas y arrastrarlas.
    // Relleno solo para eventos de Google (viven en Google, no son nodos). Las
    // tareas (nodos locales) van sin relleno: borde fino + barra de acento.
    const isGcal = b.kind === 'gcal'
    const bg = isGcal ? (isGreyish(b.color) ? taskPastel : pastelize(b.color)) : 'transparent'
    // Barra de acento del bloque: si el nodo tiene contexto asignado, su color
    // manda sobre el acento genérico del Planificador (Alberto, 22 jul: "si el
    // evento tiene contexto, se colorea del color del contexto").
    const blockNode = b.nodeId ? store.getNode(b.nodeId) : null
    const blockCtx = blockNode ? firstContextOf(blockNode) : null
    const accentColor = blockCtx ? contextColor(blockCtx.id) : plannerBase
    // Clampar al día: un bloque NUNCA se sale del rango 06–24 (evita que un evento
    // multi-día o con duración errónea infle el scroll con espacio vacío).
    const gridH = TOTAL_HOURS * hourH
    const blockTop = Math.max(0, Math.min(topPx(b.start), gridH - slotH / 2))
    const blockH = Math.max(slotH / 2, Math.min(heightPx(b.start.getTime(), b.end.getTime()), gridH - blockTop))
    return (
      <div key={b.id} data-pp-block={b.id}
        className={`pp-block pp-block--${b.kind}`}
        style={{ top: blockTop, height: blockH,
          background: bg, left: 2, right: 2,
          ...(isGcal ? {} : { border: '1px solid var(--border)', borderLeft: `3px solid ${accentColor}` }) }}
        draggable
        onDragStart={e => handleBlockDragStart(e, b)}
        onClick={e => {
          e.stopPropagation()
          if (justResized.current || justDragged.current) return
          // CONSISTENCIA: cualquier evento de Google abre el modal de edición. Para
          // un evento crudo es directo; para una tarea materializada (con gcalEventId)
          // buscamos su evento. Una tarea pura (sin GCal) abre su nodo.
          if (b.kind === 'gcal' && b.gcalEvent) { setEditingGcal(b.gcalEvent); return }
          if (b.nodeId) {
            const node = store.getNode(b.nodeId)
            const gid = node?.gcalEventId
            const ev = gid ? gcalEvents.find(x => x.id === gid) : null
            if (ev) { setEditingGcal(ev); return }
            // `navigate('/node/:id')` es una ruta que solo existe en el router de
            // v1 — el Planificador se reutiliza dentro del overlay del shell v2
            // (V2Chat.tsx), así que navegar por URL rompía el overlay en vez de
            // abrir nada (Alberto, 21 jul: "no se abre el modal"). Mismo patrón
            // que ya usa ElementsPanel para abrir nodos sin salir de v2.
            window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: b.nodeId } }))
          }
        }}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          // Mismo menú que la columna del día para bloques con nodo (tarea/materializado);
          // el evento crudo de GCal (sin nodo) mantiene su menú propio.
          if (b.nodeId) window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: b.nodeId, x: e.clientX, y: e.clientY } }))
          else setCtxMenu({x:e.clientX,y:e.clientY,b})
        }}
        title={`${b.text}\n${fmtHH(b.start)} – ${fmtHH(b.end)}`}
      >
        {/* Bloques muy cortos (reuniones de 15-30min entre otras) no tienen alto para
            mostrar hora + título sin cortarse — se prioriza el título (Alberto, 21 jul). */}
        {blockH >= MIN_BLOCK_H_FOR_TIME && <div className="pp-block-time">{fmtHH(b.start)}</div>}
        <div className="pp-block-text">{b.text || t('common.noTitle')}</div>
        <div className="pp-block-resize" onMouseDown={e=>handleBlockResize(e,b)} />
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
                placeholder={t('ph.nameEllipsis')}
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
              <div className="pp-year-month-name">{monthLabel(firstOfMonth, i18n.language)}</div>
              <div className="pp-year-dow-row">
                {['L','M','X','J','V','S','D'].map(d => <div key={d} className="pp-year-dow">{d}</div>)}
              </div>
              <div className="pp-year-days">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="pp-year-day pp-year-day--empty" />
                  const date  = new Date(year, monthIdx, d)
                  const isTod = sameDay(date, today)
                  const hasGcal = gcalEvents.some(ev => !ev.allDay && sameDay(new Date(ev.start), date))
                  const hasTasks = [...store.allActive()].some(n => n.due && !isInPapelera(n.id) && sameDay(new Date(n.due), date) && n.status !== null)
                  return (
                    <div key={d}
                      className={`pp-year-day ${isTod?'pp-year-day--today':''}`}
                      onClick={() => { const dayNode = ensureDayPath(date); window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: dayNode.id } })); setCenterDate(date); setViewMode('day') }}
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

  // ── Vista MES (rejilla mensual) ────────────────────────────────────────────
  function monthDayItems(date: Date): { id: string; text: string; color: string; done: boolean }[] {
    const out: { id: string; text: string; color: string; done: boolean; t: number }[] = []
    for (const n of store.allActive()) {
      if (!n.due || n.deletedAt || isInPapelera(n.id) || n.status == null) continue
      if (!sameDay(new Date(n.due), date)) continue
      const overdue = new Date(n.due) < startOfDay(today) && n.status !== 'done'
      out.push({ id: n.id, text: n.text || t('common.noTitle'), color: overdue ? '#e03131' : 'var(--accent,#6c5ce7)', done: n.status === 'done', t: new Date(n.due).getTime() })
    }
    for (const ev of gcalEvents) {
      if (ev.allDay || !sameDay(new Date(ev.start), date)) continue
      out.push({ id: ev.id, text: ev.title || t('search.chipEvent'), color: '#16a34a', done: false, t: new Date(ev.start).getTime() })
    }
    return out.sort((a, b) => a.t - b.t)
  }

  function handleMonthDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('nodeId') || e.dataTransfer.getData('plannerTaskId') || e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    const n = store.getNode(nodeId); if (!n) return
    const had = !!n.due
    store.updateNode(nodeId, { due: toMidnight(date), dueEnd: null, status: n.status ?? 'pending' })
    if (had) bumpReschedule(nodeId)
  }

  // ── Franja «todo el día»: tareas con fecha ese día pero SIN hora ────────────
  function getAllDayTasks(day: Date) {
    // Incluye tareas sin hora (como antes) Y EVENTOS de todo el día (due a
    // medianoche local, sin hora) — antes `!n.isEvent` excluía SIEMPRE los
    // eventos de esta fila, así que arrastrar un evento aquí lo hacía
    // desaparecer del Planificador entero (ni fila de todo el día ni timeline,
    // ver `handleAllDayDrop`) en vez de convertirlo — Alberto, 21 jul: "arrastrar
    // eventos a todo el día debería convertirlos... ahora no se puede".
    return store.allActive().filter(n =>
      n.due && !n.deletedAt && !isInPapelera(n.id) && (n.isEvent || n.status != null) &&
      sameDay(new Date(n.due), day) && !hasTime(n.due))
  }
  function handleAllDayDrop(e: React.DragEvent, day: Date) {
    e.preventDefault(); e.stopPropagation()
    // `plannerBlockId`: arrastre desde un bloque con hora del propio timeline
    // (`handleBlockDragStart`, línea ~577) — sin leer esta clave, arrastrar un
    // evento/tarea DESDE su hueco horario hasta esta fila no encontraba nodeId
    // y el drop no hacía nada.
    const nodeId = e.dataTransfer.getData('nodeId') || e.dataTransfer.getData('plannerTaskId')
      || e.dataTransfer.getData('plannerBlockId') || e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    const n = store.getNode(nodeId); if (!n) return
    const had = !!n.due
    // Los eventos no llevan `status` (el resto de la app decide "es tarea" por
    // status != null) — forzar 'pending' aquí los convertiría en tarea a medias.
    store.updateNode(nodeId, n.isEvent
      ? { due: toMidnight(day), dueEnd: null }
      : { due: toMidnight(day), dueEnd: null, status: n.status ?? 'pending' })
    if (had) bumpReschedule(nodeId)
  }

  function renderMonth() {
    const y = centerDate.getFullYear(), mo = centerDate.getMonth()
    const first = new Date(y, mo, 1)
    const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1 // lunes = 0
    const total = daysInMonth(first)
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(new Date(y, mo, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return (
      <div className="pp-month">
        <div className="pp-month-dow">
          {[t('tip.dowMon'),t('tip.dowTue'),t('tip.dowWed'),t('tip.dowThu'),t('tip.dowFri'),t('tip.dowSat'),t('tip.dowSun')].map(d => <div key={d} className="pp-month-dow-cell">{d}</div>)}
        </div>
        <div className="pp-month-grid">
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} className="pp-month-cell pp-month-cell--empty" />
            const isTod = sameDay(date, today)
            const items = monthDayItems(date)
            return (
              <div key={date.toISOString()} className={`pp-month-cell ${isTod ? 'pp-month-cell--today' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleMonthDrop(e, date)}
                onClick={() => { const dn = ensureDayPath(date); window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: dn.id } })) }}
                title={date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}>
                <div className={`pp-month-daynum ${isTod ? 'pp-month-daynum--today' : ''}`}>{date.getDate()}</div>
                <div className="pp-month-items">
                  {items.map(it => (
                    <div key={it.id} className="pp-month-chip" style={{ borderLeft: `2px solid ${it.color}`, opacity: it.done ? 0.45 : 1, textDecoration: it.done ? 'line-through' : 'none' }}
                      onClick={e => {
                        e.stopPropagation() // no navegar al día: ir a la tarea
                        const node = store.getNode(it.id)
                        if (node) { window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: it.id } })); return }
                        const ev = gcalEvents.find(x => x.id === it.id)
                        if (ev) setEditingGcal(ev)
                      }}
                      onContextMenu={e => {
                        if (!store.getNode(it.id)) return // evento GCal crudo: sin menú de fila
                        e.preventDefault(); e.stopPropagation()
                        window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: it.id, x: e.clientX, y: e.clientY } }))
                      }}
                      title={it.text}>
                      {it.text}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navTitle = viewMode === 'year'
    ? `${centerDate.getFullYear()}`
    : viewMode === 'month'
      ? `${monthLabel(centerDate, i18n.language)} ${centerDate.getFullYear()}`
      : centerDate.toLocaleDateString(i18n.language, { weekday:'short', day:'numeric', month:'short' })

  function navDelta(d: number) {
    setCenterDate(prev =>
      viewMode === 'year'  ? new Date(prev.getFullYear() + d, prev.getMonth(), 1)
      : viewMode === 'month' ? new Date(prev.getFullYear(), prev.getMonth() + d, 1)
      : addDays(prev, d))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pp-root" style={{ width: '100%' }}>

      {/* Header */}
      <div className="pp-header">
        {viewTabs.length > 1 && (
          <div className="pp-view-tabs">
            {viewTabs.map(m => (
              <button key={m} className={`pp-tab ${viewMode===m?'pp-tab--active':''}`} onClick={()=>setViewMode(m)}>
                {m==='day'?t('timeline.dayMode'):m==='week'?t('timeline.weekMode'):m==='month'?t('timeline.monthMode'):t('tip.year')}
              </button>
            ))}
          </div>
        )}
        <button className="pp-nav-btn" onClick={()=>navDelta(-1)}>‹</button>
        <span className="pp-nav-title">{navTitle}</span>
        <button className="pp-nav-btn" onClick={()=>navDelta(1)}>›</button>
        <button className="pp-today-btn" onClick={()=>setCenterDate(today)}>{t('common.today')}</button>
        <button className="pp-today-btn pp-reset-btn" onClick={resetZoom}
          title={t('tip.resetZoom', { count: visibleDayCnt })}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>

      {gcalError && (
        <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--warning)', background: 'rgba(239,68,68,0.06)', flexShrink: 0 }}>
          ⚠️ {gcalError} — <button onClick={() => navigate('/settings?tab=google')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11 }}>{t('tip.reconnect')}</button>
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
            if (!ev.shiftKey || viewMode === 'year' || viewMode === 'month') return
            ev.preventDefault()
            setAutoFit(false)
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
        {viewMode === 'year' ? renderYear() : viewMode === 'month' ? renderMonth() : (
          <>
            {/* Cabeceras */}
            <div className="pp-heads" ref={headRef} onMouseDown={handleHeadersDrag}
              title={t('tip.dragDaysHint')}>
              <div style={{width: AXIS_W, flexShrink:0, position:'sticky', left:0, background:'var(--bg-primary)', zIndex:10}} />
              {visibleDays.map(d => (
                <div key={d.toISOString()} className={`pp-col-head ${sameDay(d,today)?'pp-col-head--today':''} ${sameDay(d,centerDate)?'pp-col-head--center':''}`}
                  style={{width:colW, flexShrink:0}}>
                  {dayLabel(d, i18n.language)}
                </div>
              ))}
            </div>

            {/* Franja «todo el día»: tareas con fecha pero sin hora. Arrastrables. */}
            <div className="pp-allday">
              <div className="pp-allday-axis" style={{width:AXIS_W, flexShrink:0, position:'sticky', left:0, zIndex:10}}>{t('tip.allDayLower')}</div>
              {visibleDays.map(d => {
                const items = getAllDayTasks(d)
                const editing = !!newAllDay && sameDay(newAllDay.day, d)
                return (
                  <div key={d.toISOString()} className="pp-allday-col" style={{width:colW, flexShrink:0}}
                    onDragOver={e=>e.preventDefault()} onDrop={e=>handleAllDayDrop(e,d)}
                    title={t('tip.clickAddUntimed')}
                    onClick={e=>{ if ((e.target as HTMLElement).closest('.pp-allday-chip, input')) return; setNewAllDay({ day: d, text: '' }); setTimeout(()=>newAllDayRef.current?.focus(), 20) }}>
                    {items.slice(0, 5).map(n => {
                      const chipCtx = firstContextOf(n)
                      const chipAccent = chipCtx ? contextColor(chipCtx.id) : plannerBase
                      return (
                      <div key={n.id} className={`pp-allday-chip ${n.status==='done'?'pp-allday-chip--done':''}`}
                        style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderLeft: `3px solid ${chipAccent}` }}
                        draggable
                        onDragStart={e=>{ e.dataTransfer.setData('nodeId', n.id); e.dataTransfer.effectAllowed='move' }}
                        onClick={e=>{ e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: n.id } })) }}
                        onContextMenu={e=>{ e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: n.id, x: e.clientX, y: e.clientY } })) }}
                        title={n.text}>
                        {n.text || t('common.noTitle')}
                      </div>
                      )
                    })}
                    {items.length > 5 && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '0 4px' }}>+{items.length - 5}</div>}
                    {editing ? (
                      <input ref={newAllDayRef} className="pp-allday-new" value={newAllDay!.text}
                        placeholder={t('ph.newTaskEllipsis')}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>setNewAllDay(s=>s?{...s,text:e.target.value}:s)}
                        onKeyDown={e=>{ if (e.key==='Enter') commitNewAllDay(true); else if (e.key==='Escape') setNewAllDay(null) }}
                        onBlur={()=>commitNewAllDay(false)} />
                    ) : (
                      <div className="pp-allday-add" aria-hidden>+</div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Grid de horas */}
            <div className="pp-grid">
              <div className="pp-axis" style={{width:AXIS_W, height: TOTAL_HOURS*hourH}}
                onMouseDown={handleAxisDrag} title={t('tip.dragZoom')}>
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
                // DOCUMENTO enlazado al evento (mismo materializado que el botón del
                // modal) — antes creaba un nodo suelto, sin due/gcalEventId, que no
                // se enlazaba con el evento (Alberto, 22 jul: "se enlaza con el
                // propio evento").
                const ev = ctxMenu.b.gcalEvent
                const d = ensureDayPath(ctxMenu.b.start)
                const newNode = store.createNode({ text: ctxMenu.b.text, parentId: d.id, predefinedId: ev ? (gcalEventNodeId(ev.id) ?? undefined) : undefined })
                if (ev) {
                  store.updateNode(newNode.id, {
                    isEvent: true, due: ev.start, dueEnd: ev.end, gcalEventId: ev.id,
                    extraData: JSON.stringify({ _doc: '1', _gcalEventId: ev.id, _gcalColor: ev.backgroundColor || '' }),
                  })
                } else {
                  store.updateNode(newNode.id, { extraData: JSON.stringify({ _doc: '1' }) })
                }
                window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: newNode.id } }))
                setCtxMenu(null)
              }}>📄 {t('tip.createDocument', 'Crear documento')}</button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{ window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: ctxMenu.b.nodeId! } })); setCtxMenu(null) }}>
                → {t('tip.goToNode')}
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
                ⊘ {t('tip.removeTime')}
              </button>
            )}
            {/* Color picker */}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <div style={{padding:'6px 8px 2px', borderTop:'1px solid var(--border)', marginTop:4}}>
                <div style={{fontSize:10,color:'var(--text-secondary)',marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{t('tip.color')}</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {[
                    {c:'#3b82f6',n:t('tip.colorBlue')},{c:'#10b981',n:t('tip.colorGreen')},{c:'#f59e0b',n:t('tip.colorOrange')},
                    {c:'#ef4444',n:t('tip.colorRed')},{c:'#8b5cf6',n:t('tip.colorPurple')},{c:'#ec4899',n:t('tip.colorPink')},
                    {c:'#06b6d4',n:t('tip.colorCyan')},{c:'#64748b',n:t('tip.colorGrey')}
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
                {t('tip.removeFromPlanner')}
              </button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button className="pp-ctx-danger" style={{marginTop:4}} onClick={()=>{
                const nodeId = ctxMenu.b.nodeId!
                removeNodeFromGcal(nodeId)
                store.deleteNode(nodeId)
                setCtxMenu(null)
              }}>
                {t('tip.deleteEvent')}
              </button>
            )}
            {ctxMenu.b.kind === 'gcal' && (
              <button className="pp-ctx-danger" onClick={async ()=>{
                try { await deleteCalendarEvent(ctxMenu.b.id) } catch {}
                setGcalEvents(p => p.filter(x => x.id !== ctxMenu.b.id))
                setCtxMenu(null)
              }}>
                {t('tip.deleteEvent')}
              </button>
            )}
          </div>
        </>
      )}

      {editingGcal && (
        <GCalEventEditor event={editingGcal} modal onClose={()=>setEditingGcal(null)}
          linkedNodeId={store.allActive().find(n=>n.gcalEventId===editingGcal.id)?.id}
          onCreateNode={()=>{
            // Crear bajo demanda un DOCUMENTO local vinculado al evento (no se crea
            // por defecto). `_doc:'1'` — es un documento, no un nodo genérico.
            const ev = editingGcal
            const dayNode = ensureDayPath(new Date(ev.start))
            const node = store.createNode({ text: ev.title || t('search.chipEvent'), parentId: dayNode.id, predefinedId: gcalEventNodeId(ev.id) ?? undefined })
            store.updateNode(node.id, {
              isEvent: true, due: ev.start, dueEnd: ev.end,
              gcalEventId: ev.id, // columna: la usa el dedup del planner (n.gcalEventId)
              extraData: JSON.stringify({ _doc: '1', _gcalEventId: ev.id, _gcalColor: ev.backgroundColor || '' }),
            })
            window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: node.id } }))
            return node.id
          }}
          onUpdated={ev=>{setGcalEvents(p=>p.map(x=>x.id===ev.id?ev:x));setEditingGcal(null)}}
          onDeleted={id=>{setGcalEvents(p=>p.filter(x=>x.id!==id));setEditingGcal(null)}} />
      )}
    </div>
  )
}
