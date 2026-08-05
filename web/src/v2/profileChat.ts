// CHAT DE PERFIL — conversaciones cuyo único fin es ampliar lo que Fromly sabe
// del usuario (Alberto, 5 ago 2026: "al darle a perfil, en la columna derecha
// aparecerá el chat con la pregunta ¿Qué quieres añadir a tu perfil?... la IA lo
// adaptará para que encaje en el perfil y lo añadirá directamente, avisando al
// usuario... además, de vez en cuando Fromly de forma proactiva iniciará una
// conversación para preguntarle si quiere añadir algo nuevo").
//
// Cómo encaja con lo que ya existía:
//  · El PERFIL en sí no cambia: sigue siendo el nodo `_perfilIA` (api/userKnowledge),
//    que ya se inyecta en todas las conversaciones y agentes.
//  · La ESCRITURA tampoco se reinventa: `aiChatStore.learnFromUserMessage` ya
//    extraía hechos de cada mensaje del usuario y los guardaba con
//    `saveUserKnowledgeToProfile`. Lo que faltaba era (a) un sitio donde eso sea el
//    objetivo explícito de la conversación, (b) que Fromly DIGA lo que ha guardado,
//    y (c) que sepa arrancar la conversación él solo.
//  · Una sesión de perfil es un nodo de chat normal con `extraData._profileChat='1'`.
//    Ese flag hace dos cosas: inyecta `PROFILE_CHAT_INSTRUCTIONS` en el turno
//    (aiChatStore.buildPayload) y activa el aviso de "he añadido esto a tu perfil".
import { store } from '../store/nodeStore'
import { aiChatStore } from '../store/aiChatStore'
import { parseExtraData, isInPapelera } from '../utils/papeleraHelper'
import { listMarkedContexts } from '../utils/cajones'
import { readProfileLines } from '../api/userKnowledge'
import type { Node } from '../types'

/** Marca del nodo de sesión. */
const PROFILE_CHAT_FLAG = '_profileChat'
/** Última vez que Fromly ofreció ampliar el perfil por su cuenta (epoch ms). */
const LAST_PROACTIVE_KEY = 'from_profile_proactive_at'
/** Cada cuánto puede ofrecerlo, como mucho. Una semana: el perfil es información
 *  de fondo que cambia despacio; preguntar más a menudo cansa y se ignora. */
const PROACTIVE_EVERY_MS = 7 * 24 * 60 * 60 * 1000
/** Nada de proponer nada en una cuenta recién estrenada: sin material del que tirar,
 *  las sugerencias salen genéricas y la pregunta parece un formulario. */
const MIN_NEW_ITEMS = 5

export function isProfileChatSession(n: Node | null | undefined): boolean {
  if (!n) return false
  return parseExtraData(n.extraData)[PROFILE_CHAT_FLAG] === '1'
}

/** Instrucciones que se inyectan en el turno cuando la conversación es de perfil.
 *  Van dentro de `userProfile` (ver aiChatStore.buildPayload): es el único canal
 *  libre hacia el system prompt del servidor, así que este sistema no necesita
 *  desplegar servidor. */
export const PROFILE_CHAT_INSTRUCTIONS = `[MODO PERFIL]
Esta conversación sirve para ampliar el PERFIL del usuario: quién es, a qué se dedica, sus proyectos, sus metas, sus preferencias y su forma de trabajar. Reglas de este modo:
- NO crees notas, tareas, eventos ni documentos. En esta conversación no se crea nada.
- Lo que cuente el usuario se guarda solo en su perfil, y de eso ya se encarga Fromly por su cuenta: no anuncies tú que lo has guardado ni lo repitas literalmente.
- Responde MUY breve (1-2 frases) y termina SIEMPRE con UNA sola repregunta concreta que profundice en lo que acaba de contar, para tener información más útil. Nada de listas de preguntas.
- Si lo que dice ya está en el perfil, dilo en una frase y pregunta por otra cosa distinta.
- Tono directo y natural, sin florituras ni entusiasmo impostado.`

// ── Aperturas ───────────────────────────────────────────────────────────────
// Varias, para que abrir el perfil dos veces seguidas no dé exactamente la misma
// pantalla (Alberto: "o preguntas similares cada vez").
const OPENERS = [
  '¿Qué quieres añadir a tu perfil?',
  '¿Qué debería saber de ti que todavía no sepa?',
  'Cuéntame algo tuyo que me ayude a entenderte mejor.',
  '¿Hay algo nuevo en lo que estés metido que quieras que tenga en cuenta?',
  '¿Qué te gustaría que recordara siempre sobre ti?',
]

/** Una apertura distinta de la anterior (memoria de una sola posición: basta para
 *  que no se repita dos veces seguidas, que es lo que se nota). */
let lastOpener = -1
function pickOpener(): string {
  if (OPENERS.length < 2) return OPENERS[0]
  let i = Math.floor(Math.random() * OPENERS.length)
  if (i === lastOpener) i = (i + 1) % OPENERS.length
  lastOpener = i
  return OPENERS[i]
}

// ── Sugerencias ─────────────────────────────────────────────────────────────

/** Temas que Fromly puede proponer, sacados de lo que el usuario ha estado usando
 *  de verdad — no de una lista fija. Los contextos con actividad reciente son la
 *  mejor pista: si has trabajado toda la semana en «Lanzamiento Aurora», eso es lo
 *  que falta en tu perfil. Se completan con temas de fondo que casi ningún perfil
 *  tiene cubiertos, filtrando los que ya están escritos. */
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

// ── Apertura manual (botón «Perfil») ────────────────────────────────────────

/** Abre en la columna derecha una conversación NUEVA para ampliar el perfil.
 *  Devuelve el id de la sesión. */
export function openProfileChat(): string {
  return aiChatStore.openAssistantSession({
    title: 'Tu perfil',
    greeting: pickOpener(),
    chips: profileSuggestions(),
    flags: { [PROFILE_CHAT_FLAG]: '1' },
  })
}

// ── Apertura proactiva ──────────────────────────────────────────────────────

/** ¿Hay una conversación de perfil ya creada y todavía sin responder? Evita
 *  acumular varias si el usuario no entra en la que le propusimos la semana
 *  pasada (el aviso de la sidebar diría "2 conversaciones esperando" por algo que
 *  en realidad es lo mismo repetido). */
function hasUnansweredProfileChat(): boolean {
  return store.allActive().some(n =>
    !n.deletedAt && isProfileChatSession(n) && !isInPapelera(n.id) &&
    parseExtraData(n.extraData)._pendingReply === '1')
}

/** Cuánto material NUEVO ha metido el usuario desde la última vez que se le
 *  ofreció — la señal de que hay algo de lo que hablar. */
function itemsCreatedSince(sinceMs: number): number {
  let n = 0
  for (const node of store.allActive()) {
    if (node.deletedAt || !(node.text || '').trim()) continue
    const ed = parseExtraData(node.extraData)
    if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) continue
    if (node.isDiaryEntry) continue
    const t = Date.parse(node.createdAt || '')
    if (!isNaN(t) && t > sinceMs) n++
  }
  return n
}

/**
 * Ofrece ampliar el perfil, si toca. NO abre nada: crea la conversación con
 * `_pendingReply='1'`, que es lo que hace que salga como aviso en la sidebar
 * (mismo mecanismo que las conversaciones de agente, `listPendingAgentConversations`).
 * El usuario entra cuando quiere.
 *
 * Se llama al arrancar la app (V2App). Condiciones, todas necesarias:
 *   · ha pasado al menos una semana desde la última vez,
 *   · no hay ya una propuesta sin responder,
 *   · y el usuario ha metido suficiente material nuevo desde entonces.
 *
 * Devuelve el id de la sesión creada, o null si no tocaba.
 */
export function maybeOfferProfileChat(): string | null {
  let last = 0
  try { last = parseInt(localStorage.getItem(LAST_PROACTIVE_KEY) || '0', 10) || 0 } catch { /* sin storage */ }
  const now = Date.now()

  // Primera vez: no preguntar de golpe nada más entrar — se guarda la marca y se
  // empieza a contar desde hoy.
  if (!last) {
    try { localStorage.setItem(LAST_PROACTIVE_KEY, String(now)) } catch { /* noop */ }
    return null
  }
  if (now - last < PROACTIVE_EVERY_MS) return null
  if (hasUnansweredProfileChat()) return null
  if (itemsCreatedSince(last) < MIN_NEW_ITEMS) return null

  const suggestions = profileSuggestions()
  const greeting = [
    'Llevo un tiempo viendo en qué andas y hay cosas que todavía no tengo en tu perfil.',
    suggestions.length
      ? `¿Te apetece contarme algo de esto? También puedes escribirme cualquier otra cosa.`
      : '¿Quieres contarme algo nuevo sobre ti? Lo añado a tu perfil.',
  ].join(' ')

  const sid = aiChatStore.openAssistantSession({
    title: 'Ampliar tu perfil',
    greeting,
    chips: suggestions,
    flags: { [PROFILE_CHAT_FLAG]: '1', _pendingReply: '1' },
    open: false,
  })
  try { localStorage.setItem(LAST_PROACTIVE_KEY, String(now)) } catch { /* noop */ }
  return sid
}
