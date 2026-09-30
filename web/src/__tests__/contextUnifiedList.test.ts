// @vitest-environment jsdom
// Ficha de un contexto (columna derecha): tareas, eventos y elementos en UNA sola
// lista (30 sep 2026). Antes eran tres bloques — «Tareas» (con las completadas
// plegadas), «Eventos» y «Elementos». Este test pinta el componente de verdad y
// comprueba lo que se pidió: todo en la lista, completadas incluidas, sin el
// plegado de completadas, carpetas del Mac cerradas y la caja de añadir tarea.
import { describe, it, expect, beforeEach } from 'vitest'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { store } from '../store/nodeStore'
import { createContext } from '../utils/cajones'
import V2ContextView from '../v2/components/V2ContextView'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(ctxId: string): HTMLElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => { root.render(createElement(V2ContextView, { ctxId, onSelectCtx: () => {}, onOpenNode: () => {} })) })
  return host
}

describe('ficha de contexto: lista única de tareas, eventos y elementos', () => {
  beforeEach(() => {
    store.nodes.clear()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('pinta tareas (pendientes y completadas), eventos y documentos en la misma lista', () => {
    const ctx = createContext('Proyecto de prueba')
    const pend = store.createNode({ text: 'Tarea pendiente', parentId: ctx.id, isTask: true })
    const hecha = store.createNode({ text: 'Tarea completada', parentId: ctx.id, isTask: true })
    store.updateNode(hecha.id, { status: 'done' })
    const ev = store.createNode({ text: 'Reunión con hora', parentId: ctx.id, isTask: true })
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(11, 0, 0, 0)
    store.updateNode(ev.id, { isEvent: true, due: d.toISOString() })
    store.createNode({ text: 'Documento suelto', parentId: ctx.id, extraData: { _doc: '1' } })

    const host = render(ctx.id)
    const html = host.innerHTML
    for (const txt of ['Tarea pendiente', 'Tarea completada', 'Reunión con hora', 'Documento suelto']) {
      expect(html).toContain(txt)
    }
    // Las cuatro filas viven en el mismo bloque, cada una arrastrable.
    const rows = host.querySelectorAll('div[draggable="true"]')
    expect(rows.length).toBe(4)
    // Las tareas conservan su fila de tarea (con casilla); el evento va sin casilla.
    expect(host.querySelectorAll('.dc-row').length).toBe(3)
    expect(host.querySelectorAll('.dc-check').length).toBe(2)
    // Ya no hay plegado de «Completadas» y sigue habiendo UNA caja de añadir tarea.
    expect(host.querySelector('.v2-done-toggle')).toBeNull()
    expect(host.querySelectorAll('input.v2-quickadd').length).toBe(1)
    // El recuento del bloque incluye tareas y eventos.
    expect(html).toContain('(4)')
    void pend
  })

  it('por defecto ordena por creación, lo más reciente arriba, y «Carpetas del Mac» va plegado', () => {
    const ctx = createContext('Orden')
    const a = store.createNode({ text: 'Primero creado', parentId: ctx.id, isTask: true })
    const b = store.createNode({ text: 'Último creado', parentId: ctx.id, isTask: true })
    const na = store.getNode(a.id)!, nb = store.getNode(b.id)!
    na.createdAt = '2026-01-01T10:00:00.000Z'
    nb.createdAt = '2026-06-01T10:00:00.000Z'

    const host = render(ctx.id)
    const html = host.innerHTML
    expect(html.indexOf('Último creado')).toBeGreaterThan(-1)
    expect(html.indexOf('Último creado')).toBeLessThan(html.indexOf('Primero creado'))
    const folders = host.querySelector('[aria-expanded]')
    expect(folders?.getAttribute('aria-expanded')).toBe('false')
  })
})
