// MARK: - V2Onboarding
//
// Tarjeta flotante de bienvenida para Fromly 2.0 (chat-first). El OnboardingWidget
// antiguo (`components/onboarding/OnboardingWidget.tsx`) enseña el lienzo infinito y solo
// se monta en `MainLayout` (v1, ahora en /v1) — invisible en v2, que es la app principal
// desde que se retiró la beta. Este es su equivalente para v2: sidebar de contextos, chat
// central, columna derecha con sus modos, archivos/RAG. Puro tour guiado (sin detección de
// acciones reales) — más simple y suficiente para un flujo que aún no tiene UI estable que
// mirar con precisión pixel a pixel.
// Se muestra si localStorage NO tiene 'from_onboarding_v2_done' = '1' (o con ?welcome=1).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'from_onboarding_v2_done'
const TOTAL_STEPS = 6 // pasos 0–5

export default function V2Onboarding() {
  const [visible, setVisible] = useState(false)
  const [animIn, setAnimIn] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    const params = new URLSearchParams(window.location.search)
    const hasWelcome = params.get('welcome') === '1'
    if (done && !hasWelcome) return
    const timer = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)))
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setAnimIn(false)
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
      {step === 0 && <StepWelcome onNext={next} onClose={close} />}
      {step === 1 && <StepContexts onNext={next} onClose={close} />}
      {step === 2 && <StepChat onNext={next} onClose={close} />}
      {step === 3 && <StepRightColumn onNext={next} onClose={close} />}
      {step === 4 && <StepFiles onNext={next} onClose={close} />}
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

// ── Paso 0 — Bienvenida ─────────────────────────────────────────────────────

function StepWelcome({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <TopBar />
      <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6', lineHeight: 1.3 }}>{t('v2Onboarding.welcomeTitle')}</div>
        <CloseBtn onClose={onClose} />
      </div>
      <AccentLine />
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{t('v2Onboarding.welcomeText')}</div>
        <PrimaryBtn label={t('v2Onboarding.next')} onClick={onNext} />
        <ProgressDots active={0} />
      </div>
    </>
  )
}

// ── Paso 1 — Sidebar de contextos ───────────────────────────────────────────

function StepContexts({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="📂" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('v2Onboarding.contextsTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{t('v2Onboarding.contextsText')}</div>
        <PrimaryBtn label={t('v2Onboarding.next')} onClick={onNext} />
        <ProgressDots active={1} />
      </div>
    </>
  )
}

// ── Paso 2 — Chat central ───────────────────────────────────────────────────

function StepChat({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="💬" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('v2Onboarding.chatTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
          {t('v2Onboarding.chatTextBefore')} <strong>«{t('v2Onboarding.chatExample')}»</strong> {t('v2Onboarding.chatTextAfter')}
        </div>
        <PrimaryBtn label={t('v2Onboarding.next')} onClick={onNext} />
        <ProgressDots active={2} />
      </div>
    </>
  )
}

// ── Paso 3 — Columna derecha ────────────────────────────────────────────────

function StepRightColumn({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="🗂️" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('v2Onboarding.rightTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{t('v2Onboarding.rightText')}</div>
        <PrimaryBtn label={t('v2Onboarding.next')} onClick={onNext} />
        <ProgressDots active={3} />
      </div>
    </>
  )
}

// ── Paso 4 — Archivos + RAG ─────────────────────────────────────────────────

function StepFiles({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeader emoji="📎" onClose={onClose} />
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('v2Onboarding.filesTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{t('v2Onboarding.filesText')}</div>
        <PrimaryBtn label={t('v2Onboarding.next')} onClick={onNext} />
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
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t('v2Onboarding.doneTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{t('v2Onboarding.doneText')}</div>
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
      >{t('v2Onboarding.start')}</button>
    </div>
  )
}

const linkBtnStyle: React.CSSProperties = {
  flex: 1, textAlign: 'center', textDecoration: 'none',
  background: '#f5f3ff', border: '1px solid #e0d9f7',
  borderRadius: 8, padding: '8px 4px', fontSize: 12,
  fontWeight: 500, color: '#7c3aed', display: 'block',
  transition: 'background 0.15s',
}
