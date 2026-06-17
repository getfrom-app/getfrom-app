// Chip de CONTEXTO para las filas de la columna derecha (cockpit/capturas/movidos).
// Si el nodo tiene contexto → lo muestra; si no → un «?» sutil. Al pulsar abre una
// lista de contextos para asignar/quitar (toggle). Mismo flujo que «Añadir contexto»
// del menú, pero inline en cada fila.
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import { listContexts, nodeInContext } from '../../utils/contextLens'
import type { Node } from '../../types'

export default function RowContextChip({ node }: { node: Node }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const contexts = listContexts()

  useEffect(() => {
    if (!menu) return
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setMenu(null) }
    window.addEventListener('pointerdown', h, true)
    return () => window.removeEventListener('pointerdown', h, true)
  }, [menu])

  if (contexts.length === 0) return null
  const assigned = contexts.filter(c => nodeInContext(node, c))

  function toggle(ctx: Node) {
    const name = (ctx.text || '').trim()
    if (!name) return
    const types = node.types || []
    const has = nodeInContext(node, ctx)
    const next = has ? types.filter(t => t.toLowerCase() !== name.toLowerCase()) : [...types, name]
    store.updateNode(node.id, { types: next })
    try {
      const ed = JSON.parse(node.extraData || '{}')
      ed._contextManuallySet = '1'; delete ed._autoContextId; delete ed._autoContextConfidence
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch { /* ignore */ }
  }

  const open = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 3 })
  }

  return (
    <span className="dc-ctx-chip-wrap" ref={ref}>
      {assigned.length > 0 ? (
        <span className="dc-ctx-chip" title="Cambiar contexto" onClick={open}>
          {assigned[0].text}{assigned.length > 1 ? ` +${assigned.length - 1}` : ''}
        </span>
      ) : (
        <span className="dc-ctx-chip dc-ctx-chip--empty" title="Asignar contexto" onClick={open}>?</span>
      )}
      {menu && createPortal((
        <div className="node-ctx-menu" style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 3000, maxHeight: '60vh', overflowY: 'auto', minWidth: 170 }}
          onClick={e => e.stopPropagation()}>
          <div className="node-ctx-label">Contexto</div>
          {contexts.map(c => {
            const has = nodeInContext(node, c)
            return (
              <button key={c.id} className={`node-ctx-item node-ctx-item--type ${has ? 'active' : ''}`}
                onClick={() => toggle(c)}>{has ? '● ' : '○ '}{c.text || 'Contexto'}</button>
            )
          })}
        </div>
      ), document.body)}
    </span>
  )
}
