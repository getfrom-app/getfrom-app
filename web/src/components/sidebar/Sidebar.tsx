import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import type { Node } from '../../types'
import WebRecordingBar from './WebRecordingBar'
import {
  getShortcuts, saveShortcuts, removeShortcut,
  type WFShortcut,
} from '../../store/shortcutsStore'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
// (Google status ahora vive solo en Ajustes — eliminado del sidebar en v8.21)

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

type SidebarTab = 'tags' | 'favorites' | 'panels'

export default function Sidebar({ open, onToggle, onLogout, isSyncing, isGuest, onOpenSettings }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const us = useUserStore()

  // En modo WF, el tab de tags no existe — empezar en 'panels'
  const isWFMode = document.body.closest('.wf-layout') !== null ||
    document.querySelector('.wf-layout') !== null
  const [activeTab, setActiveTab] = useState<SidebarTab>(isWFMode ? 'panels' : 'tags')
  const [panels, setPanels] = useState<Panel[]>(getPanels)

  // ── Menú contextual de tags ─────────────────────────────────────────────
  const [tagMenu, setTagMenu] = useState<{ x: number; y: number; tagName: string } | null>(null)
  const [tagRenaming, setTagRenaming] = useState<{ tagName: string; value: string } | null>(null)
  const [tagColorPicker, setTagColorPicker] = useState<string | null>(null) // tagName

  const TAG_COLOR_OPTIONS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#64748b',
  ]

  function openTagMenu(e: React.MouseEvent, tagName: string) {
    e.preventDefault()
    e.stopPropagation()
    setTagMenu({ x: e.clientX, y: e.clientY, tagName })
    setTagRenaming(null)
    setTagColorPicker(null)
  }

  function closeTagMenu() { setTagMenu(null); setTagRenaming(null); setTagColorPicker(null) }

  function handleTagDelete(tagName: string) {
    if (!confirm(`¿Eliminar el tag #${tagName} de todos los nodos?`)) return
    store.deleteTag(tagName)
    closeTagMenu()
  }

  function handleTagRename(oldName: string, newName: string) {
    store.renameTag(oldName, newName.trim())
    closeTagMenu()
  }

  function handleTagColor(tagName: string, color: string | null) {
    store.setTagColor(tagName, color)
    closeTagMenu()
  }

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
    const defNode = s.getTagDefNode(node.name)
    const isActiveTag = defNode
      ? location.pathname === `/node/${defNode.id}`
      : location.pathname === `/tag/${node.name}`
    return (
      <div key={node.name}>
        <div
          className={`sidebar-tag-item ${isActiveTag ? 'active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => {
            // Navegar al nodo de definición del tag (con body/contexto)
            const defNode = s.getTagDefNode(node.name)
            if (defNode) {
              navigate(`/node/${defNode.id}`)
            } else {
              // Crear nodo de definición y navegar
              const newNode = store.createNode({ text: node.name, parentId: null })
              store.updateNode(newNode.id, { extraData: JSON.stringify({ _tagDefinition: node.name }) })
              navigate(`/node/${newNode.id}`)
            }
          }}
          onContextMenu={e => openTagMenu(e, node.name)}
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
        {/* Perfil IA — primera opción, siempre visible */}
        {(() => {
          const profile = s.perfilIANode()
          const hasContent = !!(profile?.body?.trim())
          const dot = hasContent ? '#22c55e' : '#f97316'
          const hint = hasContent ? undefined : 'Cuéntale a la IA quién eres: proyectos, preferencias, forma de trabajar.'
          return (
            <div style={{ marginBottom: 6 }}>
              <button
                className="tree-item"
                onClick={async () => {
                  const p = await store.getOrCreatePerfilIA()
                  navigate(`/node/${p.id}`)
                }}
                style={{ paddingLeft: 10, gap: 7 }}
                title="Perfil de IA — contexto personal para el asistente"
              >
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  background: dot, flexShrink: 0,
                }} />
                <span className="tree-item-name" style={{ fontWeight: 500 }}>Perfil de IA</span>
                {!hasContent && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>configurar →</span>
                )}
              </button>
              {hint && (
                <div style={{ padding: '2px 14px 4px 26px', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                  {hint}
                </div>
              )}
            </div>
          )
        })()}

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

  // ── Atajos unificados WF ────────────────────────────────────────────────────
  const [shortcuts, setShortcuts] = useState<WFShortcut[]>(getShortcuts)

  function refreshShortcuts() { setShortcuts(getShortcuts()) }

  // Escuchar evento global para refrescar cuando se añade/quita un atajo
  useEffect(() => {
    window.addEventListener('wf:shortcuts-changed', refreshShortcuts)
    return () => window.removeEventListener('wf:shortcuts-changed', refreshShortcuts)
  }, [])

  function handleRemoveShortcut(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = removeShortcut(id)
    setShortcuts(updated)
  }

  function renderShortcuts() {
    return (
      <div className="sidebar-tab-content wf-quick-access">
        <div className="wf-qa-section-header" style={{ padding: '8px 12px 4px' }}>
          <span className="wf-qa-section-label">Atajos</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }} title="Pulsa ⭐ en un nodo o filtro para añadirlo">⭐</span>
        </div>

        {shortcuts.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Pulsa ⭐ en cualquier nodo o filtro para fijarlo aquí
          </div>
        ) : (
          shortcuts.map(sc => {
            const isNodeActive = sc.type === 'node' && location.pathname === `/node/${sc.nodeId}`
            const isFilterActive = sc.type === 'filter' && location.search === `?q=${encodeURIComponent(sc.query || '')}` && location.pathname === '/search'
            const isActive = isNodeActive || isFilterActive
            const isDefault = sc.id === '__today_tasks__'

            // Icono según tipo
            const icon = sc.type === 'filter'
              ? (isDefault ? '📅' : '🔍')
              : (() => {
                  const node = sc.nodeId ? s.getNode(sc.nodeId) : undefined
                  return node ? getNodeIcon(node) : '📄'
                })()

            return (
              <div
                key={sc.id}
                className={`wf-qa-item${isActive ? ' active' : ''}`}
                onClick={() => {
                  if (sc.type === 'filter') navigate(`/search?q=${encodeURIComponent(sc.query || '')}`)
                  else if (sc.nodeId) navigate(`/node/${sc.nodeId}`)
                }}
                title={sc.type === 'filter' ? sc.query : sc.name}
              >
                <span className="wf-qa-item-icon">{icon}</span>
                <span className="wf-qa-item-name">{sc.name}</span>
                {!isDefault && (
                  <button
                    className="wf-qa-item-del"
                    onClick={e => handleRemoveShortcut(sc.id, e)}
                    title="Quitar atajo"
                  >×</button>
                )}
              </div>
            )
          })
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
          {/* Atajos unificados WF */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {renderShortcuts()}
          </div>

          {/* Recording bar */}
          <WebRecordingBar />

          {/* Footer nav - always visible */}
          <div className="sidebar-footer">
            <button
              className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => {
                // Busca o crea la nota de hoy bajo Agenda → Año → Mes → Día
                const dayNode = getTodayDiaryUnderAgenda()
                navigate(`/node/${dayNode.id}`)
              }}
              title="Hoy — ir a la nota del día"
            >
              <span className="nav-icon">📓</span>
              <span>Hoy</span>
            </button>
            <button
              className={`nav-item ${isActive('/calendar') ? 'active' : ''}`}
              onClick={() => navigate('/calendar')}
              title="Planificador"
            >
              <span className="nav-icon">📅</span>
              <span>Planificador</span>
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

      {/* Menú contextual de tags */}
      {tagMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={closeTagMenu}
            onContextMenu={e => { e.preventDefault(); closeTagMenu() }}
          />
          <div
            className="tag-context-menu"
            style={{ position: 'fixed', left: tagMenu.x, top: tagMenu.y, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="tag-context-menu-header">#{tagMenu.tagName}</div>

            {/* Renombrar */}
            {tagRenaming?.tagName === tagMenu.tagName ? (
              <div className="tag-context-menu-rename">
                <input
                  autoFocus
                  className="tag-context-menu-input"
                  value={tagRenaming.value}
                  onChange={e => setTagRenaming({ tagName: tagMenu.tagName, value: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleTagRename(tagMenu.tagName, tagRenaming.value)
                    if (e.key === 'Escape') setTagRenaming(null)
                  }}
                  placeholder="Nuevo nombre..."
                />
                <button className="tag-context-menu-confirm" onClick={() => handleTagRename(tagMenu.tagName, tagRenaming.value)}>✓</button>
              </div>
            ) : (
              <button className="tag-context-menu-item" onClick={() => setTagRenaming({ tagName: tagMenu.tagName, value: tagMenu.tagName })}>
                ✏️ Renombrar
              </button>
            )}

            {/* Color */}
            {tagColorPicker === tagMenu.tagName ? (
              <div className="tag-context-menu-colors">
                {TAG_COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    className="tag-color-swatch"
                    style={{ background: c, outline: s.tagColor(tagMenu.tagName) === c ? '2px solid var(--text-primary)' : 'none' }}
                    onClick={() => handleTagColor(tagMenu.tagName, c)}
                    title={c}
                  />
                ))}
                <button className="tag-color-swatch tag-color-swatch--reset" onClick={() => handleTagColor(tagMenu.tagName, null)} title="Restablecer">↺</button>
              </div>
            ) : (
              <button className="tag-context-menu-item" onClick={() => setTagColorPicker(tagMenu.tagName)}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.tagColor(tagMenu.tagName), marginRight: 6 }} />
                Color
              </button>
            )}

            <div className="tag-context-menu-divider" />
            <button className="tag-context-menu-item tag-context-menu-item--danger" onClick={() => handleTagDelete(tagMenu.tagName)}>
              🗑 Eliminar tag
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
