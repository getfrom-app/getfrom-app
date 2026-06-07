// MARK: - AIChatStore
//
// Store del chat From AI en web. Multi-turno con tool-use (paridad Mac).
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
import { resolvePrompt } from '../utils/promptsHelper'
import { extractUserKnowledge } from '../api/autoClassify'
import { saveUserKnowledgeToProfile, readProfileLines } from '../api/userKnowledge'

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
}

/** Parsea y elimina {{chips:[...]}} del texto. Devuelve texto limpio + chips. */
export function parseChips(text: string): { cleanText: string; chips: string[] } {
  const match = text.match(/\{\{chips:([\s\S]*?)\}\}\s*$/)
  if (!match) return { cleanText: text, chips: [] }
  try {
    const chips = JSON.parse(match[1]) as string[]
    const cleanText = text.slice(0, text.lastIndexOf('{{chips:')).trim()
    return { cleanText, chips: Array.isArray(chips) ? chips.slice(0, 4) : [] }
  } catch { return { cleanText: text, chips: [] } }
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

  private _pendingContext: PendingContext | null = null
  private listeners = new Set<Listener>()

  /** Activa (o desactiva con null) un prompt para la conversación actual. */
  setActivePrompt(promptId: string | null, auto = false) {
    if (this.activePromptId === promptId && this.activePromptAuto === auto) return
    this.activePromptId = promptId
    this.activePromptAuto = auto
    this.notify()
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
    this.messages = []  // UI limpia — el historial está en el nodo 💬 Conversación

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
          const fullText = `${label}: ${m.text}`
          store.createNode({
            text:     fullText.length > 300 ? fullText.slice(0, 300) + '…' : fullText,
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

    if (!this.sessionId) {
      this.sessionId = this.createSessionNode(trimmed)
    }
    const sid = this.sessionId

    const userMsgId = this.appendMessageNode(sid, 'user', trimmed)
    this.appendToTranscript(sid, 'user', trimmed)          // persistir al transcript
    this.messages.push({ id: userMsgId, role: 'user', content: trimmed, actions: [] })
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
        // Parsear y aplicar chips de seguimiento al mensaje assistant
        const { cleanText, chips } = parseChips(assistantText)
        if (chips.length > 0) {
          const idx2 = this.messages.findIndex(m => m.id === assistantMsgId)
          if (idx2 >= 0) {
            this.messages[idx2] = { ...this.messages[idx2], content: cleanText, chips }
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
      const KNOWN_WRITE_ACTIONS = new Set(['create_note','create_task','create_event','create_resource','update_node','add_column','fill_column','add_row','change_view','run_prompt'])
      const writeActions = allActions.filter(a => {
        if (READ_ACTIONS.has(a.action as string)) return false
        // Ignorar update_node que solo modifica body (body desactivado en From)
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
        // Acumular resultados y continuar el loop
        accumulatedReadResults = [...accumulatedReadResults, ...writeResults]
      }

      // Solo lecturas — continuar si hubo éxito.
      const anyOK = accumulatedReadResults.some(r => r.ok)
      if (!anyOK) break
    }

    this.isStreaming = false
    this.notify()
    // Si no quedaron acciones pendientes, las escrituras se ejecutaron directamente
    // → notificar al onboarding que Magic completó su acción
    if (!this.pendingActions) {
      window.dispatchEvent(new CustomEvent('from:onboarding-magic-confirmed'))
    }
    await this.maybeAutoRenameSession()
    // Aprender del mensaje del usuario (personas/hechos) — integral, fire-and-forget.
    this.learnFromUserMessage(trimmed)
  }

  /**
   * Extrae personas y hechos del mensaje del usuario en el chat y los guarda en el
   * perfil ("🧠 Lo que From sabe sobre ti"). Así Magic recuerda en futuras sesiones
   * lo que el usuario le cuenta de forma natural conversando. Fire-and-forget.
   */
  private learnedFromChat = new Set<string>()
  private async learnFromUserMessage(text: string) {
    const trimmed = text.trim()
    if (trimmed.length < 15) return
    if (this.learnedFromChat.has(trimmed)) return
    this.learnedFromChat.add(trimmed)
    try {
      const existingProfile = readProfileLines().join('. ')
      const knowledge = await extractUserKnowledge(trimmed, existingProfile || undefined)
      if (!knowledge) return
      await saveUserKnowledgeToProfile(knowledge.people, knowledge.facts)
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
      // Parsear y aplicar chips del mensaje de resumen
      const { cleanText: summaryClean, chips: summaryChips } = parseChips(summaryText)
      if (summaryChips.length > 0) {
        const idx2 = this.messages.findIndex(m => m.id === summaryMsgId)
        if (idx2 >= 0) {
          this.messages[idx2] = { ...this.messages[idx2], content: summaryClean, chips: summaryChips }
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
    let ed: Record<string, string> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
    if (!ed._aiAutoTitle) return

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

    // Tag defs: del nodo actual + top 8 tags usados con definición
    const tagDefs: Record<string, string> = {}
    if (currentNodeId) {
      const fromNode = store.tagDefinitionsForNode(currentNodeId)
      Object.assign(tagDefs, fromNode)
    }
    const tagCounts: Record<string, number> = {}
    for (const n of store.nodes.values()) {
      if (n.deletedAt) continue
      for (const t of n.types || []) {
        const lower = t.toLowerCase()
        if (['tarea','evento','agente','prompt','magic','rec','chat','diary_entry','quick','panel','busqueda','archivo','enlace'].includes(lower)) continue
        tagCounts[t] = (tagCounts[t] || 0) + 1
      }
    }
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    for (const [name] of topTags) {
      if (tagDefs[name]) continue
      const def = store.getTagDefNode(name)
      const body = def?.body?.trim()
      if (body) tagDefs[name] = body
    }

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
      const resolvedBody = resolveTemplateCodes(body, ctx)
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
    // Tags con prompts que no están en el top-8 — incluirlos siempre.
    for (const node of store.nodes.values()) {
      if (node.deletedAt) continue
      try {
        const ed = JSON.parse(node.extraData || '{}')
        if (ed._tagPrompt !== '1') continue
        const parent = node.parentId ? store.nodes.get(node.parentId) : null
        if (!parent) continue
        const ped = JSON.parse(parent.extraData || '{}')
        const tagName = ped._tagDefinition as string | undefined
        if (!tagName || enrichedTagDefs[tagName]) continue
        const body = (parent.body || '').trim()
        enrichedTagDefs[tagName] = enrichTag(tagName, body || '(sin descripción)')
      } catch { /* ignore */ }
    }

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

    // Locale del usuario — determina el idioma de las respuestas del AI
    const userLocale = localStorage.getItem('from-lang') ?? 'es'
    const dateLocale = userLocale.startsWith('en') ? 'en-US' : 'es-ES'

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

    // Combinar con el perfil de usuario
    const combinedProfile = [activePromptBlock, dateBlock, profile, learningsBlock].filter(Boolean).join('\n\n') || undefined

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

  /** Devuelve un ID sintético (no crea nodo). Los mensajes se persisten via appendToTranscript. */
  private appendMessageNode(_sessionId: string, role: 'user' | 'assistant', _text: string): string {
    // ID sintético solo para el array in-memory this.messages; no crea nodo individual.
    return `_msg_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  /** Añade un mensaje como nodo hijo del transcript. Nunca usa .body — todo en nodos. */
  private appendToTranscript(sessionId: string, role: 'user' | 'assistant', text: string) {
    if (!text.trim()) return
    const transcriptNode = store.children(sessionId).find(c => {
      try { return JSON.parse(c.extraData || '{}')._aiTranscript === '1' } catch { return false }
    })
    if (!transcriptNode) return
    const label = role === 'user' ? 'Tú' : 'Magic'
    // Cada mensaje = un nodo hijo. Texto largo se trunca a 300 chars para el title
    // (el contenido completo va en el primer nodo sin truncar si cabe en un nodo)
    const fullText = `${label}: ${text}`
    store.createNode({
      text:     fullText.length > 300 ? fullText.slice(0, 300) + '…' : fullText,
      parentId: transcriptNode.id,
      extraData: { _aiMsgRole: role },
    })
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
