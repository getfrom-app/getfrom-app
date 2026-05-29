import { useState } from 'react'
import { useUserStore } from '../../store/userStore'
import { useTranslation } from 'react-i18next'

const DISMISS_KEY = 'from_trial_banner_dismissed'

export default function TrialBanner() {
  const u = useUserStore()
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  )

  // Only show for loaded, non-premium users
  if (!u.user || u.isPremium || dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="trial-banner">
      <span>{t('trialBanner.message')}</span>
      <a
        className="trial-banner-cta"
        href="https://from.lemonsqueezy.com/checkout/buy/c42fa312-41b6-4145-ad34-7a67a702488f"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('trialBanner.cta')}
      </a>
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
