import { useEffect, useState } from 'react'

export type RecordingSource = 'mic'
export type RecordingPhase = 'idle' | 'recording' | 'done'

interface SpeechRecognitionResultItem { readonly transcript: string }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionResultItem }
interface SpeechRecognitionResultList { readonly length: number; readonly resultIndex?: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechRecognitionResultList }
interface SpeechRecognitionErrorEvent extends Event { readonly error: string }
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance
declare global { interface Window { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor } }

class RecordingStore {
  phase: RecordingPhase = 'idle'
  source: RecordingSource = 'mic'
  transcript = ''
  finalText = ''
  elapsed = 0
  audioLevel = 0
  error = ''

  private recognition: SpeechRecognitionInstance | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private micStream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private audioCtx: AudioContext | null = null
  private animFrame: number | null = null
  private listeners = new Set<() => void>()
  private _levelNotifyThrottle = 0

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  private notify() {
    for (const cb of this.listeners) cb()
  }

  get isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  async startRecording() {
    if (this.phase === 'recording') return

    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechAPI) {
      this.error = 'Tu navegador no soporta grabación de voz. Usa Chrome.'
      this.notify()
      return
    }

    // Solo micrófono
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.error = 'Permiso de micrófono denegado'
      this.notify()
      return
    }

    if (this.micStream) this._startAudioMeter(this.micStream)

    // Texto acumulado a lo largo de todas las sesiones de reconocimiento
    // (Chrome para la recognition cada ~60s o tras silencios — hay que reiniciar)
    let accumulatedText = ''
    let sessionInterim = ''

    // Crear nueva instancia de SpeechRecognition por cada sesión.
    // Reusar la misma instancia con .start() en onend causa un loop rápido
    // en Chrome que impide grabar correctamente.
    const createSession = () => {
      if (this.phase !== 'recording') return
      const rec = new SpeechAPI()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'es-ES'

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let sessionFinal = ''
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript
          if (event.results[i].isFinal) sessionFinal += t + ' '
          else interim = t
        }
        if (sessionFinal) accumulatedText += sessionFinal
        sessionInterim = interim
        this.transcript = accumulatedText + sessionInterim
        this.finalText = accumulatedText
        this.notify()
      }

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'not-allowed') {
          this.error = 'Permiso de micrófono denegado'
          this._stopInternal()
        }
        // no-speech, aborted → normales, onend reiniciará
      }

      rec.onend = () => {
        if (this.phase !== 'recording') return
        // Guardar interim antes de terminar la sesión (Chrome raramente marca isFinal)
        if (sessionInterim.trim()) {
          accumulatedText += sessionInterim.trim() + ' '
          sessionInterim = ''
          this.transcript = accumulatedText
          this.finalText = accumulatedText
          this.notify()
        }
        // Esperar 300ms antes de crear nueva sesión — evita el loop rápido start/end
        setTimeout(createSession, 300)
      }

      this.recognition = rec
      rec.start()
    }

    // Establecer phase ANTES de llamar createSession (que lo comprueba)
    this.elapsed = 0
    this.transcript = ''
    this.finalText = ''
    this.error = ''
    this.phase = 'recording'
    this.notify()

    createSession()

    this.timer = setInterval(() => {
      this.elapsed++
      this.notify()
    }, 1000)
  }

  private _startAudioMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      this.audioCtx = ctx
      this.analyser = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!this.analyser) return
        this.analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        this.audioLevel = avg / 128
        const now = Date.now()
        if (now - this._levelNotifyThrottle > 66) {
          this._levelNotifyThrottle = now
          this.notify()
        }
        this.animFrame = requestAnimationFrame(tick)
      }
      this.animFrame = requestAnimationFrame(tick)
    } catch { /* AudioContext no disponible */ }
  }

  stopAudioMeter() {
    if (this.animFrame !== null) { cancelAnimationFrame(this.animFrame); this.animFrame = null }
    this.analyser = null
    this.audioCtx?.close().catch(() => {})
    this.audioCtx = null
    this.audioLevel = 0
  }

  private _stopInternal() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null }
    this.stopAudioMeter()
    this.micStream?.getTracks().forEach(t => t.stop()); this.micStream = null
    this.phase = 'done'
    this.notify()
  }

  stopRecording() {
    // Preservar todo el transcript (incluye interim no finalizado por Chrome)
    const current = this.transcript.trim()
    if (current) this.finalText = current
    this.recognition?.stop()
    this.recognition = null
    this._stopInternal()
  }

  resetRecording() {
    this.phase = 'idle'
    this.transcript = ''
    this.finalText = ''
    this.elapsed = 0
    this.error = ''
    this.audioLevel = 0
    this.notify()
  }
}

export const recordingStore = new RecordingStore()

export function useRecordingStore() {
  const [, rerender] = useState(0)
  useEffect(() => {
    return recordingStore.subscribe(() => rerender(n => n + 1))
  }, [])
  return recordingStore
}
