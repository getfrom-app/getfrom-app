/**
 * AgentPropertiesPanel — propiedades y controles de un agente en la columna derecha.
 * Único lugar con los controles del agente: activar/pausar, ejecutar ahora,
 * programación, última y próxima ejecución. La ventana central muestra solo
 * el prompt del usuario (instrucciones editables).
 */
import { useState } from 'react'
import { openNodeDetail } from '../../utils/canvasNav'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { getAgentData, setAgentEnabled, syncAgentUserMessage } from '../../utils/agentesHelper'
import { apiRequest, getToken, TokensError } from '../../api/client'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import { scheduleNextLabel } from '../../utils/scheduleHelper'
import { userStore } from '../../store/userStore'
import { firstContextOf } from '../../utils/cajones'
import { markdownToHtml } from '../../utils/importMarkdown'
import AgentScheduleModal from '../modals/AgentScheduleModal'

/** Etiqueta legible de un schedule "daily:HH:MM" / "weekly:D:HH:MM", para el botón. */
function scheduleButtonLabel(schedule: string, expiresAt: string, isEn: boolean): string {
  if (!schedule) return isEn ? 'Not scheduled' : 'Sin programar'
  const DAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let label = ''
  if (schedule.startsWith('daily:')) label = `${isEn ? 'Daily' : 'Diario'} · ${schedule.slice(6)}`
  else if (schedule.startsWith('weekly:')) {
    const [, d, t] = schedule.split(':')
    const dayLabel = (isEn ? DAYS_EN : DAYS_ES)[parseInt(d) || 0]
    label = `${isEn ? 'Weekly' : 'Semanal'} · ${dayLabel} ${t}`
  } else label = schedule
  if (expiresAt) {
    const d = new Date(expiresAt)
    label += ` (${isEn ? 'until' : 'hasta'} ${d.toLocaleDateString(isEn ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' })})`
  }
  return label
}

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
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const isLoggedIn = !!getToken()
  if (!node || !data) return null

  function setSchedule(schedule: string, expiresAt: string) {
    const n = store.getNode(nodeId)
    if (!n || !data) return
    try {
      const userMessage = syncAgentUserMessage(nodeId)  // la nota = instrucción
      const ed = JSON.parse((store.getNode(nodeId)?.extraData) || '{}')
      ed._agentSchedule = schedule
      ed._agentScheduleExpiresAt = expiresAt
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
          expiresAt: expiresAt || undefined,
        }),
      }).catch(err => console.warn('[schedule sync]', err))
    } catch { /* ignore */ }
  }

  function toggleEnabled() {
    if (!data) return
    const next = !data.enabled
    // Gate Pro: solo al ACTIVAR (crear/editar/pausar siempre está permitido). Reutiliza
    // el paywall genérico ya existente (mismo evento/razón 'ai_limit' que ya dispara
    // handleRun más abajo y client.ts/nodeStore.ts) — PaywallModal solo distingue
    // 'node_limit' de todo lo demás, así que 'ai_limit' ya renderiza el caso "free sin IA".
    if (next && !userStore.isPremium) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } }))
      return
    }
    setAgentEnabled(nodeId, next)
    if (data.schedule && isLoggedIn) {
      const userMessage = syncAgentUserMessage(nodeId)
      apiRequest('/agents/schedule', {
        method: 'POST',
        body: JSON.stringify({
          nodeId, agentId: data.agentId, agentTitle: node!.text,
          systemPrompt: data.systemPrompt, userMessage,
          schedule: data.schedule, enabled: next,
          expiresAt: data.scheduleExpiresAt || undefined,
        }),
      }).catch(() => { /* silencioso */ })
    }
  }

  async function handleRun() {
    if (running || !isLoggedIn || !data) return
    const userMessage = syncAgentUserMessage(nodeId)  // ejecutar lo que dice la nota
    if (!userMessage) { setError(isEn ? 'Write an instruction in the note first' : 'Escribe una instrucción en la nota primero'); return }
    setRunning(true); setError(null); setSaved(false)

    // Agente conversacional: "Ejecutar" debe abrir un chat de verdad (misma estructura
    // que crea el cron en openAgentConversation — sesión + transcripción + mensaje),
    // no volcar el resultado en un documento. Antes se creaba siempre un nodo _doc,
    // por eso al pulsar Ejecutar aparecía el saludo del agente como nota en vez de chat.
    if (data.conversational) {
      try {
        const ctx = firstContextOf(node!)
        const parentId = ctx ? ctx.id : getTodayDiaryUnderAgenda().id
        const session = store.createNode({ text: `✦ ${node!.text}`, parentId, extraData: { _aiSession: '1', _originAgentId: nodeId } })
        store.updateNode(session.id, { isCollapsed: true, isChat: true })
        const transcript = store.createNode({ text: '💬 Conversación', parentId: session.id, extraData: { _aiTranscript: '1' } })
        store.updateNode(transcript.id, { isCollapsed: true })
        store.createNode({ text: `Magic: ${userMessage}`, parentId: transcript.id, extraData: { _aiMsgRole: 'assistant', _aiMsgContent: userMessage } })
        try {
          const ed = JSON.parse(node!.extraData || '{}')
          ed._agentLastRun = new Date().toISOString()
          store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
        } catch { /* ignore */ }
        setSaved(true)
        openNodeDetail(session.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : (isEn ? 'Connection error' : 'Error de conexión'))
      } finally {
        setRunning(false)
      }
      return
    }

    try {
      const res = await apiRequest<{ ok: boolean; result?: string; error?: string }>('/agents/run', {
        method: 'POST',
        body: JSON.stringify({
          agentId: data.agentId, agentTitle: node!.text,
          systemPrompt: data.systemPrompt, firstUserMessage: userMessage,
          modelTier: 'fast', nodeId,
        }),
      })
      if (res.ok && res.result) {
        // El resultado cuelga del CONTEXTO del agente (no siempre del diario de hoy —
        // Alberto: "los agentes deben crear lo que sea que creen como nota, que se
        // añadiría a ese contexto"), y es un DOCUMENTO normal (formato real: encabezados,
        // negritas, tablas si el resultado los trae en markdown), no un nodo por línea.
        const ctx = firstContextOf(node!)
        const parentId = ctx ? ctx.id : getTodayDiaryUnderAgenda().id
        const resultDoc = store.createNode({ text: `▶ ${node!.text}`, parentId, extraData: { _doc: '1' } })
        store.updateNode(resultDoc.id, { body: markdownToHtml(res.result) })
        try {
          const ed = JSON.parse(node!.extraData || '{}')
          ed._agentLastRun = new Date().toISOString()
          store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
        } catch { /* ignore */ }
        setSaved(true)
        openNodeDetail(resultDoc.id)
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
        {/* Activar/pausar + ejecutar ahora, en la misma fila — antes cada botón
            ocupaba el 100% del ancho apilado, muy anchos y feos (Alberto, 15 jul). */}
        <div>
          <div className="rc-section-label" style={{ marginBottom: 6 }}>
            {t('agents.stateTitle', 'Estado')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleEnabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
                background: data.enabled ? 'rgba(34,197,94,0.10)' : 'var(--bg-secondary)',
                border: '1px solid', borderColor: data.enabled ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit',
              }}
              title={t('agents.toggleHint', 'clic para cambiar')}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: data.enabled ? '#22c55e' : 'var(--text-tertiary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')}
              </span>
            </button>
            <button
              onClick={handleRun}
              disabled={running || !isLoggedIn}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, minWidth: 0,
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600,
                cursor: running || !isLoggedIn ? 'default' : 'pointer',
                opacity: running || !isLoggedIn ? 0.6 : 1,
              }}
              title={isLoggedIn ? t('ai.runAgent', 'Ejecutar') : (isEn ? 'Sign in to run' : 'Inicia sesión para ejecutar')}
            >
              {running ? t('ai.running', 'Ejecutando…') : `▶ ${t('agents.runButton', 'Ejecutar')}`}
            </button>
          </div>
          {error && <div style={{ fontSize: 11.5, color: 'var(--danger, #ef4444)', marginTop: 8 }}>{error}</div>}
          {saved && <div style={{ fontSize: 11.5, color: 'var(--success, #22c55e)', marginTop: 8 }}>{t('ai.resultSaved', '✓ Resultado guardado en el diario')}</div>}
        </div>

        {/* Programación — modal con hora/repetición/expiración (Alberto, 15 jul:
            "mismo modal que el de las tareas, ligeramente modificado"), en vez del
            desplegable de horas fijas de antes. */}
        <div>
          <div className="rc-section-label" style={{ marginBottom: 6 }}>
            {t('agents.scheduleTitle', 'Programación')}
          </div>
          <button
            onClick={() => setScheduleModalOpen(true)}
            style={{ width: '100%', textAlign: 'left', fontSize: 12.5, padding: '8px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            📅 {scheduleButtonLabel(data.schedule, data.scheduleExpiresAt, isEn)}
          </button>
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

      {scheduleModalOpen && (
        <AgentScheduleModal
          schedule={data.schedule}
          expiresAt={data.scheduleExpiresAt}
          onClose={() => setScheduleModalOpen(false)}
          onSave={(schedule, expiresAt) => setSchedule(schedule, expiresAt)}
        />
      )}
    </div>
  )
}
