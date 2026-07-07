import { Component, ErrorInfo, ReactNode, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getToken, setTokens } from './api/client'
import { store } from './store/nodeStore'
import { userStore } from './store/userStore'
import { connectGoogle } from './api/googleCalendar'
import AuthPage from './components/auth/AuthPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import ClaudeConnectPage from './components/auth/ClaudeConnectPage'
import MainLayout from './components/layout/MainLayout'
import PricingView from './components/views/PricingView'
import CaptureWindow from './components/modals/CaptureWindow'

// Fromly 2.0 — beta chat-first AISLADA (ruta /v2). Lazy para no cargar en la v1.
const V2App = lazy(() => import('./v2/V2App'))

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; didHardReload: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null, didHardReload: false }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fromly Web error:', error, info)
    // Auto-recuperación: si es un error de chunk dinámico (deploy nuevo), hacer hard reload automático.
    // (lazyWithReload ya intercepta la mayoría de estos antes de llegar aquí; esto es el último recurso.)
    const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module') ||
                         error?.message?.includes('Importing a module script failed')
    if (!isChunkError || this.state.didHardReload) return
    // Respetar la guardia anti-bucle compartida con lazyWithReload (no recargar dos veces).
    const last = Number(sessionStorage.getItem('from_chunk_reload_at') || 0)
    if (Date.now() - last < 10_000) return
    this.setState({ didHardReload: true })
    try {
      sessionStorage.setItem('from_chunk_reload_at', String(Date.now()))
      // Preservar ruta Y query (ej. /app/settings?tab=…), solo añadir ?v= para saltar caché.
      const u = new URL(window.location.href)
      u.searchParams.set('v', String(Date.now()))
      window.location.replace(u.toString())
    } catch { /* noop */ }
  }
  render() {
    if (this.state.error) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module')
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ color: '#8b5cf6' }}>Fromly</h2>
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
        <h2 style={{ color: '#8b5cf6' }}>Fromly</h2>
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
      <h2 style={{ color: '#8b5cf6' }}>Fromly</h2>
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
      {/* Claude OAuth consent — maneja su propio estado de auth */}
      <Route path="/claude-connect" element={<ClaudeConnectPage />} />
      {/* Fromly 2.0 — beta chat-first aislada. NO toca la v1 (MainLayout intacto). */}
      <Route path="/v2/*" element={
        <PrivateRoute>
          <Suspense fallback={<div className="v2-loading">Cargando Fromly 2.0…</div>}>
            <V2App />
          </Suspense>
        </PrivateRoute>
      } />
      {/* Toda la app requiere cuenta */}
      <Route path="/*" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
    </Routes>
  )
}

// Resuelve el label de la ventana Tauri actual ('main' | 'capture').
// En web siempre es 'main'. En Tauri se lee de forma síncrona tras importar la API.
function useWindowLabel(): string | null {
  const [label, setLabel] = useState<string | null>(isTauriEnv ? null : 'main')
  useEffect(() => {
    if (!isTauriEnv) return
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        try { setLabel(getCurrentWindow().label) } catch { setLabel('main') }
      })
      .catch(() => setLabel('main'))
  }, [])
  return label
}

export default function App() {
  const windowLabel = useWindowLabel()
  // En Tauri, esperar a resolver el label antes de montar nada (evita flash).
  if (windowLabel === null) return null
  if (windowLabel === 'capture') {
    return (
      <ErrorBoundary>
        <CaptureWindow />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}

export { PrivateRoute }
