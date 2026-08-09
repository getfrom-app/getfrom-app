// @vitest-environment jsdom
// Tareas de un DOCUMENTO: el vínculo va por `_taskOf` (id), no por el árbol, justo
// porque la instancia siguiente de una tarea recurrente nace colgando del día que
// toca. Estos tests blindan las dos cosas de las que depende todo lo demás: que la
// tarea siga perteneciendo al documento después de mudarse, y que «cada 15 días»
// escrito a mano se convierta en fecha + recurrencia de verdad.
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { tasksOfDoc, createDocTask, docIdOfTask, nextRecurrenceInstance } from '../utils/docTasks'

const makeDoc = (text: string) => {
  const d = store.createNode({ text, parentId: null, extraData: { _doc: '1' } })
  return store.getNode(d.id)!
}

describe('docTasks', () => {
  beforeEach(() => { store.nodes.clear() })

  it('«seguimiento cada 15 días» → título limpio, fecha a 15 días y recurrencia', () => {
    const doc = makeDoc('Alejandro Mantecón')
    const task = createDocTask(doc.id, 'seguimiento cada 15 días')!
    expect(task.text).toBe('seguimiento')
    expect(task.status).toBe('pending')
    expect(task.recurrence).toBe('daily:15')
    const days = Math.round((new Date(task.due!).getTime() - Date.now()) / 86400000)
    expect(days).toBeGreaterThanOrEqual(14)
    expect(days).toBeLessThanOrEqual(15)
  })

  it('la tarea sigue siendo del documento aunque la recurrencia la mude a otro padre', () => {
    const doc = makeDoc('Alejandro Mantecón')
    const task = createDocTask(doc.id, 'seguimiento')!
    const otroDia = store.createNode({ text: '20 ago', parentId: null })
    store.updateNode(task.id, { parentId: otroDia.id })
    expect(docIdOfTask(store.getNode(task.id))).toBe(doc.id)
    expect(tasksOfDoc(doc.id).map(n => n.id)).toContain(task.id)
  })

  it('una casilla del cuerpo (legado, solo parentId) también cuenta como tarea del documento', () => {
    const doc = makeDoc('Cliente')
    const legacy = store.createNode({ text: 'llamar', parentId: doc.id, extraData: { _taskEmbed: '1' } })
    store.updateNode(legacy.id, { status: 'pending' })
    expect(tasksOfDoc(doc.id).map(n => n.id)).toEqual([legacy.id])
  })

  it('pendientes antes que completadas, y las pendientes por fecha', () => {
    const doc = makeDoc('Proyecto')
    const hecha = createDocTask(doc.id, 'ya hecha')!
    store.updateNode(hecha.id, { status: 'done' })
    const tarde = createDocTask(doc.id, 'revisar el 20 de diciembre')!
    const pronto = createDocTask(doc.id, 'revisar mañana')!
    expect(tasksOfDoc(doc.id).map(n => n.id)).toEqual([pronto.id, tarde.id, hecha.id])
  })

  it('la instancia siguiente de una recurrente se reconoce por documento y título', () => {
    const doc = makeDoc('Alumno')
    const done = createDocTask(doc.id, 'seguimiento')!
    store.updateNode(done.id, { status: 'done' })
    expect(nextRecurrenceInstance(store.getNode(done.id)!)).toBe(null)
    // Lo que deja spawnRecurrence: mismo título y `_taskOf`, colgando del día.
    const dia = store.createNode({ text: '21 ago', parentId: null })
    const next = store.createNode({ text: 'seguimiento', parentId: dia.id, extraData: { _taskOf: doc.id } })
    store.updateNode(next.id, { status: 'pending' })
    expect(nextRecurrenceInstance(store.getNode(done.id)!)?.id).toBe(next.id)
  })
})

// La recurrencia de una tarea que NO cuelga de un día (las de un documento) parte de
// su propia fecha: si no, la instancia siguiente nace el mismo día que la completada.
describe('spawnRecurrence en tareas de documento', () => {
  beforeEach(() => { store.nodes.clear() })

  it('la siguiente instancia va 15 días después de la fecha de la tarea, no de hoy', async () => {
    const { spawnRecurrence } = await import('../utils/dailyCockpit')
    const doc = makeDoc('Alumno')
    const task = createDocTask(doc.id, 'seguimiento cada 15 días')!
    const dueOld = new Date(task.due!)
    spawnRecurrence(task)
    const next = nextRecurrenceInstance(store.getNode(task.id)!)
    expect(next).not.toBe(null)
    const days = Math.round((new Date(next!.due!).getTime() - dueOld.getTime()) / 86400000)
    expect(days).toBe(15)
  })
})
