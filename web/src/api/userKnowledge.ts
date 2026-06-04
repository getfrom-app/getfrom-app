/**
 * userKnowledge — Persistencia del conocimiento que From aprende sobre el usuario.
 *
 * From extrae personas y hechos del usuario desde dos fuentes:
 *  · Nodos que el usuario escribe (OutlinerNode → extractUserKnowledge)
 *  · Conversaciones con Magic en el chat (aiChatStore → learnFromUserMessage)
 *
 * Todo se guarda bajo "🧠 Lo que From sabe sobre ti" en el perfil IA, de forma
 * que el chat y el clasificador lo reciben de forma integral en cada interacción.
 */

import { store } from '../store/nodeStore'
import type { Node } from '../types'

const LEARN_SECTION = '🧠 Lo que From sabe sobre ti'

/**
 * Devuelve el nodo perfil IA, creándolo de forma SÍNCRONA si no existe.
 * Replica getOrCreatePerfilIA (que no realiza ninguna espera real) para poder
 * usarse en rutas síncronas (learningsStore.add, saveExample) sin romper su API.
 */
export function ensurePerfilSync(): Node {
  const existing = store.perfilIANode?.() ?? null
  if (existing) return existing
  const contexto = store.children(null).find(n => !n.deletedAt && n.text === '🧠 Contexto') ?? null
  return store.createNode({ text: '🧠 Perfil de IA', parentId: contexto?.id ?? null, extraData: { _perfilIA: '1' } })
}

/**
 * Devuelve (creando si falta) un contenedor hijo del perfil con el nombre dado.
 * Los contenedores 🧠 quedan excluidos de listas de contexto y "Sin clasificar".
 * Es la base para persistir aprendizaje como nodos → sincroniza por cuenta.
 */
export function getProfileContainer(name: string, create = true): Node | null {
  const perfil = create ? ensurePerfilSync() : (store.perfilIANode?.() ?? null)
  if (!perfil) return null
  const existing = store.children(perfil.id).find(n => !n.deletedAt && n.text === name)
  if (existing) return existing
  if (!create) return null
  const sibs = store.children(perfil.id).filter(n => !n.deletedAt)
  const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
  return store.createNode({ text: name, parentId: perfil.id, siblingOrder: maxOrder + 1000 })
}

/** Líneas actuales del perfil IA (hijos directos) — para dar contexto al extractor. */
export function readProfileLines(): string[] {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return []
  return store.children(perfil.id)
    .filter(n => !n.deletedAt && (n.text || '').trim().length > 3)
    .slice(0, 50)
    .map(n => (n.text || '').trim())
}

/**
 * Guarda personas y hechos bajo "🧠 Lo que From sabe sobre ti".
 * Crea el nodo de sección si no existe y deduplica items dentro de cada sublínea.
 */
export async function saveUserKnowledgeToProfile(people: string[], facts: string[]): Promise<void> {
  if (!people.length && !facts.length) return

  let perfil = store.perfilIANode?.() ?? null
  if (!perfil) {
    try { perfil = await store.getOrCreatePerfilIA() } catch { return }
  }
  if (!perfil) return

  let learnNode = store.children(perfil.id).find(n => !n.deletedAt && n.text === LEARN_SECTION)
  if (!learnNode) {
    const sibs = store.children(perfil.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    learnNode = store.createNode({ text: LEARN_SECTION, parentId: perfil.id, siblingOrder: maxOrder + 1000 })
  }

  // Limpiar línea antigua "Palabras clave:" (formato obsoleto)
  const kwNode = store.children(learnNode.id).filter(n => !n.deletedAt).find(n => (n.text || '').startsWith('Palabras clave:'))
  if (kwNode) store.deleteNode(kwNode.id)

  const upsertSub = (prefix: string, items: string[], order: number) => {
    const cleanItems = items
      .map(item => item.replace(new RegExp(`^${prefix}:\\s*`, 'i'), '').trim())
      .filter(Boolean)
    if (!cleanItems.length) return
    const sub = store.children(learnNode!.id).filter(n => !n.deletedAt).find(n => (n.text || '').startsWith(prefix + ':'))
    if (!sub) {
      store.createNode({ text: prefix + ': ' + cleanItems.join(', '), parentId: learnNode!.id, siblingOrder: order })
    } else {
      const existingText = (sub.text || '').toLowerCase()
      const newItems = cleanItems.filter(item => !existingText.includes(item.toLowerCase()))
      if (newItems.length > 0) {
        const currentText = (sub.text || '').trimEnd()
        const sep = currentText.endsWith(':') ? ' ' : ', '
        store.updateNode(sub.id, { text: currentText + sep + newItems.join(', ') })
      }
    }
  }

  const flc = store.children(learnNode.id).filter(n => !n.deletedAt)
  const maxBase = flc.length > 0 ? Math.max(...flc.map(c => c.siblingOrder)) : 0
  upsertSub('Personas', people, maxBase + 1000)
  upsertSub('Hechos', facts, maxBase + 2000)
}
