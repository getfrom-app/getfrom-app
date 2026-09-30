// ─────────────────────────────────────────────────────────────────────────────
// Notas con candado (30 sep 2026) — cifrado de extremo a extremo del cuerpo de una nota.
//
// - Una CLAVE MAESTRA aleatoria (AES-256-GCM) cifra el body de cada nota bloqueada.
// - Esa clave se guarda en el servidor ENVUELTA dos veces: con la contraseña de notas
//   (PBKDF2-SHA256, 600.000 iteraciones) y con la clave de recuperación. El servidor
//   nunca ve ni la contraseña ni la clave maestra (ver server/src/lib/noteLock.ts).
// - Desbloquear = recuperar la clave maestra en MEMORIA de esta pestaña. Se olvida
//   sola tras 5 min sin actividad en una nota bloqueada, o al pulsar «Bloquear ahora».
// - Formato del body (idéntico en servidor e iOS):
//     <p>🔒 Nota con candado</p><!--fromly-lock:v1:<iv b64>:<ciphertext+tag b64>-->
//   Un cliente sin soporte solo ve el aviso; el servidor rechaza texto en claro encima.
// ─────────────────────────────────────────────────────────────────────────────
import { apiRequest } from '../api/client'

export const LOCKED_LABEL = '🔒 Nota con candado'
const PLACEHOLDER = `<p>${LOCKED_LABEL}</p>`
const ENVELOPE_RE = /<!--fromly-lock:v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)-->/
const ITER = 600_000
const IDLE_MS = 5 * 60 * 1000

type Bytes = Uint8Array<ArrayBuffer>

export interface KeyWrap { salt: string; iv: string; ct: string; iter: number }
export interface LockConfig { v: 1; password: KeyWrap; recovery: KeyWrap }

// ── base64 ───────────────────────────────────────────────────────────────────
const toB64 = (buf: ArrayBuffer | Bytes) => {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}
const fromB64 = (s: string): Bytes => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const rand = (n: number): Bytes => crypto.getRandomValues(new Uint8Array(n))
const enc = new TextEncoder()
const dec = new TextDecoder()

// ── Sobre ────────────────────────────────────────────────────────────────────
export function isLockEnvelope(body: unknown): boolean {
  return typeof body === 'string' && ENVELOPE_RE.test(body)
}
export function isLockedNode(n: { body?: string | null } | null | undefined): boolean {
  return !!n && isLockEnvelope(n.body)
}

// ── Derivación y envoltura de la clave maestra ──────────────────────────────
async function kek(secret: string, salt: Bytes, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret) as Bytes, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function wrap(raw: Bytes, secret: string): Promise<KeyWrap> {
  const salt = rand(16), iv = rand(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kek(secret, salt, ITER), raw)
  return { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), iter: ITER }
}
async function unwrap(w: KeyWrap, secret: string): Promise<Bytes | null> {
  try {
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(w.iv) }, await kek(secret, fromB64(w.salt), w.iter), fromB64(w.ct))
    return new Uint8Array(raw)
  } catch { return null } // contraseña incorrecta → falla la etiqueta GCM
}

/** Normaliza la clave de recuperación (mayúsculas, sin guiones ni espacios). */
const normRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z2-9]/g, '')
function newRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I
  const b = rand(24)
  const chars = Array.from(b, x => alphabet[x % alphabet.length]).join('')
  return chars.match(/.{4}/g)!.join('-')
}

// ── Sesión (clave maestra en memoria) ───────────────────────────────────────
let masterRaw: Bytes | null = null
let masterKey: CryptoKey | null = null
let lastActivity = 0
let idleTimer: number | null = null
let cachedConfig: LockConfig | null | undefined // undefined = sin pedir aún

const emit = () => window.dispatchEvent(new Event('from:notes-lock'))

async function setMaster(raw: Bytes) {
  masterRaw = raw
  masterKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  touchNotesLock()
  emit()
}
export function isNotesUnlocked(): boolean { return !!masterKey }
export function lockNotesNow(): void {
  masterRaw = null; masterKey = null
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  emit()
}
/** Actividad en una nota bloqueada → alarga la sesión 5 min más. */
export function touchNotesLock(): void {
  if (!masterKey) return
  lastActivity = Date.now()
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => { if (Date.now() - lastActivity >= IDLE_MS) lockNotesNow() }, IDLE_MS + 50)
}

// ── Config en servidor ──────────────────────────────────────────────────────
export async function getLockConfig(force = false): Promise<LockConfig | null> {
  if (cachedConfig !== undefined && !force) return cachedConfig
  const r = await apiRequest<{ config: LockConfig | null }>('/notes-lock')
  cachedConfig = r.config
  return cachedConfig
}

/** Crea la contraseña de notas. Devuelve la clave de recuperación (se muestra UNA vez). */
export async function setupNotesPassword(password: string): Promise<string> {
  const raw = rand(32)
  const recovery = newRecoveryCode()
  const config: LockConfig = { v: 1, password: await wrap(raw, password), recovery: await wrap(raw, normRecovery(recovery)) }
  await apiRequest('/notes-lock', { method: 'PUT', body: JSON.stringify({ config }) })
  cachedConfig = config
  await setMaster(raw)
  return recovery
}

export async function unlockWithPassword(password: string): Promise<boolean> {
  const cfg = await getLockConfig()
  if (!cfg) return false
  const raw = await unwrap(cfg.password, password)
  if (!raw) return false
  await setMaster(raw)
  return true
}

/** Clave de recuperación → desbloquea y fija una contraseña NUEVA (misma clave maestra). */
export async function recoverAndReset(recoveryCode: string, newPassword: string): Promise<boolean> {
  const cfg = await getLockConfig(true)
  if (!cfg) return false
  const raw = await unwrap(cfg.recovery, normRecovery(recoveryCode))
  if (!raw) return false
  const config: LockConfig = { ...cfg, password: await wrap(raw, newPassword) }
  await apiRequest('/notes-lock', { method: 'PUT', body: JSON.stringify({ config, replace: true }) })
  cachedConfig = config
  await setMaster(raw)
  return true
}

/** Cambiar contraseña (sesión desbloqueada): re-envuelve la MISMA clave maestra. */
export async function changeNotesPassword(newPassword: string): Promise<void> {
  const cfg = await getLockConfig(true)
  if (!cfg || !masterRaw) throw new Error('locked')
  const config: LockConfig = { ...cfg, password: await wrap(masterRaw, newPassword) }
  await apiRequest('/notes-lock', { method: 'PUT', body: JSON.stringify({ config, replace: true }) })
  cachedConfig = config
}

// ── Cifrar / descifrar el body ──────────────────────────────────────────────
export async function encryptBody(html: string): Promise<string> {
  if (!masterKey) throw new Error('locked')
  touchNotesLock()
  const iv = rand(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, enc.encode(html || '<p></p>') as Bytes)
  return `${PLACEHOLDER}<!--fromly-lock:v1:${toB64(iv)}:${toB64(ct)}-->`
}

export async function decryptBody(envelope: string): Promise<string> {
  if (!masterKey) throw new Error('locked')
  const m = envelope.match(ENVELOPE_RE)
  if (!m) return envelope
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(m[1]) }, masterKey, fromB64(m[2]))
  return dec.decode(pt)
}

// ── extraData ───────────────────────────────────────────────────────────────
// (copia local de parseExtraData: papeleraHelper importa la store → ciclo de imports)
function parseExtraData(raw: string | null | undefined): Record<string, unknown> {
  let v: unknown = raw || '{}'
  for (let i = 0; i < 3 && typeof v === 'string'; i++) { try { v = JSON.parse(v) } catch { return {} } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
}
export function extraDataLocked(extraData: string | null | undefined): boolean {
  return parseExtraData(extraData)._locked === '1'
}
export function withLockedFlag(extraData: string | null | undefined, locked: boolean): string {
  const ed = parseExtraData(extraData)
  if (locked) ed._locked = '1'; else delete ed._locked
  return JSON.stringify(ed)
}

/** Tras bloquear: pide al servidor que borre sus copias en claro (historial, op-log,
 *  RAG). El servidor solo lo hace cuando ya tiene el sobre, y el push de ops va con
 *  ~2 s de retraso, así que se reintenta unas cuantas veces. */
export function scrubServerCopies(nodeId: string): void {
  const delays = [4000, 10000, 30000, 90000]
  const attempt = (i: number) => {
    if (i >= delays.length) return
    window.setTimeout(() => {
      apiRequest(`/notes-lock/scrub/${nodeId}`, { method: 'POST' }).catch(() => attempt(i + 1))
    }, delays[i])
  }
  attempt(0)
}
