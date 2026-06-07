// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 de la virtualización del outliner.
//
// Aplana el árbol VISIBLE (lo que hoy renderiza la recursión de OutlinerNode) a
// una lista lineal `{ node, depth }`. Es la base para virtualizar: en vez de
// montar todo el árbol recursivamente, se renderiza solo la ventana visible de
// esta lista plana.
//
// PURA y testeable (sin React ni store real — solo necesita `children`). Replica
// FIELMENTE las reglas del render actual para que la lista plana coincida 1:1 con
// lo que se ve hoy:
//   · excluye nodos de sistema (extraData._system)
//   · excluye tareas atómicas con estado (viven en el panel derecho)
//   · un nodo expande sus hijos SOLO si isCollapsed === false (igual que
//     showChildren = !isCollapsed en OutlinerNode)
//   · un inline view block (extraData._inline === '1') NO expande hijos como
//     bullets (los muestra su tabla/kanban/calendario)
//   · excludeDiaryEntries solo aplica al primer nivel (como el Outliner raíz)
//
// Limitación conocida (v1): asume orden natural (children() ya ordena por
// siblingOrder/diaryDate). El sortMode efímero por-nivel (alpha/due/...) y el
// caso con filtro activo NO se cubren aquí — el filtrado usa su propio path
// (FilteredList) y la virtualización es para el árbol normal.
// ─────────────────────────────────────────────────────────────────────────────

import type { Node } from "../../types"

export interface FlatRow {
  node: Node
  depth: number
}

export interface FlattenOpts {
  /** Excluir entradas de diario del PRIMER nivel (como hace el Outliner raíz). */
  excludeDiaryEntries?: boolean
}

/** Store mínimo que necesita el aplanado: solo leer hijos ordenados. */
export interface ChildSource {
  children(parentId: string | null): Node[]
}

function isSystemNode(n: Node): boolean {
  try { return !!JSON.parse(n.extraData || "{}")._system } catch { return false }
}

function isInlineViewNode(n: Node): boolean {
  try { return JSON.parse(n.extraData || "{}")._inline === "1" } catch { return false }
}

/** Hijos VISIBLES de un nodo, con los mismos filtros que el render actual. */
export function visibleChildrenOf(
  store: ChildSource,
  parentId: string | null,
  opts: FlattenOpts,
  isRootLevel: boolean,
): Node[] {
  let list = store.children(parentId).filter((n) => !isSystemNode(n))
  if (isRootLevel && opts.excludeDiaryEntries) list = list.filter((n) => !n.isDiaryEntry)
  // bodyChildren: las tareas atómicas con estado viven en el panel derecho, no aquí.
  list = list.filter((c) => !(c.isAtomic && c.status !== null))
  return list
}

/** ¿El nodo expande sus hijos en el árbol? Espejo de `showChildren = !isCollapsed`. */
export function expandsChildren(node: Node, childCount: number): boolean {
  if (isInlineViewNode(node)) return false
  return node.isCollapsed === false && childCount > 0
}

/**
 * Aplana el árbol visible bajo `rootParentId` a una lista lineal en el MISMO orden
 * en que se ven los bullets de arriba a abajo. Guarda anti-ciclos por si el árbol
 * tuviera un padre corrupto (no debería, pero el coste es nulo).
 */
export function flattenVisibleTree(
  store: ChildSource,
  rootParentId: string | null,
  opts: FlattenOpts = {},
): FlatRow[] {
  const out: FlatRow[] = []
  const seen = new Set<string>()

  function walk(parentId: string | null, depth: number) {
    const kids = visibleChildrenOf(store, parentId, opts, depth === 0)
    for (const node of kids) {
      if (seen.has(node.id)) continue // anti-ciclo
      seen.add(node.id)
      out.push({ node, depth })
      const grandkids = visibleChildrenOf(store, node.id, opts, false)
      if (expandsChildren(node, grandkids.length)) {
        walk(node.id, depth + 1)
      }
    }
  }

  walk(rootParentId, 0)
  return out
}
