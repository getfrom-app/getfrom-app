// Índice de elementos de un contexto (+ subcontextos) para el chat — 26 ago
// 2026, Alberto: "al hablarle al chat de un contexto debe tener en cuenta
// todos los elementos de ese contexto... y si el contexto tiene subcontextos
// tendrá en cuenta todos los elementos de los subcontextos también".
//
// Antes el chat de un contexto solo recibía la "Memoria" curada (resumen
// escrito por el propio modelo, `readContextKnowledge`) más los hijos
// DIRECTOS del nodo abierto en ese momento (aiChatStore.ts::currentNoteContent)
// — si estabas hablando en la nota libre del contexto, sus hermanos (otros
// documentos, PDFs, tareas colgando directamente del contexto) eran
// invisibles para el modelo salvo que adivinara buscarlos con find_nodes.
//
// Esto NO manda el contenido completo de cada elemento (saturaría el system
// prompt en cuanto un contexto tenga más de unos pocos elementos) — manda un
// ÍNDICE compacto (id + título + tipo) para que el modelo SEPA que existen y
// use `read_node`/`find_nodes` (ya soportados, ver server/src/routes/ai.ts)
// para leer el contenido real bajo demanda, cuando de verdad haga falta.
import { store } from '../store/nodeStore'
import { nodesInContext } from './cajones'
import { isInPapelera, parseExtraData } from './papeleraHelper'
import { isContextMemoryNode } from './knowledgeNodes'
import { isAgentNode } from './agentesHelper'
import { isPromptNode } from './promptsHelper'
import { isGroupNode } from './groups'
import { isTaskNode } from './taskNode'
import { classifyElement } from '../v2/elementKind'
import { contextAndDescendantIds } from '../v2/conversations'
import type { Node } from '../types'

export interface ContextElementEntry { id: string; title: string; kind: string }

/** Todos los elementos (documentos, PDFs, imágenes, enlaces, tareas, eventos,
 *  agentes, prompts…) de un contexto Y de todos sus subcontextos, recursivo —
 *  MISMOS criterios de exclusión que la columna derecha (V2ContextView.tsx):
 *  sin conversaciones, sin grupos (tienen su propia sección), sin la Memoria
 *  interna. Limitado a `limit` (por defecto 80) para no disparar el tamaño
 *  del system prompt en un contexto con cientos de elementos — se priorizan
 *  los más recientes. */
export function listContextElementsDeep(ctxId: string, limit = 80): ContextElementEntry[] {
  const ctxIds = contextAndDescendantIds(ctxId)
  const seen = new Set<string>()
  const out: (ContextElementEntry & { ts: string })[] = []

  const consider = (n: Node) => {
    if (seen.has(n.id) || n.deletedAt || isInPapelera(n.id)) return
    if (isContextMemoryNode(n)) return
    if (isGroupNode(n)) return
    const ed = parseExtraData(n.extraData)
    if (ed._aiSession === '1') return // conversación — vive en su propia tab Chat

    let kind: string | null = null
    if (isAgentNode(n)) kind = 'agente'
    else if (isPromptNode(n)) kind = 'prompt'
    else if (isTaskNode(n)) kind = n.isEvent ? 'evento' : 'tarea'
    else {
      const c = classifyElement(n)
      if (!c || c.kind === 'note') return // nota de texto plana: ya cubierta por children() del propio nodo
      kind = c.label || c.kind
    }
    seen.add(n.id)
    out.push({ id: n.id, title: n.text || 'Sin título', kind, ts: n.updatedAt || n.createdAt || '' })
  }

  for (const id of ctxIds) {
    for (const n of store.children(id)) consider(n)
    for (const n of nodesInContext(id)) consider(n)
  }

  out.sort((a, b) => b.ts.localeCompare(a.ts))
  return out.slice(0, limit).map(({ id, title, kind }) => ({ id, title, kind }))
}
