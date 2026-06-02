/**
 * RecorderPanel — grabadora en panel derecho (v9.5.26)
 * Botón en primera línea, transcripción editable en tiempo real debajo.
 */
import { useEffect, useRef, useState } from 'react'
import { useRecordingStore } from '../../store/recordingStore'
import { processRecording, type ProcessingResult } from '../../utils/recordingProcessor'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

type MicPerm = 'unknown' | 'granted' | 'denied' | 'prompt'
type State   = 'idle' | 'processing' | 'done' | 'error'

// Primera línea — mismo padding-top que el input del buscador (32px)
const FIRST_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '32px 12px 10px', flexShrink: 0,
}

interface Props { onClose: () => void }

export default function RecorderPanel({ onClose }: Props) {
  const r = useRecordingStore()
  const navigate = useNavigate()
  const [micPerm,  setMicPerm]  = useState<MicPerm>('unknown')
  const [state,    setState]    = useState<State>('idle')
  const [result,   setResult]   = useState<ProcessingResult | null>(null)
  const [errMsg,   setErrMsg]   = useState('')
  const prevPhase   = useRef(r.phase)
  // Ref al div editable de transcripción
  const txRef       = useRef<HTMLDivElement>(null)
  // ¿El usuario ha empezado a editar manualmente?
  const userEditing = useRef(false)

  // Permiso micrófono
  useEffect(() => {
    if (!navigator.permissions) { setMicPerm('prompt'); return }
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then(s => { setMicPerm(s.state as MicPerm); s.onchange = () => setMicPerm(s.state as MicPerm) })
      .catch(() => setMicPerm('prompt'))
  }, [])

  // Actualizar transcripción en vivo si el usuario no ha editado
  useEffect(() => {
    if (r.phase !== 'recording' || userEditing.current) return
    if (txRef.current && txRef.current.textContent !== r.transcript) {
      txRef.current.textContent = r.transcript || ''
    }
  }, [r.transcript, r.phase])

  // Detectar fin de grabación → procesar
  useEffect(() => {
    if (prevPhase.current === 'recording' && r.phase === 'done') process()
    prevPhase.current = r.phase
  }, [r.phase]) // eslint-disable-line

  async function process() {
    const text = (txRef.current?.textContent || r.finalText || r.transcript).trim()
    if (!text) { setState('error'); setErrMsg('Sin transcripción.'); return }
    setState('processing')
    try {
      const res = await processRecording(text, r.elapsed)
      setResult(res); setState('done')
    } catch (e) {
      if (e instanceof Error && e.message === 'TOKENS') { setState('idle'); r.resetRecording() }
      else { setErrMsg(e instanceof Error ? e.message : 'Error'); setState('error') }
    }
  }

  function reset() {
    r.resetRecording(); setState('idle'); setResult(null); setErrMsg(''); userEditing.current = false
    if (txRef.current) txRef.current.textContent = ''
  }

  // ── Procesando ───────────────────────────────────────────────────────────
  if (state === 'processing') return (
    <div style={FIRST_ROW}>
      <span style={{ fontSize: 13, color: 'var(--accent)' }}>Analizando con IA…</span>
    </div>
  )

  // ── Hecho ────────────────────────────────────────────────────────────────
  if (state === 'done' && result) return (
    <div style={FIRST_ROW}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>✅ Guardado en el diario</span>
      <button onClick={() => { const n = store.getNode(result.parentId); if (n) navigate(`/node/${n.parentId ?? result.parentId}`) }}
        style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Ver</button>
      <button onClick={reset}
        style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>↺</button>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────
  if (state === 'error') return (
    <div style={FIRST_ROW}>
      <span style={{ fontSize: 13, color: 'var(--warning)', flex: 1 }}>⚠️ {errMsg}</span>
      <button onClick={reset} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>↺</button>
    </div>
  )

  // ── Grabando ─────────────────────────────────────────────────────────────
  if (r.phase === 'recording') return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(239,68,68,0.03)' }}>
      {/* Primera línea: timer + waveform + stop */}
      <div style={FIRST_ROW}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(r.elapsed)}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{
              width: 2.5, flexShrink: 0, borderRadius: 2,
              height: Math.max(3, Math.min(16, r.audioLevel * 18 * (0.4 + Math.sin(i * 1.3 + Date.now() / 200) * 0.3 + 0.3))),
              background: r.audioLevel > 0.05 ? '#ef4444' : 'var(--border)',
              transition: 'height 0.08s',
            }} />
          ))}
        </div>
        <button onClick={() => r.stopRecording()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, flexShrink: 0 }} title="Parar">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1.5"/></svg>
        </button>
      </div>

      {/* Transcripción editable en tiempo real */}
      <div
        ref={txRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => { userEditing.current = true }}
        onBlur={() => { userEditing.current = false }}
        data-placeholder="Escuchando…"
        style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          padding: '0 12px 12px',
          fontSize: 13, color: 'var(--text-primary)',
          lineHeight: 1.6, outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={FIRST_ROW}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
          {micPerm === 'denied' ? 'Micrófono bloqueado en el navegador' : 'Pulsa ● para grabar'}
        </span>
        {micPerm !== 'denied' && (
          <button
            onClick={() => { userEditing.current = false; r.startRecording() }}
            disabled={!r.isSupported}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, flexShrink: 0 }}
            title="Iniciar grabación"
          >
            <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="currentColor"/></svg>
          </button>
        )}
      </div>
    </div>
  )
}
