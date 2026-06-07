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
import { structuralId } from './deterministicId'
import { findRootByKey } from './rootLookup'
import type { Node } from '../types'

const AGENTES_NAME = '🤖 Agentes'

export interface AgentDef {
  id: string
  label: string
  icon: string
  systemPrompt: string
  userMessage: string | (() => string)
  /** Programación por defecto (ej. "daily:08:00", "weekly:1:09:00"). '' = manual. */
  schedule?: string
}

// Instrucción compartida: cómo navegar la web y cómo entregar el resultado.
// El servidor resuelve los bloques `from-action` con action: fetch_url.
const WEB_AGENT_INSTRUCTIONS = `Tienes acceso a internet. Para leer una página web, emite EXACTAMENTE este bloque y espera el resultado antes de seguir:
\`\`\`from-action
action: fetch_url
url: https://la-url-exacta.com
\`\`\`
Puedes consultar varias páginas (un bloque por página). Cuando ya tengas la información, escribe el RESULTADO FINAL sin más bloques de acción.

Formato del resultado: en español, directo, una idea por línea (sin Markdown de encabezados). Cada línea debe poder leerse suelta dentro de una nota. No incluyas saludos ni "aquí tienes". El resultado se guarda automáticamente en la nota del día.`

const WRITE_AGENT_INSTRUCTIONS = `Responde en español, directo y conciso, una idea por línea (sin encabezados Markdown). El resultado se guarda en la nota del día, así que cada línea debe entenderse suelta. Sin saludos ni "aquí tienes".`

// Agentes predefinidos — agentes "de verdad": producen un entregable concreto,
// algunos navegan la web, tienen horario sugerido y guardan el resultado en la
// nota diaria. El usuario los edita y crea los suyos.
export const PREDEFINED_AGENTS: AgentDef[] = [
  {
    id: 'informe-mercado',
    label: 'Informe de mercado',
    icon: '📈',
    schedule: 'daily:08:00',
    systemPrompt: `Eres un analista de mercados que prepara cada mañana un informe breve y accionable para un trader e inversor particular. ${WEB_AGENT_INSTRUCTIONS}`,
    userMessage: `Prepara el informe de mercado de hoy. Consulta estas fuentes y resume lo relevante:
- https://www.investing.com/
- https://www.cnbc.com/world-markets/
- https://www.coindesk.com/
Entrega: 1) cómo abren/están los índices clave (S&P 500, Nasdaq, IBEX 35), 2) materias primas y cripto destacadas (BTC, oro, petróleo), 3) 2-3 titulares macro del día, 4) una idea o nivel a vigilar. Máximo 10 líneas.`,
  },
  {
    id: 'resumen-prensa',
    label: 'Resumen de prensa',
    icon: '📰',
    schedule: 'daily:07:30',
    systemPrompt: `Eres un editor que prepara un resumen de prensa matutino, claro y sin ruido. ${WEB_AGENT_INSTRUCTIONS}`,
    userMessage: `Haz el resumen de prensa de hoy. Consulta estas portadas y destaca lo importante:
- https://www.elmundo.es/
- https://www.expansion.com/
- https://www.reuters.com/
Entrega los 5 titulares más relevantes, cada uno en una línea con una frase de contexto. Prioriza economía, mercados y tecnología.`,
  },
  {
    id: 'investigar-tema',
    label: 'Investigar un tema',
    icon: '🔎',
    schedule: '',
    systemPrompt: `Eres un investigador que prepara un briefing estructurado sobre el tema que te pidan. ${WEB_AGENT_INSTRUCTIONS}`,
    userMessage: `Investiga el tema que te indique (escríbelo aquí o pásame enlaces). Consulta las fuentes necesarias con fetch_url y entrega: qué es / por qué importa, los 3-4 puntos clave, datos o cifras relevantes, y una conclusión con próximos pasos. Si te paso enlaces, básate en ellos.`,
  },
  {
    id: 'resumen-enlace',
    label: 'Resumen de un enlace',
    icon: '🧾',
    schedule: '',
    systemPrompt: `Eres un asistente que resume páginas web de forma fiel y útil. ${WEB_AGENT_INSTRUCTIONS}`,
    userMessage: `Pega aquí la URL que quieres resumir. Léela con fetch_url y entrega: resumen en 3 líneas, los puntos clave en bullets, y si procede, acciones o ideas que se desprenden. No inventes nada que no esté en la página.`,
  },
  {
    id: 'revision-semanal-v2',
    label: 'Revisión semanal',
    icon: '🗓',
    schedule: 'weekly:1:09:00',
    systemPrompt: `Eres un coach de productividad que conduce una revisión semanal enfocada en resultados. ${WRITE_AGENT_INSTRUCTIONS}`,
    userMessage: `Condúceme una revisión semanal. Entrega: 3 preguntas para revisar logros y aprendizajes de la semana, 3 preguntas sobre lo que mejoraría, y propón las 3 prioridades concretas para empezar el lunes. Deja espacio para que yo conteste debajo de cada pregunta.`,
  },
]

// IDs de los agentes-ejemplo antiguos (v1) — se eliminan en la migración v2.
const LEGACY_AGENT_IDS = new Set([
  'resumir-dia', 'extraer-tareas', 'planificar-semana', 'revisar-pendientes',
  'brainstorming', 'mejorar-texto', 'reflexion-diaria', 'resumen-ejecutivo',
  'proximos-pasos', 'email-profesional', 'revision-semanal',
])

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getAgentesNode(): Node | undefined {
  return findRootByKey('agentes', AGENTES_NAME)
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
      predefinedId: structuralId('agentes') ?? undefined,
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
        _agentSchedule:     def.schedule ?? '',
      }),
      isCollapsed: false,
    })

    // Nodos hijos visibles/editables: el mensaje (instrucción) y cuándo se ejecuta.
    store.createNode({ text: `📨 ${userMsg}`, parentId: node.id })
    if (def.schedule) {
      store.createNode({ text: `⏰ Se ejecuta: ${describeSchedule(def.schedule)} · guarda el resultado en la nota del día`, parentId: node.id })
    } else {
      store.createNode({ text: '⏰ Manual · pulsa Ejecutar cuando lo necesites', parentId: node.id })
    }
  }
}

/** Texto legible de un schedule ("daily:08:00" → "cada día a las 08:00"). */
function describeSchedule(schedule: string): string {
  const parts = schedule.split(':')
  if (parts[0] === 'daily' && parts[1]) return `cada día a las ${parts[1]}:${parts[2] ?? '00'}`
  if (parts[0] === 'weekly' && parts.length >= 3) {
    const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
    const d = days[parseInt(parts[1])] ?? 'lunes'
    return `cada ${d} a las ${parts[2]}:${parts[3] ?? '00'}`
  }
  return schedule
}

/**
 * migrateAgentsV2 — elimina los agentes-ejemplo antiguos (v1) una sola vez.
 * Solo borra nodos cuyo _agentId está en LEGACY_AGENT_IDS (ejemplos de fábrica),
 * nunca agentes creados por el usuario. Tras esto, ensureAgentesNode añade los
 * nuevos. Guard idempotente con un flag en localStorage.
 */
export function migrateAgentsV2(): void {
  try { if (localStorage.getItem('from_agents_v2') === '1') return } catch { /* */ }
  const agentesNode = getAgentesNode()
  if (agentesNode) {
    for (const child of store.children(agentesNode.id)) {
      if (child.deletedAt) continue
      try {
        const ed = JSON.parse(child.extraData || '{}')
        if (ed._agentDef === '1' && LEGACY_AGENT_IDS.has(ed._agentId)) {
          store.deleteNode(child.id)
        }
      } catch { /* ignore */ }
    }
  }
  try { localStorage.setItem('from_agents_v2', '1') } catch { /* */ }
}
