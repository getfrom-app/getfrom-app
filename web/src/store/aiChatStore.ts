// MARK: - AIChatStore
//
// Store del chat Fromly AI en web. Multi-turno con tool-use (paridad Mac).
//
// Estructura de nodos por sesión:
//   📅 Diario de hoy
//     └── ✦ [Título de la conversación]    extraData._aiSession="1", colapsado
//           ├── 💬 Conversación             extraData._aiTranscript="1", colapsado
//           │     body = transcripción completa (usuario + Magic)
//           └── [nodos creados por Magic: tareas, notas, eventos…]
//
// Si la conversación se retoma (loadSession), se AÑADE al transcript y se
// crean los nuevos nodos bajo el mismo nodo de sesión, sin tocar el contenido anterior.

import { store, type NodeStore } from './nodeStore'
import type { Node } from '../types'
import { learningsStore } from './learningsStore'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { assignContext, isMarkedContext, firstContextOf } from '../utils/cajones'
import { resolvePrompt } from '../utils/promptsHelper'
import { isInPapelera, parseExtraData } from '../utils/papeleraHelper'

export interface UndoBundle {
  createdIds: string[]        // node IDs to delete on undo
  restoredNodes: Array<{      // nodes to restore to previous state
    id: string
    prevText: string
    prevBody: string | null
    prevStatus: string | null
    prevDue: string | null
    prevTypes: string[]
    prevExtraData: string
  }>
  userMsgContent?: string     // mensaje del usuario para "Hazlo de nuevo"
  currentNodeId?: string      // contexto del nodo para reenviar
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions: ExecutedAction[]
  /** Chips de acción sugeridos por la IA al final del mensaje */
  chips?: string[]
  /** Bundle para deshacer las acciones de escritura de este turno */
  undoBundle?: UndoBundle
  /** Si el mensaje vino de voz: key del audio en R2 (se reproduce dentro del chat). */
  audioKey?: string
  audioDuration?: number
}

/** Parsea y elimina {{chips:[...]}} del texto. Devuelve texto limpio + chips.
 *  Busca el bloque en CUALQUIER posición (no solo anclado al final) y SIEMPRE lo
 *  quita del texto aunque el JSON de dentro esté mal formado — el marcador crudo
 *  NUNCA debe llegar a `cleanText` (antes, un JSON inválido dejaba `{{chips:...}}`
 *  visible tal cual en el chat). */
export function parseChips(text: string): { cleanText: string; chips: string[] } {
  const match = text.match(/\{\{chips:([\s\S]*?)\}\}/)
  if (!match || match.index == null) return { cleanText: text, chips: [] }
  const cleanText = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim()
  try {
    const parsed = JSON.parse(match[1])
    return { cleanText, chips: Array.isArray(parsed) ? parsed.slice(0, 4) : [] }
  } catch { return { cleanText, chips: [] } }
}

/** Quita los bloques ```from-action``` (completos o el parcial que aún se
 *  estaba escribiendo cuando se cortó el stream) y cualquier {{chips:...}}
 *  suelto — mismo patrón que `stripActions` en V2Chat.tsx (duplicado ahí
 *  porque se aplica en cada render de la burbuja en vivo), usado aquí para
 *  limpiar el texto ANTES de persistirlo en el transcript. */
function stripActionBlocksForDisplay(s: string): string {
  return s
    .replace(/```from-action[\s\S]*?```/g, '')
    .replace(/```from-action[\s\S]*$/, '')
    .replace(/\{\{chips:[\s\S]*?\}\}/g, '')
    // Red de seguridad: ver el mismo replace en stripActions (V2Chat.tsx).
    .replace(/<\/?function_calls?>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** Conversaciones abiertas PROACTIVAMENTE por un agente (openAgentConversation,
 *  servidor) que siguen esperando la primera respuesta del usuario — Fase 0 del
 *  aviso de agentes conversacionales: sin push real (no existe canal para avisar
 *  con la app cerrada, ver diseño 15 jul), así que se muestran destacadas la
 *  próxima vez que se abre la app en vez de perderse como una nota silenciosa. */
export function listPendingAgentConversations(): Node[] {
  return store.allActive().filter(n => ed(n)._pendingReply === '1' && !isInPapelera(n.id))
}

/** ¿Es esta sesión `_aiSession` una cáscara vacía o "casi vacía" — sin mensajes
 *  reales, sin audio, sin nada creado dentro, o con solo el saludo del
 *  asistente y NINGÚN turno real del usuario? Mismo criterio que
 *  `discardEmptyVoiceSession` (arriba de `AIChatStore`), pero sin depender de
 *  `this.messages` (esa versión solo sirve para la sesión activa en memoria) —
 *  aquí se comprueba cualquier nodo desde sus hijos reales, para poder barrer
 *  TODAS las sesiones vacías, no solo la que se acaba de abandonar.
 *
 *  Ampliado el 31 ago 2026 (Alberto: "hay muchas conversaciones casi vacías
 *  que son antiguas... las puedes eliminar directamente"): una sesión sin
 *  ningún turno de rol `user` no es una conversación real, aunque tenga un
 *  mensaje de bienvenida del asistente — se descarta igual, salvo que siga
 *  esperando activamente esa primera respuesta (`_pendingReply`, ver
 *  `listPendingAgentConversations`), que se enseña aparte a propósito. */
function isEmptyAiSession(n: Node): boolean {
  if (n.isDiaryEntry) return false
  const e = ed(n)
  if (e._pendingReply === '1') return false
  if (Array.isArray(e._audios) && e._audios.length > 0) return false
  const children = store.children(n.id)
  const transcript = children.find(c => ed(c)._aiTranscript === '1')
  const realChildren = children.filter(c => c.id !== transcript?.id)
  if (realChildren.length > 0) return false
  if (!transcript) return true
  const msgs = store.children(transcript.id).filter(m => !m.deletedAt && ed(m)._aiMsgRole)
  return !msgs.some(m => ed(m)._aiMsgRole === 'user')
}

/** Barre y borra (a la papelera, con undo) las sesiones `_aiSession` vacías —
 *  el "chat antiguo" del destino Chat general dejaba cáscaras sin mensajes al
 *  crear una sesión (`startNewSession`) que nunca llegaba a recibir el primer
 *  turno de verdad (30 ago 2026, Alberto: "cualquier chat creado que esté
 *  vacío elimínalo... había algún bug antiguo por el que se creaban chats
 *  vacíos"). Se llama una vez por arranque desde `runStartupMigrations` —
 *  idempotente por diseño: una sesión ya borrada no vuelve a aparecer en
 *  `store.allActive()`. Devuelve cuántas borró (solo para logging). */
export function cleanupEmptyAiSessions(): number {
  const empties = store.allActive().filter(n => ed(n)._aiSession === '1' && isEmptyAiSession(n))
  for (const n of empties) store.deleteNode(n.id)
  return empties.length
}

/** Quita el aviso "N conversaciones esperando" de la sidebar para una sesión
 *  concreta — se llama al ABRIR la conversación (V2App.onOpenConversation), no
 *  solo al responder. Antes SOLO se limpiaba en send() al enviar el primer
 *  mensaje, así que el botón seguía diciendo "2 conversaciones esperando"
 *  después de abrir y leer una de ellas (Alberto, 29 jul: "al abrir una
 *  debería poner 1 conversación esperando") — el aviso es para que no se te
 *  pase por alto, no para forzar una respuesta inmediata; una vez la has
 *  visto, ya ha cumplido su función. */
/** La conversación que creó un nodo (si la hay): las acciones de escritura de la IA
 *  parentan lo creado bajo la sesión (`aiChatExecutor.ts`), así que basta subir por
 *  `parentId` hasta encontrar el nodo `_aiSession`. Tope de 10 niveles por seguridad.
 *  (Movido aquí desde V2App.tsx — lo necesita también `getOrCreateElementSession`.) */
export function findOriginSession(id: string): string | null {
  let cur = store.getNode(id)
  let guard = 0
  while (cur && guard++ < 10) {
    if (parseExtraData(cur.extraData)._aiSession === '1') return cur.id
    cur = cur.parentId ? store.getNode(cur.parentId) : undefined
  }
  return null
}

export function markPendingConversationSeen(sessionId: string): void {
  const n = store.getNode(sessionId)
  if (!n) return
  const e = ed(n)
  if (e._pendingReply !== '1') return
  delete e._pendingReply
  store.updateNode(sessionId, { extraData: JSON.stringify(e) })
}

/** Resultados de agentes AUTÓNOMOS (no conversacionales) que el cron del servidor
 *  acaba de escribir (writeAgentResultToDiary, `_agentResultUnseen='1'`) y el
 *  usuario todavía no ha abierto — equivalente de listPendingAgentConversations
 *  para el caso "agente que ejecuta y guarda un documento" en vez de "agente que
 *  pregunta y espera respuesta" (28 jul: antes un informe terminado no tenía
 *  ningún aviso en la web). Se marca como visto al abrirlo (ver onOpenNode en
 *  V2App.tsx), nunca por temporizador — así no se pierde si el usuario no ha
 *  abierto la app en varios días. */
export function listUnseenAgentResults(): Node[] {
  return store.allActive().filter(n => ed(n)._agentResultUnseen === '1' && !isInPapelera(n.id))
}

/** Marca un resultado de agente como visto (deja de avisar en la sidebar). No-op
 *  si el nodo no tiene el flag. */
export function markAgentResultSeen(nodeId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  if (e._agentResultUnseen !== '1') return
  delete e._agentResultUnseen
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

export interface ExecutedAction {
  action: string
  ok: boolean
  summary: string
  createdIds: string[]
}

/** Acción de escritura propuesta por la IA, pendiente de confirmación del usuario. */
export interface PendingAction {
  id: string
  actionType: string
  editedTitle: string
  editedTags: string[]
  rawAction: Record<string, unknown>
}

type Listener = () => void

interface PendingContext {
  currentNodeId: string | undefined
  sessionId: string
  readResults: ExecutedAction[]
}

class AIChatStore {
  sessionId: string | null = null
  messages: ChatMessage[] = []
  isStreaming = false
  actionStatus: string | null = null
  lastError: string | null = null
  /** Acciones de escritura pendientes de confirmación. null = nada pendiente. */
  pendingActions: PendingAction[] | null = null

  /** Prompt activo (sistema de Prompts). null = ninguno. Se inyecta en buildPayload. */
  activePromptId: string | null = null
  /** true si el prompt activo se activó automáticamente (por contexto), no por el usuario. */
  activePromptAuto = false

  /** Texto pendiente de cargar en el input de Magic (al elegir un prompt el usuario:
   *  su texto resuelto va al input para editarlo o enviarlo con Enter). MagicChat lo
   *  consume al montarse/cambiar. null = nada pendiente. */
  pendingInput: string | null = null

  /** Nodo al que pertenece la conversación en memoria (para resetear al cambiar de nodo). */
  boundNodeKey: string | null = null

  /** Audio de la grabación pendiente de adjuntar al NODO de la conversación (✦).
   * Se acumulan en extraData._audios; se ven en la columna derecha al abrir el nodo. */
  pendingVoiceAudio: { audioKey: string; transcript: string; durationSec: number } | null = null
  setPendingVoiceAudio(v: { audioKey: string; transcript: string; durationSec: number } | null) { this.pendingVoiceAudio = v }

  /** Inicia (si no existe) el nodo de la conversación de voz y NAVEGA a él. Se llama
   * al EMPEZAR a grabar: la nota se abre a la izquierda de inmediato y se va rellenando. */
  startVoiceSession() {
    if (!this.sessionId) {
      this.sessionId = this.createSessionNode('Nota de voz')
      this.notify()
    }
    window.dispatchEvent(new CustomEvent('from:open-node', { detail: { nodeId: this.sessionId } }))
  }

  /** Si la conversación de voz se canceló sin enviar nada (sin mensajes ni audio),
   * borra el nodo vacío que se creó al empezar a grabar. */
  discardEmptyVoiceSession() {
    const sid = this.sessionId
    if (!sid) return
    const node = store.getNode(sid)
    if (!node) { this.startNewSession(); return }
    // SEGURIDAD: solo borrar si es REALMENTE un nodo de conversación (✦) vacío. Nunca
    // tocar notas diarias, nodos con contenido, etc. (evita borrar tareas por error).
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { ed = {} }
    const isSessionNode = ed._aiSession === '1'
    const hasAudio = Array.isArray(ed._audios) && ed._audios.length > 0
    // Hijos que NO sean el contenedor de transcripción (💬) → hay contenido real, no borrar.
    const realChildren = store.children(sid).filter(c => {
      try { return JSON.parse(c.extraData || '{}')._aiTranscript !== '1' } catch { return true }
    })
    if (isSessionNode && this.messages.length === 0 && !hasAudio && realChildren.length === 0 && !node.isDiaryEntry) {
      for (const c of store.children(sid)) store.deleteNode(c.id)
      store.deleteNode(sid)
      this.startNewSession()
      // No dejar la ruta apuntando al nodo borrado ("Nodo no encontrado"): volver al diario.
      try {
        const today = getTodayDiaryUnderAgenda()
        if (today) window.dispatchEvent(new CustomEvent('from:open-node', { detail: { nodeId: today.id } }))
      } catch { /* */ }
    }
  }

  /** El próximo montaje de Magic debe iniciar grabación (evita la carrera del setTimeout). */
  private _pendingRecord = false
  requestStartRecording() { this._pendingRecord = true }
  consumePendingRecord(): boolean { const v = this._pendingRecord; this._pendingRecord = false; return v }

  private _pendingContext: PendingContext | null = null
  private listeners = new Set<Listener>()

  /** Activa (o desactiva con null) un prompt para la conversación actual. */
  setActivePrompt(promptId: string | null, auto = false) {
    if (this.activePromptId === promptId && this.activePromptAuto === auto) return
    this.activePromptId = promptId
    this.activePromptAuto = auto
    this.notify()
  }

  /** El usuario elige un prompt → su TEXTO resuelto va al input de Magic (editable),
   *  no como instrucción de fondo. Así basta con Enter para que actúe sobre el nodo
   *  actual; o puede añadir más antes de enviar. */
  loadPromptIntoInput(promptId: string, currentNodeId?: string) {
    let text = ''
    try { text = (resolvePrompt(promptId, { currentNodeId }) || '').trim() } catch { text = '' }
    if (!text) return
    this.activePromptId = null   // no duplicar como instrucción activa
    this.activePromptAuto = false
    this.pendingInput = text
    this.notify()
  }
  /** Consume (lee y limpia) el texto pendiente para el input. Sin notify (es lectura). */
  consumePendingInput(): string | null {
    const t = this.pendingInput
    this.pendingInput = null
    return t
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
  private notify() { this.listeners.forEach(fn => fn()) }

  startNewSession() {
    this.sessionId = null
    this.messages = []
    this.actionStatus = null
    this.lastError = null
    this.isStreaming = false
    this.pendingActions = null
    this._pendingContext = null
    this.boundNodeKey = null
    this.pendingVoiceAudio = null
    // No mezclar prompts entre conversaciones de distintos nodos
    this.activePromptId = null
    this.activePromptAuto = false
    this.notify()
  }

  /** Devuelve la sesión activa; si no hay, crea una nueva (con seed opcional). Vincula al
   * contexto si `currentNodeId` es un contexto. Se usa al adjuntar archivos sin haber
   * escrito aún: el adjunto crea/usa una conversación para poder hablar de él. */
  ensureSession(seed = 'Conversación', currentNodeId?: string): string {
    if (this.sessionId) return this.sessionId
    this.sessionId = this.createSessionNode(seed)
    if (currentNodeId) {
      try { if (isMarkedContext(store.getNode(currentNodeId)!)) assignContext(this.sessionId, currentNodeId) } catch { /* noop */ }
    }
    this.notify()
    return this.sessionId
  }

  /** Conversación asociada a UN elemento (documento/tarea/recurso/agente/prompt) —
   *  SIEMPRE la misma, nunca una nueva aislada cada vez que se abre su tab «Chat»
   *  (Alberto, 30 jul: "cada documento tenga un chat en el que poder hablar de ese
   *  elemento", no un elemento nuevo desconectado del documento del que habla).
   *  Prioridad: (1) si el nodo nació DENTRO de una conversación, esa es la suya
   *  (`findOriginSession` — ya la carga `onOpenNode` de forma síncrona al abrir,
   *  así que normalmente esta función no tiene que hacer nada); (2) si ya se
   *  habló de él antes, `extraData._chatSessionId` la recuerda; (3) si no,
   *  se crea una vez y se enlaza al nodo para las próximas veces. Hereda el
   *  contexto del elemento (si tiene) para que la conversación aparezca en su
   *  ficha, y guarda `_aboutNodeId` en la sesión para poder mostrar de qué habla. */
  getOrCreateElementSession(nodeId: string): string {
    const origin = findOriginSession(nodeId)
    if (origin) {
      if (this.sessionId !== origin) this.loadSession(origin)
      return origin
    }
    const node = store.getNode(nodeId)
    if (!node) return this.ensureSession()
    const e = parseExtraData(node.extraData)
    const linked = typeof e._chatSessionId === 'string' ? e._chatSessionId : null
    if (linked) {
      const linkedNode = store.getNode(linked)
      if (linkedNode && !linkedNode.deletedAt) {
        if (this.sessionId !== linked) this.loadSession(linked)
        return linked
      }
    }
    const sid = this.createSessionNode(node.text || 'Conversación')
    store.updateNode(nodeId, { extraData: JSON.stringify({ ...e, _chatSessionId: sid }) })
    try { const ctx = firstContextOf(node); if (ctx) assignContext(sid, ctx.id) } catch { /* noop */ }
    const sessionNode = store.getNode(sid)
    if (sessionNode) {
      const se = parseExtraData(sessionNode.extraData)
      store.updateNode(sid, { extraData: JSON.stringify({ ...se, _aboutNodeId: nodeId }) })
    }
    this.loadSession(sid)
    return sid
  }

  /** Añade un aviso (mensaje de Magic) al chat sin llamar a la IA. Efímero: informa de
   * algo que acaba de pasar (p. ej. «he incorporado este PDF»). */
  addNotice(content: string, chips?: string[]) {
    this.messages.push({ id: crypto.randomUUID(), role: 'assistant', content, actions: [], chips })
    this.notify()
  }

  /** Inyectar un par user+assistant directamente, sin llamar al AI. Para onboarding. */
  injectMessages(userContent: string, assistantContent: string) {
    const userId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()
    this.messages.push({ id: userId, role: 'user', content: userContent, actions: [] })
    this.messages.push({ id: assistantId, role: 'assistant', content: assistantContent, actions: [] })
    this.notify()
  }

  loadSession(nodeId: string) {
    const node = store.nodes.get(nodeId)
    if (!node) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._aiSession !== '1') return
    } catch { return }

    this.sessionId = nodeId
    this.boundNodeKey = nodeId
    this.loadMessagesFromNode(nodeId)   // recargar la conversación (incl. audios) en el chat

    // Chips de apertura de una conversación iniciada por Fromly: se devuelven al
    // primer mensaje mientras el usuario no haya contestado (una vez responde, las
    // sugerencias ya no vienen a cuento).
    if (this.messages.length === 1 && this.messages[0].role === 'assistant') {
      try {
        const raw = JSON.parse(node.extraData || '{}')._openChips
        const chips = raw ? JSON.parse(raw) : null
        if (Array.isArray(chips) && chips.length) this.messages[0] = { ...this.messages[0], chips }
      } catch { /* sin chips guardados */ }
    }

    // Si la sesión tiene mensajes individuales legacy (_aiRole), los migramos al transcript
    // y los eliminamos para no duplicar contenido
    const legacyMessages = store.children(nodeId).filter(c => {
      try { const ed = JSON.parse(c.extraData || '{}'); return !!ed._aiRole } catch { return false }
    })
    if (legacyMessages.length > 0) {
      const transcriptNode = store.children(nodeId).find(c => {
        try { return JSON.parse(c.extraData || '{}')._aiTranscript === '1' } catch { return false }
      })
      if (!transcriptNode) {
        // Crear transcript y migrar mensajes legacy como nodos hijos
        const t = store.createNode({ text: 'Conversación', parentId: nodeId, extraData: { _aiTranscript: '1' } })
        store.setCollapsedLocal(t.id, true)
        for (const m of legacyMessages) {
          const ed = JSON.parse(m.extraData || '{}')
          const label = ed._aiRole === 'user' ? 'Tú' : 'Magic'
          store.createNode({
            text:     `${label}: ${m.text}`,
            parentId: t.id,
            extraData: { _aiMsgRole: ed._aiRole },
          })
        }
      }
      legacyMessages.forEach(m => store.updateNode(m.id, { deletedAt: new Date().toISOString() }))
    }

    this.notify()
  }

  private createSessionNode(seed: string, extra?: Record<string, string>, title?: string): string {
    const today = getTodayDiaryUnderAgenda()
    const auto: Record<string, string> = title ? {} : { _aiAutoTitle: '1' }
    const sessionNode = store.createNode({
      // Sin el `✦` delante: Fromly ya no escribe emojis en los datos (ver
      // utils/displayText.ts). Las sesiones antiguas que lo llevan se limpian al pintar.
      text: title || seed.slice(0, 60),
      parentId: today.id,
      extraData: { _aiSession: '1', _aiSessionSeed: seed.slice(0, 80), ...auto, ...(extra || {}) },
    })
    store.setCollapsedLocal(sessionNode.id, true)

    // Nodo contenedor del transcript — sus hijos son los mensajes individuales
    const transcript = store.createNode({
      text: 'Conversación',
      parentId: sessionNode.id,
      extraData: { _aiTranscript: '1' },
    })
    store.setCollapsedLocal(transcript.id, true)

    return sessionNode.id
  }

  /** Crea una conversación que EMPIEZA Fromly (no el usuario): la sesión nace con
   *  flags propios y con el primer mensaje del asistente ya escrito y persistido.
   *  Base de los chats de perfil (v2/profileChat.ts) — y de cualquier otra cosa que
   *  Fromly quiera iniciar por su cuenta en el futuro.
   *
   *  `open: false` deja la conversación creada pero SIN cargarla: es el modo
   *  proactivo (aparece como aviso en la sidebar y el usuario decide cuándo entrar).
   *  Devuelve el id de la sesión. */
  openAssistantSession(opts: {
    title: string
    greeting: string
    chips?: string[]
    flags?: Record<string, string>
    open?: boolean
  }): string {
    // Los chips van en el NODO de sesión, no en el mensaje: el transcript solo
    // guarda rol + texto, así que una conversación creada en modo proactivo
    // (`open: false`) perdería sus sugerencias al abrirla días después. Se
    // recuperan en `loadSession`.
    const flags = { ...(opts.flags || {}) }
    if (opts.chips?.length) flags._openChips = JSON.stringify(opts.chips)
    const sid = this.createSessionNode(opts.greeting, flags, opts.title)
    this.appendToTranscript(sid, 'assistant', opts.greeting)
    if (opts.open !== false) {
      this.sessionId = sid
      this.boundNodeKey = sid
      this.messages = [{ id: crypto.randomUUID(), role: 'assistant', content: opts.greeting, actions: [], chips: opts.chips }]
      this.actionStatus = null
      this.lastError = null
      this.isStreaming = false
      this.pendingActions = null
      this._pendingContext = null
      this.notify()
    }
    return sid
  }

  /** Añade un mensaje como nodo hijo del transcript. Guarda rol + contenido limpio +
   * (si es voz) audioKey, para poder RECARGAR la conversación al abrir el nodo.
   * El texto se limpia de bloques ```from-action``` (y cualquier {{chips:...}}
   * suelto) ANTES de persistir — antes solo se limpiaba al pintar la burbuja en
   * vivo (`stripActions` en V2Chat.tsx), así que el nodo guardado en el árbol
   * conservaba el JSON crudo de la acción; buscarlo luego en Elementos o volver
   * a abrir la conversación lo enseñaba tal cual, sin formatear (Alberto, 30 jul:
   * encontró el mensaje con el JSON en crudo buscando en Elementos). */
  private appendToTranscript(sessionId: string, role: 'user' | 'assistant', text: string, audioKey?: string, audioDuration?: number) {
    const clean = stripActionBlocksForDisplay(text)
    if (!clean.trim()) return
    const transcriptNode = store.children(sessionId).find(c => {
      try { return JSON.parse(c.extraData || '{}')._aiTranscript === '1' } catch { return false }
    })
    if (!transcriptNode) return
    const label = role === 'user' ? 'Tú' : 'Magic'
    const ed: Record<string, string> = { _aiMsgRole: role, _aiMsgContent: clean }
    if (audioKey) { ed._audioKey = audioKey; if (audioDuration) ed._audioDuration = String(audioDuration) }
    store.createNode({
      text:     `${label}: ${clean}`,   // texto legible en el árbol
      parentId: transcriptNode.id,
      extraData: ed,
    })
  }

  /** Reconstruye this.messages desde los nodos hijos del transcript (para recargar la
   * conversación al abrir el nodo). Incluye el audioKey de los mensajes de voz. */
  private loadMessagesFromNode(sessionId: string) {
    const transcriptNode = store.children(sessionId).find(c => {
      try { return JSON.parse(c.extraData || '{}')._aiTranscript === '1' } catch { return false }
    })
    if (!transcriptNode) { this.messages = []; return }
    const msgs: ChatMessage[] = []
    for (const c of store.children(transcriptNode.id)) {
      if (c.deletedAt) continue
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(c.extraData || '{}') } catch { continue }
      const role = ed._aiMsgRole === 'assistant' ? 'assistant' : ed._aiMsgRole === 'user' ? 'user' : null
      if (!role) continue
      const content = typeof ed._aiMsgContent === 'string' ? ed._aiMsgContent : (c.text || '').replace(/^(Tú|Magic):\s*/, '')
      msgs.push({
        id: c.id, role, content, actions: [],
        audioKey: typeof ed._audioKey === 'string' ? ed._audioKey : undefined,
        audioDuration: ed._audioDuration ? parseInt(String(ed._audioDuration), 10) : undefined,
      })
    }
    this.messages = msgs
  }

}

export const aiChatStore = new AIChatStore()

// React hook
import { useEffect, useState } from 'react'
export function useAIChat() {
  const [, setTick] = useState(0)
  useEffect(() => aiChatStore.subscribe(() => setTick(t => t + 1)), [])
  return aiChatStore
}

// Re-export NodeStore type for the executor file
export type { NodeStore }
