// MARK: - AIChatStore
//
// Store del chat From AI en web. Multi-turno con tool-use (paridad Mac).
// Las sesiones se guardan como nodos (extraData._aiSession="1") con hijos
// por mensaje (extraData._aiRole="user"|"assistant").

import { store, type NodeStore } from './nodeStore'
import type { Node } from '../types'
import { aiChatStream, type ChatActionResult } from '../api/client'
import { executeChatAction } from './aiChatExecutor'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions: ExecutedAction[]
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

  private _pendingContext: PendingContext | null = null
  private listeners = new Set<Listener>()

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

  loadSession(nodeId: string) {
    const node = store.nodes.get(nodeId)
    if (!node) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._aiSession !== '1') return
    } catch { return }
    this.sessionId = nodeId
    this.messages = store.children(nodeId).map(child => {
      let role: 'user' | 'assistant' = 'assistant'
      let actions: ExecutedAction[] = []
      try {
        const ed = JSON.parse(child.extraData || '{}')
        if (ed._aiRole === 'user') role = 'user'
        if (ed._aiActions) {
          actions = JSON.parse(ed._aiActions) as ExecutedAction[]
        }
      } catch { /* ignore */ }
      return { id: child.id, role, content: child.text, actions }
    })
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
        store.updateNode(assistantMsgId, { text: assistantText })
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e)
        this.isStreaming = false
        this.notify()
        return
      }

      const allActions = extractActions(assistantText)
      if (allActions.length === 0) break

      const readActions  = allActions.filter(a => READ_ACTIONS.has(a.action as string))
      const writeActions = allActions.filter(a => !READ_ACTIONS.has(a.action as string))

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

      // Escrituras → pause para confirmación.
      if (writeActions.length > 0) {
        this.isStreaming = false
        this.pendingActions = writeActions.map(makePendingAction)
        this._pendingContext = { currentNodeId, sessionId: sid, readResults: accumulatedReadResults }
        this.notify()
        return
      }

      // Solo lecturas — continuar si hubo éxito.
      const anyOK = accumulatedReadResults.some(r => r.ok)
      if (!anyOK) break
    }

    this.isStreaming = false
    this.notify()
    await this.maybeAutoRenameSession()
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
      store.updateNode(summaryMsgId, { text: summaryText })
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e)
    }

    this.isStreaming = false
    this.notify()
    await this.maybeAutoRenameSession()
  }

  /** El usuario canceló las acciones pendientes. */
  cancelActions() {
    this.pendingActions = null
    this._pendingContext = null
    this.notify()
  }

  private async maybeAutoRenameSession() {
    if (!this.sessionId) return
    const node = store.nodes.get(this.sessionId)
    if (!node) return
    const userCount = this.messages.filter(m => m.role === 'user').length
    if (userCount < 3) return
    if (!node.text.startsWith('Chat IA —')) return
    const seeds = this.messages.filter(m => m.role === 'user').slice(0, 3).map(m => m.content)
    const prompt = 'Genera un título corto (2-6 palabras, sin comillas) que resuma esta conversación:\n\n' +
      seeds.map((s, i) => `${i + 1}. ${s}`).join('\n')
    let title = ''
    try {
      await aiChatStream(
        { messages: [{ role: 'user', content: prompt }] },
        (chunk) => { title += chunk }
      )
    } catch { return }
    const cleaned = title.replace(/"/g, '').replace(/^Título:\s*/i, '').trim().split('\n')[0] ?? ''
    if (cleaned) store.updateNode(this.sessionId, { text: cleaned })
  }

  private buildPayload(currentNodeId: string | undefined, actionResults: ChatActionResult[]) {
    const perfil = store.perfilIANode()
    const profile = perfil?.body?.trim()

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

    let currentView: string | undefined
    if (currentNodeId) {
      const n = store.nodes.get(currentNodeId)
      if (n) currentView = `Nota abierta: ${n.text || 'Sin título'}`
    }

    // Compactación: >20 mensajes → solo últimos 12 + nota de truncado.
    const compactedMessages = (() => {
      if (this.messages.length <= 20) {
        return this.messages.map(m => ({ role: m.role, content: m.content }))
      }
      const tail = this.messages.slice(-12)
      const omitted = this.messages.length - tail.length
      return [
        { role: 'user' as const, content: `[Conversación previa: ${omitted} mensajes anteriores omitidos por compactación.]` },
        ...tail.map(m => ({ role: m.role, content: m.content })),
      ]
    })()

    // Enriquecer tagDefs con prompts hijos (_tagPrompt="1") de cada tag.
    // La IA los leerá y elegirá el más apropiado según la intención del usuario.
    const enrichedTagDefs: Record<string, string> = { ...tagDefs }
    for (const [name, body] of Object.entries(tagDefs)) {
      const defNode = store.getTagDefNode(name)
      if (!defNode) continue
      const prompts = store.children(defNode.id).filter(child => {
        try {
          const ed = JSON.parse(child.extraData || '{}')
          return ed._tagPrompt === '1'
        } catch { return false }
      })
      if (prompts.length > 0) {
        const section = '\n\n## Prompts disponibles para este tag:\n' +
          prompts.map(p => {
            const content = (p.body || '').trim()
            return `### ${p.text}\n${content || '(sin instrucciones)'}`
          }).join('\n\n')
        enrichedTagDefs[name] = body + section
      }
    }

    return {
      messages: compactedMessages,
      userProfile: profile || undefined,
      tagDefinitions: Object.keys(enrichedTagDefs).length > 0 ? enrichedTagDefs : undefined,
      recentNodes: recent.length > 0 ? recent : undefined,
      currentView,
      actionResults: actionResults.length > 0 ? actionResults : undefined,
    }
  }

  private createSessionNode(seed: string): string {
    const node = store.createNode({
      text: `Chat IA — ${formatDate(new Date())}`,
      parentId: null,
      extraData: { _aiSession: '1', _aiSessionSeed: seed.slice(0, 80) },
    })
    return node.id
  }

  private appendMessageNode(sessionId: string, role: 'user' | 'assistant', text: string): string {
    const node = store.createNode({
      text,
      parentId: sessionId,
      extraData: { _aiRole: role },
    })
    return node.id
  }

  private persistActionsOnNode(nodeId: string, actions: ExecutedAction[]) {
    const node = store.nodes.get(nodeId)
    if (!node) return
    let ed: Record<string, string> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
    ed._aiActions = JSON.stringify(actions)
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }
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
