// Agregación por METADATO (lienzo infinito libre): la estructura no la da la
// posición en el plano ni la jerarquía, sino los metadatos de cada nodo.
//
// DÍA de un contenido (opción A acordada): fecha explícita (`due`) ∪ día en que
// se creó (`createdAt`). «Todo lo del día X» = nodos cuyo due==X o createdAt==X.
// CONTEXTO: incluye el contenido de los subcontextos (recursivo).
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { nodesInContext, isMarkedContext } from './cajones'

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** ¿Este nodo es «contenido» agregable? (excluye diarias, vacíos, papelera). */
function isAggregable(n: Node): boolean {
  if (n.deletedAt || n.isDiaryEntry) return false
  return !!(n.text && n.text.trim())
}

/** Todo el contenido de un día: due==date ∪ createdAt==date (opción A). */
export function nodesForDay(date: Date): Node[] {
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (!isAggregable(n)) continue
    const due = n.due ? new Date(n.due) : null
    const created = n.createdAt ? new Date(n.createdAt) : null
    if ((due && sameDay(due, date)) || (created && sameDay(created, date))) out.push(n)
  }
  out.sort((a, b) => (a.due || a.createdAt || '').localeCompare(b.due || b.createdAt || ''))
  return out
}

/** Días del mes (números 1..31) que tienen contenido — para pintar puntos en el mini-calendario. */
export function daysWithContent(year: number, month: number): Set<number> {
  const set = new Set<number>()
  for (const n of store.allActive()) {
    if (!isAggregable(n)) continue
    for (const iso of [n.due, n.createdAt]) {
      if (!iso) continue
      const d = new Date(iso)
      if (d.getFullYear() === year && d.getMonth() === month) set.add(d.getDate())
    }
  }
  return set
}

/** Contenido de un contexto INCLUYENDO sus subcontextos (recursivo, dedup). */
export function nodesForContextHierarchy(contextId: string): Node[] {
  const seen = new Set<string>()
  const out: Node[] = []
  const walk = (id: string) => {
    for (const n of nodesInContext(id)) {
      if (!seen.has(n.id)) { seen.add(n.id); out.push(n) }
    }
    for (const sub of store.children(id)) {
      if (!sub.deletedAt && isMarkedContext(sub)) walk(sub.id)
    }
  }
  walk(contextId)
  return out
}
