import { useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'

// Versión del build web — incrementar en cada deploy significativo
export const WEB_VERSION = 'v9.1'

interface StatusBarProps {
  isSyncing: boolean
}

export default function StatusBar({ isSyncing }: StatusBarProps) {
  const s = useStore()
  const us = useUserStore()
  const location = useLocation()

  // Context-specific extra info
  const allActive = s.allActive()
  const path = location.pathname.replace(/^\/app/, '') || '/'

  const getContextInfo = () => {
    if (path.startsWith('/node/')) {
      const nodeId = path.split('/node/')[1]
      const node = s.getNode(nodeId)
      if (node?.body) {
        const words = node.body.trim().split(/\s+/).length
        const readTime = Math.max(1, Math.round(words / 200))
        return <span style={{ opacity: 0.5 }}>{words} palabras · {readTime} min lectura</span>
      }
    }
    if (path === '/tasks') {
      const total = allActive.filter(n => n.status !== null).length
      const done = allActive.filter(n => n.status === 'done').length
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      return <span style={{ opacity: 0.5 }}>{done}/{total} tareas · {pct}%</span>
    }
    if (path === '/search') {
      const usedTags = s.allUsedTags()
      return <span style={{ opacity: 0.5 }}>{usedTags.length} tags activos</span>
    }
    return null
  }

  const email = us.user?.email

  return (
    <div className="status-bar">
      {getContextInfo()}
      {email && (
        <span style={{ opacity: 0.45, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={email}>
          {email}
        </span>
      )}
      <span className="status-bar-sync">
        {isSyncing ? '↻ Sincronizando...' : '✓ Guardado'}
      </span>
      <span className="status-bar-version" title="Versión">
        {WEB_VERSION}
      </span>
    </div>
  )
}
