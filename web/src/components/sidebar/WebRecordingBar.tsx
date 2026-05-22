import { useState, useEffect, useRef } from 'react'

type State = 'idle' | 'recording' | 'saved'

export default function WebRecordingBar() {
  const [state, setState] = useState<State>('idle')
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stop()
    }
  }, [])

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}:${ss.toString().padStart(2, '0')}`
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        // Recording saved — show confirmation briefly
        setState('saved')
        setTimeout(() => setState('idle'), 2000)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setSeconds(0)
      setState('recording')

      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
    } catch {
      // Permission denied or not available — silently ignore
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }

  if (state === 'saved') {
    return (
      <div className="recording-bar-web">
        <span className="rec-saved">Grabacion guardada</span>
      </div>
    )
  }

  if (state === 'recording') {
    return (
      <div className="recording-bar-web">
        <div className="rec-dot" />
        <span className="rec-timer">{formatTime(seconds)}</span>
        <button className="rec-btn rec-btn--stop" onClick={stopRecording}>
          Detener
        </button>
      </div>
    )
  }

  return (
    <div className="recording-bar-web">
      <span className="rec-source-chip">Microfono</span>
      <button className="rec-btn rec-btn--start" onClick={startRecording}>
        Grabar
      </button>
    </div>
  )
}
