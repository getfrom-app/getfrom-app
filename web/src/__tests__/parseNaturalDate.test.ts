import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseNaturalDate } from '../utils/dates'

describe('parseNaturalDate', () => {
  beforeAll(() => {
    // Fijar "hoy" = miércoles 27 mayo 2026
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 27, 10, 0, 0))
  })
  afterAll(() => vi.useRealTimers())

  it('"hoy" devuelve fecha de hoy', () => {
    const iso = parseNaturalDate('hoy')
    expect(iso).toBeTruthy()
    const d = new Date(iso!)
    expect(d.getDate()).toBe(27)
    expect(d.getMonth()).toBe(4)
  })

  it('"mañana" devuelve día siguiente', () => {
    const iso = parseNaturalDate('mañana')
    const d = new Date(iso!)
    expect(d.getDate()).toBe(28)
  })

  it('"lunes" (siendo miércoles) devuelve siguiente lunes', () => {
    const iso = parseNaturalDate('lunes')
    const d = new Date(iso!)
    expect(d.getDay()).toBe(1) // lunes
    expect(d.getDate()).toBe(1) // 1 junio (próximo lunes)
  })

  it('"+3" devuelve hoy + 3 días', () => {
    const iso = parseNaturalDate('+3')
    const d = new Date(iso!)
    expect(d.getDate()).toBe(30)
  })

  it('"14:30" devuelve hoy a esa hora', () => {
    const iso = parseNaturalDate('14:30')
    const d = new Date(iso!)
    expect(d.getDate()).toBe(27)
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(30)
  })

  it('"27/05" devuelve esa fecha del año actual', () => {
    const iso = parseNaturalDate('27/05')
    const d = new Date(iso!)
    expect(d.getDate()).toBe(27)
    expect(d.getMonth()).toBe(4) // mayo
  })

  it('"27/05/2027" devuelve esa fecha del año especificado', () => {
    const iso = parseNaturalDate('27/05/2027')
    const d = new Date(iso!)
    expect(d.getFullYear()).toBe(2027)
  })

  it('"@mañana" acepta el prefijo @', () => {
    const iso = parseNaturalDate('@mañana')
    expect(iso).toBeTruthy()
  })

  it('texto inválido devuelve null', () => {
    expect(parseNaturalDate('hola caracola')).toBeNull()
  })

  it('vacío devuelve null', () => {
    expect(parseNaturalDate('')).toBeNull()
  })
})
