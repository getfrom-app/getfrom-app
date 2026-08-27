// elementsBrowserStore — estado COMPARTIDO del buscador/filtro/orden de
// Elementos, para que la columna derecha (buscador+filtros) y el centro
// (resultados) sean dos componentes distintos leyendo del mismo sitio (28 ago
// 2026, Alberto: "dijimos que harías la columna derecha para filtros y
// buscador. hazlo"). Mismo patrón ligero que assistantStore.ts — un objeto
// mutable con subscribe/notify, sin Redux ni Context.
import { useLayoutEffect, useState } from 'react'
import type { ElemKind } from '../components/panels/ElementsPanel'

export type ElementsSortBy = 'updated' | 'created' | 'title' | 'kind'
export type ElementsTaskSub = 'all' | 'today' | 'open' | 'done' | 'future' | 'nodate'

type Listener = () => void

const SORT_KEY = 'from_v2_elements_sort'

class ElementsBrowserStore {
  q = ''
  filter: ElemKind | 'all' | 'favorite' = 'all'
  taskSub: ElementsTaskSub = 'all'
  sortBy: ElementsSortBy = (localStorage.getItem(SORT_KEY) as ElementsSortBy) || 'created'
  private listeners: Set<Listener> = new Set()

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }
  private notify() { this.listeners.forEach(l => l()) }

  setQ(v: string) { this.q = v; this.notify() }
  setFilter(v: ElemKind | 'all' | 'favorite') {
    this.filter = v
    if (v !== 'task') this.taskSub = 'all'
    this.notify()
  }
  setTaskSub(v: ElementsTaskSub) { this.taskSub = v; this.notify() }
  setSortBy(v: ElementsSortBy) {
    this.sortBy = v
    localStorage.setItem(SORT_KEY, v)
    this.notify()
  }
  /** Reinicia búsqueda+filtro (botón «Limpiar»). */
  clear() { this.q = ''; this.filter = 'all'; this.taskSub = 'all'; this.notify() }
}

export const elementsBrowserStore = new ElementsBrowserStore()

export function useElementsBrowserStore(): ElementsBrowserStore {
  const [, forceUpdate] = useState(0)
  useLayoutEffect(() => {
    const unsub = elementsBrowserStore.subscribe(() => forceUpdate(n => n + 1))
    return unsub
  }, [])
  return elementsBrowserStore
}
