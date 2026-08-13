// assistantStore — el mismo motor conversacional que AssistantStore.swift en
// iOS, aquí en la web. Migración completa desde el chat viejo (aiChatStore +
// /ai/chat): esto habla con /assistant/chat, el "cerebro" que ya comparten
// iOS y Telegram — acciones dictadas sobre tareas existentes, agentes a
// demanda, listas tocables por id, todo en el mismo turno (Alberto, 13 ago:
// "quiero que la misma inteligencia y magia del chat de iOS lo apliquemos al
// chat de la web").
//
// Un hilo continuo global, como iOS — no una sesión por contexto (el viejo
// motor sí las tenía, pero /assistant/chat no tiene noción de "contexto
// activo"; es una sola conversación con el segundo cerebro).
import {
  assistantChat, assistantInbox, assistantComplete, assistantPostpone, assistantTrash,
  assistantSetContext, assistantContexts, assistantRunAgent, assistantUpdateAgent,
  type AssistantListedTask, type AssistantListedAgent, type AssistantContext,
} from '../api/assistant'

export interface AssistantCreatedRef {
  id: string
  text: string
  due: string | null
  isTask: boolean
  fileType?: string | null
}

export interface AssistantMsg {
  id: string
  role: 'user' | 'assistant'
  text: string
  date: string
  created: AssistantCreatedRef[]
  linkedNodeId: string | null
  options: string[] | null
  list: AssistantListedTask[] | null
  agents: AssistantListedAgent[] | null
}

type Listener = () => void

const STORAGE_KEY = 'assistant.web.thread'
const PAGE_SIZE = 40
const SAVE_CAP = 2000
const HISTORY_WINDOW = 10

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

class AssistantStore {
  private allMessages: AssistantMsg[] = []
  private visibleCount = 0
  private listeners: Set<Listener> = new Set()

  isThinking = false
  errorMessage: string | null = null
  doneIds: Set<string> = new Set()
  trashedIds: Set<string> = new Set()
  /** Nodo a abrir sin que el usuario toque nada — paridad con
   *  AssistantStore.swift `pendingAutoOpen` (13 ago). V2Chat lo consume
   *  (navega y lo vuelve a null) en cuanto lo ve. */
  pendingAutoOpen: string | null = null

  constructor() {
    this.load()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify() { this.listeners.forEach(l => l()) }

  get messages(): AssistantMsg[] {
    return this.allMessages.slice(Math.max(0, this.allMessages.length - this.visibleCount))
  }

  get hasMoreHistory(): boolean {
    return this.visibleCount < this.allMessages.length
  }

  loadMoreHistory() {
    this.visibleCount = Math.min(this.allMessages.length, this.visibleCount + PAGE_SIZE)
    this.notify()
  }

  private appendVisible(m: AssistantMsg) {
    this.allMessages.push(m)
    this.visibleCount++
  }

  private recentHistory(): { role: 'user' | 'assistant'; content: string }[] {
    return this.messages
      .slice(0, -1)
      .slice(-HISTORY_WINDOW)
      .filter(m => !m.text.startsWith('No he podido contestar'))
      .map(m => ({ role: m.role, content: m.text }))
  }

  async send(text: string) {
    const clean = text.trim()
    if (!clean || this.isThinking) return

    this.appendVisible({
      id: uid(), role: 'user', text: clean, date: new Date().toISOString(),
      created: [], linkedNodeId: null, options: null, list: null, agents: null,
    })
    this.save(); this.notify()
    this.isThinking = true
    this.errorMessage = null
    this.notify()

    try {
      const history = this.recentHistory()
      const reply = await assistantChat(clean, history)
      this.appendVisible({
        id: uid(), role: 'assistant', text: reply.reply, date: new Date().toISOString(),
        created: reply.created.map(c => ({ id: c.id, text: c.text, due: c.due, isTask: c.isTask })),
        linkedNodeId: reply.linkedNodeId,
        options: reply.options && reply.options.length > 0 ? reply.options : null,
        list: reply.list && reply.list.length > 0 ? reply.list : null,
        agents: reply.agents && reply.agents.length > 0 ? reply.agents : null,
      })
      for (const t of reply.list ?? []) this.doneIds.delete(t.id)
      if (reply.autoOpen && reply.linkedNodeId) this.pendingAutoOpen = reply.linkedNodeId
    } catch (e) {
      this.errorMessage = e instanceof Error ? e.message : String(e)
      this.appendVisible({
        id: uid(), role: 'assistant', text: `No he podido contestar: ${this.errorMessage}`,
        date: new Date().toISOString(), created: [], linkedNodeId: null, options: null, list: null, agents: null,
      })
    }
    this.isThinking = false
    this.save(); this.notify()
  }

  // ── Inbox: brief, cierre del día, recordatorios, informes de agentes ─────

  private get lastInboxDate(): Date | null {
    const raw = localStorage.getItem('assistant.web.lastInboxDate')
    return raw ? new Date(raw) : null
  }
  private set lastInboxDate(d: Date | null) {
    if (d) localStorage.setItem('assistant.web.lastInboxDate', d.toISOString())
  }
  private get seenInboxIds(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem('assistant.web.seenInbox') || '[]')) }
    catch { return new Set() }
  }
  private set seenInboxIds(ids: Set<string>) {
    localStorage.setItem('assistant.web.seenInbox', JSON.stringify([...ids].slice(-300)))
  }

  async fetchInbox() {
    try {
      const msgs = await assistantInbox(this.lastInboxDate)
      const seen = this.seenInboxIds
      let added = 0
      let lastDate = this.lastInboxDate
      for (const m of msgs) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        const date = new Date(m.createdAt)
        this.allMessages.push({
          id: uid(), role: 'assistant',
          text: m.body ? `${m.title}\n${m.body}` : m.title,
          date: m.createdAt,
          created: [], linkedNodeId: m.nodeId,
          options: null, list: m.list && m.list.length > 0 ? m.list : null, agents: null,
        })
        added++
        if (!lastDate || date > lastDate) lastDate = date
      }
      if (added > 0) {
        this.allMessages.sort((a, b) => a.date.localeCompare(b.date))
        this.visibleCount = Math.min(this.allMessages.length, this.visibleCount + added)
        this.seenInboxIds = seen
        this.lastInboxDate = lastDate
        this.save(); this.notify()
      }
    } catch { /* sin conexión, el hilo local sigue leyéndose */ }
  }

  // ── Completar / posponer / papelera / contexto — mismas acciones que el
  // gesto de deslizar de iOS, aquí vía menú contextual / hover (Alberto, 13
  // ago: "el swipe puede ser botón derecho en web o botones en hover"). ─────

  isDone(id: string): boolean { return this.doneIds.has(id) }
  isTrashed(id: string): boolean { return this.trashedIds.has(id) }

  async toggleDone(id: string, done: boolean) {
    const was = this.doneIds.has(id)
    if (done) this.doneIds.add(id); else this.doneIds.delete(id)
    this.notify()
    try { await assistantComplete(id, done) }
    catch (e) {
      if (was) this.doneIds.add(id); else this.doneIds.delete(id)
      this.errorMessage = e instanceof Error ? e.message : String(e)
      this.notify()
    }
  }

  async trash(id: string) {
    this.trashedIds.add(id); this.notify()
    try { await assistantTrash(id) }
    catch (e) {
      this.trashedIds.delete(id)
      this.errorMessage = e instanceof Error ? e.message : String(e)
      this.notify()
    }
  }

  async postponeOneDay(id: string, currentDue: string | null) {
    const base = currentDue ? new Date(currentDue) : new Date()
    const next = new Date(base.getTime() + 24 * 3600 * 1000)
    try { await assistantPostpone(id, next) }
    catch (e) { this.errorMessage = e instanceof Error ? e.message : String(e); this.notify() }
  }

  async setContext(id: string, contextId: string | null) {
    try { await assistantSetContext(id, contextId) }
    catch (e) { this.errorMessage = e instanceof Error ? e.message : String(e); this.notify() }
  }

  async loadContexts(): Promise<AssistantContext[]> {
    return assistantContexts()
  }

  async runAgent(id: string, title: string) {
    this.appendVisible({
      id: uid(), role: 'assistant', text: `Ejecutando **${title}**…`, date: new Date().toISOString(),
      created: [], linkedNodeId: null, options: null, list: null, agents: null,
    })
    this.save(); this.notify()
    try { await assistantRunAgent(id) }
    catch (e) {
      this.errorMessage = e instanceof Error ? e.message : String(e)
      this.appendVisible({
        id: uid(), role: 'assistant', text: `No he podido ejecutar ${title} — inténtalo de nuevo.`,
        date: new Date().toISOString(), created: [], linkedNodeId: null, options: null, list: null, agents: null,
      })
      this.save(); this.notify()
    }
  }

  async toggleAgentEnabled(id: string, enabled: boolean) {
    try { await assistantUpdateAgent(id, enabled) }
    catch (e) { this.errorMessage = e instanceof Error ? e.message : String(e); this.notify() }
  }

  /** Mete un mensaje del asistente en el hilo SIN llamar al servidor — para
   *  preguntas locales tipo "¿qué prompt quieres crear?" antes de que el
   *  usuario responda y el turno de verdad se dispare. */
  addNotice(text: string) {
    this.appendVisible({
      id: uid(), role: 'assistant', text, date: new Date().toISOString(),
      created: [], linkedNodeId: null, options: null, list: null, agents: null,
    })
    this.save(); this.notify()
  }

  clear() {
    this.allMessages = []
    this.visibleCount = 0
    this.save(); this.notify()
  }

  // ── Persistencia ─────────────────────────────────────────────────────────

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      this.allMessages = raw ? JSON.parse(raw) : []
    } catch { this.allMessages = [] }
    // Solo se pinta el último bloque — el resto queda listo para "cargar más"
    // (Alberto, 13 ago, mismo criterio que iOS: "no es buena idea para
    // rendimiento" cargarlo todo de golpe).
    this.visibleCount = Math.min(this.allMessages.length, PAGE_SIZE)
  }

  private save() {
    try {
      const slice = this.allMessages.slice(-SAVE_CAP)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slice))
    } catch { /* localStorage lleno o no disponible — el hilo sigue funcionando en memoria */ }
  }
}

export const assistantStore = new AssistantStore()

// React hook — mismo patrón que useStore() de nodeStore.ts.
import { useState, useEffect } from 'react'

export function useAssistantStore(): AssistantStore {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const unsub = assistantStore.subscribe(() => forceUpdate(n => n + 1))
    return unsub
  }, [])
  return assistantStore
}
