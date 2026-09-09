// Carpetas locales sincronizadas (Mac → RAG). Ver server/src/routes/folders.ts.
// La web solo LEE (listFolders); la app de Mac (utils/folderSync.ts) hace el resto.
import { apiRequest } from './client'

export interface SyncedFolder {
  id: string
  contextId: string | null
  name: string
  localPath: string
  deviceId: string
  deviceName: string | null
  paused: boolean
  fileCount: number
  chunkCount: number
  lastSyncAt: string | null
  createdAt: string
}

export interface ManifestEntry { path: string; hash: string; size: number }

export async function listFolders(contextId?: string | null): Promise<{ folders: SyncedFolder[]; enabled: boolean; limits: { maxChunks: number } }> {
  const q = contextId ? `?contextId=${encodeURIComponent(contextId)}` : ''
  return apiRequest(`/folders${q}`)
}

export async function createFolder(input: { contextId: string | null; name: string; localPath: string; deviceId: string; deviceName: string | null }): Promise<{ folder: SyncedFolder }> {
  return apiRequest('/folders', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateFolder(id: string, patch: { contextId?: string | null; name?: string; paused?: boolean }): Promise<{ folder: SyncedFolder }> {
  return apiRequest(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteFolder(id: string): Promise<{ ok: true }> {
  return apiRequest(`/folders/${id}`, { method: 'DELETE' })
}

export async function sendManifest(id: string, files: ManifestEntry[]): Promise<{ upload: string[]; more: boolean; removed: number; pending: number; chunkCount: number }> {
  return apiRequest(`/folders/${id}/manifest`, { method: 'POST', body: JSON.stringify({ files }) })
}

export async function uploadFolderFile(id: string, file: { path: string; hash: string; size: number; content: string }): Promise<{ ok: true; chunks: number; embedded: number; fileCount: number; chunkCount: number }> {
  return apiRequest(`/folders/${id}/file`, { method: 'POST', body: JSON.stringify(file) })
}
