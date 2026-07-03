// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { convertNoteToBlock, revertAllNoteBlocks, findConvertibleNotes } from '../utils/noteBlocks'

const ed = (id: string) => { try { return JSON.parse(store.getNode(id)?.extraData || '{}') } catch { return {} } }

describe('noteBlocks — conversión con contenido mixto (extracción)', () => {
  beforeEach(() => { store.nodes.clear() })

  it('aplana texto/tareas en el body y EXTRAE los elementos no-texto como hermanos', () => {
    const note = store.createNode({ text: 'Mi nota', parentId: null })
    const l1 = store.createNode({ text: 'Primera línea', parentId: note.id })
    store.createNode({ text: 'Segunda línea', parentId: note.id })
    const task = store.createNode({ text: 'Una tarea', parentId: note.id })
    store.updateNode(task.id, { status: 'pending' })
    // Elemento NO texto: una vista kanban (debe conservarse aparte, no aplanarse)
    const kanban = store.createNode({ text: 'Mi kanban', parentId: note.id })
    store.updateNode(kanban.id, { extraData: JSON.stringify({ viewBlock: 'kanban' }) })
    // Un recurso (imagen) también debe extraerse
    const img = store.createNode({ text: 'Foto', parentId: note.id })
    store.updateNode(img.id, { isResource: true })

    expect(convertNoteToBlock(note.id)).toBe(true)

    // La nota es ahora un bloque _doc
    const e = ed(note.id)
    expect(e._doc).toBe('1')
    expect(e._fromNote).toBe('1')
    const body = store.getNode(note.id)!.body || ''
    expect(body).toContain('Primera línea')
    expect(body).toContain('Una tarea')
    // Los elementos NO texto NO están en el body
    expect(body).not.toContain('Mi kanban')
    expect(body).not.toContain('Foto')

    // kanban e imagen extraídos como HERMANOS de la tarjeta (mismo padre que la nota = null)
    for (const x of [kanban, img]) {
      const xe = ed(x.id)
      expect(xe._extractedFrom).toBe(note.id)
      expect(store.getNode(x.id)!.parentId).toBe(null)
    }
    expect(ed(kanban.id).viewBlock).toBe('kanban') // tipo conservado
    // líneas absorbidas (ocultas, reversible)
    expect(ed(l1.id)._absorbedBy).toBe(note.id)
  })

  it('trata viewBlock:"lista" como nota convertible y guarda body previo (pizarra)', () => {
    const note = store.createNode({ text: 'Nota lista con dibujo', parentId: null })
    store.updateNode(note.id, { extraData: JSON.stringify({ viewBlock: 'lista' }), body: '```from-pizarra\n{"strokes":[1]}' })
    store.createNode({ text: 'contenido', parentId: note.id })

    expect(findConvertibleNotes().some(n => n.id === note.id)).toBe(true)
    expect(convertNoteToBlock(note.id)).toBe(true)
    const e = ed(note.id)
    expect(e._doc).toBe('1')
    expect(e.viewBlock).toBeUndefined()          // deja de ser vista de lista
    expect(e._prevViewBlock).toBe('lista')
    expect(e._prevBody).toContain('from-pizarra') // body previo GUARDADO, no perdido
  })

  it('revertAllNoteBlocks restaura padres, viewBlock y body previo', () => {
    const note = store.createNode({ text: 'Nota', parentId: null })
    store.updateNode(note.id, { extraData: JSON.stringify({ viewBlock: 'lista' }), body: 'PREVIO' })
    store.createNode({ text: 'línea', parentId: note.id })
    const ev = store.createNode({ text: 'Evento', parentId: note.id })
    store.updateNode(ev.id, { isEvent: true })

    convertNoteToBlock(note.id)
    expect(store.getNode(ev.id)!.parentId).toBe(null) // extraído

    revertAllNoteBlocks()
    const e = ed(note.id)
    expect(e._doc).toBeUndefined()
    expect(e._fromNote).toBeUndefined()
    expect(e.viewBlock).toBe('lista')                 // vista restaurada
    expect(store.getNode(note.id)!.body).toBe('PREVIO') // body previo restaurado
    expect(store.getNode(ev.id)!.parentId).toBe(note.id) // evento reparentado de vuelta
    expect(ed(ev.id)._extractedFrom).toBeUndefined()
  })
})
