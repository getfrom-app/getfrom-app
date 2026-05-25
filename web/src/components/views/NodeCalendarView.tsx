import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

interface Props { parentId: string }

export default function NodeCalendarView({ parentId }: Props) {
  const navigate = useNavigate()
  const [viewDate, setViewDate] = useState(new Date())
  const [quickCreate, setQuickCreate] = useState<{ day: number; text: string } | null>(null)
  const children = store.children(parentId).filter(n => !n.deletedAt && n.due)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const days: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ]

  function getNodesForDay(day: number) {
    return children.filter(n => {
      const d = new Date(n.due!)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function handleCellClick(day: number) {
    setQuickCreate({ day, text: '' })
  }

  function commitQuickCreate() {
    if (!quickCreate) return
    const text = quickCreate.text.trim()
    if (!text) { setQuickCreate(null); return }
    const due = new Date(year, month, quickCreate.day, 0, 0, 0).toISOString()
    const node = store.createNode({ text, parentId, siblingOrder: Date.now() })
    store.updateNode(node.id, { due, status: 'pending' })
    setQuickCreate(null)
  }

  const monthName = viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div className="node-calendar">
      <div className="node-calendar-nav">
        <button className="node-calendar-nav-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
        <span className="node-calendar-month">{monthName}</span>
        <button className="node-calendar-nav-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
        <button className="node-calendar-nav-btn" onClick={() => setViewDate(new Date())} style={{ marginLeft: 8 }}>Hoy</button>
      </div>
      <div className="node-calendar-grid">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="node-calendar-dow">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="node-calendar-cell node-calendar-cell--empty" />
          const nodes = getNodesForDay(day)
          const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
          const isQuick = quickCreate?.day === day
          return (
            <div
              key={day}
              className={`node-calendar-cell ${isToday ? 'node-calendar-cell--today' : ''}`}
              onClick={e => { if (e.target === e.currentTarget && !isQuick) handleCellClick(day) }}
            >
              <span className="node-calendar-day">{day}</span>
              {nodes.map(n => (
                <button
                  key={n.id}
                  className={`node-calendar-event ${n.status === 'done' ? 'done' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${n.id}`) }}
                  title={n.text}
                >
                  {n.text?.slice(0, 20) || 'Sin título'}
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
    </div>
  )
}
