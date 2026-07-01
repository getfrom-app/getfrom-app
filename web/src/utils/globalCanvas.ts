// Lienzo infinito GLOBAL (Fase 1).
//
// Modelo: cualquier nodo puede tener una posición en un ÚNICO plano compartido,
// guardada en extraData como `_gx`/`_gy` (+ `_gscale`). Es ORTOGONAL a la
// jerarquía (padre/hijo) y al contexto (`_ctxRefs`): un nodo puede tener padre,
// contexto y además una posición global, o ninguna de las tres.
//
// Un nodo SIN `_gx/_gy` = «sin colocar»: vive en la lista y en la columna
// derecha como siempre, no aparece en el plano. Colocar/quitar es reversible.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { parseExtraData } from './papeleraHelper'

export const GX = '_gx'
export const GY = '_gy'
export const GSCALE = '_gscale'

export interface GPos { x: number; y: number; scale: number }

/** Lee la posición global de un nodo, o null si no está colocado. */
export function readGlobal(node: Node | null | undefined): GPos | null {
  if (!node) return null
  const ed = parseExtraData(node.extraData)
  const gx = ed[GX], gy = ed[GY]
  if (gx == null || gy == null) return null
  const x = Number(gx), y = Number(gy)
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  const s = Number(ed[GSCALE])
  return { x, y, scale: Number.isFinite(s) && s > 0 ? s : 1 }
}

/** Escribe/actualiza la posición global (parchea extraData, no lo sobrescribe). */
export function writeGlobal(nodeId: string, pos: { x: number; y: number }, scale?: number): void {
  const node = store.getNode(nodeId)
  if (!node) return
  const ed = parseExtraData(node.extraData)
  ed[GX] = String(Math.round(pos.x))
  ed[GY] = String(Math.round(pos.y))
  if (scale != null) ed[GSCALE] = String(Number(scale.toFixed(3)))
  else if (ed[GSCALE] == null) ed[GSCALE] = '1'
  store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
}

/** Quita el nodo del plano (vuelve a «sin colocar»); no borra el nodo. */
export function clearGlobal(nodeId: string): void {
  const node = store.getNode(nodeId)
  if (!node) return
  const ed = parseExtraData(node.extraData)
  delete ed[GX]; delete ed[GY]; delete ed[GSCALE]
  store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
}

/** Todos los nodos colocados en el plano global. */
export function placedNodes(): Node[] {
  return store.allActive().filter(n => readGlobal(n) !== null)
}
