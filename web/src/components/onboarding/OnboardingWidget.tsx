// MARK: - OnboardingWidget
//
// Floating guided onboarding card (bottom-right corner).
// 6 interactive steps that guide the user through real actions.
// Shows when localStorage does NOT have 'from_onboarding_done' = '1'.

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

const STORAGE_KEY = 'from_onboarding_done'
const TOTAL_DOTS = 4 // progress dots shown on steps 0–3

export default function OnboardingWidget() {
  const [visible, setVisible]     = useState(false)
  const [animIn, setAnimIn]       = useState(false)
  const [step, setStep]           = useState(0)
  const [demoNodeId, setDemoNodeId] = useState<string | null>(null)
  const [step0TryAgain, setStep0TryAgain] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // ── Initial show logic ─────────────────────────────────────────────────────
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    const params = new URLSearchParams(window.location.search)
    const hasWelcome = params.get('welcome') === '1'

    if (!done || hasWelcome) {
      const timer = setTimeout(() => {
        setVisible(true)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimIn(true))
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const SYSTEM_NAMES = new Set(['📌 Atajos', '📊 Paneles', '🤖 Agentes', '📋 Plantillas', '🗑 Papelera', '📅 Agenda', '🧠 Contexto'])

  // Timestamp when onboarding starts — used to detect RECENTLY UPDATED tasks
  const onboardingStartRef = useRef<number>(0)

  // ── Step 0: auto-detect task created/updated since onboarding appeared ────
  useEffect(() => {
    if (step !== 0 || !visible) return

    // Record when onboarding became visible (once)
    if (!onboardingStartRef.current) {
      onboardingStartRef.current = Date.now()
    }

    const interval = setInterval(() => {
      const since = onboardingStartRef.current - 2000 // 2s of margin
      const candidates = store.allActive().filter(n =>
        !n.isDiaryEntry &&
        !n.deletedAt &&
        n.text?.trim() &&
        n.status !== null &&                          // must be a task
        !SYSTEM_NAMES.has(n.text || '') &&
        (n.parentId === null || store.getNode(n.parentId ?? '')?.isDiaryEntry) &&
        new Date(n.updatedAt ?? 0).getTime() >= since // updated since onboarding started
      )
      if (candidates.length === 0) return

      // Pick the most recently updated candidate
      const recent = candidates.sort((a, b) =>
        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
      )[0]

      // Wait until user has left the bullet (Enter or click elsewhere)
      const nodeEl = document.querySelector(`[data-node-id="${recent.id}"] [contenteditable]`)
      const isStillEditing = nodeEl && (document.activeElement === nodeEl || nodeEl.contains(document.activeElement as Node))
      if (isStillEditing) return

      clearInterval(interval)
      setStep0TryAgain(false)
      setDemoNodeId(recent.id)
      next()
    }, 200)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible])

  // ── Step 0: detectar blur en bullet sin tarea → tryAgain ─────────────────
  useEffect(() => {
    if (step !== 0 || !visible) return
    function handleBlur(e: FocusEvent) {
      const el = e.target as HTMLElement
      if (!el.isContentEditable) return
      const nodeWrapper = el.closest('[data-node-id]')
      if (!nodeWrapper) return
      const nodeId = nodeWrapper.getAttribute('data-node-id')
      if (!nodeId) return
      const node = store.getNode(nodeId)
      if (!node || !node.text?.trim()) return
      if (SYSTEM_NAMES.has(node.text || '')) return
      if (node.status === null) setStep0TryAgain(true)
    }
    document.addEventListener('blur', handleBlur, true)
    return () => document.removeEventListener('blur', handleBlur, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible])

  // ── Step 3: detect navigation into demo node (react-router location + interval fallback) ──
  const step3IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // React to router location changes first (faster than polling)
  useEffect(() => {
    if (step !== 3 || !demoNodeId) return
    if (location.pathname.includes(demoNodeId)) {
      advanceTo(4)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, step, demoNodeId])

  // Fallback: interval poll for cases where location doesn't update
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

  // ── Step 2: auto-avanzar cuando el usuario usa el filtro/búsqueda ────────
  useEffect(() => {
    if (step !== 2) return
    function handler() { next() }
    window.addEventListener('from:filter-changed', handler)
    return () => window.removeEventListener('from:filter-changed', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Step 4 (nuevo): esperar a que el usuario abra Magic ──────────────────
  useEffect(() => {
    if (step !== 4) return
    function handler() { advanceTo(5) }
    window.addEventListener('from:magic-opened', handler)
    return () => window.removeEventListener('from:magic-opened', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Step 5: crear las tareas directamente + mostrar en Magic ─────────────
  useEffect(() => {
    if (step !== 5) return
    if (!demoNodeId) return

    const timer = setTimeout(() => {
      // 1. Crear las 3 tareas directamente en el store (100% fiable)
      const tareas = [
        'Explorar el outliner',
        'Probar el filtro',
        'Configurar mi perfil en From',
      ]
      const createdIds: string[] = []
      for (const text of tareas) {
        const n = store.createNode({
          text,
          parentId: demoNodeId,
          isTask: true,
          types: ['tarea'],
          extraData: { _atomic: '1', _inline: '1' },
        })
        store.updateNode(n.id, { status: 'pending' })
        createdIds.push(n.id)
      }

      // 2. Mostrar la acción en Magic como si la IA la hubiese ejecutado
      window.dispatchEvent(new Event('from:onboarding-reset-magic'))
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('from:onboarding-inject-result', {
          detail: {
            userMsg: 'Añade 3 tareas hijas a este nodo: Explorar el outliner, Probar el filtro y Configurar mi perfil en From',
            assistantMsg: '¡Listo! 🎉 He añadido las 3 tareas hijas al nodo.',
            createdIds,
          },
        }))
        // Avanzar al step final
        setTimeout(() => advanceTo(6), 1200)
      }, 400)
    }, 600)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, demoNodeId])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function advanceTo(s: number) { setStep(s) }

  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setAnimIn(false)
    // Resetear Magic y cerrar panel
    window.dispatchEvent(new Event('from:onboarding-reset-magic'))
    window.dispatchEvent(new CustomEvent('from:panelMode', { detail: { mode: null } }))
    // Volver a la raíz
    navigate('/', { replace: true })
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
        bottom: 80,
        left: 16,
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
      {step === 0 && <Step0 tryAgain={step0TryAgain} onClose={close} />}
      {step === 1 && <Step1 onNext={next} onClose={close} />}
      {step === 2 && <Step2 onClose={close} />}
      {step === 3 && <Step3 onClose={close} />}
      {step === 4 && <Step4Magic onClose={close} />}
      {step === 5 && <Step5 onClose={close} />}
      {step === 6 && <Step6 onClose={close} />}
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

function Step0({ tryAgain, onClose }: { tryAgain: boolean; onClose: () => void }) {
  return (
    <>
      <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6', lineHeight: 1.3 }}>
          ✦ Te prometo que será UN MINUTO.
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <AccentLine />
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>{tryAgain ? '↩️' : '✏️'}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
          {tryAgain ? 'Inténtalo de nuevo' : 'Tu primer nodo'}
        </div>

        {/* Subtítulo — distinto según estado */}
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {tryAgain
            ? <>Ese nodo se quedó a medias. Escríbelo completo en un bullet nuevo y pulsa <strong>Enter</strong>.</>
            : 'Pulsa en cualquier parte del outliner y escribe:'}
        </div>

        <div style={{
          background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8,
          padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#5b21b6',
          marginBottom: 12, letterSpacing: 0.1,
        }}>
          Empezar a utilizar From
        </div>

        {/* Hint solo en el estado inicial */}
        {!tryAgain && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: '#fafafa', border: '1px solid #ebebeb',
            borderRadius: 8, padding: '8px 10px', marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <span style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
              Fíjate en lo que aparece al lado del nodo mientras escribes. Pulsa <strong>Enter</strong> para confirmar.
            </span>
          </div>
        )}

        {/* Indicador de espera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20, marginTop: tryAgain ? 8 : 0, color: '#aaa', fontSize: 12 }}>
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span style={{ marginLeft: 4 }}>{tryAgain ? 'Esperando el nuevo intento…' : 'Esperando que lo escribas…'}</span>
        </div>
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
          ¡Ya tienes tu primera tarea!
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          Cuanto más me uses, mejores propuestas haré. También puedes convertir cualquier nota en tarea con <strong>⌘+Enter</strong>:
        </div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 8,
          background: '#f9f9f9', borderRadius: 8, padding: '8px 10px' }}>
          Una vez → ☐ pendiente<br />
          Otra vez → ✓ hecha<br />
          Otra vez → vuelve a nota
        </div>
        {/* Keyboard hint */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
          <kbd style={kbdStyle}>⌘</kbd>
          <span style={{ color: '#999', fontSize: 12 }}>+</span>
          <kbd style={kbdStyle}>↵</kbd>
        </div>
        <PrimaryBtn label="Entendido →" onClick={onNext} />
        <ProgressDots active={1} />
      </div>
    </>
  )
}

// ── Step 2 — Filter ────────────────────────────────────────────────────────

function Step2({ onClose }: { onClose: () => void }) {
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
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          Pulsa <strong>⌘+F</strong> y escribe <code style={codeStyle}>utilizar</code>. Verás cómo From filtra los nodos al instante.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20, color: '#aaa', fontSize: 12 }}>
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span style={{ marginLeft: 4 }}>Esperando que uses el filtro…</span>
        </div>
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
          ✦ El punto aparece al pasar el ratón por encima del nodo.
        </div>
        <ProgressDots active={3} />
      </div>
    </>
  )
}

// ── Step 4 — Magic AI ──────────────────────────────────────────────────────

// ── Step 4 — Abrir Magic ───────────────────────────────────────────────────

function Step4Magic({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>✦</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          Ahora ábreme a mí
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          Pulsa el botón <strong>✦</strong> que ves abajo a la derecha para abrir el chat completo.
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          Esperando que me abras…
        </div>
      </div>
    </>
  )
}

// ── Step 5 — Magic prefill ─────────────────────────────────────────────────

function Step5({ onClose }: { onClose: () => void }) {
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
          Añade 3 tareas hijas a este nodo: Explorar el outliner, Probar el filtro y Configurar mi perfil en From
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          Esperando que confirmes las acciones…
        </div>
      </div>
    </>
  )
}

// ── Step 6 — Done ──────────────────────────────────────────────────────────

function Step6({ onClose }: { onClose: () => void }) {
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
