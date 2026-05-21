import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'
import Sidebar from '../sidebar/Sidebar'
import NodeView from '../views/NodeView'

// Redirige / → /node/{diario de hoy}.
// Es REACTIVO: se suscribe al store via useStore() y navega en cuanto
// el diario esté disponible, evitando que NodeView se renderice con node=undefined.
function DiaryRedirect() {
  const navigate = useNavigate()
  const s = useStore()          // re-renderiza cuando el store cambia
  const diary = s.todayDiary()  // se recalcula en cada re-render

  useEffect(() => {
    if (diary) {
      navigate(`/node/${diary.id}`, { replace: true })
    }
    // Si diary es null, el store aún no ha cargado.
    // Cuando cargue, useStore() provocará un re-render y diary dejará de ser null.
  }, [diary?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="view-loading">Cargando diario...</div>
}
const TasksView = lazy(() => import('../views/TasksView'))
const SearchView = lazy(() => import('../views/SearchView'))
const AccountView = lazy(() => import('../views/AccountView'))
const CalendarView = lazy(() => import('../views/CalendarView'))
const AgentsView = lazy(() => import('../views/AgentsView'))
const ChatView = lazy(() => import('../views/ChatView'))
const KanbanView = lazy(() => import('../views/KanbanView'))
const TagView = lazy(() => import('../views/TagView'))
const FollowupView = lazy(() => import('../views/FollowupView'))
const FilesView = lazy(() => import('../views/FilesView'))
const InboxView = lazy(() => import('../views/InboxView'))
const TrashView = lazy(() => import('../views/TrashView'))
import PaywallModal from '../paywall/PaywallModal'
import CommandPalette from '../CommandPalette'
import NewTaskModal from '../modals/NewTaskModal'
import NewNoteModal from '../modals/NewNoteModal'
import NewEventModal from '../modals/NewEventModal'
import VoiceCaptureModal from '../modals/VoiceCaptureModal'
import KeyboardShortcutsModal from '../modals/KeyboardShortcutsModal'
import QuickCapturePanel from '../modals/QuickCapturePanel'
import OnboardingTooltip from '../onboarding/OnboardingTooltip'
import TopBar from './TopBar'
import StatusBar from './StatusBar'
import { useTaskNotifications } from '../../hooks/useTaskNotifications'
import { ToastProvider } from '../Toast'

export default function MainLayout() {
  const navigate = useNavigate()
  const s = useStore()
  const [loadError, setLoadError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const prevIsSyncing = useRef(false)

  useTaskNotifications()

  useEffect(() => {
    store.isGuest = false
    store.initialLoad().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'UNAUTHORIZED') {
        clearTokens()
        navigate('/login', { replace: true })
      } else {
        setLoadError(msg)
      }
    })
    userStore.fetchMe()
  }, [navigate])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { reason: 'node_limit' | 'ai_limit' }
      setPaywallReason(detail.reason)
    }
    window.addEventListener('from:paywall', handler)
    return () => window.removeEventListener('from:paywall', handler)
  }, [])

  // Cmd+N / Ctrl+N → new note
  // Cmd+K / Ctrl+K → command palette
  // Cmd+T / Ctrl+T → new task
  // Cmd+E / Ctrl+E → new event
  // Cmd+R / Ctrl+R → voice capture
  // Escape → go home (if no modal/input focused)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowNewNote(true)
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowCommandPalette(v => !v)
      }
      // Cmd+Shift+S → toggle sidebar
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setSidebarOpen(v => !v)
      }
      if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowNewTask(true)
      }
      if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowNewEvent(true)
      }
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowVoiceCapture(true)
      }
      if (e.key === 'q' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowQuickCapture(v => !v)
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
          '1': '/', '2': '/tasks', '3': '/calendar',
          '4': '/search', '5': '/kanban', '6': '/followup',
          '7': '/agents', '8': '/chat',
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
        const active = document.activeElement
        const isInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          (active as HTMLElement)?.isContentEditable
        // Comprobar también si hay algún menú flotante visible en el DOM (slash menu, pickers)
        const hasFloatingMenu = !!document.querySelector('.slash-menu, .inline-picker, .mention-picker')
        if (!isInputFocused && !showCommandPalette && !showNewTask && !showNewEvent && !showVoiceCapture && !hasFloatingMenu) {
          // setTimeout 0 para dejar que los handlers de Escape actuales completen primero
          setTimeout(() => navigate('/'), 0)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, showCommandPalette, showNewTask, showNewEvent, showVoiceCapture, showShortcuts, showQuickCapture])

  // Detectar cambio isSyncing true → false para mostrar "✓ Guardado"
  useEffect(() => {
    if (prevIsSyncing.current && !s.isSyncing) {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(t)
    }
    prevIsSyncing.current = s.isSyncing
  }, [s.isSyncing])

  function handleLogout() {
    clearTokens()
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
    <div className={`main-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onLogout={handleLogout}
        isSyncing={s.isSyncing}
        isGuest={false}
      />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="main-content">
        {/* Banner de login cuando no hay cuenta conectada */}
        {s.isGuest && (
          <div className="guest-sync-banner">
            <span className="guest-sync-icon">☁</span>
            <span className="guest-sync-text">Modo sin cuenta — los cambios solo se guardan en este navegador</span>
            <button className="guest-sync-cta" onClick={() => navigate('/account')}>
              Conectar cuenta →
            </button>
          </div>
        )}
        {/* TopBar global */}
        <TopBar
          onNewNote={() => setShowNewNote(true)}
          onCommandPalette={() => setShowCommandPalette(v => !v)}
          onNewTask={() => setShowNewTask(true)}
          onNewEvent={() => setShowNewEvent(true)}
          onVoiceCapture={() => setShowVoiceCapture(true)}
        />
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
          <Route index element={<DiaryRedirect />} />
          <Route path="tasks" element={<TasksView />} />
          <Route path="followup" element={<FollowupView />} />
          <Route path="search" element={<SearchView />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="kanban" element={<KanbanView />} />
          <Route path="agents" element={<AgentsView />} />
          <Route path="chat" element={<ChatView />} />
          <Route path="account" element={<AccountView />} />
          <Route path="node/:id" element={<NodeView />} />
          <Route path="tag/:name" element={<TagView />} />
          <Route path="files" element={<FilesView />} />
          <Route path="inbox" element={<InboxView />} />
          <Route path="trash" element={<TrashView />} />
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
        <StatusBar isSyncing={s.isSyncing} />
      </main>
      {paywallReason && (
        <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
      )}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
      {showNewNote && <NewNoteModal onClose={() => setShowNewNote(false)} />}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
      {showNewEvent && <NewEventModal onClose={() => setShowNewEvent(false)} />}
      {showVoiceCapture && <VoiceCaptureModal onClose={() => setShowVoiceCapture(false)} />}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showQuickCapture && <QuickCapturePanel onClose={() => setShowQuickCapture(false)} />}
      <button
        className="mobile-fab"
        onClick={() => setShowCommandPalette(true)}
        title="Búsqueda rápida"
        aria-label="Abrir búsqueda"
      >
        +
      </button>
      <OnboardingTooltip />
      {(s.isSyncing || showSaved) && (
        <div className="sync-indicator">
          {s.isSyncing ? (
            <>
              <div className="sync-spinner" />
              <span>Sincronizando...</span>
            </>
          ) : (
            <span>✓ Guardado</span>
          )}
        </div>
      )}
    </div>
    </ToastProvider>
  )
}
