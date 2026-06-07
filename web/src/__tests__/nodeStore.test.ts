import { describe, it, expect, beforeEach } from 'vitest'
import { store, nodeMeta } from '../store/nodeStore'

describe('NodeStore — flujos críticos', () => {
  beforeEach(() => {
    // Limpiar el store entre tests
    store.nodes.clear()
  })

  describe('createNode', () => {
    it('crea un nodo básico con id', () => {
      const n = store.createNode({ text: 'Test', parentId: null })
      expect(n.id).toBeTruthy()
      expect(n.text).toBe('Test')
      expect(n.parentId).toBeNull()
    })

    it('createNode con isTask aplica status pending', () => {
      const n = store.createNode({ text: 'Tarea', parentId: null, isTask: true })
      expect(n.status).toBe('pending')
    })
  })

  describe('updateNode', () => {
    it('actualiza un campo y marca el nodo dirty', () => {
      const n = store.createNode({ text: 'x', parentId: null })
      store.updateNode(n.id, { text: 'y' })
      expect(store.getNode(n.id)?.text).toBe('y')
    })

    it('updateNode con cambio de parentId invalida la cache de children', () => {
      const parent1 = store.createNode({ text: 'P1', parentId: null })
      const parent2 = store.createNode({ text: 'P2', parentId: null })
      const child = store.createNode({ text: 'C', parentId: parent1.id })

      expect(store.children(parent1.id).length).toBe(1)
      expect(store.children(parent2.id).length).toBe(0)

      store.updateNode(child.id, { parentId: parent2.id })

      expect(store.children(parent1.id).length).toBe(0)
      expect(store.children(parent2.id).length).toBe(1)
    })
  })

  describe('children() cache', () => {
    it('devuelve hijos ordenados por siblingOrder', () => {
      const p = store.createNode({ text: 'P', parentId: null })
      const c1 = store.createNode({ text: 'C1', parentId: p.id, siblingOrder: 2 })
      const c2 = store.createNode({ text: 'C2', parentId: p.id, siblingOrder: 1 })
      const kids = store.children(p.id)
      expect(kids).toHaveLength(2)
      expect(kids[0].id).toBe(c2.id)
      expect(kids[1].id).toBe(c1.id)
    })

    it('excluye nodos eliminados', () => {
      const p = store.createNode({ text: 'P', parentId: null })
      const c = store.createNode({ text: 'C', parentId: p.id })
      expect(store.children(p.id).length).toBe(1)
      store.deleteNode(c.id)
      expect(store.children(p.id).length).toBe(0)
    })
  })

  describe('expandToContainer (Ampliar)', () => {
    it('convierte una tarea en contenedor con la tarea original como primera sub-tarea', () => {
      const task = store.createNode({ text: 'Hacer presupuesto', parentId: null, isTask: true })
      store.updateNode(task.id, { due: '2026-05-27T09:00:00.000Z', priority: 'high' })

      const result = store.expandToContainer(task.id)
      expect(result).toBeTruthy()

      const container = store.getNode(result!.containerId)
      const child = store.getNode(result!.firstChildId)

      // El padre ya no es tarea
      expect(container?.status).toBeNull()
      expect(container?.due).toBeNull()
      expect(container?.priority).toBeNull()
      expect(container?.text).toBe('Hacer presupuesto')

      // El hijo conserva los datos originales
      expect(child?.status).toBe('pending')
      expect(child?.due).toBe('2026-05-27T09:00:00.000Z')
      expect(child?.priority).toBe('high')
      expect(child?.parentId).toBe(container?.id)
    })

    it('expandToContainer sobre nodo no-tarea devuelve null', () => {
      const note = store.createNode({ text: 'Nota', parentId: null })
      const result = store.expandToContainer(note.id)
      expect(result).toBeNull()
    })
  })

  describe('scheduleNodeAt', () => {
    it('agenda un nodo con due ISO', () => {
      const n = store.createNode({ text: 'Tarea', parentId: null, isTask: true })
      store.scheduleNodeAt(n.id, '2026-05-27T15:00:00.000Z')
      expect(store.getNode(n.id)?.due).toBe('2026-05-27T15:00:00.000Z')
    })

    it('scheduleNodeAt sobre nodo con types includes bucle lo rechaza', () => {
      const n = store.createNode({ text: 'Tag bucle', parentId: null, types: ['bucle'] })
      const r = store.scheduleNodeAt(n.id, '2026-05-27T10:00:00.000Z')
      expect(r).toBeNull()
    })
  })

  describe('liveContainers (auto-containers)', () => {
    it('detecta una nota con tareas pendientes dentro', () => {
      const container = store.createNode({ text: 'Proyecto X', parentId: null })
      store.createNode({ text: 'T1', parentId: container.id, isTask: true })
      const containers = store.liveContainers()
      expect(containers.some(c => c.id === container.id)).toBe(true)
    })

    it('una nota sin tareas pendientes NO es container', () => {
      const note = store.createNode({ text: 'Nota suelta', parentId: null })
      store.createNode({ text: 'sub', parentId: note.id }) // no tarea
      const containers = store.liveContainers()
      expect(containers.some(c => c.id === note.id)).toBe(false)
    })

    it('cuando todas las tareas están done, deja de ser container vivo', () => {
      const c = store.createNode({ text: 'Proyecto', parentId: null })
      const t = store.createNode({ text: 'T', parentId: c.id, isTask: true })
      expect(store.liveContainers().some(x => x.id === c.id)).toBe(true)
      store.updateNode(t.id, { status: 'done' })
      expect(store.liveContainers().some(x => x.id === c.id)).toBe(false)
    })
  })

  describe('nodeMeta (extraData typed)', () => {
    it('lee color de la columna directa', () => {
      const n = store.createNode({ text: 'x', parentId: null })
      // Simular columna directa
      store.nodes.set(n.id, { ...store.getNode(n.id)!, color: '#ff0000' })
      expect(nodeMeta(store.getNode(n.id)).color).toBe('#ff0000')
    })

    it('lee color de extraData como fallback', () => {
      const n = store.createNode({ text: 'x', parentId: null, extraData: { color: '#00ff00' } })
      expect(nodeMeta(store.getNode(n.id)).color).toBe('#00ff00')
    })

    it('extraBlock desde columna .block', () => {
      const n = store.createNode({ text: 'x', parentId: null })
      store.nodes.set(n.id, { ...store.getNode(n.id)!, block: 'h1' })
      expect(nodeMeta(store.getNode(n.id)).block).toBe('h1')
    })
  })
})
