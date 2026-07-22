// Clasificación de ELEMENTOS de Fromly 2.0 — alineada con la v1 (ElementsPanel):
// documento, nota, PDF, imagen, ENLACE, audio. Detecta enlaces igual que la v1
// (isResource / extraData._resourceUrl / _resource / _resourceType), no solo por
// el campo promovido resourceType — así los enlaces nunca se pierden.
import { parseExtraData } from '../utils/papeleraHelper'
import { isDocNode } from '../utils/docNode'
import { isContextKnowledge } from '../utils/knowledgeNodes'
import type { Node } from '../types'

export type ElKind = 'document' | 'note' | 'pdf' | 'image' | 'link' | 'audio' | 'highlight' | 'cita'

// PDF antiguos: los recursos subidos ANTES de guardar `_resourceType:'pdf'` no llevan
// el tipo → sin esto abrirían como «Enlace» en vez de con el visor. Detectamos también
// por la URL/clave/nombre acabados en `.pdf` (mismo criterio que wfFilter). Sin mutar
// datos: la clasificación es en tiempo de render.
export function isPdfResource(n: Node, e: Record<string, unknown>): boolean {
  const rt = (e._resourceType as string) || (n.resourceType || '')
  if (rt === 'pdf') return true
  const url = (e._resourceUrl as string) || (n.resourceUrl || '') || (e._resourceKey as string) || ''
  if (/\.pdf($|\?)/i.test(url)) return true
  // Solo por nombre si el nodo ES un recurso (evita clasificar como PDF una nota titulada «x.pdf»).
  const isRes = n.isResource || e._resourceUrl != null || e._resource != null
  return isRes && /\.pdf$/i.test(n.text || '')
}

/** ¿Puede mencionarse/referenciarse este nodo (con @ en el chat, o como "elemento
 *  a tener en cuenta" de un agente)? Deliberadamente más permisivo que
 *  classifyElement: SÍ incluye tareas, eventos, conversaciones, agentes y
 *  prompts (cualquier elemento real de Fromly) — solo excluye lo puramente
 *  estructural (mensajes/transcript de chat, el espacio de Notas libres). */
export function isMentionable(n: Node): boolean {
  if (n.deletedAt || !(n.text || '').trim()) return false
  const e = parseExtraData(n.extraData)
  if (e._aiTranscript != null || e._aiMsgRole != null || e._containerNotes === '1') return false
  return true
}

export function classifyElement(n: Node): { kind: ElKind; icon: string; label: string } | null {
  // OJO: antes también exigía `n.text` no vacío — eso descartaba un documento RECIÉN
  // creado (nace con text:'' hasta que escribes algo), así que no aparecía en
  // Historial/Contexto hasta tener título. Los nodos vacíos que de verdad no son un
  // elemento (bullets sueltos sin marcar) siguen fuera: caen en 'note' más abajo, y
  // los dos consumidores (V2RightColumn/V2ContextView) ya filtran `kind === 'note'`.
  if (n.deletedAt) return null
  const e = parseExtraData(n.extraData)
  if (e._absorbedBy != null) return null                       // oculto dentro de un bloque
  if (e._aiSession === '1' || e._aiTranscript === '1' || e._aiMsgRole) return null
  if (e._ctx === '1') return null                              // subcontexto
  if (e._containerNotes === '1') return null                   // espacio de notas libres (no es un elemento)
  if (isContextKnowledge(n.text)) return null                  // 🧠 Memoria del contexto (no es un elemento)
  if (e._pdfSelection != null) return { kind: 'highlight', icon: '🖍️', label: 'Subrayado' }
  // Cita de un párrafo de OTRA nota, asignada a este contexto (ver DocEditor.tsx,
  // «?» al pasar el ratón). Mismo patrón que el subrayado de PDF, pero la fuente
  // es un documento propio, no un PDF — su propio tipo para no confundirlos.
  if (e._docSelection != null) return { kind: 'cita', icon: '🔖', label: 'Cita' }
  if (n.status != null || (n.types || []).includes('tarea')) return null   // tarea
  if (n.isEvent || (n.types || []).includes('evento')) return null         // evento

  const rt = (e._resourceType as string) || (n.resourceType || '')
  if (rt === 'image' || e._imageUrl) return { kind: 'image', icon: '🖼', label: 'Imagen' }
  if (isPdfResource(n, e)) return { kind: 'pdf', icon: '📄', label: 'PDF' }
  if (n.isResource || e._resourceUrl != null || e._resource != null || rt) return { kind: 'link', icon: '🔗', label: 'Enlace' }
  if (Array.isArray(e._audios)) return { kind: 'audio', icon: '🎙', label: 'Audio' }
  if (isDocNode(n) || e._doc === '1') return { kind: 'document', icon: '📝', label: 'Documento' }
  return { kind: 'note', icon: '📝', label: 'Nota' }
}
