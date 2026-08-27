import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '../../store/userStore'
import { getToken } from '../../api/client'
import { openUpgradeCheckout } from '../../utils/upgradeCheckout'

// Pricing rediseñado (jun 2026, v4): toggle FUERA de la caja (encima de Pro) →
// tarjetas con estructura idéntica y alineadas. Precio en una sola línea.
// Lifetime (jul 2026): antes solo se vendía desde la landing estática
// (pricing.html), sin ningún botón dentro de la propia app — `changePlanLifetime()`
// ya existía en api/client.ts pero no lo llamaba nadie. Restaurada la 3ª tarjeta.
export default function PricingView() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const us = useUserStore()
  const isGuest = !getToken()
  const [annual, setAnnual] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingLifetime, setLoadingLifetime] = useState(false)

  const isPaid = !!us.isPremium
  const isLifetime = us.user?.licenseStatus === 'active'

  async function startPro() {
    if (isGuest) { navigate('/register'); return }
    setLoading(true)
    try {
      await openUpgradeCheckout(annual ? 'annual' : 'subscription')
    } finally {
      setLoading(false)
    }
  }

  async function startLifetime() {
    if (isGuest) { navigate('/register'); return }
    setLoadingLifetime(true)
    try {
      await openUpgradeCheckout('license')
    } finally {
      setLoadingLifetime(false)
    }
  }

  // La prueba da acceso COMPLETO — asistente incluido — durante 15 días; ya no
  // es un plan gratis permanente con tope de 1.000 elementos (Alberto, 12 ago:
  // "centramos el peso en el chat, la versión free debe ser un trial").
  const freeFeatures = [
    t('pricing.featureAssistant', 'Tu asistente por chat, sin límite'),
    t('pricing.featureOutliner', 'Outliner + diario'),
    t('pricing.featurePlatforms', 'Mac, iPhone y web'),
    t('pricing.featureSync', 'Sync en tiempo real'),
  ]
  const proFeatures = [
    t('pricing.proEverythingFree', 'Todo lo de la prueba, para siempre:'),
    t('pricing.featureOwnKey', 'Usa tu propia clave de Claude, GPT o Gemini'),
    t('pricing.featureAdvancedViews', 'Vistas tabla, kanban, calendario'),
    t('pricing.proPriority', 'Soporte prioritario'),
  ]

  const proBig = annual ? '€4,08' : '€7'
  const lifetimeFeatures = [
    t('pricing.lifetimeEverythingPro', 'Todo lo de Pro, para siempre'),
    t('pricing.lifetimeTokens', '3.000.000 tokens de IA incluidos'),
    t('pricing.lifetimeNoSub', 'Pago único — sin suscripción'),
  ]

  const isInTrial = !!us.isInTrial
  const trialDaysLeft = us.trialDaysLeft ?? 0

  return (
    <div className="pricing2" style={{ position: 'relative' }}>
      {/* Salida SIEMPRE visible: esta pantalla no tenía ni X ni Volver — el
          usuario quedaba atrapado salvo que usara el Atrás del navegador
          (auditoría 28 ago 2026). */}
      <button
        onClick={() => navigate(isGuest ? '/login' : '/')}
        title={t('common.close', 'Cerrar')}
        style={{ position: 'absolute', top: 18, right: 22, width: 34, height: 34, borderRadius: 999, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary,#666)', zIndex: 5 }}
      >✕</button>
      <div className="pricing2-head">
        <h1 className="pricing2-title">{t('pricing.titleTrial', 'Empieza con 15 días gratis')}</h1>
        <p className="pricing2-sub">{t('pricing.subtitleTrial', 'Todo Fromly, sin tarjeta. Pasa a Pro cuando quieras seguir')}</p>
      </div>

      {/* Toggle mes/año FUERA de la caja, alineado encima de la tarjeta Pro (columna central) */}
      <div className="pricing2-togglerow">
        <div aria-hidden="true" />
        <div className="pricing2-togglecell">
          <div className="pricing2-toggle" role="tablist">
            <button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>
              {t('pricing.monthly', 'Mensual')}
            </button>
            <button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>
              {t('pricing.annual', 'Anual')}
              <span className="pricing2-save">{t('pricing.annualSave', 'ahorra 42%')}</span>
            </button>
          </div>
        </div>
        <div aria-hidden="true" />
      </div>

      <div className="pricing2-grid pricing2-grid--3">
        {/* ── Gratis ── */}
        <div className="pcard">
          <span className="pcard-name">{t('pricing.free', 'Prueba')}</span>
          <div className="pcard-hero">
            <span className="pcard-hero-num">15</span>
            <span className="pcard-hero-label">{t('pricing.trialDaysLabel', 'días')}</span>
          </div>
          <p className="pcard-note">{t('pricing.freeNodesNote', 'Todo Fromly, sin tarjeta ni compromiso')}</p>
          <ul className="pcard-feats">
            {freeFeatures.map((f, i) => <li key={i}><span className="pcard-check">✓</span>{f}</li>)}
          </ul>
          <div className="pcard-price-row">
            <span className="pcard-price">€0</span>
          </div>
          {/* CTA consciente del estado de la cuenta: a quien YA está en la
              prueba no se le ofrece "empezar gratis" (auditoría 28 ago 2026). */}
          {isGuest ? (
            <button className="pcard-cta pcard-cta--solid" onClick={() => navigate('/register')}>
              {t('pricing.ctaStartFree2', 'Empezar la prueba')}
            </button>
          ) : isPaid ? (
            <button className="pcard-cta" disabled style={{ opacity: 0.55, cursor: 'default' }}>
              {t('pricing.trialNotApplicable', 'Ya tienes Pro')}
            </button>
          ) : isInTrial ? (
            <button className="pcard-cta pcard-cta--solid" onClick={() => navigate('/')}>
              {t('pricing.trialDaysLeftCta', 'Te quedan {{count}} días', { count: trialDaysLeft })}
            </button>
          ) : (
            <button className="pcard-cta" disabled style={{ opacity: 0.55, cursor: 'default' }}>
              {t('pricing.trialOver', 'Tu prueba ha terminado')}
            </button>
          )}
        </div>

        {/* ── Pro ── */}
        <div className="pcard">
          <span className="pcard-name">Pro</span>
          <div className="pcard-hero pcard-hero--pro">
            <span className="pcard-hero-num">∞</span>
            <span className="pcard-hero-label">{t('pricing.nodesUnlimited', 'elementos ilimitados')}</span>
          </div>
          <p className="pcard-note">{t('pricing.proNodesNote', 'Sin límites, nunca')}</p>
          <ul className="pcard-feats">
            {proFeatures.map((f, i) => <li key={i}><span className="pcard-check">✓</span>{f}</li>)}
          </ul>
          <div className="pcard-price-row">
            <span className="pcard-price">
              {proBig}<span className="pcard-per">{t('pricing.perMonth', '/mes')}</span>
            </span>
            {annual && <span className="pcard-price-note"> · {t('pricing.annualBilled', '49 €/año')}</span>}
          </div>
          <button
            className="pcard-cta pcard-cta--ghost"
            onClick={startPro}
            disabled={loading || isPaid}
          >
            {isPaid ? t('pricing.ctaCurrentPlan', 'Tu plan actual') : (loading ? '…' : t('pricing.ctaGoPro2', 'Pasar a Pro'))}
          </button>
        </div>

        {/* ── Lifetime ── */}
        <div className="pcard">
          <span className="pcard-name">Lifetime</span>
          <div className="pcard-hero">
            <span className="pcard-hero-num">∞</span>
            <span className="pcard-hero-label">{t('pricing.lifetimeLabel', 'para siempre')}</span>
          </div>
          <p className="pcard-note">{t('pricing.lifetimeNote', 'Pago único, sin suscripción')}</p>
          <ul className="pcard-feats">
            {lifetimeFeatures.map((f, i) => <li key={i}><span className="pcard-check">✓</span>{f}</li>)}
          </ul>
          <div className="pcard-price-row">
            <span className="pcard-price">€149</span>
          </div>
          <button
            className="pcard-cta pcard-cta--ghost"
            onClick={startLifetime}
            disabled={loadingLifetime || isLifetime}
          >
            {isLifetime ? t('pricing.ctaCurrentPlan', 'Tu plan actual') : (loadingLifetime ? '…' : t('pricing.ctaGoLifetime', 'Comprar Lifetime'))}
          </button>
        </div>
      </div>
    </div>
  )
}
