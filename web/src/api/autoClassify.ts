/**
 * autoClassify — Servicio de auto-clasificación de nodos en contextos.
 *
 * Flujo:
 * 1. Al crear un nodo sin contexto asignado manualmente, se dispara un timer de 1s.
 * 2. Se llama a /ai/classify-context con el texto del nodo + lista de contextos del usuario.
 * 3. El resultado (contextId + confidence) se almacena en memoria (Map) para mostrarlo en el badge.
 * 4. Si el usuario corrige el badge, la corrección se guarda como ejemplo few-shot en localStorage.
 * 5. Máximo 25 ejemplos guardados por usuario (FIFO).
 */

import { apiRequest } from './client'
import { store } from '../store/nodeStore'
import { TAGS_ROOT_NAME } from '../utils/tagsHelper'
import { learningsStore } from '../store/learningsStore'
import { getProfileContainer } from './userKnowledge'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ClassifyResult {
  contextId: string | null
  confidence: number
  /** Nombre sugerido para un subcontexto nuevo cuando la nota no encaja en ninguno existente (Fase 3). */
  suggestedName?: string | null
  /** ID del contexto padre bajo el que crear el subcontexto sugerido (null = nivel superior). */
  suggestedParentId?: string | null
}

export interface ContextInfo {
  id: string
  name: string
  description?: string
  /** ID del contexto padre (null = contexto de nivel superior). Permite que la IA prefiera el subcontexto más específico. */
  parentId?: string | null
  /** Muestra de textos de nodos hijos del contexto (máx 200) para dar señales reales a la IA */
  samples?: string[]
}

export interface ContextKnowledge {
  /** Resumen breve que infiere de qué va el contexto (lo «inteligente» de Magic). */
  summary?: string
  keywords: string[]
  people: string[]
  topics: string[]
}

export interface ClassifyExample {
  text: string
  contextId: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const EXAMPLES_KEY = 'from_ctx_examples'            // legacy — solo migración
const EXAMPLES_MIGRATED_KEY = 'from_ctx_examples_migrated'
const EXAMPLES_SECTION = '🧠 Ejemplos de contexto'
const MAX_EXAMPLES = 25
/** Confidence mínima para mostrar el badge en color del contexto (vs gris) */
export const CONFIDENCE_THRESHOLD = 0.6

// ── Construcción de la lista de contextos (incl. subcontextos) ────────────────

/**
 * Recorre el árbol completo de contextos del usuario y devuelve la lista plana
 * de ContextInfo, incluyendo subcontextos con su `parentId`. Los nodos de
 * conocimiento (texto que empieza por 🧠) se excluyen como destinos pero su texto
 * sí alimenta los `samples` del contexto al que pertenecen.
 *
 * @param excludeId — id del nodo de perfil IA u otro que no deba ser destino.
 */
export function buildClassifyContexts(excludeId?: string | null): ContextInfo[] {
  const tagsRoot = store.children(null).find(n => !n.deletedAt && (n.text === TAGS_ROOT_NAME || n.text === '🏷 Tags'))
  if (!tagsRoot) return []
  const out: ContextInfo[] = []
  // Cola de [contextNodeId, parentContextId|null]
  const queue: Array<[string, string | null]> = store
    .children(tagsRoot.id)
    .filter(n => !n.deletedAt && !(n.text || '').startsWith('🧠'))
    .map(n => [n.id, null] as [string, string | null])
  while (queue.length > 0) {
    const [id, parentId] = queue.shift()!
    const node = store.getNode(id)
    if (!node || node.deletedAt) continue
    if (excludeId && id === excludeId) continue
    out.push({
      id,
      name: node.text || '',
      parentId,
      samples: store.children(id)
        .filter(c => !c.deletedAt && (c.text || '').trim().length > 2)
        .slice(0, 200)
        .map(c => (c.text || '').trim()),
    })
    // Encolar subcontextos (hijos que no son nodos de conocimiento 🧠)
    store.children(id)
      .filter(c => !c.deletedAt && !(c.text || '').startsWith('🧠'))
      .forEach(c => queue.push([c.id, id]))
  }
  return out
}

// ── Caché en memoria (nodeId → ClassifyResult) ───────────────────────────────
// Persiste durante la sesión. Se invalida si el nodo recibe contexto manual.

const cache = new Map<string, ClassifyResult>()
// Texto exacto con el que se clasificó cada nodo por última vez. Si el texto no
// cambia, no reclasificamos (evita llamadas redundantes en re-renders o al
// editar y revertir). Reduce el volumen real contra el servidor.
const lastClassifiedText = new Map<string, string>()

export function getCachedClassify(nodeId: string): ClassifyResult | undefined {
  return cache.get(nodeId)
}

export function setCachedClassify(nodeId: string, result: ClassifyResult) {
  cache.set(nodeId, result)
}

export function clearCachedClassify(nodeId: string) {
  cache.delete(nodeId)
  lastClassifiedText.delete(nodeId)
}

// ── Ejemplos few-shot (respaldados en nodos → sincronizan por cuenta) ─────────
// Cada ejemplo es un nodo hijo de "🧠 Ejemplos de contexto" bajo el perfil.
// text = texto del ejemplo, extraData = { _ctxExample:'1', ctxId }.

interface ExampleMeta { _ctxExample: '1'; ctxId: string }

function parseExample(node: { text?: string | null; extraData?: string | null }): ClassifyExample | null {
  let meta: Partial<ExampleMeta> = {}
  try { meta = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  if (meta._ctxExample !== '1' || !meta.ctxId) return null
  const text = (node.text || '').trim()
  if (!text) return null
  return { text, contextId: meta.ctxId }
}

/** Migración única desde localStorage → nodos. */
function migrateExamples() {
  try {
    if (localStorage.getItem(EXAMPLES_MIGRATED_KEY)) return
    const legacy: ClassifyExample[] = JSON.parse(localStorage.getItem(EXAMPLES_KEY) || '[]')
    if (!Array.isArray(legacy) || legacy.length === 0) { localStorage.setItem(EXAMPLES_MIGRATED_KEY, '1'); return }
    const container = getProfileContainer(EXAMPLES_SECTION)
    if (!container) return // reintenta en próxima carga
    const existing = store.children(container.id).filter(n => !n.deletedAt).map(parseExample).filter(Boolean) as ClassifyExample[]
    let order = 1000
    for (const ex of legacy) {
      if (!ex.text?.trim() || !ex.contextId) continue
      if (existing.some(e => e.text === ex.text && e.contextId === ex.contextId)) continue
      store.createNode({ text: ex.text.trim(), parentId: container.id, siblingOrder: order, extraData: { _ctxExample: '1', ctxId: ex.contextId } })
      order += 1000
    }
    localStorage.setItem(EXAMPLES_MIGRATED_KEY, '1')
    localStorage.removeItem(EXAMPLES_KEY)
  } catch { /* reintenta en próxima carga */ }
}

export function loadExamples(): ClassifyExample[] {
  migrateExamples()
  const container = getProfileContainer(EXAMPLES_SECTION, false)
  if (!container) return []
  return store.children(container.id)
    .filter(n => !n.deletedAt)
    .map(parseExample)
    .filter((e): e is ClassifyExample => e !== null)
}

export function saveExample(text: string, contextId: string) {
  const clean = text.trim()
  if (!clean || !contextId) return
  const container = getProfileContainer(EXAMPLES_SECTION)
  if (!container) return
  const nodes = store.children(container.id).filter(n => !n.deletedAt)
  // Evitar duplicados exactos
  if (nodes.some(n => (n.text || '').trim() === clean && parseExample(n)?.contextId === contextId)) return
  const maxOrder = nodes.length > 0 ? Math.max(...nodes.map(c => c.siblingOrder)) : 0
  store.createNode({ text: clean, parentId: container.id, siblingOrder: maxOrder + 1000, extraData: { _ctxExample: '1', ctxId: contextId } })
  // Mantener solo los últimos MAX_EXAMPLES (borrar los más antiguos por orden)
  const after = store.children(container.id).filter(n => !n.deletedAt).sort((a, b) => a.siblingOrder - b.siblingOrder)
  if (after.length > MAX_EXAMPLES) {
    after.slice(0, after.length - MAX_EXAMPLES).forEach(n => store.deleteNode(n.id))
  }
}

// ── Timers de debounce por nodo ───────────────────────────────────────────────

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Cancela la clasificación pendiente de un nodo (p.ej. si se asignó contexto manual) */
export function cancelClassify(nodeId: string) {
  const timer = pendingTimers.get(nodeId)
  if (timer) { clearTimeout(timer); pendingTimers.delete(nodeId) }
  clearCachedClassify(nodeId)
  lastClassifiedText.delete(nodeId)
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Clasifica un nodo tras un delay de 800ms.
 * Si ya hay una llamada pendiente para el mismo nodo, la cancela y reinicia.
 *
 * @param nodeId     — ID del nodo a clasificar
 * @param text       — Texto actual del nodo
 * @param contexts   — Lista de contextos disponibles del usuario
 * @param onResult   — Callback cuando llega el resultado (para forzar re-render)
 * @param userProfile — Líneas de contenido del perfil IA del usuario (opcional, siempre presente)
 */
export function scheduleClassify(
  nodeId: string,
  text: string,
  contexts: ContextInfo[],
  onResult: (nodeId: string, result: ClassifyResult) => void,
  delayMs = 800,
  userProfile?: string[],
) {
  // Cancelar timer previo si existe
  const prev = pendingTimers.get(nodeId)
  if (prev) clearTimeout(prev)

  // No clasificar si no hay texto o no hay contextos
  if (!text.trim() || contexts.length === 0) {
    clearCachedClassify(nodeId)
    return
  }

  // Si el texto no ha cambiado desde la última clasificación, no repetir la
  // llamada: el resultado en caché (si lo hay) sigue siendo válido.
  if (lastClassifiedText.get(nodeId) === text.trim()) return

  const timer = setTimeout(async () => {
    pendingTimers.delete(nodeId)
    try {
      const examples = loadExamples()
      const result = await classifyNode(text, contexts, examples, userProfile)
      lastClassifiedText.set(nodeId, text.trim())
      setCachedClassify(nodeId, result)
      onResult(nodeId, result)
    } catch {
      // Silenciar errores de clasificación — no interrumpen el flujo
    }
  }, delayMs)

  pendingTimers.set(nodeId, timer)
}

// ── Llamada al servidor ───────────────────────────────────────────────────────

async function classifyNode(
  nodeText: string,
  contexts: ContextInfo[],
  examples: ClassifyExample[],
  userProfile?: string[],
): Promise<ClassifyResult> {
  const data = await apiRequest<ClassifyResult>('/ai/classify-context', {
    method: 'POST',
    body: JSON.stringify({ nodeText, contexts, examples, userProfile, learnings: learningsStore.buildPromptBlock() ?? undefined }),
  })
  return data
}

/**
 * Extrae un dato relevante sobre el usuario a partir del texto de un nodo.
 * Si detecta algo nuevo (persona, relación, dato personal), devuelve una frase corta.
 * Si no detecta nada nuevo o el texto es trivial, devuelve null.
 */
export interface UserKnowledge {
  people: string[]
  facts: string[]
  // Items del perfil actual que este mensaje deja OBSOLETOS (un dato cambió/se
  // contradice). El guardado los reemplaza en vez de acumular versiones contradictorias.
  obsolete?: string[]
}

export async function extractUserKnowledge(
  nodeText: string,
  existingProfile?: string,
  contextName?: string | null,
  today?: string,
): Promise<UserKnowledge | null> {
  const data = await apiRequest<UserKnowledge>('/ai/extract-user-knowledge', {
    method: 'POST',
    body: JSON.stringify({ nodeText, existingProfile, contextName: contextName ?? undefined, today }),
  })
  if (!data.people?.length && !data.facts?.length && !data.obsolete?.length) return null
  return { people: data.people ?? [], facts: data.facts ?? [], obsolete: data.obsolete ?? [] }
}

/**
 * Curador del perfil: envía las listas actuales de personas/hechos y recibe una
 * versión compactada (deduplicada, sin obsoletos, esencial). Ante cualquier fallo
 * el servidor devuelve las listas intactas, así que es seguro llamarlo.
 */
export async function compactKnowledge(
  people: string[],
  facts: string[],
): Promise<UserKnowledge> {
  const data = await apiRequest<UserKnowledge>('/ai/compact-knowledge', {
    method: 'POST',
    body: JSON.stringify({ people, facts }),
  })
  return { people: data.people ?? people, facts: data.facts ?? facts }
}

/**
 * Extrae conocimiento estructurado de los nodos de un contexto.
 * Devuelve palabras clave, personas y temas frecuentes.
 */
export async function extractContextKnowledge(
  contextName: string,
  contextDescription: string,
  nodeSamples: string[],
): Promise<ContextKnowledge> {
  const data = await apiRequest<ContextKnowledge>('/ai/extract-context-knowledge', {
    method: 'POST',
    body: JSON.stringify({ contextName, contextDescription, nodeSamples }),
  })
  return data
}

