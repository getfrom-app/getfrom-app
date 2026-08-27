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
import { store } from '../store/nodeStore'
import { assistantStore } from '../store/assistantStore'
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

/** Última vez que Fromly ofreció ampliar el perfil por su cuenta (epoch ms). */
const LAST_PROACTIVE_KEY = 'from_profile_proactive_at'
/** Cada cuánto puede ofrecerlo, como mucho. Una semana: el perfil es información
 *  de fondo que cambia despacio; preguntar más a menudo cansa y se ignora. */
const PROACTIVE_EVERY_MS = 7 * 24 * 60 * 60 * 1000
/** Nada de proponer nada en una cuenta recién estrenada: sin material del que tirar,
 *  las sugerencias salen genéricas y la pregunta parece un formulario. */
const MIN_NEW_ITEMS = 5

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

/** Cuánto material NUEVO ha metido el usuario desde la última vez que se le
 *  ofreció — la señal de que hay algo de lo que hablar. */
function itemsCreatedSince(sinceMs: number): number {
  let n = 0
  for (const node of store.allActive()) {
    if (node.deletedAt || !(node.text || '').trim()) continue
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* vacío */ }
    if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) continue
    if (node.isDiaryEntry) continue
    const t = Date.parse(node.createdAt || '')
    if (!isNaN(t) && t > sinceMs) n++
  }
  return n
}

/**
 * Ofrece ampliar el perfil, si toca — solo marca el aviso de la sidebar
 * (`assistantStore.offerProfileNudge`), no llama al servidor todavía (eso
 * pasa al abrirlo, `assistantStore.askProfileQuestion`). Se llama al arrancar
 * la app (V2App). Condiciones, todas necesarias:
 *   · ha pasado al menos una semana desde la última vez,
 *   · no hay ya un aviso sin abrir,
 *   · y el usuario ha metido suficiente material nuevo desde entonces.
 */
export function maybeOfferProfileChat(): void {
  let last = 0
  try { last = parseInt(localStorage.getItem(LAST_PROACTIVE_KEY) || '0', 10) || 0 } catch { /* sin storage */ }
  const now = Date.now()

  // Primera vez: no preguntar de golpe nada más entrar — se guarda la marca y se
  // empieza a contar desde hoy.
  if (!last) {
    try { localStorage.setItem(LAST_PROACTIVE_KEY, String(now)) } catch { /* noop */ }
    return
  }
  if (now - last < PROACTIVE_EVERY_MS) return
  if (assistantStore.hasProfileNudge) return
  if (itemsCreatedSince(last) < MIN_NEW_ITEMS) return

  assistantStore.offerProfileNudge()
  try { localStorage.setItem(LAST_PROACTIVE_KEY, String(now)) } catch { /* noop */ }
}
