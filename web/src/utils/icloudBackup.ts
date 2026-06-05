/**
 * icloudBackup — backup automático del vault a iCloud Drive (solo Mac/Tauri).
 *
 * Escribe un export LIMPIO (solo nodos activos) en
 *   ~/Library/Mobile Documents/com~apple~CloudDocs/From Backups/
 * vía el comando Rust `write_icloud_backup`. iCloud lo sincroniza solo →
 * backup offsite en la cuenta del usuario, sin OAuth.
 *
 * Activado por defecto en Mac durante la beta (red de seguridad). El usuario
 * puede desactivarlo desde Ajustes → Accesorios.
 */
import { store } from '../store/nodeStore'

const ENABLED_KEY = 'from_icloud_backup'        // '1' | '0' (por defecto activado)
const LAST_KEY    = 'from_icloud_backup_last'   // timestamp ms del último backup
const INTERVAL_MS = 2 * 60 * 60 * 1000          // cada 2h como mucho
const KEEP_FILES  = 30                          // historial local que mantenemos

export function isTauriMac(): boolean {
  return import.meta.env.VITE_TAURI === 'true'
}

export function isICloudBackupEnabled(): boolean {
  // Por defecto activado en Mac (si nunca se ha tocado el ajuste).
  return localStorage.getItem(ENABLED_KEY) !== '0'
}

export function setICloudBackupEnabled(on: boolean): void {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0')
  if (on) void runICloudBackup(true)
}

/** Export limpio: solo nodos activos. Restaurable. */
function buildExport(): string {
  const nodes = store.allActive()
  return JSON.stringify({
    _format: 'from-icloud-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    nodes,
  })
}

/** Hace un backup si toca (throttle 2h). force=true lo fuerza ahora. */
export async function maybeICloudBackup(): Promise<void> {
  if (!isTauriMac() || !isICloudBackupEnabled()) return
  const last = parseInt(localStorage.getItem(LAST_KEY) || '0', 10)
  if (Date.now() - last < INTERVAL_MS) return
  await runICloudBackup(false)
}

async function runICloudBackup(_force: boolean): Promise<void> {
  if (!isTauriMac() || !store.isLoaded) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    await invoke('write_icloud_backup', {
      filename: `from-backup-${ts}.json`,
      content: buildExport(),
    })
    localStorage.setItem(LAST_KEY, String(Date.now()))
    // Poda del historial local (mantener KEEP_FILES) — best-effort.
    void pruneOldBackups()
  } catch {
    // silencioso: si iCloud no está disponible, no molestamos al usuario
  }
}

/** Mantener solo los últimos KEEP_FILES backups en la carpeta. */
async function pruneOldBackups(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('prune_icloud_backups', { keep: KEEP_FILES })
  } catch { /* el comando de poda es opcional */ }
}
