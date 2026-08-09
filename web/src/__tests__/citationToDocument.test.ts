// @vitest-environment jsdom
// Convertir una CITA en documento independiente: lo delicado no es romper el vínculo
// (son cuatro claves de extraData), sino que el bloque citado desaparezca del
// documento ORIGEN — con el origen cerrado hay que editar su `body` (HTML) aplicando
// la misma regla de jerarquía con la que se creó la cita. Y como se borra texto de
// otro documento, el `undo` tiene que devolverlo todo a su sitio.
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { promoteCitationToDocument, isCitationNode } from '../utils/citations'
import { parseExtraData } from '../utils/papeleraHelper'

const SOURCE_HTML = [
  '<p data-pid="p1">Alejandro Mantecón</p>',
  '<p data-pid="p2" data-indent="1">Empezó en marzo</p>',
  '<p data-pid="p3">Otro alumno</p>',
].join('')

function setup() {
  const ctx = store.createNode({ text: 'Alumnos', parentId: null, extraData: { _ctx: '1' } })
  const doc = store.createNode({ text: 'Clases', parentId: null, extraData: { _doc: '1' } })
  store.updateNode(doc.id, { body: SOURCE_HTML })
  const cita = store.createNode({
    text: 'Alejandro Mantecón',
    parentId: doc.id,
    extraData: {
      _doc: '1', _docSelection: '1', _docSourceId: doc.id, _docParagraphId: 'p1',
      _docText: 'Alejandro Mantecón\n\nEmpezó en marzo', _ctxRefs: [ctx.id],
    },
  })
  store.updateNode(cita.id, { body: '<blockquote><p>Alejandro Mantecón</p><p>Empezó en marzo</p></blockquote>' })
  return { ctx, doc, cita }
}

describe('convertir una cita en documento', () => {
  beforeEach(() => { store.nodes.clear() })

  it('borra del origen el párrafo citado y sus hijos, y deja el resto intacto', () => {
    const { doc, cita } = setup()
    expect(promoteCitationToDocument(cita.id).ok).toBe(true)
    const body = store.getNode(doc.id)!.body || ''
    expect(body).not.toContain('Alejandro Mantecón')
    expect(body).not.toContain('Empezó en marzo')
    expect(body).toContain('Otro alumno')
  })

  it('deja de ser cita, pierde el blockquote y pasa a colgar de su contexto', () => {
    const { ctx, cita } = setup()
    promoteCitationToDocument(cita.id)
    const after = store.getNode(cita.id)!
    expect(isCitationNode(after)).toBe(false)
    const e = parseExtraData(after.extraData)
    expect(e._doc).toBe('1')
    expect(e._docSourceId).toBeUndefined()
    expect(after.body).not.toContain('blockquote')
    expect(after.body).toContain('Alejandro Mantecón')
    expect(after.parentId).toBe(ctx.id)
  })

  it('deshacer devuelve el texto al origen y la cita a su sitio', () => {
    const { doc, cita } = setup()
    const res = promoteCitationToDocument(cita.id)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    res.undo()
    expect(store.getNode(doc.id)!.body).toBe(SOURCE_HTML)
    const back = store.getNode(cita.id)!
    expect(isCitationNode(back)).toBe(true)
    expect(back.parentId).toBe(doc.id)
    expect(back.body).toContain('blockquote')
  })

  it('si el pid se regeneró en el origen, el bloque se encuentra por el texto citado', () => {
    const { doc, cita } = setup()
    store.updateNode(doc.id, { body: SOURCE_HTML.replace('data-pid="p1"', 'data-pid="nuevo"') })
    promoteCitationToDocument(cita.id)
    expect(store.getNode(doc.id)!.body).not.toContain('Alejandro Mantecón')
  })

  it('no hace nada sobre un nodo que no es una cita', () => {
    const doc = store.createNode({ text: 'Suelto', parentId: null, extraData: { _doc: '1' } })
    expect(promoteCitationToDocument(doc.id).ok).toBe(false)
  })
})
