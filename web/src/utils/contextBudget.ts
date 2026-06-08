/**
 * contextBudget — estima cuántos tokens de contexto se inyectan en cada turno de
 * Magic para el nodo en el que se trabaja: Perfil IA + contexto del nodo (y el
 * heredado de sus ancestros). Sirve para mostrar el presupuesto en el footer.
 *
 * Estimación aproximada: ~4 caracteres por token (suficiente para una guía).
 */
import { store } from '../store/nodeStore'

function readProfileText(): string {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return ''
  const walk = (nodeId: string, depth: number): string =>
    store.children(nodeId)
      .filter(n => !n.deletedAt && n.text?.trim())
      .map(n => {
        const sub = walk(n.id, depth + 1)
        return `${'  '.repeat(depth)}${n.text}${sub ? '\n' + sub : ''}`
      })
      .join('\n')
  return [perfil.body?.trim() ?? '', walk(perfil.id, 0)].filter(Boolean).join('\n\n')
}

/** Caracteres totales de contexto que se inyectarían para este nodo. */
export function contextChars(currentNodeId: string | undefined): number {
  let chars = readProfileText().length
  if (currentNodeId) {
    const defs = store.tagDefinitionsForNodeChain(currentNodeId)
    for (const body of Object.values(defs)) chars += body.length
  }
  return chars
}

/** Tokens aproximados (chars/4). */
export function estimateContextTokens(currentNodeId: string | undefined): number {
  return Math.round(contextChars(currentNodeId) / 4)
}

/** Etiqueta breve para el footer: "1.2k" / "850". */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return String(tokens)
}
