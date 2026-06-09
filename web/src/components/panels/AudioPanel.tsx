// MARK: - AudioPanel
//
// Columna derecha cuando se abre un nodo de audio (extraData._audio = '1').
// Muestra un reproductor (URL firmada de R2, pedida bajo demanda) + la transcripción.

import { useEffect, useState } from 'react'
import { store } from '../../store/nodeStore'
import { getAudioUrl } from '../../api/client'

function parseExtra(raw: string | null | undefined): Record<string, string> {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

export default function AudioPanel({ nodeId }: { nodeId: string }) {
  const node = store.getNode(nodeId)
  const ed = parseExtra(node?.extraData)
  const audioKey = ed._audioKey
  const transcript = ed._audioTranscript || ''
  const durationSec = parseInt(ed._audioDuration || '0', 10) || 0

  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setUrl(null); setError(false)
    if (!audioKey) { setError(true); return }
    getAudioUrl(audioKey)
      .then(u => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [audioKey])

  const mm = Math.floor(durationSec / 60), ss = (durationSec % 60).toString().padStart(2, '0')

  return (
    <div style={{ padding: '20px 18px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
        🎙 Audio{durationSec ? ` · ${mm}:${ss}` : ''}
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 0' }}>
          No se pudo cargar el audio.
        </div>
      )}

      {!error && !url && (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>Cargando audio…</div>
      )}

      {url && (
        <audio
          controls
          src={url}
          style={{ width: '100%', marginBottom: 16 }}
        />
      )}

      {transcript && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '8px 0 6px' }}>
            Transcripción
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {transcript}
          </div>
        </>
      )}
    </div>
  )
}
