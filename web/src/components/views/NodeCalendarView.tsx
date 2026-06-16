import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

// Detecta nodos de estructura temporal que no deben aparecer en vistas de contenido
const MONTHS_TEMPORAL = new Set(['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])
function isTemporalNode(text: string): boolean {
  const t = (text || '').trim()
  if (/^\d{4}$/.test(t)) return true
  // "Mayo" o "Mayo 2026"
  const words = t.toLowerCase().split(/\s+/)
  if (MONTHS_TEMPORAL.has(words[0]) && (words.length === 1 || /^\d{4}$/.test(words[1] || ''))) return true
  if (/^semana \d+$/i.test(t)) return true
  return false
}

interface CalendarEntry {
  node: Node
  date: Date
  source: 'due' | string  // '__due' o id de columna custom
  sourceLabel: string
}

export default function NodeCalendarView({ parentId }: Props) {
  useStore()  // suscripción
  const navigate = useNavigate()
  const [viewDate, setViewDate] = useState(new Date())
  const [mode, setMode] = useState<'month' | 'week' | 'timeline'>('month')


  const [quickCreate, setQuickCreate] = useState<{ day: number; text: string } | null>(null)
  const [dateQuick, setDateQuick] = useState<{ key: string; text: string } | null>(null)  // semana

  const allChildren = store.children(parentId).filter(n => !n.deletedAt && !isTemporalNode(n.text || ''))
  const customCols = store.getPropSchema(parentId)
  const dateCols = customCols.filter(c => c.type === 'date')

  // Construye lista de entradas. Cada nodo puede aparecer en MÚLTIPLES fechas:
  // - due builtin del propio hijo
  // - cada columna date custom del hijo
  // - tareas hijas de los hijos (grandchildren con status + due) — para que
  //   tareas creadas desde la columna "Tarea" de la tabla aparezcan también
  const entries: CalendarEntry[] = useMemo(() => {
    const out: CalendarEntry[] = []
    for (const n of allChildren) {
      if (n.due) out.push({ node: n, date: new Date(n.due), source: 'due', sourceLabel: 'Fecha' })
      for (const col of dateCols) {
        const v = store.getPropValue(n.id, col.id)
        if (v) out.push({ node: n, date: new Date(String(v)), source: col.id, sourceLabel: col.name })
      }
      // Tareas hijas (grandchildren) con due
      const tasks = store.children(n.id).filter(t => !t.deletedAt && t.status !== null && t.due)
      for (const t of tasks) {
        out.push({ node: t, date: new Date(t.due!), source: 'task-of-' + n.id, sourceLabel: n.text || 'Sin título' })
      }
    }
    return out
  }, [allChildren, dateCols])

  // Nodos sin fecha alguna (ni due, ni date col, ni tareas hijas con due)
  const undatedNodes: Node[] = useMemo(() => {
    return allChildren.filter(n => {
      if (n.due) return false
      for (const col of dateCols) {
        if (store.getPropValue(n.id, col.id)) return false
      }
      // (si tiene tareas con due lo seguimos considerando "sin fecha propia")
      return true
    })
  }, [allChildren, dateCols])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const days: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ]

  function getEntriesForDay(day: number): CalendarEntry[] {
    return entries.filter(e =>
      e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === day
    )
  }
  function entriesOn(d: Date): CalendarEntry[] {
    return entries.filter(e =>
      e.date.getFullYear() === d.getFullYear() && e.date.getMonth() === d.getMonth() && e.date.getDate() === d.getDate()
    )
  }
  // Semana (lunes→domingo) que contiene viewDate.
  const weekStart = (() => {
    const d = new Date(viewDate); const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow); return d
  })()
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })
  // Timeline: todas las entradas ordenadas por fecha, agrupadas por día.
  const timelineGroups = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime())
    const groups: { key: string; date: Date; items: CalendarEntry[] }[] = []
    for (const e of sorted) {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.items.push(e)
      else groups.push({ key, date: e.date, items: [e] })
    }
    return groups
  }, [entries])

  function quickCreateOnDate(d: Date, text: string) {
    const t = text.trim(); if (!t) return
    const due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString()
    const node = store.createNode({ text: t, parentId, siblingOrder: Date.now() })
    store.updateNode(node.id, { due })
  }
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  function handleCellClick(day: number) {
    setQuickCreate({ day, text: '' })
  }

  function commitQuickCreate() {
    if (!quickCreate) return
    const text = quickCreate.text.trim()
    if (!text) { setQuickCreate(null); return }
    const due = new Date(year, month, quickCreate.day, 0, 0, 0).toISOString()
    const node = store.createNode({ text, parentId, siblingOrder: Date.now() })
    // Nodo normal con fecha (NO tarea). El usuario puede convertirlo en tarea
    // después si quiere desde el panel derecho.
    store.updateNode(node.id, { due })
    setQuickCreate(null)
  }

  const monthName = viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const weekLabel = `${weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
  const step = (dir: number) => {
    if (mode === 'week') { const d = new Date(viewDate); d.setDate(d.getDate() + dir * 7); setViewDate(d) }
    else setViewDate(new Date(year, month + dir, 1))
  }
  const modeBtn = (m: typeof mode, label: string) => (
    <button className="node-calendar-nav-btn" onClick={() => setMode(m)}
      style={{ fontWeight: mode === m ? 700 : 400, color: mode === m ? 'var(--accent,#6c5ce7)' : undefined }}>{label}</button>
  )

  return (
    <div className="node-calendar">
      <div className="node-calendar-nav">
        {mode !== 'timeline' && <button className="node-calendar-nav-btn" onClick={() => step(-1)}>‹</button>}
        <span className="node-calendar-month">{mode === 'week' ? weekLabel : mode === 'timeline' ? 'Cronología' : monthName}</span>
        {mode !== 'timeline' && <button className="node-calendar-nav-btn" onClick={() => step(1)}>›</button>}
        <button className="node-calendar-nav-btn" onClick={() => setViewDate(new Date())} style={{ marginLeft: 8 }}>Hoy</button>
        <span style={{ flex: 1 }} />
        {modeBtn('month', 'Mes')}
        {modeBtn('week', 'Semana')}
        {modeBtn('timeline', 'Timeline')}
      </div>

      {/* ── SEMANA ── */}
      {mode === 'week' && (
        <div className="node-calendar-week">
          {weekDays.map(d => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            const today = isSameDay(d, new Date())
            const isQuick = dateQuick?.key === key
            return (
              <div key={key} className={`node-calendar-week-col ${today ? 'node-calendar-cell--today' : ''}`}>
                <div className="node-calendar-week-head">{d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</div>
                {entriesOn(d).map((entry, idx) => (
                  <button key={`${entry.node.id}-${entry.source}-${idx}`}
                    className={`node-calendar-event ${entry.node.status === 'done' ? 'done' : ''}`}
                    onClick={() => navigate(`/node/${entry.node.id}`)}
                    title={entry.node.text || 'Sin título'}>
                    {entry.node.text?.slice(0, 24) || 'Sin título'}
                  </button>
                ))}
                {isQuick ? (
                  <input autoFocus className="node-calendar-quick-input" value={dateQuick!.text}
                    onChange={e => setDateQuick({ key, text: e.target.value })}
                    onBlur={() => { quickCreateOnDate(d, dateQuick!.text); setDateQuick(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { quickCreateOnDate(d, dateQuick!.text); setDateQuick(null) } if (e.key === 'Escape') setDateQuick(null) }}
                    placeholder="+ Nuevo..." />
                ) : (
                  <button className="node-calendar-quick-add" onClick={() => setDateQuick({ key, text: '' })} title="Añadir">＋</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TIMELINE ── */}
      {mode === 'timeline' && (
        <div className="node-calendar-timeline">
          {timelineGroups.length === 0 && <div className="node-calendar-empty">Sin fechas todavía.</div>}
          {timelineGroups.map(g => (
            <div key={g.key} className="node-calendar-tl-group">
              <div className={`node-calendar-tl-date ${isSameDay(g.date, new Date()) ? 'today' : ''}`}>
                {g.date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div className="node-calendar-tl-items">
                {g.items.map((entry, idx) => (
                  <button key={`${entry.node.id}-${entry.source}-${idx}`}
                    className={`node-calendar-event ${entry.node.status === 'done' ? 'done' : ''}`}
                    onClick={() => navigate(`/node/${entry.node.id}`)}
                    title={entry.node.text || 'Sin título'}>
                    {entry.source !== 'due' && <span className="node-calendar-event-source">{entry.sourceLabel}: </span>}
                    {entry.node.text?.slice(0, 40) || 'Sin título'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'month' && (
      <div className="node-calendar-grid">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="node-calendar-dow">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="node-calendar-cell node-calendar-cell--empty" />
          const dayEntries = getEntriesForDay(day)
          const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
          const isQuick = quickCreate?.day === day
          return (
            <div
              key={day}
              className={`node-calendar-cell ${isToday ? 'node-calendar-cell--today' : ''}`}
              onClick={e => { if (e.target === e.currentTarget && !isQuick) handleCellClick(day) }}
            >
              <span className="node-calendar-day">{day}</span>
              {dayEntries.map((entry, idx) => (
                <button
                  key={`${entry.node.id}-${entry.source}-${idx}`}
                  className={`node-calendar-event ${entry.node.status === 'done' ? 'done' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${entry.node.id}`) }}
                  title={`${entry.node.text || 'Sin título'}${entry.source !== 'due' ? ` — ${entry.sourceLabel}` : ''}`}
                >
                  {entry.source !== 'due' && <span className="node-calendar-event-source">{entry.sourceLabel}: </span>}
                  {entry.node.text?.slice(0, 20) || 'Sin título'}
                </button>
              ))}
              {isQuick ? (
                <input
                  autoFocus
                  className="node-calendar-quick-input"
                  value={quickCreate!.text}
                  onChange={e => setQuickCreate({ ...quickCreate!, text: e.target.value })}
                  onBlur={commitQuickCreate}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitQuickCreate()
                    if (e.key === 'Escape') setQuickCreate(null)
                  }}
                  onClick={e => e.stopPropagation()}
                  placeholder="+ Nuevo..."
                />
              ) : (
                <button className="node-calendar-quick-add" onClick={e => { e.stopPropagation(); handleCellClick(day) }} title="Añadir">＋</button>
              )}
            </div>
          )
        })}
      </div>
      )}
      {undatedNodes.length > 0 && (
        <div className="node-calendar-undated">
          <div className="node-calendar-undated-label">Sin fecha <span className="node-calendar-undated-count">{undatedNodes.length}</span></div>
          <div className="node-calendar-undated-list">
            {undatedNodes.map(n => (
              <button
                key={n.id}
                className="node-calendar-undated-item"
                onClick={() => navigate(`/node/${n.id}`)}
              >
                {n.text || 'Sin título'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
