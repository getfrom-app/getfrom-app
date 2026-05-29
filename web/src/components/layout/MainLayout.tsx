import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useFilterStore, setActiveFilter } from '../../store/filterStore'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'
import Sidebar from '../sidebar/Sidebar'
import StatusBar from './StatusBar'
import NodeView from '../views/NodeView'

import WFHomeView from '../views/WFHomeView'
import { relocateRootDiariesToAgenda, getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'

// Redirige /followup → /node/{diario de hoy} (ruta legacy).
function DiaryRedirect() {
  const navigate = useNavigate()
  const s = useStore()
  const diary = s.todayDiary()
  useEffect(() => {
    if (diary) navigate(`/node/${diary.id}`, { replace: true })
  }, [diary?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="view-loading">Cargando diario...</div>
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
import PlannerPanel from '../panels/PlannerPanel'
import PaywallModal from '../paywall/PaywallModal'
import CommandPalette from '../CommandPalette'
import MagicChat from '../aichat/MagicChat'
import AIChatFloatingButton from '../aichat/AIChatFloatingButton'
import NewTaskModal from '../modals/NewTaskModal'
import NewNoteModal from '../modals/NewNoteModal'
import NewEventModal from '../modals/NewEventModal'
import VoiceCaptureModal from '../modals/VoiceCaptureModal'
import KeyboardShortcutsModal from '../modals/KeyboardShortcutsModal'
import QuickCapturePanel from '../modals/QuickCapturePanel'
import OnboardingTooltip from '../onboarding/OnboardingTooltip'
import OnboardingWidget from '../onboarding/OnboardingWidget'
import WFTopBar from './WFTopBar'
import TrialBanner from './TrialBanner'
import { useTaskNotifications } from '../../hooks/useTaskNotifications'
import { ToastProvider } from '../Toast'
import { syncTagDefinitions, cleanupSpuriousTags, migrateTagsToContexto, ensurePerfilInsideContexto, ensurePlantillasNode } from '../../utils/tagsHelper'
import { ensureAtajosNode, migrateLocalStorageShortcuts } from '../../utils/atajosHelper'
import { ensureAgentesNode } from '../../utils/agentesHelper'
import { ensurePapeleraNode } from '../../utils/papeleraHelper'
import { invalidatePredictionCache } from '../../store/predictionStore'

export default function MainLayout() {
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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [plannerOpen, setPlannerOpen] = useState(false)

  // R global hold-to-record
  const isRKeyDownRef = useRef(false)

  // Sidebar resize state
  const sidebarWidthRef = useRef(parseInt(localStorage.getItem('from_sidebar_width') || '220'))
  const [sidebarWidth, setSidebarWidthState] = useState(sidebarWidthRef.current)
  function setSidebarWidth(w: number) { sidebarWidthRef.current = w; setSidebarWidthState(w) }

  function handleDividerMouseDown(e: React.MouseEvent) {
    if (!sidebarOpen) { setSidebarOpen(true); return }
    const startX = e.clientX
    const startW = sidebarWidthRef.current
    document.body.classList.add('sidebar-resizing')
    function onMove(ev: MouseEvent) {
      const w = Math.max(160, Math.min(520, startW + ev.clientX - startX))
      setSidebarWidth(w)
    }
    function onUp() {
      document.body.classList.remove('sidebar-resizing')
      localStorage.setItem('from_sidebar_width', String(sidebarWidthRef.current))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false)
  const [filterText, setFilterText] = useFilterStore()
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
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowCommandPalette(v => !v)
      }
      // H (sin modificador) → ir al diario de hoy sin crear nodo
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          const today = getTodayDiaryUnderAgenda()
          navigate(`/node/${today.id}`)
        }
      }
      // N (sin modificador) → crear nodo en el diario de hoy y enfocar
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
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
      // Cmd+J o Espacio (sin input activo) → Magic Chat (solo abre)
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowAIChat(v => !v)
      }
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          setShowAIChat(true)
        }
      }
      // R (mantener, sin input activo) → abre Magic Chat + empieza a grabar
      if (e.code === 'KeyR' && !e.repeat && !isRKeyDownRef.current && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          isRKeyDownRef.current = true
          setShowAIChat(true)
          // Pequeño delay para que MagicChat monte y registre el listener
          setTimeout(() => window.dispatchEvent(new Event('magic-chat:record-start')), 40)
        }
      }
      // P (sin modificador) → toggle planificador
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          setPlannerOpen(v => !v)
        }
      }
      // Cmd+Shift+S → toggle sidebar
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setSidebarOpen(v => !v)
      }
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
      // Cmd+Shift+C → colapsar todos / expandir todos (toggle)
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        const anyCollapsed = store.allActive().some(n => n.isCollapsed)
        if (anyCollapsed) {
          store.expandAll(null)
        } else {
          store.collapseAll(null)
        }
      }
      if (e.key === '?') {
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
        if (showCommandPalette || showNewTask || showNewEvent || showVoiceCapture || showShortcuts || showQuickCapture) return

        // Prioridad 2: cerrar menús flotantes (slash, pickers, etc.) — sus propios handlers lo harán
        const hasFloatingMenu = !!document.querySelector('.slash-menu, .inline-picker, .wf-topbar-dropdown')
        if (hasFloatingMenu) return

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

        // Prioridad 5: subir en la jerarquía (Escape sube al padre)
        // Si estamos en /node/:id → navegar al padre, o a root si no hay padre
        const match = window.location.pathname.match(/\/node\/([^/]+)/)
        if (match) {
          const nodeId = match[1]
          const node = store.getNode(nodeId)
          if (node?.parentId) {
            navigate(`/node/${node.parentId}`)
          } else {
            navigate('/')
          }
        }
        // Si ya estamos en root '/' no hacemos nada
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'KeyR' && isRKeyDownRef.current) {
        isRKeyDownRef.current = false
        window.dispatchEvent(new Event('magic-chat:record-stop'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [navigate, showCommandPalette, showNewTask, showNewEvent, showVoiceCapture, showShortcuts, showQuickCapture])

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
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    )
  }

  return (
    <ToastProvider>
    <div className={`main-layout wf-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${plannerOpen ? 'planner-open' : ''}`} style={{ '--sw': `${sidebarWidth}px` } as React.CSSProperties}>

      {/* ── Traffic lights row (solo Mac) ── */}
      <div
        className="traffic-bar"
        style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
      />

      {/* ── Cabecera unificada ── */}
      <div className="app-header">
        {/* Parte izquierda: toggle + branding (misma anchura que sidebar) */}
        <div className={`header-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(v => !v)}
            title="Toggle sidebar (⌘⇧S)"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="11.5" width="12" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>
          {sidebarOpen && (
            <button
              onClick={() => navigate('/')}
              className="header-brand"
              title="Inicio"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="22" fill="#8b5cf6"/>
                <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">F</text>
              </svg>
              <span>From</span>
            </button>
          )}
        </div>
        {/* Parte derecha: WFTopBar */}
        <WFTopBar
          onFilter={setFilterText}
          filterText={filterText}
          onCommandPalette={() => setShowCommandPalette(v => !v)}
          onLogout={handleLogout}
          onOpenSettings={() => navigate('/settings')}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          sidebarOpen={sidebarOpen}
          onTogglePlanner={() => setPlannerOpen(v => !v)}
          plannerOpen={plannerOpen}
        />
      </div>

      {/* ── main-row: sidebar + contenido ── */}
      <div className="main-row">
      {/* Sidebar (sin sidebar-brand-section) */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onLogout={handleLogout}
        isSyncing={s.isSyncing}
        showSaved={showSaved}
        isGuest={false}
        onOpenSettings={() => navigate('/settings')}
      />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* ── Columna derecha: contenido ── */}
      <div className="main-body">
      <main className="main-content">
        <TrialBanner />
        {/* Mobile hamburger */}
        <div className="mobile-header">
          <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1"/>
              <rect y="9" width="20" height="2" rx="1"/>
              <rect y="15" width="20" height="2" rx="1"/>
            </svg>
          </button>
          <div className="mobile-logo">
            <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="22" fill="#8b5cf6"/>
              <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">F</text>
            </svg>
            <span>From</span>
          </div>
        </div>
        <Suspense fallback={<div className="view-loading">Cargando...</div>}>
        <Routes>
          <Route index element={<WFHomeView filterText={filterText} />} />
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

      {/* ── Planner Panel — timeline lateral derecho ── */}
      {plannerOpen && (
        <PlannerPanel onClose={() => setPlannerOpen(false)} />
      )}

      </div>{/* .main-body */}
      </div>{/* .main-row */}
      {/* ── Footer global: de extremo a extremo, fuera del main-row ── */}
      <StatusBar isSyncing={s.isSyncing} showSaved={showSaved} />
      {paywallReason && (
        <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
      )}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
      <AIChatFloatingButton onClick={() => setShowAIChat(true)} isOpen={showAIChat} />
      {showAIChat && (
        <MagicChat onClose={() => setShowAIChat(false)} currentNodeId={currentNodeIdFromRoute} />
      )}
      {showNewNote && <NewNoteModal onClose={() => setShowNewNote(false)} />}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
      {showNewEvent && <NewEventModal onClose={() => setShowNewEvent(false)} />}
      {showVoiceCapture && <VoiceCaptureModal onClose={() => setShowVoiceCapture(false)} />}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showQuickCapture && <QuickCapturePanel onClose={() => setShowQuickCapture(false)} />}
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
        onClick={() => setShowCommandPalette(true)}
        title="Búsqueda rápida"
        aria-label="Abrir búsqueda"
      >
        +
      </button>
      <OnboardingTooltip />
      <OnboardingWidget />
      {/* sync-indicator eliminado — el footer ya muestra el estado de sync */}
    </div>
    </ToastProvider>
  )
}
