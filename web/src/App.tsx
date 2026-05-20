import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './api/client'
import AuthPage from './components/auth/AuthPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import MainLayout from './components/layout/MainLayout'
import PricingView from './components/views/PricingView'

// Rutas que requieren cuenta — redirigen a login si no hay sesión
function AccountRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/pricing" element={<PricingView />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  )
}

export { AccountRoute }
