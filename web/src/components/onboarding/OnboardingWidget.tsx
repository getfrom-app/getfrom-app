// MARK: - OnboardingWidget
//
// Tarjeta flotante de bienvenida (esquina inferior izquierda). Onboarding CANVAS-FIRST:
// refleja el Fromly actual (lienzo infinito, tarjetas de texto, magic verbo→tarea, panel
// derecho + publicar, dibujar/soltar archivos, IA ✦). Dos pasos son interactivos de verdad
// (crear tu primera tarjeta; probar el magic); el resto es un tour guiado con «Siguiente».
// Se muestra si localStorage NO tiene 'from_onboarding_done' = '1' (o con ?welcome=1).

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'

const STORAGE_KEY = 'from_onboarding_done'
const TOTAL_STEPS = 6 // pasos 0–5

// ¿El nodo es una TARJETA DE TEXTO del lienzo? (`_doc`/`_ctext`), no tarea-embed ni sistema.
function isTextCard(ed: string | null | undefined): boolean {
  try { const e = JSON.parse(ed || '{}'); return (e._doc === '1' || e._ctext === '1') && e._taskEmbed !== '1' } catch { return false }
}

export default function OnboardingWidget() {
  const [visible, setVisible] = useState(false)
  const [animIn, setAnimIn]   = useState(false)
  const [step, setStep]       = useState(0)
  const navigate = useNavigate()

  // Marca de tiempo de arranque de cada paso interactivo (para detectar creaciones nuevas).
  const stepStartRef = useRef<number>(0)

  // ── Mostrar al inicio + llevar al lienzo ────────────────────────────────────
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    const params = new URLSearchParams(window.location.search)
    const hasWelcome = params.get('welcome') === '1'
    if (done && !hasWelcome) return
    const timer = setTimeout(() => {
      setVisible(true)
      // El home es el LIENZO infinito global (`/`). Ahí se crea la primera tarjeta.
      try { navigate('/') } catch { /* store aún no listo */ }
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)))
    }, 1200)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reiniciar el reloj del paso cada vez que entramos en un paso interactivo (0 o 1).
  useEffect(() => {
    if (step === 0 || step === 1) stepStartRef.current = Date.now()
  }, [step])

  // ── Paso 0: detectar la PRIMERA tarjeta de texto creada en el lienzo ─────────
  useEffect(() => {
    if (step !== 0 || !visible) return
    const iv = setInterval(() => {
      const since = stepStartRef.current - 1500
      const card = store.allActive().find(n =>
        !n.deletedAt && isTextCard(n.extraData) &&
        new Date(n.createdAt ?? 0).getTime() >= since,
      )
      if (card) { clearInterval(iv); setStep(1) }
    }, 250)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible])

  // ── Paso 1: detectar que el magic creó una TAREA (verbo→casilla) ────────────
  useEffect(() => {
    if (step !== 1 || !visible) return
    const iv = setInterval(() => {
      const since = stepStartRef.current - 500
      const task = store.allActive().find(n =>
        !n.deletedAt && n.status !== null && n.text?.trim() &&
        new Date(n.createdAt ?? 0).getTime() >= since,
      )
      if (task) { clearInterval(iv); setStep(2) }
    }, 250)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible])

  // ── Cierre / navegación ─────────────────────────────────────────────────────
  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setAnimIn(false)
    try { navigate('/', { replace: true }) } catch { /* noop */ }
    setTimeout(() => setVisible(false), 300)
  }
  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)) }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 80, left: 16, width: 340, zIndex: 9999,
        background: '#ffffff', borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid rgba(139,92,246,0.15)', overflow: 'hidden',
        opacity: animIn ? 1 : 0, transform: animIn ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {step === 0 && <StepCanvas onClose={close} onSkip={next} />}
      {step === 1 && <StepMagic onClose={close} onSkip={next} />}
      {step === 2 && <StepPanel onNext={next} onClose={close} />}
      {step === 3 && <StepEverything onNext={next} onClose={close} />}
      {step === 4 && <StepAI onNext={next} onClose={close} />}
      {step === 5 && <StepDone onClose={close} />}
    </div>
  )
}

// ── Sub-componentes compartidos ─────────────────────────────────────────────

function CloseBtn({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClose}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 18, lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}
      title={t('onboarding.closeLabel')}
    >×</button>
  )
}

function ProgressDots({ active }: { active: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, background: i === active ? '#8b5cf6' : '#e0d9f7', transition: 'width 0.25s ease, background 0.25s ease' }} />
      ))}
    </div>
  )
}

function PrimaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16, transition: 'opacity 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >{label}</button>
  )
}

function SkipLink({ onSkip }: { onSkip: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onSkip}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 12, padding: 0, textDecoration: 'underline', display: 'block', margin: '0 auto 14px' }}
    >{t('onboarding.skip')}</button>
  )
}

function WaitingDots({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 18, color: '#aaa', fontSize: 12 }}>
      <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
      <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
      <span className="wf-filter-ai-dot" style={{ background: '#c4b5fd' }} />
      <span style={{ marginLeft: 4 }}>{label}</span>
    </div>
  )
}

function TopBar() {
  const { t } = useTranslation()
  return (
    <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>
      {t('onboarding.promise')}
    </div>
  )
}

function AccentLine() {
  return <div style={{ height: 1, margin: '0 20px', background: 'rgba(139,92,246,0.12)' }} />
}

function StepHeader({ emoji, onClose }: { emoji: string; onClose: () => void }) {
  return (
    <>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
      <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28 }}>{emoji}</div>
        <CloseBtn onClose={onClose} />
      </div>
    </>
  )
}

// ── Paso 0 — Lienzo: crea tu primera tarjeta ────────────────────────────────

function StepCanvas({ onClose, onSkip }: { onClose: () => void; onSkip: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <TopBar />
      <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6', lineHeight: 1.3 }}>{t('onboarding.v2.canvasTitle')}</div>
        <CloseBtn onClose={onClose} />
      </div>
      <AccentLine />
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🖱️</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {t('onboarding.v2.canvasTextBefore')} <strong>{t('onboarding.v2.doubleClick')}</strong> {t('onboarding.v2.canvasTextAfter')}
        </div>
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#5b21b6', marginBottom: 14, letterSpacing: 0.1 }}>
          {t('onboarding.v2.canvasHint')}
        </div>
        <WaitingDots label={t('onboarding.v2.canvasWaiting')} />
        <SkipLink onSkip={onSkip} />
        <ProgressDots active={0} />
      </div>
    </>
  )
}

// ── Paso 1 — Magic verbo→tarea ──────────────────────────────────────────────

function StepMagic({ onClose, onSkip }: { onClose: () => void; onSkip: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="✨" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('onboarding.v2.magicTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {t('onboarding.v2.magicTextBefore')} <strong>Enter</strong>.
        </div>
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#5b21b6', marginBottom: 12 }}>
          ☐ {t('onboarding.v2.magicExample')}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fafafa', border: '1px solid #ebebeb', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{t('onboarding.v2.magicHint')}</span>
        </div>
        <WaitingDots label={t('onboarding.v2.magicWaiting')} />
        <SkipLink onSkip={onSkip} />
        <ProgressDots active={1} />
      </div>
    </>
  )
}

// ── Paso 2 — Panel derecho + publicar ───────────────────────────────────────

function StepPanel({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="📄" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('onboarding.v2.panelTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          {t('onboarding.v2.panelTextBefore')} <strong>🌐</strong> {t('onboarding.v2.panelTextAfter')}
        </div>
        <PrimaryBtn label={t('onboarding.v2.next')} onClick={onNext} />
        <ProgressDots active={2} />
      </div>
    </>
  )
}

// ── Paso 3 — Todo en el mismo lienzo ────────────────────────────────────────

function StepEverything({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="🎨" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('onboarding.v2.everythingTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{t('onboarding.v2.everythingText')}</div>
        <PrimaryBtn label={t('onboarding.v2.next')} onClick={onNext} />
        <ProgressDots active={3} />
      </div>
    </>
  )
}

// ── Paso 4 — IA ✦ ───────────────────────────────────────────────────────────

function StepAI({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="✦" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('onboarding.v2.aiTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          {t('onboarding.v2.aiTextBefore')} <strong>✦</strong> {t('onboarding.v2.aiTextAfter')}
        </div>
        <PrimaryBtn label={t('onboarding.v2.next')} onClick={onNext} />
        <ProgressDots active={4} />
      </div>
    </>
  )
}

// ── Paso 5 — Listo ──────────────────────────────────────────────────────────

function StepDone({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ padding: '24px 20px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('onboarding.v2.doneTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{t('onboarding.v2.doneText')}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href="https://fromly.app/blog/index.html" target="_blank" rel="noopener noreferrer" style={linkBtnStyle}>{t('onboarding.step6Blog')}</a>
        <a href="https://fromly.app/docs/" target="_blank" rel="noopener noreferrer" style={linkBtnStyle}>{t('onboarding.step6Manual')}</a>
      </div>
      <button
        onClick={onClose}
        style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >{t('onboarding.v2.start')}</button>
    </div>
  )
}

// ── Estilos compartidos ─────────────────────────────────────────────────────

const linkBtnStyle: React.CSSProperties = {
  flex: 1, textAlign: 'center', textDecoration: 'none',
  background: '#f5f3ff', border: '1px solid #e0d9f7',
  borderRadius: 8, padding: '8px 4px', fontSize: 12,
  fontWeight: 500, color: '#7c3aed', display: 'block',
  transition: 'background 0.15s',
}
