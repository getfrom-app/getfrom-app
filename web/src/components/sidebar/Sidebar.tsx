import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import type { Node } from '../../types'

interface Props {
  open: boolean
  onToggle: () => void
  onLogout: () => void
  isSyncing: boolean
  isGuest?: boolean
}

interface TreeNodeProps {
  node: Node
  depth: number
  activePath: string
  onNavigate: (id: string) => void
  onCreateChild: (parentId: string) => void
}

function TreeNodeItem({ node, depth, activePath, onNavigate, onCreateChild }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const children = store.children(node.id).filter(n => !n.deletedAt && !n.isDiaryEntry)
  const hasChildren = children.length > 0
  const isActive = activePath === `/node/${node.id}` || activePath.startsWith(`/node/${node.id}/`)

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand toggle */}
        <button
          className={`tree-node-toggle ${hasChildren ? '' : 'invisible'}`}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          tabIndex={-1}
        >
          <svg
            width="10" height="10" viewBox="0 0 10 10"
            style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
          >
            <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Node label */}
        <button
          className="tree-node-label"
          onClick={() => onNavigate(node.id)}
        >
          <span className="tree-node-text">
            {node.isFavorite && <span className="tree-node-star">★</span>}
            {node.text || 'Sin título'}
          </span>
        </button>

        {/* Add child button */}
        {hovered && (
          <button
            className="tree-node-add"
            onClick={e => { e.stopPropagation(); onCreateChild(node.id) }}
            title="Añadir hijo"
            tabIndex={-1}
          >
            +
          </button>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="tree-node-children">
          {children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onNavigate={onNavigate}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ open, onToggle, onLogout, isSyncing, isGuest }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const us = useUserStore()

  const tags = s.tagDefinitions()
  const pendingCount = s.pendingTasks().length
  const showUpgrade = isGuest || !us.isPremium

  // Get root notes (parentId === null, not diary, not tag definitions)
  const allNodes = s.allActive().filter(n => !n.isDiaryEntry && !n.deletedAt)
  const rootNotes = allNodes
    .filter(n => n.parentId === null)
    .filter(n => {
      // Skip tag definitions from the general tree
      try {
        const ed = JSON.parse(n.extraData || '{}')
        return !ed._tagDefinition
      } catch { return true }
    })
    .sort((a, b) => a.siblingOrder - b.siblingOrder)

  const favorites = rootNotes.filter(n => n.isFavorite)
  const regularNotes = rootNotes.filter(n => !n.isFavorite)

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function tagName(node: Node) {
    return s.tagName(node) || node.text
  }

  function handleCreateRoot() {
    const newNode = store.createNode({ text: '', parentId: null })
    navigate(`/node/${newNode.id}`)
  }

  function handleNavigate(id: string) {
    navigate(`/node/${id}`)
  }

  function handleCreateChild(parentId: string) {
    const newNode = store.createNode({ text: '', parentId })
    navigate(`/node/${newNode.id}`)
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

        {/* Tree navigation */}
        {open && (
          <>
            {/* Favorites section */}
            {favorites.length > 0 && (
              <>
                <div className="nav-section-label">Favoritos</div>
                <div className="tree-section">
                  {favorites.map(node => (
                    <TreeNodeItem
                      key={node.id}
                      node={node}
                      depth={0}
                      activePath={location.pathname}
                      onNavigate={handleNavigate}
                      onCreateChild={handleCreateChild}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Notes section */}
            <div className="nav-section-label tree-section-header">
              <span>Notas</span>
              <button
                className="tree-add-root"
                onClick={handleCreateRoot}
                title="Nueva nota raíz"
              >
                +
              </button>
            </div>
            <div className="tree-section">
              {regularNotes.slice(0, 50).map(node => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  activePath={location.pathname}
                  onNavigate={handleNavigate}
                  onCreateChild={handleCreateChild}
                />
              ))}
              {regularNotes.length === 0 && (
                <div className="tree-empty">
                  Sin notas. Crea una con +
                </div>
              )}
            </div>
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
