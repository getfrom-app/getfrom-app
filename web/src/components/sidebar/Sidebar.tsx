import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { useTheme } from '../../hooks/useTheme'
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

interface Panel {
  id: string
  name: string
  query: string
  createdAt: string
}

function getPanels(): Panel[] {
  try {
    return JSON.parse(localStorage.getItem('from_panels') || '[]')
  } catch { return [] }
}

function savePanels(panels: Panel[]) {
  localStorage.setItem('from_panels', JSON.stringify(panels))
}

type SidebarTab = 'tags' | 'favorites' | 'panels' | 'settings'

export default function Sidebar({ open, onToggle, onLogout, isSyncing, isGuest }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const us = useUserStore()
  const { theme, setTheme } = useTheme()

  const [activeTab, setActiveTab] = useState<SidebarTab>('tags')
  const [panels, setPanels] = useState<Panel[]>(getPanels)

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

  // Favorites tab: all nodes with isFavorite === true
  const allFavorites = s.allActive().filter(n => n.isFavorite && !n.deletedAt)

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function tagName(node: Node) {
    return s.tagName(node) || node.text
  }

  function tagChildCount(tagNode: Node) {
    return s.allActive().filter(n => {
      const types = n.types || []
      const name = s.tagName(tagNode) || tagNode.text
      return types.includes(name || '')
    }).length
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

  function handleCreatePanel() {
    const name = prompt('Nombre del panel:')
    if (!name) return
    const query = prompt('Búsqueda (query):')
    if (query === null) return
    const newPanel: Panel = {
      id: Date.now().toString(),
      name,
      query,
      createdAt: new Date().toISOString(),
    }
    const updated = [...panels, newPanel]
    setPanels(updated)
    savePanels(updated)
  }

  function handleDeletePanel(id: string) {
    const updated = panels.filter(p => p.id !== id)
    setPanels(updated)
    savePanels(updated)
  }

  // ── Tab content ────────────────────────────────────────────────────────

  function renderTagsTab() {
    return (
      <div className="sidebar-tab-content">
        {/* Tags section */}
        {tags.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            {tags.map(tag => (
              <div
                key={tag.id}
                className={`sidebar-tag-item ${isActive(`/node/${tag.id}`) ? 'active' : ''}`}
                onClick={() => navigate(`/node/${tag.id}`)}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>#</span>
                <span style={{ flex: 1, fontSize: 13 }}>{tagName(tag)}</span>
                <span className="sidebar-tag-count">{tagChildCount(tag)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tree-empty" style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Sin áreas. Crea un tag en From para Mac.
          </div>
        )}

        {/* Full notes tree */}
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
      </div>
    )
  }

  function renderFavoritesTab() {
    return (
      <div className="sidebar-tab-content">
        {allFavorites.length > 0 ? (
          <div className="tree-section">
            {allFavorites.map(node => (
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
        ) : (
          <div className="tree-empty" style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Marca una nota como favorita con ☆
          </div>
        )}
      </div>
    )
  }

  function renderPanelsTab() {
    return (
      <div className="sidebar-tab-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 8px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paneles</span>
          <button className="sidebar-panel-create-btn" onClick={handleCreatePanel} title="Nuevo panel">+</button>
        </div>
        {panels.length > 0 ? (
          panels.map(panel => (
            <div
              key={panel.id}
              className="sidebar-panel-item"
              onClick={() => navigate(`/search?q=${encodeURIComponent(panel.query)}`)}
            >
              <span style={{ flex: 1, fontSize: 13 }}>{panel.name}</span>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
                onClick={e => { e.stopPropagation(); handleDeletePanel(panel.id) }}
                title="Eliminar panel"
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="tree-empty" style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            No hay paneles. Guarda una búsqueda como panel.
          </div>
        )}
      </div>
    )
  }

  function renderSettingsTab() {
    const email = us.user?.email
    return (
      <div className="sidebar-tab-content">
        <div className="sidebar-settings">
          {email && (
            <div className="sidebar-settings-user">{email}</div>
          )}

          <div className="sidebar-settings-section">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Apariencia</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: theme === 'light' ? 'var(--accent)' : 'var(--bg)', color: theme === 'light' ? '#fff' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                onClick={() => setTheme('light')}
              >
                ☀ Claro
              </button>
              <button
                style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: theme === 'dark' ? 'var(--accent)' : 'var(--bg)', color: theme === 'dark' ? '#fff' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                onClick={() => setTheme('dark')}
              >
                🌙 Oscuro
              </button>
            </div>
          </div>

          <div className="sidebar-settings-section">
            <button
              className="nav-item"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 4px', borderRadius: 'var(--radius)' }}
              onClick={() => navigate('/account')}
            >
              <span className="nav-icon">⚙</span>
              <span>Ajustes completos</span>
            </button>
            {showUpgrade && (
              <button
                className="nav-item"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 4px', borderRadius: 'var(--radius)' }}
                onClick={() => navigate('/pricing')}
              >
                <span className="nav-icon">✨</span>
                <span>Precios y plan</span>
              </button>
            )}
            <button
              className="nav-item"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 4px', borderRadius: 'var(--radius)' }}
              onClick={() => window.open('https://getfrom.app/claude', '_blank')}
            >
              <span className="nav-icon">🤖</span>
              <span>Extensión Claude</span>
            </button>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
            From Web 1.0
          </div>
        </div>
      </div>
    )
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

      {open ? (
        <>
          {/* Tab bar */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab-btn ${activeTab === 'tags' ? 'active' : ''}`}
              onClick={() => setActiveTab('tags')}
              title="Tags y notas"
            >
              🏷
            </button>
            <button
              className={`sidebar-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
              title="Fijados"
            >
              ⭐
            </button>
            <button
              className={`sidebar-tab-btn ${activeTab === 'panels' ? 'active' : ''}`}
              onClick={() => setActiveTab('panels')}
              title="Paneles"
            >
              📋
            </button>
            <button
              className={`sidebar-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              title="Ajustes"
            >
              ⚙
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {activeTab === 'tags' && renderTagsTab()}
            {activeTab === 'favorites' && renderFavoritesTab()}
            {activeTab === 'panels' && renderPanelsTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </div>

          {/* Footer nav - always visible */}
          <div className="sidebar-footer">
            <button
              className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => navigate('/')}
              title="Hoy"
            >
              <span className="nav-icon">📓</span>
              <span>Hoy</span>
            </button>
            <button
              className={`nav-item ${isActive('/tasks') ? 'active' : ''}`}
              onClick={() => navigate('/tasks')}
              title="Tareas"
            >
              <span className="nav-icon">✓</span>
              <span>Tareas{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
            </button>
            <button
              className={`nav-item ${isActive('/search') ? 'active' : ''}`}
              onClick={() => navigate('/search')}
              title="Buscar"
            >
              <span className="nav-icon">🔍</span>
              <span>Buscar</span>
            </button>
            <button
              className={`nav-item ${isActive('/calendar') ? 'active' : ''}`}
              onClick={() => navigate('/calendar')}
              title="Calendario"
            >
              <span className="nav-icon">📅</span>
              <span>Calendario</span>
            </button>
            {!isGuest && (
              <button className="nav-item" onClick={onLogout} title="Cerrar sesión">
                <span className="nav-icon">↩</span>
                <span>Salir</span>
              </button>
            )}
            {isGuest && (
              <button className="nav-item" onClick={onLogout} title="Iniciar sesión">
                <span className="nav-icon">↩</span>
                <span>Iniciar sesión</span>
              </button>
            )}
          </div>
        </>
      ) : (
        /* Collapsed sidebar: just nav icons */
        <>
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              <span className="nav-icon">📓</span>
            </button>
            <button
              className={`nav-item ${isActive('/tasks') ? 'active' : ''}`}
              onClick={() => navigate('/tasks')}
            >
              <span className="nav-icon">✓</span>
            </button>
            <button
              className={`nav-item ${isActive('/calendar') ? 'active' : ''}`}
              onClick={() => navigate('/calendar')}
            >
              <span className="nav-icon">📅</span>
            </button>
            <button
              className={`nav-item ${isActive('/search') ? 'active' : ''}`}
              onClick={() => navigate('/search')}
            >
              <span className="nav-icon">🔍</span>
            </button>
          </nav>
          <div className="sidebar-footer">
            <button className="nav-item" onClick={onLogout}>
              <span className="nav-icon">↩</span>
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
