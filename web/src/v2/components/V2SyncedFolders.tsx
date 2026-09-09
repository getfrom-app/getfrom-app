// Carpetas locales del Mac sincronizadas con el RAG — lista + acciones.
// Se usa en Ajustes → Carpetas (todas) y en la ficha de un contexto (solo las
// suyas). En la app de Mac (Tauri) se gestiona todo aquí: vincular con el
// diálogo nativo, pausar, sincronizar ahora, desvincular. En la web normal
// solo se lee y se manda a la app de Mac (botón de descarga).
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { listFolders, type SyncedFolder } from '../../api/folders'
import { folderSync, useFolderSync, MAC_APP_DOWNLOAD_URL, type FolderStatus } from '../../utils/folderSync'
import { isTauriMac } from '../../utils/icloudBackup'
import { openExternalUrl } from '../../utils/openExternal'
import { fmtRelative } from '../../utils/formatDate'
import { displayTitle } from '../../utils/displayText'
import { contextPathLabel } from '../../utils/cajones'
import ContextPicker from '../../components/panels/ContextPicker'
import Icon from './Icon'

interface Props {
  /** undefined = todas; string = solo las de ese contexto; null = solo las sin contexto. */
  contextId?: string | null
  /** true en la ficha del contexto (título de sección más compacto, sin selector de contexto). */
  compact?: boolean
}

function ctxLabel(id: string | null, fallback: string): string {
  if (!id) return fallback
  const n = store.getNode(id)
  if (!n) return fallback
  const path = contextPathLabel(id)
  return path || displayTitle(n.text)
}

export default function V2SyncedFolders({ contextId, compact = false }: Props) {
  const { t, i18n } = useTranslation()
  const tauri = isTauriMac()
  const live = useFolderSync()
  // En la web (sin Tauri) el store de sync no arranca: se lee del servidor directamente.
  const [webFolders, setWebFolders] = useState<SyncedFolder[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ctxPickerFor, setCtxPickerFor] = useState<string | null>(null)
  const pickerWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tauri) return
    let alive = true
    listFolders().then(r => { if (alive) setWebFolders(r.folders) }).catch(() => { if (alive) setWebFolders([]) })
    return () => { alive = false }
  }, [tauri, contextId])

  useEffect(() => {
    if (!ctxPickerFor) return
    const onDoc = (e: MouseEvent) => { if (pickerWrap.current && !pickerWrap.current.contains(e.target as HTMLElement)) setCtxPickerFor(null) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [ctxPickerFor])

  const all = tauri ? live.folders : (webFolders ?? [])
  const folders = contextId === undefined ? all : all.filter(f => f.contextId === contextId)
  const loading = tauri ? !live.ready : webFolders === null

  async function run(id: string | null, fn: () => Promise<unknown>) {
    setBusy(id ?? 'link'); setError(null)
    try { await fn() }
    catch (e) { setError(errorText(String((e as Error)?.message || e))) }
    finally { setBusy(null) }
  }

  function errorText(code: string): string {
    switch (code) {
      case 'folder_full': return t('folders.errFolderFull', 'Carpeta llena: se ha alcanzado el tope de fragmentos indexables.')
      case 'file_limit': case 'INSUFFICIENT_TOKENS': return t('folders.errPlan', 'Necesitas un plan activo para sincronizar carpetas.')
      case 'rag_disabled': return t('folders.errDisabled', 'La búsqueda semántica no está disponible ahora mismo.')
      case 'already_linked': return t('folders.errAlreadyLinked', 'Esa carpeta ya está vinculada.')
      case 'too_many_folders': return t('folders.errTooMany', 'Has llegado al máximo de carpetas vinculadas.')
      default: return code
    }
  }

  function stateLabel(f: SyncedFolder, s: FolderStatus | undefined): string {
    if (!tauri) return f.paused ? t('folders.statePaused', 'En pausa') : t('folders.stateIdle', 'Sincronizada')
    if (!s) return f.paused ? t('folders.statePaused', 'En pausa') : t('folders.stateIdle', 'Sincronizada')
    switch (s.state) {
      case 'scanning': return t('folders.stateScanning', 'Escaneando…')
      case 'uploading': return t('folders.stateUploading', 'Subiendo {{done}}/{{total}}…', { done: s.done, total: s.total })
      case 'error': return t('folders.stateError', 'Error: {{error}}', { error: errorText(s.lastError || '') })
      case 'paused': return t('folders.statePaused', 'En pausa')
      case 'other-device': return t('folders.stateOtherDevice', 'Se sincroniza desde {{device}}', { device: f.deviceName || 'otro Mac' })
      case 'disabled': return t('folders.errDisabled', 'La búsqueda semántica no está disponible ahora mismo.')
      default: return t('folders.stateIdle', 'Sincronizada')
    }
  }

  function dot(f: SyncedFolder, s: FolderStatus | undefined): string {
    const st = tauri ? (s?.state ?? 'idle') : (f.paused ? 'paused' : 'idle')
    if (st === 'error' || st === 'disabled') return 'var(--danger, #d33)'
    if (st === 'paused' || st === 'other-device') return 'var(--text-tertiary)'
    if (st === 'scanning' || st === 'uploading') return 'var(--warning, #e6a700)'
    return 'var(--success, #2fa84f)'
  }

  const downloadBtn = (
    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { void openExternalUrl(MAC_APP_DOWNLOAD_URL) }}>
      {t('folders.downloadMac', 'Descargar la app de Mac')}
    </button>
  )

  return (
    <div className="v2-folders" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tauri ? (
        <div className="st-row-hint">{t('folders.hintTauri', 'Solo se leen archivos de texto (notas, logs, código). Nunca binarios ni secretos como .env o claves. Su contenido alimenta al chat del contexto, sin aparecer como elementos en Fromly.')}</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="st-row-hint">{t('folders.managedFromMac', 'Las carpetas se vinculan y sincronizan desde la app de Mac.')}</span>
          {downloadBtn}
        </div>
      )}

      {loading ? (
        <div className="v2-el-meta">{t('common.loading', 'Cargando…')}</div>
      ) : folders.length === 0 ? (
        <div className="v2-el-meta">
          {contextId === undefined
            ? t('folders.empty', 'Ninguna carpeta vinculada todavía.')
            : t('folders.emptyCtx', 'Ninguna carpeta del Mac vinculada a este contexto.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {folders.map(f => {
            const s = live.statuses.get(f.id)
            const mine = tauri && f.deviceId === live.deviceId
            return (
              <div key={f.id} className="v2-folder-row" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: dot(f, s), flexShrink: 0 }} />
                  <Icon name="folder" size={14} />
                  <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</strong>
                  <span className="v2-el-meta" style={{ marginLeft: 'auto', flexShrink: 0 }}>{stateLabel(f, s)}</span>
                </div>
                <div className="v2-el-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.localPath}>
                  {f.localPath}{f.deviceName ? ` · ${f.deviceName}` : ''}
                </div>
                <div className="v2-el-meta">
                  {t('folders.counts', '{{files}} archivos · {{chunks}} fragmentos', { files: f.fileCount, chunks: f.chunkCount })}
                  {' · '}
                  {t('folders.lastSync', 'última sincronización {{when}}', { when: f.lastSyncAt ? fmtRelative(f.lastSyncAt, i18n.language) : t('folders.never', 'nunca') })}
                  {s?.truncated ? ` · ${t('folders.truncated', 'más de 5.000 archivos: solo se indexan los primeros')}` : ''}
                  {s && s.skipped > 0 ? ` · ${t('folders.skipped', '{{count}} omitidos por tamaño', { count: s.skipped })}` : ''}
                </div>
                {!compact && (
                  <div ref={ctxPickerFor === f.id ? pickerWrap : undefined} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="v2-el-meta">{t('folders.context', 'Contexto')}:</span>
                    <button className="v2-ctx-edit-btn" disabled={!mine} title={t('folders.changeContext', 'Cambiar contexto')}
                      onClick={() => setCtxPickerFor(p => (p === f.id ? null : f.id))}>
                      {ctxLabel(f.contextId, t('folders.noContext', 'Sin contexto (general)'))}
                    </button>
                    {ctxPickerFor === f.id && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20 }}>
                        <ContextPicker currentId={f.contextId} onPick={id => { setCtxPickerFor(null); void run(f.id, () => folderSync.setContext(f.id, id)) }} />
                      </div>
                    )}
                  </div>
                )}
                {mine && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    <button className="btn-secondary" style={{ fontSize: 11 }} disabled={busy === f.id || f.paused} onClick={() => run(f.id, () => folderSync.syncNow(f.id))}>
                      {t('folders.syncNow', 'Sincronizar ahora')}
                    </button>
                    <button className="btn-secondary" style={{ fontSize: 11 }} disabled={busy === f.id} onClick={() => run(f.id, () => folderSync.setPaused(f.id, !f.paused))}>
                      {f.paused ? t('folders.resume', 'Reanudar') : t('folders.pause', 'Pausar')}
                    </button>
                    <button className="btn-secondary" style={{ fontSize: 11, color: 'var(--danger, #d33)' }} disabled={busy === f.id} onClick={() => {
                      if (!window.confirm(t('folders.confirmUnlink', '¿Desvincular «{{name}}»? Se borra lo indexado; los archivos del Mac no se tocan.', { name: f.name }))) return
                      void run(f.id, () => folderSync.unlinkFolder(f.id))
                    }}>
                      {t('folders.unlink', 'Desvincular')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tauri && (
        <div>
          <button className="btn-primary" style={{ fontSize: 12 }} disabled={busy === 'link' || !live.enabled}
            onClick={() => run(null, () => folderSync.linkFolder(contextId === undefined ? null : contextId))}>
            {busy === 'link' ? '…' : t('folders.link', 'Vincular carpeta…')}
          </button>
        </div>
      )}
      {error && <div className="v2-el-meta" style={{ color: 'var(--danger, #d33)' }}>{error}</div>}
    </div>
  )
}
