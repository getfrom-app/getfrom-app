import { aiLangBase } from '../utils/aiLang'

const BASE = import.meta.env.DEV
  ? '/api'
  : 'https://from-server-production.up.railway.app'

// ── Error de tokens agotados / cuota gratis agotada — se lanza en cualquier
// respuesta 402 de IA. `reason` distingue sin-tokens (Pro sin saldo) de la
// cuota de chat del plan gratis (FREE_CHAT_LIMIT conversaciones/mes) — ambos
// casos abren el paywall pero con copy distinto (ver PaywallModal).
export class TokensError extends Error {
  /** Motivo del 402 tal y como lo nombra el servidor (`paywall`/`error`):
   *  'ai_limit' | 'free_chat_limit' | 'trial_expired' | 'agent_limit' |
   *  'file_limit' | 'node_limit' | 'publish_limit' | 'byok_paid_plan'… */
  reason: string
  constructor(reason: string = 'ai_limit') {
    super('INSUFFICIENT_TOKENS')
    this.name = 'TokensError'
    this.reason = reason
  }
}

/** Verifica una respuesta de IA: si es 402 lanza TokensError, si falla lanza Error genérico */
export async function assertAIResponse(res: Response): Promise<void> {
  if (res.ok) return
  if (res.status === 402) {
    let reason: 'ai_limit' | 'free_chat_limit' = 'ai_limit'
    try {
      const body = await res.json()
      if (body?.error === 'free_chat_limit') reason = 'free_chat_limit'
    } catch { /* ignore */ }
    throw new TokensError(reason)
  }
  throw new Error(`HTTP ${res.status}`)
}

let _accessToken: string | null = localStorage.getItem('from_access_token')
let _refreshToken: string | null = localStorage.getItem('from_refresh_token')

export function getToken() { return _accessToken }

export function setTokens(access: string, refresh: string) {
  _accessToken = access
  _refreshToken = refresh
  localStorage.setItem('from_access_token', access)
  localStorage.setItem('from_refresh_token', refresh)
}

export function clearTokens() {
  _accessToken = null
  _refreshToken = null
  localStorage.removeItem('from_access_token')
  localStorage.removeItem('from_refresh_token')
  // Borrar snapshot de nodos al cerrar sesión (datos del usuario anterior)
  try { localStorage.removeItem('from_snap_v1') } catch {}
}

async function refreshAccessToken(): Promise<string | null> {
  if (!_refreshToken) return null
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    })
    if (!res.ok) { clearTokens(); return null }
    const data = await res.json()
    setTokens(data.accessToken, data.refreshToken)
    return data.accessToken
  } catch {
    clearTokens()
    return null
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const makeRequest = async (token: string | null) => {
    // Si el body es FormData, no poner Content-Type — el browser lo pone solo con el boundary correcto
    const isFormData = options.body instanceof FormData
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string> || {}),
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${BASE}${path}`, { ...options, headers })
  }

  let res = await makeRequest(_accessToken)

  if (res.status === 401 && _refreshToken) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await makeRequest(newToken)
    } else {
      throw new Error('UNAUTHORIZED')
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // 402 = paywall, SIEMPRE tipado: antes /assistant/chat con la prueba
    // caducada acababa como burbuja de error técnico en el hilo en vez de
    // abrir el paywall (auditoría 28 ago 2026).
    if (res.status === 402) throw new TokensError(body.paywall || body.error || 'ai_limit')
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// Auth
export async function login(email: string, password: string) {
  const data = await apiRequest<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  )
  setTokens(data.accessToken, data.refreshToken)
  // Las cuentas creadas antes del 13 ago 2026 tienen locale NULL y reciben todo
  // el correo en español. Al entrar se corrigen solas.
  syncLocale()
  return data
}

/** Guarda el idioma de la interfaz en la cuenta (decide el idioma de los correos). */
export function syncLocale(): void {
  let lang = 'en'
  try { lang = localStorage.getItem('fromly-lang') || navigator.language?.slice(0, 2) || 'en' }
  catch { lang = navigator.language?.slice(0, 2) || 'en' }
  apiRequest('/auth/me/locale', { method: 'PUT', body: JSON.stringify({ locale: lang }) }).catch(() => {})
}

export async function register(email: string, password: string) {
  // El idioma va en el registro: es el que decide en qué idioma llegan la
  // bienvenida y toda la secuencia de la prueba. Sin esto el servidor guardaba
  // NULL y los correos salían siempre en español (13 ago 2026).
  const locale = (() => {
    try { return localStorage.getItem('fromly-lang') || navigator.language?.slice(0, 2) || 'en' }
    catch { return navigator.language?.slice(0, 2) || 'en' }
  })()
  const data = await apiRequest<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password, locale }) }
  )
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } catch {
    // ignore errors on logout
  } finally {
    clearTokens()
  }
}

// Transcripción de voz: sube el WAV al servidor (Gemini STT) y devuelve el texto.
// store=true → además guarda el audio en R2 y devuelve audioKey (para grabaciones largas).
export interface TranscribeResult { text: string; audioKey: string | null; durationSec: number }
export async function transcribeAudio(blob: Blob, store = false): Promise<TranscribeResult> {
  const lang = aiLangBase()
  const form = new FormData()
  form.append('audio', blob, 'audio.wav')
  const data = await apiRequest<{ text?: string; audioKey?: string | null; durationSec?: number }>(
    `/ai/transcribe?lang=${lang}${store ? '&store=1' : ''}`,
    { method: 'POST', body: form }
  )
  return { text: data.text || '', audioKey: data.audioKey ?? null, durationSec: data.durationSec ?? 0 }
}

// URL firmada para reproducir un audio guardado en R2 (a partir de su key).
export async function getAudioUrl(audioKey: string): Promise<string> {
  const data = await apiRequest<{ url: string }>(`/ai/audio-url?key=${encodeURIComponent(audioKey)}`)
  return data.url
}

// Feedback / aviso de fallo desde dentro de la app (beta). Llega a la Bandeja del dashboard.
export async function sendFeedback(message: string, version: string) {
  return apiRequest<{ ok: boolean }>('/contact/feedback', {
    method: 'POST',
    body: JSON.stringify({ message, version, url: window.location.href }),
  })
}

export interface UserProfile {
  id: string
  email: string
  /** Nombre mostrado en el sidebar en vez del email. Opcional. */
  name?: string | null
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'expired' | 'cancelled' | null
  subscriptionRenewsAt: string | null
  /** "monthly" | "annual" | null — null en Lifetime, o si viene de antes de que
   *  esto se empezara a guardar (12 ago 2026). */
  subscriptionInterval: 'monthly' | 'annual' | null
  trialEndsAt: string | null
  licenseStatus: 'active' | null
  tokensBalance: number
  /** AI API keys propias del usuario (solo lifetime / suscripción activa).
   * El servidor las almacena cifradas y las devuelve descifradas. Si no hay
   * keys o el usuario no tiene plan, llega un objeto vacío. */
  aiApiKeys?: { anthropic?: string; openai?: string; google?: string; deepseek?: string }
  /** Modelo elegido en Ajustes → IA. Solo surte efecto si el usuario tiene
   * clave propia del proveedor correspondiente: con el pool compartido de
   * Fromly el modelo lo decide el routing por tier del servidor. */
  aiPreferredModel?: string | null
  aiPreferredProvider?: string | null
  /** Modelos que este usuario puede elegir (los de los proveedores para los
   * que tiene clave propia guardada). Vacío = sin claves → "automático". */
  availableModels?: Array<{ provider: string; model: string; label: string; tier: string }>
  /** true si la cuenta tiene contraseña (login email). false = solo Google.
   * Determina cómo confirmar acciones sensibles (borrar cuenta). */
  hasPassword?: boolean
  /** Namespace público de la cuenta (`/g/:userSlug/:customSlug`) — para
   * previsualizar el enlace de un grupo mientras se escribe el nombre. */
  userSlug?: string | null
  /** Cuota de chat IA del plan gratis (2.0) — conversaciones nuevas usadas este
   * mes natural / próximo reseteo / límite. Solo relevante si no es Pro. */
  freeChatsUsed?: number
  freeChatsResetAt?: string | null
  freeChatLimit?: number
}

export async function getMe(): Promise<{ user: UserProfile }> {
  return apiRequest('/auth/me')
}

export async function forgotPassword(email: string): Promise<{ ok: true }> {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}

export async function updateMe(data: {
  currentPassword?: string
  newPassword?: string
  newEmail?: string
  /** Nombre mostrado en el sidebar en vez del email. "" borra (vuelve a mostrar el email). */
  name?: string
  /** Pasar `null` o `{}` borra todas las keys del usuario en server.
   * Cifrado AES-256-GCM, gating server-side por plan (paridad Mac). */
  aiApiKeys?: { anthropic?: string; openai?: string; google?: string; deepseek?: string } | null
  /** Modelo preferido. `null` vuelve a automático. Solo aplica con clave propia. */
  aiPreferredModel?: string | null
}): Promise<{ user: UserProfile }> {
  return apiRequest('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteAccount(confirm: { password?: string; confirmEmail?: string }): Promise<{ ok: true }> {
  return apiRequest('/auth/account', { method: 'DELETE', body: JSON.stringify(confirm) })
}

export async function cancelSubscription(): Promise<{ ok: boolean; billingPortalUrl?: string }> {
  return apiRequest('/auth/subscription/cancel', { method: 'POST' })
}

/** URL real del portal de cliente de LemonSqueezy para gestionar facturación. */
export async function getBillingPortalUrl(): Promise<string | null> {
  const res = await apiRequest<{ url: string | null }>('/auth/subscription/portal')
  return res.url ?? null
}

export async function changePlan(): Promise<{ ok: boolean; action: 'checkout' | 'portal'; checkoutUrl?: string }> {
  return apiRequest('/auth/plan/change', { method: 'POST', body: JSON.stringify({ to: 'subscription' }) })
}

export async function getCheckoutUrl(product: 'subscription' | 'license' | 'topup', userId: string, email: string): Promise<string> {
  const res = await apiRequest<{ url: string }>('/webhooks/checkout-url', {
    method: 'POST',
    body: JSON.stringify({
      product,
      userId,
      email,
      locale: navigator.language?.slice(0, 2) ?? 'en',
    }),
  })
  return res.url ?? ''
}

export async function changePlanAnnual(): Promise<{ ok: boolean; action: string; checkoutUrl?: string }> {
  return apiRequest('/auth/plan/change', {
    method: 'POST',
    body: JSON.stringify({ to: 'annual' }),
  })
}

export async function changePlanLifetime(): Promise<{ ok: boolean; action: string; checkoutUrl?: string }> {
  return apiRequest('/auth/plan/change', {
    method: 'POST',
    body: JSON.stringify({ to: 'license' }),
  })
}

// Sync
export async function syncNodes(payload: {
  lastSyncAt: string | null
  workspaces: unknown[]
  nodes: unknown[]
  deletedWorkspaceIds: string[]
}) {
  return apiRequest<{ syncAt: string; nodes: unknown[]; workspaces: unknown[] }>(
    '/sync',
    { method: 'POST', body: JSON.stringify(payload) }
  )
}

// ── Export ────────────────────────────────────────────────────────────────

export async function exportNodes(format: 'json' | 'markdown' = 'json'): Promise<string | object> {
  const token = getToken()
  const res = await fetch(`${BASE}/sync/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return format === 'markdown' ? res.text() : res.json()
}

// RAG: contenido relacionado por SIGNIFICADO (modo push). Devuelve ids de nodos
// del vault semánticamente cercanos al texto. Best-effort: [] si falla.
export async function ragRelated(query: string, excludeIds: string[] = [], k = 6): Promise<{ nodeId: string; score: number }[]> {
  try {
    const res = await apiRequest<{ hits: { nodeId: string; score: number }[] }>('/ai/rag-related', {
      method: 'POST',
      body: JSON.stringify({ query, excludeIds, k }),
    })
    return res.hits || []
  } catch { return [] }
}

// ── Public notes ──────────────────────────────────────────────────────────

// `password`: omitir (undefined) NO toca la que ya hubiera; string vacío/null
// la QUITA; string no vacío la (re)establece. Ver server/src/routes/notes.ts.
export async function publishNote(
  title: string,
  content: string,
  existingSlug?: string,
  password?: string | null
): Promise<{ slug: string; url: string }> {
  return apiRequest('/notes/publish', {
    method: 'POST',
    body: JSON.stringify({ title, content, slug: existingSlug, password }),
  })
}

export async function unpublishNote(slug: string): Promise<{ ok: boolean }> {
  return apiRequest(`/notes/unpublish/${slug}`, { method: 'POST' })
}

// ── Public groups (varios elementos con un solo enlace) ─────────────────────

// `password`: mismo criterio que publishNote (undefined no toca, null/''
// quita, string no vacío (re)establece). Ver server/src/routes/groups.ts.
export async function publishGroup(
  nodeId: string,
  existingSlug?: string,
  customSlug?: string,
  password?: string | null,
  description?: string | null
): Promise<{ slug: string; userSlug: string; customSlug: string; url: string }> {
  return apiRequest('/groups/publish', {
    method: 'POST',
    body: JSON.stringify({ nodeId, slug: existingSlug, customSlug, password, description }),
  })
}

export async function unpublishGroup(slug: string): Promise<{ ok: boolean }> {
  return apiRequest(`/groups/unpublish/${slug}`, { method: 'POST' })
}

// ── Contextos publicables (28 ago 2026) — mismo mecanismo que grupos, ver
// server/src/routes/contexts.ts. ──────────────────────────────────────────

export async function publishContext(
  nodeId: string,
  existingSlug?: string,
  customSlug?: string,
  password?: string | null,
  description?: string | null
): Promise<{ slug: string; userSlug: string; customSlug: string; url: string }> {
  return apiRequest('/contexts/publish', {
    method: 'POST',
    body: JSON.stringify({ nodeId, slug: existingSlug, customSlug, password, description }),
  })
}

export async function unpublishContext(slug: string): Promise<{ ok: boolean }> {
  return apiRequest(`/contexts/unpublish/${slug}`, { method: 'POST' })
}

// ── AI inline ────────────────────────────────────────────────────────────

export async function aiInlineStream(
  prompt: string,
  context?: string,
  onChunk?: (chunk: string) => void,
  opts?: {
    resourceUrl?: string
    resourceKind?: 'youtube' | 'article' | 'podcast'
    userProfile?: string
    /** Definiciones de los tags de la nota actual { tagName: descriptionBody } */
    tagDefinitions?: Record<string, string>
    /** Micro-op gratuita: usa Haiku con presupuesto de sistema, no consume tokens del usuario.
     *  Usar para auto-títulos, renombrado de sesiones y operaciones secundarias. */
    systemBudget?: boolean
    /** Override del system prompt — solo válido con systemBudget:true. */
    systemOverride?: string
    /** AbortSignal para cancelar la petición. */
    signal?: AbortSignal
  }
): Promise<string> {
  const token = getToken()
  const res = await fetch(`${BASE}/ai/inline`, {
    method: 'POST',
    signal: opts?.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      prompt,
      context,
      maxTokens: opts?.systemBudget ? 50 : 800,
      resourceUrl: opts?.resourceUrl,
      resourceKind: opts?.resourceKind,
      userProfile: opts?.userProfile,
      tagDefinitions: opts?.tagDefinitions,
      systemBudget: opts?.systemBudget,
      systemOverride: opts?.systemOverride,
    }),
  })
  await assertAIResponse(res)

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No stream')

  let result = ''
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    // Parse SSE lines
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.chunk) {
            result += data.chunk
            onChunk?.(data.chunk)
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }
  return result
}

// ── Fromly AI Chat ─────────────────────────────────────────────────────────

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatActionResult { action: string; ok: boolean; summary?: string; ids?: string[] }
export interface ChatRecentNode { id: string; title: string; tags?: string[] }

export interface ChatPayload {
  messages: ChatMessage[]
  userProfile?: string
  tagDefinitions?: Record<string, string>
  recentNodes?: ChatRecentNode[]
  currentView?: string
  actionResults?: ChatActionResult[]
  /** Contenido completo de la nota actualmente abierta (título + body + hijas). */
  currentNoteContent?: string
  /** Índice (id + título + tipo) de TODOS los elementos del contexto en el que
   *  se está chateando, y de sus subcontextos — ver utils/contextElements.ts.
   *  Permite al modelo saber qué existe y pedir su contenido con read_node/
   *  find_nodes en vez de ignorarlo o adivinar. */
  contextElementsIndex?: string
  /** Contexto del diario de hoy: tareas, eventos, notas del día. Solo si el usuario está en la nota diaria. */
  dailyContext?: string
  /** Resumen de tareas pendientes: vencidas, hoy, próximas, sin fecha. */
  pendingTasks?: string
  /** Idioma preferido del usuario — "es" | "en". Determina el idioma de la respuesta. */
  locale?: string
}

/** Stream /ai/chat. Devuelve la respuesta completa concatenada al terminar. */
export async function aiChatStream(
  payload: ChatPayload,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const token = getToken()
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  await assertAIResponse(res)
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No stream')
  let full = ''
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.chunk) {
          full += data.chunk
          onChunk?.(data.chunk)
        } else if (data.error) {
          throw new Error(data.error)
        }
      } catch { /* ignore */ }
    }
  }
  return full
}

// ── Helper global: despacha 'from:paywall' en cualquier TokensError ──────
// Envuelve cualquier llamada IA; si lanza TokensError emite el evento y
// retorna null para que el caller no tenga que saber nada del error.
export async function withTokenGuard<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof TokensError) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: e.reason } }))
      return null
    }
    throw e  // otros errores siguen propagándose
  }
}

// ── Files (R2) ───────────────────────────────────────────────────────────

/** Upload a file via server (server proxies to R2, no CORS issues). */
export async function uploadFile(file: File): Promise<{ key: string; publicUrl: string }> {
  const fd = new FormData()
  fd.append('file', file)
  return apiRequest<{ key: string; publicUrl: string }>('/files/upload', {
    method: 'POST',
    body: fd,
    // No Content-Type header — let browser set multipart boundary automatically
  })
}

/** Descarga el contenido de un archivo via proxy del servidor (sin CORS de R2) */
export async function fetchFileContent(key: string): Promise<ArrayBuffer> {
  const token = _accessToken
  const res = await fetch(`${BASE}/files/content?key=${encodeURIComponent(key)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`fetchFileContent failed: ${res.status}`)
  return res.arrayBuffer()
}

export async function getPresignedDownload(key: string): Promise<string> {
  const res = await apiRequest<{ url: string }>('/files/presign-download', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
  return res.url
}

export async function getFilesUsage(): Promise<{ usedBytes: number; limitBytes: number }> {
  return apiRequest('/files/usage')
}

export async function getFilesForNode(nodeId: string): Promise<{ key: string; filename: string; size: number; url: string }[]> {
  return apiRequest(`/files/node/${nodeId}`)
}

export async function deleteFile(key: string): Promise<void> {
  return apiRequest(`/files/${encodeURIComponent(key)}`, { method: 'DELETE' })
}

// ── Claude API token ──────────────────────────────────────────────────────

export async function getApiToken(): Promise<{ token: string | null }> {
  return apiRequest('/auth/api-token')
}

export async function generateApiToken(): Promise<{ token: string }> {
  return apiRequest('/auth/api-token', { method: 'POST' })
}
