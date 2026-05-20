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
import GuestBanner from './GuestBanner'
import PaywallModal from '../paywall/PaywallModal'

export default function MainLayout() {
  const navigate = useNavigate()
  const s = useStore()
  const isGuest = !getToken()
  const [loadError, setLoadError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)

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
          <Route path="account" element={
            isGuest ? <Navigate to="/login" replace /> : <AccountView />
          } />
          <Route path="node/:id" element={<NodeView />} />
        </Routes>
      </main>
      {paywallReason && (
        <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
      )}
    </div>
  )
}
