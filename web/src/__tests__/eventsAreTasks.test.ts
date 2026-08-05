// «Un evento es una tarea con día y hora» (5 ago 2026) — utils/taskNode.ts +
// utils/migrateEventsToTasks.ts. Cubre lo que de verdad puede romperse al unificar:
// que un evento cuente como tarea, que la migración no toque nada más, y que el
// cockpit de Hoy siga SIN mezclarlos (los eventos tienen su propio bloque en Día;
// si entraran también en «atrasadas» saldrían duplicados).
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { isTaskNode, hasTimeOfDay } from '../utils/taskNode'
import { migrateEventsToTasks } from '../utils/migrateEventsToTasks'
import { collectDailyCockpit } from '../utils/dailyCockpit'
import { classifyElement } from '../v2/elementKind'

function iso(daysFromToday: number, h = 10, m = 0): string {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString()
}

describe('evento = tarea con día y hora', () => {
  beforeEach(() => {
    store.nodes.clear()
    localStorage.clear()
  })

  it('isTaskNode: tarea, evento antiguo (sin status) y evento migrado cuentan como tarea', () => {
    const tarea = store.createNode({ text: 'Tarea', parentId: null, isTask: true })
    const evento = store.createNode({ text: 'Reunión', parentId: null, due: iso(0, 11) })
    store.updateNode(evento.id, { isEvent: true })
    const nota = store.createNode({ text: 'Nota suelta', parentId: null })

    expect(isTaskNode(store.getNode(tarea.id)!)).toBe(true)
    expect(isTaskNode(store.getNode(evento.id)!)).toBe(true)   // sin status todavía
    expect(isTaskNode(store.getNode(nota.id)!)).toBe(false)
  })

  it('hasTimeOfDay distingue «tiene hora» de «solo día»', () => {
    const conHora = store.createNode({ text: 'Con hora', parentId: null, due: iso(0, 9, 30) })
    const sinHora = store.createNode({ text: 'Todo el día', parentId: null, due: iso(0, 0, 0) })
    const sinFecha = store.createNode({ text: 'Sin fecha', parentId: null })
    expect(hasTimeOfDay(store.getNode(conHora.id)!)).toBe(true)
    expect(hasTimeOfDay(store.getNode(sinHora.id)!)).toBe(false)
    expect(hasTimeOfDay(store.getNode(sinFecha.id)!)).toBe(false)
  })

  it('la migración da status a los eventos sin él, y solo a esos', () => {
    const evento = store.createNode({ text: 'Reunión', parentId: null, due: iso(-3, 12) })
    store.updateNode(evento.id, { isEvent: true })
    const eventoHecho = store.createNode({ text: 'Ya cerrado', parentId: null, due: iso(-1, 12) })
    store.updateNode(eventoHecho.id, { isEvent: true, status: 'done' })
    const nota = store.createNode({ text: 'Nota', parentId: null })

    expect(migrateEventsToTasks()).toBe(1)
    expect(store.getNode(evento.id)!.status).toBe('pending')
    expect(store.getNode(evento.id)!.isEvent).toBe(true)   // sigue siendo evento
    expect(store.getNode(eventoHecho.id)!.status).toBe('done') // no se pisa
    expect(store.getNode(nota.id)!.status).toBeNull()

    // Idempotente: una segunda pasada no vuelve a tocar nada.
    expect(migrateEventsToTasks()).toBe(0)
  })

  it('un evento migrado NO se cuela en atrasadas/hoy del cockpit (Día ya lo pinta)', () => {
    const evento = store.createNode({ text: 'Reunión vieja', parentId: null, due: iso(-5, 12) })
    store.updateNode(evento.id, { isEvent: true })
    store.createNode({ text: 'Tarea atrasada', parentId: null, isTask: true, due: iso(-2) })
    migrateEventsToTasks()

    const data = collectDailyCockpit()
    expect(data.overdue.map(n => n.text)).toEqual(['Tarea atrasada'])
    expect(data.today).toHaveLength(0)
  })

  it('un evento nunca se lista como «elemento» (tiene su lista de tareas)', () => {
    const evento = store.createNode({ text: 'Reunión', parentId: null, due: iso(1, 17) })
    store.updateNode(evento.id, { isEvent: true })
    migrateEventsToTasks()
    expect(classifyElement(store.getNode(evento.id)!)).toBeNull()
  })
})
