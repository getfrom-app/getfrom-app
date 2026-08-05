// Blindaje del dedup Fromly ↔ Google Calendar.
//
// El bug real (5 ago 2026): el planner pintaba DOS fichas del mismo evento —
// la del nodo local y la cruda de Google — porque comparaba los ids en crudo.
// No pueden compararse así: el LISTADO devuelve `<calendarId>::<eventId>`
// (server/src/routes/google.ts) mientras que CREAR devuelve el id pelado de
// Google, que es el que acaba guardado en el nodo. Con `singleEvents=true`,
// además, cada instancia de un evento recurrente añade su propio sufijo.
import { describe, it, expect } from 'vitest'
import { gcalIdCore } from '../utils/gcalNodesSync'

describe('gcalIdCore', () => {
  it('el id compuesto del listado y el id crudo de la creación son el MISMO evento', () => {
    const guardadoEnElNodo = 'abc123def456'                        // lo que devuelve POST /calendar/events
    const recibidoDelPull  = 'albertolezaun@gmail.com::abc123def456' // lo que devuelve el listado
    expect(gcalIdCore(recibidoDelPull)).toBe(gcalIdCore(guardadoEnElNodo))
  })

  it('una instancia de evento recurrente resuelve al id del maestro', () => {
    expect(gcalIdCore('primary::abc123_20260805T110000Z')).toBe('abc123')
    expect(gcalIdCore('abc123_20260805T110000Z')).toBe('abc123')
  })

  it('no confunde eventos distintos', () => {
    expect(gcalIdCore('cal::abc123')).not.toBe(gcalIdCore('cal::abc124'))
  })

  it('respeta los guiones bajos que NO son sufijo de instancia', () => {
    expect(gcalIdCore('cal::abc_def')).toBe('abc_def')
  })

  it('tolera null/undefined/vacío', () => {
    expect(gcalIdCore(null)).toBe('')
    expect(gcalIdCore(undefined)).toBe('')
    expect(gcalIdCore('')).toBe('')
  })
})
