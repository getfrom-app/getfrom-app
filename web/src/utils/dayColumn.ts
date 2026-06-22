// dayColumn — qué nodos viven en la COLUMNA DERECHA de una nota diaria, para que
// no se dupliquen en el lienzo (pizarra) ni en el centro (lista).
//
// Columna derecha = eventos GCal + tareas/bucles del cockpit (atrasadas/hoy/bucles)
// + capturas (bandeja). El lienzo/centro muestra el RESTO de hijos del día.

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { collectDailyCockpit, collectDayTasks } from './dailyCockpit'
import { getGcalEventId } from './gcalNodesSync'
import { parseExtraData } from './papeleraHelper'
import { isProtectedSystemRoot } from './rootLookup'

export function isCaptureNode(n: Node): boolean {
  return parseExtraData(n.extraData)._capture === '1'
}
export function nodeHasPin(n: Node): boolean {
  const e = parseExtraData(n.extraData)
  return e._pinX != null || e._pinY != null
}
export function isMovedNode(n: Node): boolean {
  return parseExtraData(n.extraData)._moved === '1'
}
// Área = vista guardada del lienzo (posición+zoom). Vive en la columna derecha
// bajo «Áreas»; al pulsarla, la cámara vuela a esa vista.
export function isAreaNode(n: Node): boolean {
  return parseExtraData(n.extraData)._area === '1'
}

/** Marca un nodo como MOVIDO a una nota (aparece en su bloque «Movidos»). Solo se
 *  marca al mover a una NOTA normal (no diaria, no raíz de sistema). */
export function markMovedIntoNote(nodeId: string, targetId: string): void {
  const target = store.getNode(targetId)
  if (!target || target.isDiaryEntry || isProtectedSystemRoot(targetId)) return
  const n = store.getNode(nodeId); if (!n) return
  const ed = parseExtraData(n.extraData)
  ed._moved = '1'
  store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
}

export interface DayColumnData {
  eventNodes: Node[]
  captureNodes: Node[]
  /** ¿Es la diaria de HOY? (HOY usa el cockpit; otros días, lista de tareas del día) */
  isToday: boolean
  /** Tareas con due en ESTE día (solo para días que no son hoy). */
  dayTasks: Node[]
  /** Vistas guardadas del lienzo (bloque «Áreas»). */
  areaNodes: Node[]
  /** IDs de tareas/bucles que el cockpit/lista ya muestra. */
  cockpitIds: Set<string>
  /** IDs que viven SOLO en la columna derecha → excluir del lienzo y del centro. */
  rightColumnIds: Set<string>
}

export function getDayColumnData(dayNode: Node): DayColumnData {
  const children = store.children(dayNode.id)
  const isToday = store.todayDiary()?.id === dayNode.id

  // Eventos = nodos-evento (locales o sincronizados con GCal) cuya FECHA cae en
  // este día. Van a la sección EVENTOS de la columna, NUNCA al lienzo. El filtro
  // por fecha evita que un evento creado bajo el diario de hoy pero programado
  // otro día (p.ej. por captura) aparezca en «Eventos de hoy».
  const dayDate = isToday ? new Date() : (dayNode.diaryDate ? new Date(dayNode.diaryDate) : null)
  const sameDay = (iso?: string | null): boolean => {
    if (!iso || !dayDate) return false
    const d = new Date(iso)
    return d.getFullYear() === dayDate.getFullYear() && d.getMonth() === dayDate.getMonth() && d.getDate() === dayDate.getDate()
  }
  const eventNodes = children
    .filter(c => !c.deletedAt && (c.isEvent || getGcalEventId(c)) && sameDay(c.due))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))

  // HOY → cockpit (atrasadas/hoy/bucles). Otros días → tareas con due ese día.
  const cockpitIds = new Set<string>()
  let dayTasks: Node[] = []
  if (isToday) {
    const d = collectDailyCockpit()
    for (const n of [...d.focus, ...d.overdue, ...d.today, ...d.seguimiento]) cockpitIds.add(n.id)
  } else if (dayNode.diaryDate) {
    dayTasks = collectDayTasks(new Date(dayNode.diaryDate))
    for (const t of dayTasks) cockpitIds.add(t.id)
  }

  // Capturas = bandeja de NOTAS sueltas: marcadas `_capture`, sin colocar, sin
  // estado (una tarea/bucle vive en el cockpit, no aquí — al completarse no debe
  // reaparecer en capturas) y NO eventos ni ya mostradas en el cockpit.
  const captureNodes = children.filter(c =>
    isCaptureNode(c) && c.status == null && !c.isEvent && !nodeHasPin(c) && !getGcalEventId(c) && !cockpitIds.has(c.id)
  )

  // Áreas = vistas guardadas del lienzo (marcador `_area`).
  const areaNodes = children.filter(isAreaNode)

  const rightColumnIds = new Set<string>()
  for (const c of eventNodes) rightColumnIds.add(c.id)
  for (const c of captureNodes) rightColumnIds.add(c.id)
  for (const c of areaNodes) rightColumnIds.add(c.id)
  for (const id of cockpitIds) rightColumnIds.add(id)

  return { eventNodes, captureNodes, isToday, dayTasks, areaNodes, cockpitIds, rightColumnIds }
}
