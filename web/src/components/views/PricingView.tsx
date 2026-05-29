import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../store/userStore'
import { getToken, changePlanLifetime } from '../../api/client'

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

  async function handleCheckoutLifetime() {
    if (isGuest) {
      window.open(LS_LIFETIME, '_blank')
      return
    }
    try {
      const res = await changePlanLifetime()
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank')
    } catch (err) {
      console.error('Error al iniciar checkout:', err)
    }
  }

  const handleLifetime = () => handleCheckoutLifetime()

  const isFree = !us.isPremium
  const isLifetime = us.user?.licenseStatus === 'active'

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Gratis',
      price: '€0',
      features: [
        { text: 'Outliner + diario', included: true },
        { text: 'Búsqueda avanzada', included: true },
        { text: 'Sync entre dispositivos', included: true },
        { text: 'Mac + iOS + Web', included: true },
        { text: 'IA y agentes', included: false },
        { text: 'Vistas avanzadas', included: false },
        { text: 'Sin límite de nodos', included: false },
      ],
      ctaLabel: isFree && !isGuest ? 'Continuar gratis →' : 'Crear cuenta gratis',
      isCurrent: false, // nunca marcado como "actual" en el onboarding
      onCta: isGuest ? () => navigate('/register') : () => navigate('/'),
    },
    {
      id: 'lifetime',
      name: 'Pro · Lifetime',
      price: '€49',
      priceDetail: 'pago único · acceso de por vida',
      badge: 'Mejor valor',
      isPopular: true,
      features: [
        { text: 'Outliner + diario', included: true },
        { text: 'Búsqueda avanzada', included: true },
        { text: 'Sync completo entre dispositivos', included: true },
        { text: 'Mac + iOS + Web', included: true },
        { text: 'IA y agentes incluidos', included: true },
        { text: 'Vistas avanzadas', included: true },
        { text: 'Nodos ilimitados', included: true },
      ],
      ctaLabel: isLifetime ? 'Tu plan actual' : 'Comprar ahora',
      isCurrent: isLifetime,
      onCta: isLifetime ? () => {} : handleLifetime,
    },
  ]

  return (
    <div className="pricing-view">
      <div className="pricing-header">
        <h1 className="pricing-title">{isGuest ? 'Elige tu plan' : '¡Cuenta creada! Elige cómo continuar'}</h1>
        <p className="pricing-subtitle">
          {isGuest
            ? 'Empieza gratis · Paga una vez y usa From para siempre'
            : 'Puedes usar From gratis ahora mismo. Actualiza cuando quieras.'}
        </p>
      </div>

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
