// MARK: - OnboardingWidget
//
// Floating onboarding card that appears for new users.
// Shows when: localStorage has no 'from_onboarding_done' OR URL has ?welcome=1
// Non-blocking, fixed bottom-right, 4 steps with progress dots.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'from_onboarding_done'

const STEPS = [
  {
    icon: '✏️',
    title: 'Escribe en cualquier parte',
    text: 'Haz clic en el outliner y escribe. Todo lo que escribas se guarda solo, al instante.',
    cta: 'Entendido →',
  },
  {
    icon: '☑️',
    title: 'Convierte cualquier nota en tarea',
    text: 'Pulsa ⌘+Enter sobre cualquier nodo y se convierte en tarea pendiente. Otra vez y pasa a hecha.',
    cta: 'Genial →',
  },
  {
    icon: '🔍',
    title: 'Encuentra todo al instante',
    text: 'Pulsa ⌘+F y escribe lo que buscas. Prueba \'pendiente\' o \'reunión de esta semana\'.',
    cta: '¡Potente! →',
  },
  {
    icon: '✦',
    title: 'Pídeme lo que quieras',
    text: 'Pulsa el botón ✦ en la esquina y dime qué necesitas. Creo tareas, busco notas y organizo tu día.',
    cta: '¡Vamos! 🚀',
  },
]

export default function OnboardingWidget() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [animIn, setAnimIn] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    const params = new URLSearchParams(window.location.search)
    const hasWelcome = params.get('welcome') === '1'

    if (!done || hasWelcome) {
      const timer = setTimeout(() => {
        setVisible(true)
        // Trigger slide-up animation on next tick
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimIn(true))
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setAnimIn(false)
    setTimeout(() => setVisible(false), 300)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      close()
    }
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    <>
      <style>{`
        @keyframes onboarding-slidein {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 56,
          right: 16,
          width: 340,
          zIndex: 1000,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(139,92,246,0.15)',
          overflow: 'hidden',
          opacity: animIn ? 1 : 0,
          transform: animIn ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Purple accent top bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />

        {/* Header hook */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#1a1a1a',
                lineHeight: 1.3,
                marginBottom: 4,
              }}>
                ✦ Te prometo que será UN MINUTO.
              </div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>
                Hola, soy Magic. Déjame enseñarte lo esencial.
              </div>
            </div>
            <button
              onClick={close}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#999',
                fontSize: 18,
                lineHeight: 1,
                padding: '0 0 0 8px',
                flexShrink: 0,
              }}
              title="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ margin: '16px 20px 0', height: 1, background: 'rgba(139,92,246,0.1)' }} />

        {/* Step content */}
        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{current.icon}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
            {current.title}
          </div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
            {current.text}
          </div>

          {/* CTA button */}
          <button
            onClick={next}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '11px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 16,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {current.cta}
          </button>

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === step ? '#8b5cf6' : '#e0d9f7',
                  transition: 'width 0.25s ease, background 0.25s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
