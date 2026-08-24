/**
 * promptsHelper — Sistema de Prompts para Magic
 *
 * Un prompt es un nodo bajo la raíz «⚡ Prompts» (o colgado de cualquier contexto,
 * v2). Su contenido (el mensaje que se envía al pulsarlo) son sus nodos hijos, que
 * el usuario edita como cualquier nota.
 *
 * Estructura:
 *   ⚡ Prompts                       (nodo raíz de sistema)
 *     ├── Diario del día            extraData._promptDef="1", _promptActivation="diary", _promptGroup="Diario"
 *     │   ├── Eres mi compañero…    ← contenido del prompt (hijos)
 *     │   └── …
 *     └── Brainstorming             _promptActivation="manual", _promptGroup="General"
 *
 * Propiedades en extraData del nodo prompt:
 *   _promptDef:        "1"          — identifica un nodo prompt
 *   _promptActivation: "manual" | "diary" | "task" | "context:<contextNodeId>"
 *   _promptIcon:       "⚡"          — emoji opcional
 *   _promptGroup:      "General"     — carpeta/grupo (13 ago 2026, unificado con
 *                                      iOS): agrupa el desplegable del composer.
 *                                      "" o ausente = sin grupo ("General").
 *
 * Tres modos de activación en Magic (ver MagicChat / aiChatStore):
 *   1. Manual: el usuario lo elige (slash `/` o chip en la cabecera).
 *   2. Contextual: findAutoPromptForNode() lo activa según el nodo abierto.
 *   3. Sugerencia IA: Magic propone el prompt que mejor encaja con el primer mensaje.
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { aiInlineStream, getToken } from '../api/client'
import { structuralId } from './deterministicId'
import { findRootByKey, findContextRoot } from './rootLookup'
import { isInPapelera } from './papeleraHelper'

export const PROMPTS_ROOT_NAME = '⚡ Prompts'

// Carpeta/grupo por defecto — un prompt sin `_promptGroup` cae aquí.
export const DEFAULT_PROMPT_GROUP = 'General'

// ── Tipos de activación ───────────────────────────────────────────────────────

export type PromptActivation =
  | 'manual'
  | 'diary'
  | 'task'
  | `context:${string}`

// ── Variables disponibles ─────────────────────────────────────────────────────

export interface PromptVariable {
  key: string          // p.ej. "{{fecha}}"
  labelEs: string
  labelEn: string
}

export const AVAILABLE_VARIABLES: PromptVariable[] = [
  { key: '{{fecha}}',           labelEs: 'Fecha de hoy',                 labelEn: "Today's date" },
  { key: '{{nombre}}',          labelEs: 'Tu nombre (del perfil)',       labelEn: 'Your name (from profile)' },
  { key: '{{contexto_actual}}', labelEs: 'Contexto del nodo abierto',    labelEn: 'Current node context' },
  { key: '{{notas_hoy}}',       labelEs: 'Notas de la nota de hoy',      labelEn: "Today's note content" },
  { key: '{{perfil}}',          labelEs: 'Resumen de tu perfil',         labelEn: 'Your profile summary' },
]

// ── Raíz ──────────────────────────────────────────────────────────────────────

export function getPromptsRoot(): Node | undefined {
  return findRootByKey('prompts', PROMPTS_ROOT_NAME)
}

export function getOrCreatePromptsRoot(): Node {
  return getPromptsRoot() ?? store.createNode({ text: PROMPTS_ROOT_NAME, parentId: null, siblingOrder: 9996, predefinedId: structuralId('prompts') ?? undefined })
}

// ── Listado ───────────────────────────────────────────────────────────────────

/** Devuelve los nodos prompt (hijos directos de ⚡ Prompts, excluidos nodos 🧠). */
export function listPrompts(): Node[] {
  const root = getPromptsRoot()
  if (!root) return []
  return store.children(root.id).filter(n => !n.deletedAt && !(n.text || '').startsWith('🧠'))
}

/**
 * ¿Es este nodo un prompt? SIN mirar el padre (v2: «contexto padre libre» — un
 * prompt puede colgar de cualquier contexto/nota, no solo de la raíz ⚡ Prompts).
 * Mismo patrón que isAgentNode en agentesHelper.ts.
 */
export function isPromptNode(n: Node | null | undefined): boolean {
  if (!n) return false
  try { return JSON.parse(n.extraData || '{}')._promptDef === '1' } catch { return false }
}

/**
 * createPromptUnder — crea un prompt colgado de CUALQUIER contexto/nota (v2:
 * «contexto padre libre»). A diferencia de PromptListPanel.createPrompt (v1,
 * siempre bajo el root único ⚡ Prompts), aquí `parentId` es el contexto activo —
 * mismo patrón que createAgentUnder en agentesHelper.ts. El modelo de datos del
 * prompt (extraData) es IDÉNTICO al de v1: solo cambia DÓNDE cuelga en el árbol.
 */
export function createPromptUnder(opts: {
  parentId: string | null
  label: string
  icon?: string
  activation?: PromptActivation
  /** Carpeta/grupo para el desplegable del composer (13 ago 2026). '' o ausente
   *  = DEFAULT_PROMPT_GROUP ("General"). */
  group?: string
  /** Contenido inicial (una línea por hijo, outliner) — lo usa create_prompt cuando
   *  la IA redacta el prompt a partir de lo que pide el usuario en el chat. */
  content?: string
  /** ID determinista (structuralId) para prompts "de fábrica"/migrados — así dos
   *  clientes que crean "el mismo" prompt sin haberse sincronizado aún convergen en
   *  el mismo nodo en vez de duplicarlo (Alberto, 13 ago: "los prompts se duplican
   *  mucho"). Ausente = id aleatorio, para prompts que crea el usuario a mano. */
  predefinedId?: string
}): Node {
  const icon = opts.icon || '⚡'
  const node = store.createNode({ text: opts.label.trim(), parentId: opts.parentId, predefinedId: opts.predefinedId })
  store.updateNode(node.id, {
    extraData: JSON.stringify({
      _promptDef:        '1',
      _promptIcon:       icon,
      _promptActivation: opts.activation || 'manual',
      _promptGroup:      (opts.group || '').trim(),
    }),
    isCollapsed: false,
  })
  const lines = (opts.content || '').split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length > 0) {
    for (const line of lines) store.createNode({ text: line, parentId: node.id })
  } else {
    // Semilla: un hijo vacío para que el usuario empiece a escribir el contenido
    // (mismo patrón que PromptListPanel.createPrompt / createAgentUnder).
    store.createNode({ text: '', parentId: node.id })
  }
  return store.getNode(node.id)!
}

/**
 * listAllPrompts — escanea TODO el árbol activo buscando nodos prompt (v2: para
 * el desplegable del chat, que debe ver prompts de CUALQUIER contexto, no solo
 * los que cuelgan del root). NO reemplaza listPrompts() (v1 sigue usándola tal
 * cual para el root único).
 * Excluye la Papelera: en Fromly un nodo eliminado se REPARENTA bajo 🗑 Papelera
 * en vez de marcarse `deletedAt` (ver papeleraHelper.ts) — sigue siendo "activo"
 * a efectos de `store.allActive()`. Sin este filtro, prompts ya borrados por el
 * usuario reaparecían en el desplegable del chat (Alberto, 15 jul: 5 copias de
 * "Diario del día" y "Brainstorming" — los duplicados de ejemplo creados por una
 * carrera antigua en `ensurePromptsNode`, ya eliminados, pero nunca desaparecían
 * de esta lista).
 */
export function listAllPrompts(): Node[] {
  return store.allActive().filter(n => isPromptNode(n) && !isInPapelera(n.id))
}

// ── Contenido del prompt (sus hijos) ──────────────────────────────────────────

/**
 * Concatena los nodos hijos de un prompt en texto plano (con indentación),
 * que se inyecta a Magic como instrucción de sistema.
 */
export function getPromptInstructions(promptNodeId: string): string {
  function readChildren(nodeId: string, depth: number): string {
    return store.children(nodeId)
      .filter(n => !n.deletedAt && n.text?.trim() && !(n.text || '').startsWith('🧠'))
      .map(n => {
        const indent = '  '.repeat(depth)
        const sub = readChildren(n.id, depth + 1)
        return `${indent}${n.text}${sub ? '\n' + sub : ''}`
      })
      .join('\n')
  }
  return readChildren(promptNodeId, 0).trim()
}

// ── Activación (extraData) ────────────────────────────────────────────────────

export function getPromptActivation(promptNodeId: string): PromptActivation {
  const n = store.getNode(promptNodeId)
  if (!n) return 'manual'
  try {
    const ed = JSON.parse(n.extraData || '{}')
    return (ed._promptActivation as PromptActivation) || 'manual'
  } catch { return 'manual' }
}

export function setPromptActivation(promptNodeId: string, activation: PromptActivation): void {
  const n = store.getNode(promptNodeId)
  if (!n) return
  try {
    const ed = JSON.parse(n.extraData || '{}')
    ed._promptDef = '1'
    ed._promptActivation = activation
    store.updateNode(promptNodeId, { extraData: JSON.stringify(ed) })
  } catch { /* ignore */ }
}

export function getPromptGroup(promptNodeId: string): string {
  const n = store.getNode(promptNodeId)
  if (!n) return DEFAULT_PROMPT_GROUP
  try {
    const ed = JSON.parse(n.extraData || '{}')
    const g = (ed._promptGroup as string | undefined)?.trim()
    return g || DEFAULT_PROMPT_GROUP
  } catch { return DEFAULT_PROMPT_GROUP }
}

export function setPromptGroup(promptNodeId: string, group: string): void {
  const n = store.getNode(promptNodeId)
  if (!n) return
  try {
    const ed = JSON.parse(n.extraData || '{}')
    ed._promptGroup = group.trim()
    store.updateNode(promptNodeId, { extraData: JSON.stringify(ed) })
  } catch { /* ignore */ }
}

/** Nombres de grupo ya usados por algún prompt (para autocompletar al crear uno
 *  nuevo), orden alfabético con DEFAULT_PROMPT_GROUP siempre primero si existe. */
export function listPromptGroups(): string[] {
  const set = new Set<string>()
  for (const p of listAllPrompts()) set.add(getPromptGroup(p.id))
  const rest = [...set].filter(g => g !== DEFAULT_PROMPT_GROUP).sort((a, b) => a.localeCompare(b))
  return set.has(DEFAULT_PROMPT_GROUP) ? [DEFAULT_PROMPT_GROUP, ...rest] : rest
}

/** listAllPromptsGrouped — mismos prompts que listAllPrompts(), organizados por
 *  `_promptGroup` para el desplegable del composer (13 ago 2026). Grupos en
 *  orden alfabético (DEFAULT_PROMPT_GROUP último, es el "cajón sin clasificar"),
 *  prompts dentro de cada grupo por título. */
export function listAllPromptsGrouped(): { group: string; prompts: Node[] }[] {
  const byGroup = new Map<string, Node[]>()
  for (const p of listAllPrompts()) {
    const g = getPromptGroup(p.id)
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g)!.push(p)
  }
  for (const list of byGroup.values()) list.sort((a, b) => (a.text || '').localeCompare(b.text || ''))
  const groups = [...byGroup.keys()].sort((a, b) => {
    if (a === DEFAULT_PROMPT_GROUP) return 1
    if (b === DEFAULT_PROMPT_GROUP) return -1
    return a.localeCompare(b)
  })
  return groups.map(group => ({ group, prompts: byGroup.get(group)! }))
}

/** Marca un nodo como prompt (al crearlo manualmente bajo la raíz). */
export function ensurePromptDef(promptNodeId: string): void {
  const n = store.getNode(promptNodeId)
  if (!n) return
  try {
    const ed = JSON.parse(n.extraData || '{}')
    if (ed._promptDef === '1') return
    ed._promptDef = '1'
    if (!ed._promptActivation) ed._promptActivation = 'manual'
    store.updateNode(promptNodeId, { extraData: JSON.stringify(ed) })
  } catch { /* ignore */ }
}

// ── Activación contextual ─────────────────────────────────────────────────────

/** ¿El nodo es una entrada de diario o desciende de una? */
function isDiaryContext(nodeId: string): boolean {
  let cur: Node | undefined = store.getNode(nodeId) ?? undefined
  let depth = 0
  while (cur && depth < 8) {
    if (cur.isDiaryEntry) return true
    if (!cur.parentId) return false
    cur = store.getNode(cur.parentId) ?? undefined
    depth++
  }
  return false
}

/** IDs de contexto (hijos directos de 🧠 Contexto) que aplican a un nodo. */
function contextIdsForNode(nodeId: string): Set<string> {
  const ids = new Set<string>()
  const node = store.getNode(nodeId)
  if (!node) return ids
  const tagsRoot = findContextRoot()
  if (!tagsRoot) return ids
  const contexts = store.children(tagsRoot.id).filter(n => !n.deletedAt)
  const types = (node.types || []).map(t => t.toLowerCase())
  for (const c of contexts) {
    const name = (c.text || '').toLowerCase()
    if (name && types.includes(name)) ids.add(c.id)
  }
  return ids
}

/**
 * Dado el nodo abierto en Magic, devuelve el prompt cuya activación contextual
 * coincide (diario / tarea / contexto). Devuelve null si no hay coincidencia.
 * Prioridad: contexto específico > diario > tarea.
 */
export function findAutoPromptForNode(currentNodeId: string | undefined): Node | null {
  if (!currentNodeId) return null
  const prompts = listPrompts()
  if (prompts.length === 0) return null

  const node = store.getNode(currentNodeId)
  if (!node) return null

  const ctxIds = contextIdsForNode(currentNodeId)
  const isDiary = isDiaryContext(currentNodeId)
  const isTask = node.status !== null && node.status !== undefined

  // 1. Contexto específico
  for (const p of prompts) {
    const act = getPromptActivation(p.id)
    if (act.startsWith('context:')) {
      const ctxId = act.slice('context:'.length)
      if (ctxIds.has(ctxId)) return p
    }
  }
  // 2. Diario
  if (isDiary) {
    const p = prompts.find(p => getPromptActivation(p.id) === 'diary')
    if (p) return p
  }
  // 3. Tarea
  if (isTask) {
    const p = prompts.find(p => getPromptActivation(p.id) === 'task')
    if (p) return p
  }
  return null
}

// ── Sustitución de variables ──────────────────────────────────────────────────

export interface VariableContext {
  currentNodeId?: string
}

function profileText(): string {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return ''
  const parts: string[] = []
  if (perfil.body?.trim()) parts.push(perfil.body.trim())
  function readChildren(nodeId: string): string {
    return store.children(nodeId)
      .filter(n => !n.deletedAt && n.text?.trim())
      .map(n => {
        const sub = readChildren(n.id)
        return `${n.text}${sub ? '\n' + sub : ''}`
      }).join('\n')
  }
  const kids = readChildren(perfil.id)
  if (kids) parts.push(kids)
  return parts.join('\n').trim()
}

function profileName(): string {
  const text = profileText()
  const m = text.match(/nombre\s*:?\s*(.+)/i)
  return m ? m[1].split('\n')[0].trim() : ''
}

function todayNotesText(): string {
  // Buscar la nota diaria de hoy
  const today = store.todayDiary?.() ?? null
  if (!today) return ''
  function readChildren(nodeId: string, depth: number): string {
    return store.children(nodeId)
      .filter(n => !n.deletedAt && n.text?.trim() && !(n.text || '').startsWith('✦') && !(n.text || '').startsWith('💬'))
      .map(n => {
        const indent = '  '.repeat(depth)
        const sub = readChildren(n.id, depth + 1)
        return `${indent}- ${n.text}${sub ? '\n' + sub : ''}`
      }).join('\n')
  }
  return readChildren(today.id, 0).trim()
}

function currentContextName(currentNodeId?: string): string {
  if (!currentNodeId) return ''
  const ids = contextIdsForNode(currentNodeId)
  const names: string[] = []
  for (const id of ids) {
    const n = store.getNode(id)
    if (n?.text) names.push(n.text)
  }
  return names.join(', ')
}

/**
 * Reemplaza las variables {{…}} de un prompt por sus valores reales.
 * Las variables sin valor se eliminan limpiamente.
 */
export function substituteVariables(text: string, ctx: VariableContext = {}): string {
  if (!text.includes('{{')) return text
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('fromly-lang'))
    || (typeof navigator !== 'undefined' && navigator.language) || 'en'
  const locale = lang.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US'
  const fecha = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const values: Record<string, string> = {
    '{{fecha}}':           fecha,
    '{{nombre}}':          profileName(),
    '{{contexto_actual}}': currentContextName(ctx.currentNodeId),
    '{{notas_hoy}}':       todayNotesText(),
    '{{perfil}}':          profileText(),
  }
  let out = text
  for (const [key, val] of Object.entries(values)) {
    out = out.split(key).join(val)
  }
  return out
}

/** Instrucciones finales de un prompt: contenido + variables sustituidas. */
export function resolvePrompt(promptNodeId: string, ctx: VariableContext = {}): string {
  return substituteVariables(getPromptInstructions(promptNodeId), ctx)
}

// ── Sugerencia por IA (modo 3) ────────────────────────────────────────────────

/**
 * Dado el texto que escribe el usuario, pregunta a la IA (micro-op gratuita Haiku)
 * cuál de los prompts disponibles encaja mejor. Devuelve el id del prompt o null.
 * No consume tokens del usuario (systemBudget). Cancelable con signal.
 */
export async function suggestPromptForText(text: string, signal?: AbortSignal): Promise<string | null> {
  if (!getToken()) return null
  const prompts = listPrompts()
  if (prompts.length === 0) return null
  const names = prompts.map(p => (p.text || '').trim()).filter(Boolean)
  if (names.length === 0) return null

  const system = `Eres un clasificador silencioso. El usuario tiene estos "prompts" (modos de conversación) en su app de notas:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Dado el mensaje del usuario, decide si encaja CLARAMENTE con alguno de esos prompts.
Responde SOLO con el nombre EXACTO del prompt que mejor encaje, o exactamente "NONE" si ninguno encaja con claridad.
Sin comillas, sin explicaciones, sin puntuación extra. Ante la duda, responde NONE.`

  let out = ''
  try {
    out = await aiInlineStream(text, undefined, undefined, { systemBudget: true, systemOverride: system, signal })
  } catch { return null }

  const ans = out.trim().toLowerCase().replace(/^["'`.\s]+|["'`.\s]+$/g, '')
  if (!ans || ans === 'none' || ans.includes('none')) return null
  const match = prompts.find(p => (p.text || '').trim().toLowerCase() === ans)
    ?? prompts.find(p => {
      const name = (p.text || '').trim().toLowerCase()
      return name.length > 0 && (ans.includes(name) || name.includes(ans))
    })
  return match ? match.id : null
}

// ── Inicialización ────────────────────────────────────────────────────────────

let _ensureDone = false

/**
 * Crea la raíz «⚡ Prompts», vacía. Antes sembraba ejemplos de "elaboración"
 * (Diario del día, Brainstorming, Resumen ejecutivo, Próximos pasos) — Fromly
 * app es para cosas rápidas, no para elaboraciones largas (eso es lo que
 * ofrece la web, Alberto 24 ago 2026): la lista de Prompts en la app es solo
 * Rápidos, sin categoría "General". Idempotente: no toca nada si la raíz ya
 * existe.
 */
export function ensurePromptsNode(): void {
  if (_ensureDone) return
  _ensureDone = true

  const existing = getPromptsRoot()
  if (existing) return  // ya existe — no tocar el contenido del usuario

  store.createNode({ text: PROMPTS_ROOT_NAME, parentId: null, siblingOrder: 9996, predefinedId: structuralId('prompts') ?? undefined })
}

/**
 * migratePromptifiedAgentPrompts — hasta el 24 ago 2026 sembraba "Investigar un
 * tema" y "Resumen de un enlace" (elaboración larga, encajaban en Prompts tras
 * dejar de ser agentes). Se retira: la app es solo para Rápidos, sin categoría
 * de elaboración (Alberto: "para eso está la web"). No-op, se conserva con el
 * mismo flag por si algún día hay algo más que migrar en su lugar.
 */
export function migratePromptifiedAgentPrompts(): void {
  try { if (localStorage.getItem('from_prompts_promptify_v1') === '1') return } catch { /* */ }
  try { localStorage.setItem('from_prompts_promptify_v1', '1') } catch { /* */ }
}

/**
 * mergeDuplicatePrompts — limpia los duplicados YA creados por la carrera que
 * arreglan los `predefinedId` de arriba (dos dispositivos que crearon "el mismo"
 * prompt de fábrica/migrado antes de sincronizarse) — Alberto, 13 ago: "los
 * prompts se duplican mucho". Agrupa por (padre, texto normalizado) entre nodos
 * `_promptDef`, se queda con el que tenga más contenido (o el más antiguo si
 * empatan) y reparenta+borra el resto. Mismo patrón que mergeDuplicateDiaries
 * (nodeStore.ts) — corre en cada arranque, sin flag: no hace nada si no hay
 * duplicados.
 */
export function mergeDuplicatePrompts(): number {
  const groups = new Map<string, Node[]>()
  for (const n of store.nodes.values()) {
    if (n.deletedAt || !isPromptNode(n)) continue
    const key = `${n.parentId ?? 'root'}|${(n.text || '').trim().toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }
  let merged = 0
  for (const [, dups] of groups) {
    if (dups.length < 2) continue
    dups.sort((a, b) => {
      const ca = store.children(a.id).length
      const cb = store.children(b.id).length
      if (cb !== ca) return cb - ca
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    })
    const canonical = dups[0]
    for (const dup of dups.slice(1)) {
      for (const child of store.children(dup.id).filter(c => !c.deletedAt)) {
        store.updateNode(child.id, { parentId: canonical.id })
      }
      store.deleteNode(dup.id)
      merged++
    }
  }
  return merged
}
