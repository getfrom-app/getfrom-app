/**
 * agentesHelper — Sistema de agentes como nodos del árbol de Fromly.
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
import { markdownToHtml } from './importMarkdown'
import { htmlToMarkdown } from './htmlMarkdown'
import { isInPapelera } from './papeleraHelper'
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

/** ¿Es este nodo un agente? (mismo criterio que getAgentData, sin parsear el resultado completo) */
export function isAgentNode(n: Node | null | undefined): boolean {
  if (!n) return false
  try { return JSON.parse(n.extraData || '{}')._agentDef === '1' } catch { return false }
}

/**
 * listAllAgents — escanea TODO el árbol activo buscando nodos agente (mismo patrón
 * que listAllPrompts en promptsHelper.ts: el desplegable del chat debe ver agentes
 * de cualquier contexto, no solo los del root). Excluye la Papelera explícitamente
 * — un nodo eliminado se reparenta bajo 🗑 Papelera en vez de marcarse `deletedAt`
 * (papeleraHelper.ts), así que sigue siendo "activo" para `store.allActive()`.
 */
export function listAllAgents(): Node[] {
  return store.allActive().filter(n => isAgentNode(n) && !isInPapelera(n.id))
}

/** Convierte texto plano (una idea por línea o párrafos separados por blanco) en
 *  HTML simple de párrafos, para guardarlo como `.body` de un nodo-documento.
 *  Reutiliza `markdownToHtml` (importMarkdown.ts): sin sintaxis Markdown especial,
 *  cada línea no vacía se envuelve en su propio `<p>`. */
function userMessageToHtml(text: string): string {
  return markdownToHtml(text || '')
}

/**
 * createAgentUnder — crea un agente colgado de CUALQUIER contexto/nota (v2: «contexto
 * padre libre»). A diferencia de AgentListPanel.createAgent (v1, siempre bajo el root
 * único 🤖 Agentes), aquí `parentId` es el contexto activo — mismo patrón que
 * `onNewDocument` en V2App.tsx. El modelo de datos del agente (extraData) es IDÉNTICO
 * al de v1: solo cambia DÓNDE cuelga en el árbol.
 */
export function createAgentUnder(opts: {
  parentId: string | null
  label: string
  icon?: string
  systemPrompt?: string
  userMessage?: string
  schedule?: string
  enabled?: boolean
  /** Agente CONVERSACIONAL: en vez de ejecutarse solo, abre un chat con
   *  `userMessage` como primera pregunta y espera la respuesta del usuario
   *  (ver openAgentConversation en el servidor). */
  conversational?: boolean
}): Node {
  const icon = opts.icon || '🤖'
  const node = store.createNode({ text: `${icon} ${opts.label}`.trim(), parentId: opts.parentId })
  const userMessage = opts.userMessage || ''
  store.updateNode(node.id, {
    extraData: JSON.stringify({
      _agentDef:            '1',
      _agentId:             node.id,
      _agentIcon:           icon,
      _agentSystemPrompt:   opts.systemPrompt || '',
      _agentUserMessage:    userMessage,
      _agentEnabled:        opts.enabled ? 'true' : 'false',
      _agentSchedule:       opts.schedule ?? '',
      _agentConversational: opts.conversational ? '1' : '',
    }),
  })
  // La nota central del agente es un DOCUMENTO (editor de texto normal, sin viñetas
  // de outliner) — un único hijo con `_doc='1'` y el prompt en `.body` como HTML.
  if (userMessage) {
    const doc = store.createNode({ text: '', parentId: node.id })
    store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: userMessageToHtml(userMessage) })
  }
  return store.getNode(node.id)!
}

/** Busca (o crea si no existe) el hijo-documento que es la instrucción editable del
 *  agente. Un agente v2 tiene UN solo hijo documento (`_doc='1'`). Si el agente es
 *  antiguo (v1, hijos de texto plano tipo outliner), MIGRA ese contenido al nuevo
 *  documento la primera vez que se abre en el detalle (borra los hijos de texto
 *  plano y crea el documento con el mismo contenido convertido a HTML) — así deja
 *  de verse con viñetas de outliner sin perder la instrucción ya escrita, y
 *  `readAgentNote` no duplica el texto al leer ambos. */
export function getOrCreateAgentInstructionDoc(agentId: string): Node {
  const kids = store.children(agentId).filter(n => !n.deletedAt)
  const existingDoc = kids.find(n => { try { return JSON.parse(n.extraData || '{}')._doc === '1' } catch { return false } })
  if (existingDoc) return existingDoc
  // ⚠️ Mismo bug de pérdida de datos que getOrCreateContextKnowledgeDoc (cajones.ts,
  // 14 jul 2026): un hijo puede SER YA el documento moderno pero con
  // `extraData._doc` temporalmente no reconocido en este cliente (reconstrucción
  // desde un op-log parcial de otro dispositivo — ver opsClient.ts
  // pullAndApply). Antes esto borraba TODOS los hijos del agente y creaba uno
  // nuevo vacío, perdiendo las instrucciones reales. Si algún hijo ya tiene body
  // real, se repara su flag en vez de borrar nada.
  const candidateWithBody = kids.find(n => (n.body || '').trim() && (n.body || '').trim() !== '<p></p>')
  if (candidateWithBody) {
    let ed2: Record<string, unknown> = {}
    try { ed2 = JSON.parse(candidateWithBody.extraData || '{}') } catch { /* ignore */ }
    if (ed2._doc !== '1') { ed2._doc = '1'; store.updateNode(candidateWithBody.id, { extraData: JSON.stringify(ed2) }) }
    return store.getNode(candidateWithBody.id)!
  }
  // Agente v1: migra el texto plano existente (recursivo, mismo orden que readAgentNote).
  const legacyText = readAgentNote(agentId)
  for (const k of kids) store.deleteNode(k.id)
  const doc = store.createNode({ text: '', parentId: agentId })
  store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: legacyText ? userMessageToHtml(legacyText) : '<p></p>' })
  return store.getNode(doc.id)!
}

/** Lee los datos de agente de un nodo */
export function getAgentData(nodeId: string): {
  icon: string; systemPrompt: string; userMessage: string
  enabled: boolean; schedule: string; agentId: string; conversational: boolean
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
      conversational: ed._agentConversational === '1',
    }
  } catch { return null }
}

/** Lee la "nota" del agente: el texto de sus nodos hijos (recursivo, en orden),
 *  que es lo que el usuario edita en la ventana central. Esto ES la instrucción.
 *  Soporta AMBOS formatos: agentes nuevos (v2) tienen un hijo-documento (`_doc='1'`,
 *  contenido en `.body` como HTML — se extrae a texto plano con `htmlToMarkdown`);
 *  agentes antiguos (v1, creados antes de este cambio) tienen hijos de texto plano
 *  tipo outliner — se leen recursivamente como antes. No romper esto = no perder la
 *  instrucción de agentes ya creados. */
export function readAgentNote(nodeId: string): string {
  const lines: string[] = []
  const walk = (parentId: string) => {
    const kids = store.children(parentId).filter(n => !n.deletedAt)
    for (const k of kids) {
      let isDoc = false
      try { isDoc = JSON.parse(k.extraData || '{}')._doc === '1' } catch { /* ignore */ }
      if (isDoc) {
        const t = htmlToMarkdown(k.body || '').trim()
        if (t) lines.push(t)
        continue // un documento no tiene hijos-instrucción propios que recorrer
      }
      const t = (k.text || '').trim()
      if (t) lines.push(t)
      walk(k.id)
    }
  }
  walk(nodeId)
  return lines.join('\n').trim()
}

/** Sincroniza _agentUserMessage con la nota actual (lo que se ve y edita en el
 *  centro). Así "lo que escribes = lo que el agente ejecuta", también en el cron
 *  del servidor (que usa _agentUserMessage). Devuelve el mensaje resultante. */
export function syncAgentUserMessage(nodeId: string): string {
  const n = store.getNode(nodeId)
  if (!n) return ''
  const note = readAgentNote(nodeId)
  try {
    const ed = JSON.parse(n.extraData || '{}')
    if (ed._agentDef === '1' && (ed._agentUserMessage || '') !== note) {
      ed._agentUserMessage = note
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    }
  } catch { /* ignore */ }
  return note
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

    // La nota central es SOLO el prompt del usuario (lo que el agente debe hacer),
    // como un DOCUMENTO editable normal (sin viñetas de outliner). El horario y el
    // estado se muestran en la columna derecha, no como hijo.
    if (userMsg) {
      const doc = store.createNode({ text: '', parentId: node.id })
      store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: userMessageToHtml(userMsg) })
    }
  }
}

/**
 * migrateAgentMetaChildren — limpia las líneas meta antiguas («⏰ Se ejecuta…»,
 * «⏰ Manual…») de los hijos de los agentes y quita el prefijo «📨 » del prompt.
 * La nota central queda solo con el prompt del usuario. Idempotente vía flag.
 */
export function migrateAgentMetaChildren(): void {
  try { if (localStorage.getItem('from_agents_meta_v1') === '1') return } catch { /* */ }
  const agentesNode = getAgentesNode()
  if (agentesNode) {
    for (const agent of store.children(agentesNode.id)) {
      if (agent.deletedAt) continue
      try {
        const ed = JSON.parse(agent.extraData || '{}')
        if (ed._agentDef !== '1') continue
      } catch { continue }
      for (const child of store.children(agent.id)) {
        if (child.deletedAt) continue
        const txt = child.text || ''
        if (txt.startsWith('⏰ Se ejecuta:') || txt.startsWith('⏰ Manual')) {
          store.deleteNode(child.id)
        } else if (txt.startsWith('📨 ')) {
          store.updateNode(child.id, { text: txt.slice(2).trimStart() })
        }
      }
    }
  }
  try { localStorage.setItem('from_agents_meta_v1', '1') } catch { /* */ }
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
