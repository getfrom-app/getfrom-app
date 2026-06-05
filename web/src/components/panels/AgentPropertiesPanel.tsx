/**
 * AgentPropertiesPanel — propiedades de un agente en la columna derecha.
 * Mismo patrón que Contextos/Prompts. La edición de las instrucciones del
 * agente vive en la ventana central (sus nodos hijos + AgentControls).
 * Aquí: activar/pausar, programación y última ejecución.
 */
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { getAgentData, setAgentEnabled } from '../../utils/agentesHelper'

const SCHEDULE_OPTIONS = [
  { value: '',              labelEs: 'Sin programar',            labelEn: 'Not scheduled' },
  { value: 'daily:09:00',   labelEs: 'Diario · 09:00',           labelEn: 'Daily · 09:00' },
  { value: 'daily:21:00',   labelEs: 'Diario · 21:00',           labelEn: 'Daily · 21:00' },
  { value: 'weekly:1:09:00', labelEs: 'Semanal · lunes 09:00',   labelEn: 'Weekly · Mon 09:00' },
  { value: 'weekly:5:09:00', labelEs: 'Semanal · viernes 09:00', labelEn: 'Weekly · Fri 09:00' },
]

interface Props {
  nodeId: string
  onBack: () => void
}

export default function AgentPropertiesPanel({ nodeId, onBack }: Props) {
  const s = useStore()
  const { t, i18n } = useTranslation()
  const isEn = i18n.language?.startsWith('en')
  const node = s.getNode(nodeId)
  const data = getAgentData(nodeId)
  if (!node || !data) return null

  function setSchedule(schedule: string) {
    const n = store.getNode(nodeId)
    if (!n) return
    try {
      const ed = JSON.parse(n.extraData || '{}')
      ed._agentSchedule = schedule
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    } catch { /* ignore */ }
  }

  let lastRunText = ''
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._agentLastRun) {
      const diff = Date.now() - new Date(ed._agentLastRun).getTime()
      const mins = Math.floor(diff / 60000), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24)
      lastRunText = days > 0 ? `${days}d` : hrs > 0 ? `${hrs}h` : mins > 0 ? `${mins}min` : (isEn ? 'just now' : 'ahora')
    }
  } catch { /* ignore */ }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 40, flexShrink: 0, borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('agents.back', '← Agentes')}
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Activar / pausar */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {t('agents.stateTitle', 'Estado')}
          </div>
          <button
            onClick={() => setAgentEnabled(nodeId, !data.enabled)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: data.enabled ? 'rgba(34,197,94,0.10)' : 'var(--bg-secondary)',
              border: '1px solid', borderColor: data.enabled ? 'rgba(34,197,94,0.4)' : 'var(--border)',
              borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: data.enabled ? '#22c55e' : 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {data.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{t('agents.toggleHint', 'clic para cambiar')}</span>
          </button>
        </div>

        {/* Programación */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {t('agents.scheduleTitle', 'Programación')}
          </div>
          <select
            value={data.schedule}
            onChange={e => setSchedule(e.target.value)}
            style={{ width: '100%', fontSize: 12.5, padding: '8px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
          >
            {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{isEn ? o.labelEn : o.labelEs}</option>)}
          </select>
          {lastRunText && (
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {t('agents.lastRun', 'Última ejecución')}: {lastRunText}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {t('agents.editHint', 'Edita las instrucciones del agente y ejecútalo desde la ventana central.')}
        </div>
      </div>
    </div>
  )
}
