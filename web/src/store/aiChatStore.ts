// MARK: - AIChatStore
//
// Store del chat From AI en web. Multi-turno con tool-use (paridad Mac).
// Las sesiones se guardan como nodos (extraData._aiSession="1") con hijos
// por mensaje (extraData._aiRole="user"|"assistant").

import { store, type NodeStore } from './nodeStore'
import type { Node } from '../types'
import { aiChatStream, type ChatActionResult } from '../api/client'
import { executeChatAction } from './aiChatExecutor'
import { resolveTemplateCodes } from '../utils/templateCodes'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions: ExecutedAction[]
  /** Chips de acción sugeridos por la IA al final del mensaje */
  chips?: string[]
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
        // Parsear y aplicar chips de seguimiento al mensaje assistant
        const { cleanText, chips } = parseChips(assistantText)
        if (chips.length > 0) {
          const idx2 = this.messages.findIndex(m => m.id === assistantMsgId)
          if (idx2 >= 0) {
            this.messages[idx2] = { ...this.messages[idx2], content: cleanText, chips }
            this.notify()
          }
        }
        store.updateNode(assistantMsgId, { text: cleanText || assistantText })
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

    return {
      messages: compactedMessages,
      userProfile: profile || undefined,
      tagDefinitions: Object.keys(enrichedTagDefs).length > 0 ? enrichedTagDefs : undefined,
      recentNodes: recent.length > 0 ? recent : undefined,
      currentView,
      actionResults: actionResults.length > 0 ? actionResults : undefined,
      currentNoteContent,
      dailyContext,
      pendingTasks,
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
