/**
 * RecorderPanel — grabadora en panel derecho
 * Reemplaza el WebRecordingBar del sidebar (eliminado v9.5.20)
 */
import WebRecordingBar from '../sidebar/WebRecordingBar'

interface Props {
  onClose: () => void
}

export default function RecorderPanel({ onClose }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
          Grabadora
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, padding: '0 6px', borderRadius: 3 }}
          title="Cerrar (R)"
        >×</button>
      </div>
      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <WebRecordingBar expanded={true} />
      </div>
    </div>
  )
}
