// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { getPapeleraNode } from '../utils/papeleraHelper'
import { tryDeleteSelection } from '../components/outliner/Outliner'

// Construye en el DOM una fila .node-row.multi-selected envuelta en [data-node-id]
function renderSelectedRow(id: string) {
  const host = document.createElement('div')
  host.setAttribute('data-node-id', id)
  const row = document.createElement('div')
  row.className = 'node-row multi-selected'
  host.appendChild(row)
  document.body.appendChild(host)
}

describe('Borrado múltiple — tryDeleteSelection (selección desde el DOM)', () => {
  beforeEach(() => {
    store.nodes.clear()
    document.body.innerHTML = ''
  })

  it('con _gSelectedIds vacío, usa el resaltado del DOM y borra TODOS', () => {
    const note = store.createNode({ text: 'The Secret Mindset', parentId: null })
    const c1 = store.createNode({ text: 'Falsas rupturas', parentId: note.id, siblingOrder: 1 })
    const c2 = store.createNode({ text: 'La Clave', parentId: note.id, siblingOrder: 2 })
    const c2a = store.createNode({ text: 'Cambio de chip', parentId: c2.id, siblingOrder: 1 })
    const c3 = store.createNode({ text: '', parentId: note.id, siblingOrder: 3 })

    // El usuario ve resaltadas estas filas (pero _gSelectedIds está vacío/desincronizado)
    for (const id of [c1.id, c2.id, c2a.id, c3.id]) renderSelectedRow(id)

    const acted = tryDeleteSelection()
    expect(acted).toBe(true)
    expect(store.children(note.id).length).toBe(0)
    expect(getPapeleraNode()).toBeTruthy()
  })

  it('si el DOM resalta MÁS que el estado global, gana el DOM (desincronización)', () => {
    const note = store.createNode({ text: 'N', parentId: null })
    const a = store.createNode({ text: 'a', parentId: note.id, siblingOrder: 1 })
    const b = store.createNode({ text: 'b', parentId: note.id, siblingOrder: 2 })
    const c = store.createNode({ text: 'c', parentId: note.id, siblingOrder: 3 })
    // DOM resalta a, b, c (el estado global está vacío/desincronizado) → gana el DOM.
    for (const id of [a.id, b.id, c.id]) renderSelectedRow(id)
    expect(tryDeleteSelection()).toBe(true)
    expect(store.children(note.id).length).toBe(0)
  })

  it('no actúa si hay menos de 2 elementos', () => {
    const note = store.createNode({ text: 'N', parentId: null })
    const c1 = store.createNode({ text: 'uno', parentId: note.id })
    renderSelectedRow(c1.id)
    expect(tryDeleteSelection()).toBe(false)
    expect(store.children(note.id).length).toBe(1)
  })
})
