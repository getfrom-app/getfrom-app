// elementsBrowserStore — estado COMPARTIDO del buscador/filtro/orden de
// Elementos, para que la columna derecha (buscador+filtros) y el centro
// (resultados) sean dos componentes distintos leyendo del mismo sitio (28 ago
// 2026, Alberto: "dijimos que harías la columna derecha para filtros y
// buscador. hazlo"). Mismo patrón ligero que assistantStore.ts — un objeto
// mutable con subscribe/notify, sin Redux ni Context.
import { useLayoutEffect, useState } from 'react'
import type { ElemKind } from '../components/panels/ElementsPanel'
import type { FilterView } from '../components/views/FilterResultsView'

export type ElementsSortBy = 'updated' | 'created' | 'title' | 'kind'
export type ElementsTaskSub = 'all' | 'today' | 'open' | 'done' | 'future' | 'nodate'

type Listener = () => void

const SORT_KEY = 'from_v2_elements_sort'
const VIEW_KEY = 'from_v2_elements_view'

class ElementsBrowserStore {
  q = ''
  filter: ElemKind | 'all' | 'favorite' = 'all'
  /** Tipo CUSTOM activo (id del nodo-tipo bajo 🏷️ Tipos), si el usuario filtró por
   *  uno de sus tipos en vez de por un ElemKind fijo. Mutuamente excluyente con
   *  `filter` — fijar uno limpia el otro (ver setFilter/setCustomType). */
  customTypeId: string | null = null
  taskSub: ElementsTaskSub = 'all'
  sortBy: ElementsSortBy = (localStorage.getItem(SORT_KEY) as ElementsSortBy) || 'created'
  view: FilterView = (localStorage.getItem(VIEW_KEY) as FilterView) || 'tabla'
  // Puente hacia el modo selección múltiple, cuyo estado real vive en
  // ElementsPanel (useGroupSelection, atado a `open()`) — el centro lo publica
  // aquí para que el toggle/contador vivan en la columna derecha (28 ago 2026,
  // Alberto: "el boton de seleccionar... podrian estar en la columna derecha
  // tambien"), sin duplicar la lógica de selección en dos sitios.
  selectMode = false
  selectedCount = 0
  onToggleSelectMode: (() => void) | null = null
  private listeners: Set<Listener> = new Set()

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }
  private notify() { this.listeners.forEach(l => l()) }

  setQ(v: string) { this.q = v; this.notify() }
  setFilter(v: ElemKind | 'all' | 'favorite') {
    this.filter = v
    this.customTypeId = null
    if (v !== 'task') this.taskSub = 'all'
    this.notify()
  }
  setCustomType(id: string | null) {
    this.customTypeId = id
    if (id) { this.filter = 'all'; this.taskSub = 'all' }
    this.notify()
  }
  setTaskSub(v: ElementsTaskSub) { this.taskSub = v; this.notify() }
  setSortBy(v: ElementsSortBy) {
    this.sortBy = v
    localStorage.setItem(SORT_KEY, v)
    this.notify()
  }
  setView(v: FilterView) {
    this.view = v
    localStorage.setItem(VIEW_KEY, v)
    this.notify()
  }
  setSelectModeState(active: boolean, count: number) {
    this.selectMode = active
    this.selectedCount = count
    this.notify()
  }
  registerToggleSelectMode(fn: (() => void) | null) {
    this.onToggleSelectMode = fn
    this.notify()
  }
  /** Reinicia búsqueda+filtro (botón «Limpiar»). */
  clear() { this.q = ''; this.filter = 'all'; this.customTypeId = null; this.taskSub = 'all'; this.notify() }
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
