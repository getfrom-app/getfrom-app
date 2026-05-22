import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'

// Versión del build web — incrementar en cada deploy significativo
export const WEB_VERSION = 'v7.3'

interface StatusBarProps {
  isSyncing: boolean
}

export default function StatusBar({ isSyncing }: StatusBarProps) {
  const s = useStore()
  const navigate = useNavigate()
  const location = useLocation()

  const allActive = s.allActive()
  const totalNotes = allActive.filter(n => !n.isDiaryEntry && !n.deletedAt).length
  const activeSeguimiento = allActive.filter(n => n.isSeguimiento && !n.deletedAt).length

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const tasksDueToday = allActive.filter(n => {
    if (n.status !== 'pending' || !n.due) return false
    const due = new Date(n.due)
    return due >= today && due < tomorrow
  }).length

  // Use store helper for overdue
  const overdueCount = s.overdueTasks().length

  // Context-specific extra info
  const path = location.pathname.replace(/^\/app/, '') || '/'

  const getContextInfo = () => {
    if (path.startsWith('/node/')) {
      const nodeId = path.split('/node/')[1]
      const node = s.getNode(nodeId)
      if (node?.body) {
        const words = node.body.trim().split(/\s+/).length
        const readTime = Math.max(1, Math.round(words / 200))
        return <span style={{ opacity: 0.5 }}>{words} palabras · {readTime} min lectura</span>
      }
    }
    if (path === '/tasks') {
      const total = allActive.filter(n => n.status !== null).length
      const done = allActive.filter(n => n.status === 'done').length
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      return <span style={{ opacity: 0.5 }}>{done}/{total} tareas · {pct}%</span>
    }
    if (path === '/search') {
      const usedTags = s.allUsedTags()
      return <span style={{ opacity: 0.5 }}>{usedTags.length} tags activos</span>
    }
    return null
  }

  return (
    <div className="status-bar">
      <span title={`${totalNotes} notas en tu vault`}>{totalNotes} notas</span>
      {overdueCount > 0 && (
        <button className="status-bar-link status-bar-link--danger" onClick={() => navigate('/tasks')}>
          ⚠ {overdueCount} vencidas
        </button>
      )}
      {tasksDueToday > 0 ? (
        <button className="status-bar-link" onClick={() => navigate('/tasks')}>
          {tasksDueToday} {tasksDueToday === 1 ? 'tarea' : 'tareas'} hoy
        </button>
      ) : overdueCount === 0 ? (
        <span style={{ opacity: 0.5 }}>Sin tareas hoy</span>
      ) : null}
      {activeSeguimiento > 0 && (
        <button className="status-bar-link" onClick={() => navigate('/followup')} style={{ color: 'var(--accent)' }}>
          👁 {activeSeguimiento} seguimiento
        </button>
      )}
      {getContextInfo()}
      <span className="status-bar-sync">
        {isSyncing ? '↻ Sincronizando...' : '✓ Guardado'}
      </span>
      <span className="status-bar-version" title="Versión">
        {WEB_VERSION}
      </span>
    </div>
  )
}
