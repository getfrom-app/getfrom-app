/**
 * knowledgeNodes — nombres de los nodos de CONOCIMIENTO (text-keyed, sin id determinista).
 *
 * Hay dos:
 *   · Perfil:       "🧠 Lo que From sabe sobre ti"  (lo que Magic aprende del usuario)
 *   · Por-contexto: "🧠 Lo que From sabe"           (memoria de cada @contexto)
 *
 * Estos nodos se localizan POR TEXTO (no por id determinista), así que renombrarlos
 * de "From" → "Fromly" es delicado: un cliente con bundle congelado (Mac) que aún
 * busque el texto viejo crearía un duplicado. Por eso la migración va en 2 FASES:
 *
 *   FASE 1 (actual): el CANÓNICO de creación sigue siendo el texto VIEJO, pero los
 *     finders reconocen AMBOS textos (viejo y nuevo) vía isProfileKnowledge /
 *     isContextKnowledge. No se renombra nada → invisible, 0 riesgo, reversible.
 *     Objetivo: que web + Mac aprendan a reconocer el texto nuevo ANTES del cambio.
 *
 *   FASE 2 (ACTUAL — los Mac ya auto-actualizaron a la Fase 1): el CANÓNICO de
 *     creación pasa a la versión "Fromly" + migración in situ (updateNode del
 *     texto del nodo existente, mismo id → sin duplicado). Como todos los clientes
 *     ya reconocen AMBOS textos (Fase 1 desplegada), ninguno crea un nodo nuevo
 *     durante el despliegue. La migración (migrateKnowledgeNodesToFromly, en
 *     api/userKnowledge.ts) renombra los nodos viejos que aún tengan el texto "From".
 *
 * Los finders (isProfileKnowledge / isContextKnowledge) siguen reconociendo ambos
 * textos indefinidamente, así que cualquier cliente que se quedara rezagado en
 * Fase 1 sigue funcionando sin duplicar.
 */

// ── CANÓNICO de creación (Fase 2 = texto nuevo "Fromly") ──
export const PROFILE_KNOWLEDGE = '🧠 Lo que Fromly sabe sobre ti'
export const CONTEXT_KNOWLEDGE = '🧠 Lo que Fromly sabe'

// ── Texto VIEJO ("From"), solo para la migración de renombrado in situ. ──
export const PROFILE_KNOWLEDGE_OLD = '🧠 Lo que From sabe sobre ti'
export const CONTEXT_KNOWLEDGE_OLD = '🧠 Lo que From sabe'

// ── Alias reconocidos (viejo + nuevo). Comparación EXACTA, sin colisión de prefijo. ──
const PROFILE_ALIASES = ['🧠 Lo que From sabe sobre ti', '🧠 Lo que Fromly sabe sobre ti']
const CONTEXT_ALIASES = ['🧠 Lo que From sabe', '🧠 Lo que Fromly sabe']

/** true si el texto es el nodo de conocimiento del PERFIL (viejo o nuevo). */
export function isProfileKnowledge(text: string | null | undefined): boolean {
  return PROFILE_ALIASES.includes((text || '').trim())
}

/** true si el texto es el nodo de conocimiento de un CONTEXTO (viejo o nuevo). */
export function isContextKnowledge(text: string | null | undefined): boolean {
  return CONTEXT_ALIASES.includes((text || '').trim())
}
