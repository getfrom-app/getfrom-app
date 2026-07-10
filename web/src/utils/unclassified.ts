/**
 * unclassified — fuente única de verdad para "Sin clasificar".
 *
 * Regla (acordada): un nodo está "sin clasificar" SOLO si:
 *   · está dentro de 📅 Agenda (no en Contexto, Prompts, Agentes, Atajos, Plantillas, Papelera)
 *   · no es estructura temporal (año/mes/semana) ni entrada de diario
 *   · es contenido real (tarea o contenedor con hijos) con texto ≥ 4
 *   · NO tiene contexto de ningún tipo: ni manual (types/@/_contextManuallySet)
 *     ni asignado por la IA (_autoContextId). Si muestra un chip de contexto,
 *     no es "sin clasificar".
 *
 * Usado por UnclassifiedList (la lista) y ContextListPanel (el contador) para
 * que siempre coincidan.
 */
import { store } from '../store/nodeStore'
import { findAgendaRoot } from './agendaHelper'

/** Tags de sistema — no cuentan como contexto de usuario. */
const BUILTIN_TAGS = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','nota'])

/** IDs de todos los descendientes de 📅 Agenda (sin incluir la raíz). */
export function getAgendaDescendantIds(): Set<string> {
  const ids = new Set<string>()
  const root = findAgendaRoot()
  if (!root) return ids
  const queue: string[] = [root.id]
  while (queue.length > 0) {
    const pid = queue.pop()!
    for (const child of store.children(pid)) {
      if (child.deletedAt || ids.has(child.id)) continue
      ids.add(child.id)
      queue.push(child.id)
    }
  }
  return ids
}

/** ¿Tiene el nodo algún contexto asignado (manual o por IA)? */
function hasAnyContext(node: { types?: string[] | null; text?: string | null; extraData?: string | null }): boolean {
  const userTypes = (node.types || []).filter(t => !BUILTIN_TAGS.has(t))
  if (userTypes.length > 0) return true
  if (/@\w/.test(node.text || '')) return true
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._contextManuallySet === '1') return true
    if (typeof ed._autoContextId === 'string' && ed._autoContextId) return true
    if (ed.temporalType) return true   // estructura temporal — no es contenido
  } catch { /* ignore */ }
  return false
}

/** Conjunto de IDs sin clasificar (dentro de Agenda). */
export function getUnclassifiedIds(): Set<string> {
  const agendaIds = getAgendaDescendantIds()
  const out = new Set<string>()
  for (const id of agendaIds) {
    const n = store.getNode(id)
    if (!n || n.deletedAt || n.isDiaryEntry) continue
    if ((n.text || '').trim().length < 4) continue
    // estructura temporal (año/mes/semana) — descartar
    try { if (JSON.parse(n.extraData || '{}').temporalType) continue } catch { /* */ }
    // solo contenido: tareas o contenedores con hijos
    const hasChildren = store.children(n.id).some(c => !c.deletedAt)
    const isTask = n.status !== null && n.status !== undefined
    if (!hasChildren && !isTask) continue
    if (hasAnyContext(n)) continue
    out.add(n.id)
  }
  return out
}
