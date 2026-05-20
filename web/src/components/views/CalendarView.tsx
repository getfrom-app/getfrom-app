import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
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

// ── Week View ─────────────────────────────────────────────────────────────────

interface WeekViewProps {
  weekStart: Date
  today: Date
  allNodes: Node[]
  onNavigate: (offset: number) => void
  onGoToToday: () => void
  onNodeClick: (id: string) => void
}

function WeekView({ weekStart, today, allNodes, onNavigate, onGoToToday, onNodeClick }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const nodesWithDue = allNodes.filter(n => n.due)
  const noDateTasks = allNodes.filter(n => n.status !== null && !n.due)

  function getNodesForDay(day: Date): Node[] {
    return nodesWithDue.filter(n => {
      if (!n.due) return false
      return isSameDay(new Date(n.due), day)
    })
  }

  const weekLabel = `${formatDate(weekStart)} — ${formatDate(days[6])}`

  return (
    <>
      <div className="calendar-week-nav">
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(-7)}>‹</button>
        <span className="calendar-week-label">{weekLabel}</span>
        <button className="btn-secondary calendar-nav-btn" onClick={() => onNavigate(7)}>›</button>
        <button className="btn-secondary" onClick={onGoToToday}>Hoy</button>
      </div>

      <div className="view-body">
        <div className="calendar-grid">
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            const dayNodes = getNodesForDay(day)
            return (
              <div
                key={i}
                className={`calendar-day-cell ${isToday ? 'calendar-day-cell--today' : ''}`}
              >
                <div className="calendar-day-header">
                  <span className="calendar-day-name">{DAY_NAMES[i]}</span>
                  <span className="calendar-day-number">{day.getDate()}</span>
                </div>
                <div className="calendar-day-nodes">
                  {dayNodes.map(node => (
                    <NodeChip
                      key={node.id}
                      node={node}
                      onClick={() => onNodeClick(node.id)}
                    />
                  ))}
                  {dayNodes.length === 0 && (
                    <span className="calendar-day-empty">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {noDateTasks.length > 0 && (
          <div className="calendar-nodate-section">
            <h3 className="calendar-nodate-title">Sin fecha</h3>
            <div className="calendar-nodate-chips">
              {noDateTasks.map(node => (
                <NodeChip
                  key={node.id}
                  node={node}
                  onClick={() => onNodeClick(node.id)}
                  compact
                />
              ))}
            </div>
          </div>
        )}
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
