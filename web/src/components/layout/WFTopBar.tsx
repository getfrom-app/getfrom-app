/**
 * WFTopBar — Top bar estilo Workflowy
 * 🏠 › Padre › Nodo actual   ···
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useTheme } from '../../hooks/useTheme'
import { useState, useRef, useEffect, useMemo } from 'react'
import { ensureDayPath } from '../../utils/agendaHelper'
import { getAgentesNode } from '../../utils/agentesHelper'
import { getPapeleraNode } from '../../utils/papeleraHelper'
import { findRootByKey } from '../../utils/rootLookup'
import { useTranslation } from 'react-i18next'

interface Props {
  onFilter: (text: string) => void
  filterText: string
  onLogout: () => void
  onOpenSettings: () => void
  onTogglePlanner?: () => void
  plannerOpen?: boolean
  onToggleSearch: () => void
  onToggleMagic?: () => void
  onToggleContextList?: () => void
  onTogglePromptList?: () => void
  onToggleAgentList?: () => void
  onToggleRecorder?: () => void
  rightPanel?: string | null
}

export default function WFTopBar({
  onFilter,
  filterText,
  onLogout,
  onOpenSettings,
  onTogglePlanner,
  plannerOpen,
  onToggleSearch,
  onToggleMagic,
  onToggleContextList,
  onTogglePromptList,
  onToggleAgentList,
  onToggleRecorder,
  rightPanel,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Nodos sistema — para navegación desde el menú.
  // Lookup robusto al reparent bajo 🏠 From (id determinista, no por children(null)).
  // `s = useStore()` re-renderiza ante cualquier cambio del árbol → sigue reactivo.
  const papeleraNode = getPapeleraNode()
  const agentesNode  = getAgentesNode()
  const plantillasNode = findRootByKey('plantillas', '📋 Plantillas', 'Plantillas')

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const path = location.pathname.replace(/^\/app/, '') || '/'
  const isNodeView = path.startsWith('/node/')
  const nodeId = isNodeView ? path.split('/node/')[1] : null

  const { ancestors, current } = useMemo(() => {
    if (!nodeId) return { ancestors: [], current: null }
    // Build path walking UP from current node
    const fullPath: Array<{ label: string; id: string }> = []
    let cur = s.getNode(nodeId)
    const visited = new Set<string>()
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id)
      fullPath.unshift({ label: cur.text || t('common.noTitle'), id: cur.id })
      if (!cur.parentId) break
      cur = s.getNode(cur.parentId) ?? undefined
    }
    // fullPath = [root, ..., parent, current]
    // Ocultar la raíz 🏠 From del breadcrumb (es el home, representado por el icono 🏠).
    // Agenda sí se muestra ahora (es una raíz visible más).
    const HIDDEN = new Set(['🏠 From'])
    const visible = fullPath.filter(n => !HIDDEN.has(n.label))
    const current = visible[visible.length - 1] ?? null
    const ancestors = visible.slice(0, -1)
    return { ancestors, current }
  }, [nodeId, s]) // eslint-disable-line react-hooks/exhaustive-deps

  // Truncate long labels for display
  const truncate = (label: string, max = 22) =>
    label.length > max ? label.slice(0, max) + '…' : label

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Keyboard shortcuts — Cmd+F gestionado por MainLayout ─────────────────

  function goHome() { navigate('/') }

  return (
    <div className="wf-topbar-root">
    <div className="wf-topbar">

      {/* ── Nav: back + forward ── */}
      <div className="wf-topbar-nav">
        <button className="wf-topbar-btn" onClick={() => window.history.back()} title="Atrás (⌘[)">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button className="wf-topbar-btn" onClick={() => window.history.forward()} title="Adelante (⌘])">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Breadcrumb integrado con casa ── */}
      <div className="wf-topbar-breadcrumb">
        {/* Casa — siempre visible, lleva al raíz */}
        <button className="wf-topbar-crumb-home" onClick={goHome} title="Inicio">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>

        {/* Ancestros clickables */}
        {ancestors.map(a => (
          <span key={a.id} className="wf-topbar-crumb-segment">
            <span className="wf-topbar-crumb-sep">›</span>
            <button
              className="wf-topbar-crumb-btn"
              onClick={() => navigate(`/node/${a.id}`)}
              title={a.label}
            >
              {truncate(a.label)}
            </button>
          </span>
        ))}

        {/* Nodo actual — no clickable, diferenciado */}
        {current && (
          <span className="wf-topbar-crumb-segment">
            <span className="wf-topbar-crumb-sep">›</span>
            <span className="wf-topbar-crumb-current" title={current.label}>
              {truncate(current.label, 28)}
            </span>
          </span>
        )}
      </div>

      <div className="wf-topbar-spacer" />

      {/* Grabadora (⌘R) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'recorder' ? 'active' : ''}`}
        onClick={onToggleRecorder}
        title="Grabadora (⌘R)"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5.5" y="1.5" width="5" height="9" rx="2.5"/>
          <path d="M3 7.5v.5a5 5 0 0 0 10 0v-.5"/>
          <path d="M8 13v2"/>
        </svg>
      </button>

      {/* Contextos (C) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'context-list' || rightPanel === 'context' ? 'active' : ''}`}
        onClick={onToggleContextList}
        title="Contextos (C)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.96-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 4.4-2.72z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.96-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-4.4-2.72z"/>
        </svg>
      </button>

      {/* Prompts */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'prompt-list' || rightPanel === 'prompt' ? 'active' : ''}`}
        onClick={onTogglePromptList}
        title={t('prompts.topbarTitle', 'Prompts')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
        </svg>
      </button>

      {/* Agentes */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'agent-list' || rightPanel === 'agent' ? 'active' : ''}`}
        onClick={onToggleAgentList}
        title={t('agents.topbarTitle', 'Agentes')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="8" width="16" height="11" rx="2"/>
          <path d="M12 8V4M9 2h6"/>
          <circle cx="9" cy="13" r="1" fill="currentColor"/>
          <circle cx="15" cy="13" r="1" fill="currentColor"/>
        </svg>
      </button>

      {/* Magic Chat (M) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'magic' ? 'active' : ''}`}
        onClick={onToggleMagic}
        title="Magic Chat (M)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
        </svg>
      </button>

      {/* Filtro / Buscar (F) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'filter' ? 'active' : ''}`}
        onClick={onToggleSearch}
        title={`${t('common.search')} (F)`}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Planificador (P) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'planner' ? 'active' : ''}`}
        onClick={onTogglePlanner}
        title="Planificador (P)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <rect x="3" y="4" width="9" height="4" rx="1" fill="currentColor" stroke="none"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <rect x="7" y="10" width="12" height="4" rx="1" fill="currentColor" stroke="none"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
          <rect x="3" y="16" width="6" height="4" rx="1" fill="currentColor" stroke="none"/>
        </svg>
      </button>

      {/* Día (Hoy) */}
      <button
        className="wf-topbar-btn"
        title={t('topbar.goToToday')}
        onClick={() => { const dayNode = ensureDayPath(new Date()); navigate(`/node/${dayNode.id}`) }}
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Modo claro/oscuro */}
      <button
        className="wf-topbar-btn"
        title={theme === 'dark' ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        style={{ fontSize: 13 }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* ··· Menú general — solo Papelera, Ajustes, Cerrar sesión */}
      <div className="wf-topbar-menu-wrap" ref={menuRef}>
        <button
          className={`wf-topbar-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          title="Menú"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="wf-topbar-dropdown">
            {agentesNode && (
              <button className="wf-topbar-dropdown-item" onClick={() => { navigate(`/node/${agentesNode.id}`); setMenuOpen(false) }}>
                <span>🤖</span> Agentes
              </button>
            )}
            {plantillasNode && (
              <button className="wf-topbar-dropdown-item" onClick={() => { navigate(`/node/${plantillasNode.id}`); setMenuOpen(false) }}>
                <span>📋</span> Plantillas
              </button>
            )}
            {papeleraNode && (
              <button className="wf-topbar-dropdown-item" onClick={() => { navigate(`/node/${papeleraNode.id}`); setMenuOpen(false) }}>
                <span>🗑</span> {t('sidebar.trash')}
              </button>
            )}
            <button className="wf-topbar-dropdown-item" onClick={() => { onOpenSettings(); setMenuOpen(false) }}>
              <span>⚙️</span> Ajustes
            </button>
            <div className="wf-topbar-dropdown-sep" />
            <button className="wf-topbar-dropdown-item wf-topbar-dropdown-danger" onClick={onLogout}>
              <span>↩</span> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>

    </div>
  )
}
