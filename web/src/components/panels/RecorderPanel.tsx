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
      <WebRecordingBar expanded={true} />
    </div>
  )
}
