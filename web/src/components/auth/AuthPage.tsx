import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { login, register, apiRequest, setTokens } from '../../api/client'

// Google / Apple client IDs (web)
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined
const APPLE_WEB_SERVICE_ID = import.meta.env.VITE_APPLE_WEB_SERVICE_ID as string | undefined
const APPLE_REDIRECT_URI   = import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined

// En Tauri: OAuth se abre en el browser del sistema vía tauri-plugin-shell
const isTauri = import.meta.env.VITE_TAURI === 'true'

async function openInBrowser(url: string) {
  if (isTauri) {
    // Importación dinámica para no romper el build web
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } else {
    window.open(url, '_blank')
  }
}

// Carga dinámica de scripts de terceros (Google/Apple) — solo en AuthPage
// Así no interfieren con el DOM de React en el resto de la app
function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById(id)) { resolve(); return }
    const script = document.createElement('script')
    script.src = src
    script.id = id
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve() // silencia errores de red
    document.head.appendChild(script)
  })
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (el: HTMLElement, config: object) => void
          prompt: () => void
        }
      }
    }
    AppleID?: {
      auth: {
        init: (config: object) => void
        signIn: () => Promise<{ authorization: { id_token: string; code: string }; user?: { email?: string; name?: { firstName?: string; lastName?: string } } }>
      }
    }
  }
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
}

interface AuthPageProps {
  initialMode?: 'login' | 'register'
}

export default function AuthPage({ initialMode = 'login' }: AuthPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { message?: string } | null
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('register') === '1') setMode('register')
  }, [location.search])

  // Carga scripts de Google/Apple solo en esta página
  useEffect(() => {
    loadScript('https://accounts.google.com/gsi/client', 'gsi-script')
    loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js', 'apple-script')
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)

  // ── Google Sign-In ───────────────────────────────────────────────────────

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleLoading(true)
    setError('')
    try {
      const data = await apiRequest<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken: credential }),
      })
      setTokens(data.accessToken, data.refreshToken)
      navigate(mode === 'register' ? '/pricing' : '/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.errorGoogleUnavailable'))
    } finally {
      setGoogleLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) return
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval)
        window.google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: (response: { credential: string }) => {
            handleGoogleCredential(response.credential)
          },
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [handleGoogleCredential])

  async function handleGoogleClick() {
    if (isTauri) {
      // En Tauri: el servidor Railway actúa de intermediario OAuth
      // Google → from-server/auth/google-desktop-callback → from://auth-callback?tokens
      await openInBrowser('https://from-server-production.up.railway.app/auth/google-desktop')
      return
    }
    if (!GOOGLE_WEB_CLIENT_ID || !window.google?.accounts?.id) {
      setError(t('auth.errorGoogleUnavailable'))
      return
    }
    window.google.accounts.id.prompt()
  }

  // ── Apple Sign-In ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!APPLE_WEB_SERVICE_ID || !APPLE_REDIRECT_URI) return
    const interval = setInterval(() => {
      if (window.AppleID?.auth) {
        clearInterval(interval)
        window.AppleID.auth.init({
          clientId: APPLE_WEB_SERVICE_ID,
          scope: 'email name',
          redirectURI: APPLE_REDIRECT_URI,
          usePopup: true,
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  async function handleAppleClick() {
    if (isTauri) {
      // En Tauri: el servidor Railway actúa de intermediario OAuth
      // Apple → from-server/auth/apple-desktop-callback → from://auth-callback?tokens
      await openInBrowser('https://from-server-production.up.railway.app/auth/apple-desktop')
      return
    }
    if (!APPLE_WEB_SERVICE_ID || !window.AppleID?.auth) {
      setError(t('auth.errorAppleUnavailable'))
      return
    }
    setAppleLoading(true)
    setError('')
    try {
      const response = await window.AppleID.auth.signIn()
      const identityToken = response.authorization.id_token
      const emailFromApple = response.user?.email
      const data = await apiRequest<AuthResponse>('/auth/apple', {
        method: 'POST',
        body: JSON.stringify({
          identityToken,
          authorizationCode: response.authorization.code,
          email: emailFromApple,
        }),
      })
      setTokens(data.accessToken, data.refreshToken)
      navigate(mode === 'register' ? '/pricing' : '/', { replace: true })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'error' in err) {
        // User cancelled Apple sign-in — no mostrar error
        return
      }
      setError(err instanceof Error ? err.message : t('auth.errorAppleUnavailable'))
    } finally {
      setAppleLoading(false)
    }
  }

  // ── Email/Password ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
        // Tras registro → elegir plan
        navigate('/pricing', { replace: true })
        return
      }
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.errorUnknown')
      setError(msg === 'UNAUTHORIZED' ? t('auth.errorInvalidCredentials') : msg)
    } finally {
      setLoading(false)
    }
  }

  const showGoogle = !!GOOGLE_WEB_CLIENT_ID
  const showApple  = !!APPLE_WEB_SERVICE_ID

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#8b5cf6"/>
            <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">F</text>
          </svg>
          <span>From</span>
        </div>

        <h1>{mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? t('auth.loginSubtitle')
            : t('auth.registerSubtitle')}
        </p>

        {locationState?.message && (
          <div className="auth-success">{locationState.message}</div>
        )}

        {/* ── Social buttons ── */}
        {(showGoogle || showApple) && (
          <div className="social-buttons">
            {showGoogle && (
              <button
                type="button"
                className="social-btn social-btn--google"
                onClick={handleGoogleClick}
                disabled={googleLoading || appleLoading}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                {googleLoading ? t('auth.connecting') : t('auth.continueWithGoogle')}
              </button>
            )}

            {showApple && (
              <button
                type="button"
                className="social-btn social-btn--apple"
                onClick={handleAppleClick}
                disabled={googleLoading || appleLoading}
              >
                <svg width="17" height="20" viewBox="0 0 814 1000" fill="currentColor">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.1-49 190.5-49 30.1 0 108.2 2.6 168.1 80.1zm-191.5-57.8c-3.9-19.4-11.6-51.9-33.2-81.3-21.1-27.9-53.2-48.3-86.4-48.3-.6 0-1.3 0-1.9.1 2.4 23.5 11.9 56 33.8 85.1 22.6 30.6 57.8 52.1 87.7 44.4z"/>
                </svg>
                {appleLoading ? t('auth.connecting') : t('auth.continueWithApple')}
              </button>
            )}

            {(showGoogle || showApple) && (
              <div className="social-divider">
                <span>{t('auth.orContinueWithEmail')}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Email/password form ── */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label htmlFor="email">{t('auth.emailLabel')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">{t('auth.passwordLabel')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || googleLoading || appleLoading}>
            {loading ? t('auth.loading') : mode === 'login' ? t('auth.loginButton') : t('auth.registerButton')}
          </button>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/forgot-password')}
              >
                {t('auth.forgotPasswordLink')}
              </button>
            </p>
          )}
        </form>

        <p className="auth-toggle">
          {mode === 'login' ? t('auth.noAccount') : t('auth.alreadyAccount')}
          {' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          >
            {mode === 'login' ? t('auth.signUpLink') : t('auth.signInLink')}
          </button>
        </p>
      </div>
    </div>
  )
}
