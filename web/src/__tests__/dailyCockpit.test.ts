import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { collectDailyCockpit, postponeTask, toggleTaskDone } from '../utils/dailyCockpit'

function iso(daysFromToday: number): string {
  const d = new Date()
  d.setHours(10, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString()
}

describe('dailyCockpit — sección «Tu día»', () => {
  beforeEach(() => {
    store.nodes.clear()
  })

  it('clasifica atrasadas, hoy y bucles abiertos', () => {
    store.createNode({ text: 'Atrasada', parentId: null, isTask: true, due: iso(-2) })
    store.createNode({ text: 'Para hoy', parentId: null, isTask: true, due: iso(0) })
    store.createNode({ text: 'Futura', parentId: null, isTask: true, due: iso(3) })
    const bucle = store.createNode({ text: 'Bucle abierto', parentId: null })
    store.updateNode(bucle.id, { types: ['bucle'] })

    const data = collectDailyCockpit()
    expect(data.overdue.map(n => n.text)).toEqual(['Atrasada'])
    expect(data.today.map(n => n.text)).toEqual(['Para hoy'])
    expect(data.seguimiento.map(n => n.text)).toEqual(['Bucle abierto'])
  })

  it('un bucle cerrado (status done) no aparece', () => {
    const bucle = store.createNode({ text: 'Bucle cerrado', parentId: null })
    store.updateNode(bucle.id, { types: ['bucle'], status: 'done' })
    expect(collectDailyCockpit().seguimiento).toHaveLength(0)
  })

  it('tareas completadas SIN _doneAt de hoy no aparecen (hechas otro día)', () => {
    const t = store.createNode({ text: 'Hecha ayer', parentId: null, isTask: true, due: iso(-1) })
    store.updateNode(t.id, { status: 'done' })
    const data = collectDailyCockpit()
    expect(data.overdue).toHaveLength(0)
    expect(data.today).toHaveLength(0)
  })

  it('completada HOY (toggleTaskDone) sigue visible, al final de su grupo', () => {
    store.createNode({ text: 'Pendiente vieja', parentId: null, isTask: true, due: iso(-3) })
    const t = store.createNode({ text: 'Hecha hoy', parentId: null, isTask: true, due: iso(-1) })

    toggleTaskDone(store.getNode(t.id)!)
    let data = collectDailyCockpit()
    expect(store.getNode(t.id)!.status).toBe('done')
    // Sigue en atrasadas, pero ordenada DESPUÉS de la pendiente (pese a due más reciente)
    expect(data.overdue.map(n => n.text)).toEqual(['Pendiente vieja', 'Hecha hoy'])

    // Des-completar la devuelve a pendiente y a su orden por due
    toggleTaskDone(store.getNode(t.id)!)
    data = collectDailyCockpit()
    expect(store.getNode(t.id)!.status).toBe('pending')
    expect(data.overdue.map(n => n.text)).toEqual(['Pendiente vieja', 'Hecha hoy'])
    expect(JSON.parse(store.getNode(t.id)!.extraData || '{}')._doneAt).toBeUndefined()
  })

  it('completada con _doneAt de AYER no aparece (caduca sola)', () => {
    const t = store.createNode({ text: 'Hecha ayer con flag', parentId: null, isTask: true, due: iso(-1) })
    const y = new Date(); y.setDate(y.getDate() - 1)
    const key = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    store.updateNode(t.id, { status: 'done', extraData: JSON.stringify({ _doneAt: key }) })
    expect(collectDailyCockpit().overdue).toHaveLength(0)
  })

  it('las notas diarias nunca cuentan', () => {
    const diary = store.createNode({ text: 'Lunes', parentId: null })
    store.updateNode(diary.id, { isDiaryEntry: true, diaryDate: iso(-3), status: 'pending', due: iso(-3) })
    expect(collectDailyCockpit().overdue).toHaveLength(0)
  })

  it('nodos en papelera quedan excluidos', () => {
    const papelera = store.createNode({ text: '🗑 Papelera', parentId: null })
    const t = store.createNode({ text: 'Tirada', parentId: papelera.id, isTask: true, due: iso(-1) })
    // Simular que el helper de papelera la reconoce: el nombre canónico basta
    // si getPapeleraNode la encuentra; si no, al menos verificamos deletedAt.
    store.updateNode(t.id, { deletedAt: new Date().toISOString() })
    expect(collectDailyCockpit().overdue.map(n => n.text)).not.toContain('Tirada')
  })

  it('⏭ postponeTask: mañana, +7 días y sin fecha', () => {
    const t = store.createNode({ text: 'Posponme', parentId: null, isTask: true, due: iso(-1) })

    postponeTask(store.getNode(t.id)!, 1)
    let due = new Date(store.getNode(t.id)!.due!)
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1)
    expect(due.getTime()).toBe(tomorrow.getTime())
    expect(collectDailyCockpit().overdue).toHaveLength(0)

    postponeTask(store.getNode(t.id)!, 7)
    due = new Date(store.getNode(t.id)!.due!)
    const week = new Date(); week.setHours(0, 0, 0, 0); week.setDate(week.getDate() + 7)
    expect(due.getTime()).toBe(week.getTime())

    postponeTask(store.getNode(t.id)!, null)
    expect(store.getNode(t.id)!.due).toBeNull()
  })

  it('las atrasadas se ordenan por due', () => {
    store.createNode({ text: 'B muy atrasada', parentId: null, isTask: true, due: iso(-5) })
    store.createNode({ text: 'A poco atrasada', parentId: null, isTask: true, due: iso(-1) })
    const data = collectDailyCockpit()
    expect(data.overdue.map(n => n.text)).toEqual(['B muy atrasada', 'A poco atrasada'])
  })
})
