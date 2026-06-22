// Menú contextual de las filas de la COLUMNA DERECHA (cockpit, capturas, movidos,
// eventos, áreas). Antes el clic derecho BORRABA la fila directamente (bug: pérdida
// de datos). Ahora abre este menú: Abrir · Convertir en tarea · Añadir contexto ·
// Eliminar. Se monta una sola vez en MainLayout y se abre por evento global
// `from:open-rowmenu` con { nodeId, x, y }.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import { trashNode } from '../../utils/papeleraHelper'
import { listContextsForParent, isContextClosed, firstContextOf, setNodeContext } from '../../utils/cajones'

export default function RightColMenu({ nodeId, x, y, onClose }: { nodeId: string; x: number; y: number; onClose: () => void }) {
  const navigate = useNavigate()
  const [ctxOpen, setCtxOpen] = useState(false)
  const node = store.getNode(nodeId)
  if (!node || node.deletedAt) return null
  const isTask = node.status != null && node.status !== undefined
  const isEvent = !!node.isEvent
  const contexts = listContextsForParent().filter(c => !isContextClosed(c))
  const current = firstContextOf(node)

  function convertTask() {
    if (isTask) {
      store.updateNode(nodeId, { status: null })
    } else {
      const today = new Date(); today.setHours(23, 59, 59, 0)
      store.updateNode(nodeId, { status: 'pending', due: today.toISOString() })
    }
    onClose()
  }
  function pickContext(ctx: ReturnType<typeof listContextsForParent>[number]) {
    // Un nodo = un contexto: si ya es el actual lo quita; si no, lo reemplaza.
    setNodeContext(nodeId, current?.id === ctx.id ? null : ctx.id)
  }

  return createPortal((
    <>
      <div onPointerDown={onClose} onContextMenu={e => { e.preventDefault(); onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
      <div className="node-ctx-menu" style={{ position: 'fixed', top: y, left: x, zIndex: 3000, maxHeight: '70vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <button className="node-ctx-item" onClick={() => { navigate(`/node/${nodeId}`); onClose() }}>↗ Abrir</button>
        {!isEvent && (
          <button className="node-ctx-item" onClick={convertTask}>
            {isTask ? '○ Quitar tarea' : '☑ Convertir en tarea'}
          </button>
        )}
        <button className="node-ctx-item" onClick={() => setCtxOpen(o => !o)}>
          🏷 {current ? 'Cambiar contexto' : 'Añadir contexto'} <span style={{ float: 'right', opacity: 0.6 }}>{ctxOpen ? '▾' : '▸'}</span>
        </button>
        {ctxOpen && (contexts.length === 0
          ? <div className="node-ctx-label">Sin contextos creados</div>
          : contexts.map(c => {
            const has = current?.id === c.id
            return (
              <button key={c.id} className={`node-ctx-item node-ctx-item--type ${has ? 'active' : ''}`} onClick={() => pickContext(c)}>
                {has ? '● ' : '○ '}{c.text || 'Contexto'}
              </button>
            )
          }))}
        {current && (
          <button className="node-ctx-item" onClick={() => { setNodeContext(nodeId, null); onClose() }}>
            ✕ Quitar contexto
          </button>
        )}
        <div className="node-ctx-sep" />
        <button className="node-ctx-item node-ctx-item--danger" onClick={() => { trashNode(nodeId); onClose() }}>🗑 Eliminar</button>
      </div>
    </>
  ), document.body)
}
