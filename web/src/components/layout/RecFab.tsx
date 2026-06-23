// MARK: - RecFab
//
// Botón flotante junto al «+». Punto de entrada de VOZ de Fromly: al pulsarlo
// abre la GRABADORA en la columna derecha y arranca a grabar. Mientras graba, el
// mismo botón pasa a «STOP» y al pulsarlo detiene. La grabadora (RecorderPanel)
// muestra la onda + transcripción en vivo y, al parar, ofrece «Crear nota».
//
// Estado de grabación = recordingStore.phase. No usa la conversación de Magic.

import { useEffect, useState } from 'react'
import { recordingStore } from '../../store/recordingStore'

export default function RecFab({ onOpenRecorder }: { onOpenRecorder: () => void }) {
  const [recording, setRecording] = useState(recordingStore.phase === 'recording')

  useEffect(() => {
    return recordingStore.subscribe(() => setRecording(recordingStore.phase === 'recording'))
  }, [])

  function handleClick() {
    if (recording) {
      recordingStore.stopRecording()
      return
    }
    // Abrir la grabadora (la hace visible en la columna derecha) y arrancar a grabar.
    onOpenRecorder()
    recordingStore.startRecording()
  }

  return (
    <button
      className={`rec-fab ${recording ? 'recording' : ''}`}
      onClick={handleClick}
      title={recording ? 'Detener grabación' : 'Grabar voz'}
      aria-label={recording ? 'Detener grabación' : 'Grabar voz'}
    >
      <span className="rec-fab-dot" />
      {recording ? 'STOP' : 'REC'}
    </button>
  )
}
