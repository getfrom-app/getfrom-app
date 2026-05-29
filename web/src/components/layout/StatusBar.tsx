import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { listBackups, formatBackupAge } from '../../api/backups'
import { clearTokens, apiRequest, getToken } from '../../api/client'
import { nextScheduledRunLabel } from '../../utils/scheduleHelper'

// Versión del build web — incrementar en cada deploy significativo
export const WEB_VERSION = 'v9.3.69'

interface Props {
  isSyncing: boolean
  showSaved?: boolean
}

export default function StatusBar({ isSyncing, showSaved }: Props) {
  const s = useStore()
  const us = useUserStore()
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [loadingBackup, setLoadingBackup] = useState(true)
  const [nextRunLabel, setNextRunLabel] = useState<string | null>(null)

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
          setNextRunLabel(nextScheduledRunLabel(res.schedules ?? []))
        }
      } catch { /* silencioso */ }
    }
    load()
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const nodeCount = s.allActive().length

  // Etiqueta de sync
  const syncLabel = isSyncing
    ? <><span className="footer-spinner" /> Sincronizando</>
    : showSaved
      ? '✓ Guardado'
      : null

  return (
    <div className="app-footer">

      {/* Conexión */}
      {isOnline ? (
        <span className="footer-badge footer-badge--online">
          <span className="footer-badge-dot" />
          Conectado
        </span>
      ) : (
        <button
          className="footer-badge footer-badge--offline footer-badge--btn"
          onClick={() => window.location.reload()}
          title="Sin conexión — clic para reconectar"
        >
          <span className="footer-badge-dot" />
          Sin conexión · Reconectar
        </button>
      )}

      <span className="footer-sep" />

      {/* Último backup */}
      <span className="footer-item" title="Último backup automático">
        Último backup {loadingBackup ? '…' : lastBackup ? formatBackupAge(lastBackup) : '—'}
      </span>

      {/* Próxima ejecución de agente programado */}
      {nextRunLabel && (
        <>
          <span className="footer-sep" />
          <span className="footer-item" title="Próxima ejecución automática de agente">
            ⏰ {nextRunLabel}
          </span>
        </>
      )}

      <span className="footer-sep" />

      {/* Nodos activos */}
      <span className="footer-item" title="Nodos en tu árbol">
        {nodeCount.toLocaleString()} nodos
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

      {/* Versión */}
      <span className="footer-version">{WEB_VERSION}</span>
    </div>
  )
}
