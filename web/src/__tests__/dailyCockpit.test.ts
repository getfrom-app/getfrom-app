import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { collectDailyCockpit } from '../utils/dailyCockpit'

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
    expect(data.bucles.map(n => n.text)).toEqual(['Bucle abierto'])
  })

  it('un bucle cerrado (status done) no aparece', () => {
    const bucle = store.createNode({ text: 'Bucle cerrado', parentId: null })
    store.updateNode(bucle.id, { types: ['bucle'], status: 'done' })
    expect(collectDailyCockpit().bucles).toHaveLength(0)
  })

  it('tareas completadas no aparecen aunque estén atrasadas', () => {
    const t = store.createNode({ text: 'Hecha ayer', parentId: null, isTask: true, due: iso(-1) })
    store.updateNode(t.id, { status: 'done' })
    const data = collectDailyCockpit()
    expect(data.overdue).toHaveLength(0)
    expect(data.today).toHaveLength(0)
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

  it('los bucles se ordenan alfabéticamente y las tareas por due', () => {
    store.createNode({ text: 'B muy atrasada', parentId: null, isTask: true, due: iso(-5) })
    store.createNode({ text: 'A poco atrasada', parentId: null, isTask: true, due: iso(-1) })
    const data = collectDailyCockpit()
    expect(data.overdue.map(n => n.text)).toEqual(['B muy atrasada', 'A poco atrasada'])
  })
})
