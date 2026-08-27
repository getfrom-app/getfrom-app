import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '../../store/userStore'
import { getCheckoutUrl } from '../../api/client'
import { openUpgradeCheckout } from '../../utils/upgradeCheckout'
import { openExternalUrl } from '../../utils/openExternal'
import Icon, { type IconName } from '../../v2/components/Icon'

const LS_BILLING = 'https://app.lemonsqueezy.com/billing'

export type PaywallReason =
  | 'node_limit'
  | 'ai_limit'
  | 'file_limit'
  | 'publish_limit'
  | 'agent_limit'
  | 'free_chat_limit'
  // Prueba de 15 días terminada (402 del chat/asistente) — cae en el copy
  // general de "tu prueba ha terminado" según el estado de la cuenta.
  | 'trial_expired'
  // BYOK/elegir modelo: exige plan de pago incluso durante la prueba.
  | 'byok_paid_plan'

interface Props {
  reason: PaywallReason
  onClose: () => void
}

export default function PaywallModal({ reason, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const us = useUserStore()
  const isPremium = us.isPremium
  const isInTrial = us.isInTrial
  const trialDaysLeft = us.trialDaysLeft
  const [loading, setLoading] = useState(false)

  async function openSubscriptionCheckout() {
    setLoading(true)
    try {
      await openUpgradeCheckout('subscription')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  async function openTopupCheckout() {
    setLoading(true)
    try {
      const url = await getCheckoutUrl('topup', us.user?.id ?? '', us.user?.email ?? '')
      await openExternalUrl(url || LS_BILLING)
    } catch {
      await openExternalUrl(LS_BILLING)
    } finally {
      setLoading(false)
      onClose()
    }
  }

  // ── Contenido según el escenario ────────────────────────────────────────
  let icon: IconName = 'sparkle'
  let title    = ''
  let subtitle = ''
  let primaryLabel = ''
  let primaryAction = () => {}
  let secondaryLabel = t('paywall.notNow')

  // node_limit / file_limit / publish_limit / agent_limit / free_chat_limit ya
  // NO son límites del "plan gratis" (ese límite de 1.000 elementos se retiró:
  // ahora el asistente es el producto). El servidor solo devuelve estos 402
  // cuando la prueba de 15 días terminó y no hay suscripción — así que los
  // cinco motivos comparten el mismo mensaje de "se acabó tu prueba".
  const FEATURE_LABEL: Record<string, string> = {
    node_limit:   'guardar más elementos',
    file_limit:   'adjuntar archivos',
    publish_limit: 'publicar notas',
    agent_limit:  'activar más de un agente',
    free_chat_limit: 'seguir hablando con el asistente',
  }

  if (reason in FEATURE_LABEL) {
    icon          = reason === 'agent_limit' ? 'agent' : reason === 'publish_limit' ? 'link' : reason === 'file_limit' ? 'attachment' : 'sparkle'
    title         = 'Tu prueba de 15 días ha terminado'
    subtitle      = `Pásate a Pro para seguir usando Fromly sin límites — incluido ${FEATURE_LABEL[reason]}.`
    primaryLabel  = loading ? '…' : 'Suscribirme ahora'
    primaryAction = openSubscriptionCheckout

  } else if (isPremium) {
    // Suscriptor de verdad, sin tokens del mes.
    icon          = 'prompt'
    title         = 'Te has quedado sin tokens de IA'
    subtitle      = 'Has consumido todos tus tokens del mes. Puedes comprar tokens adicionales o esperar a la renovación de tu suscripción.'
    primaryLabel  = loading ? '…' : 'Comprar más tokens'
    primaryAction = openTopupCheckout
    secondaryLabel = 'Gestionar suscripción'

  } else if (isInTrial) {
    // En prueba pero se ha gastado el balance de tokens de la prueba antes de
    // que pasen los 15 días — no ha terminado el plazo, se ha terminado el saldo.
    icon          = 'prompt'
    title         = 'Has agotado los tokens de tu prueba'
    subtitle      = `Aún te quedan ${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'} de prueba, pero se han acabado los tokens de IA incluidos. Pásate a Pro para seguir sin límite.`
    primaryLabel  = loading ? '…' : 'Suscribirme ahora'
    primaryAction = openSubscriptionCheckout

  } else {
    // Prueba terminada y sin tokens.
    icon          = 'sparkle'
    title         = 'Tu prueba de 15 días ha terminado'
    subtitle      = 'Suscríbete para seguir usando el asistente de IA sin límites: crea notas, tareas y eventos con tu voz, y deja que Fromly organice todo por ti.'
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
        <div style={{ lineHeight: 1, color: 'var(--accent)' }}><Icon name={icon} size={32} strokeWidth={1.5} /></div>

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
              onClick={() => { openExternalUrl(LS_BILLING); onClose() }}
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
