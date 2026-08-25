/**
 * Grupos — agrupar VARIOS elementos existentes (notas, imágenes, PDFs, mezcla)
 * bajo un nodo nuevo con su propio enlace público. Extensión de "publicar UNA
 * nota" (PublishButton.tsx / node.publicSlug) a "publicar VARIOS elementos".
 *
 * Modelo (coherente con `_ctxRefs` de los contextos, ver utils/cajones.ts):
 * un GRUPO es un nodo normal marcado `extraData._group='1'` cuyos miembros son
 * ids referenciados en `extraData._groupRefs` (array de node ids) — el grupo
 * apunta A sus miembros (al revés que `_ctxRefs`, donde el miembro apunta a su
 * contexto; aquí tiene más sentido que el propietario de la relación sea el
 * grupo, ya que un grupo se borra/publica como unidad).
 *
 * El enlace público reutiliza el MISMO campo `publicSlug` del nodo que ya usan
 * las notas individuales (ver nodeExport.publishNodePublicly), pero contra un
 * endpoint de servidor propio (`/groups/publish`, `/groups/unpublish/:slug`,
 * vista pública `/g/:slug`) que resuelve los miembros EN VIVO en cada visita
 * — así quitar/añadir un elemento actualiza el enlace público al instante.
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { publishGroup, unpublishGroup } from '../api/client'

function ed(n: Node | null | undefined): Record<string, unknown> {
  if (!n) return {}
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Es un nodo-GRUPO? */
export function isGroupNode(n: Node | null | undefined): boolean {
  return !!n && ed(n)._group === '1'
}

/** IDs de los miembros del grupo, en el orden en que se agregaron/guardan. */
export function groupMemberIds(n: Node | null | undefined): string[] {
  const v = ed(n)._groupRefs
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Nodos miembro reales (resuelve ids → Node, descarta borrados/inexistentes). */
export function groupMembers(n: Node | null | undefined): Node[] {
  return groupMemberIds(n)
    .map(id => store.getNode(id))
    .filter((x): x is Node => !!x && !x.deletedAt)
}

/** Crea un grupo nuevo con los elementos indicados. Se cuelga a nivel raíz
 *  (parentId=null) — igual que agentes/prompts (createAgentUnder/createPromptUnder):
 *  un grupo no "vive dentro" de un elemento en concreto, es transversal. */
export function createGroup(name: string, memberIds: string[]): Node {
  return store.createNode({
    text: (name || '').trim() || 'Grupo',
    parentId: null,
    extraData: { _group: '1', _groupRefs: memberIds } as unknown as Record<string, string>,
  })
}

export function addToGroup(groupId: string, nodeId: string): void {
  const g = store.getNode(groupId)
  if (!g) return
  const e = ed(g)
  const cur = groupMemberIds(g)
  if (!cur.includes(nodeId)) e._groupRefs = [...cur, nodeId]
  store.updateNode(groupId, { extraData: JSON.stringify(e) })
}

export function removeFromGroup(groupId: string, nodeId: string): void {
  const g = store.getNode(groupId)
  if (!g) return
  const e = ed(g)
  e._groupRefs = groupMemberIds(g).filter(id => id !== nodeId)
  store.updateNode(groupId, { extraData: JSON.stringify(e) })
}

export function renameGroup(groupId: string, name: string): void {
  const n = (name || '').trim()
  if (!n) return
  store.updateNode(groupId, { text: n })
}

// ── Publicación (mismo mecanismo que una nota, endpoint propio) ─────────────

export async function publishGroupPublicly(node: Node): Promise<string> {
  const existingSlug = node.publicSlug || undefined
  const result = await publishGroup(node.id, existingSlug)
  const url = `https://fromly.app/g/${result.slug}`
  if (node.publicSlug !== result.slug) store.updateNode(node.id, { publicSlug: result.slug })
  return url
}

export async function unpublishGroupPublicly(node: Node): Promise<void> {
  if (!node.publicSlug) return
  await unpublishGroup(node.publicSlug)
  store.updateNode(node.id, { publicSlug: null })
}
