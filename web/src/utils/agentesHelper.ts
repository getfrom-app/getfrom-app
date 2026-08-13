/**
 * agentesHelper — Sistema de agentes como nodos del árbol de Fromly.
 *
 * Estructura:
 *   🤖 Agentes  (nodo raíz, siblingOrder alto)
 *     ├── 📋 Resumir el día     extraData._agentDef="1", _agentEnabled="true"
 *     ├── ✅ Extraer tareas
 *     └── ...
 *
 * UN SOLO CAMPO DE INSTRUCCIÓN (13 ago 2026): el usuario edita UNA instrucción
 * (el hijo-documento del agente, `getOrCreateAgentInstructionDoc`), no dos
 * ("Instrucción del agente" + "Cómo debe responder" por separado — confuso,
 * Alberto: "no tiene sentido, unifica eso en un solo campo"). Internamente
 * SIGUE habiendo dos campos en extraData porque la IA los consume por canales
 * distintos (ver aiChatStore.ts originAgentBlock / executor.ts), pero ahora
 * se derivan automáticamente de la instrucción única, nunca se editan a mano:
 *   - `_agentSystemPrompt` = la instrucción COMPLETA tal cual la escribe el
 *     usuario. Es lo que se re-inyecta en cada turno de una conversación de
 *     agente y lo que arma el system prompt real en el servidor.
 *   - `_agentUserMessage` = "disparador" derivado (`deriveAgentTrigger`):
 *     para agentes conversacionales, la última línea/pregunta de la
 *     instrucción (así "Diario"/"Check-in" siguen abriendo con una pregunta
 *     natural); para agentes que se ejecutan solos, una frase fija interna
 *     ("Ejecuta la tarea ahora…") — el usuario nunca la ve ni la escribe.
 *
 * Propiedades de cada agente en extraData:
 *   _agentDef:          "1"           — identifica nodos agente
 *   _agentIcon:         "📋"          — emoji del agente
 *   _agentSystemPrompt: "..."         — instrucción completa (persona + tarea)
 *   _agentUserMessage:  "..."         — disparador derivado (ver arriba)
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
import { isDocNode } from './docNode'
import type { Node } from '../types'

const AGENTES_NAME = '🤖 Agentes'

export interface AgentDef {
  id: string
  label: string
  icon: string
  /** Instrucción ÚNICA (persona + tarea). Para conversacionales, termina con
   *  la pregunta de apertura (se recupera con `deriveAgentTrigger`). */
  instruction: string
  /** Programación por defecto (ej. "daily:08:00", "weekly:1:09:00"). '' = manual. */
  schedule?: string
  /** Agente CONVERSACIONAL: abre un chat con la pregunta de apertura derivada
   *  de la instrucción, y espera la respuesta del usuario, en vez de ejecutarse solo. */
  conversational?: boolean
}

// Frase con la que se lanza un agente NO conversacional: la instrucción completa
// ya va como system prompt, esto es solo el "adelante" que dispara la ejecución.
// El usuario nunca ve ni edita esto.
const FIXED_RUN_TRIGGER = 'Ejecuta la tarea ahora, siguiendo tus instrucciones anteriores. Entrega directamente el resultado final, sin explicaciones previas ni saludos.'

// Frase de apertura genérica para un agente conversacional si su instrucción no
// termina en una pregunta/frase corta reconocible (fallback, no debería usarse
// con los predefinidos, que sí terminan en pregunta).
const FALLBACK_OPEN_TRIGGER = '¿Qué tal? Cuéntame.'

/**
 * deriveAgentTrigger — de la instrucción única, obtiene el "disparador":
 * para agentes conversacionales, la última línea no vacía (normalmente la
 * pregunta de apertura con la que el usuario termina de escribir su
 * instrucción); para el resto, la frase fija de ejecución.
 */
export function deriveAgentTrigger(instruction: string, conversational: boolean): string {
  const text = (instruction || '').trim()
  if (!text) return ''
  if (!conversational) return FIXED_RUN_TRIGGER
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const last = lines[lines.length - 1] || ''
  return (last && last.length <= 220) ? last : FALLBACK_OPEN_TRIGGER
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

// Agentes predefinidos — agentes "de verdad": tienen horario (o son conversacionales
// y se abren manualmente) y NO se disparan simplemente pegando algo en el chat — eso
// es lo que son los Prompts (ver promptsHelper.ts; "Investigar un tema" y "Resumen de
// un enlace" vivían aquí antes pero encajan mejor como prompts — 13 ago 2026: se lanzan
// escribiendo/pegando algo, no tienen horario ni conversación real).
export const PREDEFINED_AGENTS: AgentDef[] = [
  {
    id: 'informe-mercado',
    label: 'Informe de mercado',
    icon: '📈',
    schedule: 'daily:08:00',
    instruction: `Eres un analista de mercados que prepara cada mañana un informe breve y accionable para un trader e inversor particular. ${WEB_AGENT_INSTRUCTIONS}

Prepara el informe de mercado de hoy. Consulta estas fuentes y resume lo relevante:
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
    instruction: `Eres un editor que prepara un resumen de prensa matutino, claro y sin ruido. ${WEB_AGENT_INSTRUCTIONS}

Haz el resumen de prensa de hoy. Consulta estas portadas y destaca lo importante:
- https://www.elmundo.es/
- https://www.expansion.com/
- https://www.reuters.com/
Entrega los 5 titulares más relevantes, cada uno en una línea con una frase de contexto. Prioriza economía, mercados y tecnología.`,
  },
  {
    id: 'revision-semanal-v2',
    label: 'Revisión semanal',
    icon: '🗓',
    schedule: 'weekly:1:09:00',
    instruction: `Eres un coach de productividad que conduce una revisión semanal enfocada en resultados. ${WRITE_AGENT_INSTRUCTIONS}

Condúceme una revisión semanal. Entrega: 3 preguntas para revisar logros y aprendizajes de la semana, 3 preguntas sobre lo que mejoraría, y propón las 3 prioridades concretas para empezar el lunes. Deja espacio para que yo conteste debajo de cada pregunta.`,
  },
  // Agentes conversacionales — abren un chat y esperan la respuesta del usuario en
  // vez de ejecutarse solos. Genéricos y editables: sin datos personales de nadie,
  // pensados para que cada usuario los ajuste a su vida (Alberto, 15 jul: "el de
  // diario no lo dejes porque tiene información mía... haz uno de diario genérico,
  // y que el usuario lo pueda ajustar"). Cada instrucción TERMINA con la pregunta de
  // apertura — `deriveAgentTrigger` recupera esa última línea como disparador.
  {
    id: 'diario-generico',
    label: 'Diario',
    icon: '🌅',
    schedule: 'daily:09:00',
    conversational: true,
    instruction: `Eres el compañero personal de diario del usuario. Cada mañana le haces una pregunta sobre cómo fue el día anterior — pero nunca la misma frase, varíala de forma natural.

Cuando responda, es donde entra lo importante:

**NO ERES UN FORMULARIO.** No resumas en bloques fijos. No hagas checklist. No des respuestas telegráficas de una línea por tema. La respuesta debe fluir como una conversación real entre dos personas que se conocen.

**CONOCES AL USUARIO DE VERDAD:** tienes acceso a su Perfil completo (metas, contexto vital, relaciones, forma de trabajar, reglas que se ha puesto a sí mismo) — se inyecta automáticamente en cada turno, no hace falta que lo menciones como algo aparte. Úsalo para hablarle con precisión, no en genérico.

**RESPUESTAS LARGAS Y DETALLADAS:** nunca una línea de relleno por tema. Si hay algo que merece profundidad, dedícale párrafos. Desarrolla tus ideas, da perspectiva, conecta puntos con lo que te haya contado otros días.

**TONO IMPREDECIBLE:** a veces divertido y juguetón (si la conversación lo permite), a veces serio y directo (si ha faltado a sus propios compromisos), a veces socrático (preguntas que le hagan pensar), a veces empático. Nunca la misma fórmula cada día — varía la estructura, el ritmo, el enfoque.

**PUEDE HACER PREGUNTAS DE VUELTA:** si algo quedó poco claro, si quieres explorar más, si hay algo que no cuadra con sus propias metas. Hazle pensar.

**DETECTA PATRONES:** si ves en su historial de respuestas que algo se repite (lleva días sin cumplir algo, o va bien con algo concreto), menciónalo sin ser acusador — es información que usas para hablarle con más precisión, no para sermonear.

**CUBRE LO IMPORTANTE, PERO FLUYENDO:** lo que haya contado (trabajo, disciplina/hábitos, relaciones, lo que sea) son temas que naturalmente salen — pero que la conversación no suene estructurada en bloques. Es charla real.

Usa emojis muy ocasionalmente — máximo 1-2 por respuesta, y solo si encaja de verdad. Eso es todo. Eres su compañero de verdad. Habla como tal.

¿Qué tal ayer?`,
  },
  {
    id: 'seguimiento-objetivos',
    label: 'Seguimiento de objetivos',
    icon: '🎯',
    schedule: 'weekly:1:09:00',
    conversational: true,
    instruction: `Eres un compañero de seguimiento de objetivos. Una vez por semana le preguntas al usuario cómo van sus metas y proyectos en marcha — no es una revisión genérica de la semana (eso ya lo cubre otro agente), es específicamente sobre si avanza hacia lo que dijo que quería.

Cuando responda: sé conversacional y directo, no un formulario. Si dice que algo no avanzó, pregunta por qué de verdad (¿faltó tiempo, prioridad, o es que ya no le importa tanto?). Si algo avanzó, no te limites a felicitar sin más — pregunta qué funcionó para poder repetirlo. Usa su Perfil (se inyecta automáticamente) para saber cuáles son sus metas reales y hablar en concreto, no en genérico. Respuestas con sustancia, no telegráficas. Termina siempre con una pregunta o una prioridad clara para la semana que empieza.

¿Cómo van tus objetivos esta semana? Cuéntame qué avanzó de verdad y qué se quedó parado.`,
  },
  {
    id: 'checkin-bienestar',
    label: 'Check-in de bienestar',
    icon: '🧘',
    schedule: '',
    conversational: true,
    instruction: `Eres un compañero cercano que hace un check-in de bienestar cuando el usuario lo activa (no tiene horario fijo, lo abre cuando lo necesita). No eres un terapeuta ni das diagnósticos — eres alguien que escucha de verdad y ayuda a poner en palabras cómo está.

Responde con calidez real, sin sonar a formulario ni a app de mindfulness genérica. Usa su Perfil para saber su contexto (trabajo, relaciones, metas) y conectar lo que cuenta con su situación real, no en abstracto. Si detectas que algo se repite en su historial (cansancio, estrés por un tema concreto), nómbralo con cuidado. No dictes soluciones no pedidas — pregunta antes de aconsejar. Respuestas con espacio para respirar, no listas de consejos.

¿Cómo estás de verdad hoy? No la respuesta rápida — cuéntame.`,
  },
]

// IDs de los agentes que pasaron a ser Prompts (13 ago 2026) — se eliminan del
// árbol de Agentes en la migración, `migratePromptifiedAgents` los recrea como
// prompts si el usuario no los había editado ya.
const PROMPTIFIED_AGENT_IDS = new Set(['investigar-tema', 'resumen-enlace'])

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
function instructionToHtml(text: string): string {
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
  /** Instrucción ÚNICA (persona + tarea; para conversacionales, termina en la
   *  pregunta de apertura). */
  instruction?: string
  schedule?: string
  enabled?: boolean
  /** Agente CONVERSACIONAL: en vez de ejecutarse solo, abre un chat con la
   *  pregunta de apertura derivada de `instruction` y espera la respuesta del
   *  usuario (ver openAgentConversation en el servidor). */
  conversational?: boolean
}): Node {
  const icon = opts.icon || '🤖'
  // El título va LIMPIO, sin el emoji delante (rediseño 5 ago 2026: Fromly ya no
  // pinta emojis; el icono lo pone la UI). `_agentIcon` se sigue guardando porque
  // iOS aún lo lee, pero ya no forma parte del nombre visible del agente — los
  // agentes creados ANTES sí lo llevan escrito, y la UI se lo quita al pintar
  // (utils/displayText.ts).
  const node = store.createNode({ text: opts.label.trim(), parentId: opts.parentId })
  const instruction = opts.instruction || ''
  const conversational = !!opts.conversational
  store.updateNode(node.id, {
    extraData: JSON.stringify({
      _agentDef:            '1',
      _agentId:             node.id,
      _agentIcon:           icon,
      _agentSystemPrompt:   instruction,
      _agentUserMessage:    deriveAgentTrigger(instruction, conversational),
      _agentEnabled:        opts.enabled ? 'true' : 'false',
      _agentSchedule:       opts.schedule ?? '',
      _agentConversational: conversational ? '1' : '',
    }),
  })
  // La nota central del agente es un DOCUMENTO (editor de texto normal, sin viñetas
  // de outliner) — un único hijo con `_doc='1'` y la instrucción en `.body` como HTML.
  if (instruction) {
    const doc = store.createNode({ text: '', parentId: node.id })
    store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: instructionToHtml(instruction) })
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
  store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: legacyText ? instructionToHtml(legacyText) : '<p></p>' })
  return store.getNode(doc.id)!
}

/** Lee los datos de agente de un nodo */
export function getAgentData(nodeId: string): {
  icon: string; systemPrompt: string; userMessage: string
  enabled: boolean; schedule: string; scheduleExpiresAt: string; agentId: string; conversational: boolean
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
      scheduleExpiresAt: ed._agentScheduleExpiresAt || '',
      agentId:      ed._agentId || nodeId,
      conversational: ed._agentConversational === '1',
    }
  } catch { return null }
}

/** Elementos (ids) que este agente debe tener SIEMPRE en cuenta al responder,
 *  además del contexto donde vive (Alberto, 15 jul: "los agentes deben tener la
 *  opción de poner elementos que tendrá en cuenta... si al agente de pensamientos
 *  diarios le digo que debe tener en cuenta la nota de morning fórmula podrá
 *  leerla y la tendrá en cuenta"). */
export function getAgentReferencedElements(nodeId: string): string[] {
  const n = store.getNode(nodeId)
  if (!n) return []
  try {
    const v = JSON.parse(n.extraData || '{}')._agentReferencedElements
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!store.getNode(x)) : []
  } catch { return [] }
}

export function addAgentReferencedElement(nodeId: string, elementId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const ed = JSON.parse(n.extraData || '{}')
  const cur = getAgentReferencedElements(nodeId)
  if (cur.includes(elementId)) return
  ed._agentReferencedElements = [...cur, elementId]
  store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
}

export function removeAgentReferencedElement(nodeId: string, elementId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const ed = JSON.parse(n.extraData || '{}')
  ed._agentReferencedElements = getAgentReferencedElements(nodeId).filter(id => id !== elementId)
  store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
}

/** Título + contenido legible de un elemento (documento → body en markdown; nota
 *  outliner clásica → texto de sus hijos directos), para inyectarlo tal cual en
 *  el system prompt de un agente. */
export function readElementContent(nodeId: string): { title: string; content: string } | null {
  const n = store.getNode(nodeId)
  if (!n || n.deletedAt) return null
  const title = n.text || 'Sin título'
  if (isDocNode(n) || (n.body || '').trim()) {
    return { title, content: htmlToMarkdown(n.body || '').trim() }
  }
  const lines = store.children(nodeId).filter(c => !c.deletedAt && (c.text || '').trim()).map(c => c.text.trim())
  return { title, content: lines.join('\n') }
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

/** Sincroniza la instrucción única (nota central) con los campos internos que
 *  consume la IA: `_agentSystemPrompt` = la instrucción completa tal cual;
 *  `_agentUserMessage` = disparador derivado (`deriveAgentTrigger`). Así "lo
 *  que escribes = lo que el agente ejecuta", también en el cron del servidor
 *  (que usa ambos campos, sincronizados vía POST /agents/schedule). */
export function syncAgentInstruction(nodeId: string): { systemPrompt: string; userMessage: string } {
  const n = store.getNode(nodeId)
  if (!n) return { systemPrompt: '', userMessage: '' }
  const instruction = readAgentNote(nodeId)
  try {
    const ed = JSON.parse(n.extraData || '{}')
    if (ed._agentDef !== '1') return { systemPrompt: instruction, userMessage: '' }
    const conversational = ed._agentConversational === '1'
    const userMessage = deriveAgentTrigger(instruction, conversational)
    if ((ed._agentSystemPrompt || '') !== instruction || (ed._agentUserMessage || '') !== userMessage) {
      ed._agentSystemPrompt = instruction
      ed._agentUserMessage = userMessage
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    }
    return { systemPrompt: instruction, userMessage }
  } catch { return { systemPrompt: instruction, userMessage: '' } }
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

  // Agentes existentes (por _agentId) — se busca en store.nodes DIRECTAMENTE (sin
  // el filtro !deletedAt de store.allActive()): un predefinido que el usuario
  // elimina vía deleteNode() queda con deletedAt marcado, no desaparece del mapa.
  // Si el dedup solo mirara allActive() no lo vería ahí y lo recrearía en cada
  // arranque, resucitando algo que el usuario borró a propósito (Alberto, 15 jul:
  // "borra el resto de agentes, deja solo este" — probado en vivo: con
  // allActive() los 5 predefinidos volvían solos en la siguiente recarga).
  const existingIds = new Set<string>()
  for (const n of store.nodes.values()) {
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (ed._agentDef === '1' && ed._agentId) existingIds.add(ed._agentId)
    } catch { /* ignore */ }
  }

  // Añadir solo los que no existan aún (ni activos ni en la papelera)
  for (const def of PREDEFINED_AGENTS) {
    if (existingIds.has(def.id)) continue
    const node = store.createNode({
      text:     def.label,   // sin el emoji delante — ver createAgentUnder
      parentId: agentesNode.id,
    })
    store.updateNode(node.id, {
      extraData: JSON.stringify({
        _agentDef:            '1',
        _agentId:             def.id,
        _agentIcon:           def.icon,
        _agentSystemPrompt:   def.instruction,
        _agentUserMessage:    deriveAgentTrigger(def.instruction, !!def.conversational),
        // Los predefinidos se siembran DESACTIVADOS: el usuario los activa a
        // propósito desde sus Propiedades (Alberto, 23 jul).
        _agentEnabled:        'false',
        _agentSchedule:       def.schedule ?? '',
        _agentConversational: def.conversational ? '1' : '',
      }),
      isCollapsed: false,
    })

    // La nota central es la instrucción única, como un DOCUMENTO editable normal
    // (sin viñetas de outliner). El horario y el estado se muestran en la columna
    // derecha, no como hijo.
    if (def.instruction) {
      const doc = store.createNode({ text: '', parentId: node.id })
      store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: instructionToHtml(def.instruction) })
    }
  }
}

/**
 * migratePromptifiedAgents — "Investigar un tema" y "Resumen de un enlace" pasaron
 * de agentes a prompts (13 ago 2026: son manuales, sin horario ni conversación —
 * encajan mejor con lo que ya se escribe/pega en el chat). Si el usuario tiene esos
 * agentes predefinidos SIN editar (creados por `ensureAgentesNode`, nunca activados
 * ni tocados), se eliminan del árbol de Agentes — `ensurePromptsNode`/migración de
 * prompts los recrea como prompts reales. Si el usuario los editó o activó, se
 * dejan intactos como agente (es su contenido, no se toca sin más).
 */
export function migratePromptifiedAgents(): void {
  try { if (localStorage.getItem('from_agents_promptify_v1') === '1') return } catch { /* */ }
  const agentesNode = getAgentesNode()
  if (agentesNode) {
    for (const child of store.children(agentesNode.id)) {
      if (child.deletedAt) continue
      try {
        const ed = JSON.parse(child.extraData || '{}')
        if (ed._agentDef !== '1' || !PROMPTIFIED_AGENT_IDS.has(ed._agentId)) continue
        if (ed._agentEnabled === 'true') continue // el usuario lo activó — no tocar
        const def = PREDEFINED_AGENTS_LEGACY_PROMPTIFIED[ed._agentId as string]
        const noteText = readAgentNote(child.id)
        if (def && noteText.trim() !== def.trim()) continue // el usuario lo editó — no tocar
        store.deleteNode(child.id)
      } catch { /* ignore */ }
    }
  }
  try { localStorage.setItem('from_agents_promptify_v1', '1') } catch { /* */ }
}

// Contenido original de los agentes-que-ahora-son-prompts, para detectar edición
// del usuario en `migratePromptifiedAgents` (comparación exacta con la nota).
const PREDEFINED_AGENTS_LEGACY_PROMPTIFIED: Record<string, string> = {
  'investigar-tema': 'Investiga el tema que te indique (escríbelo aquí o pásame enlaces). Consulta las fuentes necesarias con fetch_url y entrega: qué es / por qué importa, los 3-4 puntos clave, datos o cifras relevantes, y una conclusión con próximos pasos. Si te paso enlaces, básate en ellos.',
  'resumen-enlace': 'Pega aquí la URL que quieres resumir. Léela con fetch_url y entrega: resumen en 3 líneas, los puntos clave en bullets, y si procede, acciones o ideas que se desprenden. No inventes nada que no esté en la página.',
}

/**
 * migrateAgentsV3UnifyInstruction — un agente creado ANTES de la instrucción única
 * (13 ago 2026) tiene `_agentSystemPrompt` (persona) y el documento central con SOLO
 * la tarea (`_agentUserMessage` viejo) por separado. La UI ya no muestra el campo
 * "Cómo debe responder" — sin esta migración, esa persona quedaría invisible (aunque
 * seguiría funcionando internamente). Se fusiona UNA vez en el documento central:
 * persona + tarea, en ese orden (igual que se escribieron los predefinidos nuevos).
 */
export function migrateAgentsV3UnifyInstruction(): void {
  try { if (localStorage.getItem('from_agents_v3_unify') === '1') return } catch { /* */ }
  for (const n of Array.from(store.nodes.values())) {
    if (n.deletedAt) continue
    let ed: Record<string, unknown>
    try { ed = JSON.parse(n.extraData || '{}') } catch { continue }
    if (ed._agentDef !== '1') continue
    const persona = String(ed._agentSystemPrompt || '').trim()
    if (!persona) continue
    const currentDoc = readAgentNote(n.id)
    // Ya fusionado (la persona ya forma parte de la nota) → nada que hacer.
    if (currentDoc.startsWith(persona)) continue
    const merged = currentDoc ? `${persona}\n\n${currentDoc}` : persona
    const doc = getOrCreateAgentInstructionDoc(n.id)
    store.updateNode(doc.id, { body: instructionToHtml(merged) })
    syncAgentInstruction(n.id)
  }
  try { localStorage.setItem('from_agents_v3_unify', '1') } catch { /* */ }
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
