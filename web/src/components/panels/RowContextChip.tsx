// Chip de CONTEXTO para las filas de la columna derecha (cockpit/capturas/movidos).
// Sistema único por _ctxRefs (un contexto por nodo). Si el nodo tiene contexto → lo
// muestra; si no → un «?» sutil. Al pulsar abre la lista para asignar/cambiar/quitar.
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { listContextsForParent, isContextClosed, firstContextOf, setNodeContext } from '../../utils/cajones'
import type { Node } from '../../types'

export default function RowContextChip({ node }: { node: Node }) {
  const [menu, setMenu] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const contexts = listContextsForParent().filter(c => !isContextClosed(c))

  useEffect(() => {
    if (!menu) return
    // El menú va en un PORTAL a document.body → NO está dentro de `ref`. Hay que
    // comprobar también `menuRef`, o el pointerdown lo cierra antes del onClick.
    const h = (e: PointerEvent) => {
      const t = e.target as globalThis.Node
      if (ref.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setMenu(null)
    }
    window.addEventListener('pointerdown', h, true)
    return () => window.removeEventListener('pointerdown', h, true)
  }, [menu])

  if (contexts.length === 0) return null
  const current = firstContextOf(node)

  function pick(ctx: Node) {
    // Un nodo = un contexto: si ya es el actual, lo quita; si no, lo reemplaza.
    setNodeContext(node.id, current?.id === ctx.id ? null : ctx.id)
    setMenu(null)
  }

  const open = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Si no cabe debajo (fila baja de la columna), abrir hacia ARRIBA.
    const spaceBelow = window.innerHeight - r.bottom
    const up = spaceBelow < 260
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 190))
    setMenu(up ? { x, y: window.innerHeight - r.top + 3, up: true } : { x, y: r.bottom + 3, up: false })
  }

  return (
    <span className="dc-ctx-chip-wrap" ref={ref}>
      {current ? (
        <span className="dc-ctx-chip" title="Cambiar contexto" onClick={open}>{current.text}</span>
      ) : (
        <span className="dc-ctx-chip dc-ctx-chip--empty" title="Asignar contexto" onClick={open}>?</span>
      )}
      {menu && createPortal((
        <div ref={menuRef} className="node-ctx-menu" style={{ position: 'fixed', ...(menu.up ? { bottom: menu.y } : { top: menu.y }), left: menu.x, zIndex: 3000, maxHeight: '60vh', overflowY: 'auto', minWidth: 170 }}
          onClick={e => e.stopPropagation()}>
          <div className="node-ctx-label">Contexto</div>
          {contexts.map(c => {
            const has = current?.id === c.id
            return (
              <button key={c.id} className={`node-ctx-item node-ctx-item--type ${has ? 'active' : ''}`}
                onClick={() => pick(c)}>{has ? '● ' : '○ '}{c.text || 'Contexto'}</button>
            )
          })}
        </div>
      ), document.body)}
    </span>
  )
}
