// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { collectDayTasks } from '../utils/dailyCockpit'

describe('collectDayTasks — tareas de un día concreto (no solo hoy)', () => {
  beforeEach(() => { store.nodes.clear() })

  it('una tarea creada hoy con due mañana aparece en las tareas de mañana', () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const dayNote = store.createNode({ text: 'Hoy', parentId: null })
    const t = store.createNode({ text: 'Giancarlo', parentId: dayNote.id })
    const due = new Date(tomorrow); due.setHours(10, 0, 0, 0)
    store.updateNode(t.id, { status: 'pending', due: due.toISOString() })

    const manana = collectDayTasks(tomorrow)
    expect(manana.map(n => n.id)).toContain(t.id)
    expect(collectDayTasks(today).map(n => n.id)).not.toContain(t.id)
  })

  it('ignora eventos y notas sin estado', () => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const ev = store.createNode({ text: 'evento', parentId: null })
    store.updateNode(ev.id, { isEvent: true, due: new Date(d.setHours(9)).toISOString() })
    const note = store.createNode({ text: 'nota datada', parentId: null })
    store.updateNode(note.id, { due: new Date().toISOString() }) // status null
    expect(collectDayTasks(new Date()).length).toBe(0)
  })
})
