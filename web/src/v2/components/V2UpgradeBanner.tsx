// Banner persistente de upgrade a Pro para usuarios free en v2 — v2 (chat-first)
// no tenía NINGÚN aviso permanente (v1 sí, TrialBanner en el layout global); un
// free solo se enteraba de los límites al chocar con uno. Flotante en vez de
// empujar el layout: .v2-root es `position:fixed;inset:0` con grid de 3
// columnas — insertar una fila arriba requeriría restructurar ese grid, así
// que este banner vive por encima como una píldora fija, igual que el aviso
// "nueva versión" de la barra de Mac.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '../../store/userStore'
import { openUpgradeCheckout } from '../../utils/upgradeCheckout'
import Icon from './Icon'

const DISMISS_KEY = 'from_v2_upgrade_banner_dismissed_until'
const DISMISS_DAYS = 7

function isDismissed(): boolean {
  const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
  return Date.now() < until
}

export default function V2UpgradeBanner() {
  const u = useUserStore()
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(isDismissed)
  const [loading, setLoading] = useState(false)

  const expired = !!u.user && !u.isPremium && !u.isInTrial
  // Los últimos días de prueba se avisan siempre — dismiss no debe poder
  // silenciar el aviso de "se acaba" hasta el mismo día que se acaba.
  const endingSoon = u.isInTrial && u.trialDaysLeft <= 5

  if (!u.user || u.isPremium) return null
  if (!expired && !endingSoon) return null
  if (dismissed && !expired) return null

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000))
    setDismissed(true)
  }

  async function handleUpgrade() {
    setLoading(true)
    try { await openUpgradeCheckout('subscription') } finally { setLoading(false) }
  }

  const message = expired
    ? t('v2.upgradeBanner.expired', 'Tu prueba de 15 días ha terminado')
    : t('v2.upgradeBanner.endingSoon', 'Quedan {{count}} días de prueba', { count: u.trialDaysLeft })

  return (
    <div className={`v2-upgrade-banner${expired ? ' v2-upgrade-banner-expired' : ''}`} role="status">
      <span className="v2-upgrade-banner-text">
        <Icon name="sparkle" size={14} /> {message}
      </span>
      <button className="v2-upgrade-banner-cta" onClick={handleUpgrade} disabled={loading}>
        {loading ? '…' : t('v2.upgradeBanner.cta', 'Pasar a Pro')}
      </button>
      {!expired && (
        <button className="v2-upgrade-banner-dismiss" onClick={handleDismiss} aria-label={t('common.dismiss', 'Cerrar')}>
          ×
        </button>
      )}
    </div>
  )
}
