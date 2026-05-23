import { useRecordingStore } from '../../store/recordingStore'
import type { RecordingSource } from '../../store/recordingStore'

const SOURCES: { value: RecordingSource; label: string }[] = [
  { value: 'mic',    label: 'Micrófono' },
  { value: 'system', label: 'Sistema' },
  { value: 'both',   label: 'Ambas' },
]

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function WebRecordingBar() {
  const r = useRecordingStore()

  if (r.phase === 'done') {
    return (
      <div className="rec-bar">
        <span className="rec-bar-saved">✓ Grabación guardada</span>
      </div>
    )
  }

  if (r.phase === 'recording') {
    return (
      <div className="rec-bar rec-bar--active">
        <span className="rec-bar-dot" />
        <span className="rec-bar-timer">{formatTime(r.elapsed)}</span>
        <div className="rec-bar-spacer" />
        <button className="rec-bar-btn rec-bar-btn--stop" onClick={() => r.stopRecording()}>
          Detener
        </button>
      </div>
    )
  }

  // idle state
  return (
    <div className="rec-bar">
      <div className="rec-bar-sources">
        {SOURCES.map(s => (
          <button
            key={s.value}
            className={`rec-bar-source ${r.source === s.value ? 'active' : ''}`}
            onClick={() => r.setSource(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        className="rec-bar-btn rec-bar-btn--start"
        onClick={() => r.startRecording()}
        disabled={!r.isSupported}
        title="Grabar (⌘R)"
      >
        Grabar
      </button>
    </div>
  )
}
