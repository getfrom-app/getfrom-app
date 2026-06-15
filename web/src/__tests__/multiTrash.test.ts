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

  it('detecta filas formateadas (encabezados/negrita/numeradas) igual que las planas', () => {
    const note = store.createNode({ text: 'N', parentId: null })
    const plano = store.createNode({ text: 'plano', parentId: note.id, siblingOrder: 1 })
    const heading = store.createNode({ text: 'La Clave', parentId: note.id, siblingOrder: 2 })
    store.updateNode(heading.id, { extraData: JSON.stringify({ block: 'h2' }) })
    const bold = store.createNode({ text: '**Negrita:** algo', parentId: note.id, siblingOrder: 3 })
    const numbered = store.createNode({ text: '1. Numerada', parentId: note.id, siblingOrder: 4 })

    // DOM real: cada fila con su clase de bloque + multi-selected
    const rows: Array<[string, string]> = [
      [plano.id, 'node-row multi-selected'],
      [heading.id, 'node-row node-row--h2 multi-selected'],
      [bold.id, 'node-row multi-selected'],
      [numbered.id, 'node-row node-row--bullet multi-selected'],
    ]
    for (const [id, cls] of rows) {
      const host = document.createElement('div')
      host.className = 'outliner-node'
      host.setAttribute('data-node-id', id)
      const row = document.createElement('div')
      row.className = cls
      host.appendChild(row)
      document.body.appendChild(host)
    }

    expect(tryDeleteSelection()).toBe(true)
    expect(store.children(note.id).length).toBe(0)
  })

  it('borra encabezados PADRE con sus hijos seleccionados (anidación real)', () => {
    const note = store.createNode({ text: 'The Secret Mindset', parentId: null })
    // Encabezado padre con hijos (como en la captura)
    const h1 = store.createNode({ text: 'Las Trampas', parentId: note.id, siblingOrder: 1 })
    store.updateNode(h1.id, { extraData: JSON.stringify({ block: 'h2' }) })
    const p1 = store.createNode({ text: 'Falsas rupturas', parentId: h1.id, siblingOrder: 1 })
    const p2 = store.createNode({ text: 'Trampas de patrones', parentId: h1.id, siblingOrder: 2 })
    const h2 = store.createNode({ text: 'La Clave', parentId: h1.id, siblingOrder: 3 })
    store.updateNode(h2.id, { extraData: JSON.stringify({ block: 'h3' }) })
    const p3 = store.createNode({ text: 'Cambio de chip', parentId: h2.id, siblingOrder: 1 })

    // Selección visual del rango completo (DOM), incluyendo padres e hijos
    for (const id of [h1.id, p1.id, p2.id, h2.id, p3.id]) renderSelectedRow(id)

    expect(tryDeleteSelection()).toBe(true)
    expect(store.children(note.id).length).toBe(0)
  })

  it('borra nodos con extraData DOBLE-codificado (regresión: _block en string)', () => {
    const note = store.createNode({ text: 'N', parentId: null })
    const a = store.createNode({ text: 'a', parentId: note.id, siblingOrder: 1 })
    const b = store.createNode({ text: 'b', parentId: note.id, siblingOrder: 2 })
    // Corromper extraData: doble JSON.stringify (lo que rompía trashNode)
    store.updateNode(a.id, { extraData: JSON.stringify(JSON.stringify({ _block: 'bullet' })) })
    store.updateNode(b.id, { extraData: JSON.stringify(JSON.stringify({ _block: 'h2' })) })

    for (const id of [a.id, b.id]) renderSelectedRow(id)
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
