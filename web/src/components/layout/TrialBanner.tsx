import { useState } from 'react'
import { useUserStore } from '../../store/userStore'
import { useTranslation } from 'react-i18next'
import { changePlan } from '../../api/client'

const DISMISS_KEY = 'from_trial_banner_dismissed'

export default function TrialBanner() {
  const u = useUserStore()
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  )
  const [loading, setLoading] = useState(false)

  // Only show for loaded, non-premium users
  if (!u.user || u.isPremium || dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await changePlan()
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank')
    } catch {
      // fallback: llevar a pricing
      window.open('/pricing', '_blank')
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
