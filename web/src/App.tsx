import { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getToken, setTokens } from './api/client'
import { store } from './store/nodeStore'
import { userStore } from './store/userStore'
import { connectGoogle } from './api/googleCalendar'
import AuthPage from './components/auth/AuthPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import MainLayout from './components/layout/MainLayout'
import PricingView from './components/views/PricingView'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; didHardReload: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null, didHardReload: false }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('From Web error:', error, info)
    // Auto-recuperación: si es un error de chunk dinámico (deploy nuevo), hacer hard reload automático
    const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module') ||
                         error?.message?.includes('Importing a module script failed')
    if (isChunkError && !this.state.didHardReload) {
      this.setState({ didHardReload: true })
      // Hard reload sin caché: añadir ?v= timestamp para forzar nueva petición
      const url = window.location.href.replace(/[?#].*$/, '') + '?v=' + Date.now()
      window.location.replace(url)
    }
  }
  render() {
    if (this.state.error) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module')
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ color: '#8b5cf6' }}>From</h2>
          <p style={{ color: '#666', margin: '16px 0' }}>
            {isChunkError ? 'Actualizando la app...' : 'Ha ocurrido un error al cargar.'}
          </p>
          <button
            onClick={() => {
              // Hard reload para asegurar chunks frescos
              const url = window.location.href.replace(/[?#].*$/, '') + '?v=' + Date.now()
              window.location.replace(url)
            }}
            style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
          <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '12px', color: '#999' }}>
            <summary>Detalles del error</summary>
            <pre>{this.state.error.toString()}</pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

// Rutas protegidas — redirigen a login si no hay sesión
function PrivateRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />
}

// Maneja el callback de OAuth de Google
function GoogleCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('No se recibió el código de autorización de Google.')
      return
    }
    const redirectUri = window.location.origin + '/app/google-callback'
    connectGoogle(code, redirectUri)
      .then(() => {
        // Hard reload para que DiaryRightPanel refetche con la nueva conexión Google
        window.location.replace(window.location.origin + '/app/')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error al conectar con Google.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ color: '#8b5cf6' }}>From</h2>
        <p style={{ color: '#e53e3e', margin: '16px 0' }}>{error}</p>
        <button
          onClick={() => navigate('/app/', { replace: true })}
          style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          {t('app.backToHome')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ color: '#8b5cf6' }}>From</h2>
      <p style={{ color: '#666', margin: '16px 0' }}>Conectando con Google...</p>
    </div>
  )
}

// Maneja deep links de OAuth desktop: from://auth-callback?accessToken=...&refreshToken=...
const isTauriEnv = import.meta.env.VITE_TAURI === 'true'

function handleOAuthUrl(url: string) {
  if (!url.includes('auth-callback')) return
  try {
    const params = new URL(url).searchParams
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken)
      window.location.href = '/'
    }
  } catch {}
}

function useDesktopOAuthCallback() {
  useEffect(() => {
    if (!isTauriEnv) return
    let unlisten: (() => void) | null = null

    // Escuchar deep links via tauri-plugin-deep-link (método correcto en Tauri v2)
    import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
      onOpenUrl((urls) => {
        for (const url of urls) handleOAuthUrl(url)
      }).then((fn) => { unlisten = fn })
    }).catch(() => {
      // Fallback: escuchar evento emitido desde Rust via @tauri-apps/api
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('oauth-callback', (event) => {
          handleOAuthUrl(event.payload)
        }).then((fn) => { unlisten = fn })
      }).catch(() => {})
    })

    return () => { unlisten?.() }
  }, [])
}

// Detecta ?welcome=1 al volver del checkout de LemonSqueezy y refresca el estado del usuario
// hasta que isPremium sea true (máx 30s con polling cada 2s)
function usePostCheckoutRefresh() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!searchParams.has('welcome')) return

    // Limpiar parámetro de la URL sin recargar
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('welcome'); return p }, { replace: true })

    // Refrescar inmediatamente
    userStore.fetchMe().catch(() => {})

    // Polling cada 2s hasta confirmar Pro (máx 30s = 15 intentos)
    let attempts = 0
    pollingRef.current = setInterval(async () => {
      attempts++
      try { await userStore.fetchMe() } catch { /* ignore */ }
      if (userStore.isPremium || attempts >= 15) {
        if (pollingRef.current) clearInterval(pollingRef.current)
      }
    }, 2000)

    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

// Sync disparado desde Rust (timer 15s + foco de ventana)
function useTauriSyncListener() {
  useEffect(() => {
    if (!isTauriEnv) return
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('from:sync', () => {
        store.sync().catch(() => {})
      }).then((fn) => { unlisten = fn })
    }).catch(() => {})
    return () => { unlisten?.() }
  }, [])
}

function AppInner() {
  useDesktopOAuthCallback()
  useTauriSyncListener()
  usePostCheckoutRefresh()
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage initialMode="register" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/pricing" element={<PricingView />} />
      {/* Google OAuth callback — accesible sin estar en MainLayout pero requiere token */}
      <Route path="/google-callback" element={<PrivateRoute><GoogleCallbackPage /></PrivateRoute>} />
      {/* Toda la app requiere cuenta */}
      <Route path="/*" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}

export { PrivateRoute }
