/**
 * userKnowledge — Persistencia del conocimiento que Fromly aprende sobre el usuario.
 *
 * Fromly extrae personas y hechos del usuario desde varias fuentes — notas que
 * escribe (OutlinerNode → extractUserKnowledge), conversaciones con Magic en
 * el chat (aiChatStore → learnFromUserMessage), correcciones ("enseñar a
 * Magic", teachMagic.ts → addProfileFact) — y TODAS convergen en un único
 * escritor (`rememberFactsLocal`, más abajo) que guarda en el `body` del
 * nodo Perfil de IA, sección "🧠 Lo que Fromly ha aprendido".
 *
 * ⚠️ Hasta el 31 ago 2026 esto NO era así: había tres formatos de
 * almacenamiento distintos conviviendo bajo el mismo perfil — hijos
 * "Personas: X, Y" / "Hechos: A, B" (este fichero), un hijo por hecho suelto
 * (teachMagic.ts) y el `body` (servidor, `assistantMemory.ts`, usado por
 * iOS/Telegram/chat vía servidor). Solo `getOrCreateProfileDoc` migraba
 * hijos→body, y encima de forma PEREZOSA (solo al abrir la pantalla de
 * Perfil) — así que lo aprendido conversando en la web nunca llegaba a
 * Telegram/iOS hasta que el usuario abría esa pantalla, y mientras tanto
 * cada escritor seguía creando hijos nuevos, deshaciendo cualquier
 * convergencia (Alberto, 31 ago 2026: "lo que el usuario cuenta en el chat
 * debe quedar en la memoria de fromly para todo... hay que organizar esta
 * info, no acumular lo innecesario"). Mismo formato/lógica que
 * `assistantMemory.ts` en el servidor (normalización, "obsolete" retira en
 * vez de acumular, tope duro) — mantenerlos alineados si uno cambia.
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

// ── Escritor único de lo aprendido ("🧠 Lo que Fromly ha aprendido") ────────
//
// Mismo formato y misma lógica que `rememberFacts` en el servidor
// (`server/src/services/assistantMemory.ts`): una sección al final del
// `body` del Perfil, un `<p>hecho</p>` por línea, deduplicada por texto
// normalizado, con "obsolete" retirando en vez de acumular, y un tope duro
// para que crecer sin límite no sea posible. TODOS los escritores de hechos
// del usuario (chat, notas, "enseñar a Magic") pasan por aquí — ver el
// comentario de cabecera del fichero.

const LEARNED_HEADING = '🧠 Lo que Fromly ha aprendido'
const LEARNED_HEADING_HTML = `<p><strong>${LEARNED_HEADING}</strong></p>`
const LEARNED_HEADING_RE = /<p>(?:(?!<\/p>)[\s\S])*🧠 Lo que Fromly ha aprendido(?:(?!<\/p>)[\s\S])*<\/p>/i
/** Cuántas líneas aprendidas se guardan como máximo — pasado esto, se
 *  descartan las MÁS ANTIGUAS (nunca las recién aprendidas). Puro freno de
 *  seguridad: la deduplicación de abajo ya evita que un mismo hecho repetido
 *  infle el documento; esto solo cubre el caso de muchos hechos DISTINTOS de
 *  verdad acumulados durante meses. */
const MAX_LEARNED_LINES = 200

function stripHtmlLine(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitLearnedSection(rawBody: string): { userHtml: string; learnedLines: string[] } {
  const idx = rawBody.search(LEARNED_HEADING_RE)
  if (idx === -1) return { userHtml: rawBody, learnedLines: [] }
  const userHtml = rawBody.slice(0, idx)
  const learnedHtml = rawBody.slice(idx).replace(LEARNED_HEADING_RE, '')
  const learnedLines = learnedHtml.split(/<\/p>|<br\s*\/?>|\n/i).map(stripHtmlLine).filter(Boolean)
  return { userHtml, learnedLines }
}

/** Compara sin acentos, sin mayúsculas y sin puntuación final. */
function normalizeFact(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,;:!?]+$/, '').replace(/\s+/g, ' ').trim()
}

function escapeHtmlFact(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Lo que Fromly ha aprendido, ya sin HTML — para mostrarlo (Ajustes → Magic)
 *  o darle contexto al extractor. */
export function readLearnedFacts(): string[] {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return []
  return splitLearnedSection(perfil.body || '').learnedLines
}

/**
 * Guarda hechos nuevos del usuario y retira los que `obsolete` deja
 * anticuados — misma sección, mismo documento que el servidor, así que lo
 * aprendido en la web ya está ahí para Telegram/iOS en el siguiente turno,
 * sin esperar a que se abra la pantalla de Perfil. Síncrono (usa
 * `getOrCreateProfileDoc`, que ya migra cualquier hijo legacy que quedara de
 * antes de este cambio) — se puede llamar directamente desde cualquier flujo
 * sin `await`.
 */
export function rememberFactsLocal(facts: string[], obsolete: string[] = []): void {
  const clean = facts.map(f => f.trim()).filter(f => f.length > 3 && f.length < 300)
  const obsoleteClean = obsolete.map(f => f.trim()).filter(f => f.length > 3)
  if (clean.length === 0 && obsoleteClean.length === 0) return

  const perfil = getOrCreateProfileDoc()
  const { userHtml, learnedLines } = splitLearnedSection(perfil.body || '')

  const obsoleteNorm = obsoleteClean.map(normalizeFact)
  const survivors = obsoleteNorm.length === 0
    ? learnedLines
    : learnedLines.filter(line => {
        const n = normalizeFact(line)
        return !obsoleteNorm.some(o => n.includes(o) || o.includes(n))
      })

  const known = new Set(survivors.map(normalizeFact))
  const fresh = clean.filter(f => !known.has(normalizeFact(f)))
  if (fresh.length === 0 && survivors.length === learnedLines.length) return

  let newLearnedLines = [...survivors, ...fresh]
  if (newLearnedLines.length > MAX_LEARNED_LINES) {
    newLearnedLines = newLearnedLines.slice(newLearnedLines.length - MAX_LEARNED_LINES)
  }

  const learnedHtml = newLearnedLines.length > 0
    ? LEARNED_HEADING_HTML + newLearnedLines.map(f => `<p>${escapeHtmlFact(f)}</p>`).join('')
    : ''
  store.updateNode(perfil.id, { body: userHtml + learnedHtml })
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

