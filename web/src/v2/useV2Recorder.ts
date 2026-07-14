// Grabadora de audio para Fromly 2.0 — captura mic con MediaRecorder y reutiliza
// transcribeAudio de la v1 (sube el audio a R2 + transcribe). Al parar, entrega
// {audioKey, durationSec, transcript} para crear una nota de voz.
//
// `elapsedSec`/`liveTranscript`: solo para que la UI (columna derecha) muestre algo
// vivo mientras se graba — el audio real y la transcripción DEFINITIVA siguen siendo
// Whisper vía transcribeAudio (más fiable que el reconocimiento del navegador). El
// live-transcript es MEJOR ESFUERZO con Web Speech API (mismo motor que el dictado
// del composer): si el navegador no lo soporta, simplemente se queda vacío y la UI
// cae a solo icono+timer (degradación explícita, sin romper nada).
import { useRef, useState } from 'react'
import { transcribeAudio } from '../api/client'

export interface RecordResult { audioKey: string; durationSec: number; transcript: string }

export function useV2Recorder(onSaved: (r: RecordResult) => void) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const stopLiveTranscript = () => {
    try { recognitionRef.current?.stop?.() } catch { /* ignore */ }
    recognitionRef.current = null
  }

  const start = async () => {
    if (recording || busy) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
        stopLiveTranscript()
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const dur = Math.round((Date.now() - startedRef.current) / 1000)
        if (!blob.size) return
        setBusy(true)
        try {
          const res = await transcribeAudio(blob, true) // true = guardar el audio (nota de voz)
          onSaved({ audioKey: res.audioKey || '', durationSec: res.durationSec || dur, transcript: res.text || '' })
        } catch { /* fallo de red/transcripción */ } finally { setBusy(false); setLiveTranscript('') }
      }
      startedRef.current = Date.now()
      mr.start()
      mrRef.current = mr
      setRecording(true)
      setElapsedSec(0)
      setLiveTranscript('')
      tickRef.current = setInterval(() => setElapsedSec(Math.round((Date.now() - startedRef.current) / 1000)), 1000)

      // Transcripción EN VIVO best-effort (no bloquea ni sustituye a Whisper).
      const SR = (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        || (window as unknown as Record<string, unknown>).SpeechRecognition
      if (SR) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rec: any = new (SR as any)()
          rec.lang = (navigator.language || 'es-ES')
          rec.continuous = true
          rec.interimResults = true
          let finalText = ''
          rec.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { 0: { transcript: string }; isFinal: boolean } } }) => {
            let interim = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const txt = event.results[i][0].transcript
              if (event.results[i].isFinal) finalText += txt + ' '
              else interim += txt
            }
            setLiveTranscript((finalText + interim).trim())
          }
          rec.onerror = () => { /* best-effort: se ignora, la UI cae a icono+timer */ }
          rec.start()
          recognitionRef.current = rec
        } catch { /* best-effort */ }
      }
    } catch {
      // permiso de micrófono denegado o no disponible
      setRecording(false)
    }
  }

  const stop = () => {
    try { mrRef.current?.stop() } catch { /* noop */ }
    mrRef.current = null
    setRecording(false)
  }

  return { recording, busy, elapsedSec, liveTranscript, start, stop }
}
