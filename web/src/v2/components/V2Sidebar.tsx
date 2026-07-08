// Sidebar de Fromly 2.0 — contextos (= proyectos) con navegación drill-down.
// Nivel raíz = ÁREAS (hijos directos de 🧠 Contexto) + General. Clic en un
// contexto: lo selecciona (la app reacciona) Y hace zoom-in a sus subcontextos
// en la misma columna, con botón de volver.
import { useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { isRootContext, isMarkedContext, isContextClosed, contextColor } from '../../utils/cajones'
import type { Node } from '../../types'

interface Props {
  selectedCtxId: string | null
  onSelectCtx: (id: string | null) => void
  onNewChat: () => void
  onNewChatInCtx: (id: string) => void
}

// Ordena por nombre (ignorando emoji/espacios iniciales), estable.
function byName(a: Node, b: Node) {
  const clean = (s: string) => (s || '').replace(/^[^\p{L}\p{N}]+/u, '').toLocaleLowerCase('es')
  return clean(a.text).localeCompare(clean(b.text), 'es')
}

// Subcontextos (proyectos marcados) directos de un contexto.
function subContextsOf(id: string): Node[] {
  // Excluye archivados (_closed): salen del árbol pero siguen buscables + en el RAG.
  return store.children(id).filter(n => !n.deletedAt && isMarkedContext(n) && !isContextClosed(n)).sort(byName)
}

export default function V2Sidebar({ selectedCtxId, onSelectCtx, onNewChat, onNewChatInCtx }: Props) {
  useStore()
  const user = useUserStore()
  const [stack, setStack] = useState<Node[]>([]) // ruta de drill-down (padres)

  const currentParent = stack.length ? stack[stack.length - 1] : null

  // Nivel raíz = ÁREAS (hijos directos de 🧠 Contexto, sin el Perfil 🧠…).
  const areas: Node[] = store.allActive()
    .filter(n => isRootContext(n.id) && !(n.text || '').startsWith('🧠'))
    .sort(byName)

  const items: Node[] = currentParent ? subContextsOf(currentParent.id) : areas

  const initial = (user.user?.email || 'A').charAt(0).toUpperCase()

  const enter = (c: Node) => {
    onSelectCtx(c.id)
    if (subContextsOf(c.id).length > 0) setStack(prev => [...prev, c]) // zoom-in solo si tiene subcontextos
  }
  const back = () => setStack(prev => prev.slice(0, -1))

  return (
    <aside className="v2-col v2-sidebar">
      <div className="v2-sidebar-head">
        <span className="v2-brand">Fromly <span className="v2-brand-badge">2.0</span></span>
      </div>
      <button className="v2-newchat" onClick={onNewChat}>＋ Nueva conversación</button>

      {/* Cabecera de nivel: raíz = «Contextos»; dentro = volver + nombre del contexto */}
      {currentParent ? (
        <div className="v2-section-label" style={{ cursor: 'pointer' }} onClick={back}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>‹</span> Volver
          </span>
        </div>
      ) : (
        <div className="v2-section-label">Contextos</div>
      )}

      <div className="v2-ctx-list">
        {currentParent ? (
          // Contexto en el que hemos entrado (seleccionable, resaltado como cabecera).
          <div
            className={`v2-ctx-row ${selectedCtxId === currentParent.id ? 'active' : ''}`}
            onClick={() => onSelectCtx(currentParent.id)}
          >
            <span className="v2-ctx-dot" style={{ background: contextColor(currentParent.id) }} />
            <span className="v2-el-title" style={{ fontWeight: 600 }}>{currentParent.text || 'Contexto'}</span>
            <button
              className="v2-ctx-add"
              title="Nueva conversación en este contexto"
              onClick={(e) => { e.stopPropagation(); onNewChatInCtx(currentParent.id) }}
            >＋</button>
          </div>
        ) : (
          <div
            className={`v2-ctx-row ${selectedCtxId === null ? 'active' : ''}`}
            onClick={() => onSelectCtx(null)}
          >
            <span className="v2-ctx-dot" style={{ background: 'var(--text-tertiary)' }} />
            <span className="v2-el-title">General</span>
          </div>
        )}

        {currentParent && <div className="v2-section-label" style={{ padding: '10px 16px 4px' }}>Subcontextos</div>}

        {items.map(c => {
          const hasSubs = subContextsOf(c.id).length > 0
          return (
            <div
              key={c.id}
              className={`v2-ctx-row ${currentParent ? 'child' : ''} ${selectedCtxId === c.id ? 'active' : ''}`}
              onClick={() => enter(c)}
            >
              <span className="v2-ctx-dot" style={{ background: contextColor(c.id) }} />
              <span className="v2-el-title">{c.text || 'Sin título'}</span>
              <button
                className="v2-ctx-add"
                title="Nueva conversación en este contexto"
                onClick={(e) => { e.stopPropagation(); onNewChatInCtx(c.id) }}
              >＋</button>
              {hasSubs && <span className="v2-ctx-count">›</span>}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="v2-right-empty" style={{ padding: '16px 14px' }}>
            {currentParent ? 'Sin subcontextos.' : 'Aún no tienes contextos. Créalos en la v1 y aparecerán aquí.'}
          </div>
        )}
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
