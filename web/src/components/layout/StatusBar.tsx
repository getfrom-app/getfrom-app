import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'

interface StatusBarProps {
  isSyncing: boolean
}

export default function StatusBar({ isSyncing }: StatusBarProps) {
  const s = useStore()
  const navigate = useNavigate()

  const totalNotes = s.allActive().length

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const tasksDueToday = s.allActive().filter(n => {
    if (n.status !== 'pending' || !n.due) return false
    const due = new Date(n.due)
    return due >= today && due < tomorrow
  }).length

  return (
    <div className="status-bar">
      <span>{totalNotes} notas</span>
      {tasksDueToday > 0 ? (
        <button
          className="status-bar-link"
          onClick={() => navigate('/tasks')}
        >
          {tasksDueToday} {tasksDueToday === 1 ? 'tarea' : 'tareas'} para hoy
        </button>
      ) : (
        <span>Sin tareas para hoy</span>
      )}
      <span className="status-bar-sync">
        {isSyncing ? '↻ Sincronizando...' : '✓ Sincronizado'}
      </span>
    </div>
  )
}
