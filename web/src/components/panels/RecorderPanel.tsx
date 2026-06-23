/**
 * RecorderPanel — grabadora en la columna derecha.
 *
 * Flujo (reescrito):
 *   1. Al abrir desde el botón REC empieza a grabar → onda + timer + transcripción
 *      en vivo + botón ■ para parar.
 *   2. Al parar muestra la TRANSCRIPCIÓN final (editable) + botón «Crear nota».
 *   3. Al pulsar «Crear nota» se crea una nota hija del día (título contextual por
 *      IA) con un nodo dentro = la transcripción, se navega a ella y se abre Magic
 *      en la columna derecha para trabajar sobre esa nota.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecordingStore } from '../../store/recordingStore'
import { createNoteFromTranscript } from '../../utils/recordingProcessor'

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

type MicPerm = 'unknown' | 'granted' | 'denied' | 'prompt'
type State   = 'idle' | 'recording' | 'review' | 'creating' | 'error'

interface Props { onClose: () => void }

export default function RecorderPanel({ onClose }: Props) {
  const r          = useRecordingStore()
  const navigate   = useNavigate()
  const [micPerm, setMicPerm] = useState<MicPerm>('unknown')
  const [state,   setState]   = useState<State>(r.phase === 'recording' ? 'recording' : 'idle')
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

  // Detectar inicio/fin de grabación → estado del panel.
  useEffect(() => {
    if (prevPhase.current !== 'recording' && r.phase === 'recording') {
      setState('recording')
      setErrMsg('')
      userEdited.current = false
    }
    if (prevPhase.current === 'recording' && r.phase === 'done') {
      // NO se procesa solo: pasa a revisión y espera a «Crear nota».
      const final = (r.finalText || r.transcript).trim()
      if (txRef.current && !userEdited.current) txRef.current.textContent = final
      setState('review')
    }
    prevPhase.current = r.phase
  }, [r.phase]) // eslint-disable-line

  // Transcripción en vivo mientras se graba (si el usuario no ha editado a mano).
  useEffect(() => {
    if (r.phase !== 'recording' || userEdited.current || !txRef.current) return
    if (txRef.current.textContent !== r.transcript) {
      txRef.current.textContent = r.transcript || ''
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(txRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [r.transcript, r.phase])

  async function createNote() {
    const text = (txRef.current?.textContent || r.finalText || r.transcript).trim()
    if (!text) { setState('error'); setErrMsg('Sin transcripción detectable.'); return }
    setState('creating')
    try {
      const { parentId } = await createNoteFromTranscript(text, r.elapsed)
      r.resetRecording()
      // Navegar a la nota (izquierda) y abrir Magic (derecha) para trabajar sobre ella.
      navigate(`/node/${parentId}`)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('magic-chat:open-with-text', { detail: { text: '' } }))
      }, 60)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Error creando la nota')
      setState('review')
    }
  }

  function reset() {
    r.resetRecording()
    setState('idle')
    setErrMsg('')
    userEdited.current = false
    if (txRef.current) txRef.current.textContent = ''
  }

  // Onda — barras animadas mientras graba; estáticas en reposo.
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
              background: active ? (r.audioLevel > 0.05 ? '#ef4444' : 'var(--border)') : 'var(--border)',
              transition: active ? 'height 0.06s' : 'none',
              opacity: active ? 1 : 0.4,
            }} />
          )
        })}
      </div>
    )
  }

  const isActive      = state === 'recording'
  const showTranscript = isActive || state === 'review' || state === 'creating'
  const editable      = isActive || state === 'review'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Cabecera: onda + timer + control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 10px', flexShrink: 0 }}>
        <Waveform active={isActive} />

        {isActive && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {fmt(r.elapsed)}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {state === 'idle' && (
          <button
            onClick={() => { userEdited.current = false; r.startRecording() }}
            disabled={!r.isSupported || micPerm === 'denied'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, flexShrink: 0 }}
            title="Iniciar grabación"
          >
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="currentColor" /></svg>
          </button>
        )}
        {state === 'recording' && (
          <button
            onClick={() => r.stopRecording()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, flexShrink: 0 }}
            title="Parar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
          </button>
        )}
        {state === 'creating' && (
          <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0, fontStyle: 'italic' }}>Creando nota…</span>
        )}
        {state === 'review' && (
          <button onClick={reset}
            style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            title="Descartar y grabar de nuevo"
          >↺ Nueva</button>
        )}
      </div>

      {/* Transcripción editable */}
      {showTranscript && (
        <div
          ref={txRef}
          contentEditable={editable}
          suppressContentEditableWarning
          onFocus={() => { userEdited.current = true }}
          onBlur={() => { userEdited.current = false }}
          style={{
            flex: 1, minHeight: 0, overflow: 'auto',
            padding: '0 12px 12px',
            fontSize: 13, color: 'var(--text-primary)',
            lineHeight: 1.65, outline: 'none', fontFamily: 'inherit',
            opacity: state === 'creating' ? 0.7 : 1, transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Botón «Crear nota» en revisión */}
      {state === 'review' && (
        <div style={{ padding: '8px 12px 14px', flexShrink: 0 }}>
          <button
            onClick={createNote}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              border: 'none', background: 'var(--accent, #6c5ce7)', color: '#fff',
              fontSize: 13.5, fontWeight: 600,
            }}
          >Crear nota</button>
          {errMsg && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--warning, #d97706)' }}>⚠️ {errMsg}</div>}
        </div>
      )}

      {/* Idle: avisos */}
      {state === 'idle' && micPerm === 'denied' && (
        <div style={{ padding: '0 12px', fontSize: 13, color: 'var(--warning)' }}>
          Micrófono bloqueado en el navegador.
        </div>
      )}
      {state === 'idle' && !r.isSupported && (
        <div style={{ padding: '0 12px', fontSize: 13, color: 'var(--text-tertiary)' }}>
          Tu navegador no soporta grabación de voz. Usa Chrome.
        </div>
      )}
      {state === 'error' && (
        <div style={{ padding: '0 12px', fontSize: 12, color: 'var(--warning)' }}>⚠️ {errMsg}</div>
      )}
    </div>
  )
}
