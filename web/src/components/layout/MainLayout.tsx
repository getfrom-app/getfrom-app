import { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useFilterStore, setActiveFilter } from '../../store/filterStore'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'
import { getHotkeyKey } from '../../store/hotkeysStore'
import StatusBar from './StatusBar'
import NodeView from '../views/NodeView'
import ContextListPanel, { UNCLASSIFIED_FILTER_ID } from '../panels/ContextListPanel'
import RecorderPanel from '../panels/RecorderPanel'

import WFHomeView from '../views/WFHomeView'
import { relocateRootDiariesToAgenda, getTodayDiaryUnderAgenda, AGENDA_ROOT_NAME } from '../../utils/agendaHelper'

// Redirige /followup → /node/{diario de hoy} (ruta legacy).
function DiaryRedirect() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const s = useStore()
  const diary = s.todayDiary()
  useEffect(() => {
    if (diary) navigate(`/node/${diary.id}`, { replace: true })
  }, [diary?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="view-loading">{t('app.loadingDiary')}</div>
}
// Eliminadas en v9.1: TasksView, ChatView, KanbanView, TagView, FilesView, InboxView, TrashView
// (reemplazadas por nodos del árbol o eliminadas sin sustituto)
// AgentsView eliminada en v9.1 — los agentes son nodos del árbol (🤖 Agentes)
// TrashView eliminada en v9.1 — reemplazada por nodo 🗑 Papelera en el árbol
// SearchView MANTIENE — es la vista de resultados de filtros/atajos (⌘F, Pendientes, etc.)
const SearchView = lazy(() => import('../views/SearchView'))
const AccountView = lazy(() => import('../views/AccountView'))
const SettingsView = lazy(() => import('../views/SettingsView'))
const ResourcesView = lazy(() => import('../views/ResourcesView'))
const CalendarPlanner = lazy(() => import('../views/CalendarPlanner'))
import SearchPanel from '../panels/SearchPanel'
// Componentes pesados: lazy-loaded para reducir el bundle inicial
const PlannerPanel = lazy(() => import('../panels/PlannerPanel'))
const MagicChat = lazy(() => import('../aichat/MagicChat'))
const UnifiedCapture = lazy(() => import('../modals/UnifiedCapture'))
const NewTaskModal = lazy(() => import('../modals/NewTaskModal'))
const NewNoteModal = lazy(() => import('../modals/NewNoteModal'))
const NewEventModal = lazy(() => import('../modals/NewEventModal'))
const VoiceCaptureModal = lazy(() => import('../modals/VoiceCaptureModal'))
const KeyboardShortcutsModal = lazy(() => import('../modals/KeyboardShortcutsModal'))
const PaywallModal = lazy(() => import('../paywall/PaywallModal'))
const OnboardingWidget = lazy(() => import('../onboarding/OnboardingWidget'))
import WFTopBar from './WFTopBar'
import TrialBanner from './TrialBanner'
import { useTaskNotifications } from '../../hooks/useTaskNotifications'
import { ToastProvider } from '../Toast'
import { syncTagDefinitions, cleanupSpuriousTags, migrateTagsToContexto, ensurePerfilInsideContexto, ensurePlantillasNode } from '../../utils/tagsHelper'
import { extractContextKnowledge } from '../../api/autoClassify'

// Cooldown para extractContextKnowledge en ContextNodePanel — sin extraData
const ctxPanelKnowledgeTimestamps = new Map<string, number>()
import { ensureAtajosNode, migrateLocalStorageShortcuts } from '../../utils/atajosHelper'
import { ensureAgentesNode } from '../../utils/agentesHelper'
import { ensurePapeleraNode } from '../../utils/papeleraHelper'
import { invalidatePredictionCache } from '../../store/predictionStore'

// ── Panel derecho: nodo contexto — outliner editable completo (lazy) ─────────
const Outliner = lazy(() => import('../outliner/Outliner'))

function ContextNodePanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const s = useStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const node = s.getNode(nodeId)
  const [ctxKnowledgeLoading, setCtxKnowledgeLoading] = useState(false)

  // Detectar si el nodo es un contexto (hijo directo de 🧠 Contexto)
  // Excluye el nodo de perfil (_perfilIA === '1') — tiene su propio mecanismo de aprendizaje (extractUserKnowledge)
  const isContextNode = useMemo(() => {
    if (!node) return false
    try { if (JSON.parse(node.extraData || '{}')._perfilIA === '1') return false } catch { /* ignore */ }
    const tagsRoot = store.children(null).find(n => !n.deletedAt && (n.text === '🧠 Contexto' || n.text === '🏷 Tags'))
    if (!tagsRoot) return false
    return node.parentId === tagsRoot.id
  }, [node?.id, node?.parentId, node?.extraData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-actualizar "Lo que From sabe" al abrir un contexto en el panel derecho ──
  // Misma lógica que NodeView: si han pasado >30 min desde la última actualización, dispara en background.
  // NOTA: usamos ctxPanelKnowledgeTimestamps (Map local) en lugar de extraData del nodo para
  // evitar que la actualización del nodo re-dispare este efecto (bucle infinito de renders).
  useEffect(() => {
    if (!node || !isContextNode || ctxKnowledgeLoading) return
    const lastUpdated = ctxPanelKnowledgeTimestamps.get(node.id) ?? 0
    const thirtyMinutes = 30 * 60 * 1000
    if (Date.now() - lastUpdated < thirtyMinutes) return
    const timer = setTimeout(async () => {
      if (!node || ctxKnowledgeLoading) return
      setCtxKnowledgeLoading(true)
      try {
        const directChildren = store.children(node.id).filter(n => !n.deletedAt)
        const samples: string[] = []
        for (const child of directChildren) {
          if (child.text?.trim()) samples.push(child.text.trim())
          if (samples.length >= 60) break
          for (const grandchild of store.children(child.id).filter(n => !n.deletedAt)) {
            if (grandchild.text?.trim()) samples.push(grandchild.text.trim())
            if (samples.length >= 60) break
          }
        }
        if (samples.length === 0) { setCtxKnowledgeLoading(false); return }
        const knowledge = await extractContextKnowledge(node.text || '', '', samples)
        const KNOWLEDGE_NODE_TEXT = '🧠 Lo que From sabe'
        const existingKnowledgeNode = store.children(node.id).find(n => !n.deletedAt && n.text === KNOWLEDGE_NODE_TEXT)
        let knowledgeNodeId: string
        if (existingKnowledgeNode) {
          knowledgeNodeId = existingKnowledgeNode.id
        } else {
          const allSibs = store.children(node.id).filter(n => !n.deletedAt)
          const maxOrder = allSibs.length > 0 ? Math.max(...allSibs.map(c => c.siblingOrder)) : 0
          const newNode = store.createNode({ text: KNOWLEDGE_NODE_TEXT, parentId: node.id, siblingOrder: maxOrder + 1000 })
          knowledgeNodeId = newNode.id
        }
        const SUBNODE_TEXTS: Record<string, string> = {
          keywords: `Palabras clave: ${knowledge.keywords.join(', ')}`,
          people: `Personas: ${knowledge.people.length > 0 ? knowledge.people.join(', ') : '—'}`,
          topics: `Temas frecuentes: ${knowledge.topics.join(', ')}`,
        }
        const existingChildren = store.children(knowledgeNodeId).filter(n => !n.deletedAt)
        let order = 1000
        for (const [key, text] of Object.entries(SUBNODE_TEXTS)) {
          const prefix = key === 'keywords' ? 'Palabras clave:' : key === 'people' ? 'Personas:' : 'Temas frecuentes:'
          const existing = existingChildren.find(n => (n.text || '').startsWith(prefix))
          if (existing) {
            store.updateNode(existing.id, { text })
          } else {
            store.createNode({ text, parentId: knowledgeNodeId, siblingOrder: order })
          }
          order += 1000
        }
        // Guardar timestamp en Map local (sin tocar extraData — evita re-renders)
        ctxPanelKnowledgeTimestamps.set(node.id, Date.now())
      } catch { /* silenciar errores */ }
      setCtxKnowledgeLoading(false)
    }, 1500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, isContextNode])

  // Color del contexto desde extraData (_tagColor) con fallback al accent
  const ctxColor = useMemo(() => {
    if (!node) return 'var(--accent)'
    try {
      const ed = JSON.parse(node.extraData || '{}')
      return ed._tagColor || 'var(--accent)'
    } catch { return 'var(--accent)' }
  }, [node?.id, node?.extraData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cabecera: ← Atrás · Título · ↗ Abrir */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px', height: 40, flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
      }}>
        {/* Botón ← Atrás */}
        <button
          onClick={onClose}
          title={t('ctxPanel.back')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--text-secondary)',
            padding: '3px 6px', borderRadius: 4, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 3,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('ctxPanel.back')}
        </button>
        {/* Título con color del contexto */}
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 500,
          color: ctxColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.text}
        </span>
        {/* Botón ↗ Abrir */}
        <button
          onClick={() => { navigate(`/node/${nodeId}`); onClose() }}
          title={t('ctxPanel.open')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--text-secondary)',
            padding: '3px 6px', borderRadius: 4, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 3,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('ctxPanel.open')}
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M7 1h4v4M11 1L6 6M2 4H1v7h7v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {/* Outliner con misma fuente (13px), mismo padding-top que el filtro */}
      <div className="ctx-panel-outliner" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 8 }}>
        <Outliner parentId={nodeId} autoFocusEmpty={true} />
      </div>
    </div>
  )
}

export default function MainLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  // Nodo actualmente abierto en la URL (`/node/:id` o `/app/node/:id`).
  // Se inyecta a From AI como contexto.
  const currentNodeIdFromRoute = (() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    return m ? m[1] : undefined
  })()
  const [loadError, setLoadError] = useState('')
  const [filterText, setFilterText] = useFilterStore()

  // Wrapper: aplicar filtro + navegar a raíz si estamos dentro de un nodo
  const applyFilter = (q: string) => {
    setFilterText(q)
    const path = window.location.pathname.replace(/^\/app\/?/, '') || '/'
    if (path !== '/' && path !== '') navigate('/')
  }

  // Columna derecha — siempre visible, nunca se cierra
  // 'context' es un panel especial (nodo concreto); el resto son los paneles ciclables.
  type RightPanel = 'magic' | 'filter' | 'planner' | 'context' | 'context-list' | 'recorder'
  type CyclablePanel = 'recorder' | 'context-list' | 'magic' | 'filter' | 'planner'
  // PANEL_ORDER coincide con el orden de los iconos en WFTopBar (izquierda → derecha)
  const PANEL_ORDER: CyclablePanel[] = ['recorder', 'context-list', 'magic', 'filter', 'planner']
  const [rightPanel, setRightPanel] = useState<RightPanel>(() => {
    const saved = localStorage.getItem('from-right-panel') as RightPanel
    return PANEL_ORDER.includes(saved as CyclablePanel) ? saved : 'filter'
  })
  const [contextNodeId, setContextNodeId] = useState<string | null>(null)
  const pendingContextRef = useRef<string | null>(null)  // contexto a aplicar tras navegación
  // Guard para evitar race condition entre efecto "aplicar pending" y efecto "limpiar al navegar":
  // cuando el efecto de pending consume el ref y setea contextNodeId, este flag evita que el
  // efecto de limpieza lo borre inmediatamente (ambos se disparan con la misma dep location.pathname).
  const pendingContextConsumedRef = useRef(false)

  function openPanel(p: CyclablePanel) { setRightPanel(p) }
  // togglePanel ahora solo cambia de panel — no cierra
  function togglePanel(p: CyclablePanel) { setRightPanel(p) }

  function handleSelectContext(nodeId: string) {
    // Filtro especial "Sin clasificar" — no abre panel de nodo, solo aplica filtro
    if (nodeId === UNCLASSIFIED_FILTER_ID) {
      if (contextNodeId === UNCLASSIFIED_FILTER_ID) {
        setContextNodeId(null)
        return
      }
      const normPath = location.pathname.replace(/^\/app\/?/, '') || '/'
      const atHome = normPath === '/' || normPath === ''
      if (!atHome) {
        pendingContextRef.current = nodeId
        navigate('/')
      } else {
        setContextNodeId(nodeId)
        // Mantener panel context-list abierto para que el usuario vea los contextos
      }
      return
    }

    if (contextNodeId === nodeId && rightPanel === 'context') {
      // Segundo clic → volver a la lista de contextos
      setRightPanel('context-list')
      setContextNodeId(null)
      return
    }
    const normPath = location.pathname.replace(/^\/app\/?/, '') || '/'
    const atHome = normPath === '/' || normPath === ''
    if (!atHome) {
      pendingContextRef.current = nodeId
      navigate('/')
    } else {
      setContextNodeId(nodeId)
      setRightPanel('context')
    }
  }

  // Aplicar contexto pendiente tras volver a home
  useEffect(() => {
    if (!pendingContextRef.current) return
    const normPath = location.pathname.replace(/^\/app\/?/, '') || '/'
    const atHome = normPath === '/' || normPath === ''
    if (atHome) {
      const nodeId = pendingContextRef.current
      pendingContextRef.current = null
      // Marcar que el pending fue consumido ANTES de limpiar el ref, para que el efecto
      // de limpieza (mismo location.pathname) no borre lo que acabamos de setear.
      pendingContextConsumedRef.current = true
      setContextNodeId(nodeId)
      // "Sin clasificar" no abre panel de nodo — mantiene context-list
      if (nodeId !== UNCLASSIFIED_FILTER_ID) setRightPanel('context')
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ciclar entre paneles con ← → (dirección = orden de iconos en la barra)
  function cyclePanel(dir: 'left' | 'right') {
    const current = PANEL_ORDER.includes(rightPanel as CyclablePanel)
      ? (rightPanel as CyclablePanel) : 'filter'
    const idx = PANEL_ORDER.indexOf(current)
    const next = dir === 'right'
      ? PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]
      : PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]
    setPanelSlideDir(dir === 'right' ? 'down' : 'up')
    setPanelKey(k => k + 1)
    setRightPanel(next)
  }

  // Alias legacy para compatibilidad con eventos externos y lógica existente
  const showAIChat = rightPanel === 'magic'
  const showSearch = rightPanel === 'filter'
  const setShowAIChat = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(rightPanel === 'magic') : v
    if (next) setRightPanel('magic')
  }
  const setShowSearch = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(rightPanel === 'filter') : v
    if (next) setRightPanel('filter')
    else setFilterText('')
  }

  function handleDividerMouseDown(e: React.MouseEvent) {
    // Sidebar eliminado — función vacía por compatibilidad
    void e
  }
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)
  const [showUnifiedCapture, setShowUnifiedCapture] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [rightPanelW, setRightPanelW] = useState(() => {
    const saved = localStorage.getItem('right-panel-w')
    return saved ? Math.max(320, Math.min(900, parseInt(saved))) : 480
  })
  const magicHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slide animation state
  const [panelSlideDir, setPanelSlideDir] = useState<'up' | 'down'>('down')
  const [panelKey, setPanelKey] = useState(0)

  // Notificar cuando Magic se abre (para onboarding)
  useEffect(() => {
    if (showAIChat) {
      window.dispatchEvent(new Event('from:magic-opened'))
    }
  }, [showAIChat])

  // Persistir preferencia de panel (siempre, excepto 'context' que es temporal)
  useEffect(() => {
    if (rightPanel !== 'context') {
      localStorage.setItem('from-right-panel', rightPanel)
    }
  }, [rightPanel])

  // Cambiar panel desde eventos externos (ej. onboarding)
  useEffect(() => {
    function handler(e: Event) {
      const mode = (e as CustomEvent<{ mode: null | 'magic' | 'search' }>).detail?.mode ?? null
      if (!mode) { setFilterText('') }
      else if (mode === 'magic') openPanel('magic')
      else if (mode === 'search') openPanel('filter')
    }
    window.addEventListener('from:panelMode', handler)
    return () => window.removeEventListener('from:panelMode', handler)
  }, [])

  // Si el usuario navega al nodo Agenda, redirigir al home (Agenda es transparente)
  useEffect(() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    if (m) {
      const node = store.getNode(m[1])
      if (node?.text === AGENDA_ROOT_NAME) navigate('/', { replace: true })
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al navegar: limpiar contexto activo siempre (independientemente del panel visible)
  useEffect(() => {
    if (rightPanel === 'context') {
      setRightPanel('context-list')
    }
    // Limpiar contextNodeId al ENTRAR a un nodo concreto — no al volver a home.
    // Si pendingContextConsumedRef es true, el efecto de pending (mismo location.pathname,
    // ejecutado antes) ya seteó contextNodeId — no limpiar, solo resetear el flag.
    if (location.pathname.startsWith('/node/')) {
      setContextNodeId(null)
      setFilterText('')
    } else if (pendingContextConsumedRef.current) {
      // El pending fue procesado por el efecto anterior — no limpiar, solo resetear el flag.
      pendingContextConsumedRef.current = false
    } else if (!pendingContextRef.current) {
      // Volvemos a home sin pending → limpiar contexto (navegación normal, ESC, etc.)
      setContextNodeId(null)
    }
  }, [location.pathname, location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onSetFilter() {
      // Al aplicar filtro, si estábamos en contexto volvemos a filtro
      if (rightPanel === 'context') { setRightPanel('filter'); setContextNodeId(null) }
    }
    window.addEventListener('wf:set-filter', onSetFilter)
    return () => window.removeEventListener('wf:set-filter', onSetFilter)
  }, [rightPanel])

  // Cerrar Magic al hacer clic en cualquier nodo del outliner
  useEffect(() => {
    if (!showAIChat || !currentNodeIdFromRoute) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const isNodeClick = target.closest('[data-node-id]') || target.closest('.node-text') || target.closest('.bullet-nav-dot')
      if (isNodeClick) setShowAIChat(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAIChat, currentNodeIdFromRoute])

  // Resize del panel derecho desde su borde izquierdo
  function handleRightPanelResizeDown(e: React.MouseEvent) {
    const startX = e.clientX
    const startW = rightPanelW
    document.body.classList.add('sidebar-resizing')
    function onMove(ev: MouseEvent) {
      const w = Math.max(320, Math.min(900, startW + startX - ev.clientX))
      setRightPanelW(w)
    }
    function onUp() {
      document.body.classList.remove('sidebar-resizing')
      localStorage.setItem('right-panel-w', String(rightPanelW))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

  // Hover en la franja derecha → toggle Magic con delay
  function handleEdgeEnter() {
    magicHoverTimerRef.current = setTimeout(() => setShowAIChat(v => !v), 200)
  }
  function handleEdgeLeave() {
    if (magicHoverTimerRef.current) clearTimeout(magicHoverTimerRef.current)
  }
  const [slugModal, setSlugModal] = useState<{ nodeId: string; currentSlug: string } | null>(null)
  const [slugInput, setSlugInput] = useState('')
  const slugModalInputRef = useRef<HTMLInputElement>(null)

  // Abrir Magic Chat con texto prellenado (ej. desde Grabadora → "Resumir con IA")
  useEffect(() => {
    function onOpenWithText(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text ?? ''
      setShowAIChat(true)
      if (text) {
        // Pequeño delay para que MagicChat monte y registre el listener
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('magic-chat:prefill', { detail: { text } }))
        }, 80)
      }
    }
    window.addEventListener('magic-chat:open-with-text', onOpenWithText)
    return () => window.removeEventListener('magic-chat:open-with-text', onOpenWithText)
  }, [])

  // Limpiar / aplicar filtro desde cualquier componente
  useEffect(() => {
    function handleClearFilter() { setFilterText('') }
    function handleSetFilter(e: Event) {
      const q = (e as CustomEvent<{ query: string }>).detail?.query ?? ''
      setFilterText(q)
      // Asegurar que estamos en la vista raíz para ver el árbol filtrado
      const path = window.location.pathname.replace(/^\/app/, '') || '/'
      if (path !== '/' && path !== '') navigate('/')
    }
    window.addEventListener('wf:clear-filter', handleClearFilter)
    window.addEventListener('wf:set-filter', handleSetFilter)
    return () => {
      window.removeEventListener('wf:clear-filter', handleClearFilter)
      window.removeEventListener('wf:set-filter', handleSetFilter)
    }
  }, [navigate])

  // Cerrar búsqueda + limpiar filtro al navegar a un nodo concreto
  // Al navegar a un /node/ con el panel de filtro activo → limpiar el filtro
  // (el panel sigue abierto — ya no se cierra al navegar)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    if (showSearch && location.pathname.includes('/node/')) {
      setFilterText('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  const prevIsSyncing = useRef(false)

  useTaskNotifications()

  useEffect(() => {
    // Nota: eliminamos navigate('/', replace:true) porque con v7_startTransition
    // la función navigate puede cambiar de referencia al cambiar la ruta, lo que
    // re-ejecutaría este effect y tiraría al usuario de vuelta a root.
    // La exclusión de diarios en WFHomeView (excludeDiaryEntries) garantiza
    // que nunca se muestre el diario en root sin necesidad de redirigir.

    store.isGuest = false
    store.initialLoad()
      .then(async () => {
        // Migrar 🏷 Tags → 🧠 Contexto si existe el nodo antiguo
        migrateTagsToContexto()
        ensurePerfilInsideContexto()
        // Nodos de sistema: Plantillas (se crea solo si no existe)
        ensurePlantillasNode()
        // Nodo de sistema: 📌 Atajos
        ensureAtajosNode()
        migrateLocalStorageShortcuts()
        ensureAgentesNode()
        ensurePapeleraNode()
        // Reubicar diarios de root bajo 📅 Agenda — ANTES de marcar isLoaded
        await relocateRootDiariesToAgenda()
        cleanupSpuriousTags()
        syncTagDefinitions()
        // Forzar sync inmediato para que todos los cambios de inicialización
        // (Plantillas, Contexto, Perfil) se persistan en el servidor.
        // Sin esto, si el usuario recarga antes del debounce (1.5s),
        // los nodos de sistema se recrean en cada recarga.
        await store.sync(true)
        store.setLoaded()
        store.startRemotePolling() // Polling 15s para recibir cambios remotos (MCP, otros clientes)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'UNAUTHORIZED') {
          clearTokens()
          navigate('/login', { replace: true })
        } else {
          setLoadError(msg)
        }
      })
    userStore.fetchMe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { reason: 'node_limit' | 'ai_limit' }
      setPaywallReason(detail.reason)
    }
    window.addEventListener('from:paywall', handler)
    return () => window.removeEventListener('from:paywall', handler)
  }, [])

  // Invalidar caché de predicción cuando el store cambia (el nodo ⚙️ Ajustes puede haber sincronizado)
  useEffect(() => {
    return store.subscribe(() => invalidatePredictionCache())
  }, [])

  // Sesión expirada durante el uso → limpiar store y redirigir al login
  useEffect(() => {
    const handler = () => {
      clearTokens()
      store.reset()  // limpiar nodos para evitar mezcla al relogin
      navigate('/login', { replace: true })
    }
    window.addEventListener('from:unauthorized', handler)
    return () => window.removeEventListener('from:unauthorized', handler)
  }, [navigate])

  // Cmd+K / Ctrl+K → command palette (única combinación global que no choca con Chrome)
  // Nota: Cmd+N, Cmd+T, Cmd+E, Cmd+R son comandos del navegador y se han eliminado
  // Escape → go home (if no modal/input focused)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // El modal UnifiedCapture gestiona su propio teclado — no interferir
      if (showUnifiedCapture) return
      // No procesar atajos globales hasta que el store esté listo
      if (!store.isLoaded) return

      // ⌘K → captura rápida / buscador unificado
      if (e.key === getHotkeyKey('command-palette') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setShowUnifiedCapture(v => !v)
      }
      // Ir a hoy (por defecto H, sin modificador)
      if (e.key === getHotkeyKey('go-today') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          const today = getTodayDiaryUnderAgenda()
          navigate(`/node/${today.id}`)
        }
      }
      // Nuevo nodo hoy (por defecto N, sin modificador)
      if (e.key === getHotkeyKey('new-today') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          const today = getTodayDiaryUnderAgenda()
          navigate(`/node/${today.id}`)
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('wf:new-child-today', { detail: { parentId: today.id } }))
          }, 150)
        }
      }
      // Espacio → captura rápida si no hay input activo O si el input activo está vacío
      // (no tiene sentido empezar un nodo/filtro/magic con un espacio)
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const tag = active?.tagName
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable
        const isEmpty = !isEditable || (() => {
          if (tag === 'INPUT' || tag === 'TEXTAREA') {
            return !(active as HTMLInputElement).value.trim()
          }
          return !(active?.textContent || '').trim()
        })()
        if (isEmpty) { e.preventDefault(); setShowUnifiedCapture(true) }
      }
      // ⌘M → toggle Magic Chat (configurable)
      if (e.key === getHotkeyKey('toggle-magic') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('magic')
      }
      // ⌘F → toggle filtro/búsqueda (configurable)
      if (e.key === getHotkeyKey('toggle-filter') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('filter')
      }
      // ←/→ → ciclar entre paneles (orden = iconos del topbar, sin modificador, sin input activo)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const inputEl = active as HTMLInputElement | null
        const isNonEmptyInput = (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA')
          && (inputEl?.value || '') !== ''
        const isContentEditable = !!active?.isContentEditable && (active.textContent || '') !== ''
        if (!isNonEmptyInput && !isContentEditable) {
          e.preventDefault()
          cyclePanel(e.key === 'ArrowRight' ? 'right' : 'left')
        }
      }
      // ⌘R → toggle grabadora (configurable)
      if (e.key === getHotkeyKey('toggle-recorder') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('recorder')
      }
      // ⌘⇧C → toggle lista de contextos (configurable)
      if (e.key === getHotkeyKey('toggle-contexts') && !e.repeat && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        togglePanel('context-list')
      }
      // ⌘P → toggle planificador (configurable)
      if (e.key === getHotkeyKey('toggle-planner') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('planner')
      }
      // (Cmd+Shift+S eliminado — no hay sidebar)
      // Cmd+, → Ajustes (página completa)
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        navigate('/settings')
      }
      // Cmd+[ → Atrás en la navegación
      if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        window.history.back()
      }
      // Cmd+] → Adelante en la navegación
      if (e.key === ']' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        window.history.forward()
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        store.undo()
      }
      if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
          (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        store.redo()
      }
      // Cmd+Shift+A → colapsar todos / expandir todos (toggle)
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        const anyCollapsed = store.allActive().some(n => n.isCollapsed)
        if (anyCollapsed) {
          store.expandAll(null)
        } else {
          store.collapseAll(null)
        }
      }
      // Ver atajos (configurable, por defecto ?)
      if (e.key === getHotkeyKey('show-shortcuts')) {
        const active = document.activeElement
        const isInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          (active as HTMLElement)?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          setShowShortcuts(v => !v)
        }
      }
      // Ctrl+1-9 → cambiar de vista (SIN Cmd, para no interferir con el sistema)
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const viewMap: Record<string, string> = {
          '1': '/',
          '3': '/search',
        }
        if (viewMap[e.key]) {
          const active = document.activeElement
          const isInputFocused =
            active?.tagName === 'INPUT' ||
            active?.tagName === 'TEXTAREA' ||
            (active as HTMLElement)?.isContentEditable
          if (!isInputFocused) {
            e.preventDefault()
            navigate(viewMap[e.key])
          }
        }
      }
      if (e.key === 'Escape') {
        // Prioridad 1: cerrar modales/paleta abiertos (los propios componentes lo gestionan via useEffect)
        if (showUnifiedCapture || showNewTask || showNewEvent || showVoiceCapture || showShortcuts || showUnifiedCapture) return

        // Prioridad 2: cerrar menús flotantes (slash, pickers, etc.) — sus propios handlers lo harán
        const hasFloatingMenu = !!document.querySelector('.slash-menu, .inline-picker, .wf-topbar-dropdown')
        if (hasFloatingMenu) return

        // Prioridad 2.5: volver a lista de contextos (no cerrar el panel)
        // También cubre el filtro "Sin clasificar" que no abre panel 'context' sino que queda en 'context-list'
        if (rightPanel === 'context' || contextNodeId === UNCLASSIFIED_FILTER_ID) {
          setRightPanel('context-list')
          setContextNodeId(null)  // limpia filtro del árbol
          return
        }

        // Prioridad 3: deseleccionar texto seleccionado
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed) {
          sel.removeAllRanges()
          return
        }

        // Prioridad 4: si hay input/editor activo, quitarle el foco (blur)
        const active = document.activeElement as HTMLElement | null
        const isInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.isContentEditable
        if (isInputFocused) {
          active?.blur()
          return
        }

        // Prioridad 4.5: limpiar filtro de panel activo → volver a la agenda limpia
        if (filterText) {
          setFilterText('')
          window.dispatchEvent(new CustomEvent('wf:clear-filter'))
          return
        }

        // Prioridad 5: subir en la jerarquía (Escape sube al padre)
        // Si el padre es Agenda (nodo transparente), ir al home en lugar de abrirlo
        const match = window.location.pathname.match(/\/node\/([^/]+)/)
        if (match) {
          const nodeId = match[1]
          const node = store.getNode(nodeId)
          if (node?.parentId) {
            const parent = store.getNode(node.parentId)
            if (!parent || parent.text === '📅 Agenda') {
              navigate('/')
            } else {
              navigate(`/node/${node.parentId}`)
            }
          } else {
            navigate('/')
          }
        }
        // Si ya estamos en root '/' no hacemos nada
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, showUnifiedCapture, showNewTask, showNewEvent, showVoiceCapture, showShortcuts, rightPanel, contextNodeId])

  // Listener del modal de URL corta (slug) — disparado desde NodeContextMenu vía CustomEvent
  useEffect(() => {
    function handleOpenSlugModal(e: Event) {
      const detail = (e as CustomEvent).detail as { nodeId: string; currentSlug: string }
      setSlugInput(detail.currentSlug)
      setSlugModal({ nodeId: detail.nodeId, currentSlug: detail.currentSlug })
      setTimeout(() => slugModalInputRef.current?.focus(), 50)
    }
    window.addEventListener('from:open-slug-modal', handleOpenSlugModal)
    return () => window.removeEventListener('from:open-slug-modal', handleOpenSlugModal)
  }, [])

  // Polling automático: sync cada 15s para recoger cambios de Mac/iOS sin refrescar
  useEffect(() => {
    const id = setInterval(() => {
      if (!store.isSyncing) {
        store.sync().catch(() => {/* silencioso */})
      }
    }, 15_000)
    return () => clearInterval(id)
  }, [])

  // Detectar cambio isSyncing true → false para mostrar "✓ Guardado"
  useEffect(() => {
    if (prevIsSyncing.current && !s.isSyncing) {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(t)
    }
    prevIsSyncing.current = s.isSyncing
  }, [s.isSyncing])

  // (El drag al planner usa el handler existente del outliner + evento 'planner:node-drop')

  function handleLogout() {
    clearTokens()
    store.reset()          // limpiar nodos — evita mezcla entre cuentas
    setActiveFilter('')    // limpiar filtro activo
    userStore.reset()
    navigate('/login', { replace: true })
  }

  if (loadError) {
    return (
      <div className="error-screen">
        <p>Error al conectar: {loadError}</p>
        <button onClick={() => window.location.reload()}>{t('app.retrying')}</button>
      </div>
    )
  }

  return (
    <ToastProvider>
    <div className="main-layout wf-layout">

      {/* ── Traffic lights row (solo Mac) ── */}
      <div
        className="traffic-bar"
        style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
      />

      {/* ── Cabecera unificada — sin sidebar ── */}
      <div className="app-header">
        <WFTopBar
          onFilter={applyFilter}
          filterText={filterText}

          onLogout={handleLogout}
          onOpenSettings={() => navigate('/settings')}
          onTogglePlanner={() => togglePanel('planner')}
          plannerOpen={rightPanel === 'planner'}
          onToggleSearch={() => togglePanel('filter')}
          onToggleMagic={() => togglePanel('magic')}
          onToggleContextList={() => togglePanel('context-list')}
          onToggleRecorder={() => togglePanel('recorder')}
          rightPanel={rightPanel}
        />
      </div>

      {/* ── Contenido: árbol + panel derecho ── */}
      <div className="main-body">
      <main className="main-content">
        <TrialBanner />
        {/* Mobile header eliminado — sidebar eliminado */}
        <Suspense fallback={<div className="view-loading">{t('common.loading')}</div>}>
        <Routes>
          <Route index element={<WFHomeView filterText={filterText} contextFilterId={contextNodeId} />} />
          {/* /followup obsoleto desde v8.20: redirige al diario */}
          <Route path="followup" element={<DiaryRedirect />} />
          {/* SearchView: resultados de filtros y atajos (⌘F, shortcuts) — MANTENER */}
          <Route path="search" element={<SearchView />} />
          {/* Rutas eliminadas en v9.0-v9.1 → redirigen a inicio */}
          <Route path="calendar" element={<Navigate to="/" replace />} />
          <Route path="tasks"    element={<Navigate to="/" replace />} />
          <Route path="kanban"   element={<Navigate to="/" replace />} />
          <Route path="chat"     element={<Navigate to="/" replace />} />
          <Route path="tag/:name" element={<Navigate to="/" replace />} />
          <Route path="files"    element={<Navigate to="/" replace />} />
          <Route path="inbox"    element={<Navigate to="/" replace />} />
          <Route path="trash"    element={<Navigate to="/" replace />} />
          {/* agents route eliminado — los agentes viven como nodos en 🤖 Agentes */}
          <Route path="planner"   element={<CalendarPlanner />} />
          <Route path="resources" element={<ResourcesView />} />
          <Route path="account" element={<AccountView />} />
          <Route path="node/:id" element={<NodeView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="*" element={
            <div className="view">
              <div className="view-header"><h1 className="view-title">404</h1></div>
              <div className="view-body">
                <div className="view-empty" style={{ paddingTop: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🗺</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Página no encontrada</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>La ruta que buscas no existe.</div>
                  <button
                    className="btn-primary"
                    style={{ marginTop: 20 }}
                    onClick={() => window.location.href = '/app/'}
                  >Ir a inicio</button>
                </div>
              </div>
            </div>
          } />
        </Routes>
        </Suspense>
      </main>

      {/* ── Columna derecha — siempre visible ── */}
      <div className="right-panel-unified" style={{
        width: rightPanelW,
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        flexShrink: 0, overflow: 'hidden',
        position: 'relative',
      }}>
        <div className="magic-panel-resize-bar" onMouseDown={handleRightPanelResizeDown} />
        <Suspense fallback={null}>
        <div
          key={panelKey}
          className={`right-panel-slide right-panel-slide--${panelSlideDir}`}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            paddingTop: rightPanel === 'planner' ? 0 : 32,
          }}
        >
          {rightPanel === 'magic' && (
            <MagicChat mode="panel" onClose={() => openPanel('filter')} currentNodeId={currentNodeIdFromRoute} />
          )}
          {rightPanel === 'filter' && (
            <SearchPanel filterText={filterText} onFilter={applyFilter} onClose={() => { setFilterText('') }} />
          )}
          {rightPanel === 'planner' && (
            <PlannerPanel onClose={() => openPanel('filter')} />
          )}
          {rightPanel === 'context' && contextNodeId && (
            <ContextNodePanel
              nodeId={contextNodeId}
              onClose={() => { setRightPanel('context-list'); setContextNodeId(null) }}
            />
          )}
          {rightPanel === 'context-list' && (
            <ContextListPanel
              onSelectContext={handleSelectContext}
              selectedContextId={contextNodeId}
            />
          )}
          {rightPanel === 'recorder' && (
            <RecorderPanel onClose={() => openPanel('filter')} />
          )}
        </div>
        </Suspense>
      </div>

      </div>{/* .main-body */}

      {/* ── Footer global ── */}
      <StatusBar isSyncing={s.isSyncing} showSaved={showSaved} />
      <Suspense fallback={null}>
        {paywallReason && (
          <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
        )}
        {showUnifiedCapture && (
          <UnifiedCapture
            onClose={() => setShowUnifiedCapture(false)}
            onSelectContext={(nodeId) => { handleSelectContext(nodeId); setShowUnifiedCapture(false) }}
          />
        )}
      </Suspense>
      {/* Botón FAB */}
      <button
        className="quick-capture-fab"
        onClick={() => setShowUnifiedCapture(true)}
        title="Nueva nota · buscar (Espacio)"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <Suspense fallback={null}>
        {showNewNote && <NewNoteModal onClose={() => setShowNewNote(false)} />}
        {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
        {showNewEvent && <NewEventModal onClose={() => setShowNewEvent(false)} />}
        {showVoiceCapture && <VoiceCaptureModal onClose={() => setShowVoiceCapture(false)} />}
        {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </Suspense>
      {/* Modal URL corta — renderizado a nivel global para sobrevivir al desmontaje del menú contextual */}
      {slugModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={() => setSlugModal(null)}
        >
          <div
            style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '28px 28px 24px', width: 420, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 16 }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>✂️ URL corta</span>
              <button onClick={() => setSlugModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Establece una URL corta para este nodo. Estará disponible en:<br />
              <code style={{ background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 12, color: 'var(--accent)' }}>
                {window.location.origin}/app/node/<strong>{slugInput || 'tu-slug'}</strong>
              </code>
            </p>
            <input
              ref={slugModalInputRef}
              type="text"
              value={slugInput}
              onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
              placeholder="mi-proyecto"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const clean = slugInput.trim()
                  if (clean) {
                    store.updateNode(slugModal.nodeId, { publicSlug: clean })
                    const url = `${window.location.origin}/app/node/${clean}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `URL copiada: /node/${clean}`, type: 'success' } }))
                  } else {
                    store.updateNode(slugModal.nodeId, { publicSlug: null })
                  }
                  setSlugModal(null)
                }
                if (e.key === 'Escape') setSlugModal(null)
              }}
              style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
              autoFocus
            />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Solo letras minúsculas, números y guiones. Déjalo vacío para eliminar la URL corta.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSlugModal(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  const clean = slugInput.trim()
                  if (clean) {
                    store.updateNode(slugModal.nodeId, { publicSlug: clean })
                    const url = `${window.location.origin}/app/node/${clean}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `URL copiada: /node/${clean}`, type: 'success' } }))
                  } else {
                    store.updateNode(slugModal.nodeId, { publicSlug: null })
                  }
                  setSlugModal(null)
                }}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >
                Guardar y copiar
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        className="mobile-fab"
        onClick={() => setShowUnifiedCapture(true)}
        title="Búsqueda rápida"
        aria-label="Abrir búsqueda"
      >
        +
      </button>
      <Suspense fallback={null}><OnboardingWidget /></Suspense>
      {/* sync-indicator eliminado — el footer ya muestra el estado de sync */}
    </div>
    </ToastProvider>
  )
}
