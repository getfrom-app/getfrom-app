import { useState, useEffect } from 'react'
import { apiRequest, getToken } from '../../api/client'

interface AgentRun {
  id: string
  agentId: string
  agentTitle?: string
  status: 'running' | 'completed' | 'failed'
  model?: string
  tokensUsed?: number
  turnsUsed?: number
  startedAt: string
  finishedAt?: string
}

const MODEL_LABEL = 'claude-3-5-haiku'

const SHORTCUTS = [
  {
    label: 'Resumir el día',
    icon: '📋',
    systemPrompt: 'Eres un asistente que resume el diario del usuario de forma concisa y clara.',
    userMessage: 'Resume los bullets del diario de hoy con los puntos clave y acciones pendientes.',
  },
  {
    label: 'Extraer tareas',
    icon: '✅',
    systemPrompt: 'Eres un asistente de productividad experto en identificar tareas accionables.',
    userMessage: 'Identifica todas las tareas y acciones pendientes que aparecen en el texto del día. Devuélvelas como lista numerada.',
  },
  {
    label: 'Planificar semana',
    icon: '📅',
    systemPrompt: 'Eres un coach de productividad especializado en planificación semanal.',
    userMessage: 'Sugiere una estructura y plan de trabajo para esta semana, considerando mis tareas pendientes y objetivos.',
  },
  {
    label: 'Revisar pendientes',
    icon: '🔍',
    systemPrompt: 'Eres un asistente que analiza tareas vencidas y da recomendaciones prácticas.',
    userMessage: 'Analiza las tareas vencidas o pendientes y dame recomendaciones concretas sobre cómo abordarlas o priorizarlas.',
  },
  {
    label: 'Brainstorming',
    icon: '💡',
    systemPrompt: 'Eres un asistente creativo experto en generar ideas y soluciones innovadoras.',
    userMessage: 'Genera ideas creativas y diversas sobre el tema seleccionado. Incluye al menos 8-10 ideas con diferentes enfoques.',
  },
  {
    label: 'Corregir ortografía',
    icon: '✏️',
    systemPrompt: 'Eres un corrector ortográfico y de estilo del español.',
    userMessage: 'Detecta y corrige los errores ortográficos, gramaticales y de estilo en el texto del día. Muestra los cambios realizados.',
  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AgentsView() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [agentTitle, setAgentTitle] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const isGuest = !getToken()

  useEffect(() => {
    if (isGuest) { setLoading(false); return }
    apiRequest<{ runs: AgentRun[] }>('/agents/runs?limit=20')
      .then(d => setRuns(d.runs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isGuest])

  async function handleRunAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!systemPrompt.trim() || !userMessage.trim()) return
    setRunning(true)
    setRunResult(null)
    setRunError(null)
    try {
      const result = await apiRequest<{ ok: boolean; result?: string; error?: string }>('/agents/run', {
        method: 'POST',
        body: JSON.stringify({
          agentId: `manual-${Date.now()}`,
          agentTitle: agentTitle || 'Agente manual',
          systemPrompt,
          firstUserMessage: userMessage,
          modelTier: 'fast',
        }),
      })
      if (result.ok) {
        setRunResult(result.result || 'Completado')
        const d = await apiRequest<{ runs: AgentRun[] }>('/agents/runs?limit=20')
        setRuns(d.runs || [])
      } else {
        setRunError(result.error || 'Error ejecutando agente')
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setRunning(false)
    }
  }

  function applyShortcut(s: typeof SHORTCUTS[0]) {
    setSystemPrompt(s.systemPrompt)
    setUserMessage(s.userMessage)
    setAgentTitle(s.label)
    setShowNewAgent(true)
    // Scroll to the new agent panel after a tick
    setTimeout(() => {
      document.querySelector('.agents-new-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  return (
    <div className="view agents-view">
      <div className="view-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="view-title">Agentes</h1>
          {!isGuest && !loading && (
            <span style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 100, padding: '2px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
              {runs.length}
            </span>
          )}
        </div>
        {!isGuest && (
          <button
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            onClick={() => { setShowNewAgent(v => !v); setRunResult(null); setRunError(null) }}
          >
            {showNewAgent ? 'Cerrar' : 'Nuevo agente +'}
          </button>
        )}
      </div>

      <div className="view-body">
        {isGuest ? (
          <div className="view-empty" style={{ paddingTop: 60 }}>
            Inicia sesión para usar agentes
          </div>
        ) : (
          <>
            {/* Herramientas rápidas */}
            <div className="agents-shortcuts-section">
              <div className="agents-shortcuts-label">Herramientas rápidas</div>
              <div className="agents-shortcuts">
                {SHORTCUTS.map(s => (
                  <button
                    key={s.label}
                    className="agent-shortcut-btn"
                    onClick={() => applyShortcut(s)}
                    title={s.label}
                  >
                    <span className="agent-shortcut-icon">{s.icon}</span>
                    <span className="agent-shortcut-text">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* New agent panel */}
            {showNewAgent && (
              <div className="agents-new-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Nuevo agente</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontFamily: 'monospace' }}>
                    {MODEL_LABEL}
                  </span>
                </div>
                <form onSubmit={handleRunAgent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Nombre del agente (opcional)"
                    value={agentTitle}
                    onChange={e => setAgentTitle(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <textarea
                    className="input"
                    placeholder="System prompt — instrucciones del agente (ej: Eres un asistente de productividad...)"
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    rows={3}
                    style={{ fontSize: 13, resize: 'vertical' }}
                    required
                  />
                  <textarea
                    className="input"
                    placeholder="Mensaje — qué debe hacer el agente (ej: Resume mis notas de hoy con los puntos clave...)"
                    value={userMessage}
                    onChange={e => setUserMessage(e.target.value)}
                    rows={3}
                    style={{ fontSize: 13, resize: 'vertical' }}
                    required
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={running || !systemPrompt.trim() || !userMessage.trim()}
                      style={{ fontSize: 13 }}
                    >
                      {running ? 'Ejecutando...' : 'Ejecutar'}
                    </button>
                    {running && (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Usando {MODEL_LABEL}...</span>
                    )}
                  </div>
                </form>

                {runResult && (
                  <div className="agents-result">
                    {runResult}
                  </div>
                )}
                {runError && (
                  <div className="agents-result" style={{ color: 'var(--red, #dc2626)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    Error: {runError}
                  </div>
                )}
              </div>
            )}

            {/* Runs table */}
            {loading ? (
              <div className="view-empty">Cargando...</div>
            ) : runs.length === 0 ? (
              <div className="view-empty">No hay ejecuciones todavía. Usa una herramienta rápida o crea tu primer agente.</div>
            ) : (
              <table className="agent-runs-table">
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th>Estado</th>
                    <th>Modelo</th>
                    <th>Inicio</th>
                    <th>Tokens</th>
                    <th>Turnos</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.id}>
                      <td style={{ fontWeight: 500 }}>{run.agentTitle || run.agentId}</td>
                      <td>
                        <span className={`agent-run-status agent-run-status--${run.status}`}>
                          {run.status === 'completed' ? 'Completado' : run.status === 'running' ? 'Ejecutando' : 'Error'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'monospace' }}>
                        {run.model || MODEL_LABEL}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDate(run.startedAt)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{run.tokensUsed ?? '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{run.turnsUsed ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
