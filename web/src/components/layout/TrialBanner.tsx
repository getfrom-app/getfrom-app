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

  // Only show for loaded, non-premium users
  if (!u.user || u.isPremium || dismissed) return null

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
    <div className="trial-banner">
      <span>{t('trialBanner.message')}</span>
      <button
        className="trial-banner-cta"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? '…' : t('trialBanner.cta')}
      </button>
      <button
        className="trial-banner-dismiss"
        onClick={handleDismiss}
        aria-label={t('trialBanner.dismiss')}
      >
        ×
      </button>
    </div>
  )
}
