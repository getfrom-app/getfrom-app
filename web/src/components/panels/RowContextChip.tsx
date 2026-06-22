// Chip de CONTEXTO para las filas de la columna derecha (cockpit/capturas/movidos).
// Sistema único por _ctxRefs (un contexto por nodo). «?» si no tiene; el nombre si
// lo tiene. Al pulsar abre el ContextPicker (buscador + dots + grupos + teclado).
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { listContextsForParent, isContextClosed, firstContextOf, setNodeContext } from '../../utils/cajones'
import ContextPicker from './ContextPicker'
import type { Node } from '../../types'

export default function RowContextChip({ node }: { node: Node }) {
  const [menu, setMenu] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasContexts = listContextsForParent().filter(c => !isContextClosed(c)).length > 0
  const current = firstContextOf(node)

  useEffect(() => {
    if (!menu) return
    const h = (e: PointerEvent) => {
      const t = e.target as globalThis.Node
      if (ref.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setMenu(null)
    }
    window.addEventListener('pointerdown', h, true)
    return () => window.removeEventListener('pointerdown', h, true)
  }, [menu])

  // Si no hay contextos pero el nodo tampoco tiene → igual mostramos «?» para crear.
  void hasContexts

  const open = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const up = window.innerHeight - r.bottom < 320
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 250))
    setMenu(up ? { x, y: window.innerHeight - r.top + 4, up: true } : { x, y: r.bottom + 4, up: false })
  }

  return (
    <span className="dc-ctx-chip-wrap" ref={ref}>
      {current ? (
        <span className="dc-ctx-chip" title="Cambiar contexto" onClick={open}>{current.text}</span>
      ) : (
        <span className="dc-ctx-chip dc-ctx-chip--empty" title="Asignar contexto" onClick={open}>?</span>
      )}
      {menu && createPortal((
        <div ref={menuRef} className="ctx-pick" style={{ position: 'fixed', ...(menu.up ? { bottom: menu.y } : { top: menu.y }), left: menu.x, zIndex: 3000 }}
          onClick={e => e.stopPropagation()}>
          <ContextPicker currentId={current?.id ?? null} onPick={id => { setNodeContext(node.id, id); setMenu(null) }} />
        </div>
      ), document.body)}
    </span>
  )
}
