// @vitest-environment jsdom
// Ficha de un TIME BLOCK (30 sep 2026): arriba enseña cuándo es (día, tramo
// horario, repetición) y se edita con la misma ventana que tareas y eventos —
// sin dejar de ser un time block (ni `isEvent` ni `status`).
import { describe, it, expect, beforeEach } from 'vitest'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { store } from '../store/nodeStore'
import { isTimeBlockNode } from '../utils/taskNode'
import V2DetailView from '../v2/components/V2DetailView'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(nodeId: string): HTMLElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => { root.render(createElement(MemoryRouter, null, createElement(V2DetailView, { nodeId, onSelectCtx: () => {} }))) })
  return host
}

function makeTimeBlock(recurrence?: string) {
  const n = store.createNode({ text: 'Escritura', parentId: null })
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(9, 0, 0, 0)
  const end = new Date(start); end.setHours(11, 30, 0, 0)
  store.updateNode(n.id, { due: start.toISOString(), dueEnd: end.toISOString(), extraData: JSON.stringify({ _timeblock: '1' }), ...(recurrence ? { recurrence } : {}) })
  return store.getNode(n.id)!
}

describe('ficha de time block: cabecera editable como tarea/evento', () => {
  beforeEach(() => {
    store.nodes.clear()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('enseña el día, el tramo horario y la repetición, sin casilla', () => {
    const tb = makeTimeBlock('weekly')
    const host = render(tb.id)
    expect(host.querySelector('.v2-el-ctxchip')).not.toBeNull()
    // Inicio – fin (el formato de hora depende del idioma del entorno de test).
    expect(host.querySelector('.dc-time')?.textContent).toMatch(/^0?9:00.* – 11:30/)
    expect(host.querySelector('.dc-rec')).not.toBeNull()
    expect(host.querySelector('.dc-check')).toBeNull()
  })

  it('la cabecera abre la ventana de edición; cambiar la hora no lo convierte en evento ni en tarea', () => {
    const tb = makeTimeBlock()
    const host = render(tb.id)
    act(() => { (host.querySelector('.v2-el-ctxchip') as HTMLButtonElement).click() })
    const modal = document.querySelector('.task-props-popup')
    expect(modal).not.toBeNull()
    // Sin «Estado»: no hay chip de pendiente/hecha que lo volvería tarea.
    expect(modal!.textContent).not.toContain('○')

    const time = modal!.querySelector('input.nqp-time-input') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => { setter.call(time, '10:00'); time.dispatchEvent(new Event('input', { bubbles: true })) })

    const after = store.getNode(tb.id)!
    expect(new Date(after.due!).getHours()).toBe(10)
    // El fin se arrastra con la misma duración (2 h 30 min).
    expect(new Date(after.dueEnd!).getHours()).toBe(12)
    expect(new Date(after.dueEnd!).getMinutes()).toBe(30)
    expect(after.isEvent).toBeFalsy()
    expect(after.status ?? null).toBeNull()
    expect(isTimeBlockNode(after)).toBe(true)
  })
})
