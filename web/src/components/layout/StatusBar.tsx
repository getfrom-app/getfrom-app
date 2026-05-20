import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'

interface StatusBarProps {
  isSyncing: boolean
}

export default function StatusBar({ isSyncing }: StatusBarProps) {
  const s = useStore()
  const navigate = useNavigate()

  const allActive = s.allActive()
  const totalNotes = allActive.filter(n => !n.isDiaryEntry && !n.deletedAt).length
  const activeBucles = allActive.filter(n => (n.types || []).includes('bucle') && n.status !== 'done').length

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const tasksDueToday = allActive.filter(n => {
    if (n.status !== 'pending' || !n.due) return false
    const due = new Date(n.due)
    return due >= today && due < tomorrow
  }).length

  const overdueCount = allActive.filter(n => {
    if (n.status !== 'pending' || !n.due) return false
    return new Date(n.due) < today
  }).length

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
      {activeBucles > 0 && (
        <button className="status-bar-link" onClick={() => navigate('/followup')} style={{ color: 'var(--accent)' }}>
          ↺ {activeBucles} bucles
        </button>
      )}
      <span className="status-bar-sync">
        {isSyncing ? '↻ Sincronizando...' : '✓ Guardado'}
      </span>
    </div>
  )
}
