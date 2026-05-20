import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { clearTokens, getToken } from '../../api/client'
import { userStore } from '../../store/userStore'
import Sidebar from '../sidebar/Sidebar'
import DiaryView from '../views/DiaryView'
import NodeView from '../views/NodeView'
import TasksView from '../views/TasksView'
import SearchView from '../views/SearchView'
import AccountView from '../views/AccountView'
import CalendarView from '../views/CalendarView'
import AgentsView from '../views/AgentsView'
import KanbanView from '../views/KanbanView'
import GuestBanner from './GuestBanner'
import PaywallModal from '../paywall/PaywallModal'
import CommandPalette from '../CommandPalette'
import NewTaskModal from '../modals/NewTaskModal'
import NewEventModal from '../modals/NewEventModal'
import VoiceCaptureModal from '../modals/VoiceCaptureModal'
import OnboardingTooltip from '../onboarding/OnboardingTooltip'

export default function MainLayout() {
  const navigate = useNavigate()
  const s = useStore()
  const isGuest = !getToken()
  const [loadError, setLoadError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)

  useEffect(() => {
    if (isGuest) {
      store.isGuest = true
      store.loadGuest().catch(console.error)
    } else {
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
    }
  }, [navigate, isGuest])

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
        const newNode = store.createNode({ text: '', parentId: null })
        navigate(`/node/${newNode.id}`)
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowCommandPalette(v => !v)
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
      if (e.key === 'Escape') {
        const active = document.activeElement
        const isInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          (active as HTMLElement)?.isContentEditable
        if (!isInputFocused && !showCommandPalette && !showNewTask && !showNewEvent && !showVoiceCapture) {
          navigate('/')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, showCommandPalette, showNewTask, showNewEvent, showVoiceCapture])

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
    <div className={`main-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {isGuest && <GuestBanner />}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onLogout={handleLogout}
        isSyncing={s.isSyncing}
        isGuest={isGuest}
      />
      <main className="main-content" style={isGuest ? { paddingTop: '40px' } : undefined}>
        <Routes>
          <Route index element={<DiaryView />} />
          <Route path="tasks" element={<TasksView />} />
          <Route path="search" element={<SearchView />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="kanban" element={<KanbanView />} />
          <Route path="agents" element={<AgentsView />} />
          <Route path="account" element={
            isGuest ? <Navigate to="/login" replace /> : <AccountView />
          } />
          <Route path="node/:id" element={<NodeView />} />
        </Routes>
      </main>
      {paywallReason && (
        <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
      )}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
      {showNewEvent && <NewEventModal onClose={() => setShowNewEvent(false)} />}
      {showVoiceCapture && <VoiceCaptureModal onClose={() => setShowVoiceCapture(false)} />}
      <OnboardingTooltip />
    </div>
  )
}
