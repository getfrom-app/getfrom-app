import { describe, it, expect, vi, beforeEach } from 'vitest'

// Servidor simulado: guarda la config de /notes-lock en memoria.
let serverConfig: unknown = null
vi.mock('../api/client', () => ({
  apiRequest: vi.fn(async (path: string, opts?: { method?: string; body?: string }) => {
    if (path === '/notes-lock' && (!opts?.method || opts.method === 'GET')) return { config: serverConfig }
    if (path === '/notes-lock' && opts?.method === 'PUT') { serverConfig = JSON.parse(opts.body!).config; return { ok: true } }
    return {}
  }),
}))

import {
  setupNotesPassword, unlockWithPassword, lockNotesNow, isNotesUnlocked, encryptBody, decryptBody,
  isLockEnvelope, recoverAndReset, changeNotesPassword, getLockConfig, LOCKED_LABEL,
} from '../utils/noteLock'

vi.stubGlobal('window', { dispatchEvent: () => true, setTimeout, clearTimeout })

describe('notas con candado — cifrado', () => {
  beforeEach(() => { lockNotesNow() })

  it('crear contraseña, cifrar y descifrar; el sobre no contiene el texto', async () => {
    serverConfig = null
    await getLockConfig(true)
    const recovery = await setupNotesPassword('secreta123')
    expect(recovery).toMatch(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/)
    expect(isNotesUnlocked()).toBe(true)

    const html = '<p>Clave del banco: 1234</p>'
    const env = await encryptBody(html)
    expect(isLockEnvelope(env)).toBe(true)
    expect(env).not.toContain('1234')
    expect(env.replace(/<[^>]+>/g, ' ').trim()).toBe(LOCKED_LABEL)
    expect(await decryptBody(env)).toBe(html)
    // El servidor solo guarda material envuelto, nunca la contraseña
    expect(JSON.stringify(serverConfig)).not.toContain('secreta123')

    lockNotesNow()
    await expect(decryptBody(env)).rejects.toThrow()
    expect(await unlockWithPassword('mala')).toBe(false)
    expect(isNotesUnlocked()).toBe(false)
    expect(await unlockWithPassword('secreta123')).toBe(true)
    expect(await decryptBody(env)).toBe(html)

    // Recuperación: con la clave (en minúsculas y sin guiones también vale) → contraseña nueva, mismas notas
    lockNotesNow()
    expect(await recoverAndReset('XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', 'otra')).toBe(false)
    expect(await recoverAndReset(recovery.toLowerCase().replace(/-/g, ' '), 'nueva456')).toBe(true)
    expect(await decryptBody(env)).toBe(html)
    lockNotesNow()
    expect(await unlockWithPassword('secreta123')).toBe(false)
    expect(await unlockWithPassword('nueva456')).toBe(true)

    // Cambiar contraseña conserva la clave maestra
    await changeNotesPassword('tercera789')
    lockNotesNow()
    expect(await unlockWithPassword('tercera789')).toBe(true)
    expect(await decryptBody(env)).toBe(html)
  }, 60000)

  it('dos cifrados del mismo texto son distintos (IV aleatorio)', async () => {
    expect(await unlockWithPassword('tercera789')).toBe(true)
    const a = await encryptBody('<p>x</p>'), b = await encryptBody('<p>x</p>')
    expect(a).not.toBe(b)
  }, 30000)
})
