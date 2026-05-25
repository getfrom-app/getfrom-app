import { apiRequest } from './client'

export interface BackupSnapshot {
  id: string
  createdAt: string
  nodeCount: number
  source: string  // auto | manual | mac | web | pre-restore
}

export async function listBackups(): Promise<BackupSnapshot[]> {
  const res = await apiRequest<{ snapshots: BackupSnapshot[] }>('/backups')
  return res.snapshots
}

export async function createBackup(source: 'manual' | 'web' = 'web'): Promise<{ id: string; nodeCount: number; createdAt: string }> {
  return apiRequest('/backups', {
    method: 'POST',
    body: JSON.stringify({ source }),
  })
}

export async function restoreBackup(id: string): Promise<{ ok: boolean; safetySnapshotId: string; restoredCount: number }> {
  return apiRequest(`/backups/${id}/restore`, { method: 'POST' })
}

export async function deleteBackup(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/backups/${id}`, { method: 'DELETE' })
}

export function formatBackupAge(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'Hace un momento'
  if (diffMin < 60) return `Hace ${diffMin} min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `Hace ${h}h`
  const d = Math.floor(h / 24)
  return `Hace ${d}d`
}
