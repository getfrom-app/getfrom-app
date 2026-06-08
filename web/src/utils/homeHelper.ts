/**
 * homeHelper — Raíz 🏠 From por encima de Agenda.
 *
 * Hasta ahora el home (ruta /) mostraba los hijos de 📅 Agenda directamente y el
 * resto de raíces de sistema (Contexto/Prompts/Agentes/Plantillas) vivían sueltas en
 * parentId=null, escondidas en menús. Ahora existe una raíz REAL 🏠 From (invisible,
 * como lo era Agenda) cuyos hijos son esas 5 raíces → el árbol principal las muestra
 * como hermanas y cada una se edita ahí mismo.
 *
 * Enfoque: raíz determinista + reparent (NO una prop rootIds en el Outliner) → el
 * Outliner, la virtualización y el drag quedan intactos (siguen single-parent con
 * parentId = homeRootId).
 *
 * Papelera y 📊 Paneles NO se reparentan: permanecen en parentId=null → fuera del
 * árbol home (invisibles) sin borrar datos.
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { structuralId } from './deterministicId'
import { findRootByKey, findContextRoot } from './rootLookup'
import { getOrCreateAgendaRoot } from './agendaHelper'
import { getOrCreateTagsRoot } from './tagsHelper'
import { getOrCreatePromptsRoot, getPromptsRoot } from './promptsHelper'
import { getAgentesNode } from './agentesHelper'

export const HOME_ROOT_NAME = '🏠 From'

/** Raíz 🏠 From si existe (no la crea). Para usar en render. */
export function findHomeRoot(): Node | undefined {
  return findRootByKey('home', HOME_ROOT_NAME)
}

/** Raíz 🏠 From (robusta al id determinista). La crea si no existe. */
export function getOrCreateHomeRoot(): Node {
  const existing = findRootByKey('home', HOME_ROOT_NAME)
  if (existing) return existing
  const created = store.createNode({
    text: HOME_ROOT_NAME,
    parentId: null,
    siblingOrder: 0,            // primera entre las raíces residuales (Papelera/Paneles van al final)
    predefinedId: structuralId('home') ?? undefined,
  })
  return store.getNode(created.id)!
}

function findPlantillasRoot(): Node | undefined {
  return findRootByKey('plantillas', '📋 Plantillas', 'Plantillas')
}

/**
 * ensureHomeRootAndReparent — idempotente. Crea 🏠 From y reparenta bajo ella las 5
 * raíces visibles, con orden fijo (Agenda primera). NO toca Papelera ni Paneles.
 *
 * Idempotencia: el guard `parentId !== home.id` evita emitir ops repetidas en cada
 * arranque. Como ids son deterministas, web/Mac/iOS convergen al mismo home.id y al
 * mismo destino → el op-log fusiona, nunca duplica.
 *
 * Debe llamarse DESPUÉS de los ensure*() de cada raíz (deben existir para reparentar)
 * y ANTES del sync(true) que persiste los moves.
 */
export function ensureHomeRootAndReparent(): void {
  const home = getOrCreateHomeRoot()

  // Agenda/Contexto/Prompts se CREAN si faltan (deben existir siempre como raíces
  // visibles, aunque la cuenta no los haya generado todavía). Agentes y Plantillas
  // ya los crea el init (ensureAgentesNode/ensurePlantillasNode) antes de esto.
  const ordered: Array<[Node | undefined, number]> = [
    [getOrCreateAgendaRoot(),  1],
    [getOrCreateTagsRoot(),    2],
    [getOrCreatePromptsRoot(), 3],
    [getAgentesNode(),         4],
    [findPlantillasRoot(),     5],
  ]

  for (const [node, order] of ordered) {
    if (!node) continue
    if (node.id === home.id) continue            // sanity: no auto-parent
    if (node.parentId !== home.id) {
      store.updateNode(node.id, { parentId: home.id, siblingOrder: order })
    }
  }
}

/**
 * classifyNodeRoot — dado un nodo, sube por parentId hasta encontrar una de las raíces
 * de configuración (Agentes/Prompts/Contexto) y devuelve su tipo, para que la columna
 * derecha muestre las propiedades correspondientes. Agenda/Plantillas/otros → null
 * (la derecha se queda en el filtro).
 */
export function classifyNodeRoot(nodeId: string | null | undefined): 'agent' | 'prompt' | 'context' | 'template' | null {
  if (!nodeId) return null
  const agentesId = getAgentesNode()?.id
  const promptsId = getPromptsRoot()?.id
  const contextId = findContextRoot()?.id
  const plantillasId = findPlantillasRoot()?.id
  if (!agentesId && !promptsId && !contextId && !plantillasId) return null

  // La raíz misma no abre propiedades: muestra su lista (sus hijos) en el centro.
  // Solo los DESCENDIENTES (un agente/prompt/contexto/plantilla concreto) abren su panel.
  if (nodeId === agentesId || nodeId === promptsId || nodeId === contextId || nodeId === plantillasId) return null

  let cur = store.getNode(nodeId)
  const visited = new Set<string>()
  let depth = 0
  while (cur && !visited.has(cur.id) && depth < 50) {
    visited.add(cur.id)
    if (cur.id === agentesId) return 'agent'
    if (cur.id === promptsId) return 'prompt'
    if (cur.id === contextId) return 'context'
    if (cur.id === plantillasId) return 'template'
    if (!cur.parentId) break
    cur = store.getNode(cur.parentId)
    depth++
  }
  return null
}
