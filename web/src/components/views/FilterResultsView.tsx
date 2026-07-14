/**
 * FilterResultsView — Vistas alternativas para resultados de filtro.
 * Árbol (default), tabla, kanban, calendario — mismos iconos que NodeView.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

// ── Mismo SVG que NodeView ─────────────────────────────────────────────────
const ICONS = {
  lista: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>,
  tabla: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><line x1="1" y1="13" x2="15" y2="13"/><line x1="5" y1="5" x2="5" y2="15"/><line x1="10" y1="5" x2="10" y2="15"/></svg>,
  kanban: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4" height="14" rx="1"/><rect x="6" y="1" width="4" height="10" rx="1"/><rect x="11" y="1" width="4" height="12" rx="1"/></svg>,
  calendario: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="13" rx="1"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/></svg>,
}

export type FilterView = 'lista' | 'tabla' | 'kanban' | 'calendario'

// ── Fecha del día de un nodo (buscando ancestro diary) ─────────────────────
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

// ── Breadcrumb ─────────────────────────────────────────────────────────────
function getBreadcrumb(node: Node, max = 3): string {
  const crumbs: string[] = []
  let cur = node.parentId ? store.getNode(node.parentId) : undefined
  const vis = new Set<string>()
  while (cur && !vis.has(cur.id) && crumbs.length < max) {
    vis.add(cur.id)
    if (cur.text) crumbs.unshift(cur.text.slice(0, 25))
    cur = cur.parentId ? store.getNode(cur.parentId) : undefined
  }
  return crumbs.join(' › ')
}

// ── Vista tabla ────────────────────────────────────────────────────────────
function TableView({ matchIds }: { matchIds: Set<string> }) {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const nodes = useMemo(() =>
    Array.from(matchIds)
      .map(id => s.getNode(id))
      .filter((n): n is Node => !!n && !n.deletedAt)
      .sort((a, b) => (a.text || '').localeCompare(b.text || ''))
  , [matchIds, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="filter-table-view">
      <table className="filter-table">
        <thead>
          <tr>
            <th>{t('search.filterStatus')}</th>
            <th>{t('panel.tasks')}</th>
            <th>{t('search.filterContext')}</th>
            <th>{t('search.filterDate')}</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(n => (
            <tr key={n.id} onClick={() => navigate(`/node/${n.id}`)} className="filter-table-row">
              <td className="filter-table-status">
                <span className={`filter-status-dot ${n.status === 'done' ? 'done' : n.status === 'pending' ? 'pending' : ''}`} />
              </td>
              <td className="filter-table-text">{n.text || t('common.noTitle')}</td>
              <td className="filter-table-crumb">{getBreadcrumb(n)}</td>
              <td className="filter-table-date">
                {n.due ? new Date(n.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Vista kanban ───────────────────────────────────────────────────────────
const KANBAN_COLS = [
  { id: 'pending', label: 'Pendiente', color: '#fbbf24' },
  { id: 'future',  label: 'Futuro',    color: '#60a5fa' },
  { id: 'done',    label: 'Hecho',     color: '#22c55e' },
  { id: 'other',   label: 'Sin estado',color: '#6b7280' },
]

function KanbanView({ matchIds }: { matchIds: Set<string> }) {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const nodes = useMemo(() =>
    Array.from(matchIds)
      .map(id => s.getNode(id))
      .filter((n): n is Node => !!n && !n.deletedAt)
  , [matchIds, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  function getCol(n: Node) {
    if (n.status === 'done') return 'done'
    if (n.status === 'pending') return 'pending'
    if (n.status === 'future') return 'future'
    if (n.status !== null && n.status !== undefined) return 'pending'
    return 'other'
  }

  return (
    <div className="filter-kanban-view">
      {KANBAN_COLS.map(col => {
        const colNodes = nodes.filter(n => getCol(n) === col.id)
        return (
          <div key={col.id} className="filter-kanban-col">
            <div className="filter-kanban-col-header" style={{ borderTopColor: col.color }}>
              <span style={{ color: col.color }}>{col.label}</span>
              <span className="filter-kanban-count">{colNodes.length}</span>
            </div>
            <div className="filter-kanban-cards">
              {colNodes.map(n => (
                <div key={n.id} className="filter-kanban-card" onClick={() => navigate(`/node/${n.id}`)}>
                  <div className="filter-kanban-card-text">{n.text || t('common.noTitle')}</div>
                  <div className="filter-kanban-card-crumb">{getBreadcrumb(n, 2)}</div>
                </div>
              ))}
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
  const { t } = useTranslation()
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const nodesByDay = useMemo(() => {
    const map = new Map<string, Node[]>()
    for (const id of matchIds) {
      const n = s.getNode(id)
      if (!n || n.deletedAt) continue
      const dayDate = getDayDate(n)
      if (!dayDate) continue
      const key = dayDate.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return map
  }, [matchIds, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  let startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

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
                  <div key={n.id} className={`filter-cal-task ${n.status === 'done' ? 'done' : ''}`}
                    onClick={() => navigate(`/node/${n.id}`)} title={n.text || ''}>
                    {n.text?.slice(0, 22) || t('common.noTitle')}
                  </div>
                ))}
                {nodes.length > 3 && <div className="filter-cal-more">+{nodes.length - 3}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Barra de resultados + selector de vista ────────────────────────────────
interface SwitcherProps {
  view: FilterView
  onChange: (v: FilterView) => void
  count: number
  onClear: () => void
  /** Kanban (agrupa por estado) y Calendario (agrupa por fecha) solo tienen sentido
   *  para tareas — para notas, lienzos u otros elementos no hay estado ni fecha que
   *  organizar. Por defecto true (comportamiento previo, usado también por WFHomeView
   *  con filtros libres tipo `estado:` que sí pueden mezclar tareas). */
  allowBoardViews?: boolean
}

export function FilterViewSwitcher({ view, onChange, count, onClear, allowBoardViews = true }: SwitcherProps) {
  const { t } = useTranslation()
  const allModes: { id: FilterView; title: string }[] = [
    { id: 'lista',     title: 'Árbol' },
    { id: 'tabla',     title: 'Tabla' },
    { id: 'kanban',    title: 'Kanban' },
    { id: 'calendario',title: 'Calendario' },
  ]
  const modes = allowBoardViews ? allModes : allModes.filter(m => m.id !== 'kanban' && m.id !== 'calendario')
  return (
    <div className="filter-results-bar">
      <span className="filter-results-count">
        {count} resultado{count !== 1 ? 's' : ''}
        {' '}· <button className="wf-filter-clear-btn" onClick={onClear}>Limpiar</button>
      </span>
      <div className="filter-view-switcher">
        {modes.map(m => (
          <button
            key={m.id}
            className={`node-view-mode-btn ${view === m.id ? 'active' : ''}`}
            onClick={() => onChange(m.id)}
            title={m.title}
          >
            {ICONS[m.id]}
          </button>
        ))}
      </div>
    </div>
  )
}

export { TableView, KanbanView, CalendarView }
