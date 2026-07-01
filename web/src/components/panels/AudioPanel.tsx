// MARK: - AudioPanel
//
// Columna derecha cuando se abre un nodo con audio(s) de voz. Muestra, en orden,
// cada grabación de la conversación: reproductor (URL firmada de R2, bajo demanda)
// + su transcripción. Soporta varios audios (extraData._audios) y el formato legacy
// de un solo audio (_audioKey/_audioTranscript).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { getAudioUrl } from '../../api/client'

interface AudioItem { audioKey: string; transcript: string; durationSec: number }

function parseExtra(raw: string | null | undefined): Record<string, unknown> {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

function readAudios(extraData: string | null | undefined): AudioItem[] {
  const ed = parseExtra(extraData)
  if (Array.isArray(ed._audios)) {
    return (ed._audios as Array<Record<string, unknown>>).map(a => ({
      audioKey: String(a.audioKey || ''),
      transcript: String(a.transcript || ''),
      durationSec: Number(a.durationSec || 0),
    }))
  }
  // Legacy: un solo audio en campos sueltos
  if (ed._audioKey || ed._audioTranscript) {
    return [{ audioKey: String(ed._audioKey || ''), transcript: String(ed._audioTranscript || ''), durationSec: Number(ed._audioDuration || 0) }]
  }
  return []
}

function fmtDur(s: number) {
  if (!s) return ''
  return ` · ${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function AudioItemView({ item, index, total }: { item: AudioItem; index: number; total: number }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setUrl(null); setError(false)
    if (!item.audioKey) { setError(true); return }
    getAudioUrl(item.audioKey)
      .then(u => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [item.audioKey])

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
        🎙 {total > 1 ? t('audioPanel.audioN', { index: index + 1, total }) : t('audioPanel.audio')}{fmtDur(item.durationSec)}
      </div>
      {error && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('audioPanel.loadError')}</div>}
      {!error && !url && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('audioPanel.loading')}</div>}
      {url && <audio controls src={url} style={{ width: '100%', marginBottom: 10 }} />}
      {item.transcript && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {item.transcript}
        </div>
      )}
    </div>
  )
}

export default function AudioPanel({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const node = store.getNode(nodeId)
  const audios = readAudios(node?.extraData)

  return (
    <div style={{ padding: '20px 18px', overflowY: 'auto', height: '100%' }}>
      {audios.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('audioPanel.noAudio')}</div>
      )}
      {audios.map((item, i) => (
        <AudioItemView key={item.audioKey || i} item={item} index={i} total={audios.length} />
      ))}
    </div>
  )
}
