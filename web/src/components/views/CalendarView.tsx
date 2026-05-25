import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'
import CalendarSidePanel from '../panels/CalendarSidePanel'
import { getCalendarEventsRange, type CalendarEvent } from '../../api/googleCalendar'

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
    const t = text.trim() || 'Nuevo evento'
    const node = store.createNode({ text: t, parentId: null })
    store.updateNode(node.id, { due: date.toISOString(), isEvent: true, status: 'pending' })
    onCreate(node.id)
  }

  return (
    <div className="calendar-quick-create" style={style} onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="calendar-quick-create-input"
        placeholder="Nombre del evento…"
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

type ViewType = 'week' | 'month' | 'year'

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
  // Events: amber/orange
  if (node.isEvent && !node.status) return 'var(--calendar-event-color, #f59e0b)'
  // Tasks done: muted
  if (node.status === 'done') return '#6b7280'
  // Priority colors
  if (node.priority === 'high') return '#ef4444'
  if (node.priority === 'medium') return '#f97316'
  if (node.priority === 'low') return '#22c55e'
  // Default: accent
  return 'var(--accent, #8b5cf6)'
}

// Returns true if the ISO date string has a time component (non-midnight)
function hasTime(isoStr: string): boolean {
  const d = new Date(isoStr)
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
}

// ── Week View ─────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const CELL_HEIGHT = 60 // px per hour

interface WeekViewProps {
  weekStart: Date
  today: Date
  allNodes: Node[]
  googleEvents: CalendarEvent[]
  onNavigate: (offset: number) => void
  onGoToToday: () => void
  onNodeClick: (id: string) => void
  onCreateEvent: (date: Date) => void
  onDrop?: (e: React.DragEvent, date: Date) => void
}

function WeekView({ weekStart, today, allNodes, googleEvents, onNavigate, onGoToToday, onNodeClick, onCreateEvent, onDrop }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)
  const [quickCreate, setQuickCreate] = useState<{ date: Date; cellKey: string } | null>(null)
  const [eventPopup, setEventPopup] = useState<{ node: Node; anchor: HTMLElement } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours()
      const scrollTarget = Math.max(0, (currentHour - 1) * CELL_HEIGHT)
      scrollRef.current.scrollTop = scrollTarget
    }
  }, [])

  // Eventos y tareas con fecha
  const nodesWithDue = allNodes.filter(n => n.due && !n.deletedAt)

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

  const weekLabel = formatWeekLabel(weekStart)

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
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-7)}>← Anterior</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
        <span className="calendar-week-label">{weekLabel}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(7)}>Siguiente →</button>
      </div>

      <div className="calendar-week-body">
        {/* ── Cabecera de días ── */}
        <div className="calendar-timeline-header">
          <div className="calendar-timeline-gutter" />
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            return (
              <div key={i} className={`calendar-timeline-day-header ${isToday ? 'calendar-timeline-day-header--today' : ''}`}>
                <span className="calendar-day-name">{DAY_NAMES[i]}</span>
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
              <div key={i} className="calendar-allday-cell">
                {allDayNodes.map(node => (
                  <button
                    key={node.id}
                    className="calendar-event-chip"
                    style={{ background: priorityBg(node) }}
                    onClick={() => onNodeClick(node.id)}
                    title={node.text || 'Sin título'}
                  >
                    {node.text || 'Sin título'}
                  </button>
                ))}
                {gcalAllDay.map(ev => (
                  <div key={ev.id} className="calendar-event-chip calendar-event-chip--gcal" title={ev.title}>
                    {ev.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* ── Timeline horario ── */}
        <div ref={scrollRef} className="calendar-timeline-scroll">
          <div className="calendar-timeline-grid" style={{ height: CELL_HEIGHT * 24 }}>
            {/* Líneas de hora + etiquetas */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className="calendar-timeline-hour-row"
                style={{ top: hour * CELL_HEIGHT, height: CELL_HEIGHT }}
              >
                <div className="calendar-timeline-gutter calendar-hour-label">
                  {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
                </div>
                <div className="calendar-timeline-hour-line" />
              </div>
            ))}

            {/* Columnas por día (celdas clicables + eventos) */}
            {days.map((day, di) => {
              const timedNodes = getTimedNodes(day)
              return (
                <div
                  key={di}
                  className="calendar-timeline-day-col"
                  style={{ left: `calc(var(--gutter-width) + ${di} * var(--day-col-width))`, width: 'var(--day-col-width)', height: CELL_HEIGHT * 24 }}
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
                        style={{ top: hour * CELL_HEIGHT, height: isCreating ? 'auto' : CELL_HEIGHT, minHeight: CELL_HEIGHT }}
                        onClick={() => { if (!isCreating) handleCellClick(day, hour, cellKey) }}
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                        onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                        onDrop={e => {
                          e.preventDefault()
                          e.currentTarget.classList.remove('drag-over')
                          // From side panel
                          const nodeId = e.dataTransfer.getData('cal-node-id')
                          if (nodeId) {
                            const newDate = new Date(day)
                            newDate.setHours(hour, 0, 0, 0)
                            store.updateNode(nodeId, { due: newDate.toISOString(), status: 'pending' })
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
                    const topPx = (d.getHours() + d.getMinutes() / 60) * CELL_HEIGHT
                    let durationH = 1
                    if (node.dueEnd) {
                      const end = new Date(node.dueEnd)
                      durationH = Math.max(0.5, (end.getTime() - d.getTime()) / 3600000)
                    }
                    const heightPx = durationH * CELL_HEIGHT
                    const timeLabel = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
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
                        style={{ top: topPx, height: heightPx, background: priorityBg(node), cursor: 'grab' }}
                        onClick={e => {
                          e.stopPropagation()
                          setQuickCreate(null)
                          setEventPopup({ node, anchor: e.currentTarget as HTMLElement })
                        }}
                        title={node.text || 'Sin título'}
                      >
                        <span className="calendar-event-time">{timeLabel}</span>
                        <span className="calendar-event-text">{node.text || 'Sin título'}</span>
                      </button>
                    )
                  })}

                  {/* Eventos con hora — Google Calendar */}
                  {getGoogleTimed(day).map(ev => {
                    const d = new Date(ev.start)
                    const topPx = (d.getHours() + d.getMinutes() / 60) * CELL_HEIGHT
                    let durationH = 1
                    if (ev.end) {
                      const end = new Date(ev.end)
                      durationH = Math.max(0.25, (end.getTime() - d.getTime()) / 3600000)
                    }
                    const heightPx = durationH * CELL_HEIGHT
                    const timeLabel = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div
                        key={ev.id}
                        className="calendar-event-block calendar-event-block--gcal"
                        style={{ top: topPx, height: heightPx }}
                        title={ev.title}
                      >
                        <span className="calendar-event-time">{timeLabel}</span>
                        <span className="calendar-event-text">{ev.title}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Event popup */}
      {eventPopup && (
        <EventPopup
          node={eventPopup.node}
          anchorEl={eventPopup.anchor}
          onClose={() => setEventPopup(null)}
          onOpen={id => { setEventPopup(null); onNodeClick(id) }}
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
  onNavigate: (months: number) => void
  onGoToToday: () => void
  onNodeClick: (id: string) => void
  onDayClick: (day: Date) => void
  onDrop?: (e: React.DragEvent, date: Date) => void
}

function MonthView({ monthStart, today, allNodes, onNavigate, onGoToToday, onNodeClick, onDayClick, onDrop }: MonthViewProps) {
  const navigate = useNavigate()
  const nodesWithDue = allNodes.filter(n => n.due)
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
          const overflow = dayNodes.length > 3
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
                {dayNodes.slice(0, 3).map(node => (
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
                  <span className="calendar-month-overflow">+{dayNodes.length - 3} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
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

  // Also count nodes with due date
  const nodesWithDue = allNodes.filter(n => n.due && !n.deletedAt)
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

  const [view, setView] = useState<ViewType>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allNodes = s.allActive().filter(n => !n.deletedAt)

  // Fetch Google Calendar events para la semana visible
  useEffect(() => {
    if (view !== 'week') return
    let cancelled = false
    const end = addDays(weekStart, 6)
    getCalendarEventsRange(weekStart, end)
      .then(evs => { if (!cancelled) setGoogleEvents(evs) })
      .catch(() => { if (!cancelled) setGoogleEvents([]) })
    return () => { cancelled = true }
  }, [weekStart, view])

  function goToToday() {
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

  function handleCreateEvent(date: Date) {
    const node = store.createNode({
      text: 'Nuevo evento',
      parentId: null,
    })
    store.updateNode(node.id, {
      due: date.toISOString(),
      isEvent: true,
      status: 'pending',
    })
    navigate(`/node/${node.id}`)
  }

  // Periodo de inicio para overdue (basado en vista actual)
  const periodStart = view === 'week' ? weekStart
    : view === 'month' ? monthStart
    : new Date(year, 0, 1)

  // Handler para drop sobre celdas del calendario (asigna fecha)
  function handleCalendarDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('cal-node-id')
    if (!nodeId) return
    const d = new Date(date)
    d.setHours(9, 0, 0, 0)
    store.updateNode(nodeId, { due: d.toISOString(), status: 'pending' })
  }

  return (
    <div className="view calendar-view calendar-view--with-panel" role="main" aria-label="Vista de calendario">
      <div className="calendar-main-area">
        <div className="calendar-top-bar">
          <div className="calendar-header-row">
            <h1 className="view-title" style={{ margin: 0 }}>Calendario</h1>
            <div className="calendar-view-tabs">
              {(['week', 'month', 'year'] as ViewType[]).map(v => (
                <button
                  key={v}
                  className={`calendar-view-tab ${view === v ? 'calendar-view-tab--active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v === 'week' ? 'Semana' : v === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="calendar-view-body">
          {view === 'week' && (
            <WeekView
              weekStart={weekStart}
              today={today}
              allNodes={allNodes}
              googleEvents={googleEvents}
              onNavigate={navigateWeek}
              onGoToToday={goToToday}
              onNodeClick={id => navigate(`/node/${id}`)}
              onCreateEvent={handleCreateEvent}
              onDrop={handleCalendarDrop}
            />
          )}

          {view === 'month' && (
            <MonthView
              monthStart={monthStart}
              today={today}
              allNodes={allNodes}
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
          <CalendarSidePanel periodStart={periodStart} view={view} />
        </div>
      </div>
    </div>
  )
}
