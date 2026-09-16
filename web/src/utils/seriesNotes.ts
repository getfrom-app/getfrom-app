// Notas COMUNES de una serie recurrente (evento, time block o tarea que se repite).
//
// Alberto (16 sep 2026): "en eventos recurrentes o timeblocks recurrentes, al
// abrir la nota cada instancia es independiente. Debería ser mixta: un espacio
// común (un enlace, notas) y luego un espacio independiente para cada
// instancia". Cada instancia sigue teniendo su propio hijo `_containerNotes`
// (cajones.ts); la serie tiene ADEMÁS un nodo de notas común:
//
//  · `extraData._seriesKey` identifica la serie. Viaja solo a cada instancia
//    nueva porque los tres creadores de instancias copian el extraData entero
//    (web `spawnRecurrence`/`materializeOccurrence`, iOS `spawnRecurrence`,
//    servidor `nodeActions`/`assistant.ts`). Las instancias anteriores a esto
//    no la tienen: se resuelve por la cabeza viva de la serie
//    (`findSeriesHead`) y se estampa al abrir.
//  · El nodo común tiene id determinista (`seriesNotesId(key)`), sin padre, y
//    lleva `_containerNotes` para heredar todos los filtros que ya lo sacan de
//    Elementos, menciones, captura y escrituras del chat — no es un elemento.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { belongsToSeries, findSeriesHead, parseExtra } from './recurrenceProjection'
import { seriesNotesId } from './deterministicId'

export function seriesKeyOf(n: Pick<Node, 'extraData'>): string | null {
  const v = parseExtra(n)._seriesKey
  return typeof v === 'string' && v ? v : null
}

/** ¿Tiene sentido un espacio de notas común? Cualquier miembro de una serie,
 *  también una instancia ya completada (conserva `recurrence`). */
export function isSeriesMember(n: Node): boolean {
  return belongsToSeries(n) || !!seriesKeyOf(n) || parseExtra(n)._recurrence != null
}

function stampKey(n: Node, key: string): void {
  if (seriesKeyOf(n) === key) return
  store.updateNode(n.id, { extraData: JSON.stringify({ ...parseExtra(n), _seriesKey: key }) })
}

/** Lectura síncrona, sin crear nada — null si aún no existe. */
export function seriesNotesNode(n: Node): Node | null {
  const key = seriesKeyOf(n) ?? (() => { const h = findSeriesHead(n); return h ? seriesKeyOf(h) : null })()
  if (!key) return null
  const existing = store.getNode(seriesNotesId(key))
  return existing && !existing.deletedAt ? existing : null
}

/** Crea (si falta) el nodo común y deja la clave en la instancia y en la cabeza
 *  viva de la serie, para que las instancias futuras la hereden. Llamar fuera
 *  del render (efecto), igual que `getOrCreateContainerNotes`. */
export function getOrCreateSeriesNotes(n: Node): Node {
  const head = findSeriesHead(n)
  const key = seriesKeyOf(n) ?? (head ? seriesKeyOf(head) : null) ?? (head ?? n).id
  stampKey(n, key)
  if (head && head.id !== n.id) stampKey(head, key)
  return store.createNode({
    predefinedId: seriesNotesId(key),
    text: (head ?? n).text || 'Notas',
    parentId: null,
    extraData: { _containerNotes: '1', _seriesNotes: '1', _doc: '1', _ctext: '1' },
  })
}
