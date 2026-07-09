// Clasificación de ELEMENTOS de Fromly 2.0 — alineada con la v1 (ElementsPanel):
// documento, nota, PDF, imagen, ENLACE, audio. Detecta enlaces igual que la v1
// (isResource / extraData._resourceUrl / _resource / _resourceType), no solo por
// el campo promovido resourceType — así los enlaces nunca se pierden.
import { parseExtraData } from '../utils/papeleraHelper'
import { isDocNode } from '../utils/docNode'
import type { Node } from '../types'

export type ElKind = 'document' | 'note' | 'pdf' | 'image' | 'link' | 'audio' | 'highlight'

export function classifyElement(n: Node): { kind: ElKind; icon: string; label: string } | null {
  if (n.deletedAt || !n.text) return null
  const e = parseExtraData(n.extraData)
  if (e._absorbedBy != null) return null                       // oculto dentro de un bloque
  if (e._aiSession === '1' || e._aiTranscript === '1' || e._aiMsgRole) return null
  if (e._ctx === '1') return null                              // subcontexto
  if (e._pdfSelection != null) return { kind: 'highlight', icon: '🖍️', label: 'Subrayado' }
  if (n.status != null || (n.types || []).includes('tarea')) return null   // tarea
  if (n.isEvent || (n.types || []).includes('evento')) return null         // evento

  const rt = (e._resourceType as string) || (n.resourceType || '')
  if (rt === 'image' || e._imageUrl) return { kind: 'image', icon: '🖼', label: 'Imagen' }
  if (rt === 'pdf') return { kind: 'pdf', icon: '📄', label: 'PDF' }
  if (n.isResource || e._resourceUrl != null || e._resource != null || rt) return { kind: 'link', icon: '🔗', label: 'Enlace' }
  if (Array.isArray(e._audios)) return { kind: 'audio', icon: '🎙', label: 'Audio' }
  if (isDocNode(n) || e._doc === '1') return { kind: 'document', icon: '📝', label: 'Documento' }
  return { kind: 'note', icon: '📝', label: 'Nota' }
}
