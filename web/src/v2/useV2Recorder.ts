// Grabadora de audio para Fromly 2.0 — captura mic con MediaRecorder y reutiliza
// transcribeAudio de la v1 (sube el audio a R2 + transcribe). Al parar, entrega
// {audioKey, durationSec, transcript} para crear una nota de voz.
import { useRef, useState } from 'react'
import { transcribeAudio } from '../api/client'

export interface RecordResult { audioKey: string; durationSec: number; transcript: string }

export function useV2Recorder(onSaved: (r: RecordResult) => void) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)

  const start = async () => {
    if (recording || busy) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const dur = Math.round((Date.now() - startedRef.current) / 1000)
        if (!blob.size) return
        setBusy(true)
        try {
          const res = await transcribeAudio(blob, true) // true = guardar el audio (nota de voz)
          onSaved({ audioKey: res.audioKey || '', durationSec: res.durationSec || dur, transcript: res.text || '' })
        } catch { /* fallo de red/transcripción */ } finally { setBusy(false) }
      }
      startedRef.current = Date.now()
      mr.start()
      mrRef.current = mr
      setRecording(true)
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

  return { recording, busy, start, stop }
}
