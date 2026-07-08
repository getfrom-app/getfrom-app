// Migración: las NOTAS antiguas que colgaban de un contexto (el texto que la IA
// leía) se convierten en UN documento (`_doc`) colgado del propio contexto, que
// abre como cualquier nota en la columna derecha. REVERSIBLE: los originales van
// a la papelera (restaurables). Se ejecuta por contexto, a petición del usuario.
import { store } from '../store/nodeStore'
import { nodeAsRichHtml } from '../utils/nodeExport'
import { trashNode, parseExtraData } from '../utils/papeleraHelper'
import { isContextKnowledge } from '../utils/knowledgeNodes'
import { isDocNode } from '../utils/docNode'
import type { Node } from '../types'

// Una NOTA antigua de descripción = hijo de texto plano del contexto que NO es
// tarea, evento, subcontexto, conocimiento, sesión, recurso, audio ni documento.
function isLegacyNote(n: Node): boolean {
  if (n.deletedAt || !n.text) return false
  const ed = parseExtraData(n.extraData)
  if (ed._ctx === '1') return false                                   // subcontexto
  if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) return false
  if (Array.isArray(ed._audios)) return false                          // audio
  if (ed._doc === '1' || isDocNode(n)) return false                    // ya es documento
  if (n.status != null || (n.types || []).includes('tarea')) return false
  if ((n.types || []).includes('evento') || n.isEvent) return false
  if (n.isResource || n.resourceType) return false                     // archivo/enlace
  if (isContextKnowledge(n.text)) return false                         // «Lo que Fromly sabe»
  return true
}

export function legacyNotesOf(ctxId: string): Node[] {
  return store.children(ctxId).filter(isLegacyNote)
}

/** Convierte las notas antiguas del contexto en un documento colgado del contexto.
 *  Devuelve el id del documento nuevo, o null si no había nada que migrar. */
export function migrateContextNotesToDoc(ctxId: string): string | null {
  const notes = legacyNotesOf(ctxId)
  if (notes.length === 0) return null
  const ctx = store.getNode(ctxId)
  const body = notes.map(n => nodeAsRichHtml(n)).join('\n') || '<p></p>'
  const doc = store.createNode({ text: `📄 ${ctx?.text || 'Notas'}`, parentId: ctxId, extraData: { _doc: '1' } })
  store.updateNode(doc.id, { body })
  for (const n of notes) trashNode(n.id) // reversible (papelera)
  return doc.id
}
