import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function GuestBanner() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="guest-banner">
      <span className="guest-banner-text">
        {t('guestBanner.message')}
      </span>
      <div className="guest-banner-actions">
        <button
          className="guest-banner-btn guest-banner-btn--primary"
          onClick={() => navigate('/register')}
        >
          {t('guestBanner.createAccount')}
        </button>
        <button
          className="guest-banner-btn guest-banner-btn--ghost"
          onClick={() => navigate('/login')}
        >
          {t('guestBanner.signIn')}
        </button>
      </div>
    </div>
  )
}
