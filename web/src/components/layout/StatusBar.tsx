import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { listBackups, formatBackupAge } from '../../api/backups'
import { clearTokens, apiRequest, getToken } from '../../api/client'
import { scheduledAgentsSummary, relativeUntil } from '../../utils/scheduleHelper'
import { estimateContextTokens, formatTokens } from '../../utils/contextBudget'

// Versión del build web — incrementar en cada deploy significativo
export const WEB_VERSION = 'v9.6.743'

interface Props {
  isSyncing: boolean
  showSaved?: boolean
  currentNodeId?: string
}

const isTauriEnv = import.meta.env.VITE_TAURI === 'true'

export default function StatusBar({ isSyncing, showSaved, currentNodeId }: Props) {
  const s = useStore()
  const us = useUserStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [loadingBackup, setLoadingBackup] = useState(true)
  const [agentsSummary, setAgentsSummary] = useState<{ count: number; nextDate: Date | null } | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; download: () => Promise<void> } | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateUpToDate, setUpdateUpToDate] = useState(false)
  const [macVersion, setMacVersion] = useState<string | null>(null)

  // Leer versión nativa Tauri (solo Mac)
  useEffect(() => {
    if (!isTauriEnv) return
    import('@tauri-apps/api/app').then(({ getVersion }) => {
      getVersion().then(v => setMacVersion(v)).catch(() => {})
    }).catch(() => {})
  }, [])

  // Verificar actualizaciones disponibles (solo en Mac Tauri)
  useEffect(() => {
    if (!isTauriEnv) return

    const checkForUpdates = async () => {
      setUpdateChecking(true)
      setUpdateError(null)
      setUpdateUpToDate(false)
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update?.available) {
          setUpdateAvailable({
            version: update.version,
            download: async () => {
              setUpdating(true)
              setUpdateError(null)
              try {
                await update.downloadAndInstall()
                const { relaunch } = await import('@tauri-apps/plugin-process')
                await relaunch()
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                setUpdateError(msg)
                setUpdating(false)
              }
            }
          })
        } else {
          setUpdateUpToDate(true)
          setTimeout(() => setUpdateUpToDate(false), 4000)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setUpdateError(msg)
      } finally {
        setUpdateChecking(false)
      }
    }

    // Check al inicio con delay
    const t1 = setTimeout(checkForUpdates, 5000)
    // Y cada hora
    const t2 = setInterval(checkForUpdates, 3_600_000)

    // Escuchar evento del menú nativo "Buscar actualizaciones..."
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('from:check-update', () => {
        checkForUpdates()
      }).then(fn => { unlisten = fn })
    }).catch(() => {})

    return () => {
      clearTimeout(t1)
      clearInterval(t2)
      unlisten?.()
    }
  }, [])

  // Online / offline listener
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Sesión expirada → redirigir al login
  useEffect(() => {
    const handler = () => {
      clearTokens()
      navigate('/login', { replace: true })
    }
    window.addEventListener('from:unauthorized', handler)
    return () => window.removeEventListener('from:unauthorized', handler)
  }, [navigate])

  // Último backup — carga una vez y se refresca cada 5 min
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const snaps = await listBackups()
        if (!cancelled && snaps.length > 0) {
          setLastBackup(snaps[0].createdAt)
        }
      } catch { /* silencioso */ } finally {
        if (!cancelled) setLoadingBackup(false)
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Schedules activos — carga si hay sesión, refresca cada 10 min
  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await apiRequest<{ schedules: Array<{ schedule: string; agentTitle: string | null; enabled: boolean }> }>('/agents/schedules')
        if (!cancelled) {
          setAgentsSummary(scheduledAgentsSummary(res.schedules ?? []))
        }
      } catch { /* silencioso */ }
    }
    load()
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const nodeCount = s.allActive().length
  // Presupuesto de contexto que se inyectaría en Magic para el nodo actual
  // (Perfil + contexto del nodo y heredado). void s.nodesVersion → reactivo.
  void s.nodesVersion
  const ctxTokens = estimateContextTokens(currentNodeId)

  // Etiqueta de sync
  const syncLabel = isSyncing
    ? <><span className="footer-spinner" /> {t('statusbar.syncing')}</>
    : showSaved
      ? t('statusbar.saved')
      : null

  return (
    <div className="app-footer">

      {/* Conexión */}
      {isOnline ? (
        <span className="footer-badge footer-badge--online">
          <span className="footer-badge-dot" />
          {t('statusbar.connected')}
        </span>
      ) : (
        <button
          className="footer-badge footer-badge--offline footer-badge--btn"
          onClick={() => window.location.reload()}
          title={t('statusbar.disconnected')}
        >
          <span className="footer-badge-dot" />
          {t('statusbar.disconnected')}
        </button>
      )}

      <span className="footer-sep" />

      {/* Último backup */}
      <span className="footer-item" title={t('statusbar.lastBackupHint')}>
        {t('statusbar.lastBackup')} {loadingBackup ? '…' : lastBackup ? formatBackupAge(lastBackup) : '—'}
      </span>

      {/* Agentes programados: contador + próxima activación (o "ninguno") */}
      {agentsSummary && (
        <>
          <span className="footer-sep" />
          <span className="footer-item" title={t('statusbar.nextAgentRunHint')}>
            {agentsSummary.count === 0 ? (
              t('statusbar.noAgentsActive', 'Ningún agente activo')
            ) : (
              <>
                🤖 {t('statusbar.agentsActive', { count: agentsSummary.count })}
                {agentsSummary.nextDate && ` · ${t('statusbar.nextRun', { when: relativeUntil(agentsSummary.nextDate, i18n.language?.startsWith('en')) })}`}
              </>
            )}
          </span>
        </>
      )}

      {/* Presupuesto de contexto IA (Perfil + contexto del nodo actual) */}
      {ctxTokens > 0 && (
        <>
          <span className="footer-sep" />
          <span className="footer-item" title={t('statusbar.contextBudgetHint')}>
            🧠 {t('statusbar.contextBudget', { tokens: formatTokens(ctxTokens) })}
          </span>
        </>
      )}

      <span className="footer-sep" />

      {/* Nodos activos */}
      <span className="footer-item" title={t('statusbar.nodeCountHint')}>
        {nodeCount.toLocaleString()} {t('statusbar.nodeCountHint')}
      </span>

      {/* Sync — al lado de los nodos, solo cuando hay algo que mostrar */}
      {syncLabel && (
        <>
          <span className="footer-sep" />
          <span className="footer-item footer-sync">{syncLabel}</span>
        </>
      )}

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Comprobando actualización */}
      {updateChecking && (
        <>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '0 6px' }}>
            Comprobando...
          </span>
          <span className="footer-sep" />
        </>
      )}

      {/* Al día */}
      {updateUpToDate && !updateChecking && (
        <>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '0 6px' }}>
            ✓ Al día
          </span>
          <span className="footer-sep" />
        </>
      )}

      {/* Error de actualización */}
      {updateError && (
        <>
          <span
            style={{ fontSize: 11, color: 'var(--color-error, #e53e3e)', padding: '0 6px', cursor: 'pointer' }}
            title={updateError}
            onClick={() => setUpdateError(null)}
          >
            ⚠ Error — {updateError.slice(0, 200)}
          </span>
          <span className="footer-sep" />
        </>
      )}

      {/* Nueva versión disponible (solo Mac Tauri) */}
      {updateAvailable && !updateError && (
        <>
          <button
            onClick={updating ? undefined : updateAvailable.download}
            disabled={updating}
            style={{
              background: 'none', border: 'none', cursor: updating ? 'default' : 'pointer',
              fontSize: 11, color: updating ? 'var(--text-tertiary)' : 'var(--accent)',
              fontWeight: 600, padding: '0 6px', display: 'flex', alignItems: 'center', gap: 4,
            }}
            title={`Versión ${updateAvailable.version} disponible`}
          >
            {updating ? '⬇ Instalando...' : `✦ Nueva versión ${updateAvailable.version} — Actualizar`}
          </button>
          <span className="footer-sep" />
        </>
      )}

      {/* Versión */}
      <span className="footer-version">
        {WEB_VERSION}{macVersion ? ` · Mac ${macVersion}` : ''}
      </span>
    </div>
  )
}
