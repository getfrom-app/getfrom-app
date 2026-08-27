// contextPublish — publicar un CONTEXTO entero (su nota + sus elementos) con
// URL propia, igual mecanismo que utils/groups.ts pero el estado de
// publicación (`publicSlug`/`_pubProtected`/`_pubDescription`) se guarda en el
// nodo del CONTEXTO, no en un grupo con miembros manuales — los elementos se
// resuelven en vivo server-side por `_ctxRefs` (ver server/src/routes/contexts.ts).
// 28 ago 2026, Alberto: "vamos a añadir la posibilidad de publicar un
// contexto entero, igual que un grupo, en una página que tendrá una url y
// una contraseña opcional".
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { publishContext, unpublishContext } from '../api/client'

function ed(n: Node | null | undefined): Record<string, unknown> {
  if (!n) return {}
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

function identifierOf(node: Node): string | undefined {
  const raw = node.publicSlug || undefined
  if (!raw) return undefined
  const parts = raw.split('/')
  return parts[parts.length - 1] || undefined
}

/** Mismo criterio que `publishGroupPublicly`: `password`/`description`
 *  undefined no los toca, null/'' los quita, string no vacío los (re)establece. */
export async function publishContextPublicly(contextNode: Node, customSlug?: string, password?: string | null, description?: string | null): Promise<string> {
  const existingSlug = identifierOf(contextNode)
  const result = await publishContext(contextNode.id, existingSlug, customSlug, password, description)
  const url = `https://fromly.app/c/${result.slug}`
  const e = ed(contextNode)
  const updates: Partial<Node> = {}
  if (contextNode.publicSlug !== result.slug) updates.publicSlug = result.slug
  if (password !== undefined) {
    if (password && password.trim()) e._pubProtected = '1'
    else delete e._pubProtected
  }
  if (description !== undefined) {
    if (description && description.trim()) e._pubDescription = description.trim()
    else delete e._pubDescription
  }
  if (password !== undefined || description !== undefined) updates.extraData = JSON.stringify(e)
  if (Object.keys(updates).length) store.updateNode(contextNode.id, updates)
  return url
}

export async function unpublishContextPublicly(contextNode: Node): Promise<void> {
  const identifier = identifierOf(contextNode)
  if (!identifier) return
  await unpublishContext(identifier)
  const e = ed(contextNode)
  delete e._pubProtected
  store.updateNode(contextNode.id, { publicSlug: null, extraData: JSON.stringify(e) })
}
