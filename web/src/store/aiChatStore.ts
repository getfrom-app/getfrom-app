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

type Listener = () => void

class AIChatStore {
  sessionId: string | null = null
  messages: ChatMessage[] = []
  isStreaming = false
  actionStatus: string | null = null
  lastError: string | null = null

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

    if (!this.sessionId) {
      this.sessionId = this.createSessionNode(trimmed)
    }
    const sid = this.sessionId

    // Persistir mensaje user
    const userMsgId = this.appendMessageNode(sid, 'user', trimmed)
    this.messages.push({ id: userMsgId, role: 'user', content: trimmed, actions: [] })
    this.notify()

    this.isStreaming = true
    let pendingResults: ChatActionResult[] = []
    const maxTurns = 4
    for (let turn = 0; turn < maxTurns; turn++) {
      this.notify()
      // Crear mensaje assistant inicial vacío
      const assistantMsgId = this.appendMessageNode(sid, 'assistant', '')
      this.messages.push({ id: assistantMsgId, role: 'assistant', content: '', actions: [] })
      this.notify()

      let assistantText = ''
      try {
        await aiChatStream(
          this.buildPayload(currentNodeId, pendingResults),
          (chunk) => {
            assistantText += chunk
            const idx = this.messages.findIndex(m => m.id === assistantMsgId)
            if (idx >= 0) {
              this.messages[idx] = { ...this.messages[idx], content: assistantText }
              this.notify()
            }
          }
        )
        // Persistir texto final
        store.updateNode(assistantMsgId, { text: assistantText })
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e)
        this.isStreaming = false
        this.notify()
        return
      }

      // Extraer + ejecutar acciones
      const actions = extractActions(assistantText)
      if (actions.length === 0) break

      this.actionStatus = `Ejecutando ${actions.length} ${actions.length === 1 ? 'acción' : 'acciones'}…`
      this.notify()

      const executed: ExecutedAction[] = []
      for (const a of actions) {
        const r = await executeChatAction(a, sid)
        executed.push(r)
      }

      // Persistir acciones en el assistant message
      const idx = this.messages.findIndex(m => m.id === assistantMsgId)
      if (idx >= 0) {
        this.messages[idx] = { ...this.messages[idx], actions: executed }
        this.persistActionsOnNode(assistantMsgId, executed)
      }

      pendingResults = executed.map(e => ({
        action: e.action, ok: e.ok, summary: e.summary, ids: e.createdIds,
      }))

      this.actionStatus = null
      const anyOK = executed.some(e => e.ok)
      if (!anyOK) break
    }

    this.isStreaming = false
    this.notify()

    // Auto-título tras 3 turnos del usuario.
    await this.maybeAutoRenameSession()
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

    return {
      messages: compactedMessages,
      userProfile: profile || undefined,
      tagDefinitions: Object.keys(tagDefs).length > 0 ? tagDefs : undefined,
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
