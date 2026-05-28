// MARK: - NodeSpecialControls
//
// Barra de controles para nodos especiales de From.
// Se muestra entre el título y los hijos en NodeView.
// Mismo estilo visual que los controles de Agenda (diary-nav-btn).
//
// Nodos soportados:
//   · Agente (_agentDef="1") — toggle, ejecutar, schedule, último run
//   · 🤖 Agentes (raíz)     — estadísticas + nuevo agente
//   · 📌 Atajos (raíz)      — contador + añadir
//   · 📋 Plantillas (raíz)  — contador + nueva
//   · 🧠 Contexto (raíz)    — estado del perfil

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { getAgentData, setAgentEnabled, getAgentesNode } from '../../utils/agentesHelper'
import { apiRequest, getToken, TokensError } from '../../api/client'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import { emptyTrash } from '../../utils/papeleraHelper'

interface Props {
  node: Node
}

// ── Agente individual ─────────────────────────────────────────────────────────

function AgentControls({ node }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const data = getAgentData(node.id)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
        onClick={() => setAgentEnabled(node.id, !data.enabled)}
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

      {/* Schedule (futuro) */}
      <span className="node-special-meta" style={{ opacity: 0.4 }} title="Programación automática — próximamente">
        ⏰ Sin programar
      </span>

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

// ── Raíz: 🤖 Agentes ─────────────────────────────────────────────────────────

function AgentesRootControls({ node }: Props) {
  const s = useStore()
  const children = s.children(node.id).filter(n => !n.deletedAt)
  const activeCount = children.filter(n => {
    try { return JSON.parse(n.extraData || '{}')._agentEnabled !== 'false' } catch { return true }
  }).length

  function handleNewAgent() {
    const newNode = store.createNode({
      text:     '🤖 Nuevo agente',
      parentId: node.id,
    })
    store.updateNode(newNode.id, {
      extraData: JSON.stringify({
        _agentDef:          '1',
        _agentId:           `custom-${Date.now()}`,
        _agentIcon:         '🤖',
        _agentSystemPrompt: 'Eres un asistente útil que responde en español.',
        _agentUserMessage:  'Ayúdame con esta tarea.',
        _agentEnabled:      'true',
        _agentSchedule:     '',
      }),
    })
    // Nodos hijos editables
    store.createNode({ text: 'Prompt: Eres un asistente útil que responde en español.', parentId: newNode.id })
    store.createNode({ text: 'Mensaje: Ayúdame con esta tarea.', parentId: newNode.id })
  }

  return (
    <div className="node-special-bar">
      <span className="node-special-meta">
        {activeCount} activo{activeCount !== 1 ? 's' : ''} · {children.length} en total
      </span>
      <button
        className="node-special-pill node-special-pill--action"
        onClick={handleNewAgent}
        title="Crear nuevo agente"
      >
        + Nuevo agente
      </button>
    </div>
  )
}

// ── Raíz: 📌 Atajos ──────────────────────────────────────────────────────────

function AtajosRootControls({ node }: Props) {
  const s = useStore()
  const count = s.children(node.id).filter(n => !n.deletedAt).length

  return (
    <div className="node-special-bar">
      <span className="node-special-meta">{count} atajo{count !== 1 ? 's'  : ''}</span>
      <span className="node-special-meta" style={{ opacity: 0.5 }}>
        Usa ⭐ en cualquier nota o 🔖 en un filtro para añadir atajos
      </span>
    </div>
  )
}

// ── Raíz: 📋 Plantillas ───────────────────────────────────────────────────────

function PlantillasRootControls({ node }: Props) {
  const s = useStore()
  const count = s.children(node.id).filter(n => !n.deletedAt).length

  function handleNew() {
    store.createNode({ text: 'Nueva plantilla', parentId: node.id })
  }

  return (
    <div className="node-special-bar">
      <span className="node-special-meta">{count} plantilla{count !== 1 ? 's' : ''}</span>
      <button
        className="node-special-pill node-special-pill--action"
        onClick={handleNew}
      >
        + Nueva plantilla
      </button>
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
  // Agente individual
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._agentDef === '1') return <AgentControls node={node} />
  } catch { /* ignore */ }

  // Nodos raíz especiales por nombre/emoji
  const text = node.text || ''
  if (text === '🤖 Agentes')   return <AgentesRootControls node={node} />
  if (text === '📌 Atajos')    return <AtajosRootControls node={node} />
  if (text === '📋 Plantillas') return <PlantillasRootControls node={node} />
  if (text === '🧠 Contexto')  return <ContextoRootControls node={node} />
  if (text === '🗑 Papelera')  return <PapeleraRootControls node={node} />

  return null
}
