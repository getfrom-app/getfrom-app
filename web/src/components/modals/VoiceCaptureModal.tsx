import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
          <h2>{t('voice.recordingTitle')}</h2>
          {/* Closing modal does NOT stop recording */}
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {!r.isSupported && (
          <div className="voice-unsupported">
            {t('voice.browserNotSupported')}
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
                <span className="voice-recording-text">{t('voice.recording')}</span>
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
                {r.phase === 'recording' ? t('ai.recordingLabel') : r.phase === 'done' ? t('voice.transcriptPlaceholder') : t('voice.startRecording')}
              </span>
          }
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {r.phase === 'idle' && (
            <button className="btn-primary btn-record" onClick={() => r.startRecording()} disabled={!r.isSupported}>
              {t('voice.startRecording')}
            </button>
          )}
          {r.phase === 'recording' && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                {t('common.close')}
              </button>
              <button className="btn-primary btn-stop" onClick={() => r.stopRecording()}>
                {t('voice.stopButton')}
              </button>
            </>
          )}
          {r.phase === 'done' && (
            <>
              <button className="btn-secondary" onClick={() => r.resetRecording()}>
                {t('voice.startRecording')}
              </button>
              <button className="btn-primary" onClick={saveNote} disabled={!(r.transcript || r.finalText).trim()}>
                {t('common.save')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
