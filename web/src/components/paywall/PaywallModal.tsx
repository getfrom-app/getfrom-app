import { useNavigate } from 'react-router-dom'

interface Props {
  reason: 'node_limit' | 'ai_limit'
  onClose: () => void
}

export default function PaywallModal({ reason, onClose }: Props) {
  const navigate = useNavigate()

  const title = reason === 'node_limit'
    ? 'Has alcanzado el límite del plan gratuito'
    : 'Sin tokens de IA disponibles'

  const description = reason === 'node_limit'
    ? 'Has alcanzado los 1.000 nodos del plan gratuito. Actualiza a Pro para nodos ilimitados.'
    : 'No tienes tokens de IA disponibles. Actualiza a Pro para usar la IA sin límites.'

  function handleViewPlans() {
    onClose()
    navigate('/pricing')
  }

  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall-card" onClick={e => e.stopPropagation()}>
        <div className="paywall-icon">✨</div>
        <h2 className="paywall-title">Límite del plan gratuito</h2>
        <p className="paywall-description">{description}</p>
        <div className="paywall-actions">
          <button className="btn-primary paywall-btn-primary" onClick={handleViewPlans}>
            Ver planes
          </button>
          <button className="paywall-btn-ghost" onClick={onClose}>
            Tal vez más tarde
          </button>
        </div>
      </div>
    </div>
  )
}
