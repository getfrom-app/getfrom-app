/**
 * rootLookup — localización ROBUSTA de las raíces de sistema.
 *
 * Antes las raíces se buscaban con `store.children(null).find(text===…)`, lo que
 * asume que viven en parentId=null. Con la raíz 🏠 From por encima de Agenda, las
 * 5 raíces (Agenda/Contexto/Prompts/Agentes/Plantillas) se reparentan bajo ella →
 * ese patrón dejaría de encontrarlas.
 *
 * findRootByKey busca:
 *   1) por id determinista (`structuralId(key)`) — independiente del parentId;
 *   2) fallback: por texto en TODO el árbol activo (cubre nodos legacy con id
 *      aleatorio, o cuando aún no hay token/userId para calcular el id).
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { structuralId } from './deterministicId'

export function findRootByKey(key: string, ...names: string[]): Node | undefined {
  const id = structuralId(key)
  if (id) {
    const n = store.getNode(id)
    if (n && !n.deletedAt) return n
  }
  return store.allActive().find(n => names.includes((n.text || '').trim()))
}

/** Raíz 🧠 Contexto (acepta el nombre antiguo 🏷 Tags). Robusta al reparent. */
export function findContextRoot(): Node | undefined {
  return findRootByKey('contexto', '🧠 Contexto', '🏷 Tags')
}

/**
 * isProtectedSystemRoot — true si el nodo es una raíz de sistema CANÓNICA que NO debe
 * poder eliminarse (Home/Agenda/Contexto/Prompts/Agentes/Plantillas/Paneles/Papelera/Perfil).
 * Se identifica por id determinista (robusto al reparent) + el flag de Perfil IA.
 * NO por texto: así los DUPLICADOS (id aleatorio) sí se pueden limpiar.
 */
export function isProtectedSystemRoot(nodeId: string): boolean {
  for (const key of ['home','agenda','contexto','prompts','agentes','plantillas','paneles','papelera','perfil']) {
    if (structuralId(key) === nodeId) return true
  }
  const n = store.getNode(nodeId)
  if (!n) return false
  try { if (JSON.parse(n.extraData || '{}')._perfilIA === '1') return true } catch { /* ignore */ }
  return false
}
