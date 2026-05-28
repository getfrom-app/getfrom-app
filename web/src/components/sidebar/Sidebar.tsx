import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import type { Node } from '../../types'
import WebRecordingBar from './WebRecordingBar'
import { getAtajosNode, getShortcutData } from '../../utils/atajosHelper'
// (Google status ahora vive solo en Ajustes — eliminado del sidebar en v8.21)

interface Props {
  open: boolean
  onToggle: () => void
  onLogout: () => void
  isSyncing: boolean
  showSaved?: boolean
  isGuest?: boolean
  onOpenSettings?: () => void
}

function getNodeIcon(n: Node): string {
  if (n.isDiaryEntry) return '📓'
  if (n.isEvent) return '📅'
  if (n.status === 'done') return '✅'
  if (n.status === 'pending') return '○'
  if ((n.types || []).includes('bucle')) return '↺'
  if (n.isFavorite) return '📌'
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

type SidebarTab = 'favorites' | 'panels'

export default function Sidebar({ open, onToggle, onLogout, isSyncing, showSaved, isGuest, onOpenSettings }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const us = useUserStore()

  const [activeTab, setActiveTab] = useState<SidebarTab>('panels')
  const [panels, setPanels] = useState<Panel[]>(getPanels)

  // Refresca paneles cuando CommandPalette crea uno nuevo
  useEffect(() => {
    function onPanelsUpdated() { setPanels(getPanels()) }
    window.addEventListener('panels-updated', onPanelsUpdated)
    return () => window.removeEventListener('panels-updated', onPanelsUpdated)
  }, [])

  const showUpgrade = isGuest || !us.isPremium

  // Favorites tab: all nodes with isFavorite === true
  const allFavorites = s.allActive().filter(n => n.isFavorite && !n.deletedAt)

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function handleDeletePanel(id: string) {
    const updated = panels.filter(p => p.id !== id)
    setPanels(updated)
    savePanels(updated)
  }

  // ── Tab content ────────────────────────────────────────────────────────

  const handleRemoveFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    store.updateNode(id, { isFavorite: false })
  }, [])

  const [favSort, setFavSort] = useState<'manual' | 'alpha' | 'date'>(() => {
    return (localStorage.getItem('from_fav_sort') as 'manual' | 'alpha' | 'date') || 'manual'
  })
  const [favGroup, setFavGroup] = useState<'none' | 'tag' | 'type'>(() => {
    return (localStorage.getItem('from_fav_group') as 'none' | 'tag' | 'type') || 'none'
  })
  const [showFavControls, setShowFavControls] = useState(false)

  function setFavSortP(v: 'manual' | 'alpha' | 'date') {
    setFavSort(v); localStorage.setItem('from_fav_sort', v)
  }
  function setFavGroupP(v: 'none' | 'tag' | 'type') {
    setFavGroup(v); localStorage.setItem('from_fav_group', v)
  }

  function getSortedFavorites(list: Node[]) {
    const sorted = [...list]
    if (favSort === 'alpha') sorted.sort((a, b) => (a.text || '').localeCompare(b.text || ''))
    else if (favSort === 'date') sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return sorted
  }

  function getGroupedFavorites(list: Node[]): { label: string; items: Node[] }[] {
    if (favGroup === 'none') return [{ label: '', items: getSortedFavorites(list) }]
    if (favGroup === 'tag') {
      const groups: Record<string, Node[]> = {}
      for (const n of getSortedFavorites(list)) {
        const userTags = (n.types || []).filter(t => !['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'].includes(t))
        const key = userTags[0] || '(sin tag)'
        if (!groups[key]) groups[key] = []
        groups[key].push(n)
      }
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => ({ label, items }))
    }
    if (favGroup === 'type') {
      const groups: Record<string, Node[]> = {}
      for (const n of getSortedFavorites(list)) {
        const key = n.status !== null ? 'Tareas' : n.isEvent ? 'Eventos' : n.isDiaryEntry ? 'Diario' : 'Notas'
        if (!groups[key]) groups[key] = []
        groups[key].push(n)
      }
      const order = ['Tareas', 'Eventos', 'Notas', 'Diario']
      return order.filter(k => groups[k]).map(label => ({ label, items: groups[label] }))
    }
    return [{ label: '', items: list }]
  }

  function renderFavoritesTab() {
    const groups = getGroupedFavorites(allFavorites)
    return (
      <div className="sidebar-tab-content">
        {/* Controles sort / group */}
        <div className="fav-controls-bar">
          <button
            className={`fav-ctrl-btn ${favSort !== 'manual' ? 'active' : ''}`}
            title="Ordenar"
            onClick={() => setShowFavControls(v => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="6" y1="12" x2="10" y2="12"/>
            </svg>
          </button>
          <button
            className={`fav-ctrl-btn ${favGroup !== 'none' ? 'active' : ''}`}
            title="Agrupar"
            onClick={() => setShowFavControls(v => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
              <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
            </svg>
          </button>
        </div>
        {showFavControls && (
          <div className="fav-controls-panel">
            <div className="fav-ctrl-section">
              <span className="fav-ctrl-label">Ordenar</span>
              {([['manual', 'Manual'], ['alpha', 'A–Z'], ['date', 'Recientes']] as [typeof favSort, string][]).map(([v, l]) => (
                <button key={v} className={`fav-ctrl-opt ${favSort === v ? 'active' : ''}`} onClick={() => setFavSortP(v)}>{l}</button>
              ))}
            </div>
            <div className="fav-ctrl-section">
              <span className="fav-ctrl-label">Agrupar</span>
              {([['none', 'Ninguno'], ['tag', 'Tag'], ['type', 'Tipo']] as [typeof favGroup, string][]).map(([v, l]) => (
                <button key={v} className={`fav-ctrl-opt ${favGroup === v ? 'active' : ''}`} onClick={() => setFavGroupP(v)}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {allFavorites.length > 0 ? (
          <>
            {groups.map(({ label, items }) => (
              <div key={label || '__all__'}>
                {label && <div className="nav-section-label" style={{ paddingTop: 4, paddingBottom: 2, fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>{label}</div>}
            <div className="tree-section">
              {items.map(node => (
                <div
                  key={node.id}
                  className={`tree-item ${location.pathname === `/node/${node.id}` ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', cursor: 'pointer' }}
                  onClick={() => navigate(`/node/${node.id}`)}
                  onDragOver={e => {
                    const types = Array.from(e.dataTransfer.types)
                    if (!types.includes('cal-node-id') && !types.includes('text/plain')) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    e.currentTarget.classList.add('tree-item--drop')
                  }}
                  onDragLeave={e => e.currentTarget.classList.remove('tree-item--drop')}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('tree-item--drop')
                    const draggedId = e.dataTransfer.getData('cal-node-id') || e.dataTransfer.getData('text/plain')
                    if (!draggedId || draggedId === node.id) return
                    const sibs = store.children(node.id)
                    const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(x => x.siblingOrder)) : 0
                    store.updateNode(draggedId, { parentId: node.id, siblingOrder: lastOrder + 1 })
                  }}
                  onContextMenu={e => {
                    e.preventDefault()
                    if (window.confirm(`¿Quitar "${node.text || 'Sin título'}" de favoritos?`)) {
                      handleRemoveFavorite(node.id, e)
                    }
                  }}
                  title="Click derecho → Quitar de favoritos · Arrastra una tarea aquí para moverla dentro"
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{getNodeIcon(node)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.text || 'Sin título'}
                  </span>
                </div>
              ))}
            </div>
              </div>
            ))}
          </>
        ) : (
          <div className="tree-empty" style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Fija una nota con 📌 para verla aquí
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

  // ── Atajos unificados WF (tree-based, desde nodeStore) ─────────────────────
  // Collapsed state para nodos de atajos con hijos (carpetas)
  const [atajosCollapsed, setAtajosCollapsed] = useState<Record<string, boolean>>({})
  // Estado de renombrado inline para atajos
  const [renamingAtajoId, setRenamingAtajoId] = useState<string | null>(null)
  const [renamingAtajoText, setRenamingAtajoText] = useState('')

  function toggleAtajosCollapsed(nodeId: string) {
    setAtajosCollapsed(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))
  }

  function handleDeleteAtajoNode(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    store.deleteNode(nodeId)
    window.dispatchEvent(new Event('wf:shortcuts-changed'))
  }

  function renderAtajoNode(nodeId: string, depth: number = 0): React.ReactNode {
    const node = s.getNode(nodeId)
    if (!node || node.deletedAt) return null
    const scData = getShortcutData(nodeId)
    const children = s.children(nodeId).filter(n => !n.deletedAt)
    const hasChildren = children.length > 0
    const isCollapsed = atajosCollapsed[nodeId]

    // Determine icon
    let icon = '📄'
    if (scData?.nodeId) {
      // Node shortcut (may also have a combined query): show target node's icon
      const targetNode = s.getNode(scData.nodeId)
      icon = targetNode ? getNodeIcon(targetNode) : '📄'
    } else if (scData?.query !== undefined) {
      icon = '🔍'
    } else if (hasChildren) {
      icon = isCollapsed ? '▸' : '▾'
    }

    // Is active?
    let isActiveNode = false
    if (scData?.query !== undefined) {
      isActiveNode = (location.pathname === '/' || location.pathname === '') &&
        (window as any).__wfFilterText === (scData.query || '')
    } else if (scData?.nodeId) {
      isActiveNode = location.pathname === `/node/${scData.nodeId}`
    }

    function handleClick() {
      if (hasChildren && !scData) {
        toggleAtajosCollapsed(nodeId)
        return
      }
      if (scData?.query !== undefined) {
        window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: scData.query || '' } }))
      } else if (scData?.nodeId) {
        navigate(`/node/${scData.nodeId}`)
      } else if (hasChildren) {
        toggleAtajosCollapsed(nodeId)
      }
    }

    function commitRename() {
      if (renamingAtajoId === nodeId && renamingAtajoText.trim()) {
        store.updateNode(nodeId, { text: renamingAtajoText.trim() })
      }
      setRenamingAtajoId(null)
    }

    return (
      <div key={nodeId}>
        <div
          className={`wf-qa-item${isActiveNode ? ' active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={handleClick}
          title={scData?.query !== undefined ? `Filtrar: ${scData.query}` : node.text || ''}
          onContextMenu={e => {
            e.preventDefault()
            setRenamingAtajoId(nodeId)
            setRenamingAtajoText(node.text || '')
            // Pequeño timeout para que el input aparezca y pueda hacer focus
            setTimeout(() => {
              const input = document.querySelector(`[data-rename-atajo="${nodeId}"]`) as HTMLInputElement
              if (input) { input.select(); input.focus() }
            }, 20)
          }}
        >
          <span className="wf-qa-item-icon">{icon}</span>
          {renamingAtajoId === nodeId ? (
            <input
              data-rename-atajo={nodeId}
              className="wf-qa-item-rename-input"
              value={renamingAtajoText}
              onChange={e => setRenamingAtajoText(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                if (e.key === 'Escape') setRenamingAtajoId(null)
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="wf-qa-item-name">{node.text || 'Sin título'}</span>
          )}
          <button
            className="wf-qa-item-del"
            onClick={e => handleDeleteAtajoNode(nodeId, e)}
            title="Quitar atajo"
          >×</button>
        </div>
        {hasChildren && !isCollapsed && (
          <div>
            {children.map(child => renderAtajoNode(child.id, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  function renderShortcuts() {
    const atajosNode = getAtajosNode()
    const atajosChildren = atajosNode ? s.children(atajosNode.id).filter(n => !n.deletedAt) : []

    return (
      <div className="sidebar-tab-content wf-quick-access">
        <div className="wf-qa-section-header" style={{ padding: '8px 12px 4px' }}>
          <span className="wf-qa-section-label">Atajos</span>
          {atajosNode && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: '0 2px', opacity: 0.6 }}
              onClick={() => navigate(`/node/${atajosNode.id}`)}
              title="Organizar atajos — abrir 📌 Atajos"
            >✎</button>
          )}
        </div>

        {atajosChildren.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Pulsa 🔖 en cualquier filtro o ⭐ en un nodo para fijarlo aquí
          </div>
        ) : (
          atajosChildren.map(child => renderAtajoNode(child.id, 0))
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
      {open ? (
        <>
          {/* Atajos unificados WF */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {renderShortcuts()}
          </div>

          {/* Recording bar */}
          <WebRecordingBar />

          {/* Footer global — movido al nivel raíz de MainLayout */}
        </>
      ) : (
        /* Collapsed sidebar: solo línea visual, el toggle está en el WFTopBar */
        null
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
