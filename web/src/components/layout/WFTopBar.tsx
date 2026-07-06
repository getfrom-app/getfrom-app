/**
 * WFTopBar — Top bar estilo Workflowy
 * 🏠 › Padre › Nodo actual   ···
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useTheme } from '../../hooks/useTheme'
import { useState, useRef, useEffect, useMemo } from 'react'
import { ensureCanvasRoot, isCanvasRoot } from '../../utils/canvasRoot'
import { getAgentesNode } from '../../utils/agentesHelper'
import { getPapeleraNode } from '../../utils/papeleraHelper'
import { findRootByKey } from '../../utils/rootLookup'
import { getOrCreateAgendaRoot } from '../../utils/agendaHelper'
import { setTemporalFocus } from '../../utils/pizarraNav'
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
  detailNodeId?: string | null // nodo seleccionado en el lienzo → fuente del breadcrumb
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
  detailNodeId,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const { theme, setTheme } = useTheme()
  const { t, i18n } = useTranslation()
  // Etiqueta de HOY para el breadcrumb del lienzo cuando no hay nada seleccionado
  // («al abrir Fromly, breadcrumb del día actual»). Pulsar = abrir la columna de hoy.
  const todayLabel = new Date().toLocaleDateString(i18n.language || undefined, { weekday: 'long', day: 'numeric', month: 'short' })
  // ¿Estamos en el LIENZO DE CONTEXTOS (ruta raíz)? → el botón Lienzo se marca activo.
  const onContextsCanvas = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '') === ''

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Nodos sistema — para navegación desde el menú.
  // Lookup robusto al reparent bajo 🏠 From (id determinista, no por children(null)).
  // `s = useStore()` re-renderiza ante cualquier cambio del árbol → sigue reactivo.
  const papeleraNode = getPapeleraNode()
  // Perfil IA — raíz flotante (no es contexto ni está en el árbol); se abre desde el menú.
  const perfilNode = s.perfilIANode?.() ?? null

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const path = location.pathname.replace(/^\/app/, '') || '/'
  const isNodeView = path.startsWith('/node/')
  const nodeId = isNodeView ? path.split('/node/')[1] : null
  // En el LIENZO (index /app) la fuente del breadcrumb es el NODO SELECCIONADO (columna
  // derecha abierta): muestra su jerarquía de contextos padre › … › nodo, clicable.
  const onCanvas = path === '/' || isCanvasRoot(nodeId ? s.getNode(nodeId) : null)
  const crumbSourceId = onCanvas ? (detailNodeId ?? null) : nodeId

  const { ancestors, current } = useMemo(() => {
    if (!crumbSourceId) return { ancestors: [], current: null }
    // Build path walking UP from current node
    const fullPath: Array<{ label: string; id: string }> = []
    let cur = s.getNode(crumbSourceId)
    const visited = new Set<string>()
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id)
      fullPath.unshift({ label: cur.text || t('common.noTitle'), id: cur.id })
      if (!cur.parentId) break
      cur = s.getNode(cur.parentId) ?? undefined
    }
    // fullPath = [root, ..., parent, current]. Ocultar raíces estructurales (home,
    // 🧠 Contexto / 🏷 Tags, lienzo): el breadcrumb empieza en el contexto raíz real.
    const HIDDEN = new Set(['🏠 From', '🧠 Contexto', '🏷 Tags', '🌍 Lienzo'])
    const visible = fullPath.filter(n => !HIDDEN.has(n.label))
    const current = visible[visible.length - 1] ?? null
    const ancestors = visible.slice(0, -1)
    return { ancestors, current }
    // s.nodesVersion → recalcular cuando cambie el TEXTO de un nodo (ej.: título auto)
  }, [crumbSourceId, s, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <button className="wf-topbar-btn" onClick={() => window.history.back()} title={t('wftopbar.backButton')}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button className="wf-topbar-btn" onClick={() => window.history.forward()} title={t('wftopbar.forwardButton')}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Breadcrumb integrado con casa. En el LIENZO se oculta pero el div queda
             como hueco flex:1 → los botones de acción siguen a la DERECHA. ── */}
      <div className="wf-topbar-breadcrumb" style={onCanvas && !current ? { flex: 1 } : undefined}>
        {/* Lienzo sin selección → breadcrumb del DÍA DE HOY (pista de ubicación al abrir).
            Pulsar abre la columna de hoy y vuela a su celda del calendario. */}
        {onCanvas && !current && (
          <button
            className="wf-topbar-crumb-today"
            onClick={() => window.dispatchEvent(new CustomEvent('from:set-day'))}
            title={t('topbar.goToToday')}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.7, flexShrink: 0 }}>
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span style={{ textTransform: 'capitalize' }}>{todayLabel}</span>
          </button>
        )}
        {(!onCanvas || current) && (<>
        {/* Casa — en el lienzo deselecciona (vuelve a la columna del día); fuera, va al raíz */}
        <button className="wf-topbar-crumb-home" onClick={onCanvas ? () => window.dispatchEvent(new CustomEvent('from:close-detail')) : goHome} title={t('common.home')}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>

        {/* Ancestros clickables. En el lienzo → abre su columna + vuela (no navega). */}
        {ancestors.map(a => (
          <span key={a.id} className="wf-topbar-crumb-segment">
            <span className="wf-topbar-crumb-sep">›</span>
            <button
              className="wf-topbar-crumb-btn"
              onClick={() => { if (onCanvas) window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: a.id } })); else navigate(`/node/${a.id}`) }}
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
        </>)}
      </div>

      <div className="wf-topbar-spacer" />

      {/* Grabadora: el botón se movió al FAB «REC» (abajo-derecha), que abre la
          columna ya grabando. La barra ya no necesita su icono. ⌘R sigue abriéndola. */}

      {/* Contextos / Prompts / Agentes se navegan por el árbol central (sus nodos) —
          ya no tienen icono en la barra. La columna derecha es solo inspector + filtro/magic/grabadora. */}

      {/* Magic Chat (M) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'magic' ? 'active' : ''}`}
        onClick={onToggleMagic}
        title={t('tip.magicChat')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
        </svg>
      </button>

      {/* Favoritos + Recientes (F) — antes «Buscar»; la búsqueda vive ahora en Elementos */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'filter' ? 'active' : ''}`}
        onClick={onToggleSearch}
        title={t('searchPanel.favorites')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/>
        </svg>
      </button>

      {/* Planificador (P) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'planner' ? 'active' : ''}`}
        onClick={onTogglePlanner}
        title={t('wftopbar.planner')}
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

      {/* Buscar (Elementos): el buscador universal del lienzo, filtrable por tipo (Heptabase) */}
      <button
        className={`wf-topbar-btn ${rightPanel === 'elements' ? 'active' : ''}`}
        title={`${t('common.search')} (F)`}
        onClick={() => window.dispatchEvent(new CustomEvent('from:open-elements-panel', { detail: { nodeId: ensureCanvasRoot().id } }))}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </button>

      {/* ── Conmutador de SUPERFICIES (siempre visible, mismo sitio): Lienzo · Hoy · Calendario ── */}
      <div className="wf-topbar-sep" />
      {/* 🌍 Lienzo de contextos (plano infinito). Activo si ya estás en él. */}
      <button
        className={`wf-topbar-btn ${onContextsCanvas ? 'active' : ''}`}
        title={t('dayNav.canvas', 'Lienzo de contextos')}
        onClick={() => navigate('/')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 9.5a2.5 2.5 0 100 5c1.5 0 2.4-1.3 3-2.5.6-1.2 1.5-2.5 3-2.5a2.5 2.5 0 110 5c-1.5 0-2.4-1.3-3-2.5-.6-1.2-1.5-2.5-3-2.5z" />
        </svg>
      </button>
      {/* 📆 Hoy — entra en el lienzo del día de hoy. */}
      <button
        className="wf-topbar-btn"
        title={t('topbar.goToToday')}
        onClick={() => window.dispatchEvent(new CustomEvent('from:set-day'))} // sin date = hoy
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><rect x="7" y="13" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {/* 📅 Calendario mes/año (superficie discreta, TemporalCanvasView). */}
      <button
        className="wf-topbar-btn"
        title={t('dayNav.calendar', 'Calendario')}
        onClick={() => {
          const agenda = getOrCreateAgendaRoot()
          setTemporalFocus({ date: Date.now(), level: 'days' })
          navigate(`/node/${agenda.id}`)
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      </button>
      <div className="wf-topbar-sep" />

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
          title={t('wftopbar.menu')}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="wf-topbar-dropdown">
            {perfilNode && (
              <button className="wf-topbar-dropdown-item" onClick={() => { navigate(`/node/${perfilNode.id}`); setMenuOpen(false) }}>
                <span>🧠</span> {t('profile.panelLabel')}
              </button>
            )}
            {papeleraNode && (
              <button className="wf-topbar-dropdown-item" onClick={() => { navigate(`/node/${papeleraNode.id}`); setMenuOpen(false) }}>
                <span>🗑</span> {t('sidebar.trash')}
              </button>
            )}
            <button className="wf-topbar-dropdown-item" onClick={() => { onOpenSettings(); setMenuOpen(false) }}>
              <span>⚙️</span> {t('wftopbar.menuSettings')}
            </button>
            <div className="wf-topbar-dropdown-sep" />
            <button className="wf-topbar-dropdown-item wf-topbar-dropdown-danger" onClick={onLogout}>
              <span>↩</span> {t('wftopbar.menuLogout')}
            </button>
          </div>
        )}
      </div>
    </div>

    </div>
  )
}
