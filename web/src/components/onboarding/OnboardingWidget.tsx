// MARK: - OnboardingWidget
//
// Floating guided onboarding card (bottom-right corner).
// 6 interactive steps that guide the user through real actions.
// Shows when localStorage does NOT have 'from_onboarding_done' = '1'.

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'

const STORAGE_KEY = 'from_onboarding_done'
const TOTAL_DOTS = 4 // progress dots shown on steps 0–3

export default function OnboardingWidget() {
  const [visible, setVisible]     = useState(false)
  const [animIn, setAnimIn]       = useState(false)
  const [step, setStep]           = useState(0)
  const [demoNodeId, setDemoNodeId] = useState<string | null>(null)
  const location = useLocation()
  const store    = useStore()

  // ── Initial show logic ─────────────────────────────────────────────────────
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    const params = new URLSearchParams(window.location.search)
    const hasWelcome = params.get('welcome') === '1'

    if (!done || hasWelcome) {
      const timer = setTimeout(() => {
        // Create the demo node
        try {
          const node = store.createNode({
            text: 'Empezar a utilizar From',
            parentId: null,
            siblingOrder: 99999,
          })
          setDemoNodeId(node.id)
        } catch (e) {
          console.warn('[Onboarding] createNode failed', e)
        }
        setVisible(true)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimIn(true))
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Step 3: detect navigation into demo node ───────────────────────────────
  const step3IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 3 || !demoNodeId) return
    step3IntervalRef.current = setInterval(() => {
      if (window.location.pathname.includes(demoNodeId)) {
        clearInterval(step3IntervalRef.current!)
        step3IntervalRef.current = null
        advanceTo(4)
      }
    }, 300)
    return () => {
      if (step3IntervalRef.current) {
        clearInterval(step3IntervalRef.current)
        step3IntervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, demoNodeId])

  // ── Step 3: pulse the bullet of demo node ─────────────────────────────────
  const highlightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 3 || !demoNodeId) return

    function applyHighlight() {
      const el = document.querySelector(`[data-node-id="${demoNodeId}"]`)
      if (!el) return
      el.setAttribute('data-onboarding-highlight', 'true')
      const bullet = el.querySelector('.bullet-nav-dot')
      if (bullet) bullet.classList.add('onboarding-pulse-bullet')
    }

    applyHighlight()
    highlightIntervalRef.current = setInterval(applyHighlight, 100)

    return () => {
      if (highlightIntervalRef.current) {
        clearInterval(highlightIntervalRef.current)
        highlightIntervalRef.current = null
      }
      // Clean up
      if (demoNodeId) {
        const el = document.querySelector(`[data-node-id="${demoNodeId}"]`)
        if (el) {
          el.removeAttribute('data-onboarding-highlight')
          el.querySelector('.bullet-nav-dot')?.classList.remove('onboarding-pulse-bullet')
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, demoNodeId])

  // ── Step 4: prefill MagicChat and highlight send ───────────────────────────
  useEffect(() => {
    if (step !== 4) return
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('from:onboarding-prefill', {
        detail: { text: 'Desarrolla el nodo con una descripción breve y 3 tareas para empezar a usar From' },
      }))
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('from:onboarding-highlight-send', {}))
      }, 200)
    }, 600)
    return () => clearTimeout(timer)
  }, [step])

  // ── Step 4: listen for magic confirmed ────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return
    function handler() { advanceTo(5) }
    window.addEventListener('from:onboarding-magic-confirmed', handler)
    return () => window.removeEventListener('from:onboarding-magic-confirmed', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function advanceTo(s: number) { setStep(s) }

  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setAnimIn(false)
    setTimeout(() => setVisible(false), 300)
  }

  function next() { setStep(s => s + 1) }

  // Don't render location-dependent steps until location is ready
  // (avoids flash before router mounts)
  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 56,
        right: 16,
        width: 340,
        zIndex: 9999,
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
      {step === 0 && <Step0 onNext={next} onClose={close} />}
      {step === 1 && <Step1 onNext={next} onClose={close} />}
      {step === 2 && <Step2 onNext={next} onClose={close} />}
      {step === 3 && <Step3 onClose={close} />}
      {step === 4 && <Step4 onClose={close} />}
      {step === 5 && <Step5 onClose={close} />}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#999', fontSize: 18, lineHeight: 1,
        padding: '0 0 0 8px', flexShrink: 0,
      }}
      title="Cerrar"
    >×</button>
  )
}

function ProgressDots({ active }: { active: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: TOTAL_DOTS }).map((_, i) => (
        <div key={i} style={{
          width: i === active ? 20 : 8,
          height: 8,
          borderRadius: 4,
          background: i === active ? '#8b5cf6' : '#e0d9f7',
          transition: 'width 0.25s ease, background 0.25s ease',
        }} />
      ))}
    </div>
  )
}

function PrimaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        color: '#fff', border: 'none', borderRadius: 10,
        padding: '11px 16px', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', marginBottom: 16, transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >{label}</button>
  )
}

function TopBar() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      padding: '10px 16px',
      fontSize: 12, fontWeight: 700, color: '#fff',
      letterSpacing: 0.3,
    }}>
      ✦ Te prometo que será UN MINUTO.
    </div>
  )
}

function AccentLine() {
  return <div style={{ height: 1, margin: '0 20px', background: 'rgba(139,92,246,0.12)' }} />
}

// ── Step 0 — Welcome ───────────────────────────────────────────────────────

function Step0({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  return (
    <>
      <TopBar />
      <div style={{ padding: '12px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>
          Hola, soy Magic. Déjame enseñarte lo esencial.
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <AccentLine />
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>✏️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          Escribe en cualquier parte
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
          Pulsa en cualquier lugar del outliner y escribe cualquier cosa. Todo se guarda al instante.
        </div>
        <PrimaryBtn label="¡Lo entiendo! →" onClick={onNext} />
        <ProgressDots active={0} />
      </div>
    </>
  )
}

// ── Step 1 — Tasks ─────────────────────────────────────────────────────────

function Step1({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>☑️</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          Convierte una nota en tarea
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          Pulsa <strong>⌘+Enter</strong> sobre cualquier nodo. Una vez → tarea pendiente. Otra vez → hecha. Otra vez → vuelve a ser nota.
        </div>
        {/* Keyboard hint */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
          <kbd style={kbdStyle}>⌘</kbd>
          <span style={{ color: '#999', fontSize: 12 }}>+</span>
          <kbd style={kbdStyle}>↵</kbd>
        </div>
        <PrimaryBtn label="Lo hice →" onClick={onNext} />
        <ProgressDots active={1} />
      </div>
    </>
  )
}

// ── Step 2 — Filter ────────────────────────────────────────────────────────

function Step2({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>🔍</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          Encuentra cualquier cosa
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
          Pulsa <strong>⌘+F</strong> y escribe <code style={codeStyle}>utilizar</code>. Verás cómo From filtra los nodos al instante.
        </div>
        <PrimaryBtn label="Lo probé →" onClick={onNext} />
        <ProgressDots active={2} />
      </div>
    </>
  )
}

// ── Step 3 — Navigate into node ────────────────────────────────────────────

function Step3({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>→</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          Entra dentro de un nodo
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          Pulsa el <strong>punto (●)</strong> que aparece a la izquierda del nodo «Empezar a utilizar From». Puedes crear niveles infinitos.
        </div>
        <div style={{
          background: 'rgba(139,92,246,0.07)', borderRadius: 8, padding: '10px 14px',
          fontSize: 12, color: '#7c3aed', marginBottom: 20, lineHeight: 1.5,
        }}>
          ✦ Avanzará automáticamente cuando entres al nodo.
        </div>
        <ProgressDots active={3} />
      </div>
    </>
  )
}

// ── Step 4 — Magic AI ──────────────────────────────────────────────────────

function Step4({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>✦</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          Pídeme lo que quieras
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          Ya te he preparado algo. Solo pulsa <strong>enviar</strong> y veré qué hago.
        </div>
        <div style={{
          background: 'rgba(139,92,246,0.07)', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#555',
          fontStyle: 'italic', marginBottom: 16, lineHeight: 1.5,
        }}>
          "Desarrolla el nodo con una descripción breve y 3 tareas para empezar a usar From"
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          Esperando que confirmes las acciones…
        </div>
      </div>
    </>
  )
}

// ── Step 5 — Done ──────────────────────────────────────────────────────────

function Step5({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ padding: '24px 20px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          ¡Ya dominas From!
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
          Acabas de crear tu primer contenido con IA. Hay mucho más por descubrir.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a
          href="https://getfrom.app/blog/index.html"
          target="_blank"
          rel="noopener noreferrer"
          style={linkBtnStyle}
        >
          📖 Lee el blog
        </a>
        <a
          href="https://getfrom.app/docs/"
          target="_blank"
          rel="noopener noreferrer"
          style={linkBtnStyle}
        >
          📚 Ver el manual
        </a>
      </div>

      <button
        onClick={onClose}
        style={{
          width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          color: '#fff', border: 'none', borderRadius: 10,
          padding: '11px 16px', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        ¡Vamos a ello! 🚀
      </button>
    </div>
  )
}

// ── Shared style helpers ───────────────────────────────────────────────────

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: '#f0edfb', border: '1px solid #d8ccf8', borderRadius: 6,
  padding: '3px 8px', fontSize: 13, fontWeight: 600, color: '#7c3aed',
  boxShadow: '0 1px 0 #c8b8f4',
}

const codeStyle: React.CSSProperties = {
  background: '#f0edfb', borderRadius: 4, padding: '1px 5px',
  fontFamily: 'monospace', fontSize: 12, color: '#7c3aed',
}

const linkBtnStyle: React.CSSProperties = {
  flex: 1, textAlign: 'center', textDecoration: 'none',
  background: '#f5f3ff', border: '1px solid #e0d9f7',
  borderRadius: 8, padding: '8px 4px', fontSize: 12,
  fontWeight: 500, color: '#7c3aed', display: 'block',
  transition: 'background 0.15s',
}
