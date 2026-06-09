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
import { aiChatStore } from '../../store/aiChatStore'

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
    // La voz SIEMPRE empieza en una conversación limpia. Creamos el nodo y navegamos
    // YA (sin esperar a Magic), abrimos Magic, y marcamos que debe grabar al montar
    // (consumePendingRecord) — más fiable que un setTimeout que puede llegar antes de
    // que MagicChat exista.
    aiChatStore.startNewSession()
    aiChatStore.startVoiceSession()      // crea el nodo de la conversación + navega a él
    aiChatStore.requestStartRecording()  // MagicChat arrancará a grabar al montar
    onOpenMagic()
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
