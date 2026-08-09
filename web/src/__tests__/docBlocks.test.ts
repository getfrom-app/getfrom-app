// @vitest-environment jsdom
// La regla de jerarquía de un documento (qué cuelga de un párrafo o de un encabezado)
// decide DOS cosas distintas: qué texto se guarda en una cita y qué se BORRA del
// documento origen al convertir esa cita en documento. Si las dos dejan de coincidir,
// convertir se lleva por delante texto que la cita nunca incluyó — de ahí este test.
import { describe, it, expect } from 'vitest'
import { blocksFromHtml, descendantPids, blockTexts, findAnchorPid, removeBlocksFromHtml } from '../utils/docBlocks'

const HTML = [
  '<h2 data-pid="h1">Alumnos</h2>',
  '<p data-pid="p1">Alejandro Mantecón</p>',
  '<p data-pid="p2" data-indent="1">Empezó en marzo</p>',
  '<p data-pid="p3" data-indent="2">Nivel intermedio</p>',
  '<p data-pid="p4">Otro alumno</p>',
  '<h2 data-pid="h2">Notas</h2>',
  '<p data-pid="p5">Suelta</p>',
].join('')

describe('docBlocks', () => {
  it('un encabezado se lleva todo hasta el siguiente del mismo nivel', () => {
    const b = blocksFromHtml(HTML)
    expect(descendantPids(b, 'h1')).toEqual(['h1', 'p1', 'p2', 'p3', 'p4'])
  })

  it('un párrafo se lleva solo lo MÁS indentado, y nunca cruza un encabezado', () => {
    const b = blocksFromHtml(HTML)
    expect(descendantPids(b, 'p1')).toEqual(['p1', 'p2', 'p3'])
    expect(descendantPids(b, 'p4')).toEqual(['p4'])
    expect(descendantPids(b, 'p3')).toEqual(['p3'])
  })

  it('el texto de la cita es el de esos bloques, separados por línea en blanco', () => {
    const b = blocksFromHtml(HTML)
    expect(blockTexts(b, descendantPids(b, 'p1'))).toBe('Alejandro Mantecón\n\nEmpezó en marzo\n\nNivel intermedio')
  })

  it('si el pid se regeneró, el ancla se encuentra por el texto citado', () => {
    const b = blocksFromHtml(HTML)
    expect(findAnchorPid(b, 'ya-no-existe', 'Alejandro Mantecón\n\nEmpezó en marzo')).toBe('p1')
    expect(findAnchorPid(b, 'p4', 'lo que sea')).toBe('p4')
    expect(findAnchorPid(b, null, 'nada que coincida')).toBe(null)
  })

  it('quitar el bloque deja el resto del documento intacto', () => {
    const b = blocksFromHtml(HTML)
    const out = removeBlocksFromHtml(HTML, descendantPids(b, 'p1'))
    expect(out).not.toContain('Alejandro Mantecón')
    expect(out).not.toContain('Nivel intermedio')
    expect(out).toContain('Otro alumno')
    expect(out).toContain('Alumnos')
    expect(out).toContain('Suelta')
  })

  it('al vaciar una viñeta se limpian el <li> y la lista huérfanos', () => {
    const html = '<ul><li><p data-pid="a">Uno</p></li><li><p data-pid="b">Dos</p></li></ul><p data-pid="c">Fin</p>'
    expect(removeBlocksFromHtml(html, ['a'])).toBe('<ul><li><p data-pid="b">Dos</p></li></ul><p data-pid="c">Fin</p>')
    expect(removeBlocksFromHtml(html, ['a', 'b'])).toBe('<p data-pid="c">Fin</p>')
  })
})
