// Clasificación de ELEMENTOS de Fromly 2.0 — alineada con la v1 (ElementsPanel):
// documento, nota, PDF, imagen, ENLACE, audio. Detecta enlaces igual que la v1
// (isResource / extraData._resourceUrl / _resource / _resourceType), no solo por
// el campo promovido resourceType — así los enlaces nunca se pierden.
import { parseExtraData } from '../utils/papeleraHelper'
import { isDocNode } from '../utils/docNode'
import { isContextMemoryNode } from '../utils/knowledgeNodes'
import { isTaskNode } from '../utils/taskNode'
import type { IconName } from './components/Icon'
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
  if (isContextMemoryNode(n)) return false                     // memoria del contexto: superficie interna
  return true
}

// `icon` es el NOMBRE de un icono de components/Icon.tsx, nunca un emoji
// (rediseño 5 ago 2026 — ver la cabecera de ese archivo).
export function classifyElement(n: Node): { kind: ElKind; icon: IconName; label: string } | null {
  // OJO: antes también exigía `n.text` no vacío — eso descartaba un documento RECIÉN
  // creado (nace con text:'' hasta que escribes algo), así que no aparecía en
  // Historial/Contexto hasta tener título. Los nodos vacíos que de verdad no son un
  // elemento (bullets sueltos sin marcar) siguen fuera: caen en 'note' más abajo, y
  // los dos consumidores (V2RightColumn/V2ContextView) ya filtran `kind === 'note'`.
  if (n.deletedAt) return null
  if (n.isDiaryEntry) return null                               // nota diaria — solo Calendario/tab Día, nunca Elementos (Alberto, 4 ago 2026)
  const e = parseExtraData(n.extraData)
  if (e._absorbedBy != null) return null                       // oculto dentro de un bloque
  if (e._aiSession === '1' || e._aiTranscript === '1' || e._aiMsgRole) return null
  if (e._ctx === '1') return null                              // subcontexto
  if (e._containerNotes === '1') return null                   // espacio de notas libres (no es un elemento)
  // Memoria del contexto: por FLAG o por título (los contextos anteriores al flag no
  // lo tienen hasta que se abren una vez) — nunca es un elemento del usuario.
  if (isContextMemoryNode(n)) return null
  if (e._pdfSelection != null) return { kind: 'highlight', icon: 'highlight', label: 'Subrayado' }
  // Cita de un párrafo de OTRA nota, asignada a este contexto (ver DocEditor.tsx,
  // «?» al pasar el ratón). Mismo patrón que el subrayado de PDF, pero la fuente
  // es un documento propio, no un PDF — su propio tipo para no confundirlos.
  if (e._docSelection != null) return { kind: 'cita', icon: 'quote', label: 'Cita' }
  // Tarea (los eventos son tareas con día y hora — utils/taskNode.ts): tienen su
  // propia lista con checkbox y fecha, no se listan como «elemento».
  if (isTaskNode(n) || (n.types || []).includes('evento')) return null

  const rt = (e._resourceType as string) || (n.resourceType || '')
  if (rt === 'image' || e._imageUrl) return { kind: 'image', icon: 'image', label: 'Imagen' }
  if (isPdfResource(n, e)) return { kind: 'pdf', icon: 'pdf', label: 'PDF' }
  if (n.isResource || e._resourceUrl != null || e._resource != null || rt) return { kind: 'link', icon: 'link', label: 'Enlace' }
  if (Array.isArray(e._audios)) return { kind: 'audio', icon: 'audio', label: 'Audio' }
  if (isDocNode(n) || e._doc === '1') return { kind: 'document', icon: 'document', label: 'Documento' }
  return { kind: 'note', icon: 'note', label: 'Nota' }
}
