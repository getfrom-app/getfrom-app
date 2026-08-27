// assistantStore — el mismo motor conversacional que AssistantStore.swift en
// iOS, aquí en la web. Migración completa desde el chat viejo (aiChatStore +
// /ai/chat): esto habla con /assistant/chat, el "cerebro" que ya comparten
// iOS y Telegram — acciones dictadas sobre tareas existentes, agentes a
// demanda, listas tocables por id, todo en el mismo turno (Alberto, 13 ago:
// "quiero que la misma inteligencia y magia del chat de iOS lo apliquemos al
// chat de la web").
//
// Un hilo continuo GENERAL, como iOS (destino Chat sin nada abierto). Pero
// cada ELEMENTO o CONTEXTO abierto (V2ElementChat, Tab "Chat" de una ficha)
// tiene su PROPIO hilo, aislado del general — `/assistant/chat` no tiene
// noción de servidor de "sesión" (es stateless, cada turno manda su propio
// `history`), así que el aislamiento vive aquí: un hilo por `threadKey`
// (nodeId, o `'general'` para el destino Chat sin elemento), cada uno con su
// propio almacenamiento local (`setThread`). Antes había un ÚNICO hilo para
// TODO — abrir el chat de cualquier documento o contexto enseñaba literalmente
// la misma conversación que el destino Chat general (Alberto, 25 ago 2026:
// "no tiene sentido que esté el chat general ahí" al abrir un contexto nuevo).
import {
  assistantChat, assistantInbox, assistantComplete, assistantPostpone, assistantTrash,
  assistantSetContext, assistantContexts, assistantRunAgent, assistantUpdateAgent,
  type AssistantListedTask, type AssistantListedAgent, type AssistantContext,
} from '../api/assistant'
import { opsClient } from './opsClient'

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
  /** Hilo cargado actualmente en memoria — `'general'` o el id del elemento/
   *  contexto abierto (ver `setThread`). Determina qué storage local se lee/
   *  escribe en `load()`/`save()`. */
  private threadKey = 'general'

  isThinking = false
  /** Última acción deshacible — paridad iOS AssistantUndo (13 ago 2026). Solo
   *  completar/posponer (revierten con las mismas llamadas ya existentes);
   *  papelera no tiene "deshacer" todavía, no hay endpoint de restaurar. */
  lastUndo: { label: string; revert: () => Promise<void> } | null = null
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

  /** true si el hilo cargado es el destino Chat general (no un elemento/contexto). */
  get isGeneralThread(): boolean {
    return this.threadKey === 'general'
  }

  /** Cambia de hilo — se llama al montar el chat de un elemento/contexto
   *  concreto (`nodeId`) o al volver al destino Chat general (`null`).
   *  Persiste el hilo anterior antes de soltarlo y carga el nuevo desde su
   *  propio storage (vacío la primera vez, como cualquier conversación
   *  nueva) — así cada elemento/contexto recuerda SU conversación, sin
   *  mezclarse con la de otro ni con la general. No-op si ya es el activo. */
  setThread(nodeId: string | null) {
    const key = nodeId || 'general'
    if (key === this.threadKey) return
    this.save()
    this.threadKey = key
    this.load()
    this.notify()
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

  /** `quickNote`: "Solo anotar" (26 ago 2026) — el mensaje va tal cual a la
   *  nota diaria, sin que el modelo lo interprete ni conteste con nada más
   *  que "Anotado". No manda historial (no hace falta contexto conversacional
   *  para un atajo determinista) ni cuenta para el `recentHistory()` de
   *  turnos normales — es una anotación suelta, no parte del hilo. */
  async send(text: string, quickNote = false) {
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
      const history = quickNote ? [] : this.recentHistory()
      const reply = await assistantChat(clean, history, this.threadKey === 'general' ? null : this.threadKey, quickNote)
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
      // Lo que el propio TURNO acaba de crear en el servidor (agente, nota…)
      // no existe todavía en el store local — el poll normal de ops tarda
      // hasta 20s (opsClient.ts). Sin este pull inmediato, un agente recién
      // creado no aparecía ni al abrirse solo (pendingAutoOpen) ni al mirar
      // Elementos justo después — parecía "no se ha creado" cuando sí
      // existía, solo que aún no había llegado (27 ago 2026, Alberto: "he
      // creado un agente... no aparece como opción en el filtro... debería
      // listarse el primero"). Fire-and-forget: no bloquea la respuesta visible.
      if (reply.linkedNodeId || reply.created.length > 0) opsClient.pullAndApply().catch(() => {})
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

  // ── No leído (13 ago 2026, estilo WhatsApp) ──────────────────────────────
  // Línea "No leído" sobre el primer mensaje del asistente que llegó después
  // de la última vez que el usuario tuvo el chat abierto. Puramente local
  // (no sincroniza entre dispositivos, como el resto de UI-state de este
  // store) — paridad AssistantStore.swift lastReadAt.
  private get lastReadAt(): number {
    return Number(localStorage.getItem('assistant.web.lastRead') || 0)
  }
  private set lastReadAt(ts: number) {
    localStorage.setItem('assistant.web.lastRead', String(ts))
  }

  /** Id del primer mensaje del asistente no leído, o null si no hay ninguno. */
  get firstUnreadId(): string | null {
    const cutoff = this.lastReadAt
    if (!cutoff) return null
    const m = this.messages.find(m => m.role === 'assistant' && new Date(m.date).getTime() > cutoff)
    return m ? m.id : null
  }

  /** Marca todo lo visto hasta ahora como leído — la línea desaparece. */
  markRead() {
    this.lastReadAt = Date.now()
    this.notify()
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

  async toggleDone(id: string, done: boolean, text?: string) {
    const was = this.doneIds.has(id)
    if (done) this.doneIds.add(id); else this.doneIds.delete(id)
    this.notify()
    try {
      await assistantComplete(id, done)
      // Deshacer (13 ago 2026) — solo al COMPLETAR (reabrir ya es en sí
      // mismo el "deshacer" de completar, no hace falta otro nivel).
      if (done) {
        this.lastUndo = {
          label: text ? `"${text}" completada` : 'Tarea completada',
          revert: async () => { await this.toggleDone(id, false, text) },
        }
        this.notify()
      }
    }
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

  async postponeOneDay(id: string, currentDue: string | null, text?: string) {
    const base = currentDue ? new Date(currentDue) : new Date()
    const next = new Date(base.getTime() + 24 * 3600 * 1000)
    try {
      await assistantPostpone(id, next)
      if (currentDue) {
        const restoreDue = new Date(currentDue)
        this.lastUndo = {
          label: text ? `"${text}" pospuesta` : 'Tarea pospuesta',
          revert: async () => { await assistantPostpone(id, restoreDue); this.notify() },
        }
        this.notify()
      }
    }
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

  /** Clave de storage del hilo — `'general'` conserva la clave histórica
   *  (`STORAGE_KEY`, sin sufijo) para no perder el hilo general ya guardado
   *  de antes de que existieran hilos por elemento/contexto. */
  private storageKeyFor(key: string): string {
    return key === 'general' ? STORAGE_KEY : `${STORAGE_KEY}.node.${key}`
  }

  private load() {
    try {
      const raw = localStorage.getItem(this.storageKeyFor(this.threadKey))
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
      localStorage.setItem(this.storageKeyFor(this.threadKey), JSON.stringify(slice))
    } catch { /* localStorage lleno o no disponible — el hilo sigue funcionando en memoria */ }
  }
}

export const assistantStore = new AssistantStore()

// React hook — mismo patrón que useStore() de nodeStore.ts.
import { useState, useLayoutEffect } from 'react'

export function useAssistantStore(): AssistantStore {
  const [, forceUpdate] = useState(0)
  // useLayoutEffect, NO useEffect: tiene que suscribirse ANTES de que corra
  // cualquier `useLayoutEffect` de un componente hijo que llame a
  // `setThread()` (V2Chat) — si no, el primer `notify()` tras un montaje en
  // frío (currentNodeId con hilo ya guardado, ej. el chat de un contexto) se
  // pierde: no hay listener todavía, así que ese render nunca refleja el
  // hilo recién cargado y se queda enseñando el contenido congelado del
  // commit anterior (26 ago 2026 — el bug real detrás de "nueva conversación
  // abre el chat histórico": no era un problema de aislamiento de hilos, el
  // hilo SÍ se cargaba bien, solo que la pantalla no se enteraba a tiempo).
  useLayoutEffect(() => {
    const unsub = assistantStore.subscribe(() => forceUpdate(n => n + 1))
    return unsub
  }, [])
  return assistantStore
}
