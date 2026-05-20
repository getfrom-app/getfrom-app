import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

// ── Web Speech API type declarations ──────────────────────────────────────────

interface SpeechRecognitionResultItem { readonly transcript: string; readonly confidence: number }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; item(index: number): SpeechRecognitionResultItem; [index: number]: SpeechRecognitionResultItem }
interface SpeechRecognitionResultList { readonly length: number; item(index: number): SpeechRecognitionResult; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechRecognitionResultList }
interface SpeechRecognitionErrorEvent extends Event { readonly error: string }
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export default function VoiceCaptureModal({ onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done'>('idle')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const navigate = useNavigate()

  const SpeechRecognitionAPI: SpeechRecognitionConstructor | undefined = window.SpeechRecognition || window.webkitSpeechRecognition
  const isSupported = !!SpeechRecognitionAPI

  function startRecording() {
    if (!SpeechRecognitionAPI) {
      setError('Tu navegador no soporta grabación de voz. Usa Chrome.')
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'es-ES'

    let fullTranscript = ''
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          fullTranscript += t + ' '
        } else {
          interim = t
        }
      }
      setTranscript(fullTranscript + interim)
      setFinalText(fullTranscript)
    }
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError('Error: ' + e.error)
      setIsRecording(false)
    }
    recognition.onend = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setPhase('recording')
    setError('')
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setIsRecording(false)
    setPhase('done')
  }

  function saveNote() {
    const text = finalText.trim() || transcript.trim()
    if (!text) return
    const diary = store.todayDiary()
    const lines = text.split(/[.!?]\s+/).filter(l => l.trim())
    const title = lines[0]?.slice(0, 60) || text.slice(0, 60)
    const body = lines.slice(1).join('. ').trim() || undefined
    const node = store.createNode({
      text: title,
      parentId: diary?.id || null,
    })
    if (body) store.updateNode(node.id, { body })
    navigate(`/node/${node.id}`)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !isRecording) onClose()
  }

  return (
    <div
      className="modal-overlay"
      onClick={isRecording ? undefined : onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-card voice-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">🎙</span>
          <h2>Grabación de voz</h2>
          <button
            className="modal-close-btn"
            onClick={isRecording ? stopRecording : onClose}
          >×</button>
        </div>

        {!isSupported && (
          <div className="voice-unsupported">
            La grabación de voz requiere Chrome o Edge. Safari no está soportado.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="voice-visualizer">
          {isRecording ? (
            <div className="voice-wave-animation">
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
            </div>
          ) : (
            <div className="voice-mic-idle">🎙</div>
          )}
        </div>

        <div className="voice-transcript">
          {transcript
            ? transcript
            : <span className="voice-hint">{isRecording ? 'Habla ahora...' : 'Pulsa para grabar'}</span>
          }
        </div>

        <div className="modal-actions">
          {phase === 'idle' && (
            <button
              className="btn-primary btn-record"
              onClick={startRecording}
              disabled={!isSupported}
            >
              ● Empezar a grabar
            </button>
          )}
          {phase === 'recording' && (
            <button className="btn-primary btn-stop" onClick={stopRecording}>
              ■ Parar
            </button>
          )}
          {phase === 'done' && transcript && (
            <>
              <button
                className="btn-secondary"
                onClick={() => { setPhase('idle'); setTranscript(''); setFinalText('') }}
              >
                Grabar de nuevo
              </button>
              <button className="btn-primary" onClick={saveNote}>
                Guardar como nota
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
