import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useStore } from '../../store/nodeStore'

interface Props {
  onNewNote: () => void
  onCommandPalette: () => void
  onNewTask: () => void
  onNewEvent: () => void
  onVoiceCapture?: () => void
}

const VIEW_LABELS: Record<string, string> = {
  '/': 'Hoy',
  '/tasks': 'Tareas',
  '/search': 'Buscar',
  '/calendar': 'Calendario',
  '/kanban': 'Kanban',
  '/agents': 'Agentes',
  '/account': 'Cuenta',
}

function getHourIcon() {
  const h = new Date().getHours()
  return h >= 21 || h < 7 ? '🌙' : '☀️'
}

function getTodayLabel() {
  return new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function TopBar({ onNewNote, onCommandPalette, onNewTask, onNewEvent, onVoiceCapture }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const s = useStore()
  const totalNodes = s.allActive().filter(n => !n.isDiaryEntry && !n.deletedAt).length
  const pendingTasks = s.pendingTasks().length
  const path = location.pathname.replace(/^\/app/, '') || '/'
  const isHome = path === '/' || path === ''

  function goHome() {
    navigate('/')
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="top-bar">
      {/* Home pill (ESC / fecha) */}
      <button
        className="top-bar-home-pill"
        onClick={goHome}
        title="Ir a hoy (Esc)"
      >
        <span className="top-bar-home-icon">{getHourIcon()}</span>
        <span className="top-bar-shortcut">ESC</span>
        <span className="top-bar-dot">·</span>
        <span className="top-bar-date">{getTodayLabel()}</span>
      </button>

      {/* Current view label */}
      {!isHome && (
        <span className="top-bar-view-label">
          {VIEW_LABELS[path] ?? ''}
        </span>
      )}

      {/* Stats rápidos */}
      <div className="top-bar-stats">
        <span title={`${totalNodes} notas totales`}>{totalNodes} notas</span>
        {pendingTasks > 0 && (
          <span className="top-bar-stats-pending" title={`${pendingTasks} tareas pendientes`}>
            · {pendingTasks} ✓
          </span>
        )}
      </div>

      <div className="top-bar-spacer" />

      {/* Quick action buttons */}
      <div className="top-bar-actions">
        <button
          className="top-bar-action"
          onClick={onCommandPalette}
          title="Buscar y capturar (⌘K)"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <span className="top-bar-shortcut-hint">⌘K</span>
        </button>

        <button
          className="top-bar-action"
          onClick={onNewNote}
          title="Nueva nota (⌘N)"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span className="top-bar-shortcut-hint">⌘N</span>
        </button>

        <button
          className="top-bar-action"
          onClick={onNewTask}
          title="Nueva tarea (⌘T)"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="top-bar-shortcut-hint">⌘T</span>
        </button>

        <button
          className="top-bar-action"
          onClick={onNewEvent}
          title="Nuevo evento (⌘E)"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          <span className="top-bar-shortcut-hint">⌘E</span>
        </button>

        {onVoiceCapture && (
          <button
            className="top-bar-action"
            onClick={onVoiceCapture}
            title="Captura de voz (⌘R)"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            <span className="top-bar-shortcut-hint">⌘R</span>
          </button>
        )}

        {/* Theme toggle */}
        <button
          className="top-bar-action"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro (⌘⇧S para sidebar)' : 'Cambiar a modo oscuro (⌘⇧S para sidebar)'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  )
}
