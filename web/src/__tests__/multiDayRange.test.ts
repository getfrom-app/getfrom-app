import { describe, it, expect } from 'vitest'
import { isMultiDayRange, rangeCoversDay, resolveDueEnd } from '../utils/dates'

/** Fin opcional (`dueEnd`) de varios días — 20 sep 2026.
 *  «Un evento que dura desde mañana hasta el 14 de octubre»: el planificador
 *  debe pintarlo en TODOS los días del rango, no solo en el primero. */
describe('rango de varios días', () => {
  const at = (y: number, m: number, d: number, h = 0, min = 0) =>
    new Date(y, m - 1, d, h, min).toISOString()

  it('un fin el MISMO día es duración de bloque, no rango', () => {
    expect(isMultiDayRange(at(2026, 9, 21, 16, 30), at(2026, 9, 21, 18, 0))).toBe(false)
  })

  it('sin fin no hay rango', () => {
    expect(isMultiDayRange(at(2026, 9, 21), null)).toBe(false)
  })

  it('un fin en un día posterior sí es rango', () => {
    expect(isMultiDayRange(at(2026, 9, 21, 16, 30), at(2026, 10, 14))).toBe(true)
  })

  it('cubre todos los días del rango, extremos incluidos', () => {
    const due = at(2026, 9, 21, 16, 30), end = at(2026, 10, 14, 9, 0)
    expect(rangeCoversDay(due, end, new Date(2026, 8, 21))).toBe(true)   // primer día
    expect(rangeCoversDay(due, end, new Date(2026, 8, 30))).toBe(true)   // en medio
    expect(rangeCoversDay(due, end, new Date(2026, 9, 14, 23, 0))).toBe(true) // último día entero
    expect(rangeCoversDay(due, end, new Date(2026, 8, 20))).toBe(false)  // antes
    expect(rangeCoversDay(due, end, new Date(2026, 9, 15))).toBe(false)  // después
  })
})

/** El campo «Fin (opcional)» dejó de poder escribirse a mano en la primera
 *  versión: `<input type="date">` emite fechas COMPLETAS por cada segmento que
 *  se teclea, así que escribir «14/10» sobre un 21/09 pasa antes por «14/09»
 *  —anterior al inicio—, que se subía al inicio y reseteaba el campo en cada
 *  tecla (20 sep 2026, Alberto: "selecciono y escribo numero pero no funciona"). */
describe('resolveDueEnd — escribir el fin a mano', () => {
  const due = new Date(2026, 8, 21, 16, 30).toISOString()  // 21/09/2026 16:30

  it('ignora los pasos intermedios anteriores al inicio mientras se escribe', () => {
    expect(resolveDueEnd(due, '2026-09-14', '16:30', false)).toBe('skip')
  })

  it('guarda en cuanto la fecha escrita es posterior al inicio', () => {
    const out = resolveDueEnd(due, '2026-10-14', '16:30', false)
    expect(out).toBe(new Date(2026, 9, 14, 16, 30).toISOString())
  })

  it('al salir del campo, un fin anterior al inicio se sube al inicio', () => {
    expect(resolveDueEnd(due, '2026-09-14', '16:30', true)).toBe(due)
  })

  it('sin fecha, sin fin', () => {
    expect(resolveDueEnd(due, '', '', true)).toBe('clear')
  })

  it('sin inicio no hay fin posible', () => {
    expect(resolveDueEnd(null, '2026-10-14', '', false)).toBe('clear')
  })
})
