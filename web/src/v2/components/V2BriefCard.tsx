// Tarjeta del informe del día — P4 de la auditoría (29 ago 2026): "web sin
// tarjeta 'Hoy'/brief" — el mismo texto compuesto que ya llega a iOS/Telegram
// por push (y al chat, enterrado en el scroll si abrías esa pestaña) no tenía
// ningún sitio propio y visible en la web. Vive arriba del cockpit en el
// destino Agenda (V2App.tsx) — la pantalla de "Hoy".
import { useEffect, useState } from 'react'
import { assistantGetBrief, type AssistantBrief } from '../../api/assistant'

export default function V2BriefCard() {
  const [brief, setBrief] = useState<AssistantBrief | null>(null)

  useEffect(() => {
    let cancelled = false
    assistantGetBrief().then(b => { if (!cancelled) setBrief(b) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!brief) return null

  return (
    <div className="v2-brief-card">
      <div className="v2-brief-title">{brief.title}</div>
      <div className="v2-brief-body">{brief.body}</div>
    </div>
  )
}
