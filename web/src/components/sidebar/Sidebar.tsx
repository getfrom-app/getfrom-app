import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import type { Node } from '../../types'
import WebRecordingBar from './WebRecordingBar'
import { getGoogleStatus } from '../../api/googleCalendar'

// ── Tag hierarchy helpers ───────────────────────────────────────────────────

interface TagTreeNode {
  name: string          // full tag name e.g. "la-isla/alumnos"
  segment: string       // last segment e.g. "alumnos"
  count: number         // node count for this exact tag
  children: TagTreeNode[]
}

function buildTagTree(
  tagNames: string[],
  counts: (name: string) => number
): TagTreeNode[] {
  const roots: TagTreeNode[] = []
  for (const full of tagNames) {
    const parts = full.split('/').filter(Boolean)
    if (parts.length === 0) continue
    let siblings = roots
    let cumulative = ''
    parts.forEach((seg, i) => {
      cumulative = i === 0 ? seg : `${cumulative}/${seg}`
      let node = siblings.find(s => s.segment === seg)
      if (!node) {
        node = { name: cumulative, segment: seg, count: 0, children: [] }
        siblings.push(node)
      }
      if (i === parts.length - 1) node.count = counts(full)
      siblings = node.children
    })
  }
  function sortRec(nodes: TagTreeNode[]) {
    nodes.sort((a, b) => a.segment.localeCompare(b.segment))
    nodes.forEach(n => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

interface Props {
  open: boolean
  onToggle: () => void
  onLogout: () => void
  isSyncing: boolean
  isGuest?: boolean
  onOpenSettings?: () => void
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

type SidebarTab = 'tags' | 'favorites' | 'panels'

export default function Sidebar({ open, onToggle, onLogout, isSyncing, isGuest, onOpenSettings }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const us = useUserStore()

  const [activeTab, setActiveTab] = useState<SidebarTab>('tags')
  const [panels, setPanels] = useState<Panel[]>(getPanels)

  // Refresca paneles cuando CommandPalette crea uno nuevo
  useEffect(() => {
    function onPanelsUpdated() { setPanels(getPanels()) }
    window.addEventListener('panels-updated', onPanelsUpdated)
    return () => window.removeEventListener('panels-updated', onPanelsUpdated)
  }, [])
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('from_sidebar_collapsed') || '{}') } catch { return {} }
  })
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('from_tags_collapsed') || '{}') } catch { return {} }
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

  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)
  useEffect(() => {
    getGoogleStatus()
      .then(s => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false))
  }, [])

  // Favorites tab: all nodes with isFavorite === true
  const allFavorites = s.allActive().filter(n => n.isFavorite && !n.deletedAt)

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function tagName(node: Node) {
    return s.tagName(node) || node.text
  }

  function handleDeletePanel(id: string) {
    const updated = panels.filter(p => p.id !== id)
    setPanels(updated)
    savePanels(updated)
  }

  // ── Tab content ────────────────────────────────────────────────────────

  // Tag collapse state (persisted)
  function getCollapsedTags(): Record<string, boolean> {
    try { return JSON.parse(localStorage.getItem('from_tags_collapsed') || '{}') } catch { return {} }
  }
  function toggleTagCollapsed(name: string) {
    const next = { ...collapsedTags, [name]: !collapsedTags[name] }
    setCollapsedTags(next)
    localStorage.setItem('from_tags_collapsed', JSON.stringify(next))
  }

  function renderTagTreeNode(node: TagTreeNode, depth: number) {
    const color = s.tagColor(node.name)
    const hasChildren = node.children.length > 0
    const isCollapsed = !!collapsedTags[node.name]
    const isActiveTag = location.pathname === `/tag/${node.name}`
    return (
      <div key={node.name}>
        <div
          className={`sidebar-tag-item ${isActiveTag ? 'active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => navigate(`/tag/${node.name}`)}
          title={`#${node.name} · ${node.count} nodos`}
        >
          {hasChildren ? (
            <button
              className="sidebar-tag-chevron"
              onClick={e => { e.stopPropagation(); toggleTagCollapsed(node.name) }}
              tabIndex={-1}
              aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}
            >
              <svg width="9" height="9" viewBox="0 0 10 10"
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <span className="sidebar-tag-chevron" style={{ visibility: 'hidden' }} />
          )}
          <span style={{ color, fontSize: 12, fontWeight: 700, marginRight: 2 }}>#</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{node.segment}</span>
          {/* count eliminado: era ruidoso visualmente */}
        </div>
        {hasChildren && !isCollapsed && node.children.map(c => renderTagTreeNode(c, depth + 1))}
      </div>
    )
  }

  function renderTagsTab() {
    const allTagNames = Array.from(new Set([
      ...tags.map(t => tagName(t)).filter(Boolean) as string[],
      ...usedTags,
    ])).sort()
    const tree = buildTagTree(allTagNames, name => s.tagNodeCount(name))

    return (
      <div className="sidebar-tab-content">
        {/* Proyectos activos - antes de tags */}
        {(() => {
          const projects = s.allActive()
            .filter(n => !n.deletedAt && (n.types || []).includes('proyecto') && n.status !== 'done')
            .slice(0, 5)
          if (projects.length === 0) return null
          return (
            <div style={{ marginBottom: 8 }}>
              <div className="nav-section-label nav-section-label--clickable" onClick={() => navigate(`/search?q=tag:proyecto`)}>
                <span>Proyectos</span>
                <span className="tree-item-count">{projects.length}</span>
              </div>
              <div className="tree-section">
                {projects.map(p => (
                  <button key={p.id} className="tree-item" onClick={() => navigate(`/node/${p.id}`)}>
                    <span className="tree-item-icon">🚀</span>
                    <span className="tree-item-name">{p.text || 'Sin título'}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Tags section — hierarchical */}
        {allTagNames.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <div className="nav-section-label nav-section-label--clickable" onClick={() => toggleSection('tags')}>
              <span className="nav-section-chevron">{collapsedSections['tags'] ? '▸' : '▾'}</span>
              <span>Tags</span>
            </div>
            {!collapsedSections['tags'] && tree.map(t => renderTagTreeNode(t, 0))}
          </div>
        ) : (
          <div className="tree-empty" style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Sin tags aún. Escribe #tag en cualquier nota.
          </div>
        )}

      </div>
    )
  }

  const handleRemoveFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    store.updateNode(id, { isFavorite: false })
  }, [])

  function renderFavoritesTab() {
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
      </div>
    )
  }

  const DEFAULT_PANEL: Panel = {
    id: '__today_tasks__',
    name: 'Tareas de hoy',
    query: 'fecha:hoy tipo:tarea',
    createdAt: '',
  }

  function renderPanelsTab() {
    const allPanels = [DEFAULT_PANEL, ...panels]
    return (
      <div className="sidebar-tab-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 8px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paneles</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }} title="Crea paneles desde ⌘K">⌘K</span>
        </div>
        {allPanels.map(panel => {
          const isDefault = panel.id === '__today_tasks__'
          const isActivePath = location.search === `?q=${encodeURIComponent(panel.query)}` && location.pathname === '/search'
          return (
            <div
              key={panel.id}
              className={`sidebar-panel-item${isActivePath ? ' active' : ''}`}
              onClick={() => navigate(`/search?q=${encodeURIComponent(panel.query)}`)}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>{isDefault ? '📅' : '🔍'}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{panel.name}</span>
              {!isDefault && (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
                  onClick={e => { e.stopPropagation(); handleDeletePanel(panel.id) }}
                  title="Eliminar panel"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
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

    const goSettings = (tab?: string) => {
      const url = tab ? `/settings?tab=${tab}` : '/settings'
      onOpenSettings ? navigate(url) : navigate(url)
    }

    return (
      <div className="sidebar-tab-content">
        <div className="sidebar-settings">
          {/* Mi cuenta — sin email ni header */}
          <div className="settings-section">
            <SettingRow icon="👤" label="Mi cuenta" onClick={() => goSettings('cuenta')} />
            {showUpgrade && (
              <SettingRow icon="✨" label="Actualizar a Pro" onClick={() => navigate('/pricing')} badge="Free" />
            )}
          </div>

          {/* Integraciones */}
          <div className="settings-section">
            <div className="settings-section-title">Integraciones</div>
            <SettingRow icon="🤖" label="Claude (MCP)" onClick={() => goSettings('claude')} />
            <SettingRow icon="📅" label="Google Calendar" onClick={() => goSettings('google')} />
            <SettingRow icon="📤" label="Exportar datos" onClick={() => goSettings('exportar')} />
            <SettingRow icon="🗑" label="Papelera" onClick={() => navigate('/trash')} />
          </div>

          {/* Ajustes */}
          <div className="settings-section">
            <div className="settings-section-title">Ajustes</div>
            <SettingRow icon="🎨" label="Apariencia" onClick={() => goSettings('apariencia')} />
            <SettingRow icon="📊" label="Estadísticas" onClick={() => goSettings('estadisticas')} />
          </div>

          {/* Ayuda */}
          <div className="settings-section">
            <div className="settings-section-title">Ayuda</div>
            <SettingRow icon="📖" label="Manual de uso" onClick={() => window.open('https://getfrom.app/docs/', '_blank')} />
            <SettingRow icon="⌨" label="Atajos de teclado" onClick={() => {
              const event = new KeyboardEvent('keydown', { key: '?', bubbles: true })
              window.dispatchEvent(event)
            }} />
            <SettingRow icon="💬" label="Soporte" onClick={() => window.open('mailto:hola@getfrom.app', '_blank')} />
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
          <button
            className="sidebar-brand"
            onClick={() => navigate('/')}
            title="Ir al diario de hoy"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
          >
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
          </button>
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
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {activeTab === 'tags' && renderTagsTab()}
            {activeTab === 'favorites' && renderFavoritesTab()}
            {activeTab === 'panels' && renderPanelsTab()}
          </div>

          {/* Recording bar */}
          <WebRecordingBar />

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
              className={`nav-item ${isActive('/calendar') ? 'active' : ''}`}
              onClick={() => navigate('/calendar')}
              title="Calendario"
            >
              <span className="nav-icon">📅</span>
              <span>Calendario</span>
            </button>
            <button
              className={`nav-item ${isActive('/trash') ? 'active' : ''}`}
              onClick={() => navigate('/trash')}
              title="Papelera"
            >
              <span className="nav-icon">🗑</span>
              <span>Papelera</span>
            </button>
            <button
              className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => navigate('/settings')}
              title="Ajustes"
            >
              <span className="nav-icon">⚙</span>
              <span>Ajustes</span>
            </button>
            <button
              className="nav-item"
              onClick={() => navigate('/settings?section=google')}
              title={googleConnected ? 'Google conectado' : 'Google desconectado — click para conectar'}
              style={{ position: 'relative' }}
            >
              <span className="nav-icon" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>G</span>
              <span>Google</span>
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 7, height: 7, borderRadius: '50%',
                background: googleConnected === null ? 'var(--text-tertiary)' : googleConnected ? '#22c55e' : '#ef4444',
                border: '1.5px solid var(--bg-primary)',
              }} />
            </button>
            {!isGuest ? (
              <button className="nav-item" onClick={onLogout} title="Cerrar sesión">
                <span className="nav-icon">↩</span>
                <span>Salir</span>
              </button>
            ) : (
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
              title="Hoy"
            >
              <span className="nav-icon">📓</span>
            </button>
            <button
              className={`nav-item ${isActive('/tasks') ? 'active' : ''}`}
              onClick={() => navigate('/tasks')}
              title="Tareas"
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
              title="Calendario"
            >
              <span className="nav-icon">📅</span>
            </button>
            <button
              className={`nav-item ${isActive('/trash') ? 'active' : ''}`}
              onClick={() => navigate('/trash')}
              title="Papelera"
            >
              <span className="nav-icon">🗑</span>
            </button>
          </nav>
          <div className="sidebar-footer">
            <button
              className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => navigate('/settings')}
              title="Ajustes"
            >
              <span className="nav-icon">⚙</span>
            </button>
            <button
              className="nav-item"
              onClick={() => navigate('/settings?section=google')}
              title={googleConnected ? 'Google conectado' : 'Google desconectado'}
              style={{ position: 'relative' }}
            >
              <span className="nav-icon" style={{ fontSize: 13, fontWeight: 600 }}>G</span>
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 7, height: 7, borderRadius: '50%',
                background: googleConnected ? '#22c55e' : '#ef4444',
                border: '1.5px solid var(--bg-primary)',
              }} />
            </button>
            <button className="nav-item" onClick={onLogout} title="Cerrar sesión">
              <span className="nav-icon">↩</span>
            </button>
          </div>
        </>
      )}
      {/* Left-edge collapse zone: click the outer-left edge to collapse */}
      {open && (
        <div
          className="sidebar-left-edge-zone"
          onClick={onToggle}
          title="Colapsar sidebar"
        />
      )}
    </aside>
  )
}
