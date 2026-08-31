/**
 * unclassified — fuente única de verdad para la Bandeja de revisión (P4 ·
 * Ordenar de la auditoría "Fromly a fondo": "todo lo capturado sin contexto,
 * o clasificado por la IA con baja confianza, cae en una bandeja visible").
 *
 * Regla (acordada): un nodo está "por revisar" SOLO si:
 *   · está dentro de 📅 Agenda (no en Contexto, Prompts, Agentes, Atajos, Plantillas, Papelera)
 *   · no es estructura temporal (año/mes/semana) ni entrada de diario
 *   · es contenido real (tarea o contenedor con hijos) con texto ≥ 4
 *   · NO tiene contexto REALMENTE aplicado: ni manual (types/@/_contextManuallySet/
 *     _ctxRefs) ni por IA con confianza suficiente (_autoContextId +
 *     _autoContextConfidence >= CONFIDENCE_THRESHOLD).
 *
 * `_autoContextId` con confianza POR DEBAJO del umbral es justo el caso que la
 * auditoría pedía dejar de tirar en silencio (OutlinerNode.tsx lo guarda pero
 * nunca llama a `assignContext`): antes `hasAnyContext` lo trataba igual que un
 * contexto real por el mero hecho de existir el campo, así que el nodo
 * desaparecía de "sin clasificar" sin tener contexto de verdad en ningún sitio.
 * `getSuggestedContext` expone esa sugerencia descartada para la bandeja.
 */
import { store } from '../store/nodeStore'
import { findAgendaRoot } from './agendaHelper'
import { firstContextOf } from './cajones'
import { CONFIDENCE_THRESHOLD } from '../api/autoClassify'
import type { Node } from '../types'

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

/** ¿Tiene el nodo un contexto REALMENTE aplicado (manual, _ctxRefs, heredado por
 *  posición en el árbol, o IA con confianza suficiente)? Mismo criterio que
 *  `firstContextOf` (el que pinta el chip `#contexto` en cada fila) — antes esta
 *  función solo miraba `_ctxRefs` propios, así que un elemento escrito dentro de
 *  la nota de un contexto (herencia por posición) enseñaba su chip en pantalla y
 *  A LA VEZ caía en "por revisar", vaciando de sentido la bandeja (Alberto, 31
 *  ago 2026: "veo que algunos elementos ya tienen contexto"). */
function hasAnyContext(node: Node): boolean {
  const userTypes = (node.types || []).filter(t => !BUILTIN_TAGS.has(t))
  if (userTypes.length > 0) return true
  if (/@\w/.test(node.text || '')) return true
  if (firstContextOf(node)) return true
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._contextManuallySet === '1') return true
    if (typeof ed._autoContextId === 'string' && ed._autoContextId
      && typeof ed._autoContextConfidence === 'number' && ed._autoContextConfidence >= CONFIDENCE_THRESHOLD) return true
    if (ed.temporalType) return true   // estructura temporal — no es contenido
  } catch { /* ignore */ }
  return false
}

/** Sugerencia de la IA descartada por baja confianza (guardada pero no aplicada) — la
 *  bandeja la muestra para confirmar en un tap en vez de partir de cero. */
export function getSuggestedContext(node: { extraData?: string | null }): { contextId: string; confidence: number } | null {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (typeof ed._autoContextId === 'string' && ed._autoContextId
      && typeof ed._autoContextConfidence === 'number' && ed._autoContextConfidence < CONFIDENCE_THRESHOLD) {
      return { contextId: ed._autoContextId, confidence: ed._autoContextConfidence }
    }
  } catch { /* ignore */ }
  return null
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
