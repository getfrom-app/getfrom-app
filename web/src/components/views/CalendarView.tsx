import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'

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

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'long' })
}

function formatMonthShort(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'short' })
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
  if (node.priority === 'high') return 'var(--priority-high, #ef4444)'
  if (node.priority === 'medium') return 'var(--priority-medium, #f97316)'
  if (node.isEvent) return 'var(--accent, #8b5cf6)'
  return 'var(--accent-soft, #7c3aed)'
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
  onNavigate: (offset: number) => void
  onGoToToday: () => void
  onNodeClick: (id: string) => void
  onCreateEvent: (date: Date) => void
}

function WeekView({ weekStart, today, allNodes, onNavigate, onGoToToday, onNodeClick, onCreateEvent }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

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

  const weekLabel = formatWeekLabel(weekStart)

  function handleCellClick(day: Date, hour: number) {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    onCreateEvent(d)
  }

  return (
    <>
      <div className="calendar-week-nav">
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-7)}>← Anterior</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
        <span className="calendar-week-label">{weekLabel}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(7)}>Siguiente →</button>
      </div>

      <div className="view-body calendar-week-body">
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
              </div>
            )
          })}
        </div>

        {/* ── Timeline horario ── */}
        <div className="calendar-timeline-scroll">
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
                    const hasTimedEvent = timedNodes.some(n => {
                      const d2 = new Date(n.due!)
                      return d2.getHours() === hour
                    })
                    return (
                      <div
                        key={hour}
                        className={`calendar-timeline-cell ${isHovered ? 'calendar-timeline-cell--hover' : ''}`}
                        style={{ top: hour * CELL_HEIGHT, height: CELL_HEIGHT }}
                        onClick={() => handleCellClick(day, hour)}
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault()
                          const eventId = e.dataTransfer.getData('eventId')
                          if (!eventId) return
                          const newDate = new Date(day)
                          newDate.setHours(hour, 0, 0, 0)
                          store.updateNode(eventId, { due: newDate.toISOString() })
                        }}
                      >
                        {isHovered && !hasTimedEvent && (
                          <span className="calendar-cell-add-hint">+ Añadir evento</span>
                        )}
                      </div>
                    )
                  })}

                  {/* Eventos con hora */}
                  {timedNodes.map(node => {
                    const d = new Date(node.due!)
                    const topPx = (d.getHours() + d.getMinutes() / 60) * CELL_HEIGHT

                    // Duración: si tiene dueEnd, calcular; si no, 1h por defecto
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
                        style={{
                          top: topPx,
                          height: heightPx,
                          background: priorityBg(node),
                          cursor: 'grab',
                        }}
                        onClick={e => { e.stopPropagation(); onNodeClick(node.id) }}
                        title={node.text || 'Sin título'}
                      >
                        <span className="calendar-event-time">{timeLabel}</span>
                        <span className="calendar-event-text">{node.text || 'Sin título'}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
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
}

function MonthView({ monthStart, today, allNodes, onNavigate, onGoToToday, onNodeClick, onDayClick }: MonthViewProps) {
  const nodesWithDue = allNodes.filter(n => n.due)

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

  const monthLabel = `${formatMonth(monthStart)} ${monthStart.getFullYear()}`

  return (
    <>
      <div className="calendar-week-nav">
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-1)}>‹</button>
        <span className="calendar-week-label" style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(1)}>›</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
      </div>

      <div className="view-body">
        <div className="calendar-month-grid">
          {/* Day headers */}
          {DAY_NAMES.map(d => (
            <div key={d} className="calendar-month-day-name">{d}</div>
          ))}

          {/* Day cells */}
          {cells.map((day, i) => {
            const inMonth = isSameMonth(day, monthStart)
            const isToday = isSameDay(day, today)
            const dayNodes = getNodesForDay(day)
            const overflow = dayNodes.length > 3

            return (
              <div
                key={i}
                className={`calendar-month-cell ${inMonth ? '' : 'calendar-month-cell--out'} ${isToday ? 'calendar-month-cell--today' : ''}`}
                onClick={() => onDayClick(day)}
              >
                <div className="calendar-month-cell-number">{day.getDate()}</div>
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
    </>
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
}

function YearView({ year, today, allNodes, onNavigate, onGoToToday, onMonthClick }: YearViewProps) {
  const nodesWithDue = allNodes.filter(n => n.due)

  // Build a set of "YYYY-MM-DD" strings with activity
  const activeDays = new Set<string>()
  for (const n of nodesWithDue) {
    if (!n.due) continue
    const d = new Date(n.due)
    if (d.getFullYear() === year) {
      activeDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    }
  }

  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1))

  return (
    <>
      <div className="calendar-week-nav">
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-1)}>‹</button>
        <span className="calendar-week-label">{year}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(1)}>›</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
      </div>

      <div className="view-body">
        <div className="calendar-year-grid">
          {months.map((monthDate, mi) => {
            const isCurrentMonth = isSameMonth(monthDate, today)

            // Mini month grid (just dots for days)
            const firstDay = startOfMonth(monthDate)
            const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
            const gridStart = addDays(firstDay, -firstDow)
            // 5 rows × 7 = 35 cells
            const cells = Array.from({ length: 35 }, (_, i) => addDays(gridStart, i))

            return (
              <div
                key={mi}
                className={`calendar-year-month ${isCurrentMonth ? 'calendar-year-month--current' : ''}`}
                onClick={() => onMonthClick(monthDate)}
              >
                <div className="calendar-year-month-name">
                  {MONTH_NAMES_SHORT[mi]}
                </div>
                <div className="calendar-year-mini-grid">
                  {cells.map((day, di) => {
                    const inMonth = isSameMonth(day, monthDate)
                    const isToday = isSameDay(day, today)
                    const hasActivity = inMonth && activeDays.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`)

                    return (
                      <div
                        key={di}
                        className={[
                          'calendar-year-dot',
                          !inMonth ? 'calendar-year-dot--out' : '',
                          isToday ? 'calendar-year-dot--today' : '',
                          hasActivity ? 'calendar-year-dot--active' : '',
                        ].filter(Boolean).join(' ')}
                      />
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allNodes = s.allActive().filter(n => !n.deletedAt)

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

  return (
    <div className="view calendar-view">
      <div className="view-header">
        <div className="calendar-header-row">
          <h1 className="view-title">Calendario</h1>
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

        {view === 'week' && (
          <WeekView
            weekStart={weekStart}
            today={today}
            allNodes={allNodes}
            onNavigate={navigateWeek}
            onGoToToday={goToToday}
            onNodeClick={id => navigate(`/node/${id}`)}
            onCreateEvent={handleCreateEvent}
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
          />
        )}
      </div>
    </div>
  )
}
