/**
 * deterministicId — IDs deterministas para nodos ÚNICOS (raíces, Perfil, diario,
 * año/mes/semana). Misma fórmula en web/Mac/iOS/servidor → dos clientes que creen
 * "el mismo" nodo producen el MISMO id → el upsert los fusiona en vez de duplicar.
 * La duplicación de estructura se vuelve imposible a nivel de datos.
 *
 * Algoritmo (idéntico a iOS NodeService.canonicalDiaryId):
 *   uuid = SHA-256("<clave>") → primeros 16 bytes → bits de versión 5 / variante.
 * Claves:
 *   raíces/perfil:  from.struct.<userId>.<key>
 *   diario:         from.diary.<userId>.<epochSegundosInicioDíaLocal>
 *   año/mes/semana: from.struct.<userId>.year-2026 / month-2026-06 / week-2026-06-1
 */
import { getToken } from '../api/client'

// ── SHA-256 síncrono (implementación estándar, verificada contra test vectors) ──
function sha256Bytes(ascii: string): Uint8Array {
  function rrot(n: number, x: number) { return (x >>> n) | (x << (32 - n)) }
  const mathPow = Math.pow, maxWord = mathPow(2, 32)
  const result: number[] = []
  const words: number[] = []
  const asciiBitLength = ascii.length * 8
  // UTF-8 encode
  const bytes: number[] = []
  for (let i = 0; i < ascii.length; i++) {
    let c = ascii.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)) }
    else if (c < 0xd800 || c >= 0xe000) { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)) }
    else {
      i++; const c2 = ascii.charCodeAt(i)
      c = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    }
  }
  const bitLen = bytes.length * 8
  const hash: number[] = []
  const k: number[] = []
  let primeCounter = 0
  const isComposite: Record<number, number> = {}
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
    }
  }
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 0; i < 8; i++) bytes.push((i < 4 ? 0 : (bitLen >>> ((7 - i) * 8)) & 0xff))
  // longitud en bits como 64-bit big-endian (asumimos < 2^32 bits, suficiente aquí)
  // (los 4 bytes altos ya van a 0)
  void asciiBitLength; void words; void result
  const w = new Array(64)
  for (let j = 0; j < bytes.length; j += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | (bytes[j + i * 4 + 3])
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rrot(7, w[i - 15]) ^ rrot(18, w[i - 15]) ^ (w[i - 15] >>> 3)
      const s1 = rrot(17, w[i - 2]) ^ rrot(19, w[i - 2]) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, h] = hash
    for (let i = 0; i < 64; i++) {
      const S1 = rrot(6, e) ^ rrot(11, e) ^ rrot(25, e)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + k[i] + w[i]) | 0
      const S0 = rrot(2, a) ^ rrot(13, a) ^ rrot(22, a)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (hash[i] >>> 24) & 0xff
    out[i * 4 + 1] = (hash[i] >>> 16) & 0xff
    out[i * 4 + 2] = (hash[i] >>> 8) & 0xff
    out[i * 4 + 3] = hash[i] & 0xff
  }
  return out
}

function uuidFromString(s: string): string {
  const h = sha256Bytes(s)
  const b = Array.from(h.slice(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50  // versión 5 (igual que iOS)
  b[8] = (b[8] & 0x3f) | 0x80  // variante
  const hex = b.map(x => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** userId del servidor = claim `sub` del JWT. Mismo valor en todos los clientes. */
export function serverUserId(): string | null {
  const tok = getToken()
  if (!tok) return null
  try {
    const payload = tok.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return json.sub ?? null
  } catch { return null }
}

/** ID determinista para un nodo estructural único (raíz, perfil, año/mes…). */
export function structuralId(key: string): string | null {
  const uid = serverUserId()
  if (!uid) return null
  return uuidFromString(`from.struct.${uid}.${key}`)
}

/** ID determinista del diario de un día (idéntico a iOS canonicalDiaryId). */
export function diaryId(date: Date): string | null {
  const uid = serverUserId()
  if (!uid) return null
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())  // medianoche local
  const epoch = Math.floor(local.getTime() / 1000)
  return uuidFromString(`from.diary.${uid}.${epoch}`)
}

// Para tests/uso desde scripts.
export const _internal = { uuidFromString, sha256Bytes }
