// MARK: - RecFab
//
// Botón flotante junto al «+». En reposo muestra «REC» y abre la grabadora ya
// grabando. Mientras graba, el mismo botón pasa a «STOP» (con el tiempo) y al
// pulsarlo detiene la grabación.

import { useRecordingStore } from '../../store/recordingStore'

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export default function RecFab({ onOpen }: { onOpen: () => void }) {
  const r = useRecordingStore()
  const recording = r.phase === 'recording'

  return (
    <button
      className={`rec-fab ${recording ? 'recording' : ''}`}
      onClick={() => {
        if (recording) {
          r.stopRecording()
        } else {
          onOpen()
          r.startRecording()
        }
      }}
      title={recording ? 'Detener grabación (R)' : 'Grabar voz (R)'}
      aria-label={recording ? 'Detener grabación' : 'Grabar voz'}
    >
      <span className="rec-fab-dot" />
      {recording ? `STOP · ${fmt(r.elapsed)}` : 'REC'}
    </button>
  )
}
