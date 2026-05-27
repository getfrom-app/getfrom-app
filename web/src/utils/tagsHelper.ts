/**
 * tagsHelper — Sistema de tags como árbol de nodos
 *
 * Jerarquía: 🏷 Tags → La Isla → Ops
 * Slug:      #la-isla  /  #la-isla/ops
 *
 * Reutiliza al máximo el sistema existente:
 *  - _tagDefinition en extraData → fuente de verdad para AI context
 *  - body del nodo → contexto de IA (ya leído por tagDefinitionsForNode)
 *  - _tagPrompt en hijos → prompts ya procesados por enrichTag()
 *
 * NO duplica: getTagDefNode(), tagDefinitionsForNode(), enrichTag()
 * AÑADE: organización en árbol, slug jerárquico, auto-setup
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'

export const TAGS_ROOT_NAME = '🏷 Tags'

// ── Slug helpers ──────────────────────────────────────────────────────────────

/** Convierte texto de nodo → slug de tag. "La Isla" → "la-isla" */
export function textToTagSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\/]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Construye el slug completo de un nodo dentro del árbol Tags.
 * La Isla → "la-isla"
 * La Isla / Ops → "la-isla/ops"
 * Returns null si el nodo no está bajo el Tags root.
 */
export function getNodeTagSlug(nodeId: string): string | null {
  const tagsRoot = findTagsRoot()
  if (!tagsRoot) return null

  const parts: string[] = []
  let cur = store.getNode(nodeId)
  while (cur && cur.id !== tagsRoot.id) {
    parts.unshift(textToTagSlug(cur.text || ''))
    if (!cur.parentId) return null
    cur = store.getNode(cur.parentId) ?? undefined
  }
  if (!cur || cur.id !== tagsRoot.id) return null
  return parts.join('/')
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function findTagsRoot(): Node | undefined {
  return store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
}

export function getOrCreateTagsRoot(): Node {
  return findTagsRoot() ?? store.createNode({ text: TAGS_ROOT_NAME, parentId: null })
}

// ── Buscar tag por slug ───────────────────────────────────────────────────────

/**
 * Busca el nodo correspondiente a un slug dentro del árbol Tags.
 * "la-isla"     → nodo "La Isla" hijo directo de Tags
 * "la-isla/ops" → nodo "Ops" hijo de "La Isla"
 * Returns null si no encuentra.
 */
export function findTagNodeBySlug(slug: string): Node | null {
  const root = findTagsRoot()
  if (!root) return null

  const parts = slug.toLowerCase().split('/')
  let parent = root
  for (const part of parts) {
    const match = store.children(parent.id).find(c =>
      !c.deletedAt && textToTagSlug(c.text || '') === part
    )
    if (!match) return null
    parent = match
  }
  return parent.id === root.id ? null : parent
}

/**
 * Busca el nodo de definición de un tag por su nombre/slug.
 * Primero mira en el árbol Tags (nueva forma), luego en _tagDefinition (legacy).
 */
export function resolveTagDefNode(tagName: string): Node | null {
  // 1. Buscar en árbol Tags por slug
  const bySlug = findTagNodeBySlug(tagName)
  if (bySlug) return bySlug

  // 2. Fallback: sistema legacy (_tagDefinition en extraData)
  return store.getTagDefNode(tagName)
}

// ── Auto-setup de nodos bajo Tags ────────────────────────────────────────────

/**
 * Cuando un nodo se crea/modifica bajo el árbol Tags, asegura que tenga
 * _tagDefinition en extraData con el slug correcto.
 * Llamar después de crear o renombrar un nodo bajo Tags.
 */
export function ensureTagDefinition(nodeId: string): void {
  const slug = getNodeTagSlug(nodeId)
  if (!slug) return // no está bajo Tags

  const node = store.getNode(nodeId)
  if (!node) return

  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._tagDefinition !== slug) {
      ed._tagDefinition = slug
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    }
  } catch { /* ignore */ }
}

// ── Obtener contexto de AI para un slug ──────────────────────────────────────

/**
 * Devuelve el contexto completo de un tag para inyectar a la IA.
 * Incluye: body del tag + body de subtags con sus nombres.
 * Compatible con el formato que ya espera aiChatStore.enrichTag().
 */
export function getTagAIContext(slug: string): string | null {
  const node = resolveTagDefNode(slug)
  if (!node?.body?.trim() && !node) return null

  const parts: string[] = []
  if (node?.body?.trim()) parts.push(node.body.trim())

  // Incluir subtags si los hay
  if (node) {
    const children = store.children(node.id).filter(c => !c.deletedAt && c.body?.trim())
    for (const child of children) {
      const childSlug = getNodeTagSlug(child.id) || textToTagSlug(child.text || '')
      parts.push(`\n**#${childSlug}:**\n${child.body!.trim()}`)
    }
  }

  return parts.join('\n') || null
}

// ── Inicialización ────────────────────────────────────────────────────────────

/**
 * Asegura que todos los nodos bajo Tags tienen _tagDefinition sincronizado.
 * Llamar una vez al arrancar el store (tras initialLoad).
 */
export function syncTagDefinitions(): void {
  const root = findTagsRoot()
  if (!root) return

  function processNode(nodeId: string) {
    ensureTagDefinition(nodeId)
    for (const child of store.children(nodeId)) {
      if (!child.deletedAt) processNode(child.id)
    }
  }

  for (const child of store.children(root.id)) {
    if (!child.deletedAt) processNode(child.id)
  }
}
