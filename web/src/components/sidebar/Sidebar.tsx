import React, { useState, useCallback, useEffect } from 'react'
import { useRecordingStore } from '../../store/recordingStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import type { Node } from '../../types'
import WebRecordingBar from './WebRecordingBar'
import { getAtajosNode, getShortcutData } from '../../utils/atajosHelper'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
// (Google status ahora vive solo en Ajustes — eliminado del sidebar en v8.21)

interface Props {
  open: boolean
  onToggle: () => void
  onLogout: () => void
  isSyncing: boolean
  showSaved?: boolean
  isGuest?: boolean
  onOpenSettings?: () => void
  onSelectContext?: (nodeId: string) => void
  selectedContextId?: string | null
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

export default function Sidebar({ open, onToggle, onLogout, isSyncing, showSaved, isGuest, onOpenSettings, onSelectContext, selectedContextId }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const s = useStore()
  const us = useUserStore()

  const [activeTab, setActiveTab] = useState<SidebarTab>('panels')
  const recording = useRecordingStore()
  const isRecording = recording.phase === 'recording'
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
            title={t('sidebar.sortLabel')}
            onClick={() => setShowFavControls(v => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="6" y1="12" x2="10" y2="12"/>
            </svg>
          </button>
          <button
            className={`fav-ctrl-btn ${favGroup !== 'none' ? 'active' : ''}`}
            title={t('sidebar.groupLabel')}
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
              <span className="fav-ctrl-label">{t('sidebar.sortLabel')}</span>
              {([['manual', t('sidebar.sortManual')], ['alpha', t('sidebar.sortAlpha')], ['date', t('sidebar.sortRecent')]] as [typeof favSort, string][]).map(([v, l]) => (
                <button key={v} className={`fav-ctrl-opt ${favSort === v ? 'active' : ''}`} onClick={() => setFavSortP(v)}>{l}</button>
              ))}
            </div>
            <div className="fav-ctrl-section">
              <span className="fav-ctrl-label">{t('sidebar.groupLabel')}</span>
              {([['none', t('sidebar.groupNone')], ['tag', t('sidebar.groupTag')], ['type', t('sidebar.groupType')]] as [typeof favGroup, string][]).map(([v, l]) => (
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
                    if (window.confirm(`¿Quitar "${node.text || t('common.noTitle')}" de favoritos?`)) {
                      handleRemoveFavorite(node.id, e)
                    }
                  }}
                  title={t('sidebar.removeFavoriteHint')}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{getNodeIcon(node)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.text || t('common.noTitle')}
                  </span>
                </div>
              ))}
            </div>
              </div>
            ))}
          </>
        ) : (
          <div className="tree-empty" style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {t('sidebar.emptyFavorites')}
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
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('sidebar.panelsHeader')}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }} title={t('sidebar.createPanelsFromCmd')}>⌘K</span>
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
              {isDefault ? (
                <span style={{ fontSize: 13, flexShrink: 0 }}>📅</span>
              ) : (
                <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, opacity:0.7}}>
                  <rect x="0.75" y="0.75" width="11.5" height="9.5" rx="1.5"/>
                  <line x1="0.75" y1="3.5" x2="12.25" y2="3.5"/>
                </svg>
              )}
              <span style={{ flex: 1, fontSize: 13 }}>{panel.name}</span>
              {!isDefault && (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
                  onClick={e => { e.stopPropagation(); handleDeletePanel(panel.id) }}
                  title={t('sidebar.deletePanel')}
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

  const [hoveredAtajoId, setHoveredAtajoId] = useState<string | null>(null)

  function getSortedSiblings(parentId: string | null) {
    return s.children(parentId).filter(n => !n.deletedAt).sort((a, b) => a.siblingOrder - b.siblingOrder)
  }
  function moveAtajoUp(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const node = s.getNode(nodeId); if (!node) return
    const sibs = getSortedSiblings(node.parentId ?? null)
    const idx = sibs.findIndex(n => n.id === nodeId); if (idx <= 0) return
    const prev = sibs[idx - 1]
    const tmp = prev.siblingOrder
    store.updateNode(nodeId, { siblingOrder: tmp - 0.5 })
  }
  function moveAtajoDown(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const node = s.getNode(nodeId); if (!node) return
    const sibs = getSortedSiblings(node.parentId ?? null)
    const idx = sibs.findIndex(n => n.id === nodeId); if (idx < 0 || idx >= sibs.length - 1) return
    const next = sibs[idx + 1]
    store.updateNode(nodeId, { siblingOrder: next.siblingOrder + 0.5 })
  }
  function indentAtajo(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const node = s.getNode(nodeId); if (!node) return
    const sibs = getSortedSiblings(node.parentId ?? null)
    const idx = sibs.findIndex(n => n.id === nodeId); if (idx <= 0) return
    const prev = sibs[idx - 1]
    const prevKids = s.children(prev.id).filter(n => !n.deletedAt)
    const maxOrder = prevKids.length > 0 ? Math.max(...prevKids.map(c => c.siblingOrder)) : 0
    store.updateNode(nodeId, { parentId: prev.id, siblingOrder: maxOrder + 1000 })
  }
  function dedentAtajo(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const node = s.getNode(nodeId); if (!node || !node.parentId) return
    const parent = s.getNode(node.parentId); if (!parent) return
    store.updateNode(nodeId, { parentId: parent.parentId ?? null, siblingOrder: parent.siblingOrder + 0.5 })
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
      icon = '__panel_svg__'
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

    const isHovered = hoveredAtajoId === nodeId
    const siblings = getSortedSiblings(s.getNode(nodeId)?.parentId ?? null)
    const idx = siblings.findIndex(n => n.id === nodeId)
    const canUp = idx > 0
    const canDown = idx < siblings.length - 1
    const canIndent = idx > 0
    const canDedent = !!(s.getNode(nodeId)?.parentId)

    return (
      <div key={nodeId}>
        <div
          className={`wf-qa-item${isActiveNode ? ' active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={handleClick}
          title={scData?.query !== undefined ? `Filtrar: ${scData.query}` : node.text || ''}
          onMouseEnter={() => setHoveredAtajoId(nodeId)}
          onMouseLeave={() => setHoveredAtajoId(null)}
          onContextMenu={e => {
            e.preventDefault()
            setRenamingAtajoId(nodeId)
            setRenamingAtajoText(node.text || '')
            setTimeout(() => {
              const input = document.querySelector(`[data-rename-atajo="${nodeId}"]`) as HTMLInputElement
              if (input) { input.select(); input.focus() }
            }, 20)
          }}
        >
          <span className="wf-qa-item-icon">
            {icon === '__panel_svg__' ? (
              <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, opacity:0.7}}>
                <rect x="0.75" y="0.75" width="11.5" height="9.5" rx="1.5"/>
                <line x1="0.75" y1="3.5" x2="12.25" y2="3.5"/>
              </svg>
            ) : icon}
          </span>
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
            <span className="wf-qa-item-name">{node.text || t('common.noTitle')}</span>
          )}
          {/* Botones de organización — visibles al hover */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, opacity: isHovered ? 1 : 0, transition: 'opacity 0.1s', flexShrink: 0 }}>
            {canDedent && (
              <button className="wf-qa-item-org" onClick={e => dedentAtajo(nodeId, e)} title="Quitar sangría (Shift+Tab)">⇤</button>
            )}
            {canIndent && (
              <button className="wf-qa-item-org" onClick={e => indentAtajo(nodeId, e)} title="Añadir sangría (Tab)">⇥</button>
            )}
            {canUp && (
              <button className="wf-qa-item-org" onClick={e => moveAtajoUp(nodeId, e)} title="Subir">↑</button>
            )}
            {canDown && (
              <button className="wf-qa-item-org" onClick={e => moveAtajoDown(nodeId, e)} title="Bajar">↓</button>
            )}
            <button className="wf-qa-item-del" onClick={e => handleDeleteAtajoNode(nodeId, e)} title={t('sidebar.removeShortcut')}>×</button>
          </div>
        </div>
        {hasChildren && !isCollapsed && (
          <div>
            {children.map(child => renderAtajoNode(child.id, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const [expandedCtxIds, setExpandedCtxIds] = useState<Set<string>>(new Set())
  function toggleCtxExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedCtxIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function renderCtxNode(nodeId: string, depth: number): React.ReactNode {
    const node = s.getNode(nodeId)
    if (!node || node.deletedAt) return null
    // Solo mostrar hijos que tienen contenido propio (no texto plano hoja)
    const kids = s.children(nodeId)
      .filter(n => !n.deletedAt && s.children(n.id).filter(k => !k.deletedAt).length > 0)
    const isActive = selectedContextId === nodeId
    const expanded = expandedCtxIds.has(nodeId)
    return (
      <div key={nodeId}>
        <div
          className={`wf-qa-item${isActive ? ' active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={() => onSelectContext?.(nodeId)}
        >
          {kids.length > 0 ? (
            <span
              style={{ marginRight: 4, fontSize: 10, cursor: 'pointer', opacity: 0.5, display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', userSelect: 'none' }}
              onClick={e => toggleCtxExpand(nodeId, e)}
            >›</span>
          ) : (
            <span style={{ marginRight: 4, width: 14, display: 'inline-block' }} />
          )}
          <span className="wf-qa-item-name">{node.text || t('common.noTitle')}</span>
        </div>
        {kids.length > 0 && expanded && (
          <div>{kids.map(k => renderCtxNode(k.id, depth + 1))}</div>
        )}
      </div>
    )
  }

  function renderContextos() {
    const contextoRoot = s.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
    if (!contextoRoot) return null
    const contextos = s.children(contextoRoot.id).filter(n => !n.deletedAt)
    if (contextos.length === 0) return null
    return (
      <div className="sidebar-tab-content wf-quick-access" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="wf-qa-section-header" style={{ padding: '8px 12px 4px' }}>
          <span className="wf-qa-section-label">CONTEXTOS</span>
        </div>
        {contextos.map(c => renderCtxNode(c.id, 0))}
      </div>
    )
  }

  function renderShortcuts() {
    const atajosNode = getAtajosNode()
    const atajosChildren = atajosNode ? s.children(atajosNode.id).filter(n => !n.deletedAt) : []

    return (
      <div className="sidebar-tab-content wf-quick-access">
        <div className="wf-qa-section-header" style={{ padding: '8px 12px 4px' }}>
          <span className="wf-qa-section-label">{t('sidebar.panelsHeader')}</span>
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
            <SettingRow icon="👤" label={t('sidebar.myAccount')} onClick={() => goSettings('cuenta')} />
            {showUpgrade && (
              <SettingRow icon="✨" label={t('sidebar.upgradeToPro')} onClick={() => navigate('/pricing')} badge="Free" />
            )}
          </div>

          {/* Integraciones */}
          <div className="settings-section">
            <div className="settings-section-title">{t('sidebar.integrations')}</div>
            <SettingRow icon="🤖" label={t('sidebar.claudeMCP')} onClick={() => goSettings('claude')} />
            <SettingRow icon="📅" label={t('sidebar.googleCalendar')} onClick={() => goSettings('google')} />
            <SettingRow icon="📤" label={t('sidebar.exportData')} onClick={() => goSettings('exportar')} />
            <SettingRow icon="🗑" label={t('sidebar.trash')} onClick={() => navigate('/trash')} />
          </div>

          {/* Ajustes */}
          <div className="settings-section">
            <div className="settings-section-title">{t('sidebar.settings')}</div>
            <SettingRow icon="🎨" label={t('sidebar.appearance')} onClick={() => goSettings('apariencia')} />
            <SettingRow icon="📊" label={t('sidebar.statistics')} onClick={() => goSettings('estadisticas')} />
          </div>

          {/* Ayuda */}
          <div className="settings-section">
            <div className="settings-section-title">Ayuda</div>
            <SettingRow icon="📖" label={t('sidebar.userManual')} onClick={() => window.open('https://getfrom.app/docs/', '_blank')} />
            <SettingRow icon="⌨" label={t('sidebar.keyboardShortcuts')} onClick={() => {
              const event = new KeyboardEvent('keydown', { key: '?', bubbles: true })
              window.dispatchEvent(event)
            }} />
            <SettingRow icon="💬" label={t('sidebar.support')} onClick={() => window.open('mailto:hola@getfrom.app', '_blank')} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <aside className={`sidebar ${open ? 'open' : 'closed'}`}>
      {open ? (
        <>
          {/* Atajos unificados WF — se encoge cuando graba */}
          <div style={{
            flex: isRecording ? '0 0 50%' : 1,
            overflowY: 'auto',
            minHeight: 0,
            transition: 'flex 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}>
            {renderShortcuts()}
            {renderContextos()}
          </div>

          {/* Recording bar — se expande a la mitad al grabar */}
          <div style={{
            flex: isRecording ? '0 0 50%' : '0 0 auto',
            minHeight: 0,
            overflow: 'hidden',
            transition: 'flex 0.35s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <WebRecordingBar expanded={isRecording} />
          </div>

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
          title={t('sidebar.collapseSidebar')}
        />
      )}
    </aside>
  )
}
