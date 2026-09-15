// PERFIL — de vez en cuando Fromly ofrece ampliar lo que sabe del usuario, y al
// abrirlo pregunta algo real (Alberto, 5 ago 2026: "de vez en cuando Fromly de
// forma proactiva iniciará una conversación para preguntarle si quiere añadir
// algo nuevo").
//
// 28 ago 2026 — REESCRITO: la versión anterior creaba una sesión en el motor
// VIEJO (aiChatStore + nodo `_aiSession`), de antes de que el chat migrara a
// `/assistant/chat` (assistantStore). Ese motor ya no pinta nada en pantalla
// — el aviso de la sidebar aparecía, pero al abrirlo el chat estaba en blanco
// y no preguntaba nada (visto en vivo). Ahora todo vive en `assistantStore`:
// el aviso es un flag simple (`hasProfileNudge`/`offerProfileNudge`) y la
// pregunta la genera el servidor de verdad al abrirlo (`askProfileQuestion`,
// mismo cerebro que cualquier turno, así que sale grounded en contexto real).
// La ESCRITURA en el perfil tampoco necesita nada especial: el servidor ya
// extrae y guarda hechos nuevos de CUALQUIER conversación (`remember` en
// assistantTurn.ts) — no hace falta un "modo perfil" aparte para eso.
import { parseExtraData } from '../utils/papeleraHelper'
import { listMarkedContexts } from '../utils/cajones'
import { readProfileLines } from '../api/userKnowledge'
import type { Node } from '../types'

/** Marca de las sesiones de perfil creadas por el motor VIEJO (antes del 28
 *  ago 2026) — se conserva solo para que `aiChatStore.ts` (aún vivo para
 *  otras cosas: `findOriginSession`, avisos de agentes...) siga reconociendo
 *  esas sesiones antiguas sin romper. Nada crea sesiones nuevas con esto. */
const PROFILE_CHAT_FLAG = '_profileChat'
export function isProfileChatSession(n: Node | null | undefined): boolean {
  if (!n) return false
  return parseExtraData(n.extraData)[PROFILE_CHAT_FLAG] === '1'
}
export const PROFILE_CHAT_INSTRUCTIONS = `[MODO PERFIL]
Esta conversación sirve para ampliar el PERFIL del usuario: quién es, a qué se dedica, sus proyectos, sus metas, sus preferencias y su forma de trabajar. Reglas de este modo, TODAS obligatorias:
- NO crees notas, tareas, eventos ni documentos. En esta conversación no se crea nada.
- NO digas que lo has apuntado, guardado o añadido: de eso se encarga Fromly por su cuenta y ya avisa él aparte. Si lo dices, el usuario lo ve dos veces.
- Máximo DOS frases en total. La última es SIEMPRE una única repregunta concreta sobre lo que acaba de contar, para tener información más útil. Nunca varias preguntas seguidas ni listas.
- Si lo que dice ya está en el perfil, dilo en una frase y pregunta por otra cosa distinta.
- Tono directo y natural, sin florituras ni entusiasmo impostado.`

// ── Sugerencias ─────────────────────────────────────────────────────────────
// Ya no se muestran como chips (assistantStore no tiene ese concepto) — quedan
// como señal de que SÍ hay material nuevo del que preguntar (ver `itemsCreatedSince`).

/** Temas que Fromly podría preguntar, sacados de lo que el usuario ha estado usando
 *  de verdad — no de una lista fija. Los contextos con actividad reciente son la
 *  mejor pista. */
export function profileSuggestions(max = 4): string[] {
  const out: string[] = []
  for (const c of listMarkedContexts().slice(0, 2)) {
    const name = (c.text || '').trim()
    if (name) out.push(`Sobre ${name}`)
  }
  const profile = readProfileLines().join(' ').toLowerCase()
  const FALLBACKS: { probe: string; label: string }[] = [
    { probe: 'trabaj', label: 'A qué me dedico' },
    { probe: 'objetiv', label: 'Mis objetivos ahora' },
    { probe: 'prefier', label: 'Cómo prefiero que me hables' },
    { probe: 'rutin',   label: 'Mi rutina y horarios' },
  ]
  for (const f of FALLBACKS) {
    if (out.length >= max) break
    if (!profile.includes(f.probe)) out.push(f.label)
  }
  return out.slice(0, max)
}

// `maybeOfferProfileChat` (el aviso de la sidebar cada semana) se retiró el 15
// sep 2026: "Fromly quiere saber más de ti" llega ahora al chat desde el
// servidor, ya con la pregunta dentro — server/src/services/assistantProfileAsk.ts.
