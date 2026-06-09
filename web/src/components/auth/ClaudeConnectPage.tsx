import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getToken, apiRequest } from '../../api/client'
import AuthPage from './AuthPage'

interface CodeResponse {
  code: string
}

export default function ClaudeConnectPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const clientId           = searchParams.get('client_id') ?? ''
  const redirectUri        = searchParams.get('redirect_uri') ?? ''
  const codeChallenge      = searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? 'S256'
  const state              = searchParams.get('state') ?? ''
  const responseType       = searchParams.get('response_type') ?? 'code'

  const isLoggedIn = !!getToken()

  // Si faltan parámetros imprescindibles, error directo
  const paramsValid = redirectUri && codeChallenge && responseType === 'code'

  // Si no está logueado, mostrar login preservando los params en la URL
  if (!isLoggedIn) {
    return (
      <div>
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          color: 'white',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '14px',
        }}>
          Inicia sesión en Fromly para conectar con Claude
        </div>
        <AuthPage />
      </div>
    )
  }

  async function handleAuthorize() {
    if (!paramsValid) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<CodeResponse>('/auth/claude/code', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uri:           redirectUri,
          code_challenge:         codeChallenge,
          code_challenge_method:  codeChallengeMethod,
          state:                  state || undefined,
        }),
      })

      // Redirigir a claude.ai con el code
      const callbackUrl = new URL(redirectUri)
      callbackUrl.searchParams.set('code', data.code)
      if (state) callbackUrl.searchParams.set('state', state)

      setDone(true)
      window.location.href = callbackUrl.toString()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al autorizar')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    if (!redirectUri) {
      navigate('/')
      return
    }
    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('error', 'access_denied')
    if (state) callbackUrl.searchParams.set('state', state)
    window.location.href = callbackUrl.toString()
  }

  if (!paramsValid) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <h2 style={titleStyle}>Solicitud inválida</h2>
          <p style={subtitleStyle}>Faltan parámetros requeridos para completar la autorización.</p>
          <button onClick={() => navigate('/')} style={secondaryButtonStyle}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <h2 style={titleStyle}>Autorizado</h2>
          <p style={subtitleStyle}>Redirigiendo a Claude...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Logo />
        <h2 style={titleStyle}>Conectar Fromly con Claude</h2>
        <p style={subtitleStyle}>
          Claude quiere acceder a tu vault de Fromly para guardar notas, tareas y contextos de tus conversaciones.
        </p>

        <div style={permissionsBox}>
          <p style={permissionsTitle}>Claude podrá:</p>
          <ul style={permissionsList}>
            <li>Leer y crear notas y tareas en tu vault</li>
            <li>Acceder al diario del día y a los contextos de tus áreas</li>
            <li>Guardar resúmenes y transcripciones de conversaciones</li>
          </ul>
        </div>

        {error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        <div style={buttonsRow}>
          <button
            onClick={handleCancel}
            disabled={loading}
            style={secondaryButtonStyle}
          >
            Cancelar
          </button>
          <button
            onClick={handleAuthorize}
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? 'Autorizando...' : 'Autorizar'}
          </button>
        </div>

        <p style={footerNote}>
          Puedes revocar este acceso en cualquier momento desde los ajustes de Fromly.
        </p>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
      <div style={{
        width: 56, height: 56,
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        borderRadius: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        marginBottom: 8,
      }}>
        🌳
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Fromly</div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f5f3ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  fontFamily: 'Inter, -apple-system, sans-serif',
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 20,
  padding: '40px 32px',
  maxWidth: 440,
  width: '100%',
  boxShadow: '0 4px 40px rgba(139,92,246,0.12)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: '#1a1a2e',
  margin: '0 0 8px',
  textAlign: 'center',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#555',
  margin: '0 0 24px',
  textAlign: 'center',
  lineHeight: 1.5,
}

const permissionsBox: React.CSSProperties = {
  background: '#faf5ff',
  border: '1px solid #e9d5ff',
  borderRadius: 12,
  padding: '16px 20px',
  marginBottom: 24,
}

const permissionsTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#7c3aed',
  margin: '0 0 8px',
}

const permissionsList: React.CSSProperties = {
  margin: 0,
  padding: '0 0 0 18px',
  fontSize: 13,
  color: '#444',
  lineHeight: 1.8,
}

const errorBox: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  color: '#dc2626',
  marginBottom: 16,
}

const buttonsRow: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 16,
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  color: 'white',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  background: 'white',
  color: '#555',
  border: '1.5px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

const footerNote: React.CSSProperties = {
  fontSize: 12,
  color: '#999',
  textAlign: 'center',
  margin: 0,
}
