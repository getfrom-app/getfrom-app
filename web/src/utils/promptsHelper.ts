/**
 * promptsHelper — Sistema de Prompts para Magic
 *
 * Un prompt es un nodo bajo la raíz «⚡ Prompts». Su contenido (las instrucciones
 * que recibe Magic) son sus nodos hijos, que el usuario edita como cualquier nota.
 *
 * Estructura:
 *   ⚡ Prompts                       (nodo raíz de sistema)
 *     ├── Diario del día            extraData._promptDef="1", _promptActivation="diary"
 *     │   ├── Eres mi compañero…    ← contenido del prompt (hijos)
 *     │   └── …
 *     └── Brainstorming             _promptActivation="manual"
 *
 * Propiedades en extraData del nodo prompt:
 *   _promptDef:        "1"          — identifica un nodo prompt
 *   _promptActivation: "manual" | "diary" | "task" | "context:<contextNodeId>"
 *   _promptIcon:       "⚡"          — emoji opcional
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

export const PROMPTS_ROOT_NAME = '⚡ Prompts'

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
  return store.children(null).find(n => !n.deletedAt && n.text === PROMPTS_ROOT_NAME)
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

/** ¿Es este nodo un prompt (hijo directo de la raíz ⚡ Prompts)? */
export function isPromptNode(nodeId: string): boolean {
  const root = getPromptsRoot()
  if (!root) return false
  const node = store.getNode(nodeId)
  return !!node && node.parentId === root.id
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
  const tagsRoot = store.children(null).find(n => !n.deletedAt && (n.text === '🧠 Contexto' || n.text === '🏷 Tags'))
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
  const locale = (typeof localStorage !== 'undefined' && localStorage.getItem('from-lang')?.startsWith('en')) ? 'en-US' : 'es-ES'
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
 * Crea la raíz «⚡ Prompts» con prompts de ejemplo si no existe.
 * Idempotente: solo crea ejemplos cuando la raíz se crea por primera vez.
 */
export function ensurePromptsNode(): void {
  if (_ensureDone) return
  _ensureDone = true

  const existing = getPromptsRoot()
  if (existing) return  // ya existe — no tocar el contenido del usuario

  const root = store.createNode({ text: PROMPTS_ROOT_NAME, parentId: null, siblingOrder: 9996, predefinedId: structuralId('prompts') ?? undefined })

  // Prompt de ejemplo 1 — Diario del día (activación automática en notas diarias)
  const diario = store.createNode({ text: 'Diario del día', parentId: root.id })
  store.updateNode(diario.id, {
    extraData: JSON.stringify({ _promptDef: '1', _promptActivation: 'diary', _promptIcon: '📔' }),
    isCollapsed: false,
  })
  for (const line of [
    'Eres mi compañero de diario. Hoy es {{fecha}}.',
    'Cuando te cuente cómo ha ido mi día, escúchame de verdad: responde con calma, sin juzgar, con frases cortas.',
    'Haz como mucho una pregunta que me ayude a profundizar o a cerrar el día.',
    'No me des listas ni consejos no pedidos. No crees tareas salvo que te lo pida explícitamente.',
    'Al final, si te lo pido, resume el día en 3 líneas: lo bueno, lo aprendido y lo pendiente.',
  ]) store.createNode({ text: line, parentId: diario.id })

  // Prompt de ejemplo 2 — Brainstorming (manual)
  const brainstorm = store.createNode({ text: 'Brainstorming', parentId: root.id })
  store.updateNode(brainstorm.id, {
    extraData: JSON.stringify({ _promptDef: '1', _promptActivation: 'manual', _promptIcon: '💡' }),
    isCollapsed: false,
  })
  for (const line of [
    'Actúa como un facilitador creativo de ideación.',
    'Cuando te dé un tema, genera ideas sin filtrar: convencionales, disruptivas y combinaciones inesperadas.',
    'No critiques ninguna idea en esta fase: solo expande y propone.',
    'Agrupa las ideas por enfoque y termina sugiriendo cuál exploraría yo primero.',
  ]) store.createNode({ text: line, parentId: brainstorm.id })
}
