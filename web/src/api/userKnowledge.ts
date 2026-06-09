/**
 * userKnowledge — Persistencia del conocimiento que Fromly aprende sobre el usuario.
 *
 * Fromly extrae personas y hechos del usuario desde dos fuentes:
 *  · Nodos que el usuario escribe (OutlinerNode → extractUserKnowledge)
 *  · Conversaciones con Magic en el chat (aiChatStore → learnFromUserMessage)
 *
 * Todo se guarda bajo "🧠 Lo que From sabe sobre ti" en el perfil IA, de forma
 * que el chat y el clasificador lo reciben de forma integral en cada interacción.
 */

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { PROFILE_KNOWLEDGE, isProfileKnowledge, isContextKnowledge } from '../utils/knowledgeNodes'

// Canónico de creación (Fase 1 = texto viejo). Los finders reconocen viejo + nuevo.
const LEARN_SECTION = PROFILE_KNOWLEDGE

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

  let learnNode = store.children(perfil.id).find(n => !n.deletedAt && isProfileKnowledge(n.text))
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

  // Curador automático: si el conocimiento acumulado supera el umbral, compacta.
  maybeCompactProfile()
}

// ── Curador del perfil (tope + compactación inteligente) ──────────────────────

const COMPACT_THRESHOLD = 40   // nº total de items aprendidos que dispara la limpieza

/** Lee las listas actuales de Personas/Hechos del nodo de aprendizaje. */
export function readLearnedItems(): { people: string[]; facts: string[]; learnNodeId: string | null } {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return { people: [], facts: [], learnNodeId: null }
  const learnNode = store.children(perfil.id).find(n => !n.deletedAt && isProfileKnowledge(n.text))
  if (!learnNode) return { people: [], facts: [], learnNodeId: null }
  const parseSub = (prefix: string): string[] => {
    const sub = store.children(learnNode.id).filter(n => !n.deletedAt).find(n => (n.text || '').startsWith(prefix + ':'))
    if (!sub) return []
    return (sub.text || '').slice(prefix.length + 1).split(',').map(s => s.trim()).filter(Boolean)
  }
  return { people: parseSub('Personas'), facts: parseSub('Hechos'), learnNodeId: learnNode.id }
}

function countLearnedItems(): number {
  const { people, facts } = readLearnedItems()
  return people.length + facts.length
}

/** Limpia el nodo huérfano "🧠 Lo que From sabe" (sin "sobre ti") que quedó como
 *  hijo directo del Perfil en versiones antiguas (cuando el Perfil se trataba como
 *  contexto). El conocimiento por contexto vive ahora dentro de cada contexto. */
export function cleanupOrphanProfileKnowledge(): void {
  try { if (localStorage.getItem('from_profile_orphan_v1') === '1') return } catch { /* */ }
  const perfil = store.perfilIANode?.() ?? null
  if (perfil) {
    for (const c of store.children(perfil.id)) {
      if (c.deletedAt) continue
      if (isContextKnowledge(c.text)) store.deleteNode(c.id)
    }
  }
  try { localStorage.setItem('from_profile_orphan_v1', '1') } catch { /* */ }
}

/** Devuelve (creando si falta) el nodo "🧠 Lo que From sabe sobre ti" — lo que
 *  Fromly escribe de forma autónoma en el Perfil. Para abrirlo y revisarlo. */
export function getOrCreateLearnNode(): Node | null {
  const perfil = ensurePerfilSync()
  if (!perfil) return null
  let learnNode = store.children(perfil.id).find(n => !n.deletedAt && isProfileKnowledge(n.text))
  if (!learnNode) {
    const sibs = store.children(perfil.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    learnNode = store.createNode({ text: LEARN_SECTION, parentId: perfil.id, siblingOrder: maxOrder + 1000 })
  }
  return learnNode
}

/** Sobrescribe las sublíneas Personas/Hechos con listas ya compactadas. */
function writeLearnedItems(learnNodeId: string, people: string[], facts: string[]) {
  const setSub = (prefix: string, items: string[]) => {
    const sub = store.children(learnNodeId).filter(n => !n.deletedAt).find(n => (n.text || '').startsWith(prefix + ':'))
    const text = items.length ? `${prefix}: ${items.join(', ')}` : ''
    if (sub) {
      if (text) store.updateNode(sub.id, { text })
      else store.deleteNode(sub.id)  // sin items → quitar la línea
    } else if (text) {
      store.createNode({ text, parentId: learnNodeId })
    }
  }
  setSub('Personas', people)
  setSub('Hechos', facts)
}

let _compacting = false

/** Compacta el conocimiento del perfil vía el curador del servidor.
 *  Seguro: ante cualquier fallo el servidor devuelve las listas intactas. */
export async function compactProfileKnowledge(): Promise<{ before: number; after: number } | null> {
  if (_compacting) return null
  const { people, facts, learnNodeId } = readLearnedItems()
  if (!learnNodeId || people.length + facts.length === 0) return null
  _compacting = true
  try {
    const { compactKnowledge } = await import('./autoClassify')
    const r = await compactKnowledge(people, facts)
    writeLearnedItems(learnNodeId, r.people, r.facts)
    return { before: people.length + facts.length, after: r.people.length + r.facts.length }
  } catch {
    return null
  } finally {
    _compacting = false
  }
}

/** Dispara el curador si se supera el umbral. Fire-and-forget, una vez a la vez. */
function maybeCompactProfile() {
  if (_compacting) return
  if (countLearnedItems() <= COMPACT_THRESHOLD) return
  void compactProfileKnowledge()
}
