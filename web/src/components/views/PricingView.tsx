import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '../../store/userStore'
import { getToken, changePlan, changePlanAnnual } from '../../api/client'

// Pricing rediseñado (jun 2026): simple y visual.
// Diferenciador = nº de nodos (1.000 vs ∞). Toggle mes/año global arriba.
// Ambas tarjetas con estructura IDÉNTICA → todo alineado; precio abajo.
export default function PricingView() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const us = useUserStore()
  const isGuest = !getToken()
  const [annual, setAnnual] = useState(true)
  const [loading, setLoading] = useState(false)

  const isPaid = !!us.isPremium

  async function startPro() {
    if (isGuest) { navigate('/register'); return }
    setLoading(true)
    try {
      const res = annual ? await changePlanAnnual() : await changePlan()
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank')
    } catch (err) {
      console.error('Error al iniciar checkout Pro:', err)
    } finally {
      setLoading(false)
    }
  }

  const freeFeatures = [
    t('pricing.featureOutliner', 'Outliner + diario'),
    t('pricing.featureAdvancedSearch', 'Búsqueda avanzada'),
    t('pricing.featurePlatforms', 'Mac, iPhone y web'),
    t('pricing.featureSync', 'Sync en tiempo real'),
  ]
  const proFeatures = [
    t('pricing.proEverythingFree', 'Todo lo de Gratis, y además:'),
    t('pricing.featureAIIncluded', 'IA, prompts y agentes'),
    t('pricing.featureAdvancedViews', 'Vistas tabla, kanban, calendario'),
    t('pricing.proPriority', 'Soporte prioritario'),
  ]

  return (
    <div className="pricing2">
      <div className="pricing2-head">
        <h1 className="pricing2-title">
          {isGuest ? t('pricing.title', 'Elige tu plan') : t('pricing.titleAfterRegister', '¡Cuenta creada!')}
        </h1>
        <p className="pricing2-sub">
          {t('pricing.subtitle2', 'Empieza gratis. Pasa a Pro cuando tu segundo cerebro crezca.')}
        </p>
      </div>

      {/* Toggle global mes / año */}
      <div className="pricing2-toggle pricing2-toggle--center" role="tablist">
        <button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>
          {t('pricing.monthly', 'Mensual')}
        </button>
        <button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>
          {t('pricing.annual', 'Anual')}
          <span className="pricing2-save">{t('pricing.annualSave', 'ahorra 42%')}</span>
        </button>
      </div>

      <div className="pricing2-grid">
        {/* ── Gratis ── */}
        <div className="pcard">
          <span className="pcard-name">{t('pricing.free', 'Gratis')}</span>
          <div className="pcard-hero">
            <span className="pcard-hero-num">1.000</span>
            <span className="pcard-hero-label">{t('pricing.nodesLabel', 'nodos')}</span>
          </div>
          <p className="pcard-note">{t('pricing.freeNodesNote', 'De sobra para empezar')}</p>
          <ul className="pcard-feats">
            {freeFeatures.map((f, i) => <li key={i}><span className="pcard-check">✓</span>{f}</li>)}
          </ul>
          <div className="pcard-price-row">
            <span className="pcard-price">€0</span>
          </div>
          <button
            className="pcard-cta pcard-cta--ghost"
            onClick={isGuest ? () => navigate('/register') : () => navigate('/')}
          >
            {isGuest ? t('pricing.ctaCreateFree', 'Empezar gratis') : t('pricing.ctaContinueFree', 'Continuar gratis')}
          </button>
        </div>

        {/* ── Pro ── */}
        <div className="pcard pcard--pro">
          <span className="pcard-badge">{t('pricing.proBadge', 'Recomendado')}</span>
          <span className="pcard-name">Pro</span>
          <div className="pcard-hero pcard-hero--pro">
            <span className="pcard-hero-num">∞</span>
            <span className="pcard-hero-label">{t('pricing.nodesUnlimited', 'nodos ilimitados')}</span>
          </div>
          <p className="pcard-note">{t('pricing.proNodesNote', 'Sin límites, nunca')}</p>
          <ul className="pcard-feats">
            {proFeatures.map((f, i) => <li key={i}><span className="pcard-check">✓</span>{f}</li>)}
          </ul>
          <div className="pcard-price-row">
            <span className="pcard-price">
              {annual ? '€49' : '€7'}
              <span className="pcard-per">{annual ? t('pricing.perYear', '/año') : t('pricing.perMonth', '/mes')}</span>
            </span>
            {annual && <span className="pcard-price-sub">{t('pricing.annualNote', '€4,08/mes · facturado anual')}</span>}
          </div>
          <button
            className="pcard-cta pcard-cta--solid"
            onClick={startPro}
            disabled={loading || isPaid}
          >
            {isPaid ? t('pricing.ctaCurrentPlan', 'Tu plan actual') : (loading ? '…' : t('pricing.ctaStartPro', 'Empezar Pro'))}
          </button>
        </div>
      </div>
    </div>
  )
}
