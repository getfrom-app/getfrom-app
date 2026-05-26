import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore, store, nodeMeta } from '../../store/nodeStore'
import type { Node } from '../../types'
import CalendarSidePanel from '../panels/CalendarSidePanel'
import { TaskPropsPopover, GCalEventEditor } from '../panels/DiaryRightPanel'
import { getCalendarEventsRange, type CalendarEvent } from '../../api/googleCalendar'
import { useUserStore } from '../../store/userStore'
import { getDayStart, getDayEnd } from '../../utils/dayHours'

// ── CalendarTaskPopoverHost ───────────────────────────────────────────────────
// Mantiene un anchorRef estable para evitar que TaskPropsPopover reposicione
// al re-renderizar el padre (lo cual saltaba a 0,0 cuando el ancla desaparecía)

function CalendarTaskPopoverHost({ node, el, onClose }: { node: Node; el: HTMLElement; onClose: () => void }) {
  const anchorRef = useRef<HTMLElement>(el)
  // Si el ancla cambia (otra tarea distinta), actualizar
  useEffect(() => { anchorRef.current = el }, [el])
  return (
    <TaskPropsPopover
      node={node}
      onClose={onClose}
      anchorRef={anchorRef}
      allowRename
      allowDelete
    />
  )
}

// ── EventPopup ────────────────────────────────────────────────────────────────

interface EventPopupProps {
  node: Node
  anchorEl: HTMLElement | null
  onClose: () => void
  onOpen: (id: string) => void
}

function EventPopup({ node, anchorEl, onClose, onOpen }: EventPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!anchorEl || !popupRef.current) return
    const rect = anchorEl.getBoundingClientRect()
    const popup = popupRef.current
    const w = popup.offsetWidth || 220
    const h = popup.offsetHeight || 120
    let left = rect.right + 8
    let top = rect.top
    // Stay in viewport
    if (left + w > window.innerWidth - 16) left = rect.left - w - 8
    if (top + h > window.innerHeight - 16) top = window.innerHeight - h - 16
    setPos({ top, left })
  }, [anchorEl])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as globalThis.Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const formatDay = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })

  return createPortal(
    <div
      ref={popupRef}
      className="calendar-event-popup"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <div className="calendar-event-popup-header">
        <span className="calendar-event-popup-icon">{node.isEvent ? '📅' : '○'}</span>
        <span className="calendar-event-popup-title">{node.text || 'Sin título'}</span>
        <button className="calendar-event-popup-close" onClick={onClose}>×</button>
      </div>
      {node.due && (
        <div className="calendar-event-popup-time">
          <span>📅 {formatDay(node.due)}</span>
          {node.due && new Date(node.due).getHours() !== 0 && (
            <span style={{ marginLeft: 6 }}>{formatTime(node.due)}
              {node.dueEnd && ` – ${formatTime(node.dueEnd)}`}
            </span>
          )}
        </div>
      )}
      {node.body && (
        <div className="calendar-event-popup-body">{node.body.slice(0, 80)}{node.body.length > 80 ? '…' : ''}</div>
      )}
      <div className="calendar-event-popup-actions">
        <button
          className="btn-primary btn-sm"
          onClick={() => { onOpen(node.id); onClose() }}
        >Abrir →</button>
        {node.status !== null && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              store.updateNode(node.id, { status: node.status === 'done' ? 'pending' : 'done' })
              onClose()
            }}
          >
            {node.status === 'done' ? '↩ Reabrir' : '✓ Hecho'}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── QuickEventCreate ──────────────────────────────────────────────────────────

interface QuickEventCreateProps {
  date: Date
  style?: React.CSSProperties
  onCancel: () => void
  onCreate: (id: string) => void
}

function QuickEventCreate({ date, style, onCancel, onCreate }: QuickEventCreateProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit() {
    const t = text.trim() || 'Nueva tarea'
    const diary = store.todayDiary()
    const node = store.createNode({ text: t, parentId: diary?.id || null })
    // Crear como TAREA por defecto (no como evento). El usuario puede convertir luego.
    store.updateNode(node.id, { due: date.toISOString(), isEvent: false, status: 'pending' })
    onCreate(node.id)
  }

  return (
    <div className="calendar-quick-create" style={style} onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="calendar-quick-create-input"
        placeholder="Nombre de la tarea…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
      />
      <div className="calendar-quick-create-actions">
        <button className="btn-primary btn-sm" onClick={handleSubmit}>Crear</button>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'long' })
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()
  const startMonth = weekStart.toLocaleDateString('es-ES', { month: 'short' })
  const endMonth = weekEnd.toLocaleDateString('es-ES', { month: 'short' })
  const year = weekEnd.getFullYear()
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startDay}–${endDay} ${startMonth} ${year}`
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_NAMES_UPPER = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

type ViewType = 'day' | 'week' | 'month' | 'year'

// ── NodeChip ──────────────────────────────────────────────────────────────────

interface NodeChipProps {
  node: Node
  onClick: () => void
  compact?: boolean
}

function NodeChip({ node, onClick, compact }: NodeChipProps) {
  const isDone = node.status === 'done'
  const isTask = node.status !== null

  return (
    <button
      className={`calendar-node-chip ${isDone ? 'calendar-node-chip--done' : ''} ${compact ? 'calendar-node-chip--compact' : ''}`}
      onClick={onClick}
      title={node.text || 'Sin título'}
    >
      {isTask && (
        <span className="calendar-node-status">
          {isDone ? '✓' : '○'}
        </span>
      )}
      <span className="calendar-node-text">{node.text || 'Sin título'}</span>
    </button>
  )
}

// ── Priority color helper ─────────────────────────────────────────────────────

function priorityBg(node: Node): string {
  const meta = nodeMeta(node)
  if (meta.color) return meta.color
  if (node.isEvent && !node.status) return 'var(--calendar-event-color, #f5c97a)'
  if (node.status === 'done')        return '#a3a8b3'
  if (node.isSeguimiento)            return '#b8a7e8'
  if (meta.resource)                 return '#8ed4dd'
  if (node.priority === 'high')      return '#f0a3a3'
  if (node.priority === 'medium')    return '#f5c197'
  if (node.priority === 'low')       return '#9bd6a3'
  return '#a8c5ec'
}

// Paleta oficial de event colors de Google Calendar (colorId → hex)
const GCAL_EVENT_COLORS: Record<string, string> = {
  '1':  '#a4bdfc', // Lavender
  '2':  '#7ae7bf', // Sage
  '3':  '#dbadff', // Grape
  '4':  '#ff887c', // Flamingo
  '5':  '#fbd75b', // Banana
  '6':  '#ffb878', // Tangerine
  '7':  '#46d6db', // Peacock
  '8':  '#e1e1e1', // Graphite
  '9':  '#5484ed', // Blueberry
  '10': '#51b749', // Basil
  '11': '#dc2127', // Tomato
}

function gcalEventColor(ev: CalendarEvent): string {
  if (ev.colorId && GCAL_EVENT_COLORS[ev.colorId]) return GCAL_EVENT_COLORS[ev.colorId]
  if (ev.backgroundColor) return ev.backgroundColor
  return '#b5c9ea' // fallback azul pastel
}

function nodeIcon(node: Node): string {
  if (node.isEvent && !node.status) return '📅'
  if (node.isSeguimiento) return '👁'
  if (nodeMeta(node).resource) return '◆'
  return ''
}

// ── Overlap layout: algoritmo tipo Google Calendar ────────────────────────────
// Para un set de eventos del MISMO día, calcula left%/width%/zIndex de modo
// que los superpuestos compartan el ancho de la columna en sub-columnas, y
// los más cortos queden por encima (z-index alto) para no quedar tapados.
interface LaidEvent {
  id: string
  startMs: number
  endMs: number
  durationMs: number
}
interface Layout {
  leftPct: number
  widthPct: number
  zIndex: number
}

function computeOverlapLayout(events: LaidEvent[]): Map<string, Layout> {
  const result = new Map<string, Layout>()
  if (events.length === 0) return result

  // 1) Orden estable: por start asc, luego por duration DESC
  // (los largos cogen columna izquierda antes; los cortos llegan a columnas
  //  más a la derecha y/o quedan por encima visualmente).
  const sorted = [...events].sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs
    return b.durationMs - a.durationMs
  })

  // 2) Calcular clusters de solapamiento. Un cluster es un grupo conexo de
  //    eventos donde cada uno solapa con al menos otro del cluster.
  type Cluster = { events: LaidEvent[]; maxEnd: number }
  const clusters: Cluster[] = []
  for (const ev of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && ev.startMs < last.maxEnd) {
      last.events.push(ev)
      last.maxEnd = Math.max(last.maxEnd, ev.endMs)
    } else {
      clusters.push({ events: [ev], maxEnd: ev.endMs })
    }
  }

  // 3) Dentro de cada cluster, asignar columnas: para cada evento, primera
  //    columna cuyo último evento no solape con el actual.
  for (const cluster of clusters) {
    const cols: LaidEvent[][] = []
    const assign = new Map<string, number>()
    for (const ev of cluster.events) {
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        const last = cols[c][cols[c].length - 1]
        if (last.endMs <= ev.startMs) {
          cols[c].push(ev)
          assign.set(ev.id, c)
          placed = true
          break
        }
      }
      if (!placed) {
        cols.push([ev])
        assign.set(ev.id, cols.length - 1)
      }
    }
    const totalCols = cols.length
    for (const ev of cluster.events) {
      const col = assign.get(ev.id) ?? 0
      // Solape visual del 8% para que se note el evento de detrás (estilo GCal).
      const baseWidth = 100 / totalCols
      const widthPct = totalCols === 1 ? 100 : baseWidth + (baseWidth * 0.08)
      const leftPct = col * baseWidth
      // zIndex: más corto = más alto. Base 10, +1 por cada minuto menos del día,
      // tope 1440 para que cualquier modal/overlay (z-index 10000+) quede por encima.
      const zIndex = Math.min(1440, 10 + Math.max(0, Math.round((24 * 60 * 60 * 1000 - ev.durationMs) / 60000)))
      result.set(ev.id, { leftPct, widthPct: Math.min(widthPct, 100 - leftPct), zIndex })
    }
  }

  return result
}

// Returns true if the ISO date string has a time component (non-midnight)
function hasTime(isoStr: string): boolean {
  const d = new Date(isoStr)
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
}

// ── Week View ─────────────────────────────────────────────────────────────────

const CELL_HEIGHT = 60 // px per hour

interface WeekViewProps {
  weekStart: Date
  today: Date
  allNodes: Node[]
  googleEvents: CalendarEvent[]
  navLabel: string
  navUnit: number  // días que avanza/retrocede al pulsar prev/next (7 para semana, 1 para día)
  dayCount?: number  // número de columnas (default 7)
  showDayNames?: boolean
  onNavigate: (offset: number) => void
  onGoToToday: () => void
  onNodeClick: (id: string) => void
  onCreateEvent: (date: Date) => void
  onDrop?: (e: React.DragEvent, date: Date) => void
  onGCalUpdated?: (updated: CalendarEvent) => void
  onGCalDeleted?: (id: string) => void
}

function WeekView({ weekStart, today, allNodes, googleEvents, navLabel, navUnit, dayCount = 7, showDayNames = true, onNavigate, onGoToToday, onNodeClick, onCreateEvent, onDrop, onGCalUpdated, onGCalDeleted }: WeekViewProps) {
  const days = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i))
  const colWidthExpr = `calc((100% - var(--gutter-width)) / ${dayCount})`
  // Franja horaria visible (reactiva a cambios desde Ajustes)
  const [dayStart, setDayStart] = useState(getDayStart())
  const [dayEnd, setDayEnd] = useState(getDayEnd())
  useEffect(() => {
    function refresh() { setDayStart(getDayStart()); setDayEnd(getDayEnd()) }
    window.addEventListener('from-day-hours-changed', refresh)
    return () => window.removeEventListener('from-day-hours-changed', refresh)
  }, [])
  const HOURS = Array.from({ length: dayEnd - dayStart }, (_, i) => dayStart + i)
  const TIMELINE_HEIGHT = (dayEnd - dayStart) * CELL_HEIGHT
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)
  const [hoveredAllDay, setHoveredAllDay] = useState<number | null>(null)
  const [allDayQuickCreate, setAllDayQuickCreate] = useState<{ date: Date; col: number } | null>(null)
  const [quickCreate, setQuickCreate] = useState<{ date: Date; cellKey: string } | null>(null)
  const [eventPopup, setEventPopup] = useState<{ node: Node; anchor: HTMLElement } | null>(null)
  const [taskPopover, setTaskPopover] = useState<{ node: Node; el: HTMLElement } | null>(null)
  const [gcalEditing, setGcalEditing] = useState<CalendarEvent | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to current hour on mount (relativo a dayStart)
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours()
      const offset = Math.max(0, (currentHour - dayStart - 1) * CELL_HEIGHT)
      scrollRef.current.scrollTop = offset
    }
  }, [dayStart])

  // Eventos y tareas con fecha — los BUCLES NO van al calendario (son contenedores).
  const nodesWithDue = allNodes.filter(n =>
    n.due && !n.deletedAt &&
    !n.isSeguimiento
  )

  // Nodos para un día determinado
  function getNodesForDay(day: Date): Node[] {
    return nodesWithDue.filter(n => n.due && isSameDay(new Date(n.due), day))
  }

  // Nodos "todo el día" (fecha sin hora, o hora = 00:00:00)
  function getAllDayNodes(day: Date): Node[] {
    return getNodesForDay(day).filter(n => !n.due || !hasTime(n.due))
  }

  // Nodos con hora específica
  function getTimedNodes(day: Date): Node[] {
    return getNodesForDay(day).filter(n => n.due && hasTime(n.due))
  }

  // Google Calendar events para un día
  function getGoogleForDay(day: Date) {
    return googleEvents.filter(ev => {
      if (!ev.start) return false
      const d = new Date(ev.start)
      return isSameDay(d, day)
    })
  }
  function getGoogleAllDay(day: Date) { return getGoogleForDay(day).filter(ev => ev.allDay) }
  function getGoogleTimed(day: Date) { return getGoogleForDay(day).filter(ev => !ev.allDay) }

  const weekLabel = navLabel

  function handleCellClick(day: Date, hour: number, cellKey: string) {
    if (quickCreate?.cellKey === cellKey) { setQuickCreate(null); return }
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    setQuickCreate({ date: d, cellKey })
    setEventPopup(null)
  }

  return (
    <>
      <div className="calendar-week-nav">
        <button className="btn-secondary" onClick={() => onNavigate(-navUnit)}>← Anterior</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
        <span className="calendar-week-label">{weekLabel}</span>
        <button className="btn-secondary" onClick={() => onNavigate(navUnit)}>Siguiente →</button>
      </div>

      <div className="calendar-week-body" style={{ ['--day-col-width' as string]: colWidthExpr }}>
        {/* ── Cabecera de días ── */}
        <div className="calendar-timeline-header">
          <div className="calendar-timeline-gutter" />
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            // Index Mon=0..Sun=6
            const dow = (day.getDay() + 6) % 7
            return (
              <div key={i} className={`calendar-timeline-day-header ${isToday ? 'calendar-timeline-day-header--today' : ''}`}>
                {showDayNames && <span className="calendar-day-name">{DAY_NAMES[dow]}</span>}
                <span className={`calendar-day-number ${isToday ? 'calendar-day-number--today' : ''}`}>{day.getDate()}</span>
              </div>
            )
          })}
        </div>

        {/* ── Sección "Todo el día" ── */}
        <div className="calendar-allday-row">
          <div className="calendar-timeline-gutter calendar-allday-label">Todo el día</div>
          {days.map((day, i) => {
            const allDayNodes = getAllDayNodes(day)
            const gcalAllDay = getGoogleAllDay(day)
            return (
              <div
                key={i}
                className={`calendar-allday-cell ${hoveredAllDay === i ? 'calendar-allday-cell--hover' : ''}`}
                onMouseEnter={() => setHoveredAllDay(i)}
                onMouseLeave={() => setHoveredAllDay(null)}
                onClick={(e) => {
                  // Solo si no se hizo clic sobre un chip existente o el quick-create
                  const target = e.target as HTMLElement
                  if (target.closest('button, input, .calendar-event-chip, .calendar-quick-create')) return
                  const d = new Date(day)
                  d.setHours(0, 0, 0, 0)
                  setAllDayQuickCreate({ date: d, col: i })
                  setQuickCreate(null)
                }}
                onDragOver={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  e.currentTarget.classList.add('drag-over')
                }}
                onDragEnter={e => { e.preventDefault(); e.stopPropagation() }}
                onDragLeave={e => {
                  // Solo quitar si realmente salimos del cell (no por entrar a un hijo)
                  if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node)) {
                    e.currentTarget.classList.remove('drag-over')
                  }
                }}
                onDrop={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.currentTarget.classList.remove('drag-over')
                  const newDate = new Date(day)
                  newDate.setHours(0, 0, 0, 0)
                  const nodeId = e.dataTransfer.getData('cal-node-id') || e.dataTransfer.getData('text/plain')
                  if (nodeId) {
                    store.scheduleNodeAt(nodeId, newDate.toISOString())
                    return
                  }
                  const eventId = e.dataTransfer.getData('eventId')
                  if (eventId) {
                    store.updateNode(eventId, { due: newDate.toISOString() })
                  }
                }}
              >
                {allDayNodes.map(node => {
                  const icon = nodeIcon(node)
                  return (
                  <button
                    key={node.id}
                    className="calendar-event-chip"
                    style={{ background: priorityBg(node) }}
                    draggable
                    onDragStart={e => {
                      e.stopPropagation()
                      e.dataTransfer.setData('cal-node-id', node.id)
                      e.dataTransfer.setData('eventId', node.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={e => {
                      e.stopPropagation()
                      setTaskPopover({ node, el: e.currentTarget as HTMLElement })
                    }}
                    title={node.text || 'Sin título'}
                  >
                    {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
                    {node.text || 'Sin título'}
                  </button>
                  )
                })}
                {gcalAllDay.map(ev => (
                  <button
                    key={ev.id}
                    type="button"
                    className="calendar-event-chip calendar-event-chip--gcal"
                    style={{ background: gcalEventColor(ev), cursor: 'pointer' }}
                    title={`${ev.title} · Click para editar en Google`}
                    onClick={e => { e.stopPropagation(); setGcalEditing(ev) }}
                  >
                    {ev.title}
                  </button>
                ))}
                {allDayQuickCreate && allDayQuickCreate.col === i && (
                  <QuickEventCreate
                    date={allDayQuickCreate.date}
                    onCancel={() => setAllDayQuickCreate(null)}
                    onCreate={id => { setAllDayQuickCreate(null); onNodeClick(id) }}
                  />
                )}
                {hoveredAllDay === i && !allDayQuickCreate && allDayNodes.length === 0 && gcalAllDay.length === 0 && (
                  <span className="calendar-allday-add-hint">+ Añadir</span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Timeline horario ── */}
        <div ref={scrollRef} className="calendar-timeline-scroll">
          <div className="calendar-timeline-grid" style={{ height: TIMELINE_HEIGHT }}>
            {/* Líneas de hora + etiquetas */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className="calendar-timeline-hour-row"
                style={{ top: (hour - dayStart) * CELL_HEIGHT, height: CELL_HEIGHT }}
              >
                <div className="calendar-timeline-gutter calendar-hour-label">
                  {`${String(hour).padStart(2, '0')}:00`}
                </div>
                <div className="calendar-timeline-hour-line" />
              </div>
            ))}

            {/* Columnas por día (celdas clicables + eventos) */}
            {days.map((day, di) => {
              const timedNodes = getTimedNodes(day)
              const gcalTimed = getGoogleTimed(day)

              // Construir lista unificada para el layout de solape
              const laid: LaidEvent[] = []
              for (const n of timedNodes) {
                if (!n.due) continue
                const startMs = new Date(n.due).getTime()
                const endMs = n.dueEnd
                  ? new Date(n.dueEnd).getTime()
                  : startMs + 3600000 // 1h por defecto
                laid.push({ id: 'from:' + n.id, startMs, endMs, durationMs: Math.max(1, endMs - startMs) })
              }
              for (const ev of gcalTimed) {
                if (!ev.start) continue
                const startMs = new Date(ev.start).getTime()
                const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 3600000
                laid.push({ id: 'gcal:' + ev.id, startMs, endMs, durationMs: Math.max(1, endMs - startMs) })
              }
              const layoutMap = computeOverlapLayout(laid)

              return (
                <div
                  key={di}
                  className="calendar-timeline-day-col"
                  style={{ left: `calc(var(--gutter-width) + ${di} * var(--day-col-width))`, width: 'var(--day-col-width)', height: TIMELINE_HEIGHT }}
                >
                  {/* Celdas clicables por hora */}
                  {HOURS.map(hour => {
                    const cellKey = `${di}-${hour}`
                    const isHovered = hoveredCell === cellKey
                    const isCreating = quickCreate?.cellKey === cellKey
                    return (
                      <div
                        key={hour}
                        className={`calendar-timeline-cell ${isHovered ? 'calendar-timeline-cell--hover' : ''} ${isCreating ? 'calendar-timeline-cell--creating' : ''}`}
                        style={{ top: (hour - dayStart) * CELL_HEIGHT, height: isCreating ? 'auto' : CELL_HEIGHT, minHeight: CELL_HEIGHT }}
                        onClick={() => { if (!isCreating) handleCellClick(day, hour, cellKey) }}
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                        onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                        onDrop={e => {
                          e.preventDefault()
                          e.currentTarget.classList.remove('drag-over')
                          // From side panel
                          const nodeId = e.dataTransfer.getData('cal-node-id') || e.dataTransfer.getData('text/plain')
                          if (nodeId) {
                            const newDate = new Date(day)
                            newDate.setHours(hour, 0, 0, 0)
                            store.scheduleNodeAt(nodeId, newDate.toISOString())
                            return
                          }
                          // Drag between time slots
                          const eventId = e.dataTransfer.getData('eventId')
                          if (eventId) {
                            const newDate = new Date(day)
                            newDate.setHours(hour, 0, 0, 0)
                            store.updateNode(eventId, { due: newDate.toISOString() })
                          }
                        }}
                      >
                        {isHovered && !isCreating && (
                          <span className="calendar-cell-add-hint">+ Añadir</span>
                        )}
                        {isCreating && quickCreate && (
                          <QuickEventCreate
                            date={quickCreate.date}
                            onCancel={() => setQuickCreate(null)}
                            onCreate={id => { setQuickCreate(null); onNodeClick(id) }}
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Eventos con hora — From */}
                  {timedNodes.map(node => {
                    const d = new Date(node.due!)
                    const topPx = (d.getHours() - dayStart + d.getMinutes() / 60) * CELL_HEIGHT
                    let durationH = 1
                    if (node.dueEnd) {
                      const end = new Date(node.dueEnd)
                      durationH = Math.max(0.5, (end.getTime() - d.getTime()) / 3600000)
                    }
                    const heightPx = durationH * CELL_HEIGHT
                    const timeLabel = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    const lay = layoutMap.get('from:' + node.id) || { leftPct: 0, widthPct: 100, zIndex: 10 }
                    return (
                      <button
                        key={node.id}
                        className="calendar-event-block"
                        draggable
                        onDragStart={e => {
                          e.stopPropagation()
                          e.dataTransfer.setData('eventId', node.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `calc(${lay.leftPct}% + 2px)`,
                          width: `calc(${lay.widthPct}% - 4px)`,
                          zIndex: lay.zIndex,
                          background: priorityBg(node),
                          cursor: 'grab',
                        }}
                        onClick={e => {
                          e.stopPropagation()
                          setQuickCreate(null)
                          setTaskPopover({ node, el: e.currentTarget as HTMLElement })
                        }}
                        title={node.text || 'Sin título'}
                      >
                        <span className="calendar-event-time">{timeLabel}</span>
                        <span className="calendar-event-text">
                          {nodeIcon(node) && <span style={{ marginRight: 4 }}>{nodeIcon(node)}</span>}
                          {node.text || 'Sin título'}
                        </span>
                      </button>
                    )
                  })}

                  {/* Eventos con hora — Google Calendar */}
                  {gcalTimed.map(ev => {
                    const d = new Date(ev.start)
                    const topPx = (d.getHours() - dayStart + d.getMinutes() / 60) * CELL_HEIGHT
                    let durationH = 1
                    if (ev.end) {
                      const end = new Date(ev.end)
                      durationH = Math.max(0.25, (end.getTime() - d.getTime()) / 3600000)
                    }
                    const heightPx = durationH * CELL_HEIGHT
                    const timeLabel = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    const lay = layoutMap.get('gcal:' + ev.id) || { leftPct: 0, widthPct: 100, zIndex: 10 }
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        className="calendar-event-block calendar-event-block--gcal"
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `calc(${lay.leftPct}% + 2px)`,
                          width: `calc(${lay.widthPct}% - 4px)`,
                          zIndex: lay.zIndex,
                          background: gcalEventColor(ev),
                          cursor: 'pointer',
                        }}
                        title={`${ev.title} · Click para editar en Google`}
                        onClick={e => { e.stopPropagation(); setGcalEditing(ev) }}
                      >
                        <span className="calendar-event-time">{timeLabel}</span>
                        <span className="calendar-event-text">{ev.title}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Event popup (legacy) */}
      {eventPopup && (
        <EventPopup
          node={eventPopup.node}
          anchorEl={eventPopup.anchor}
          onClose={() => setEventPopup(null)}
          onOpen={id => { setEventPopup(null); onNodeClick(id) }}
        />
      )}

      {/* Task properties popover (rename/delete/props) */}
      {taskPopover && (
        <CalendarTaskPopoverHost
          node={taskPopover.node}
          el={taskPopover.el}
          onClose={() => setTaskPopover(null)}
        />
      )}

      {/* Google Calendar event editor (modal centrado) */}
      {gcalEditing && (
        <GCalEventEditor
          event={gcalEditing}
          modal
          onClose={() => setGcalEditing(null)}
          onUpdated={updated => { onGCalUpdated?.(updated); setGcalEditing(null) }}
          onDeleted={id => { onGCalDeleted?.(id); setGcalEditing(null) }}
        />
      )}

      {/* Leyenda */}
      <div className="calendar-legend">
        <span className="calendar-legend-item"><span className="legend-dot" style={{ background: '#f59e0b' }}></span>Evento</span>
        <span className="calendar-legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}></span>Alta prioridad</span>
        <span className="calendar-legend-item"><span className="legend-dot" style={{ background: '#8b5cf6' }}></span>Tarea</span>
      </div>
    </>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

interface MonthViewProps {
  monthStart: Date
  today: Date
  allNodes: Node[]
  googleEvents: CalendarEvent[]
  onNavigate: (months: number) => void
  onGoToToday: () => void
  onNodeClick: (id: string) => void
  onDayClick: (day: Date) => void
  onDrop?: (e: React.DragEvent, date: Date) => void
  onGCalUpdated?: (updated: CalendarEvent) => void
  onGCalDeleted?: (id: string) => void
}

function MonthView({ monthStart, today, allNodes, googleEvents, onNavigate, onGoToToday, onNodeClick, onDayClick, onDrop, onGCalUpdated, onGCalDeleted }: MonthViewProps) {
  const navigate = useNavigate()
  const [gcalEditing, setGcalEditing] = useState<CalendarEvent | null>(null)
  const nodesWithDue = allNodes.filter(n =>
    n.due
  )
  const diaryEntries = allNodes.filter(n => n.isDiaryEntry && n.diaryDate)

  // Build grid: from Mon of the first week to Sun of the last week
  const firstDay = startOfMonth(monthStart)
  // Day of week of first (0=Sun…6=Sat) → convert to Mon-based index
  const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const gridStart = addDays(firstDay, -firstDow)

  // Always show 6 rows (42 cells) so the grid is stable
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  function getNodesForDay(day: Date): Node[] {
    return nodesWithDue.filter(n => n.due && isSameDay(new Date(n.due), day))
  }

  function getDiaryForDay(day: Date): Node | undefined {
    return diaryEntries.find(n => n.diaryDate && isSameDay(new Date(n.diaryDate), day))
  }

  function getGoogleForDay(day: Date): CalendarEvent[] {
    return googleEvents.filter(ev => ev.start && isSameDay(new Date(ev.start), day))
  }

  const monthLabel = `${formatMonth(monthStart)} ${monthStart.getFullYear()}`

  return (
    <div className="calendar-month-container">
      <div className="calendar-week-nav">
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-1)}>← Anterior</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
        <span className="calendar-week-label" style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(1)}>Siguiente →</button>
      </div>

      {/* Day of week header row */}
      <div className="calendar-month-dow-row">
        {DAY_NAMES_UPPER.map(d => (
          <div key={d} className="calendar-month-dow-cell">{d}</div>
        ))}
      </div>

      <div className="calendar-month-grid">
        {/* Day cells */}
        {cells.map((day, i) => {
          const inMonth = isSameMonth(day, monthStart)
          const isToday = isSameDay(day, today)
          const dayNodes = getNodesForDay(day)
          const gcalDay = getGoogleForDay(day)
          const overflow = dayNodes.length + gcalDay.length > 3
          const diaryEntry = inMonth ? getDiaryForDay(day) : undefined
          const childCount = diaryEntry ? store.children(diaryEntry.id).length : 0

          return (
            <div
              key={i}
              className={`calendar-month-cell ${inMonth ? '' : 'calendar-month-cell--out'} ${isToday ? 'calendar-month-cell--today' : ''}`}
              onClick={() => onDayClick(day)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => {
                e.currentTarget.classList.remove('drag-over')
                onDrop?.(e, day)
              }}
            >
              <div className="calendar-month-cell-header">
                <div className="calendar-month-cell-number">{day.getDate()}</div>
                {diaryEntry && inMonth && (
                  <button
                    className="calendar-diary-dot"
                    onClick={e => {
                      e.stopPropagation()
                      // Navigate to diary view for this date
                      const today2 = new Date()
                      today2.setHours(0, 0, 0, 0)
                      const diff = Math.round((day.getTime() - today2.getTime()) / 86400000)
                      navigate(`/?offset=${diff}`)
                    }}
                    title={`Entrada de diario · ${childCount} bullets`}
                  >
                    📓{childCount > 0 && <span className="calendar-diary-count">{childCount}</span>}
                  </button>
                )}
              </div>
              <div className="calendar-month-cell-nodes">
                {gcalDay.slice(0, 3).map(ev => {
                  const c = gcalEventColor(ev)
                  return (
                  <button
                    key={ev.id}
                    type="button"
                    className="calendar-month-node calendar-month-node--gcal"
                    style={{ background: c + '30', color: c, borderLeft: `2px solid ${c}`, cursor: 'pointer' }}
                    title={`Google Calendar · ${ev.title} · Click para editar`}
                    onClick={e => { e.stopPropagation(); setGcalEditing(ev) }}
                  >
                    🗓 {ev.title || 'Sin título'}
                  </button>
                  )
                })}
                {dayNodes.slice(0, Math.max(0, 3 - gcalDay.length)).map(node => (
                  <button
                    key={node.id}
                    className={`calendar-month-node ${node.status === 'done' ? 'calendar-month-node--done' : ''}`}
                    onClick={e => { e.stopPropagation(); onNodeClick(node.id) }}
                    title={node.text}
                  >
                    {node.status !== null && (
                      <span>{node.status === 'done' ? '✓' : '○'} </span>
                    )}
                    {node.text || 'Sin título'}
                  </button>
                ))}
                {overflow && (
                  <span className="calendar-month-overflow">+{dayNodes.length + gcalDay.length - 3} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {gcalEditing && (
        <GCalEventEditor
          event={gcalEditing}
          modal
          onClose={() => setGcalEditing(null)}
          onUpdated={updated => { onGCalUpdated?.(updated); setGcalEditing(null) }}
          onDeleted={id => { onGCalDeleted?.(id); setGcalEditing(null) }}
        />
      )}
    </div>
  )
}

// ── Year View ─────────────────────────────────────────────────────────────────

interface YearViewProps {
  year: number
  today: Date
  allNodes: Node[]
  onNavigate: (years: number) => void
  onGoToToday: () => void
  onMonthClick: (month: Date) => void
  onDayClick?: (day: Date) => void
}

// L M X J V S D
const YEAR_DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function getActivityLevel(count: number): string {
  if (count === 0) return ''
  if (count <= 2) return 'calendar-year-day--active-low'
  if (count <= 5) return 'calendar-year-day--active-med'
  return 'calendar-year-day--active-high'
}

function YearView({ year, today, allNodes, onNavigate, onGoToToday, onMonthClick, onDayClick }: YearViewProps) {
  const navigate = useNavigate()
  const diaryEntries = allNodes.filter(n => n.isDiaryEntry && n.diaryDate && !n.deletedAt)

  // Build activity map: "YYYY-M-D" -> childCount
  const activityMap = new Map<string, number>()
  for (const entry of diaryEntries) {
    if (!entry.diaryDate) continue
    const d = new Date(entry.diaryDate)
    if (d.getFullYear() !== year) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const childCount = store.children(entry.id).length
    activityMap.set(key, childCount)
  }

  // Also count nodes with due date — bucles no cuentan
  const nodesWithDue = allNodes.filter(n =>
    n.due && !n.deletedAt
  )
  for (const n of nodesWithDue) {
    if (!n.due) continue
    const d = new Date(n.due)
    if (d.getFullYear() !== year) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    activityMap.set(key, (activityMap.get(key) ?? 0) + 1)
  }

  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1))

  function handleDayClick(day: Date, e: React.MouseEvent) {
    e.stopPropagation()
    // Find diary entry for this day
    const diary = diaryEntries.find(n => n.diaryDate && isSameDay(new Date(n.diaryDate), day))
    if (diary) {
      navigate(`/node/${diary.id}`)
    } else if (onDayClick) {
      onDayClick(day)
    }
  }

  return (
    <>
      <div className="calendar-week-nav">
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-1)}>← Anterior</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
        <span className="calendar-week-label">{year}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(1)}>Siguiente →</button>
      </div>

      <div className="calendar-year-scroll">
        <div className="calendar-year-grid">
          {months.map((monthDate, mi) => {
            const isCurrentMonth = isSameMonth(monthDate, today)

            // Mini month grid
            const firstDay = startOfMonth(monthDate)
            const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
            const gridStart = addDays(firstDay, -firstDow)
            // 6 rows × 7 = 42 cells to be safe
            const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
            // Trim trailing rows that are entirely out-of-month
            let lastCellInMonth = 41
            while (lastCellInMonth > 0 && !isSameMonth(cells[lastCellInMonth], monthDate)) {
              lastCellInMonth--
            }
            // Round up to complete row
            const rowsNeeded = Math.ceil((lastCellInMonth + 1) / 7)
            const trimmedCells = cells.slice(0, rowsNeeded * 7)

            return (
              <div
                key={mi}
                className={`calendar-year-month ${isCurrentMonth ? 'calendar-year-month--current' : ''}`}
                onClick={() => onMonthClick(monthDate)}
              >
                <div className="calendar-year-month-name">
                  {MONTH_NAMES_SHORT[mi]}
                </div>
                {/* Day of week labels */}
                <div className="calendar-year-mini-grid">
                  {YEAR_DOW_LABELS.map(l => (
                    <div key={l} className="calendar-year-dow-label">{l}</div>
                  ))}
                  {trimmedCells.map((day, di) => {
                    const inMonth = isSameMonth(day, monthDate)
                    const isToday = isSameDay(day, today)
                    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
                    const activityCount = inMonth ? (activityMap.get(key) ?? 0) : 0
                    const activityClass = inMonth ? getActivityLevel(activityCount) : ''

                    return (
                      <div
                        key={di}
                        className={[
                          'calendar-year-day',
                          !inMonth ? 'calendar-year-day--out' : '',
                          isToday ? 'calendar-year-day--today' : '',
                          activityClass,
                        ].filter(Boolean).join(' ')}
                        onClick={inMonth ? e => handleDayClick(day, e) : undefined}
                        title={inMonth ? `${day.getDate()} ${MONTH_NAMES_SHORT[mi]}${activityCount > 0 ? ` · ${activityCount} elementos` : ''}` : undefined}
                      >
                        {inMonth ? day.getDate() : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CalendarView() {
  const navigate = useNavigate()
  const s = useStore()
  const us = useUserStore()

  const [view, setView] = useState<ViewType>('week')
  const [dayDate, setDayDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allNodes = s.allActive().filter(n => !n.deletedAt)

  // Fetch Google Calendar events para el rango visible (semana/mes/año)
  useEffect(() => {
    if (!us.googleConnected) { setGoogleEvents([]); return }
    let cancelled = false
    let rStart: Date, rEnd: Date
    if (view === 'day') {
      rStart = dayDate
      rEnd = dayDate
    } else if (view === 'week') {
      rStart = weekStart
      rEnd = addDays(weekStart, 6)
    } else if (view === 'month') {
      rStart = monthStart
      const e = new Date(monthStart)
      e.setMonth(e.getMonth() + 1)
      e.setDate(0)
      rEnd = e
    } else {
      rStart = new Date(year, 0, 1)
      rEnd = new Date(year, 11, 31)
    }
    getCalendarEventsRange(rStart, rEnd)
      .then(evs => {
        if (cancelled) return
        const arr = Array.isArray(evs) ? evs : []
        // eslint-disable-next-line no-console
        console.log('[GCal] events fetched', { view, count: arr.length, rStart, rEnd, sample: arr.slice(0,3) })
        setGoogleEvents(arr)
      })
      .catch(err => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.error('[GCal] fetch error', err)
        setGoogleEvents([])
      })
    return () => { cancelled = true }
  }, [dayDate, weekStart, monthStart, year, view, us.googleConnected])

  function goToToday() {
    const d = new Date(); d.setHours(0,0,0,0)
    setDayDate(d)
    setWeekStart(startOfWeek(new Date()))
    setMonthStart(startOfMonth(new Date()))
    setYear(new Date().getFullYear())
  }

  function handleDayClick(day: Date) {
    setWeekStart(startOfWeek(day))
    setView('week')
  }

  function handleMonthClick(month: Date) {
    setMonthStart(startOfMonth(month))
    setView('month')
  }

  function navigateWeek(offset: number) {
    setWeekStart(d => addDays(d, offset))
  }

  function navigateMonth(offset: number) {
    setMonthStart(d => {
      const next = new Date(d)
      next.setMonth(next.getMonth() + offset)
      return startOfMonth(next)
    })
  }

  function navigateYear(offset: number) {
    setYear(y => y + offset)
  }

  function navigateDay(offset: number) {
    setDayDate(d => addDays(d, offset))
  }

  function handleCreateEvent(date: Date) {
    const diary = store.todayDiary()
    const node = store.createNode({
      text: 'Nueva tarea',
      parentId: diary?.id || null,
    })
    // Crear como TAREA por defecto en el calendario.
    store.updateNode(node.id, {
      due: date.toISOString(),
      isEvent: false,
      status: 'pending',
    })
    navigate(`/node/${node.id}`)
  }

  // Rango visible para overdue/futuras (basado en vista actual)
  const periodStart = view === 'day' ? dayDate
    : view === 'week' ? weekStart
    : view === 'month' ? monthStart
    : new Date(year, 0, 1)
  const periodEnd = view === 'day' ? addDays(dayDate, 1)
    : view === 'week' ? addDays(weekStart, 7)
    : view === 'month' ? (() => { const e = new Date(monthStart); e.setMonth(e.getMonth()+1); return e })()
    : new Date(year + 1, 0, 1)

  // Handler para drop sobre celdas del calendario (asigna fecha)
  function handleCalendarDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('cal-node-id') || e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    const d = new Date(date)
    d.setHours(9, 0, 0, 0)
    store.scheduleNodeAt(nodeId, d.toISOString())
  }

  return (
    <div className="view calendar-view calendar-view--with-panel" role="main" aria-label="Vista de calendario">
      <div className="calendar-main-area">
        <div className="calendar-top-bar">
          <div className="calendar-header-row">
            <h1 className="view-title" style={{ margin: 0 }}>Calendario</h1>
            <div className="calendar-view-tabs">
              {(['day', 'week', 'month', 'year'] as ViewType[]).map(v => (
                <button
                  key={v}
                  className={`calendar-view-tab ${view === v ? 'calendar-view-tab--active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : v === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="calendar-view-body">
          {view === 'day' && (
            <WeekView
              weekStart={dayDate}
              today={today}
              allNodes={allNodes}
              googleEvents={googleEvents}
              navLabel={dayDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              navUnit={1}
              dayCount={1}
              showDayNames
              onNavigate={navigateDay}
              onGoToToday={goToToday}
              onNodeClick={id => navigate(`/node/${id}`)}
              onCreateEvent={handleCreateEvent}
              onDrop={handleCalendarDrop}
              onGCalUpdated={updated => setGoogleEvents(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onGCalDeleted={id => setGoogleEvents(prev => prev.filter(x => x.id !== id))}
            />
          )}

          {view === 'week' && (
            <WeekView
              weekStart={weekStart}
              today={today}
              allNodes={allNodes}
              googleEvents={googleEvents}
              navLabel={formatWeekLabel(weekStart)}
              navUnit={7}
              dayCount={7}
              onNavigate={navigateWeek}
              onGoToToday={goToToday}
              onNodeClick={id => navigate(`/node/${id}`)}
              onCreateEvent={handleCreateEvent}
              onDrop={handleCalendarDrop}
              onGCalUpdated={updated => setGoogleEvents(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onGCalDeleted={id => setGoogleEvents(prev => prev.filter(x => x.id !== id))}
            />
          )}

          {view === 'month' && (
            <MonthView
              monthStart={monthStart}
              today={today}
              allNodes={allNodes}
              googleEvents={googleEvents}
              onNavigate={navigateMonth}
              onGoToToday={goToToday}
              onNodeClick={id => navigate(`/node/${id}`)}
              onDayClick={handleDayClick}
              onDrop={handleCalendarDrop}
            />
          )}

          {view === 'year' && (
            <YearView
              year={year}
              today={today}
              allNodes={allNodes}
              onNavigate={navigateYear}
              onGoToToday={goToToday}
              onMonthClick={handleMonthClick}
              onDayClick={handleDayClick}
            />
          )}
        </div>
      </div>

      {/* Panel lateral colapsable */}
      <div className={`right-panel-area${panelCollapsed ? ' right-panel-area--collapsed' : ''}`}>
        <button
          className="right-panel-toggle"
          onClick={() => setPanelCollapsed(v => !v)}
          title={panelCollapsed ? 'Expandir panel' : 'Colapsar panel'}
        >
          {panelCollapsed ? '›' : '‹'}
        </button>
        <div className="right-panel-content">
          <CalendarSidePanel periodStart={periodStart} periodEnd={periodEnd} view={view} />
        </div>
      </div>
    </div>
  )
}
