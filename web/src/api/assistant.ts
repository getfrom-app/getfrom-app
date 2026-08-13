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

export interface AssistantChatReply {
  reply: string
  created: AssistantCreatedItem[]
  options: string[] | null
  list: AssistantListedTask[] | null
  agents: AssistantListedAgent[] | null
  linkedNodeId: string | null
}

export async function assistantChat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<AssistantChatReply> {
  return apiRequest<AssistantChatReply>('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  })
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
