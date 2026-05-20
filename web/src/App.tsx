import { Component, ErrorInfo, ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './api/client'
import AuthPage from './components/auth/AuthPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import MainLayout from './components/layout/MainLayout'
import PricingView from './components/views/PricingView'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('From Web error:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ color: '#8b5cf6' }}>From</h2>
          <p style={{ color: '#666', margin: '16px 0' }}>Ha ocurrido un error al cargar.</p>
          <button
            onClick={() => window.location.reload()}
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

// Rutas que requieren cuenta — redirigen a login si no hay sesión
function AccountRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pricing" element={<PricingView />} />
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </ErrorBoundary>
  )
}

export { AccountRoute }
