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
import { aiChatStream, aiInlineStream, type ChatActionResult, TokensError } from '../api/client'
import { executeChatAction } from './aiChatExecutor'
import { resolveTemplateCodes } from '../utils/templateCodes'
import { learningsStore } from './learningsStore'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { assignContext, isRootContext, isMarkedContext, firstContextOf, appendContextFacts } from '../utils/cajones'
import { resolvePrompt } from '../utils/promptsHelper'
import { isContextKnowledge } from '../utils/knowledgeNodes'
import { extractUserKnowledge } from '../api/autoClassify'
import { aiLangBase, aiLangBCP47 } from '../utils/aiLang'
import { saveUserKnowledgeToProfile, readProfileLines } from '../api/userKnowledge'
import { getAgentData } from '../utils/agentesHelper'
import { isInPapelera } from '../utils/papeleraHelper'

export interface UndoBundle {
  createdIds: string[]        // node IDs to delete on undo
  restoredNodes: Array<{      // nodes to restore to previous state
    id: string
    prevText: string
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

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Es una sesión de «solo comando» (créame una tarea, ponme un evento…) sin
 *  valor conversacional real? Criterio (decisión de Alberto): exactamente 1
 *  turno (1 mensaje tuyo + 1 de Magic), esa respuesta ejecutó al menos una
 *  acción de escritura (hay algo creado, hermano del transcript, bajo la
 *  sesión) y el texto de la respuesta es corto (confirmación, no contenido
 *  sustancial). Se usa para NO mostrarla en Historial — sigue en la BD y
 *  buscable, solo no ensucia la lista. En cuanto se añade un 2º mensaje deja
 *  de cumplir el criterio y aparece sola. */
export function isQuickCommandSession(sessionId: string): boolean {
  const transcript = store.children(sessionId).find(c => !c.deletedAt && ed(c)._aiTranscript === '1')
  if (!transcript) return false
  const msgs = store.children(transcript.id).filter(c => !c.deletedAt)
  const userMsgs = msgs.filter(m => ed(m)._aiMsgRole === 'user')
  const assistantMsgs = msgs.filter(m => ed(m)._aiMsgRole === 'assistant')
  if (userMsgs.length !== 1 || assistantMsgs.length !== 1) return false
  const createdSiblings = store.children(sessionId).filter(c => !c.deletedAt && c.id !== transcript.id)
  if (createdSiblings.length === 0) return false // no ejecutó ninguna acción → puede ser una pregunta real
  const content = ed(assistantMsgs[0])._aiMsgContent
  const text = (typeof content === 'string' ? content : (assistantMsgs[0].text || '')).trim()
  return text.length > 0 && text.length <= 160
}

/** Conversaciones abiertas PROACTIVAMENTE por un agente (openAgentConversation,
 *  servidor) que siguen esperando la primera respuesta del usuario — Fase 0 del
 *  aviso de agentes conversacionales: sin push real (no existe canal para avisar
 *  con la app cerrada, ver diseño 15 jul), así que se muestran destacadas la
 *  próxima vez que se abre la app en vez de perderse como una nota silenciosa. */
export function listPendingAgentConversations(): Node[] {
  return store.allActive().filter(n => ed(n)._pendingReply === '1' && !isInPapelera(n.id))
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

function makePendingAction(action: Record<string, unknown>): PendingAction {
  return {
    id: crypto.randomUUID(),
    actionType: (action.action as string) || '',
    editedTitle: (action.text as string) || (action.title as string) || 'Sin título',
    editedTags: (action.tags as string[]) || [],
    rawAction: action,
  }
}

function pendingToAction(pa: PendingAction): Record<string, unknown> {
  return { ...pa.rawAction, text: pa.editedTitle, tags: pa.editedTags.length ? pa.editedTags : pa.rawAction.tags }
}

const READ_ACTIONS = new Set(['read_node', 'find_nodes'])

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

  /** Añade un aviso (mensaje de Magic) al chat sin llamar a la IA. Efímero: informa de
   * algo que acaba de pasar (p. ej. «he incorporado este PDF»). */
  addNotice(content: string) {
    this.messages.push({ id: crypto.randomUUID(), role: 'assistant', content, actions: [] })
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
        const t = store.createNode({ text: '💬 Conversación', parentId: nodeId, extraData: { _aiTranscript: '1' } })
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

  async send(text: string, currentNodeId?: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    this.lastError = null
    this.pendingActions = null
    this._pendingContext = null
    // Vincular la conversación al nodo donde se inició (para empezar limpio al cambiar de nodo)
    if (this.boundNodeKey == null) this.boundNodeKey = currentNodeId ?? '∅'

    if (!this.sessionId) {
      this.sessionId = this.createSessionNode(trimmed)
      // Si la conversación nace DENTRO de un contexto (currentNodeId es un contexto,
      // no un nodo cualquiera enfocado), vincúlala a él → aparece en su Historial/ficha.
      if (currentNodeId) {
        const cn = store.getNode(currentNodeId)
        if (cn && (isRootContext(currentNodeId) || isMarkedContext(cn))) {
          try { assignContext(this.sessionId, currentNodeId) } catch { /* noop */ }
        }
      }
    }
    const sid = this.sessionId

    // Si esta sesión la abrió un agente proactivo y estaba esperando la PRIMERA
    // respuesta del usuario (_pendingReply='1', ver openAgentConversation en el
    // servidor), este mensaje la resuelve — deja de contar como pendiente en el
    // aviso de la barra lateral (listPendingAgentConversations).
    if (sid) {
      const sessionNode = store.getNode(sid)
      if (sessionNode) {
        try {
          const ed = JSON.parse(sessionNode.extraData || '{}')
          if (ed._pendingReply === '1') {
            delete ed._pendingReply
            store.updateNode(sid, { extraData: JSON.stringify(ed) })
          }
        } catch { /* ignore */ }
      }
    }

    // ¿Este mensaje viene de una grabación de voz? El audio se adjunta AL MENSAJE
    // (se reproduce dentro del chat) y la conversación se guarda en el nodo (se recarga
    // al abrirlo). La transcripción se acumula en el nodo solo para regenerar el resumen.
    const voice = this.pendingVoiceAudio
    this.pendingVoiceAudio = null
    if (voice && sid) {
      try {
        const node = store.getNode(sid)
        let ed: Record<string, unknown> = {}
        try { ed = JSON.parse(node?.extraData || '{}') } catch { ed = {} }
        const prevTx = typeof ed._audioTranscript === 'string' ? ed._audioTranscript : ''
        const consolidated = [prevTx, voice.transcript].filter(s => s && s.trim()).join('\n\n')
        store.updateNode(sid, { extraData: JSON.stringify({ ...ed, _audioTranscript: consolidated }) })
        import('../utils/recordingProcessor').then(m => m.restructureVoiceNote(sid)).catch(() => {})
        window.dispatchEvent(new CustomEvent('from:open-node', { detail: { nodeId: sid } }))
      } catch { /* no romper el turno */ }
    }

    const userMsgId = this.appendMessageNode(sid, 'user', trimmed)
    this.appendToTranscript(sid, 'user', trimmed, voice?.audioKey || undefined, voice?.durationSec)
    this.messages.push({ id: userMsgId, role: 'user', content: trimmed, actions: [], audioKey: voice?.audioKey || undefined, audioDuration: voice?.durationSec })
    if (sid) this.persistInlineLinks(sid, trimmed)
    this.notify()

    this.isStreaming = true

    // Loop de lectura: auto-ejecuta read_node/find_nodes; pausa al llegar escrituras.
    let accumulatedReadResults: ExecutedAction[] = []
    const maxReadTurns = 3
    for (let turn = 0; turn < maxReadTurns; turn++) {
      this.notify()
      const assistantMsgId = this.appendMessageNode(sid, 'assistant', '')
      this.messages.push({ id: assistantMsgId, role: 'assistant', content: '', actions: [] })
      this.notify()

      let assistantText = ''
      try {
        await aiChatStream(
          this.buildPayload(currentNodeId, accumulatedReadResults.map(e => ({
            action: e.action, ok: e.ok, summary: e.summary, ids: e.createdIds,
          }))),
          (chunk) => {
            assistantText += chunk
            const idx = this.messages.findIndex(m => m.id === assistantMsgId)
            if (idx >= 0) {
              this.messages[idx] = { ...this.messages[idx], content: assistantText }
              this.notify()
            }
          }
        )
        // Parsear y aplicar chips de seguimiento al mensaje assistant. Se actualiza
        // siempre que se haya encontrado un bloque `{{chips:...}}` (cleanText !==
        // original), no solo si el JSON de dentro era válido — así el marcador nunca
        // se queda visible en el chat aunque no se puedan derivar chips clicables.
        const { cleanText, chips } = parseChips(assistantText)
        if (cleanText !== assistantText) {
          const idx2 = this.messages.findIndex(m => m.id === assistantMsgId)
          if (idx2 >= 0) {
            this.messages[idx2] = { ...this.messages[idx2], content: cleanText, chips: chips.length ? chips : undefined }
            this.notify()
          }
        }
        // Persistir mensaje del asistente en el transcript (no hay nodo individual)
        this.appendToTranscript(sid, 'assistant', cleanText || assistantText)
      } catch (e) {
        this._handleAIError(e)
        this.isStreaming = false
        this.notify()
        return
      }

      const allActions = extractActions(assistantText)
      if (allActions.length === 0) break

      const readActions  = allActions.filter(a => READ_ACTIONS.has(a.action as string))
      const KNOWN_WRITE_ACTIONS = new Set(['create_note','create_document','create_task','create_event','create_context','create_agent','update_agent','create_prompt','create_resource','update_node','add_column','fill_column','add_row','change_view','run_prompt'])
      const writeActions = allActions.filter(a => {
        if (READ_ACTIONS.has(a.action as string)) return false
        // Ignorar update_node que solo modifica body (body desactivado en Fromly)
        if (a.action === 'update_node' && a.body && !a.text && !a.status && !a.due && !a.tags) return false
        // Ignorar acciones desconocidas sin texto — solo generarían 'Sin título' en la UI
        if (!KNOWN_WRITE_ACTIONS.has(a.action as string) && !a.text && !a.title) return false
        return true
      })

      // Ejecutar lecturas inmediatamente.
      if (readActions.length > 0) {
        this.actionStatus = 'Buscando información…'
        this.notify()
        const readResults: ExecutedAction[] = []
        for (const a of readActions) {
          readResults.push(await executeChatAction(a, sid))
        }
        const idx = this.messages.findIndex(m => m.id === assistantMsgId)
        if (idx >= 0) {
          this.messages[idx] = { ...this.messages[idx], actions: readResults }
          this.persistActionsOnNode(assistantMsgId, readResults)
        }
        accumulatedReadResults = readResults
        this.actionStatus = null
        this.notify()
      }

      // Escrituras → ejecutar inmediatamente y registrar bundle de undo.
      if (writeActions.length > 0) {
        const writeResults: ExecutedAction[] = []
        // Guardar el mensaje del usuario para "Hazlo de nuevo"
        const lastUserMsg = [...this.messages].reverse().find(m => m.role === 'user')
        const undoBundle: UndoBundle = {
          createdIds: [],
          restoredNodes: [],
          userMsgContent: lastUserMsg?.content,
          currentNodeId,
        }
        for (const a of writeActions) {
          // Snapshot antes de update_node (para poder deshacer)
          if (a.action === 'update_node' && a.id) {
            const existing = store.nodes.get(a.id as string)
            if (existing) {
              undoBundle.restoredNodes.push({
                id: existing.id,
                prevText: existing.text,
                prevStatus: existing.status ?? null,
                prevDue: existing.due ?? null,
                prevTypes: [...(existing.types || [])],
                prevExtraData: existing.extraData || '',
              })
            }
          }
          const result = await executeChatAction(a, sid, currentNodeId)
          writeResults.push(result)
          // Recopilar IDs creados
          if (result.createdIds) undoBundle.createdIds.push(...result.createdIds)
        }
        // Adjuntar undoBundle al mensaje del asistente
        const hasUndo = undoBundle.createdIds.length > 0 || undoBundle.restoredNodes.length > 0
        if (hasUndo) {
          const idx = this.messages.findIndex(m => m.id === assistantMsgId)
          if (idx >= 0) this.messages[idx] = { ...this.messages[idx], undoBundle }
        }
        // Actualizar acciones en el mensaje
        const allWriteResults = writeResults
        const idx2 = this.messages.findIndex(m => m.id === assistantMsgId)
        if (idx2 >= 0) {
          this.messages[idx2] = { ...this.messages[idx2], actions: allWriteResults }
          this.persistActionsOnNode(assistantMsgId, allWriteResults)
        }
        this.notify()
        // Si se creó UN solo elemento (evita ambigüedad con creaciones múltiples,
        // p.ej. un dictado que genera nota+tareas), abre su ficha en la columna derecha
        // — mismo evento que usan los botones manuales «+Nota»/«+Tarea» (V2App.tsx).
        if (undoBundle.createdIds.length === 1 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: undoBundle.createdIds[0] } }))
        }
        // Acumular resultados y continuar el loop
        accumulatedReadResults = [...accumulatedReadResults, ...writeResults]
      }

      // Solo lecturas — continuar si hubo éxito.
      const anyOK = accumulatedReadResults.some(r => r.ok)
      if (!anyOK) break
    }

    this.pendingVoiceAudio = null  // no arrastrar el audio a un turno futuro
    this.isStreaming = false
    this.notify()
    // Si no quedaron acciones pendientes, las escrituras se ejecutaron directamente
    // → notificar al onboarding que Magic completó su acción
    if (!this.pendingActions) {
      window.dispatchEvent(new CustomEvent('from:onboarding-magic-confirmed'))
    }
    await this.maybeAutoRenameSession()
    // Aprender del mensaje del usuario (personas/hechos) — integral, fire-and-forget.
    this.learnFromUserMessage(trimmed, currentNodeId)
  }

  /**
   * Extrae personas y hechos del mensaje del usuario en el chat y los guarda en el
   * perfil ("🧠 Lo que From sabe sobre ti"). Así Magic recuerda en futuras sesiones
   * lo que el usuario le cuenta de forma natural conversando. Fire-and-forget.
   */
  private learnedFromChat = new Set<string>()
  private async learnFromUserMessage(text: string, currentNodeId?: string) {
    const trimmed = text.trim()
    if (trimmed.length < 15) return
    if (this.learnedFromChat.has(trimmed)) return
    this.learnedFromChat.add(trimmed)
    try {
      const existingProfile = readProfileLines().join('. ')
      // Contexto ACTIVO de la conversación (nodo, no solo nombre) → enrutamos los hechos
      // específicos del tema a la memoria de ESE contexto; los globales, al perfil.
      let ctxNode: Node | null = null
      if (currentNodeId) {
        const cn = store.getNode(currentNodeId)
        if (cn) ctxNode = (isRootContext(currentNodeId) || isMarkedContext(cn)) ? cn : firstContextOf(cn)
      }
      const contextName = ctxNode?.text || null
      // Fecha de HOY (local) → el extractor fecha los datos de estado ("act. …") y
      // detecta contradicciones con el perfil actual (obsolete) para actualizarlos.
      const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
      const knowledge = await extractUserKnowledge(trimmed, existingProfile || undefined, contextName, today)
      if (!knowledge) return
      await saveUserKnowledgeToProfile(knowledge.people, knowledge.facts, knowledge.obsolete)
      // Enrutado: hechos específicos del tema → memoria del contexto activo.
      if (ctxNode && knowledge.contextFacts?.length) {
        try { appendContextFacts(ctxNode.id, knowledge.contextFacts) } catch { /* noop */ }
      }
    } catch { /* silencioso */ }
  }

  /** El usuario confirmó las acciones pendientes. Se ejecutan y la IA resume. */
  async confirmActions() {
    const pending = this.pendingActions
    const ctx = this._pendingContext
    if (!pending || !pending.length || !ctx) return

    this.pendingActions = null
    this._pendingContext = null
    this.isStreaming = true
    this.notify()

    const plural = pending.length === 1 ? 'elemento' : 'elementos'
    this.actionStatus = `Creando ${pending.length} ${plural}…`
    this.notify()

    const allResults: ExecutedAction[] = [...ctx.readResults]
    for (const pa of pending) {
      allResults.push(await executeChatAction(pendingToAction(pa), ctx.sessionId))
    }

    // Adjuntar chips al último mensaje assistant.
    const lastIdx = this.messages.length - 1
    if (lastIdx >= 0 && this.messages[lastIdx].role === 'assistant') {
      this.messages[lastIdx] = { ...this.messages[lastIdx], actions: allResults }
      this.persistActionsOnNode(this.messages[lastIdx].id, allResults)
    }
    this.actionStatus = null
    this.notify()

    // Turno de resumen.
    const summaryMsgId = this.appendMessageNode(ctx.sessionId, 'assistant', '')
    this.messages.push({ id: summaryMsgId, role: 'assistant', content: '', actions: [] })
    this.notify()

    let summaryText = ''
    try {
      await aiChatStream(
        this.buildPayload(ctx.currentNodeId, allResults.map(e => ({
          action: e.action, ok: e.ok, summary: e.summary, ids: e.createdIds,
        }))),
        (chunk) => {
          summaryText += chunk
          const idx = this.messages.findIndex(m => m.id === summaryMsgId)
          if (idx >= 0) {
            this.messages[idx] = { ...this.messages[idx], content: summaryText }
            this.notify()
          }
        }
      )
      // Parsear y aplicar chips del mensaje de resumen (ver comentario arriba: se
      // aplica siempre que se haya encontrado un bloque, no solo si el JSON era válido).
      const { cleanText: summaryClean, chips: summaryChips } = parseChips(summaryText)
      if (summaryClean !== summaryText) {
        const idx2 = this.messages.findIndex(m => m.id === summaryMsgId)
        if (idx2 >= 0) {
          this.messages[idx2] = { ...this.messages[idx2], content: summaryClean, chips: summaryChips.length ? summaryChips : undefined }
          this.notify()
        }
      }
      this.appendToTranscript(ctx.sessionId, 'assistant', summaryClean || summaryText)
    } catch (e) {
      this._handleAIError(e)
    }

    this.isStreaming = false
    this.notify()
    await this.maybeAutoRenameSession()
  }

  /** El usuario canceló las acciones pendientes. */
  /** Maneja errores de llamadas IA: TokensError → paywall, resto → lastError */
  private _handleAIError(e: unknown) {
    if (e instanceof TokensError) {
      // Disparar el evento de paywall (MainLayout lo captura y muestra el modal)
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } }))
      this.lastError = null  // no mostrar el error técnico en el chat
    } else {
      this.lastError = e instanceof Error ? e.message : String(e)
    }
  }

  cancelActions() {
    this.pendingActions = null
    this._pendingContext = null
    this.notify()
  }

  undoAction(msgId: string) {
    const msg = this.messages.find(m => m.id === msgId)
    if (!msg?.undoBundle) return
    const { createdIds, restoredNodes } = msg.undoBundle
    // Eliminar nodos creados
    createdIds.forEach(id => store.deleteNode(id))
    // Restaurar nodos modificados
    restoredNodes.forEach(n => {
      store.updateNode(n.id, {
        text: n.prevText,
        status: n.prevStatus as Node['status'],
        due: n.prevDue,
        types: n.prevTypes,
        extraData: n.prevExtraData,
      })
    })
    // Quitar el undoBundle del mensaje (undo de una sola vez)
    const idx = this.messages.findIndex(m => m.id === msgId)
    if (idx >= 0) this.messages[idx] = { ...this.messages[idx], undoBundle: undefined }
    this.notify()
  }

  /** Deshace las acciones del turno y reenvía el mismo mensaje del usuario */
  async retryAction(msgId: string) {
    const msg = this.messages.find(m => m.id === msgId)
    if (!msg?.undoBundle) return
    const { userMsgContent, currentNodeId } = msg.undoBundle

    // 1. Deshacer las acciones
    this.undoAction(msgId)

    // 2. Eliminar el mensaje del asistente (y el del usuario si es el último)
    const msgIdx = this.messages.findIndex(m => m.id === msgId)
    if (msgIdx >= 0) {
      const prevIdx = msgIdx - 1
      // Eliminar asistente
      this.messages.splice(msgIdx, 1)
      // Eliminar el usuario previo si corresponde al mismo turno
      if (prevIdx >= 0 && this.messages[prevIdx]?.role === 'user' &&
          this.messages[prevIdx]?.content === userMsgContent) {
        this.messages.splice(prevIdx, 1)
      }
    }
    this.notify()

    // 3. Reenviar el mensaje del usuario para un nuevo intento
    if (userMsgContent) {
      await this.send(userMsgContent, currentNodeId)
    }
  }

  private async maybeAutoRenameSession() {
    if (!this.sessionId) return
    const node = store.nodes.get(this.sessionId)
    if (!node) return

    // Solo renombrar si es título automático (_aiAutoTitle) y hay suficientes mensajes
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
    if (!ed._aiAutoTitle) return
    // Nota de voz: el título lo pone restructureVoiceNote desde la transcripción.
    if (ed._audioTranscript) return

    const userCount = this.messages.filter(m => m.role === 'user').length
    if (userCount < 2) return  // con 2 turnos ya tenemos contexto suficiente

    const seeds = this.messages.filter(m => m.role === 'user').slice(0, 3).map(m => m.content)
    const prompt = 'Genera un título muy corto (2-5 palabras, sin comillas ni puntuación final) que resuma esta conversación:\n\n' +
      seeds.map((s, i) => `${i + 1}. ${s}`).join('\n')
    let title = ''
    try {
      // Micro-op: usa systemBudget (Haiku gratis, no consume tokens del usuario)
      await aiInlineStream(prompt, undefined, (chunk) => { title += chunk }, { systemBudget: true })
    } catch { return }

    const cleaned = title.replace(/"/g, '').replace(/^Título:\s*/i, '').trim().split('\n')[0] ?? ''
    if (!cleaned) return

    // Poner ✦ como prefijo y marcar que ya no es auto-título genérico
    store.updateNode(this.sessionId, { text: `✦ ${cleaned}` })
    delete ed._aiAutoTitle
    store.updateNode(this.sessionId, { extraData: JSON.stringify(ed) })
  }

  private buildPayload(currentNodeId: string | undefined, actionResults: ChatActionResult[]) {
    const perfil = store.perfilIANode()
    // Leer body + nodos hijos (el usuario puede usar el outliner o el editor de body)
    let profile = perfil?.body?.trim() ?? ''
    if (perfil) {
      function readChildren(nodeId: string, depth: number): string {
        return store.children(nodeId)
          .filter(n => !n.deletedAt && n.text?.trim())
          .map(n => {
            const indent = '  '.repeat(depth)
            const sub = readChildren(n.id, depth + 1)
            return `${indent}${n.text}${sub ? '\n' + sub : ''}`
          })
          .join('\n')
      }
      const childrenText = readChildren(perfil.id, 0)
      if (childrenText) profile = [profile, childrenText].filter(Boolean).join('\n\n')
    }

    // Contexto inyectado: SOLO el del nodo actual + el heredado de sus ancestros.
    // (Antes se inyectaban los 8 contextos más usados en cada turno — gasto alto
    //  e irrelevante para el nodo en el que se trabaja.)
    const tagDefs: Record<string, string> = currentNodeId
      ? store.tagDefinitionsForNodeChain(currentNodeId)
      : {}

    // Recent nodes (últimos modificados, excluyendo diarios/sesiones/temporales)
    const recent = store.allActive()
      .filter(n => {
        if (n.isDiaryEntry) return false
        if (!n.text.trim()) return false
        try {
          const ed = JSON.parse(n.extraData || '{}')
          if (ed.temporalType) return false
          if (ed._aiSession === '1') return false
        } catch { /* ignore */ }
        return true
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 15)
      .map(n => ({ id: n.id, title: n.text, tags: n.types || [] }))

    const todayIso = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    let currentView: string = `Fecha actual: ${todayIso}`
    if (currentNodeId) {
      const n = store.nodes.get(currentNodeId)
      if (n) currentView += ` | Nota abierta: ${n.text || 'Sin título'} (ID: ${currentNodeId})`
    }

    // Prefijo de fecha — se inyecta en el último mensaje del usuario.
    // Formato explícito con día de la semana y fecha de mañana para que el AI
    // no use su fecha de entrenamiento (que puede ser incorrecta).
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowIso = tomorrow.toISOString().slice(0, 10)
    const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const tomorrowLabel = tomorrow.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const datePrefix = `[SISTEMA: Hoy es ${todayLabel} (${todayIso}). Mañana es ${tomorrowLabel} (${tomorrowIso}). Usa estas fechas exactas para cualquier referencia temporal.]\n`

    // Compactación: >20 mensajes → solo últimos 12 + nota de truncado.
    const injectDate = (msgs: { role: 'user' | 'assistant'; content: string }[]) => {
      // Inyectar la fecha en el último mensaje del usuario
      const result = [...msgs]
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].role === 'user') {
          result[i] = { ...result[i], content: datePrefix + result[i].content }
          break
        }
      }
      return result
    }
    const compactedMessages = (() => {
      if (this.messages.length <= 20) {
        return injectDate(this.messages.map(m => ({ role: m.role, content: m.content })))
      }
      const tail = this.messages.slice(-12)
      const omitted = this.messages.length - tail.length
      return injectDate([
        { role: 'user' as const, content: `[Conversación previa: ${omitted} mensajes anteriores omitidos por compactación.]` },
        ...tail.map(m => ({ role: m.role, content: m.content })),
      ])
    })()

    // Enriquecer tagDefs con prompts hijos (_tagPrompt="1") de cada tag.
    // Contexto para resolver códigos de plantilla
    const currentNoteTitle = currentNodeId ? (store.nodes.get(currentNodeId)?.text ?? '') : ''

    function enrichTag(name: string, body: string): string {
      const ctx = { tagName: name, noteTitle: currentNoteTitle }
      const defNode = store.getTagDefNode(name)
      if (!defNode) return resolveTemplateCodes(body, ctx)
      const prompts = store.children(defNode.id).filter(child => {
        try { return JSON.parse(child.extraData || '{}')._tagPrompt === '1' } catch { return false }
      })
      // Resolver códigos en el body del tag y en cada prompt
      let resolvedBody = resolveTemplateCodes(body, ctx)

      // Memoria que Fromly acumula de este contexto ("🧠 Lo que From sabe"): se
      // inyecta para que el chat use lo que sabe del proyecto, no solo el body.
      const knowledgeNode = store.children(defNode.id).find(c => !c.deletedAt && isContextKnowledge(c.text))
      if (knowledgeNode) {
        const lines = store.children(knowledgeNode.id)
          .filter(c => !c.deletedAt && (c.text || '').trim())
          .map(c => (c.text || '').trim())
        if (lines.length > 0) resolvedBody += '\n\n## Lo que From sabe de este contexto:\n' + lines.map(l => `- ${l}`).join('\n')
      }

      if (prompts.length === 0) return resolvedBody
      const section = '\n\n## Prompts disponibles para este tag:\n' +
        prompts.map(p => {
          const resolvedContent = resolveTemplateCodes((p.body || '').trim(), ctx)
          return `### ${p.text}\n${resolvedContent || '(sin instrucciones)'}`
        }).join('\n\n')
      return resolvedBody + section
    }

    const enrichedTagDefs: Record<string, string> = {}
    for (const [name, body] of Object.entries(tagDefs)) {
      enrichedTagDefs[name] = enrichTag(name, body)
    }
    // (Antes aquí se inyectaban SIEMPRE todos los tags con prompts hijos, aunque
    //  no fueran del nodo actual. Eliminado: solo el contexto del nodo en el que
    //  se trabaja entra en el system prompt.)

    // ── Nota actual: título + body + hijos ─────────────────────────────────
    let currentNoteContent: string | undefined
    if (currentNodeId) {
      const node = store.nodes.get(currentNodeId)
      if (node) {
        const parts: string[] = []
        parts.push(`Título: ${node.text || 'Sin título'}`)
        parts.push(`ID: ${currentNodeId}`)  // el AI debe usar este ID como parent_id para hijos
        if ((node.types || []).length > 0) parts.push(`Tags: #${node.types!.join(' #')}`)
        if (node.body?.trim()) {
          const snippet = node.body.length > 3000 ? node.body.slice(0, 3000) + '…' : node.body
          parts.push(`Contenido del body:\n${snippet}`)
        }
        const children = store.children(currentNodeId).slice(0, 30)
        if (children.length > 0) {
          const lines = children.map(c => {
            let l = `  - ${c.text || '(sin título)'}`
            if (c.status) l += ` [${c.status}]`
            if (c.due) l += ` — ${new Date(c.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
            if (c.body?.trim()) l += ' (con notas)'
            return l
          })
          parts.push(`Elementos hijo:\n${lines.join('\n')}`)
        }
        currentNoteContent = parts.join('\n')
      }
    }

    // ── @menciones en nota actual: cargar contenido de nodos mencionados ────
    const atMentionedContext = (() => {
      if (!currentNodeId) return ""
      const node = store.nodes.get(currentNodeId)
      if (!node) return ""
      const fullText = `${node.text || ''} ${node.body || ''}`
      const atMatches = fullText.match(/@([\wÀ-ɏ][\w\sÀ-ɏ-]*)/g) || []
      const contexts: string[] = []
      for (const match of atMatches) {
        const name = match.slice(1).trim()
        const found = store.allActive().find(n =>
          n.text?.toLowerCase() === name.toLowerCase() && !n.deletedAt
        )
        if (found && found.body) {
          contexts.push(`@${found.text}:\n${found.body.slice(0, 2000)}`)
        }
      }
      return contexts.join('\n\n')
    })()
    if (atMentionedContext && currentNoteContent) {
      currentNoteContent = currentNoteContent + '\n\nContexto de nodos mencionados:\n' + atMentionedContext
    } else if (atMentionedContext) {
      currentNoteContent = 'Contexto de nodos mencionados:\n' + atMentionedContext
    }

    // ── Contexto diario: si está en la nota diaria, expandir descendientes ──
    let dailyContext: string | undefined
    if (currentNodeId) {
      const node = store.nodes.get(currentNodeId)
      if (node?.isDiaryEntry) {
        const allNodes = store.allActive()
        function isDescendant(parentId: string | null | undefined, ancestorId: string, depth = 0): boolean {
          if (depth > 5 || !parentId) return false
          if (parentId === ancestorId) return true
          const p = store.nodes.get(parentId)
          return p ? isDescendant(p.parentId, ancestorId, depth + 1) : false
        }
        const descendants = allNodes.filter(n => n.id !== currentNodeId && isDescendant(n.parentId, currentNodeId!))
        const tasks = descendants.filter(n => n.status)
          .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
        const events = descendants.filter(n => n.isEvent)
        const lines: string[] = []
        if (tasks.length > 0) {
          lines.push(`Tareas del día:`)
          tasks.slice(0, 25).forEach(t => {
            let l = `  [${t.status}] ${t.text}`
            if (t.due) l += ` — ${new Date(t.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
            lines.push(l)
          })
        }
        if (events.length > 0) {
          lines.push(`Eventos:`)
          events.slice(0, 10).forEach(e => {
            let l = `  📅 ${e.text}`
            if (e.due) l += ` — ${new Date(e.due).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`
            lines.push(l)
          })
        }
        if (lines.length > 0) dailyContext = lines.join('\n')
      }
    }

    // ── Tareas pendientes globales ──────────────────────────────────────────
    let pendingTasks: string | undefined
    {
      const now = new Date()
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
      const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
      const all = store.allActive().filter(n => n.status === 'pending')
      const overdue  = all.filter(n => n.due && new Date(n.due) < now)
                          .sort((a, b) => a.due!.localeCompare(b.due!))
      const today    = all.filter(n => n.due && new Date(n.due) >= now && new Date(n.due) <= todayEnd)
                          .sort((a, b) => a.due!.localeCompare(b.due!))
      const upcoming = all.filter(n => n.due && new Date(n.due) > todayEnd && new Date(n.due) <= weekEnd)
                          .sort((a, b) => a.due!.localeCompare(b.due!))
      const noDate   = all.filter(n => !n.due)
      const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      const lines: string[] = []
      if (overdue.length)  { lines.push(`VENCIDAS (${overdue.length}):`);  overdue.slice(0,10).forEach(t => lines.push(`  - ${t.text} — ${fmt(t.due!)}`)) }
      if (today.length)    { lines.push(`HOY (${today.length}):`);          today.slice(0,15).forEach(t => lines.push(`  - ${t.text}`)) }
      if (upcoming.length) { lines.push(`PRÓXIMAS 7 DÍAS (${upcoming.length}):`); upcoming.slice(0,10).forEach(t => lines.push(`  - ${t.text} — ${fmt(t.due!)}`)) }
      if (noDate.length)   { lines.push(`SIN FECHA (${noDate.length}):`);   noDate.slice(0,10).forEach(t => lines.push(`  - ${t.text}`)) }
      if (lines.length > 0) {
        const joined = lines.join('\n')
        pendingTasks = joined.length > 3000 ? joined.slice(0, 3000) + '…' : joined
      }
    }

    // ── Aprendizajes del usuario (sistema "Enseñar a Magic") ───────────────
    const learningsBlock = learningsStore.buildPromptBlock()

    // Locale del usuario — determina el idioma de las respuestas del AI.
    // Respeta la elección explícita de idioma de IA; si es 'auto'/sin definir
    // sigue el idioma de la interfaz. Nunca asume español.
    const userLocale = aiLangBase()
    const dateLocale = aiLangBCP47()

    // Fecha actual — crítico para interpretar "mañana", "hoy", fechas relativas
    const nowStr = new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const dateBlock = `Fecha y hora actual: ${nowStr}`

    // ── Prompt activo (sistema de Prompts) ─────────────────────────────────
    // Instrucción de máxima prioridad: define cómo debe comportarse Magic en
    // esta conversación. Se antepone al perfil. Las variables {{…}} se resuelven.
    let activePromptBlock: string | undefined
    if (this.activePromptId) {
      try {
        const resolved = resolvePrompt(this.activePromptId, { currentNodeId })
        if (resolved.trim()) {
          activePromptBlock = `INSTRUCCIÓN ACTIVA (sigue esto por encima de todo en esta conversación):\n${resolved.trim()}`
        }
      } catch { /* prompt inválido — ignorar */ }
    }

    // ── Conversación abierta por un AGENTE conversacional ──────────────────
    // Si esta sesión la abrió un agente proactivo (openAgentConversation, en el
    // servidor, vía cron), su system_prompt define CÓMO debe responder Magic
    // aquí — mismo mecanismo que activePromptBlock pero automático, sin que el
    // usuario tenga que elegir nada (Alberto, 15 jul: agente "Pensamientos
    // diarios" que pregunta y responde de una forma predefinida).
    let originAgentBlock: string | undefined
    if (this.sessionId) {
      const session = store.getNode(this.sessionId)
      let originAgentId: string | undefined
      try { originAgentId = session ? (JSON.parse(session.extraData || '{}')._originAgentId as string | undefined) : undefined } catch { /* ignore */ }
      if (originAgentId) {
        const agentData = getAgentData(originAgentId)
        if (agentData?.systemPrompt?.trim()) {
          originAgentBlock = `INSTRUCCIÓN DEL AGENTE QUE ABRIÓ ESTA CONVERSACIÓN (sigue esto en tu respuesta):\n${agentData.systemPrompt.trim()}`
        }
      }
    }

    // Combinar con el perfil de usuario
    const combinedProfile = [activePromptBlock, originAgentBlock, dateBlock, profile, learningsBlock].filter(Boolean).join('\n\n') || undefined

    return {
      messages: compactedMessages,
      userProfile: combinedProfile,
      tagDefinitions: Object.keys(enrichedTagDefs).length > 0 ? enrichedTagDefs : undefined,
      recentNodes: recent.length > 0 ? recent : undefined,
      currentView,
      actionResults: actionResults.length > 0 ? actionResults : undefined,
      currentNoteContent,
      dailyContext,
      pendingTasks,
      locale: userLocale,
      // Nodo de ESTA conversación (✦ en el diario). Magic escribe aquí dentro el
      // contenido que se le pida (estructurar/ampliar), como hijos de este nodo.
      conversationNodeId: this.sessionId ?? undefined,
    }
  }

  /** Crea el nodo de sesión en el diario de hoy, colapsado, con ✦ y su transcript hijo. */
  private createSessionNode(seed: string): string {
    const today = getTodayDiaryUnderAgenda()
    const sessionNode = store.createNode({
      text: `✦ ${seed.slice(0, 60)}`,
      parentId: today.id,
      extraData: { _aiSession: '1', _aiSessionSeed: seed.slice(0, 80), _aiAutoTitle: '1' },
    })
    store.setCollapsedLocal(sessionNode.id, true)

    // Nodo contenedor del transcript — sus hijos son los mensajes individuales
    const transcript = store.createNode({
      text: '💬 Conversación',
      parentId: sessionNode.id,
      extraData: { _aiTranscript: '1' },
    })
    store.setCollapsedLocal(transcript.id, true)

    return sessionNode.id
  }

  /** ENLACES INLINE: si el mensaje del usuario contiene URLs, cada una se guarda como
   * elemento-enlace (recurso) hijo de la conversación → aparece en Elementos y entra al
   * RAG. Dedup por URL contra los recursos ya existentes en la sesión. Determinista
   * (no depende de que el modelo decida guardarlo). */
  private persistInlineLinks(sid: string, text: string) {
    try {
      const urls = (text.match(/\bhttps?:\/\/[^\s<>()"']+/gi) || [])
        .map(u => u.replace(/[.,;:!?)\]]+$/, ''))              // limpia puntuación final
      if (!urls.length) return
      const existing = new Set(
        store.children(sid).map(c => c.resourceUrl).filter(Boolean) as string[]
      )
      const seen = new Set<string>()
      for (const url of urls.slice(0, 5)) {
        if (existing.has(url) || seen.has(url)) continue
        seen.add(url)
        let title = url
        try { const u = new URL(url); title = u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '') } catch { /* usa url */ }
        const kind = /youtube\.com|youtu\.be/.test(url) ? 'youtube'
          : /open\.spotify\.com|.*\.mp3|podcast/.test(url) ? 'podcast' : 'url'
        const created = store.createNode({ text: title.slice(0, 120), parentId: sid })
        store.updateNode(created.id, { isResource: true, resourceUrl: url, resourceType: kind, resourceStatus: 'pending' })
      }
    } catch { /* nunca romper el envío por esto */ }
  }

  /** Devuelve un ID sintético (no crea nodo). Los mensajes se persisten via appendToTranscript. */
  private appendMessageNode(_sessionId: string, role: 'user' | 'assistant', _text: string): string {
    // ID sintético solo para el array in-memory this.messages; no crea nodo individual.
    return `_msg_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  /** Añade un mensaje como nodo hijo del transcript. Guarda rol + contenido limpio +
   * (si es voz) audioKey, para poder RECARGAR la conversación al abrir el nodo. */
  private appendToTranscript(sessionId: string, role: 'user' | 'assistant', text: string, audioKey?: string, audioDuration?: number) {
    if (!text.trim()) return
    const transcriptNode = store.children(sessionId).find(c => {
      try { return JSON.parse(c.extraData || '{}')._aiTranscript === '1' } catch { return false }
    })
    if (!transcriptNode) return
    const label = role === 'user' ? 'Tú' : 'Magic'
    const ed: Record<string, string> = { _aiMsgRole: role, _aiMsgContent: text }
    if (audioKey) { ed._audioKey = audioKey; if (audioDuration) ed._audioDuration = String(audioDuration) }
    store.createNode({
      text:     `${label}: ${text}`,   // texto legible en el árbol
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

  /** No-op: con el nuevo diseño no hay nodos individuales de mensaje. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private persistActionsOnNode(_nodeId: string, _actions: ExecutedAction[]) { /* no-op */ }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function extractActions(text: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  const regex = /```from-action\s*\n([\s\S]*?)\n```/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1])
      if (obj && typeof obj === 'object') out.push(obj as Record<string, unknown>)
    } catch { /* ignore malformed JSON */ }
  }
  return out
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
