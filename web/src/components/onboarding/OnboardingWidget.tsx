// MARK: - OnboardingWidget
//
// Floating guided onboarding card (bottom-right corner).
// 6 interactive steps that guide the user through real actions.
// Shows when localStorage does NOT have 'from_onboarding_done' = '1'.

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { findHomeRoot } from '../../utils/homeHelper'
import { findAgendaRoot, getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'

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
        // Llevar al usuario a su nota de hoy: es donde trabajará a diario, y el
        // primer nodo se crea ahí (hijo de la entrada diaria, que el detector acepta).
        try {
          const diary = getTodayDiaryUnderAgenda()
          if (diary) navigate(`/node/${diary.id}`)
        } catch { /* store aún no listo: el detector funciona igual en la home */ }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimIn(true))
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Raíces de sistema — nunca deben confundirse con la "primera tarea" del usuario.
  // Incluye la raíz home (🏠 From, intocable internamente) y los nombres actuales
  // (⚡ Prompts, 🔍 Filtros) además de los legacy (📊 Paneles, 📌 Atajos).
  const SYSTEM_NAMES = new Set([
    '🏠 From', '📅 Agenda', '🧠 Contexto', '⚡ Prompts', '🤖 Agentes',
    '📋 Plantillas', '🔍 Filtros', '🗑 Papelera',
    '📊 Paneles', '📌 Atajos', // legacy
  ])

  // Timestamp when onboarding starts — used to detect RECENTLY UPDATED tasks
  const onboardingStartRef = useRef<number>(0)

  // ── Step 0: auto-detect task created/updated since onboarding appeared ────
  useEffect(() => {
    if (step !== 0 || !visible) return

    // Record when onboarding became visible (once)
    if (!onboardingStartRef.current) {
      onboardingStartRef.current = Date.now()
    }

    // Padres válidos para "la primera tarea": nivel superior del outliner.
    // Tras introducir la raíz 🏠 From, los nodos top-level cuelgan de ella (o de
    // Agenda), no de null. Aceptamos los tres + cualquier nota diaria.
    const homeRootId = findHomeRoot()?.id ?? null
    const agendaRootId = findAgendaRoot()?.id ?? null
    const isTopLevelParent = (parentId: string | null | undefined): boolean => {
      if (parentId == null) return true
      if (parentId === homeRootId || parentId === agendaRootId) return true
      return !!store.getNode(parentId)?.isDiaryEntry
    }

    const interval = setInterval(() => {
      const since = onboardingStartRef.current - 2000 // 2s of margin
      const candidates = store.allActive().filter(n =>
        !n.isDiaryEntry &&
        !n.deletedAt &&
        n.text?.trim() &&
        n.status !== null &&                          // must be a task
        !SYSTEM_NAMES.has(n.text || '') &&
        isTopLevelParent(n.parentId) &&
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

  // ── Step 4: abrir Magic directamente (el botón flotante ya no existe; ahora
  //    es «+». Lo presentamos abriendo el panel y dejando que el usuario avance). ──
  useEffect(() => {
    if (step !== 4) return
    window.dispatchEvent(new CustomEvent('from:panelMode', { detail: { mode: 'magic' } }))
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
        'Configurar mi perfil en Fromly',
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
            userMsg: 'Añade 3 tareas hijas a este nodo: Explorar el outliner, Probar el filtro y Configurar mi perfil en Fromly',
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
    // Dejar al usuario en su nota de hoy, lista para trabajar (fallback a la raíz).
    try {
      const diary = getTodayDiaryUnderAgenda()
      navigate(diary ? `/node/${diary.id}` : '/', { replace: true })
    } catch {
      navigate('/', { replace: true })
    }
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
      {step === 4 && <Step4Magic onNext={() => advanceTo(5)} onClose={close} />}
      {step === 5 && <Step5 onClose={close} />}
      {step === 6 && <Step6 onClose={close} />}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function CloseBtn({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClose}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#999', fontSize: 18, lineHeight: 1,
        padding: '0 0 0 8px', flexShrink: 0,
      }}
      title={t('onboarding.closeLabel')}
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
  const { t } = useTranslation()
  return (
    <div style={{
      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      padding: '10px 16px',
      fontSize: 12, fontWeight: 700, color: '#fff',
      letterSpacing: 0.3,
    }}>
      {t('onboarding.promise')}
    </div>
  )
}

function AccentLine() {
  return <div style={{ height: 1, margin: '0 20px', background: 'rgba(139,92,246,0.12)' }} />
}

// ── Step 0 — Welcome ───────────────────────────────────────────────────────

function Step0({ tryAgain, onClose }: { tryAgain: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6', lineHeight: 1.3 }}>
          {t('onboarding.step0Promise')}
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <AccentLine />
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>{tryAgain ? '↩️' : '✏️'}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
          {tryAgain ? t('onboarding.step0TryAgainTitle') : t('onboarding.step0Title')}
        </div>

        {/* Subtítulo — distinto según estado */}
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {tryAgain
            ? <>{t('onboarding.step0TryAgainTextBefore')} <strong>Enter</strong>.</>
            : t('onboarding.step0Text')}
        </div>

        <div style={{
          background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8,
          padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#5b21b6',
          marginBottom: 12, letterSpacing: 0.1,
        }}>
          {t('onboarding.step0Example')}
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
              {t('onboarding.step0HintBefore')} <strong>Enter</strong> {t('onboarding.step0HintAfter')}
            </span>
          </div>
        )}

        {/* Indicador de espera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20, marginTop: tryAgain ? 8 : 0, color: '#aaa', fontSize: 12 }}>
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span style={{ marginLeft: 4 }}>{tryAgain ? t('onboarding.step0WaitingRetry') : t('onboarding.step0WaitingWrite')}</span>
        </div>
        <ProgressDots active={0} />
      </div>
    </>
  )
}

// ── Step 1 — Tasks ─────────────────────────────────────────────────────────

function Step1({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>☑️</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          {t('onboarding.step1Title')}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {t('onboarding.step1TextBefore')} <strong>⌘+Enter</strong>:
        </div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 8,
          background: '#f9f9f9', borderRadius: 8, padding: '8px 10px' }}>
          {t('onboarding.step1CycleOnce')}<br />
          {t('onboarding.step1CycleTwice')}<br />
          {t('onboarding.step1CycleThrice')}
        </div>
        {/* Keyboard hint */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
          <kbd style={kbdStyle}>⌘</kbd>
          <span style={{ color: '#999', fontSize: 12 }}>+</span>
          <kbd style={kbdStyle}>↵</kbd>
        </div>
        <PrimaryBtn label={t('onboarding.step1Understood')} onClick={onNext} />
        <ProgressDots active={1} />
      </div>
    </>
  )
}

// ── Step 2 — Filter ────────────────────────────────────────────────────────

function Step2({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>🔍</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          {t('onboarding.step2Title')}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          {t('onboarding.step2TextBefore')} <strong>⌘+F</strong> {t('onboarding.step2TextMiddle')} <code style={codeStyle}>utilizar</code>. {t('onboarding.step2TextAfter')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20, color: '#aaa', fontSize: 12 }}>
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
          <span style={{ marginLeft: 4 }}>{t('onboarding.step2Waiting')}</span>
        </div>
        <ProgressDots active={2} />
      </div>
    </>
  )
}

// ── Step 3 — Navigate into node ────────────────────────────────────────────

function Step3({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>→</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          {t('onboarding.step3Title')}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {t('onboarding.step3TextBefore')} <strong>{t('onboarding.step3Dot')}</strong> {t('onboarding.step3TextAfter')}
        </div>
        <div style={{
          background: 'rgba(139,92,246,0.07)', borderRadius: 8, padding: '10px 14px',
          fontSize: 12, color: '#7c3aed', marginBottom: 20, lineHeight: 1.5,
        }}>
          {t('onboarding.step3Hint')}
        </div>
        <ProgressDots active={3} />
      </div>
    </>
  )
}

// ── Step 4 — Presentar Magic (se abre solo) ─────────────────────────────────

function Step4Magic({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>✦</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          {t('onboarding.step4Title')}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          {t('onboarding.step4TextBefore')} <strong>✦</strong> {t('onboarding.step4TextAfter')}
        </div>
        <PrimaryBtn label={t('onboarding.step4Try')} onClick={onNext} />
      </div>
    </>
  )
}

// ── Step 5 — Magic prefill ─────────────────────────────────────────────────

function Step5({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>✦</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          {t('onboarding.step5Title')}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {t('onboarding.step5TextBefore')} <strong>{t('onboarding.step5Send')}</strong> {t('onboarding.step5TextAfter')}
        </div>
        <div style={{
          background: 'rgba(139,92,246,0.07)', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#555',
          fontStyle: 'italic', marginBottom: 16, lineHeight: 1.5,
        }}>
          {t('onboarding.step5PromptPreview')}
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          {t('onboarding.step5Waiting')}
        </div>
      </div>
    </>
  )
}

// ── Step 6 — Done ──────────────────────────────────────────────────────────

function Step6({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ padding: '24px 20px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          {t('onboarding.step6Title')}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
          {t('onboarding.step6Text')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a
          href="https://fromly.app/blog/index.html"
          target="_blank"
          rel="noopener noreferrer"
          style={linkBtnStyle}
        >
          {t('onboarding.step6Blog')}
        </a>
        <a
          href="https://fromly.app/docs/"
          target="_blank"
          rel="noopener noreferrer"
          style={linkBtnStyle}
        >
          {t('onboarding.step6Manual')}
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
        {t('onboarding.step6Cta')}
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
