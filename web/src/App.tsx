import { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getToken } from './api/client'
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
        navigate('/app/', { replace: true })
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
          Volver al inicio
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

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pricing" element={<PricingView />} />
        {/* Google OAuth callback — accesible sin estar en MainLayout pero requiere token */}
        <Route path="/app/google-callback" element={<PrivateRoute><GoogleCallbackPage /></PrivateRoute>} />
        {/* Toda la app requiere cuenta */}
        <Route path="/*" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
      </Routes>
    </ErrorBoundary>
  )
}

export { PrivateRoute }
