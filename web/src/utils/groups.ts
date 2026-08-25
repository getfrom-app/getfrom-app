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
//
// `node.publicSlug` guarda el PATH completo que va tras `/g/` (así el enlace
// se construye igual en toda la web sin conocer el formato en dos partes):
// - formato viejo (grupos publicados antes del 25 ago 2026): un solo tramo,
//   el `slug` aleatorio de 8 caracteres — `abc12345`.
// - formato nuevo: `userSlug/customSlug` — `alberto/diabeticos-alicante`.
// El servidor identifica una publicación existente por su `customSlug` (o el
// `slug` viejo si el grupo es de antes), nunca por el path con barra —
// `identifierOf` extrae justo eso.
function identifierOf(node: Node): string | undefined {
  const raw = node.publicSlug || undefined
  if (!raw) return undefined
  const parts = raw.split('/')
  return parts[parts.length - 1] || undefined
}

/** customSlug opcional elegido por el usuario en el campo de "nombre
 *  personalizado" del enlace — si se omite, el servidor genera uno a partir
 *  del nombre del grupo. */
export async function publishGroupPublicly(node: Node, customSlug?: string): Promise<string> {
  const existingSlug = identifierOf(node)
  const result = await publishGroup(node.id, existingSlug, customSlug)
  const url = `https://fromly.app/g/${result.slug}`
  if (node.publicSlug !== result.slug) store.updateNode(node.id, { publicSlug: result.slug })
  return url
}

export async function unpublishGroupPublicly(node: Node): Promise<void> {
  const identifier = identifierOf(node)
  if (!identifier) return
  await unpublishGroup(identifier)
  store.updateNode(node.id, { publicSlug: null })
}
