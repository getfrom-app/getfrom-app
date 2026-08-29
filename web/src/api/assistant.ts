// api/assistant — cliente de /assistant, el mismo "cerebro" que ya usan iOS y
// el bot de Telegram (servicio compartido `runAssistantTurn` en el servidor).
// Antes el chat web hablaba con /ai/chat (motor propio, bloques from-action,
// streaming) — sin acciones dictadas sobre tareas existentes, sin agentes a
// demanda, sin listas tocables por id. Migrar aquí es lo que de verdad iguala
// la "magia" del chat de iOS en la web (Alberto, 13 ago).
import { apiRequest } from './client'

export interface AssistantListedTask {
  id: string
  text: string
  due: string
  overdue: boolean
  contextId: string | null
  contextName: string | null
}

export interface AssistantListedAgent {
  id: string
  title: string
  /** "" | "daily:HH:MM" | "weekly:D:HH:MM" */
  schedule: string
  enabled: boolean
}

export interface AssistantCreatedItem {
  id: string
  text: string
  due: string | null
  isTask: boolean
}

export interface AssistantListedContext { id: string; title: string }

export interface AssistantChatReply {
  reply: string
  created: AssistantCreatedItem[]
  options: string[] | null
  list: AssistantListedTask[] | null
  agents: AssistantListedAgent[] | null
  /** Contextos nombrados en la respuesta ("mis contextos") — el prompt obliga
   *  a NO escribirlos en `reply`, así que sin pintarlos la respuesta quedaba
   *  vacía ("Tienes 3 contextos:" y nada; auditoría 28 ago 2026). */
  contexts?: AssistantListedContext[] | null
  favorites?: AssistantListedContext[] | null
  /** "Repasa el día conmigo": el turno fue atendido por el motor nocturno. */
  eveningActive?: boolean
  eveningConcluded?: boolean
  linkedNodeId: string | null
  /** true si el usuario pidió justo VER linkedNodeId — navegar sin esperar
   *  un clic en "Abrir" (13 ago, paridad con iOS). */
  autoOpen?: boolean
}

export async function assistantChat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  currentNodeId?: string | null,
  /** "Solo anotar" (26 ago 2026) — atajo determinista server-side: ni
   *  interpreta ni conversa, va directo a la nota diaria y responde
   *  "Anotado". Ver `AssistantStore.sendQuickNote` / `V2Chat.tsx`. */
  quickNote?: boolean,
): Promise<AssistantChatReply> {
  return apiRequest<AssistantChatReply>('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history, currentNodeId: currentNodeId ?? null, ...(quickNote ? { quickNote: true } : {}) }),
  })
}

/** Payload de un turno guardado — mismo shape que el resto de la respuesta del
 *  chat, para poder repintar la burbuja sin volver a preguntar (28 ago 2026). */
export interface AssistantStoredPayload {
  created?: AssistantCreatedItem[]
  list?: AssistantListedTask[] | null
  agents?: AssistantListedAgent[]
  contexts?: AssistantListedContext[]
  favorites?: AssistantListedContext[]
  linkedNodeId?: string | null
  autoOpen?: boolean
  options?: string[] | null
}

export interface AssistantStoredTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  payload: AssistantStoredPayload | null
}

/** Hidrata/pagina el historial persistido de un hilo — 'general' o el id de un
 *  elemento/contexto. `before`: pide la página anterior a esa fecha (scroll
 *  hacia atrás). Ver server/src/services/assistantThreads.ts. */
export async function assistantThreadTurns(threadKey: string, before?: string, limit?: number): Promise<AssistantStoredTurn[]> {
  const q = new URLSearchParams()
  if (before) q.set('before', before)
  if (limit) q.set('limit', String(limit))
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await apiRequest<{ turns: AssistantStoredTurn[] }>(`/assistant/threads/${encodeURIComponent(threadKey)}/turns${qs}`)
  return res.turns
}

export interface AssistantInboxMessage {
  id: string
  title: string
  body: string
  kind: string
  nodeId: string | null
  createdAt: string
  list: AssistantListedTask[] | null
}

export async function assistantInbox(since: Date | null): Promise<AssistantInboxMessage[]> {
  const q = since ? `?since=${encodeURIComponent(since.toISOString())}` : ''
  const res = await apiRequest<{ messages: AssistantInboxMessage[] }>(`/assistant/inbox${q}`)
  return res.messages
}

export async function assistantComplete(nodeId: string, done: boolean): Promise<void> {
  await apiRequest('/assistant/complete', { method: 'POST', body: JSON.stringify({ nodeId, done }) })
}

export async function assistantPostpone(nodeId: string, due: Date): Promise<void> {
  await apiRequest(`/assistant/node/${nodeId}`, { method: 'PUT', body: JSON.stringify({ due: due.toISOString() }) })
}

export async function assistantTrash(nodeId: string): Promise<void> {
  await apiRequest(`/assistant/node/${nodeId}`, { method: 'PUT', body: JSON.stringify({ trash: true }) })
}

export async function assistantSetContext(nodeId: string, contextId: string | null): Promise<void> {
  await apiRequest(`/assistant/node/${nodeId}`, { method: 'PUT', body: JSON.stringify({ contextId }) })
}

export interface AssistantContext { id: string; text: string }

export async function assistantContexts(): Promise<AssistantContext[]> {
  const res = await apiRequest<{ contexts: AssistantContext[] }>('/assistant/contexts')
  return res.contexts
}

/** Ejecuta un agente programado AHORA — determinista, no pasa por el modelo. */
export async function assistantRunAgent(agentNodeId: string): Promise<void> {
  await apiRequest(`/assistant/agents/${agentNodeId}/run`, { method: 'POST' })
}

export async function assistantUpdateAgent(nodeId: string, enabled: boolean): Promise<void> {
  await apiRequest(`/assistant/node/${nodeId}`, { method: 'PUT', body: JSON.stringify({ agentEnabled: enabled }) })
}

// ── Ajustes de asistente (Informe del día / Repasa el día conmigo) ─────────
// Misma fila de `assistantPrefs` por userId que ya lee/escribe iOS
// (`IOSSettingsView.swift`, sección Asistente) — una sola fuente de verdad
// servidor, sin nada nuevo que sincronizar (24 ago 2026).

export interface AssistantPrefs {
  timezone: string
  /** P5 de la auditoría: true = auto-detectado al arrancar cualquier cliente;
   *  false = el usuario lo fijó a mano en Ajustes, no se pisa solo. */
  timezoneAuto: boolean
  briefEnabled: boolean
  briefHour: number
  eveningEnabled: boolean
  eveningHour: number
  remindersEnabled: boolean
  reminderLeadMin: number
  checkinEnabled: boolean
  telegramLinked: boolean
  lastBriefOn: string | null
  /** true mientras "Repasa el día conmigo" está activo en servidor. */
  eveningSessionActive: boolean
  plan: { pro: boolean; trialDaysLeft: number; hasAccess: boolean }
}

export async function assistantGetPrefs(): Promise<AssistantPrefs> {
  return apiRequest<AssistantPrefs>('/assistant/prefs')
}

export type AssistantPrefsPatch = Partial<Pick<AssistantPrefs,
  'timezone' | 'timezoneAuto' | 'briefEnabled' | 'briefHour' | 'eveningEnabled' | 'eveningHour' | 'remindersEnabled' | 'reminderLeadMin' | 'checkinEnabled'>>

export async function assistantUpdatePrefs(patch: AssistantPrefsPatch): Promise<AssistantPrefs> {
  return apiRequest<AssistantPrefs>('/assistant/prefs', { method: 'PUT', body: JSON.stringify(patch) })
}

export interface AssistantTelegramLink {
  code: string
  expiresInMinutes: number
  url: string
}

/** Vincular Telegram (P4 de la auditoría, 29 ago 2026 — ya existía en iOS, no
 *  en web). Mismo endpoint que usa iOS: un código de 1 uso que caduca. */
export async function assistantTelegramLink(): Promise<AssistantTelegramLink> {
  return apiRequest<AssistantTelegramLink>('/assistant/telegram/link', { method: 'POST' })
}

export async function assistantTelegramUnlink(): Promise<void> {
  await apiRequest('/assistant/telegram/unlink', { method: 'POST' })
}

export interface AssistantBrief {
  title: string
  body: string
  count: number
}

/** El informe del día — mismo texto compuesto que ya llega a iOS/Telegram por
 *  push, y al chat vía `/assistant/inbox`. P4 de la auditoría (29 ago 2026):
 *  la web no tenía tarjeta propia, solo lo veía enterrado en el scroll del
 *  chat general si abrías esa pestaña. */
export async function assistantGetBrief(): Promise<AssistantBrief> {
  return apiRequest<AssistantBrief>('/assistant/brief')
}
