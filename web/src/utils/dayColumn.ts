// dayColumn — qué nodos viven en la COLUMNA DERECHA de una nota diaria, para que
// no se dupliquen en el lienzo (pizarra) ni en el centro (lista).
//
// Columna derecha = eventos GCal + tareas/bucles del cockpit (atrasadas/hoy/bucles)
// + capturas (bandeja). El lienzo/centro muestra el RESTO de hijos del día.

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { collectDailyCockpit } from './dailyCockpit'
import { getGcalEventId } from './gcalNodesSync'

export function isCaptureNode(n: Node): boolean {
  try { return JSON.parse(n.extraData || '{}')._capture === '1' } catch { return false }
}
export function nodeHasPin(n: Node): boolean {
  try { const e = JSON.parse(n.extraData || '{}'); return e._pinX != null || e._pinY != null } catch { return false }
}

export interface DayColumnData {
  eventNodes: Node[]
  captureNodes: Node[]
  /** IDs de tareas/bucles que el cockpit ya muestra (solo en la diaria de HOY). */
  cockpitIds: Set<string>
  /** IDs que viven SOLO en la columna derecha → excluir del lienzo y del centro. */
  rightColumnIds: Set<string>
}

export function getDayColumnData(dayNode: Node): DayColumnData {
  const children = store.children(dayNode.id)

  const eventNodes = children
    .filter(c => getGcalEventId(c))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))

  // El cockpit (atrasadas/hoy/bucles) solo aplica a la diaria de HOY.
  const cockpitIds = new Set<string>()
  if (store.todayDiary()?.id === dayNode.id) {
    const d = collectDailyCockpit()
    for (const n of [...d.focus, ...d.overdue, ...d.today, ...d.bucles]) cockpitIds.add(n.id)
  }

  // Capturas = bandeja: marcadas `_capture`, sin colocar, NO eventos y NO ya
  // mostradas como tarea en el cockpit (evita duplicado captura↔tarea).
  const captureNodes = children.filter(c =>
    isCaptureNode(c) && !nodeHasPin(c) && !getGcalEventId(c) && !cockpitIds.has(c.id)
  )

  const rightColumnIds = new Set<string>()
  for (const c of eventNodes) rightColumnIds.add(c.id)
  for (const c of captureNodes) rightColumnIds.add(c.id)
  for (const id of cockpitIds) rightColumnIds.add(id)

  return { eventNodes, captureNodes, cockpitIds, rightColumnIds }
}
