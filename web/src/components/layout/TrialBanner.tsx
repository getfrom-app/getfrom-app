import { useState } from 'react'
import { useUserStore } from '../../store/userStore'

const DISMISS_KEY = 'from_trial_banner_dismissed'

export default function TrialBanner() {
  const u = useUserStore()
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
      <span>✦ 7 días de prueba gratis · Sin tarjeta de crédito</span>
      <a
        className="trial-banner-cta"
        href="https://from.lemonsqueezy.com/checkout/buy/1678808"
        target="_blank"
        rel="noopener noreferrer"
      >
        Probar Pro gratis →
      </a>
      <button
        className="trial-banner-dismiss"
        onClick={handleDismiss}
        aria-label="Cerrar banner"
      >
        ×
      </button>
    </div>
  )
}
