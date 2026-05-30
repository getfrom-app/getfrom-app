import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

const STEPS = [
  {
    icon: '✏️',
    title: 'Escribe tu primer bullet',
    text: 'Haz clic en el área principal y empieza a escribir. Cada línea es un nodo que puedes anidar, editar y conectar.',
  },
  {
    icon: '✅',
    title: 'Crea una tarea con ⌘T',
    text: 'Pulsa ⌘T sobre cualquier bullet para convertirlo en tarea. También puedes escribir -t al final de la línea.',
  },
  {
    icon: '🔍',
    title: 'Busca con ⌘K',
    text: 'Accede al buscador global con ⌘K. Encuentra notas, tareas y eventos al instante.',
  },
  {
    icon: '📅',
    title: 'El Diario es tu hub diario',
    text: 'Cada día tiene su propia página de diario. Tus tareas de hoy, eventos y notas rápidas viven ahí.',
  },
  {
    icon: '✨',
    title: 'IA inline y chat',
    text: 'Pulsa Espacio al inicio de un bullet vacío para activar la IA inline. Usa ⌘K para abrir el chat de IA global.',
  },
]

export default function OnboardingTooltip() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(() => localStorage.getItem('from_onboarding_done') !== '1')

  if (!visible) return null

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  function dismiss() {
    localStorage.setItem('from_onboarding_done', '1')
    setVisible(false)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  // Portal para evitar conflictos DOM con scripts de terceros (Google/Apple Sign-In)
  return createPortal(
    <div className="onboarding-overlay" onClick={dismiss}>
      <div className="onboarding-tooltip" onClick={e => e.stopPropagation()}>
        <div className="onboarding-step-icon">{current.icon}</div>
        <p className="onboarding-title">{current.title}</p>
        <p className="onboarding-text">{current.text}</p>
        <div className="onboarding-footer">
          <span className="onboarding-dots">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`onboarding-dot ${i === step ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); setStep(i) }}
              />
            ))}
          </span>
          <div className="onboarding-actions">
            <button className="onboarding-skip" onClick={dismiss}>{t('onboarding.skip')}</button>
            {step > 0 && (
              <button className="onboarding-prev" onClick={prev}>{t('onboarding.previous')}</button>
            )}
            <button className="onboarding-next" onClick={next}>
              {isLast ? 'Empezar' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
