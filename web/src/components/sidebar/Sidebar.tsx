import { useState, useMemo, useCallback } from 'react'
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

function getNodeIcon(n: Node): string {
  if (n.isDiaryEntry) return '📓'
  if (n.isEvent) return '📅'
  if (n.status === 'done') return '✅'
  if (n.status === 'pending') return '○'
  if ((n.types || []).includes('bucle')) return '↺'
  if (n.isFavorite) return '★'
  return '📄'
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
  const { theme, setTheme, density, setDensity } = useTheme()

  const [activeTab, setActiveTab] = useState<SidebarTab>('tags')
  const [panels, setPanels] = useState<Panel[]>(getPanels)
  const [treeSearch, setTreeSearch] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('from_sidebar_collapsed') || '{}') } catch { return {} }
  })

  function toggleSection(key: string) {
    const next = { ...collapsedSections, [key]: !collapsedSections[key] }
    setCollapsedSections(next)
    localStorage.setItem('from_sidebar_collapsed', JSON.stringify(next))
  }

  const tags = s.tagDefinitions()
  const usedTags = s.allUsedTags()
  const pendingCount = s.pendingTasks().length
  const showUpgrade = isGuest || !us.isPremium

  const todayTasksCount = useMemo(() => {
    return s.pendingTasks().filter(n => {
      if (!n.due) return false
      const d = new Date(n.due)
      const today = new Date()
      return d.toDateString() === today.toDateString()
    }).length
  }, [s])

  const activeBuclesCount = useMemo(() => {
    return s.allActive().filter(n =>
      (n.types || []).includes('bucle') && n.status !== 'done' && !n.deletedAt
    ).length
  }, [s])

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
    // Combinar tag definitions (con nodo) + used tags (sólo en types[])
    const tagDefMap = new Map(tags.map(t => [tagName(t), t]))
    const allTagNames = Array.from(new Set([
      ...tags.map(t => tagName(t)).filter(Boolean) as string[],
      ...usedTags,
    ])).sort()

    return (
      <div className="sidebar-tab-content">
        {/* Tags section */}
        {allTagNames.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <div className="nav-section-label nav-section-label--clickable" onClick={() => toggleSection('tags')}>
              <span className="nav-section-chevron">{collapsedSections['tags'] ? '▸' : '▾'}</span>
              <span>Tags</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{allTagNames.length}</span>
            </div>
            {!collapsedSections['tags'] && allTagNames.map(name => {
              const defNode = tagDefMap.get(name)
              const color = s.tagColor(name)
              const count = s.tagNodeCount(name)
              return (
                <div
                  key={name}
                  className={`sidebar-tag-item ${defNode && isActive(`/node/${defNode.id}`) ? 'active' : ''}`}
                  onClick={() => defNode ? navigate(`/node/${defNode.id}`) : navigate(`/tag/${name}`)}
                  title={`#${name} · ${count} nodos`}
                >
                  <span style={{ color, fontSize: 12, fontWeight: 700, marginRight: 2 }}>#</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
                  <span className="sidebar-tag-count" style={{ background: color + '20', color }}>{count}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="tree-empty" style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Sin tags aún. Escribe #tag en cualquier nota.
          </div>
        )}

        {/* Áreas section */}
        {s.allAreas().length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="nav-section-label nav-section-label--clickable" onClick={() => toggleSection('areas')}>
              <span className="nav-section-chevron">{collapsedSections['areas'] ? '▸' : '▾'}</span>
              <span>Áreas</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{s.allAreas().length}</span>
            </div>
            {!collapsedSections['areas'] && (
              <div className="tree-section">
                {s.allAreas().map(area => (
                  <button
                    key={area}
                    className={`tree-item ${location.search.includes(`area:${encodeURIComponent(area)}`) ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}
                    onClick={() => navigate(`/search?q=${encodeURIComponent(`area:${area}`)}`)}
                  >
                    <span style={{ fontSize: 12 }}>📁</span>
                    <span style={{ flex: 1 }}>{area}</span>
                    <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: 8, padding: '1px 6px' }}>{s.nodesInArea(area).length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full notes tree */}
        {favorites.length > 0 && (
          <>
            <div className="nav-section-label nav-section-label--clickable" onClick={() => toggleSection('favorites')}>
              <span className="nav-section-chevron">{collapsedSections['favorites'] ? '▸' : '▾'}</span>
              <span>Favoritos</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{favorites.length}</span>
            </div>
            {!collapsedSections['favorites'] && (
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
            )}
          </>
        )}

        <div className="nav-section-label tree-section-header nav-section-label--clickable" onClick={() => toggleSection('notes')}>
          <span className="nav-section-chevron">{collapsedSections['notes'] ? '▸' : '▾'}</span>
          <span>Notas</span>
          <button
            className="tree-add-root"
            onClick={e => { e.stopPropagation(); handleCreateRoot() }}
            title="Nueva nota raíz"
          >
            +
          </button>
        </div>
        {/* Mini buscador de notas */}
        {!collapsedSections['notes'] && (
          <>
            <div className="sidebar-tree-search">
              <input
                type="text"
                className="sidebar-tree-search-input"
                placeholder="Filtrar notas..."
                value={treeSearch}
                onChange={e => setTreeSearch(e.target.value)}
              />
              {treeSearch && <button className="sidebar-tree-search-clear" onClick={() => setTreeSearch('')}>×</button>}
            </div>
            <div className="tree-section">
              {(treeSearch
                ? s.allActive().filter(n => !n.isDiaryEntry && !n.deletedAt && n.text.toLowerCase().includes(treeSearch.toLowerCase()))
                : regularNotes
              ).slice(0, 50).map(node => (
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

        {/* Stats widget */}
        <div className="sidebar-stats-widget">
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{regularNotes.length + favorites.length}</span>
            <span className="sidebar-stat-label">notas</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{pendingCount}</span>
            <span className="sidebar-stat-label">pendientes</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-value" style={{ color: '#3b82f6' }}>{todayTasksCount}</span>
            <span className="sidebar-stat-label" style={{ color: '#3b82f6' }}>hoy</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-value" style={{ color: '#8b5cf6' }}>{activeBuclesCount}</span>
            <span className="sidebar-stat-label" style={{ color: '#8b5cf6' }}>bucles</span>
          </div>
        </div>
      </div>
    )
  }

  const handleRemoveFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    store.updateNode(id, { isFavorite: false })
  }, [])

  function renderFavoritesTab() {
    // Recientes: últimas 8 notas visitadas desde localStorage
    const recentIds: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('from_recent_nodes') || '[]') as string[] } catch { return [] }
    })()
    const recentNodes = recentIds
      .map(id => store.getNode(id))
      .filter(Boolean)
      .map(n => n!)
      .filter(n => !n.deletedAt)
      .slice(0, 8)

    return (
      <div className="sidebar-tab-content">
        {allFavorites.length > 0 ? (
          <>
            <div className="nav-section-label">Fijados</div>
            <div className="tree-section">
              {allFavorites.map(node => (
                <div
                  key={node.id}
                  className={`tree-item ${location.pathname === `/node/${node.id}` ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', cursor: 'pointer' }}
                  onClick={() => navigate(`/node/${node.id}`)}
                  onContextMenu={e => {
                    e.preventDefault()
                    if (window.confirm(`¿Quitar "${node.text || 'Sin título'}" de favoritos?`)) {
                      handleRemoveFavorite(node.id, e)
                    }
                  }}
                  title="Click derecho → Quitar de favoritos"
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{getNodeIcon(node)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.text || 'Sin título'}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="tree-empty" style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Fija una nota con ☆ para verla aquí
          </div>
        )}

        {recentNodes.length > 0 && (
          <>
            <div className="nav-section-label" style={{ marginTop: 12 }}>Recientes</div>
            <div className="tree-section">
              {recentNodes.map(node => (
                <button
                  key={node.id}
                  className={`tree-item ${location.pathname === `/node/${node.id}` ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', textAlign: 'left' }}
                  onClick={() => navigate(`/node/${node.id}`)}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{getNodeIcon(node)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.text || 'Sin título'}
                  </span>
                </button>
              ))}
            </div>
          </>
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
    const SettingRow = ({ icon, label, onClick, badge }: { icon: string; label: string; onClick?: () => void; badge?: string }) => (
      <button
        className="settings-row"
        onClick={onClick}
      >
        <span className="settings-row-icon">{icon}</span>
        <span className="settings-row-label">{label}</span>
        {badge && <span className="settings-row-badge">{badge}</span>}
        {onClick && <span className="settings-row-arrow">›</span>}
      </button>
    )

    return (
      <div className="sidebar-tab-content">
        <div className="sidebar-settings">
          {/* Cuenta */}
          <div className="settings-section">
            <div className="settings-section-title">Cuenta</div>
            {email && (
              <div className="settings-email">{email}</div>
            )}
            <SettingRow icon="👤" label="Mi cuenta" onClick={() => navigate('/account')} />
            {showUpgrade && (
              <SettingRow icon="✨" label="Actualizar plan" onClick={() => navigate('/pricing')} badge="Free" />
            )}
          </div>

          {/* Apariencia */}
          <div className="settings-section">
            <div className="settings-section-title">Apariencia</div>
            <div className="settings-theme-row">
              <button
                className={`settings-theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >☀️ Claro</button>
              <button
                className={`settings-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >🌙 Oscuro</button>
            </div>
            <div className="settings-density-row">
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 8 }}>Densidad:</span>
              {(['compact', 'normal', 'comfortable'] as const).map(d => (
                <button
                  key={d}
                  className={`settings-theme-btn ${density === d ? 'active' : ''}`}
                  onClick={() => setDensity(d)}
                >
                  {d === 'compact' ? '— Compacto' : d === 'normal' ? '○ Normal' : '◎ Amplio'}
                </button>
              ))}
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="settings-section">
            <div className="settings-section-title">Tu vault</div>
            <div className="settings-stats-grid">
              <div className="settings-stat">
                <span className="settings-stat-value">{s.allActive().filter(n => !n.isDiaryEntry && !n.deletedAt).length}</span>
                <span className="settings-stat-label">Notas</span>
              </div>
              <div className="settings-stat">
                <span className="settings-stat-value">{s.allActive().filter(n => n.status === 'pending').length}</span>
                <span className="settings-stat-label">Pendientes</span>
              </div>
              <div className="settings-stat">
                <span className="settings-stat-value">{s.allUsedTags().length}</span>
                <span className="settings-stat-label">Tags</span>
              </div>
              <div className="settings-stat">
                <span className="settings-stat-value">{s.allActive().filter(n => n.isFavorite).length}</span>
                <span className="settings-stat-label">Fijadas</span>
              </div>
            </div>
          </div>

          {/* Integraciones */}
          <div className="settings-section">
            <div className="settings-section-title">Integraciones</div>
            <SettingRow icon="🤖" label="Claude (MCP)" onClick={() => window.open('https://getfrom.app/claude', '_blank')} />
            <SettingRow icon="📅" label="Google Calendar" onClick={() => navigate('/account')} />
            <SettingRow icon="📤" label="Exportar datos" onClick={() => navigate('/account')} />
            <SettingRow icon="🗑" label="Papelera" onClick={() => navigate('/trash')} />
          </div>

          {/* Ayuda */}
          <div className="settings-section">
            <div className="settings-section-title">Ayuda</div>
            <SettingRow icon="📖" label="Manual de uso" onClick={() => window.open('https://getfrom.app/docs/', '_blank')} />
            <SettingRow icon="⌨" label="Atajos de teclado" onClick={() => {
              const event = new KeyboardEvent('keydown', { key: '?', bubbles: true })
              window.dispatchEvent(event)
            }} />
            <SettingRow icon="💬" label="Soporte" onClick={() => window.open('mailto:hello@getfrom.app', '_blank')} />
          </div>

          {/* Sesión */}
          <div className="settings-section">
            <SettingRow icon="🚪" label="Cerrar sesión" onClick={onLogout} />
          </div>

          <div style={{ paddingTop: 8, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            From Web · {new Date().getFullYear()}
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
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">From</span>
              {s.workspaces[0]?.name && s.workspaces[0].name !== 'Mi espacio' && (
                <span className="sidebar-workspace-name">{s.workspaces[0].name}</span>
              )}
            </div>
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
              className={`nav-item ${isActive('/followup') ? 'active' : ''}`}
              onClick={() => navigate('/followup')}
              title="Seguimiento"
            >
              <span className="nav-icon">↺</span>
              <span>Seguimiento</span>
              {activeBuclesCount > 0 && (
                <span className="nav-badge">{activeBuclesCount}</span>
              )}
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
            <button
              className={`nav-item ${isActive('/chat') ? 'active' : ''}`}
              onClick={() => navigate('/chat')}
              title="Chat IA (⌘J)"
            >
              <span className="nav-icon">✦</span>
              <span>Chat IA</span>
            </button>
            <button
              className={`nav-item ${isActive('/inbox') ? 'active' : ''}`}
              onClick={() => navigate('/inbox')}
              title="Inbox"
            >
              <span className="nav-icon">📥</span>
              <span>Inbox</span>
            </button>
            <button
              className={`nav-item ${isActive('/files') ? 'active' : ''}`}
              onClick={() => navigate('/files')}
              title="Archivos"
            >
              <span className="nav-icon">📎</span>
              <span>Archivos</span>
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
              className={`nav-item ${isActive('/followup') ? 'active' : ''}`}
              onClick={() => navigate('/followup')}
              title="Seguimiento"
            >
              <span className="nav-icon">↺</span>
              {activeBuclesCount > 0 && (
                <span className="nav-badge nav-badge--collapsed">{activeBuclesCount}</span>
              )}
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
            <button
              className={`nav-item ${isActive('/chat') ? 'active' : ''}`}
              onClick={() => navigate('/chat')}
              title="Chat IA"
            >
              <span className="nav-icon">✦</span>
            </button>
            <button
              className={`nav-item ${isActive('/inbox') ? 'active' : ''}`}
              onClick={() => navigate('/inbox')}
              title="Inbox"
            >
              <span className="nav-icon">📥</span>
            </button>
            <button
              className={`nav-item ${isActive('/files') ? 'active' : ''}`}
              onClick={() => navigate('/files')}
              title="Archivos"
            >
              <span className="nav-icon">📎</span>
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
