import { useRecordingStore } from '../../store/recordingStore'

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
        <button
          className="rec-bar-icon-btn rec-bar-icon-btn--stop"
          onClick={() => r.stopRecording()}
          title="Detener grabación"
          aria-label="Detener grabación"
        >
          {/* Stop icon (square) */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="2" width="8" height="8" rx="1.5" />
          </svg>
        </button>
      </div>
    )
  }

  // idle state — icon toggles for mic / system + record button
  return (
    <div className="rec-bar">
      <div className="rec-bar-sources">
        <button
          className={`rec-bar-icon-btn ${r.micEnabled ? 'on' : 'off'}`}
          onClick={() => r.setMicEnabled(!r.micEnabled)}
          title={r.micEnabled ? 'Micrófono activado' : 'Micrófono desactivado'}
          aria-label="Toggle micrófono"
          aria-pressed={r.micEnabled}
        >
          {/* Mic icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5.5" y="1.5" width="5" height="9" rx="2.5"/>
            <path d="M3 7.5v.5a5 5 0 0 0 10 0v-.5"/>
            <path d="M8 13v2"/>
          </svg>
        </button>
        <button
          className={`rec-bar-icon-btn ${r.sysEnabled ? 'on' : 'off'}`}
          onClick={() => r.setSysEnabled(!r.sysEnabled)}
          title={r.sysEnabled ? 'Audio del sistema activado' : 'Audio del sistema desactivado'}
          aria-label="Toggle audio del sistema"
          aria-pressed={r.sysEnabled}
        >
          {/* Speaker icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6h2L8 3v10L4.5 10h-2z"/>
            <path d="M11 5.5a3.5 3.5 0 0 1 0 5"/>
            <path d="M13 3.5a6 6 0 0 1 0 9"/>
          </svg>
        </button>
      </div>
      <div className="rec-bar-spacer" />
      <button
        className="rec-bar-icon-btn rec-bar-icon-btn--record"
        onClick={() => r.startRecording()}
        disabled={!r.isSupported}
        title="Grabar nota de voz"
        aria-label="Grabar"
      >
        {/* Record icon: filled red circle */}
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
