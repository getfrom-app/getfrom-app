import { useEffect, useState } from 'react'

export type RecordingSource = 'mic' | 'system' | 'both'
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
  micEnabled: boolean = true
  sysEnabled: boolean = true
  transcript = ''
  finalText = ''
  elapsed = 0
  audioLevel = 0
  error = ''

  private recognition: SpeechRecognitionInstance | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private micStream: MediaStream | null = null
  private sysStream: MediaStream | null = null
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

  setSource(s: RecordingSource) {
    if (this.phase === 'idle') {
      this.source = s
      this.notify()
    }
  }

  setMicEnabled(v: boolean) {
    if (this.phase !== 'idle') return
    // Don't allow disabling both
    if (!v && !this.sysEnabled) return
    this.micEnabled = v
    this._syncSourceFromToggles()
    this.notify()
  }

  setSysEnabled(v: boolean) {
    if (this.phase !== 'idle') return
    if (!v && !this.micEnabled) return
    this.sysEnabled = v
    this._syncSourceFromToggles()
    this.notify()
  }

  private _syncSourceFromToggles() {
    if (this.micEnabled && this.sysEnabled) this.source = 'both'
    else if (this.micEnabled) this.source = 'mic'
    else if (this.sysEnabled) this.source = 'system'
  }

  async startRecording() {
    if (this.phase === 'recording') return // already recording
    // En web (no Tauri) solo mic: getDisplayMedia requiere diálogo de pantalla compartida
    const isTauri = typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__
    if (!isTauri) {
      this.source = 'mic'
      this.micEnabled = true
      this.sysEnabled = false
    } else {
      this._syncSourceFromToggles()
    }

    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechAPI) {
      this.error = 'Tu navegador no soporta grabación de voz. Usa Chrome.'
      this.notify()
      return
    }

    // Get audio streams
    try {
      if (this.source === 'mic' || this.source === 'both') {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
    } catch {
      this.error = 'Permiso de micrófono denegado'
      this.notify()
      return
    }

    try {
      if (this.source === 'system' || this.source === 'both') {
        const display = await (navigator.mediaDevices as unknown as { getDisplayMedia: (c: object) => Promise<MediaStream> }).getDisplayMedia({ audio: true, video: true })
        display.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop())
        this.sysStream = display
      }
    } catch {
      // system audio not available — continue with mic only
      if (this.source === 'system') {
        this.error = 'Audio del sistema no disponible en este navegador'
        this.notify()
        return
      }
    }

    // Start audio meter on available stream
    const meterStream = this.micStream || this.sysStream
    if (meterStream) this._startAudioMeter(meterStream)

    // Set up SpeechRecognition
    const recognition = new SpeechAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'es-ES'

    let fullTranscript = ''
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) fullTranscript += t + ' '
        else interim = t
      }
      this.transcript = fullTranscript + interim
      this.finalText = fullTranscript
      this.notify()
    }
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'no-speech' y 'aborted' son normales — Chrome los emite periódicamente, no son errores fatales
      if (e.error === 'not-allowed') {
        this.error = 'Permiso de micrófono denegado'
        this._stopInternal()
      }
      // Para cualquier otro error no fatal, onend se encargará de reiniciar
    }
    recognition.onend = () => {
      if (this.phase !== 'recording') return
      // Chrome para la SpeechRecognition automáticamente cada ~60s o tras silencio.
      // Reiniciar para mantener la grabación continua sin perder la transcripción acumulada.
      try { recognition.start() } catch { /* ya estaba corriendo */ }
    }

    this.recognition = recognition
    recognition.start()

    this.elapsed = 0
    this.transcript = ''
    this.finalText = ''
    this.error = ''
    this.phase = 'recording'
    this.notify()

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
        // Throttle level notifications to ~15fps to avoid spamming rerenders
        const now = Date.now()
        if (now - this._levelNotifyThrottle > 66) {
          this._levelNotifyThrottle = now
          this.notify()
        }
        this.animFrame = requestAnimationFrame(tick)
      }
      this.animFrame = requestAnimationFrame(tick)
    } catch { /* AudioContext not available */ }
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
    this.sysStream?.getTracks().forEach(t => t.stop()); this.sysStream = null
    this.phase = 'done'
    this.notify()
  }

  stopRecording() {
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
