import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import type { Node } from '../../types'

interface Props {
  open: boolean
  onToggle: () => void
  onLogout: () => void
  isSyncing: boolean
  isGuest?: boolean
}

export default function Sidebar({ open, onToggle, onLogout, isSyncing, isGuest }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const us = useUserStore()

  const tags = s.tagDefinitions()
  const pendingCount = s.pendingTasks().length
  const showUpgrade = isGuest || !us.isPremium

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function tagName(node: Node) {
    return s.tagName(node) || node.text
  }

  return (
    <aside className={`sidebar ${open ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button className="sidebar-toggle" onClick={onToggle} title="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="2" y="11.5" width="12" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
        </button>
        {open && (
          <div className="sidebar-brand">
            <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="22" fill="#8b5cf6"/>
              <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">F</text>
            </svg>
            <span>From</span>
          </div>
        )}
        {open && isSyncing && <div className="sync-dot" title="Sincronizando..." />}
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <span className="nav-icon">📓</span>
          {open && <span>Hoy</span>}
        </button>

        <button
          className={`nav-item ${isActive('/tasks') ? 'active' : ''}`}
          onClick={() => navigate('/tasks')}
        >
          <span className="nav-icon">✓</span>
          {open && <span>Tareas{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>}
        </button>

        <button
          className={`nav-item ${isActive('/search') ? 'active' : ''}`}
          onClick={() => navigate('/search')}
        >
          <span className="nav-icon">🔍</span>
          {open && <span>Buscar</span>}
        </button>

        {open && tags.length > 0 && (
          <>
            <div className="nav-section-label">Áreas</div>
            {tags.map(tag => (
              <button
                key={tag.id}
                className={`nav-item ${isActive(`/node/${tag.id}`) ? 'active' : ''}`}
                onClick={() => navigate(`/node/${tag.id}`)}
              >
                <span className="nav-icon">🏷</span>
                <span>{tagName(tag)}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {showUpgrade && (
          <button
            className={`nav-item nav-item--upgrade ${isActive('/pricing') ? 'active' : ''}`}
            onClick={() => navigate('/pricing')}
            title="Actualizar plan"
          >
            <span className="nav-icon">✨</span>
            {open && <span>Actualizar plan</span>}
          </button>
        )}
        {!isGuest && (
          <button
            className={`nav-item ${isActive('/account') ? 'active' : ''}`}
            onClick={() => navigate('/account')}
            title="Ajustes"
          >
            <span className="nav-icon">⚙</span>
            {open && <span>Ajustes</span>}
          </button>
        )}
        <button className="nav-item" onClick={onLogout} title={isGuest ? 'Iniciar sesión' : 'Cerrar sesión'}>
          <span className="nav-icon">↩</span>
          {open && <span>{isGuest ? 'Iniciar sesión' : 'Salir'}</span>}
        </button>
      </div>
    </aside>
  )
}
