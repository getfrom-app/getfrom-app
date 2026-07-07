// Sidebar de Fromly 2.0 — contextos (= proyectos) jerárquicos + nueva conversación.
// Reutiliza el motor: listMarkedContexts (cajones), useStore, useUserStore.
import { useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { listMarkedContexts, contextColor, isMarkedContext } from '../../utils/cajones'
import type { Node } from '../../types'

interface Props {
  selectedCtxId: string | null
  onSelectCtx: (id: string | null) => void
  onNewChat: () => void
}

export default function V2Sidebar({ selectedCtxId, onSelectCtx, onNewChat }: Props) {
  useStore() // re-render en cambios del árbol
  const user = useUserStore()

  // Contextos abiertos (áreas + proyectos). listMarkedContexts ya excluye cerrados.
  const contexts: Node[] = listMarkedContexts()
  // Áreas = hijos directos de la raíz 🧠 Contexto; el resto son subcontextos.
  const roots = contexts.filter(c => {
    const parent = c.parentId
    if (!parent) return true
    const pnode = contexts.find(x => x.id === parent)
    return !pnode || !isMarkedContext(pnode)
  })
  const childrenOf = (id: string) => contexts.filter(c => c.parentId === id)

  const initial = (user.user?.email || 'A').charAt(0).toUpperCase()

  const renderRow = (c: Node, depth: number) => {
    const kids = childrenOf(c.id)
    return (
      <div key={c.id}>
        <div
          className={`v2-ctx-row ${depth > 0 ? 'child' : ''} ${selectedCtxId === c.id ? 'active' : ''}`}
          onClick={() => onSelectCtx(c.id)}
        >
          <span className="v2-ctx-dot" style={{ background: contextColor(c.id) }} />
          <span className="v2-el-title">{c.text || 'Sin título'}</span>
        </div>
        {kids.map(k => renderRow(k, depth + 1))}
      </div>
    )
  }

  return (
    <aside className="v2-col v2-sidebar">
      <div className="v2-sidebar-head">
        <span className="v2-brand">Fromly <span className="v2-brand-badge">2.0</span></span>
      </div>
      <button className="v2-newchat" onClick={onNewChat}>＋ Nueva conversación</button>

      <div className="v2-section-label">Contextos</div>
      <div className="v2-ctx-list">
        <div
          className={`v2-ctx-row ${selectedCtxId === null ? 'active' : ''}`}
          onClick={() => onSelectCtx(null)}
        >
          <span className="v2-ctx-dot" style={{ background: 'var(--text-tertiary)' }} />
          <span className="v2-el-title">General</span>
        </div>
        {roots.length === 0 && (
          <div className="v2-right-empty" style={{ padding: '16px 14px' }}>
            Aún no tienes contextos. Créalos en la v1 y aparecerán aquí.
          </div>
        )}
        {roots.map(r => renderRow(r, 0))}
      </div>

      <div className="v2-sidebar-foot">
        <div className="v2-userchip">
          <span className="v2-avatar">{initial}</span>
          <span className="v2-el-main">
            <span className="v2-el-title">{user.user?.email || 'Invitado'}</span>
            <span className="v2-el-meta">{user.planLabel}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
