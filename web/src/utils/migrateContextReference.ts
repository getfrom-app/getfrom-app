// migrateContextReference — migración ÚNICA y NO DESTRUCTIVA.
//
// Mueve la INFO DE REFERENCIA de cada contexto (secciones descriptivas: Co-fundadores,
// Marcas, Documentos, Tipo de trabajo, Principios, Herramientas, Contexto reciente…)
// DENTRO del nodo «🧠 Lo que Fromly sabe» de ese contexto. No borra nada: solo cambia
// el padre (reparent), así que es 100% reversible.
//
// PROTEGE (NO mueve): tareas, eventos, recursos, diarias, subcontextos (`_ctx`), áreas
// del lienzo (`_area` o body con `from-pizarra`), nodos que actúan como contexto (tienen
// su propio «🧠 Lo que Fromly sabe»), el propio nodo de conocimiento, capturas y logs.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { listMarkedContexts, isMarkedContext } from './cajones'
import { isContextKnowledge, CONTEXT_KNOWLEDGE } from './knowledgeNodes'

const FLAG = 'from-migrate-ctx-ref-v1'

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Este hijo directo del contexto es INFO DE REFERENCIA (candidato a mover)? */
function isReferenceContent(c: Node): boolean {
  if (c.deletedAt) return false
  if (c.status != null) return false               // tarea
  if (c.isEvent) return false                       // evento
  if (c.isResource) return false                    // recurso/archivo
  if (c.isDiaryEntry) return false                  // diaria
  if (isMarkedContext(c)) return false              // subcontexto (`_ctx`)
  if (isContextKnowledge(c.text)) return false      // el propio nodo de conocimiento
  const e = ed(c)
  if (e._area === '1') return false                 // área del lienzo
  if (e._capture === '1' || e._logAt) return false  // captura / log
  if ((c.body || '').includes('from-pizarra')) return false // área/subcontexto de lienzo
  // Nodo que se comporta como contexto (tiene su propio «🧠 Lo que Fromly sabe») → proteger
  if (store.children(c.id).some(k => !k.deletedAt && isContextKnowledge(k.text))) return false
  // Debe aportar algo (texto propio o hijos con texto)
  const hasText = !!(c.text && c.text.trim())
  const hasKids = store.children(c.id).some(k => !k.deletedAt && k.text && k.text.trim())
  return hasText || hasKids
}

/** Nodo «🧠 Lo que Fromly sabe» del contexto; lo crea si no existe. */
function ensureKnowledgeNode(contextId: string): Node {
  const existing = store.children(contextId).find(n => !n.deletedAt && isContextKnowledge(n.text))
  if (existing) return existing
  const sibs = store.children(contextId).filter(n => !n.deletedAt)
  const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
  return store.createNode({ text: CONTEXT_KNOWLEDGE, parentId: contextId, siblingOrder: maxOrder + 1000 })
}

/**
 * Ejecuta la migración una sola vez. Devuelve un resumen { contexts, moved } de lo que
 * hizo (o null si ya se ejecutó). Seguro de llamar en cada arranque: el flag lo bloquea.
 */
export function migrateContextReferenceOnce(): { contexts: number; moved: number } | null {
  try {
    if (localStorage.getItem(FLAG) === '1') return null
  } catch { /* sin localStorage → intentar igualmente una vez por sesión no persiste */ }

  let movedTotal = 0
  let touchedContexts = 0
  store.beginBatch()
  try {
    for (const ctx of listMarkedContexts({ includeClosed: true })) {
      // Candidatos: hijos DIRECTOS que son info de referencia.
      const refs = store.children(ctx.id).filter(isReferenceContent)
      if (refs.length === 0) continue
      const kn = ensureKnowledgeNode(ctx.id)
      // Reparentar bajo el nodo de conocimiento, conservando el orden relativo, DESPUÉS
      // de las líneas de conocimiento ya existentes.
      const knKids = store.children(kn.id).filter(n => !n.deletedAt)
      let order = knKids.length > 0 ? Math.max(...knKids.map(k => k.siblingOrder)) + 1000 : 1000
      for (const r of refs) {
        if (r.id === kn.id) continue
        store.updateNode(r.id, { parentId: kn.id, siblingOrder: order })
        order += 1000
        movedTotal++
      }
      touchedContexts++
    }
  } finally {
    store.endBatch()
  }
  try { localStorage.setItem(FLAG, '1') } catch { /* noop */ }
  return { contexts: touchedContexts, moved: movedTotal }
}
