const BASE = import.meta.env.DEV
  ? '/api'
  : 'https://from-server-production.up.railway.app'

// ── Error de tokens agotados — se lanza en cualquier respuesta 402 de IA ──
export class TokensError extends Error {
  constructor(message = 'INSUFFICIENT_TOKENS') {
    super(message)
    this.name = 'TokensError'
  }
}

/** Verifica una respuesta de IA: si es 402 lanza TokensError, si falla lanza Error genérico */
export async function assertAIResponse(res: Response): Promise<void> {
  if (res.ok) return
  if (res.status === 402) {
    // Intentar leer el body para más contexto
    try { await res.json() } catch { /* ignore */ }
    throw new TokensError()
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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
  return data
}

export async function register(email: string, password: string) {
  const data = await apiRequest<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password }) }
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

export interface UserProfile {
  id: string
  email: string
  subscriptionStatus: 'active' | 'expired' | 'cancelled' | null
  subscriptionRenewsAt: string | null
  licenseStatus: 'active' | null
  tokensBalance: number
  /** AI API keys propias del usuario (solo lifetime / suscripción activa).
   * El servidor las almacena cifradas y las devuelve descifradas. Si no hay
   * keys o el usuario no tiene plan, llega un objeto vacío. */
  aiApiKeys?: { anthropic?: string; openai?: string; google?: string }
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
  /** Pasar `null` o `{}` borra todas las keys del usuario en server.
   * Cifrado AES-256-GCM, gating server-side por plan (paridad Mac). */
  aiApiKeys?: { anthropic?: string; openai?: string; google?: string } | null
}): Promise<{ user: UserProfile }> {
  return apiRequest('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteAccount(): Promise<{ ok: true }> {
  return apiRequest('/auth/account', { method: 'DELETE' })
}

export async function cancelSubscription(): Promise<{ ok: boolean; billingPortalUrl?: string }> {
  return apiRequest('/auth/subscription/cancel', { method: 'POST' })
}

export async function changePlan(): Promise<{ ok: boolean; action: 'checkout' | 'portal'; checkoutUrl?: string }> {
  return apiRequest('/auth/plan/change', { method: 'POST' })
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

// ── Search (server-side) ──────────────────────────────────────────────────

export async function searchNodes(q: string, limit = 20): Promise<{ nodes: unknown[] }> {
  return apiRequest(`/search/nodes?q=${encodeURIComponent(q)}&limit=${limit}`)
}

// ── Public notes ──────────────────────────────────────────────────────────

export async function publishNote(
  title: string,
  content: string,
  existingSlug?: string
): Promise<{ slug: string; url: string }> {
  return apiRequest('/notes/publish', {
    method: 'POST',
    body: JSON.stringify({ title, content, slug: existingSlug }),
  })
}

export async function unpublishNote(slug: string): Promise<{ ok: boolean }> {
  return apiRequest(`/notes/unpublish/${slug}`, { method: 'POST' })
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

// ── From AI Chat ─────────────────────────────────────────────────────────

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
  /** Contexto del diario de hoy: tareas, eventos, notas del día. Solo si el usuario está en la nota diaria. */
  dailyContext?: string
  /** Resumen de tareas pendientes: vencidas, hoy, próximas, sin fecha. */
  pendingTasks?: string
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
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } }))
      return null
    }
    throw e  // otros errores siguen propagándose
  }
}

// ── Files (R2) ───────────────────────────────────────────────────────────

export async function getPresignedUpload(filename: string, contentType: string): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  return apiRequest('/files/presign-upload', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  })
}

export async function getPresignedDownload(key: string): Promise<{ downloadUrl: string }> {
  return apiRequest('/files/presign-download', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
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
  return apiRequest('/auth/api-token/generate', { method: 'POST' })
}
