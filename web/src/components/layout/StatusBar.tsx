import { useEffect, useState } from 'react'
import { useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { listBackups, formatBackupAge } from '../../api/backups'

// Versión del build web — incrementar en cada deploy significativo
export const WEB_VERSION = 'v9.1'

interface Props {
  isSyncing: boolean
  showSaved?: boolean
}

export default function StatusBar({ isSyncing, showSaved }: Props) {
  const s = useStore()
  const us = useUserStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [loadingBackup, setLoadingBackup] = useState(true)

  // Online / offline listener
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

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

  const email = us.user?.email
  const nodeCount = s.allActive().length

  return (
    <div className="app-footer">
      {/* Badge conexión */}
      <span className={`footer-badge ${isOnline ? 'footer-badge--online' : 'footer-badge--offline'}`}>
        <span className="footer-badge-dot" />
        {isOnline ? 'Conectado' : 'Sin conexión'}
      </span>

      <span className="footer-sep" />

      {/* Último backup */}
      <span className="footer-item" title="Último backup automático">
        💾 {loadingBackup ? '…' : lastBackup ? formatBackupAge(lastBackup) : 'Sin backup'}
      </span>

      <span className="footer-sep" />

      {/* Nodos activos */}
      <span className="footer-item" title="Nodos en tu árbol">
        {nodeCount.toLocaleString()} nodos
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Email */}
      {email && (
        <>
          <span className="footer-item footer-email" title={email}>{email}</span>
          <span className="footer-sep" />
        </>
      )}

      {/* Sync */}
      <span className="footer-item footer-sync">
        {isSyncing
          ? <><span className="footer-spinner" /> Sincronizando</>
          : showSaved
            ? '✓ Guardado'
            : ''}
      </span>

      <span className="footer-sep" />

      {/* Versión */}
      <span className="footer-version">{WEB_VERSION}</span>
    </div>
  )
}
