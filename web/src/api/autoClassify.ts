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

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ClassifyResult {
  contextId: string | null
  confidence: number
}

export interface ContextInfo {
  id: string
  name: string
  description?: string
  /** Muestra de textos de nodos hijos del contexto (máx 50) para dar señales reales a la IA */
  samples?: string[]
}

export interface ContextKnowledge {
  keywords: string[]
  people: string[]
  topics: string[]
}

export interface ClassifyExample {
  text: string
  contextId: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const EXAMPLES_KEY = 'from_ctx_examples'
const MAX_EXAMPLES = 25
/** Confidence mínima para mostrar el badge en color del contexto (vs gris) */
export const CONFIDENCE_THRESHOLD = 0.6

// ── Caché en memoria (nodeId → ClassifyResult) ───────────────────────────────
// Persiste durante la sesión. Se invalida si el nodo recibe contexto manual.

const cache = new Map<string, ClassifyResult>()

export function getCachedClassify(nodeId: string): ClassifyResult | undefined {
  return cache.get(nodeId)
}

export function setCachedClassify(nodeId: string, result: ClassifyResult) {
  cache.set(nodeId, result)
}

export function clearCachedClassify(nodeId: string) {
  cache.delete(nodeId)
}

// ── Ejemplos few-shot en localStorage ────────────────────────────────────────

export function loadExamples(): ClassifyExample[] {
  try {
    const raw = localStorage.getItem(EXAMPLES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveExample(text: string, contextId: string) {
  const examples = loadExamples()
  // Evitar duplicados exactos
  const exists = examples.some(e => e.text === text && e.contextId === contextId)
  if (exists) return
  examples.push({ text, contextId })
  // Mantener solo los últimos MAX_EXAMPLES
  if (examples.length > MAX_EXAMPLES) examples.splice(0, examples.length - MAX_EXAMPLES)
  try {
    localStorage.setItem(EXAMPLES_KEY, JSON.stringify(examples))
  } catch { /* ignore */ }
}

// ── Timers de debounce por nodo ───────────────────────────────────────────────

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Cancela la clasificación pendiente de un nodo (p.ej. si se asignó contexto manual) */
export function cancelClassify(nodeId: string) {
  const timer = pendingTimers.get(nodeId)
  if (timer) { clearTimeout(timer); pendingTimers.delete(nodeId) }
  clearCachedClassify(nodeId)
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Clasifica un nodo tras un delay de 800ms.
 * Si ya hay una llamada pendiente para el mismo nodo, la cancela y reinicia.
 *
 * @param nodeId   — ID del nodo a clasificar
 * @param text     — Texto actual del nodo
 * @param contexts — Lista de contextos disponibles del usuario
 * @param onResult — Callback cuando llega el resultado (para forzar re-render)
 */
export function scheduleClassify(
  nodeId: string,
  text: string,
  contexts: ContextInfo[],
  onResult: (nodeId: string, result: ClassifyResult) => void,
  delayMs = 800,
) {
  // Cancelar timer previo si existe
  const prev = pendingTimers.get(nodeId)
  if (prev) clearTimeout(prev)

  // No clasificar si no hay texto o no hay contextos
  if (!text.trim() || contexts.length === 0) {
    clearCachedClassify(nodeId)
    return
  }

  const timer = setTimeout(async () => {
    pendingTimers.delete(nodeId)
    try {
      const examples = loadExamples()
      const result = await classifyNode(text, contexts, examples)
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
): Promise<ClassifyResult> {
  const data = await apiRequest<ClassifyResult>('/ai/classify-context', {
    method: 'POST',
    body: JSON.stringify({ nodeText, contexts, examples }),
  })
  return data
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

