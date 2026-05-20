import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function OnboardingTooltip() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(() => localStorage.getItem('from_onboarding_done') !== '1')

  const steps = [
    { text: '👋 Bienvenido a From. Escribe tu primera nota aquí.' },
    { text: '✅ Crea tareas rápidas con ⌘T. Pruébalo ahora.' },
    { text: '🏷 El sidebar izquierdo organiza tus tags, favoritos y paneles.' },
    { text: '🎉 ¡Listo! From sincroniza todo entre Mac, iPhone y navegador.' },
  ]

  if (!visible) return null

  function next() {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function dismiss() {
    localStorage.setItem('from_onboarding_done', '1')
    setVisible(false)
  }

  // Portal para evitar conflictos DOM con scripts de terceros (Google/Apple Sign-In)
  return createPortal(
    <div className="onboarding-overlay" onClick={dismiss}>
      <div className="onboarding-tooltip" onClick={e => e.stopPropagation()}>
        <p className="onboarding-text">{steps[step].text}</p>
        <div className="onboarding-footer">
          <span className="onboarding-dots">
            {steps.map((_, i) => (
              <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
            ))}
          </span>
          <div className="onboarding-actions">
            <button className="onboarding-skip" onClick={dismiss}>Saltar</button>
            <button className="onboarding-next" onClick={next}>
              {step < steps.length - 1 ? 'Siguiente →' : 'Empezar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
