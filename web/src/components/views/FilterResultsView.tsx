/**
 * FilterResultsView — Vistas alternativas para resultados de filtro.
 * Lista plana o calendario agrupado por día.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  matchIds: Set<string>
  filterText: string
}

// ── Obtener la fecha del día de un nodo (buscando ancestro diary) ──────────
function getDayDate(node: Node): string | null {
  let cur: Node | undefined = node
  const visited = new Set<string>()
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id)
    if (cur.isDiaryEntry && cur.diaryDate) return cur.diaryDate
    if (!cur.parentId) break
    cur = store.getNode(cur.parentId)
  }
  return node.due ?? null
}

// ── Vista plana ────────────────────────────────────────────────────────────
function FlatView({ matchIds }: { matchIds: Set<string> }) {
  const s = useStore()
  const navigate = useNavigate()
  const nodes = useMemo(() =>
    Array.from(matchIds)
      .map(id => s.getNode(id))
      .filter((n): n is Node => !!n && !n.deletedAt)
      .sort((a, b) => (a.text || '').localeCompare(b.text || ''))
  , [matchIds, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="filter-flat-view">
      {nodes.map(n => {
        // Build breadcrumb
        const crumbs: string[] = []
        let cur = n.parentId ? store.getNode(n.parentId) : undefined
        const vis = new Set<string>()
        while (cur && !vis.has(cur.id)) {
          vis.add(cur.id)
          if (cur.text) crumbs.unshift(cur.text.slice(0, 30))
          if (crumbs.length >= 3) break
          cur = cur.parentId ? store.getNode(cur.parentId) : undefined
        }
        return (
          <div
            key={n.id}
            className="filter-flat-item"
            onClick={() => navigate(`/node/${n.id}`)}
          >
            <span className={`filter-flat-checkbox ${n.status === 'done' ? 'done' : n.status === 'pending' ? 'pending' : ''}`}>
              {n.status === 'done' ? '✓' : n.status === 'pending' ? '○' : '·'}
            </span>
            <div className="filter-flat-content">
              <span className="filter-flat-text">{n.text || 'Sin título'}</span>
              {crumbs.length > 0 && (
                <span className="filter-flat-crumb">{crumbs.join(' › ')}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista calendario ───────────────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['L','M','X','J','V','S','D']

function CalendarView({ matchIds }: { matchIds: Set<string> }) {
  const s = useStore()
  const navigate = useNavigate()
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const nodesByDay = useMemo(() => {
    const map = new Map<string, Node[]>()
    for (const id of matchIds) {
      const n = s.getNode(id)
      if (!n || n.deletedAt) continue
      const dayDate = getDayDate(n)
      if (!dayDate) continue
      const key = dayDate.slice(0, 10) // YYYY-MM-DD
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return map
  }, [matchIds, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  // Monday-based: 0=Mon … 6=Sun
  let startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="filter-cal-view">
      <div className="filter-cal-header">
        <button className="filter-cal-nav" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
        <span className="filter-cal-title">{MONTHS_ES[month]} {year}</span>
        <button className="filter-cal-nav" onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div className="filter-cal-grid">
        {DAYS_ES.map(d => <div key={d} className="filter-cal-dow">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="filter-cal-cell filter-cal-cell--empty" />
          const key = `${year}-${pad(month + 1)}-${pad(day)}`
          const nodes = nodesByDay.get(key) || []
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          return (
            <div key={key} className={`filter-cal-cell ${isToday ? 'filter-cal-cell--today' : ''} ${nodes.length > 0 ? 'filter-cal-cell--has-tasks' : ''}`}>
              <span className="filter-cal-day-num">{day}</span>
              <div className="filter-cal-tasks">
                {nodes.slice(0, 3).map(n => (
                  <div
                    key={n.id}
                    className={`filter-cal-task ${n.status === 'done' ? 'done' : ''}`}
                    onClick={() => navigate(`/node/${n.id}`)}
                    title={n.text || ''}
                  >
                    {n.text?.slice(0, 25) || 'Sin título'}
                  </div>
                ))}
                {nodes.length > 3 && (
                  <div className="filter-cal-more">+{nodes.length - 3} más</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export type FilterView = 'lista' | 'plano' | 'calendario'

interface SwitcherProps {
  view: FilterView
  onChange: (v: FilterView) => void
  count: number
  filterText: string
  onClear: () => void
}

export function FilterViewSwitcher({ view, onChange, count, filterText, onClear }: SwitcherProps) {
  return (
    <div className="filter-results-bar">
      <span className="filter-results-count">
        {count} resultado{count !== 1 ? 's' : ''}
        {' '}· <button className="wf-filter-clear-btn" onClick={onClear}>Limpiar</button>
      </span>
      <div className="filter-view-switcher">
        {([
          { id: 'lista', icon: '≡', title: 'Vista árbol' },
          { id: 'plano', icon: '☰', title: 'Lista plana' },
          { id: 'calendario', icon: '🗓', title: 'Calendario' },
        ] as { id: FilterView; icon: string; title: string }[]).map(v => (
          <button
            key={v.id}
            className={`filter-view-btn ${view === v.id ? 'active' : ''}`}
            onClick={() => onChange(v.id)}
            title={v.title}
          >
            {v.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

export { FlatView, CalendarView }
