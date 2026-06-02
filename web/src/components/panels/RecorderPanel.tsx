/**
 * RecorderPanel — grabadora en panel derecho (v9.5.31)
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
type State   = 'idle' | 'recording' | 'processing' | 'done' | 'error'

interface Props { onClose: () => void }

export default function RecorderPanel({ onClose }: Props) {
  const r          = useRecordingStore()
  const navigate   = useNavigate()
  const [micPerm, setMicPerm] = useState<MicPerm>('unknown')
  const [state,   setState]   = useState<State>('idle')
  const [result,  setResult]  = useState<ProcessingResult | null>(null)
  const [errMsg,  setErrMsg]  = useState('')
  const prevPhase  = useRef(r.phase)
  const txRef      = useRef<HTMLDivElement>(null)
  const userEdited = useRef(false)

  // Permiso micrófono
  useEffect(() => {
    if (!navigator.permissions) { setMicPerm('prompt'); return }
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then(s => { setMicPerm(s.state as MicPerm); s.onchange = () => setMicPerm(s.state as MicPerm) })
      .catch(() => setMicPerm('prompt'))
  }, [])

  // Detectar inicio/fin de grabación
  useEffect(() => {
    if (prevPhase.current !== 'recording' && r.phase === 'recording') {
      setState('recording')
      userEdited.current = false
    }
    if (prevPhase.current === 'recording' && r.phase === 'done') {
      setState('processing')
      process()
    }
    prevPhase.current = r.phase
  }, [r.phase]) // eslint-disable-line

  // Actualizar transcript en vivo si el usuario no ha editado
  useEffect(() => {
    if (r.phase !== 'recording' || userEdited.current || !txRef.current) return
    if (txRef.current.textContent !== r.transcript) {
      txRef.current.textContent = r.transcript || ''
      // Cursor al final
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(txRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [r.transcript, r.phase])

  async function process() {
    const edited = txRef.current?.textContent?.trim() || ''
    const text = edited || r.finalText || r.transcript
    if (!text.trim()) { setState('error'); setErrMsg('Sin transcripción detectable.'); return }
    try {
      const res = await processRecording(text.trim(), r.elapsed)
      setResult(res)
      setState('done')
      // Navegar directamente al nodo creado
      const parent = store.getNode(res.parentId)
      if (parent) navigate(`/node/${parent.parentId ?? res.parentId}`)
    } catch (e) {
      if (e instanceof Error && e.message === 'TOKENS') { setState('idle'); r.resetRecording() }
      else { setErrMsg(e instanceof Error ? e.message : 'Error procesando'); setState('error') }
    }
  }

  function reset() {
    r.resetRecording()
    setState('idle')
    setResult(null)
    setErrMsg('')
    userEdited.current = false
    if (txRef.current) txRef.current.textContent = ''
  }

  // Waveform — visible en recording e idle (barras estáticas en idle)
  function Waveform({ active }: { active: boolean }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
        {Array.from({ length: 20 }).map((_, i) => {
          const h = active
            ? Math.max(3, Math.min(18, r.audioLevel * 20 * (0.3 + Math.abs(Math.sin(i * 0.9 + Date.now() / 150)) * 0.7)))
            : 3
          return (
            <div key={i} style={{
              width: 2.5, borderRadius: 2, flexShrink: 0,
              height: h,
              background: active
                ? (r.audioLevel > 0.05 ? '#ef4444' : 'var(--border)')
                : 'var(--border)',
              transition: active ? 'height 0.06s' : 'none',
              opacity: active ? 1 : 0.4,
            }} />
          )
        })}
      </div>
    )
  }

  const isActive = state === 'recording'
  const showTranscript = isActive || state === 'processing' || state === 'done' || state === 'error'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Primera línea: waveform + timer + botón */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px 10px', flexShrink: 0,
      }}>
        <Waveform active={isActive} />

        {isActive && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {fmt(r.elapsed)}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Estado: botón rec / stop / analyzing / nueva */}
        {state === 'idle' && (
          <button
            onClick={() => { userEdited.current = false; r.startRecording() }}
            disabled={!r.isSupported || micPerm === 'denied'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, flexShrink: 0 }}
            title="Iniciar grabación (R)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="currentColor"/></svg>
          </button>
        )}
        {state === 'recording' && (
          <button
            onClick={() => r.stopRecording()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, flexShrink: 0 }}
            title="Parar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1.5"/></svg>
          </button>
        )}
        {state === 'processing' && (
          <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0, fontStyle: 'italic' }}>Analizando…</span>
        )}
        {(state === 'done' || state === 'error') && (
          <button onClick={reset}
            style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            title="Nueva grabación"
          >↺ Nueva</button>
        )}
      </div>

      {/* Transcripción editable — visible durante grabación, análisis y resultado */}
      {showTranscript && (
        <div
          ref={txRef}
          contentEditable={isActive}
          suppressContentEditableWarning
          onFocus={() => { userEdited.current = true }}
          onBlur={() => { userEdited.current = false }}
          style={{
            flex: 1, minHeight: 0, overflow: 'auto',
            padding: '0 12px 40px',
            fontSize: 13, color: 'var(--text-primary)',
            lineHeight: 1.65, outline: 'none', fontFamily: 'inherit',
            opacity: state === 'processing' ? 0.7 : 1,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Idle: placeholder */}
      {state === 'idle' && micPerm === 'denied' && (
        <div style={{ padding: '0 12px', fontSize: 13, color: 'var(--warning)' }}>
          Micrófono bloqueado en el navegador.
        </div>
      )}

      {state === 'error' && (
        <div style={{ padding: '0 12px', fontSize: 12, color: 'var(--warning)' }}>⚠️ {errMsg}</div>
      )}
    </div>
  )
}
