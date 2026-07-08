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
import { PROFILE_KNOWLEDGE, PROFILE_KNOWLEDGE_OLD, CONTEXT_KNOWLEDGE, CONTEXT_KNOWLEDGE_OLD, isProfileKnowledge, isContextKnowledge } from '../utils/knowledgeNodes'

// Canónico de creación (Fase 2 = texto nuevo "Fromly"). Los finders reconocen viejo + nuevo.
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
// Normaliza para comparar (sin acentos, minúsculas, espacios colapsados).
const _norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function saveUserKnowledgeToProfile(people: string[], facts: string[], obsolete: string[] = []): Promise<void> {
  if (!people.length && !facts.length && !obsolete.length) return

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

  // Items OBSOLETOS a eliminar (normalizados, con longitud mínima para no borrar por
  // coincidencias triviales). Un item existente se quita si comparte texto sustancial
  // con alguno de los obsoletos (en cualquier dirección).
  const obs = obsolete.map(_norm).filter(o => o.length >= 8)
  const isObsolete = (item: string) => {
    const ni = _norm(item)
    return obs.some(o => ni.includes(o) || o.includes(ni))
  }

  const upsertSub = (prefix: string, items: string[], order: number) => {
    const cleanItems = items
      .map(item => item.replace(new RegExp(`^${prefix}:\\s*`, 'i'), '').trim())
      .filter(Boolean)
    const sub = store.children(learnNode!.id).filter(n => !n.deletedAt).find(n => (n.text || '').startsWith(prefix + ':'))
    if (!sub) {
      if (cleanItems.length) store.createNode({ text: prefix + ': ' + cleanItems.join(', '), parentId: learnNode!.id, siblingOrder: order })
      return
    }
    // Parte los items existentes, ELIMINA los obsoletos, y AÑADE los nuevos (sin duplicar).
    const body = (sub.text || '').replace(new RegExp(`^${prefix}:\\s*`, 'i'), '')
    let existing = body.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
    const before = existing.length
    if (obs.length) existing = existing.filter(it => !isObsolete(it))
    const existLower = existing.map(_norm)
    let added = 0
    for (const it of cleanItems) {
      const nit = _norm(it)
      if (!existLower.some(e => e.includes(nit) || nit.includes(e))) { existing.push(it); existLower.push(nit); added++ }
    }
    if (added > 0 || existing.length !== before) {
      store.updateNode(sub.id, { text: prefix + ': ' + existing.join(', ') })
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

/** FASE 2 del rebrand de los nodos de conocimiento (text-keyed): renombra in situ
 *  los nodos que aún tengan el texto VIEJO ("🧠 Lo que From sabe[ sobre ti]") al
 *  nuevo ("…Fromly…"). Mismo id → updateNode, sin duplicar. Comparación EXACTA por
 *  texto para no confundir el de Perfil ("…sobre ti") con el de contexto (prefijo).
 *  Idempotente y guardada por flag: corre una sola vez por dispositivo. */
export function migrateKnowledgeNodesToFromly(): void {
  try { if (localStorage.getItem('from_knowledge_fromly_v1') === '1') return } catch { /* */ }
  let renamed = 0
  for (const n of store.nodes.values()) {
    if (n.deletedAt) continue
    const text = (n.text || '').trim()
    if (text === PROFILE_KNOWLEDGE_OLD) { store.updateNode(n.id, { text: PROFILE_KNOWLEDGE }); renamed++ }
    else if (text === CONTEXT_KNOWLEDGE_OLD) { store.updateNode(n.id, { text: CONTEXT_KNOWLEDGE }); renamed++ }
  }
  if (renamed > 0) console.log(`[migrateKnowledgeNodesToFromly] renombrados ${renamed} nodos de conocimiento → Fromly`)
  try { localStorage.setItem('from_knowledge_fromly_v1', '1') } catch { /* */ }
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
