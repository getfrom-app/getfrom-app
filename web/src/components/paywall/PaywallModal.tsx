import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '../../store/userStore'
import { changePlan, getCheckoutUrl } from '../../api/client'

const LS_BILLING = 'https://app.lemonsqueezy.com/billing'

interface Props {
  reason: 'node_limit' | 'ai_limit'
  onClose: () => void
}

export default function PaywallModal({ reason, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const us = useUserStore()
  const isPremium = us.isPremium
  const [loading, setLoading] = useState(false)

  async function openSubscriptionCheckout() {
    setLoading(true)
    try {
      const res = await changePlan()
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank')
    } catch {
      window.open('/pricing', '_blank')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  async function openTopupCheckout() {
    setLoading(true)
    try {
      const url = await getCheckoutUrl('topup', us.user?.id ?? '', us.user?.email ?? '')
      if (url) window.open(url, '_blank')
      else window.open(LS_BILLING, '_blank')
    } catch {
      window.open(LS_BILLING, '_blank')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  // ── Contenido según el escenario ────────────────────────────────────────
  let icon     = '✨'
  let title    = ''
  let subtitle = ''
  let primaryLabel = ''
  let primaryAction = () => {}
  let secondaryLabel = t('paywall.notNow')

  if (reason === 'node_limit') {
    // Límite de nodos — siempre free
    icon          = '📦'
    title         = 'Has alcanzado el límite del plan gratuito'
    subtitle      = 'Con el plan gratuito puedes tener hasta 1.000 nodos. Suscríbete para tener nodos ilimitados y acceso completo a la IA.'
    primaryLabel  = 'Ver planes'
    primaryAction = () => { onClose(); navigate('/pricing') }

  } else if (isPremium) {
    // Suscriptor sin tokens
    icon          = '⚡'
    title         = 'Te has quedado sin tokens de IA'
    subtitle      = 'Has consumido todos tus tokens del mes. Puedes comprar tokens adicionales o esperar a la renovación de tu suscripción.'
    primaryLabel  = loading ? '…' : 'Comprar más tokens'
    primaryAction = openTopupCheckout
    secondaryLabel = 'Gestionar suscripción'

  } else {
    // Free sin IA
    icon          = '✨'
    title         = 'La IA de From requiere suscripción'
    subtitle      = 'Suscríbete para usar el asistente de IA sin límites: crea notas, tareas y eventos con tu voz, y deja que From organice todo por ti.'
    primaryLabel  = loading ? '…' : 'Suscribirme ahora'
    primaryAction = openSubscriptionCheckout
  }

  return createPortal(
    <div
      className="paywall-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.40)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="paywall-card"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px var(--border)',
          padding: '32px 28px 24px',
          maxWidth: 420,
          width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16,
          textAlign: 'center',
        }}
      >
        {/* Icono */}
        <div style={{ fontSize: 40, lineHeight: 1 }}>{icon}</div>

        {/* Título */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {title}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {subtitle}
          </p>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button
            onClick={primaryAction}
            disabled={loading}
            style={{
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
          >
            {primaryLabel}
          </button>

          {/* Acción secundaria — solo en premium sin tokens */}
          {isPremium && reason === 'ai_limit' && (
            <button
              onClick={() => { window.open(LS_BILLING, '_blank'); onClose() }}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {secondaryLabel}
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            {t('paywall.notNow')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
