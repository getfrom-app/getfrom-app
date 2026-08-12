import { useState } from 'react'
import { useUserStore } from '../../store/userStore'
import { useTranslation } from 'react-i18next'
import { openUpgradeCheckout } from '../../utils/upgradeCheckout'

const DISMISS_KEY = 'from_trial_banner_dismissed_until'
const DISMISS_DAYS = 7

function isDismissed(): boolean {
  const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
  return Date.now() < until
}

export default function TrialBanner() {
  const u = useUserStore()
  const { t } = useTranslation()
  // Antes se guardaba en sessionStorage (se volvía a mostrar en cada pestaña
  // nueva — demasiado insistente). Ahora localStorage con fecha: se descarta
  // durante DISMISS_DAYS días reales, luego vuelve a aparecer.
  const [dismissed, setDismissed] = useState(isDismissed)
  const [loading, setLoading] = useState(false)

  const expired = !!u.user && !u.isPremium && !u.isInTrial
  const endingSoon = u.isInTrial && u.trialDaysLeft <= 5

  // Solo se enseña para usuarios cargados, sin plan de pago, cuando la prueba
  // se acaba o ya se acabó — no durante los primeros días (Alberto, 12 ago:
  // el trial sustituye al límite de 1.000 elementos, no hace falta insistir
  // desde el primer minuto).
  if (!u.user || u.isPremium) return null
  if (!expired && !endingSoon) return null
  if (dismissed && !expired) return null

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000))
    setDismissed(true)
  }

  async function handleUpgrade() {
    setLoading(true)
    try {
      await openUpgradeCheckout('subscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`trial-banner${expired ? ' trial-banner-expired' : ''}`}>
      <span>
        {expired
          ? t('trialBanner.expired', 'Tu prueba de 15 días ha terminado')
          : t('trialBanner.endingSoon', 'Quedan {{count}} días de prueba', { count: u.trialDaysLeft })}
      </span>
      <button
        className="trial-banner-cta"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? '…' : t('trialBanner.cta')}
      </button>
      {!expired && (
        <button
          className="trial-banner-dismiss"
          onClick={handleDismiss}
          aria-label={t('trialBanner.dismiss')}
        >
          ×
        </button>
      )}
    </div>
  )
}
