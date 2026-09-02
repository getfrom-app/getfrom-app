// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { listUpcomingTimed } from '../utils/nextEvent'

describe('listUpcomingTimed — barra "Lo próximo"', () => {
  beforeEach(() => { store.nodes.clear() })

  it('incluye un timeblock/tarea recurrente EN CURSO cuya instancia real quedó en el pasado (proyección virtual)', () => {
    // Caso real reportado 2 sep 2026: "Soporte Media Sector", timeblock diario
    // creado hace días, nunca completado a mano → su `due` real sigue siendo
    // el del día que se creó, pero hoy "toca" por la recurrencia. Antes del
    // fix, `listUpcomingTimed` solo miraba `due` real de cada nodo y lo
    // ignoraba por completo en cuanto quedaba atrás.
    const now = new Date()
    const originDay = new Date(now); originDay.setDate(originDay.getDate() - 5)
    const start = new Date(originDay); start.setHours(now.getHours(), 0, 0, 0) // hoy en curso
    const end = new Date(start.getTime() + 3_600_000)
    const block = store.createNode({ text: 'Soporte Media Sector', parentId: null })
    store.updateNode(block.id, {
      due: start.toISOString(), dueEnd: end.toISOString(), recurrence: 'daily',
      extraData: JSON.stringify({ _timeblock: '1' }),
    })

    const items = listUpcomingTimed(6, now)
    expect(items.some(i => i.text === 'Soporte Media Sector')).toBe(true)
  })

  it('no duplica el elemento cuando su `due` real YA es hoy/futuro (ese es el nodo real, no hace falta proyección)', () => {
    const now = new Date()
    const due = new Date(now.getTime() + 3_600_000)
    const n = store.createNode({ text: 'Reunión real', parentId: null })
    store.updateNode(n.id, { due: due.toISOString(), recurrence: 'daily', status: 'pending' })

    const items = listUpcomingTimed(6, now)
    expect(items.filter(i => i.text === 'Reunión real').length).toBe(1)
  })

  it('un recurrente ya marcado done no se proyecta (spawnRecurrence ya crea el siguiente real)', () => {
    const now = new Date()
    const originDay = new Date(now); originDay.setDate(originDay.getDate() - 5)
    const n = store.createNode({ text: 'Tarea recurrente hecha', parentId: null })
    store.updateNode(n.id, { due: originDay.toISOString(), recurrence: 'daily', status: 'done' })

    const items = listUpcomingTimed(6, now)
    expect(items.some(i => i.text === 'Tarea recurrente hecha')).toBe(false)
  })
})
