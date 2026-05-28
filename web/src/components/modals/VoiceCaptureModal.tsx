import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useRecordingStore } from '../../store/recordingStore'
import { store } from '../../store/nodeStore'

interface Props {
  onClose: () => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function VoiceCaptureModal({ onClose }: Props) {
  const r = useRecordingStore()
  const navigate = useNavigate()

  const levelPercent = r.phase === 'recording' ? Math.max(6, Math.min(100, r.audioLevel * 100)) : 0

  function saveNote() {
    const text = (r.finalText || r.transcript).trim()
    if (!text) return
    const diary = store.todayDiary()
    // Primera oración → título, resto → nodos hijos (nunca .body)
    const sentences = text.split(/(?<=[.!?])\s+/).filter(l => l.trim())
    const title = (sentences[0] || text).slice(0, 80)
    const node = store.createNode({ text: title, parentId: diary?.id || null })
    for (const sentence of sentences.slice(1)) {
      if (sentence.trim()) store.createNode({ text: sentence.trim(), parentId: node.id })
    }
    r.resetRecording()
    navigate(`/node/${node.id}`)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card voice-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">🎙</span>
          <h2>Grabación de voz</h2>
          {/* Closing modal does NOT stop recording */}
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {!r.isSupported && (
          <div className="voice-unsupported">
            La grabación de voz requiere Chrome o Edge.
          </div>
        )}

        {r.error && <div className="auth-error">{r.error}</div>}

        {/* Visualizer */}
        <div className="voice-visualizer">
          {r.phase === 'recording' ? (
            <div className="voice-level-wrap">
              {r.audioLevel > 0 ? (
                <div className="voice-level-bar-track">
                  <div className="voice-level-bar-fill" style={{ width: `${levelPercent}%` }} />
                </div>
              ) : (
                <span className="voice-recording-text">● Grabando...</span>
              )}
              <span className="voice-timer">{formatTime(r.elapsed)}</span>
            </div>
          ) : r.phase === 'done' ? (
            <div className="voice-mic-idle">✓</div>
          ) : (
            <div className="voice-mic-idle">🎙</div>
          )}
        </div>

        {/* Transcript */}
        <div className="voice-transcript">
          {r.transcript
            ? r.transcript
            : <span className="voice-hint">
                {r.phase === 'recording' ? 'Habla ahora...' : r.phase === 'done' ? 'Transcripción vacía' : 'Pulsa para grabar'}
              </span>
          }
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {r.phase === 'idle' && (
            <button className="btn-primary btn-record" onClick={() => r.startRecording()} disabled={!r.isSupported}>
              🎙 Empezar a grabar
            </button>
          )}
          {r.phase === 'recording' && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Minimizar
              </button>
              <button className="btn-primary btn-stop" onClick={() => r.stopRecording()}>
                ■ Parar
              </button>
            </>
          )}
          {r.phase === 'done' && (
            <>
              <button className="btn-secondary" onClick={() => r.resetRecording()}>
                Grabar de nuevo
              </button>
              <button className="btn-primary" onClick={saveNote} disabled={!(r.transcript || r.finalText).trim()}>
                Guardar como nota
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
