/**
 * folderSync — carpetas locales del Mac sincronizadas con el RAG (solo Tauri).
 *
 * El Mac es el único que puede vigilar el disco: Rust (`src-tauri/src/folders.rs`)
 * escanea con hash, lee texto de forma segura y avisa de cambios; aquí va la
 * orquestación: manifiesto al servidor (qué cambió), subida de los archivos
 * pendientes, debounce de los cambios y el estado que pinta Ajustes → Carpetas
 * y la ficha del contexto. En la web normal este módulo no hace nada
 * (`isTauriMac()` false): la web solo muestra la lista y manda a la app de Mac.
 *
 * Los archivos NUNCA se convierten en nodos — solo su texto embebido en el
 * servidor (`folder_vectors`). Ver server/src/routes/folders.ts.
 */
import { useSyncExternalStore } from 'react'
import { isTauriMac } from './icloudBackup'
import { getToken } from '../api/client'
import {
  listFolders, createFolder, updateFolder, deleteFolder, sendManifest, uploadFolderFile,
  type SyncedFolder, type ManifestEntry,
} from '../api/folders'

const DEVICE_KEY = 'from_folder_device_id'
/** Tras un cambio en disco, esperar a que se calme antes de re-escanear. */
const CHANGE_DEBOUNCE_MS = 45_000
/** Repaso completo periódico aunque el watcher no avise (por si se perdió algo). */
const PERIODIC_MS = 10 * 60_000

export type FolderState = 'idle' | 'scanning' | 'uploading' | 'error' | 'paused' | 'other-device' | 'disabled'

export interface FolderStatus {
  state: FolderState
  lastError: string | null
  /** Progreso de la subida en curso. */
  done: number
  total: number
  /** Archivos de texto dejados fuera en el último escaneo (tamaño/tope). */
  skipped: number
  truncated: boolean
  lastLocalSyncAt: number | null
}

interface ScanResult { files: ManifestEntry[]; skipped: number; truncated: boolean }

type Listener = () => void

class FolderSyncStore {
  folders: SyncedFolder[] = []
  statuses = new Map<string, FolderStatus>()
  deviceId: string = ''
  deviceName: string | null = null
  ready = false
  enabled = true
  private listeners = new Set<Listener>()
  private started = false
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private running = new Set<string>()
  private dirty = new Set<string>()
  private unlisten: (() => void) | null = null
  private periodic: ReturnType<typeof setInterval> | null = null
  private snapshot: { folders: SyncedFolder[]; statuses: Map<string, FolderStatus>; deviceId: string; ready: boolean; enabled: boolean } | null = null

  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private notify() { this.snapshot = null; this.listeners.forEach(fn => fn()) }
  getSnapshot = () => {
    if (!this.snapshot) this.snapshot = { folders: this.folders, statuses: this.statuses, deviceId: this.deviceId, ready: this.ready, enabled: this.enabled }
    return this.snapshot
  }

  isMine(f: SyncedFolder) { return f.deviceId === this.deviceId }

  private status(id: string): FolderStatus {
    let s = this.statuses.get(id)
    if (!s) { s = { state: 'idle', lastError: null, done: 0, total: 0, skipped: 0, truncated: false, lastLocalSyncAt: null }; this.statuses.set(id, s) }
    return s
  }
  private setStatus(id: string, patch: Partial<FolderStatus>) {
    const next = { ...this.status(id), ...patch }
    this.statuses = new Map(this.statuses)
    this.statuses.set(id, next)
    this.notify()
  }

  /** Arranque (idempotente). Sin sesión no hace nada; se vuelve a llamar tras el login. */
  async start(): Promise<void> {
    if (!isTauriMac() || this.started || !getToken()) return
    this.started = true
    try {
      let id = localStorage.getItem(DEVICE_KEY)
      if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id) }
      this.deviceId = id
    } catch { this.deviceId = 'mac' }
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      this.deviceName = await invoke<string>('device_name')
    } catch { this.deviceName = null }
    try {
      const { listen } = await import('@tauri-apps/api/event')
      this.unlisten = await listen<string>('from:folder-changed', (e) => this.scheduleSync(e.payload))
    } catch { /* sin eventos: queda el repaso periódico */ }
    await this.refresh()
    this.periodic = setInterval(() => { void this.refresh() }, PERIODIC_MS)
  }

  stop(): void {
    this.unlisten?.(); this.unlisten = null
    if (this.periodic) { clearInterval(this.periodic); this.periodic = null }
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
    this.started = false
  }

  /** Recarga la lista del servidor, vigila las de este Mac y las sincroniza. */
  async refresh(): Promise<void> {
    if (!getToken()) return
    try {
      const res = await listFolders()
      this.enabled = res.enabled
      this.folders = res.folders
      this.ready = true
      this.notify()
      for (const f of this.folders) {
        if (!this.isMine(f)) { this.setStatus(f.id, { state: 'other-device' }); continue }
        if (f.paused) { await this.unwatch(f.id); this.setStatus(f.id, { state: 'paused' }); continue }
        if (!this.enabled) { this.setStatus(f.id, { state: 'disabled' }); continue }
        await this.watch(f)
        void this.syncNow(f.id)
      }
    } catch (e) {
      this.ready = true
      this.notify()
      console.warn('[folderSync] refresh', e)
    }
  }

  private async watch(f: SyncedFolder) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('folder_watch', { id: f.id, root: f.localPath })
    } catch (e) { this.setStatus(f.id, { state: 'error', lastError: String(e) }) }
  }
  private async unwatch(id: string) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('folder_unwatch', { id })
    } catch { /* ya no estaba */ }
  }

  scheduleSync(id: string) {
    const prev = this.timers.get(id)
    if (prev) clearTimeout(prev)
    this.timers.set(id, setTimeout(() => { this.timers.delete(id); void this.syncNow(id) }, CHANGE_DEBOUNCE_MS))
  }

  /** Elegir carpeta con el diálogo nativo y vincularla al contexto. */
  async linkFolder(contextId: string | null): Promise<SyncedFolder | null> {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const picked = await open({ directory: true, multiple: false, title: 'Elige la carpeta a sincronizar con Fromly' })
    if (!picked || typeof picked !== 'string') return null
    const localPath = picked
    const name = localPath.replace(/\/+$/, '').split('/').pop() || 'Carpeta'
    const res = await createFolder({ contextId, name, localPath, deviceId: this.deviceId, deviceName: this.deviceName })
    this.folders = [...this.folders, res.folder]
    this.notify()
    await this.watch(res.folder)
    void this.syncNow(res.folder.id)
    return res.folder
  }

  async unlinkFolder(id: string): Promise<void> {
    await this.unwatch(id)
    await deleteFolder(id)
    this.folders = this.folders.filter(f => f.id !== id)
    this.statuses = new Map(this.statuses); this.statuses.delete(id)
    this.notify()
  }

  async setPaused(id: string, paused: boolean): Promise<void> {
    const res = await updateFolder(id, { paused })
    this.folders = this.folders.map(f => (f.id === id ? res.folder : f))
    this.notify()
    if (paused) { await this.unwatch(id); this.setStatus(id, { state: 'paused' }) }
    else { await this.watch(res.folder); void this.syncNow(id) }
  }

  async setContext(id: string, contextId: string | null): Promise<void> {
    const res = await updateFolder(id, { contextId })
    this.folders = this.folders.map(f => (f.id === id ? res.folder : f))
    this.notify()
  }

  /** Escaneo + manifiesto + subida de lo pendiente. Una ejecución por carpeta;
   *  si llega otra mientras corre, se repite al terminar. */
  async syncNow(id: string): Promise<void> {
    const f = this.folders.find(x => x.id === id)
    if (!f || !this.isMine(f) || f.paused) return
    if (this.running.has(id)) { this.dirty.add(id); return }
    this.running.add(id)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      this.setStatus(id, { state: 'scanning', lastError: null, done: 0, total: 0 })
      const scan = await invoke<ScanResult>('folder_scan', { root: f.localPath })
      this.setStatus(id, { skipped: scan.skipped, truncated: scan.truncated })
      const byPath = new Map(scan.files.map(e => [e.path, e]))
      let rounds = 0
      for (;;) {
        const m = await sendManifest(id, scan.files)
        if (m.upload.length === 0) break
        this.setStatus(id, { state: 'uploading', done: 0, total: m.pending })
        let done = 0
        for (const path of m.upload) {
          const entry = byPath.get(path)
          if (!entry) continue
          try {
            const content = await invoke<string>('folder_read', { root: f.localPath, rel: path })
            await uploadFolderFile(id, { path, hash: entry.hash, size: entry.size, content })
          } catch (e) {
            const msg = String((e as Error)?.message || e)
            if (msg === 'folder_full' || msg === 'file_limit' || msg === 'rag_disabled' || msg === 'paused' || msg === 'INSUFFICIENT_TOKENS') {
              this.setStatus(id, { state: 'error', lastError: msg })
              return
            }
            console.warn('[folderSync] archivo', path, msg) // uno que falla no para el resto
          }
          done++
          this.setStatus(id, { done })
        }
        if (!m.more || ++rounds > 30) break
      }
      // Estado fresco del servidor (contadores y última sincronización).
      const res = await listFolders()
      this.folders = res.folders
      this.setStatus(id, { state: 'idle', lastLocalSyncAt: Date.now(), done: 0, total: 0 })
    } catch (e) {
      this.setStatus(id, { state: 'error', lastError: String((e as Error)?.message || e) })
    } finally {
      this.running.delete(id)
      if (this.dirty.delete(id)) void this.syncNow(id)
    }
  }
}

export const folderSync = new FolderSyncStore()

export function useFolderSync() {
  return useSyncExternalStore(folderSync.subscribe, folderSync.getSnapshot, folderSync.getSnapshot)
}

/** URL de descarga de la app de Mac (mismo enlace que la landing). */
export const MAC_APP_DOWNLOAD_URL = 'https://github.com/getfrom-app/getfrom-app/releases/latest/download/Fromly.dmg'
