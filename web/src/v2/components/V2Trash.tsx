// Papelera de Fromly 2.0 — lista los nodos eliminados (hijos del nodo 🗑 Papelera) y
// permite RESTAURARLOS (vuelven a su sitio) o vaciar la papelera. Reutiliza los
// helpers reales de v1 (papeleraHelper): borrado suave y reversible.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { store, useStore } from '../../store/nodeStore'
import { getPapeleraNode, restoreNode, emptyTrash } from '../../utils/papeleraHelper'

export default function V2Trash({ onClose }: { onClose: () => void }) {
  useStore()
  const [, force] = useState(0)
  const papelera = getPapeleraNode()
  const items = papelera ? store.children(papelera.id).filter(n => !n.deletedAt) : []

  const restore = (id: string) => { restoreNode(id); force(x => x + 1) }
  const empty = () => {
    if (!items.length) return
    if (window.confirm(`¿Vaciar la papelera? Se eliminarán definitivamente ${items.length} elemento(s). No se puede deshacer.`)) {
      emptyTrash(); force(x => x + 1)
    }
  }

  const title = (t: string) => (t || 'Sin título').replace(/^[✦💬]\s*/u, '')

  return createPortal((
    <div className="v2-modal-overlay" onMouseDown={onClose}>
      <div className="v2-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="v2-modal-head">
          <span className="v2-modal-title">Papelera</span>
          <button className="v2-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="v2-modal-body">
          {items.length === 0 ? (
            <div className="v2-right-empty" style={{ padding: '30px 12px' }}>La papelera está vacía.</div>
          ) : (
            items.map(n => (
              <div className="v2-el-row" key={n.id} style={{ cursor: 'default' }}>
                <span className="v2-el-icon">🗑</span>
                <span className="v2-el-main"><span className="v2-el-title">{title(n.text)}</span></span>
                <button className="v2-trash-restore" onClick={() => restore(n.id)}>Restaurar</button>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="v2-modal-foot">
            <button className="v2-trash-empty" onClick={empty}>Vaciar papelera ({items.length})</button>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}
