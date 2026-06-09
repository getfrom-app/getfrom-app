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
 *   FASE 2 (cuando los Mac hayan auto-actualizado a la Fase 1): cambiar el CANÓNICO
 *     a la versión "Fromly" + migración in situ (updateNode del texto del nodo
 *     existente, mismo id → sin duplicado). Como todos los clientes ya reconocen
 *     ambos textos, ninguno creará un nodo nuevo durante el despliegue.
 *
 * Para hacer la Fase 2: cambiar PROFILE_KNOWLEDGE y CONTEXT_KNOWLEDGE a las variantes
 * "Fromly" (los alias ya las incluyen) y añadir la migración de renombrado.
 */

// ── CANÓNICO de creación (Fase 1 = texto viejo "From") ──
export const PROFILE_KNOWLEDGE = '🧠 Lo que From sabe sobre ti'
export const CONTEXT_KNOWLEDGE = '🧠 Lo que From sabe'

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
