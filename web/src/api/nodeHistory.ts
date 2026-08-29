// Historial del cuerpo de una nota, con undo — P2 "Confiar" de la Parte II de
// la auditoría (29 ago 2026). Ver el comentario largo en
// server/src/db/schema.ts junto a `nodeBodyVersions`: el cliente decide
// cuándo guardar una versión (justo antes de sobrescribir el body con uno
// nuevo, ver DocEditor.tsx) — este archivo nunca toca cómo se persiste un
// nodo de verdad, solo lee/escribe el log de versiones.
import { apiRequest } from './client'

export interface NodeVersionSummary {
  id: string
  preview: string
  createdAt: string
}

/** Guarda `body` como una versión del historial de `nodeId`. Pensado para
 *  mandar el body ANTERIOR, justo antes de sobrescribirlo — fire-and-forget,
 *  nunca debe bloquear ni romper el guardado real de la nota. */
export async function saveNodeBodyVersion(nodeId: string, body: string): Promise<void> {
  await apiRequest(`/nodes/${nodeId}/history`, { method: 'POST', body: JSON.stringify({ body }) })
}

export async function listNodeBodyVersions(nodeId: string): Promise<NodeVersionSummary[]> {
  const res = await apiRequest<{ versions: NodeVersionSummary[] }>(`/nodes/${nodeId}/history`)
  return res.versions
}

export async function getNodeBodyVersion(nodeId: string, versionId: string): Promise<string> {
  const res = await apiRequest<{ body: string; createdAt: string }>(`/nodes/${nodeId}/history/${versionId}`)
  return res.body
}
