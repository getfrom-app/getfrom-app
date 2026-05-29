// MARK: - NodeSpecialControls
//
// Barra de controles para nodos especiales de From.
// Se muestra entre el título y los hijos en NodeView.
// Mismo estilo visual que los controles de Agenda (diary-nav-btn).
//
// Nodos soportados:
//   · Agente (_agentDef="1")    — toggle, ejecutar, schedule, último run
//   · Atajo  (_shortcutQuery)   — descripción del filtro + botón Aplicar
//   · 🧠 Contexto (raíz)       — estado del perfil
//   · 🗑 Papelera (raíz)       — contador + vaciar
//
// NO tienen controles especiales (se crean/gestionan como nodos normales):
//   · 🤖 Agentes (raíz)   — crea nuevo agente con Enter como cualquier nodo
//   · 📋 Plantillas (raíz) — crea nueva plantilla con Enter
//   · 📊 Paneles (raíz)    — los hijos son paneles individuales con sus propios controles

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { getAgentData, setAgentEnabled } from '../../utils/agentesHelper'
import { apiRequest, getToken, TokensError } from '../../api/client'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import { emptyTrash } from '../../utils/papeleraHelper'
import { scheduleNextLabel } from '../../utils/scheduleHelper'

interface Props {
  node: Node
}

// ── Agente individual ─────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS = [
  { value: '',              label: 'Sin programar' },
  { value: 'daily:08:00',  label: 'Diario 08:00' },
  { value: 'daily:09:00',  label: 'Diario 09:00' },
  { value: 'daily:12:00',  label: 'Diario 12:00' },
  { value: 'daily:18:00',  label: 'Diario 18:00' },
  { value: 'daily:21:00',  label: 'Diario 21:00' },
  { value: 'weekly:1:09:00', label: 'Semanal — lunes 09:00' },
  { value: 'weekly:5:09:00', label: 'Semanal — viernes 09:00' },
  { value: 'weekly:0:09:00', label: 'Semanal — domingo 21:00' },
]

async function setAgentSchedule(nodeId: string, schedule: string) {
  const n = store.getNode(nodeId)
  if (!n) return
  try {
    const ed = JSON.parse(n.extraData || '{}')
    ed._agentSchedule = schedule
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })

    // Sync al servidor solo si hay sesión
    if (!getToken()) return
    const payload = {
      nodeId,
      agentId:      ed._agentId      ?? nodeId,
      agentTitle:   n.text,
      systemPrompt: ed._agentSystemPrompt ?? '',
      userMessage:  ed._agentUserMessage  ?? '',
      schedule,
      enabled:      ed._agentEnabled !== false,
    }
    // Solo podemos registrar si tenemos systemPrompt/userMessage
    if (!payload.systemPrompt || !payload.userMessage) return
    apiRequest('/agents/schedule', { method: 'POST', body: JSON.stringify(payload) })
      .catch(err => console.warn('[schedule sync]', err))
  } catch { /* ignore */ }
}

function scheduleLabel(value: string): string {
  return SCHEDULE_OPTIONS.find(o => o.value === value)?.label ?? 'Sin programar'
}

function AgentControls({ node }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const data = getAgentData(node.id)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const isLoggedIn = !!getToken()

  if (!data) return null

  async function handleRun() {
    if (running || !isLoggedIn) return
    setRunning(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await apiRequest<{ ok: boolean; result?: string; error?: string }>('/agents/run', {
        method: 'POST',
        body: JSON.stringify({
          agentId:          data!.agentId,
          agentTitle:       node.text,
          systemPrompt:     data!.systemPrompt,
          firstUserMessage: data!.userMessage,
          modelTier:        'fast',
        }),
      })
      if (res.ok && res.result) {
        setLastResult(res.result)
        // Guardar resultado como nodos hijos bajo hoy
        const today = getTodayDiaryUnderAgenda()
        const resultParent = store.createNode({
          text:     `▶ ${node.text}`,
          parentId: today.id,
        })
        const lines = res.result.split('\n').map((l: string) => l.trim()).filter(Boolean)
        for (const line of lines) {
          store.createNode({ text: line, parentId: resultParent.id })
        }
        // Guardar timestamp de última ejecución
        try {
          const ed = JSON.parse(node.extraData || '{}')
          ed._agentLastRun = new Date().toISOString()
          store.updateNode(node.id, { extraData: JSON.stringify(ed) })
        } catch { /* ignore */ }
        // Navegar al resultado
        navigate(`/node/${resultParent.id}`)
      } else {
        setError(res.error || 'Error al ejecutar')
      }
    } catch (e) {
      if (e instanceof TokensError) {
        window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } }))
      } else {
        setError(e instanceof Error ? e.message : 'Error de conexión')
      }
    } finally {
      setRunning(false)
    }
  }

  // Última ejecución
  let lastRunText = ''
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._agentLastRun) {
      const diff = Date.now() - new Date(ed._agentLastRun).getTime()
      const mins = Math.floor(diff / 60000)
      const hrs = Math.floor(mins / 60)
      const days = Math.floor(hrs / 24)
      if (days > 0) lastRunText = `Última: hace ${days}d`
      else if (hrs > 0) lastRunText = `Última: hace ${hrs}h`
      else if (mins > 0) lastRunText = `Última: hace ${mins}min`
      else lastRunText = 'Última: ahora mismo'
    }
  } catch { /* ignore */ }

  return (
    <div className="node-special-bar">
      {/* Toggle activo/pausado */}
      <button
        className={`node-special-pill ${data.enabled ? 'node-special-pill--on' : 'node-special-pill--off'}`}
        onClick={() => {
          setAgentEnabled(node.id, !data.enabled)
          // Sync enabled state al servidor si hay schedule
          if (data.schedule && isLoggedIn) {
            apiRequest('/agents/schedule', {
              method: 'POST',
              body: JSON.stringify({
                nodeId:       node.id,
                agentId:      data.agentId,
                agentTitle:   node.text,
                systemPrompt: data.systemPrompt,
                userMessage:  data.userMessage,
                schedule:     data.schedule,
                enabled:      !data.enabled,
              }),
            }).catch(() => { /* silencioso */ })
          }
        }}
        title={data.enabled ? 'Activo — clic para pausar' : 'Pausado — clic para activar'}
      >
        <span className="node-special-pill-dot" />
        {data.enabled ? 'Activo' : 'Pausado'}
      </button>

      {/* Ejecutar */}
      <button
        className={`node-special-pill node-special-pill--action ${running ? 'node-special-pill--loading' : ''}`}
        onClick={handleRun}
        disabled={running || !isLoggedIn}
        title={isLoggedIn ? 'Ejecutar agente' : 'Inicia sesión para ejecutar'}
      >
        {running ? (
          <>
            <span className="node-special-spinner" />
            Ejecutando…
          </>
        ) : (
          <>▶ Ejecutar</>
        )}
      </button>

      {/* Última ejecución */}
      {lastRunText && (
        <span className="node-special-meta">{lastRunText}</span>
      )}

      {/* Schedule — selector compacto + próxima ejecución */}
      <div style={{ position: 'relative' }}>
        <button
          className="node-special-pill node-special-pill--action"
          onClick={() => setShowSchedule(v => !v)}
          title="Programar ejecución automática"
          style={{ fontSize: 11 }}
        >
          ⏰ {scheduleLabel(data.schedule)}
        </button>
        {showSchedule && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setShowSchedule(false)}
            />
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 1000,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              minWidth: 200, overflow: 'hidden',
            }}>
              {SCHEDULE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setAgentSchedule(node.id, opt.value); setShowSchedule(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', fontSize: 12, border: 'none',
                    background: data.schedule === opt.value ? 'var(--accent-soft)' : 'none',
                    color: data.schedule === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (data.schedule !== opt.value) (e.target as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (data.schedule !== opt.value) (e.target as HTMLElement).style.background = 'none' }}
                >
                  {data.schedule === opt.value ? '✓ ' : ''}{opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Próxima ejecución */}
      {data.schedule && (() => {
        const lbl = scheduleNextLabel(data.schedule)
        return lbl ? (
          <span className="node-special-meta" style={{ opacity: 0.55, fontSize: 10 }}>
            {lbl}
          </span>
        ) : null
      })()}

      {/* Error inline */}
      {error && (
        <span className="node-special-meta" style={{ color: 'var(--danger)' }}>{error}</span>
      )}

      {/* Resultado reciente */}
      {lastResult && (
        <span className="node-special-meta" style={{ color: 'var(--success)' }}>✓ Resultado guardado en el diario</span>
      )}
    </div>
  )
}

// ── Atajo individual (_shortcutQuery) ─────────────────────────────────────────
// Un atajo es un filtro guardado. Al abrirlo, muestra qué filtro es
// y un botón para aplicarlo al árbol (igual que clicking en el sidebar).

function AtajoControls({ node }: Props) {
  let query = ''
  let view  = ''
  let targetNodeId = ''
  try {
    const ed = JSON.parse(node.extraData || '{}')
    query        = ed._shortcutQuery  || ''
    view         = ed._shortcutView   || 'lista'
    targetNodeId = ed._shortcutNodeId || ''
  } catch { return null }

  if (!query && !targetNodeId) return null

  function applyFilter() {
    if (targetNodeId) {
      // Atajo a un nodo específico → navegar
      window.location.href = `/app/node/${targetNodeId}`
    } else {
      // Atajo a un filtro → aplicar en árbol
      window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query } }))
      // Volver a root para ver el árbol filtrado
      if (window.location.pathname !== '/app/' && window.location.pathname !== '/app') {
        window.location.href = '/app/'
      }
    }
  }

  const label = targetNodeId
    ? 'Navegar al nodo'
    : `Filtrar: ${query}`

  return (
    <div className="node-special-bar">
      <span className="node-special-meta" style={{ fontFamily: 'monospace', fontSize: 11 }}>
        {targetNodeId ? `→ nodo` : `🔍 ${query}`}
      </span>
      <button
        className="node-special-pill node-special-pill--action"
        onClick={applyFilter}
        title={label}
      >
        ▶ Aplicar filtro
      </button>
      <span className="node-special-meta" style={{ opacity: 0.4, fontSize: 10 }}>
        Este nodo es un filtro guardado. El resultado se muestra en el árbol.
      </span>
    </div>
  )
}

// ── Raíz: 🧠 Contexto ────────────────────────────────────────────────────────

function ContextoRootControls({ node }: Props) {
  const navigate = useNavigate()
  const s = useStore()
  const perfil = s.perfilIANode()
  const perfilOk = !!(perfil && (
    s.children(perfil.id).filter(n => !n.deletedAt).some(n => n.text?.trim())
    || perfil.body?.trim()
  ))

  return (
    <div className="node-special-bar">
      <span
        className={`node-special-pill ${perfilOk ? 'node-special-pill--on' : 'node-special-pill--off'}`}
        style={{ cursor: 'default' }}
      >
        <span className="node-special-pill-dot" />
        Perfil {perfilOk ? 'configurado' : 'incompleto'}
      </span>
      {perfil && !perfilOk && (
        <button
          className="node-special-pill node-special-pill--action"
          onClick={() => navigate(`/node/${perfil.id}`)}
        >
          Completar perfil →
        </button>
      )}
    </div>
  )
}

// ── Raíz: 🗑 Papelera ────────────────────────────────────────────────────────

function PapeleraRootControls({ node }: Props) {
  const s = useStore()
  const children = s.children(node.id).filter(n => !n.deletedAt)

  function handleEmpty() {
    if (!confirm(`¿Vaciar la papelera? Se eliminarán permanentemente ${children.length} elemento(s).`)) return
    emptyTrash()
  }

  return (
    <div className="node-special-bar">
      <span className="node-special-meta">
        {children.length === 0
          ? 'La papelera está vacía'
          : `${children.length} elemento${children.length !== 1 ? 's' : ''}`
        }
      </span>
      <span className="node-special-meta" style={{ opacity: 0.5 }}>
        Botón derecho → Restaurar para recuperar un nodo
      </span>
      {children.length > 0 && (
        <button
          className="node-special-pill node-special-pill--action"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={handleEmpty}
        >
          Vaciar papelera
        </button>
      )}
    </div>
  )
}

// ── Router: detecta qué tipo de nodo es ──────────────────────────────────────

export default function NodeSpecialControls({ node }: Props) {
  try {
    const ed = JSON.parse(node.extraData || '{}')

    // Agente individual (_agentDef="1")
    if (ed._agentDef === '1') return <AgentControls node={node} />

    // Atajo individual (_shortcutQuery o _shortcutNodeId)
    if (ed._shortcutQuery !== undefined || ed._shortcutNodeId) {
      return <AtajoControls node={node} />
    }
  } catch { /* ignore */ }

  // Nodos raíz especiales por nombre/emoji
  // (solo los que realmente necesitan controles; el resto se gestiona como nodos normales)
  const text = node.text || ''
  if (text === '🧠 Contexto')  return <ContextoRootControls node={node} />
  if (text === '🗑 Papelera')  return <PapeleraRootControls node={node} />

  return null
}
