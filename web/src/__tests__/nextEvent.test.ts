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

describe('listUpcomingTimed — rangos de varios días', () => {
  beforeEach(() => { store.nodes.clear() })

  /** Un curso del 21/09 al 14/10 de 16:30 a 20:30 no puede quedarse "en curso"
   *  tres semanas seguidas tapando el resto: «lo próximo» es su franja de HOY
   *  (o la del siguiente día del rango), no el rango entero (20 sep 2026). */
  it('muestra la franja del día, no el rango entero', () => {
    const now = new Date()
    const start = new Date(now); start.setHours(now.getHours() + 1, 0, 0, 0)
    const rangeStart = new Date(start); rangeStart.setDate(rangeStart.getDate() - 3)
    const rangeEnd = new Date(start); rangeEnd.setDate(rangeEnd.getDate() + 10); rangeEnd.setHours(start.getHours() + 2, 0, 0, 0)
    const n = store.createNode({ text: 'Curso IA Mutxamiel', parentId: null })
    store.updateNode(n.id, { due: rangeStart.toISOString(), dueEnd: rangeEnd.toISOString(), status: 'pending', isEvent: true })

    const item = listUpcomingTimed(6, now).find(i => i.text === 'Curso IA Mutxamiel')
    expect(item).toBeDefined()
    // Empieza HOY a la hora del rango, no hace tres días.
    expect(item!.due.getDate()).toBe(now.getDate())
    expect(item!.due.getHours()).toBe(start.getHours())
    // Y termina hoy también, no dentro de diez días.
    expect(item!.dueEnd.getDate()).toBe(now.getDate())
  })

  it('un día quitado a mano no cuenta: salta al siguiente del rango', () => {
    const now = new Date()
    const start = new Date(now); start.setHours(now.getHours() + 1, 0, 0, 0)
    const rangeEnd = new Date(start); rangeEnd.setDate(rangeEnd.getDate() + 10); rangeEnd.setHours(start.getHours() + 2, 0, 0, 0)
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const n = store.createNode({ text: 'Curso IA Mutxamiel', parentId: null })
    store.updateNode(n.id, {
      due: start.toISOString(), dueEnd: rangeEnd.toISOString(), status: 'pending', isEvent: true,
      extraData: JSON.stringify({ _recExdates: key }),
    })

    const item = listUpcomingTimed(6, now).find(i => i.text === 'Curso IA Mutxamiel')
    expect(item).toBeDefined()
    expect(item!.due.getDate()).not.toBe(now.getDate())  // hoy está quitado
  })
})
