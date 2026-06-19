/**
 * AgentPropertiesPanel — propiedades y controles de un agente en la columna derecha.
 * Único lugar con los controles del agente: activar/pausar, ejecutar ahora,
 * programación, última y próxima ejecución. La ventana central muestra solo
 * el prompt del usuario (instrucciones editables).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { getAgentData, setAgentEnabled, syncAgentUserMessage } from '../../utils/agentesHelper'
import { apiRequest, getToken, TokensError } from '../../api/client'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import { scheduleNextLabel } from '../../utils/scheduleHelper'

const SCHEDULE_OPTIONS = [
  { value: '',               labelEs: 'Sin programar',            labelEn: 'Not scheduled' },
  { value: 'daily:07:30',    labelEs: 'Diario · 07:30',           labelEn: 'Daily · 07:30' },
  { value: 'daily:08:00',    labelEs: 'Diario · 08:00',           labelEn: 'Daily · 08:00' },
  { value: 'daily:09:00',    labelEs: 'Diario · 09:00',           labelEn: 'Daily · 09:00' },
  { value: 'daily:12:00',    labelEs: 'Diario · 12:00',           labelEn: 'Daily · 12:00' },
  { value: 'daily:18:00',    labelEs: 'Diario · 18:00',           labelEn: 'Daily · 18:00' },
  { value: 'daily:21:00',    labelEs: 'Diario · 21:00',           labelEn: 'Daily · 21:00' },
  { value: 'weekly:1:09:00', labelEs: 'Semanal · lunes 09:00',    labelEn: 'Weekly · Mon 09:00' },
  { value: 'weekly:5:09:00', labelEs: 'Semanal · viernes 09:00',  labelEn: 'Weekly · Fri 09:00' },
  { value: 'weekly:0:21:00', labelEs: 'Semanal · domingo 21:00',  labelEn: 'Weekly · Sun 21:00' },
]

interface Props {
  nodeId: string
  onBack: () => void
}

export default function AgentPropertiesPanel({ nodeId, onBack }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isEn = i18n.language?.startsWith('en')
  const node = s.getNode(nodeId)
  const data = getAgentData(nodeId)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const isLoggedIn = !!getToken()
  if (!node || !data) return null

  // El schedule guardado puede no estar en la lista (ej. 'daily:07:30' de un
  // agente predefinido) — lo añadimos al vuelo para que el <select> lo refleje.
  const options = SCHEDULE_OPTIONS.some(o => o.value === data.schedule)
    ? SCHEDULE_OPTIONS
    : [...SCHEDULE_OPTIONS, { value: data.schedule, labelEs: data.schedule, labelEn: data.schedule }]

  function setSchedule(schedule: string) {
    const n = store.getNode(nodeId)
    if (!n || !data) return
    try {
      const userMessage = syncAgentUserMessage(nodeId)  // la nota = instrucción
      const ed = JSON.parse((store.getNode(nodeId)?.extraData) || '{}')
      ed._agentSchedule = schedule
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
      // Sync al servidor (registra/actualiza el cron) si hay sesión e instrucciones.
      if (!getToken()) return
      if (!userMessage) return
      apiRequest('/agents/schedule', {
        method: 'POST',
        body: JSON.stringify({
          nodeId, agentId: data.agentId, agentTitle: n.text,
          systemPrompt: data.systemPrompt, userMessage,
          schedule, enabled: data.enabled,
        }),
      }).catch(err => console.warn('[schedule sync]', err))
    } catch { /* ignore */ }
  }

  function toggleEnabled() {
    if (!data) return
    const next = !data.enabled
    setAgentEnabled(nodeId, next)
    if (data.schedule && isLoggedIn) {
      const userMessage = syncAgentUserMessage(nodeId)
      apiRequest('/agents/schedule', {
        method: 'POST',
        body: JSON.stringify({
          nodeId, agentId: data.agentId, agentTitle: node!.text,
          systemPrompt: data.systemPrompt, userMessage,
          schedule: data.schedule, enabled: next,
        }),
      }).catch(() => { /* silencioso */ })
    }
  }

  async function handleRun() {
    if (running || !isLoggedIn || !data) return
    const userMessage = syncAgentUserMessage(nodeId)  // ejecutar lo que dice la nota
    if (!userMessage) { setError(isEn ? 'Write an instruction in the note first' : 'Escribe una instrucción en la nota primero'); return }
    setRunning(true); setError(null); setSaved(false)
    try {
      const res = await apiRequest<{ ok: boolean; result?: string; error?: string }>('/agents/run', {
        method: 'POST',
        body: JSON.stringify({
          agentId: data.agentId, agentTitle: node!.text,
          systemPrompt: data.systemPrompt, firstUserMessage: userMessage,
          modelTier: 'fast',
        }),
      })
      if (res.ok && res.result) {
        const today = getTodayDiaryUnderAgenda()
        const resultParent = store.createNode({ text: `▶ ${node!.text}`, parentId: today.id })
        for (const line of res.result.split('\n').map(l => l.trim()).filter(Boolean)) {
          store.createNode({ text: line, parentId: resultParent.id })
        }
        try {
          const ed = JSON.parse(node!.extraData || '{}')
          ed._agentLastRun = new Date().toISOString()
          store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
        } catch { /* ignore */ }
        setSaved(true)
        navigate(`/node/${resultParent.id}`)
      } else {
        setError(res.error || (isEn ? 'Run failed' : 'Error al ejecutar'))
      }
    } catch (e) {
      if (e instanceof TokensError) {
        window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } }))
      } else {
        setError(e instanceof Error ? e.message : (isEn ? 'Connection error' : 'Error de conexión'))
      }
    } finally {
      setRunning(false)
    }
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

  const nextRun = data.schedule ? scheduleNextLabel(data.schedule) : null

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
          <div className="rc-section-label" style={{ marginBottom: 6 }}>
            {t('agents.stateTitle', 'Estado')}
          </div>
          <button
            onClick={toggleEnabled}
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

        {/* Ejecutar ahora */}
        <div>
          <button
            onClick={handleRun}
            disabled={running || !isLoggedIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 11px', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
              cursor: running || !isLoggedIn ? 'default' : 'pointer',
              opacity: running || !isLoggedIn ? 0.6 : 1,
            }}
            title={isLoggedIn ? t('ai.runAgent', 'Ejecutar') : (isEn ? 'Sign in to run' : 'Inicia sesión para ejecutar')}
          >
            {running ? t('ai.running', 'Ejecutando…') : `▶ ${t('agents.runButton', 'Ejecutar')}`}
          </button>
          {error && <div style={{ fontSize: 11.5, color: 'var(--danger, #ef4444)', marginTop: 8 }}>{error}</div>}
          {saved && <div style={{ fontSize: 11.5, color: 'var(--success, #22c55e)', marginTop: 8 }}>{t('ai.resultSaved', '✓ Resultado guardado en el diario')}</div>}
        </div>

        {/* Programación */}
        <div>
          <div className="rc-section-label" style={{ marginBottom: 6 }}>
            {t('agents.scheduleTitle', 'Programación')}
          </div>
          <select
            value={data.schedule}
            onChange={e => setSchedule(e.target.value)}
            style={{ width: '100%', fontSize: 12.5, padding: '8px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
          >
            {options.map(o => <option key={o.value} value={o.value}>{isEn ? o.labelEn : o.labelEs}</option>)}
          </select>
          {nextRun && (
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {nextRun}
            </div>
          )}
          {lastRunText && (
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {t('agents.lastRun', 'Última ejecución')}: {lastRunText}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {t('agents.editHintCenter', 'En la ventana central editas el prompt del usuario (lo que el agente debe hacer).')}
        </div>
      </div>
    </div>
  )
}
