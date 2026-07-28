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

  if (!u.user || u.isPremium || dismissed) return null

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000))
    setDismissed(true)
  }

  async function handleUpgrade() {
    setLoading(true)
    try { await openUpgradeCheckout('subscription') } finally { setLoading(false) }
  }

  return (
    <div className="v2-upgrade-banner" role="status">
      <span className="v2-upgrade-banner-text">
        ✨ {t('v2.upgradeBanner.message', 'Plan gratis · 1.000 nodos · 5 chats IA/mes · 1 agente')}
      </span>
      <button className="v2-upgrade-banner-cta" onClick={handleUpgrade} disabled={loading}>
        {loading ? '…' : t('v2.upgradeBanner.cta', 'Pasar a Pro')}
      </button>
      <button className="v2-upgrade-banner-dismiss" onClick={handleDismiss} aria-label={t('common.dismiss', 'Cerrar')}>
        ×
      </button>
    </div>
  )
}
