/**
 * agentesHelper — Sistema de agentes como nodos del árbol de From.
 *
 * Estructura:
 *   🤖 Agentes  (nodo raíz, siblingOrder alto)
 *     ├── 📋 Resumir el día     extraData._agentDef="1", _agentEnabled="true"
 *     ├── ✅ Extraer tareas
 *     └── ...
 *
 * Propiedades de cada agente en extraData:
 *   _agentDef:          "1"           — identifica nodos agente
 *   _agentIcon:         "📋"          — emoji del agente
 *   _agentSystemPrompt: "..."         — prompt del sistema
 *   _agentUserMessage:  "..."         — mensaje del usuario
 *   _agentEnabled:      "true"/"false" — activo o no
 *   _agentSchedule:     ""            — cron futuro, ej: "daily:09:00"
 *   _agentId:           "unique-id"   — ID estable para el server
 */

import { store } from '../store/nodeStore'
import type { Node } from '../types'

const AGENTES_NAME = '🤖 Agentes'

export interface AgentDef {
  id: string
  label: string
  icon: string
  systemPrompt: string
  userMessage: string | (() => string)
}

// Agentes predefinidos — fuente de verdad de agentes predefinidos
export const PREDEFINED_AGENTS: AgentDef[] = [
  {
    id: 'resumir-dia',
    label: 'Resumir el día',
    icon: '📋',
    systemPrompt: 'Eres un asistente que resume el diario del usuario de forma concisa y clara en español.',
    userMessage: 'Resume los puntos clave del día: logros, aprendizajes y acciones pendientes.',
  },
  {
    id: 'extraer-tareas',
    label: 'Extraer tareas',
    icon: '✅',
    systemPrompt: 'Eres un asistente de productividad experto en identificar tareas accionables. Respondes en español.',
    userMessage: 'Identifica todas las tareas y acciones pendientes. Devuélvelas como lista con prioridad (alta/media/baja) y fecha sugerida.',
  },
  {
    id: 'planificar-semana',
    label: 'Planificar semana',
    icon: '🗓',
    systemPrompt: 'Eres un coach de productividad especializado en planificación semanal. Respondes en español.',
    userMessage: 'Sugiere una estructura de semana productiva con bloques de tiempo para trabajo profundo, reuniones, revisión y descanso.',
  },
  {
    id: 'revisar-pendientes',
    label: 'Revisar pendientes',
    icon: '🔍',
    systemPrompt: 'Eres un asistente que analiza tareas y prioriza con metodología GTD. Respondes en español.',
    userMessage: 'Analiza las tareas vencidas y pendientes. ¿Cuáles hay que hacer ya, delegar, posponer o eliminar? Da una recomendación clara.',
  },
  {
    id: 'brainstorming',
    label: 'Brainstorming',
    icon: '💡',
    systemPrompt: 'Eres un facilitador creativo experto en técnicas de ideación. Respondes en español.',
    userMessage: 'Genera 10 ideas diversas y creativas. Incluye ideas convencionales, disruptivas y combinaciones inesperadas.',
  },
  {
    id: 'mejorar-texto',
    label: 'Mejorar texto',
    icon: '✍️',
    systemPrompt: 'Eres un editor profesional experto en escritura clara y persuasiva en español.',
    userMessage: 'Mejora el texto manteniendo el significado original: hazlo más claro, conciso y con mejor flujo. Muestra el antes/después.',
  },
  {
    id: 'reflexion-diaria',
    label: 'Reflexión diaria',
    icon: '🧘',
    systemPrompt: 'Eres un coach personal que facilita la reflexión y el autoconocimiento. Respondes en español.',
    userMessage: '¿Qué fue lo mejor del día? ¿Qué aprendí? ¿Qué haría diferente? Dame 3 preguntas de reflexión profunda para responder.',
  },
  {
    id: 'resumen-ejecutivo',
    label: 'Resumen ejecutivo',
    icon: '📊',
    systemPrompt: 'Eres un asistente especializado en comunicación ejecutiva concisa. Respondes en español.',
    userMessage: 'Crea un resumen ejecutivo de máximo 5 bullet points con lo más importante. Para una audiencia directiva que tiene 30 segundos.',
  },
  {
    id: 'proximos-pasos',
    label: 'Próximos pasos',
    icon: '🚀',
    systemPrompt: 'Eres un asistente de acción orientado a resultados. Respondes en español.',
    userMessage: 'Define los 3-5 próximos pasos concretos y accionables para avanzar en el proyecto o situación.',
  },
  {
    id: 'email-profesional',
    label: 'Email profesional',
    icon: '📧',
    systemPrompt: 'Eres un especialista en comunicación profesional escrita en español.',
    userMessage: 'Redacta un email profesional, claro y efectivo sobre el tema indicado. Incluye asunto, cuerpo y cierre apropiado.',
  },
  {
    id: 'revision-semanal',
    label: 'Revisión semanal',
    icon: '📅',
    systemPrompt: 'Eres un asistente de productividad experto en revisiones semanales. Respondes en español.',
    userMessage: 'Haz una revisión semanal: logros, puntos de mejora y prioridades para la próxima semana. Da 3 acciones concretas para el lunes.',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getAgentesNode(): Node | undefined {
  return store.children(null).find(n => !n.deletedAt && n.text === AGENTES_NAME)
}

/** Lee los datos de agente de un nodo */
export function getAgentData(nodeId: string): {
  icon: string; systemPrompt: string; userMessage: string
  enabled: boolean; schedule: string; agentId: string
} | null {
  const n = store.getNode(nodeId)
  if (!n) return null
  try {
    const ed = JSON.parse(n.extraData || '{}')
    if (ed._agentDef !== '1') return null
    return {
      icon:         ed._agentIcon || '🤖',
      systemPrompt: ed._agentSystemPrompt || '',
      userMessage:  ed._agentUserMessage  || '',
      enabled:      ed._agentEnabled !== 'false',
      schedule:     ed._agentSchedule || '',
      agentId:      ed._agentId || nodeId,
    }
  } catch { return null }
}

/** Activa o desactiva un agente */
export function setAgentEnabled(nodeId: string, enabled: boolean) {
  const n = store.getNode(nodeId)
  if (!n) return
  try {
    const ed = JSON.parse(n.extraData || '{}')
    ed._agentEnabled = enabled ? 'true' : 'false'
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  } catch { /* ignore */ }
}

// ── Ensure ───────────────────────────────────────────────────────────────────

let _ensureDone = false

/**
 * Crea el nodo 🤖 Agentes con los agentes predefinidos si no existe.
 * Añade nuevos agentes si se añaden a PREDEFINED_AGENTS.
 * Se llama en cada arranque de la app.
 */
export function ensureAgentesNode(): void {
  if (_ensureDone) return
  _ensureDone = true

  let agentesNode = getAgentesNode()

  if (!agentesNode) {
    const created = store.createNode({
      text: AGENTES_NAME,
      parentId: null,
      siblingOrder: 9999,
    })
    agentesNode = store.getNode(created.id)!
  }

  // Agentes existentes (por _agentId)
  const existingChildren = store.children(agentesNode.id).filter(n => !n.deletedAt)
  const existingIds = new Set<string>()
  for (const child of existingChildren) {
    try {
      const ed = JSON.parse(child.extraData || '{}')
      if (ed._agentId) existingIds.add(ed._agentId)
    } catch { /* ignore */ }
  }

  // Añadir solo los que no existan aún
  for (const def of PREDEFINED_AGENTS) {
    if (existingIds.has(def.id)) continue
    const userMsg = typeof def.userMessage === 'function' ? def.userMessage() : def.userMessage
    const node = store.createNode({
      text:     `${def.icon} ${def.label}`,
      parentId: agentesNode.id,
    })
    store.updateNode(node.id, {
      extraData: JSON.stringify({
        _agentDef:          '1',
        _agentId:           def.id,
        _agentIcon:         def.icon,
        _agentSystemPrompt: def.systemPrompt,
        _agentUserMessage:  userMsg,
        _agentEnabled:      'true',
        _agentSchedule:     '',
      }),
      isCollapsed: false,
    })

    // Nodos hijos con las propiedades visibles y editables
    store.createNode({ text: `Prompt: ${def.systemPrompt.slice(0, 60)}…`, parentId: node.id })
    store.createNode({ text: `Mensaje: ${userMsg.slice(0, 80)}…`,          parentId: node.id })
  }
}
