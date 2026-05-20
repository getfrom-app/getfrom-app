import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../store/userStore'
import { getToken, changePlan, changePlanAnnual, changePlanLifetime } from '../../api/client'

const LS_MONTHLY  = 'https://from.lemonsqueezy.com/checkout/buy/c42fa312-41b6-4145-ad34-7a67a702488f'
const LS_ANNUAL   = 'https://from.lemonsqueezy.com/checkout/buy/1182c3fa-554f-49c8-8922-153caffaac60'
const LS_LIFETIME = 'https://from.lemonsqueezy.com/checkout/buy/82bf7fc4-e3b5-402c-b4b2-b2ef1f7f7520'

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  priceDetail?: string
  badge?: string
  features: PlanFeature[]
  ctaLabel: string
  isCurrent?: boolean
  isPopular?: boolean
  onCta: () => void
}

export default function PricingView() {
  const navigate = useNavigate()
  const us = useUserStore()
  const isGuest = !getToken()

  async function handleCheckout(plan: 'monthly' | 'annual' | 'lifetime') {
    if (isGuest) {
      const urls = { monthly: LS_MONTHLY, annual: LS_ANNUAL, lifetime: LS_LIFETIME }
      window.open(urls[plan], '_blank')
      return
    }
    const fns = {
      monthly: changePlan,
      annual: changePlanAnnual,
      lifetime: changePlanLifetime,
    }
    try {
      const res = await fns[plan]()
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank')
    } catch (err) {
      console.error('Error al iniciar checkout:', err)
    }
  }

  const handleMonthly  = () => handleCheckout('monthly')
  const handleAnnual   = () => handleCheckout('annual')
  const handleLifetime = () => handleCheckout('lifetime')

  const isFree = !us.isPremium
  const isLifetime = us.user?.licenseStatus === 'active'

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Gratis',
      price: '€0',
      features: [
        { text: '1.000 nodos', included: true },
        { text: 'Sync básico', included: true },
        { text: 'Mac + iOS + Web', included: true },
        { text: 'IA incluida', included: false },
        { text: 'Archivos adjuntos', included: false },
        { text: 'Publicar notas', included: false },
      ],
      ctaLabel: isFree && !isGuest ? 'Tu plan actual' : 'Empezar gratis',
      isCurrent: isFree && !isGuest,
      onCta: isGuest ? () => navigate('/register') : () => {},
    },
    {
      id: 'monthly',
      name: 'Pro mensual',
      price: '€7/mes',
      features: [
        { text: 'Nodos ilimitados', included: true },
        { text: 'Sync ilimitado', included: true },
        { text: 'Mac + iOS + Web', included: true },
        { text: 'IA incluida', included: true },
        { text: 'Archivos adjuntos', included: true },
        { text: 'Publicar notas', included: true },
      ],
      ctaLabel: 'Empezar',
      onCta: handleMonthly,
    },
    {
      id: 'annual',
      name: 'Pro anual',
      price: '€49/año',
      priceDetail: '€4,08/mes · 30% ahorro vs mensual',
      badge: 'Popular',
      isPopular: true,
      features: [
        { text: 'Nodos ilimitados', included: true },
        { text: 'Sync ilimitado', included: true },
        { text: 'Mac + iOS + Web', included: true },
        { text: 'IA incluida', included: true },
        { text: 'Archivos adjuntos', included: true },
        { text: 'Publicar notas', included: true },
      ],
      ctaLabel: 'Empezar',
      onCta: handleAnnual,
    },
    {
      id: 'lifetime',
      name: 'Lifetime',
      price: '€149',
      priceDetail: 'pago único',
      features: [
        { text: 'Nodos ilimitados', included: true },
        { text: 'Sync ilimitado', included: true },
        { text: 'Mac + iOS + Web', included: true },
        { text: '3M tokens de IA', included: true },
        { text: 'Archivos adjuntos', included: true },
        { text: 'Publicar notas', included: true },
        { text: 'API key propia', included: true },
      ],
      ctaLabel: isLifetime ? 'Tu plan actual' : 'Comprar',
      isCurrent: isLifetime,
      onCta: isLifetime ? () => {} : handleLifetime,
    },
  ]

  return (
    <div className="pricing-view">
      <div className="pricing-header">
        <h1 className="pricing-title">Elige tu plan</h1>
        <p className="pricing-subtitle">
          Todos los planes incluyen Mac + iOS + Web · Cancela cuando quieras
        </p>
      </div>

      {isGuest && (
        <p className="pricing-guest-note">
          Al completar el pago recibirás un email para crear tu contraseña y acceder a From.
        </p>
      )}

      <div className="pricing-grid">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={[
              'plan-card',
              plan.isPopular ? 'plan-card--popular' : '',
              plan.isCurrent ? 'plan-card--current' : '',
            ].filter(Boolean).join(' ')}
          >
            {plan.badge && (
              <div className="plan-badge">{plan.badge}</div>
            )}
            <div className="plan-name">{plan.name}</div>
            <div className="plan-price">{plan.price}</div>
            {plan.priceDetail && (
              <div className="plan-price-detail">{plan.priceDetail}</div>
            )}

            <ul className="plan-feature-list">
              {plan.features.map((f, i) => (
                <li key={i} className={`plan-feature ${f.included ? 'plan-feature--included' : 'plan-feature--excluded'}`}>
                  <span className="plan-feature-icon">{f.included ? '✓' : '✗'}</span>
                  {f.text}
                </li>
              ))}
            </ul>

            <button
              className={`plan-cta ${plan.isCurrent ? 'plan-cta--current' : 'btn-primary'}`}
              onClick={plan.onCta}
              disabled={plan.isCurrent}
            >
              {plan.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
