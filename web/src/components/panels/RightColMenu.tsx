// Menú contextual de las filas de la COLUMNA DERECHA (cockpit, capturas, movidos,
// eventos, áreas). Antes el clic derecho BORRABA la fila directamente (bug: pérdida
// de datos). Ahora abre este menú: Abrir · Convertir en tarea · Añadir contexto ·
// Eliminar. Se monta una sola vez en MainLayout y se abre por evento global
// `from:open-rowmenu` con { nodeId, x, y }.
import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { trashNode } from '../../utils/papeleraHelper'
import { firstContextOf, setNodeContext, convertToContext, convertToTask, isContextNode } from '../../utils/cajones'
import ContextPicker from './ContextPicker'

export default function RightColMenu({ nodeId, x, y, onClose }: { nodeId: string; x: number; y: number; onClose: () => void }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const ctxBtnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: y, left: x })
  // Flyout SEPARADO del selector de contexto (no inline, para no confundir).
  const [ctxFlyout, setCtxFlyout] = useState<{ top: number; left: number } | null>(null)
  // Reposiciona el menú dentro del viewport.
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    let top = y, left = x
    if (y + r.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - r.height - 8)
    if (x + r.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - r.width - 8)
    setPos(p => (p.top === top && p.left === left) ? p : { top, left })
  }, [x, y])

  function toggleCtxFlyout() {
    if (ctxFlyout) { setCtxFlyout(null); return }
    const box = boxRef.current?.getBoundingClientRect()
    const btn = ctxBtnRef.current?.getBoundingClientRect()
    if (!box || !btn) return
    const W = 244, H = 360
    let left = box.left - W - 4
    if (left < 8) left = box.right + 4
    if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8)
    let top = btn.top
    if (top + H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - H - 8)
    setCtxFlyout({ top, left })
  }

  const node = store.getNode(nodeId)
  if (!node || node.deletedAt) return null
  const isTask = node.status != null && node.status !== undefined
  const isEvent = !!node.isEvent
  const current = firstContextOf(node)

  function convertTask() {
    if (isTask) {
      store.updateNode(nodeId, { status: null })
    } else if (isContextNode(nodeId)) {
      // Un contexto → tarea: limpia marcas de contexto y lo asigna a su contexto padre.
      convertToTask(nodeId)
    } else {
      const today = new Date(); today.setHours(23, 59, 59, 0)
      store.updateNode(nodeId, { status: 'pending', due: today.toISOString() })
    }
    onClose()
  }

  return createPortal((
    <>
      <div onPointerDown={onClose} onContextMenu={e => { e.preventDefault(); onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
      <div ref={boxRef} className="node-ctx-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 3000, maxHeight: '70vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <button className="node-ctx-item" onClick={() => { navigate(`/node/${nodeId}`); onClose() }}>{t('rightColMenu.open')}</button>
        {!isEvent && (
          <button className="node-ctx-item" onClick={convertTask}>
            {isTask ? t('rightColMenu.removeTask') : t('rightColMenu.convertToTask')}
          </button>
        )}
        {!isEvent && !isContextNode(nodeId) && (
          <button className="node-ctx-item" onClick={() => {
            if (convertToContext(nodeId)) {
              window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `🧠 Convertido en contexto: "${(node!.text || '').slice(0, 30)}"`, type: 'success' } }))
            }
            onClose()
          }}>{t('rightColMenu.convertToContext')}</button>
        )}
        <button ref={ctxBtnRef} className="node-ctx-item" onClick={toggleCtxFlyout}>
          {current ? t('rightColMenu.changeContext') : t('rightColMenu.addContext')} <span style={{ float: 'right', opacity: 0.6 }}>›</span>
        </button>
        {current && (
          <button className="node-ctx-item" onClick={() => { setNodeContext(nodeId, null); onClose() }}>
            {t('rightColMenu.removeContext')}
          </button>
        )}
        <div className="node-ctx-sep" />
        <button className="node-ctx-item node-ctx-item--danger" onClick={() => {
          // Si es un ÁREA (contenedor), sus hijos vuelven a la nota antes de borrar: no se pierden.
          const isArea = JSON.parse(node.extraData || '{}')._area === '1'
          if (isArea) for (const ch of store.children(nodeId)) if (!ch.deletedAt) store.updateNode(ch.id, { parentId: node.parentId })
          trashNode(nodeId); onClose()
        }}>{t('rightColMenu.delete')}</button>
      </div>
      {ctxFlyout && (
        <div className="ctx-pick" style={{ position: 'fixed', top: ctxFlyout.top, left: ctxFlyout.left, zIndex: 3001 }}
          onClick={e => e.stopPropagation()}>
          <ContextPicker currentId={current?.id ?? null} onPick={id => { setNodeContext(nodeId, id); onClose() }} />
        </div>
      )}
    </>
  ), document.body)
}
