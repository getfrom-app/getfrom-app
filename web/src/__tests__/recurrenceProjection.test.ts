import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { occurrencesInRange, recurrenceOccursOn, recurrenceExdates, localDayKey, belongsToSeries, seriesOf } from '../utils/recurrenceProjection'
import type { Node } from '../types'

function node(partial: Partial<Node>): Node {
  return {
    id: 'n1', parentId: null, text: 'Desarrollo UDA', body: null, siblingOrder: 0, types: [], collections: [],
    status: 'pending', isActive: false, isEvent: false, isDiaryEntry: false, isChat: false, isCollapsed: false,
    isFavorite: false, due: null, dueEnd: null, recurrence: null, extraData: null,
    ...partial,
  } as Node
}

describe('recurrenceProjection', () => {
  beforeAll(() => {
    // Hoy = miércoles 9 sep 2026
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 9, 20, 0, 0))
  })
  afterAll(() => vi.useRealTimers())

  it('weekly desde el lunes 14 proyecta todos los lunes del mes menos el propio 14', () => {
    const n = node({ due: new Date(2026, 8, 14).toISOString(), recurrence: 'weekly' })
    const days = occurrencesInRange(n, new Date(2026, 8, 1), new Date(2026, 8, 30)).map(localDayKey)
    expect(days).toEqual(['2026-09-21', '2026-09-28'])
  })

  it('no proyecta hacia atrás ni más allá del horizonte de 120 días', () => {
    const n = node({ due: new Date(2026, 8, 14).toISOString(), recurrence: 'weekly' })
    expect(occurrencesInRange(n, new Date(2026, 7, 1), new Date(2026, 8, 14))).toEqual([])
    const far = occurrencesInRange(n, new Date(2027, 2, 1), new Date(2027, 2, 31))
    expect(far).toEqual([])
  })

  it('respeta las fechas excluidas (_recExdates)', () => {
    const n = node({
      due: new Date(2026, 8, 14).toISOString(), recurrence: 'weekly',
      extraData: JSON.stringify({ _recExdates: '2026-09-21' }),
    })
    expect(recurrenceExdates(n)).toEqual(new Set(['2026-09-21']))
    const days = occurrencesInRange(n, new Date(2026, 8, 1), new Date(2026, 8, 30)).map(localDayKey)
    expect(days).toEqual(['2026-09-28'])
    expect(recurrenceOccursOn(n, new Date(2026, 8, 21))).toBeNull()
    expect(recurrenceOccursOn(n, new Date(2026, 8, 28))).not.toBeNull()
  })

  it('personalizado (lunes y jueves) cae en ambos días y hereda la hora', () => {
    const n = node({
      due: new Date(2026, 8, 10, 11, 30).toISOString(), // jueves 10 a las 11:30
      recurrence: JSON.stringify({ type: 'custom', days: [1, 4], display: 'LJ' }),
    })
    const occ = occurrencesInRange(n, new Date(2026, 8, 11), new Date(2026, 8, 20))
    expect(occ.map(localDayKey)).toEqual(['2026-09-14', '2026-09-17'])
    expect(occ[0].getHours()).toBe(11)
    expect(occ[0].getMinutes()).toBe(30)
  })

  it('una instancia suelta con _seriesOf sigue perteneciendo a la serie', () => {
    const loose = node({ id: 'n2', recurrence: null, extraData: JSON.stringify({ _seriesOf: 'n1' }) })
    expect(seriesOf(loose)).toBe('n1')
    expect(belongsToSeries(loose)).toBe(true)
    expect(belongsToSeries(node({ recurrence: null }))).toBe(false)
  })
})
