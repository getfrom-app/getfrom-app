/**
 * userKnowledge — lo que Fromly aprende sobre el usuario, del lado del CLIENTE.
 *
 * Rediseño 1 sept 2026 (Alberto: "quiero un sistema único y centralizado...
 * que no aprenda información por tres sitios distintos y los guarde en cuatro
 * sitios"). Hasta entonces este fichero era un ESCRITOR completo, gemelo a
 * mano del servidor (`server/src/services/assistantMemory.ts`) — cada uno
 * hacía "leer todo el body del Perfil → modificarlo → reescribirlo entero"
 * sobre el mismo nodo, sin candado entre ambos (causó un incidente real, 30
 * ago 2026). Ahora:
 *
 *  · El SERVIDOR es el ÚNICO que aprende y escribe — vía `/ai/extract-user-
 *    knowledge` (notas/documentos), `/ai/teach` (corrección manual) o el chat
 *    (`/assistant/chat`). Lo aprendido son PÍLDORAS: nodos reales, hijos del
 *    nodo `_knowledgeRoot` ("🧠 Conocimiento"), que sincronizan al cliente
 *    como cualquier otro nodo — no hay API nueva que consultar, `store` ya
 *    las tiene.
 *  · Este fichero queda SOLO para LEER: `listActiveKnowledgePills` (columna
 *    derecha del Perfil) y `readProfileLines` (contexto para el extractor
 *    antes de llamar al servidor, evita mandar de más).
 */

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { PROFILE_KNOWLEDGE, PROFILE_KNOWLEDGE_OLD, CONTEXT_KNOWLEDGE, CONTEXT_KNOWLEDGE_OLD, CONTEXT_KNOWLEDGE_OLD_FROMLY, isContextKnowledge } from '../utils/knowledgeNodes'
import { markdownToHtml } from '../utils/importMarkdown'
import { htmlToMarkdown } from '../utils/htmlMarkdown'

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
 * Nodo perfil de IA con migración in situ del formato ANTIGUO (hijos-línea del
 * tipo "Hechos: ...", "Personas: ...", ver saveUserKnowledgeToProfile) al nuevo
 * (documento real, contenido en `.body`) — mismo patrón que
 * getOrCreateContextKnowledgeDoc (cajones.ts) para la Memoria de un contexto.
 * Antes de este cambio, un perfil con años de hechos acumulados aparecía VACÍO
 * en la pantalla de Perfil de v2 (que solo lee/edita `.body`), aunque el chat
 * lo siguiera usando bien vía sus hijos (Alberto, 15 jul: "tenía un perfil...
 * no sé si habrá sobrevivido al cambio"). Mismo id, sin duplicar.
 *
 * SIEMPRE fusiona si quedan hijos legacy — NUNCA se salta por tener ya algo en
 * `.body` (antes se saltaba si el body no estaba vacío; un "prueba" de una
 * línea escrito antes de que existiera esta migración bastó para bloquearla y
 * dejar cientos de hechos reales invisibles). El body existente se conserva
 * SIEMPRE, delante del contenido migrado — no se pierde nada. Idempotente: sin
 * hijos legacy, es un simple get.
 */
export function getOrCreateProfileDoc(): Node {
  const perfil = ensurePerfilSync()
  const legacyChildren = store.children(perfil.id).filter(c => !c.deletedAt)
  if (legacyChildren.length === 0) return perfil
  const legacyText = legacyChildren.map(n => (n.text || '').trim()).filter(Boolean).join('\n\n')
  for (const child of legacyChildren) store.deleteNode(child.id)
  const existingBody = htmlToMarkdown(perfil.body || '').trim()
  const combined = [existingBody, legacyText].filter(Boolean).join('\n\n')
  store.updateNode(perfil.id, { body: combined ? markdownToHtml(combined) : '<p></p>' })
  return store.getNode(perfil.id)!
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

/** Líneas actuales del perfil IA — para dar contexto al extractor (qué ya se
 *  sabe, evitar duplicar). Soporta AMBOS formatos: documento migrado (`.body`,
 *  ver getOrCreateProfileDoc) o, si por lo que sea aún quedan hijos-línea
 *  legacy sin migrar, esos. */
export function readProfileLines(): string[] {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return []
  const bodyText = htmlToMarkdown(perfil.body || '').trim()
  if (bodyText) return [bodyText]
  return store.children(perfil.id)
    .filter(n => !n.deletedAt && (n.text || '').trim().length > 3)
    .slice(0, 50)
    .map(n => (n.text || '').trim())
}

// ── Píldoras de conocimiento (lectura) ──────────────────────────────────────
//
// Una píldora es un nodo real, hijo de `store.knowledgeRootNode()`
// (`extraData._knowledgeFact === '1'`), escrito ÚNICAMENTE por el servidor
// (`rememberFacts` en `assistantMemory.ts`) y sincronizado al cliente como
// cualquier otro nodo — no hace falta ninguna llamada de red para listarlas.

export interface KnowledgePill {
  id: string
  text: string
  /** De dónde salió — "chat", "note:<nodeId>", "teach", "evening", "migracion". */
  source: string
  createdAt: string
}

function parsePillSource(extraData: string | null | undefined): string {
  try { return (JSON.parse(extraData || '{}').source as string) || 'chat' } catch { return 'chat' }
}

/** Píldoras activas, más recientes primero — para la columna derecha del
 *  Perfil (ver V2KnowledgePills.tsx). */
export function listActiveKnowledgePills(): KnowledgePill[] {
  const root = store.knowledgeRootNode()
  if (!root) return []
  return store.children(root.id)
    .filter(n => !n.deletedAt && (n.text || '').trim())
    .map(n => ({ id: n.id, text: (n.text || '').trim(), source: parsePillSource(n.extraData), createdAt: n.createdAt || '' }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Lo que Fromly ha aprendido, ya sin HTML — para mostrarlo (Ajustes → Magic)
 *  o darle contexto al extractor. */
export function readLearnedFacts(): string[] {
  return listActiveKnowledgePills().map(p => p.text)
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

/** FASE 3: renombra in situ los nodos de memoria de CONTEXTO que aún tengan el
 *  texto "🧠 Lo que Fromly sabe" al nuevo "🧠 Memoria" — el perfil ("…sobre ti")
 *  no cambia, solo la memoria por contexto. Mismo id → sin duplicar. Idempotente
 *  y guardada por flag: corre una sola vez por dispositivo. */
export function migrateContextKnowledgeToMemoria(): void {
  try { if (localStorage.getItem('from_knowledge_memoria_v1') === '1') return } catch { /* */ }
  let renamed = 0
  for (const n of store.nodes.values()) {
    if (n.deletedAt) continue
    if ((n.text || '').trim() === CONTEXT_KNOWLEDGE_OLD_FROMLY) { store.updateNode(n.id, { text: CONTEXT_KNOWLEDGE }); renamed++ }
  }
  if (renamed > 0) console.log(`[migrateContextKnowledgeToMemoria] renombrados ${renamed} nodos de memoria de contexto`)
  try { localStorage.setItem('from_knowledge_memoria_v1', '1') } catch { /* */ }
}

