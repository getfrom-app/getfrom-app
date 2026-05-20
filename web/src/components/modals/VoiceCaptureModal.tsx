import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
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
  const [audioLevel, setAudioLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const navigate = useNavigate()

  const SpeechRecognitionAPI: SpeechRecognitionConstructor | undefined =
    window.SpeechRecognition || window.webkitSpeechRecognition
  const isSupported = !!SpeechRecognitionAPI

  // Format elapsed seconds as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Audio level polling loop
  function startAudioMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioContextRef.current = ctx
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setAudioLevel(avg / 128) // normalize 0–1 (approx)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    } catch {
      // AudioContext not available — degrade gracefully
    }
  }

  function stopAudioMeter() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    analyserRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setAudioLevel(0)
  }

  async function startRecording() {
    if (!SpeechRecognitionAPI) {
      setError('Tu navegador no soporta grabación de voz. Usa Chrome.')
      return
    }

    // Try to get microphone stream for the level meter
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startAudioMeter(stream)
    } catch {
      // getUserMedia denied — still allow speech recognition without meter
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
      stopRecordingInternal()
    }
    recognition.onend = () => {
      stopRecordingInternal()
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setPhase('recording')
    setError('')
    setElapsed(0)

    timerRef.current = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)
  }

  function stopRecordingInternal() {
    setIsRecording(false)
    setPhase('done')
    stopAudioMeter()
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    stopRecordingInternal()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      stopAudioMeter()
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [])

  function resetRecording() {
    setPhase('idle')
    setTranscript('')
    setFinalText('')
    setElapsed(0)
    setError('')
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

  // Audio level bar width: 0%–100%, with a minimum pulse when recording
  const levelPercent = isRecording
    ? Math.max(8, Math.min(100, audioLevel * 100))
    : 0

  return createPortal(
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

        {/* ── Visualizer ─────────────────────────────────────── */}
        <div className="voice-visualizer">
          {isRecording ? (
            <div className="voice-level-wrap">
              {audioContextRef.current ? (
                <div className="voice-level-bar-track">
                  <div
                    className="voice-level-bar-fill"
                    style={{ width: `${levelPercent}%` }}
                  />
                </div>
              ) : (
                <span className="voice-recording-text">● Grabando...</span>
              )}
              <span className="voice-timer">{formatTime(elapsed)}</span>
            </div>
          ) : phase === 'done' ? (
            <div className="voice-mic-idle">✓</div>
          ) : (
            <div className="voice-mic-idle">🎙</div>
          )}
        </div>

        {/* ── Transcript ─────────────────────────────────────── */}
        <div className="voice-transcript">
          {transcript
            ? transcript
            : <span className="voice-hint">
                {isRecording ? 'Habla ahora...' : phase === 'done' ? 'Transcripción vacía' : 'Pulsa para grabar'}
              </span>
          }
        </div>

        {/* ── Actions ────────────────────────────────────────── */}
        <div className="modal-actions">
          {phase === 'idle' && (
            <button
              className="btn-primary btn-record"
              onClick={startRecording}
              disabled={!isSupported}
            >
              🎙 Empezar a grabar
            </button>
          )}
          {phase === 'recording' && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-primary btn-stop" onClick={stopRecording}>
                ■ Parar
              </button>
            </>
          )}
          {phase === 'done' && (
            <>
              <button className="btn-secondary" onClick={resetRecording}>
                Grabar de nuevo
              </button>
              <button className="btn-primary" onClick={saveNote} disabled={!transcript.trim()}>
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
