// MARK: - RecFab
//
// Botón flotante junto al «+». Es el punto de entrada de VOZ de Fromly: al
// pulsarlo abre Magic y arranca a dictar ahí (Magic decide si es una petición
// corta que ejecuta/responde o un dictado que convierte en nota, y desde ahí se
// puede seguir conversando). Mientras graba, el mismo botón pasa a «STOP».
//
// La grabación la maneja Magic (MagicChat) vía eventos:
//   - magic-chat:record-start / magic-chat:record-stop  → iniciar/parar
//   - from:magic-voice-state {recording}                → estado para el toggle

import { useEffect, useState } from 'react'

export default function RecFab({ onOpenMagic }: { onOpenMagic: () => void }) {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    function onState(e: Event) {
      setRecording(!!(e as CustomEvent<{ recording: boolean }>).detail?.recording)
    }
    window.addEventListener('from:magic-voice-state', onState)
    return () => window.removeEventListener('from:magic-voice-state', onState)
  }, [])

  function handleClick() {
    if (recording) {
      window.dispatchEvent(new Event('magic-chat:record-stop'))
      return
    }
    // Abrir Magic y, una vez montado, arrancar el dictado.
    onOpenMagic()
    setTimeout(() => window.dispatchEvent(new Event('magic-chat:record-start')), 300)
  }

  return (
    <button
      className={`rec-fab ${recording ? 'recording' : ''}`}
      onClick={handleClick}
      title={recording ? 'Detener y enviar (R)' : 'Hablar con Magic (R)'}
      aria-label={recording ? 'Detener grabación' : 'Hablar con Magic'}
    >
      <span className="rec-fab-dot" />
      {recording ? 'STOP' : 'REC'}
    </button>
  )
}
