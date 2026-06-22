// Chip de CONTEXTO para las filas de la columna derecha (cockpit/capturas/movidos).
// Sistema único por _ctxRefs (un contexto por nodo). Si el nodo tiene contexto → lo
// muestra; si no → un «?» sutil. Al pulsar abre un menú con BUSCADOR para asignar /
// cambiar / crear (preparado para decenas o cientos de contextos).
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { listContextsForParent, isContextClosed, firstContextOf, setNodeContext, createContext } from '../../utils/cajones'
import type { Node } from '../../types'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function RowContextChip({ node }: { node: Node }) {
  const [menu, setMenu] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const contexts = listContextsForParent().filter(c => !isContextClosed(c))

  useEffect(() => {
    if (!menu) return
    setTimeout(() => inputRef.current?.focus(), 20)
    const h = (e: PointerEvent) => {
      const t = e.target as globalThis.Node
      if (ref.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setMenu(null)
    }
    window.addEventListener('pointerdown', h, true)
    return () => window.removeEventListener('pointerdown', h, true)
  }, [menu])

  if (contexts.length === 0 && !menu) {
    // Sin contextos creados: aún así permitir crear uno desde el «?».
  }
  const current = firstContextOf(node)

  const nq = norm(q.trim())
  const filtered = nq ? contexts.filter(c => norm(c.text || '').includes(nq)) : contexts
  const exact = nq ? contexts.some(c => norm(c.text || '') === nq) : false

  function pick(ctx: Node) {
    setNodeContext(node.id, current?.id === ctx.id ? null : ctx.id)
    setMenu(null); setQ('')
  }
  function createAndPick() {
    const name = q.trim()
    if (!name) return
    setNodeContext(node.id, createContext(name).id)
    setMenu(null); setQ('')
  }

  const open = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setQ('')
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const up = spaceBelow < 300
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 220))
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
        <div ref={menuRef} className="node-ctx-menu" style={{ position: 'fixed', ...(menu.up ? { bottom: menu.y } : { top: menu.y }), left: menu.x, zIndex: 3000, display: 'flex', flexDirection: 'column', maxHeight: '60vh', minWidth: 200 }}
          onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); if (filtered.length > 0) pick(filtered[0]); else if (q.trim()) createAndPick() }
              else if (e.key === 'Escape') { e.preventDefault(); setMenu(null); setQ('') }
            }}
            placeholder="Buscar o crear contexto…"
            style={{ margin: 6, padding: '6px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ overflowY: 'auto', minHeight: 0 }}>
            {filtered.map(c => {
              const has = current?.id === c.id
              return (
                <button key={c.id} className={`node-ctx-item node-ctx-item--type ${has ? 'active' : ''}`}
                  onClick={() => pick(c)}>{has ? '● ' : '○ '}{c.text || 'Contexto'}</button>
              )
            })}
            {q.trim() && !exact && (
              <button className="node-ctx-item" onClick={createAndPick}>+ Crear «{q.trim()}»</button>
            )}
            {filtered.length === 0 && !q.trim() && (
              <div className="node-ctx-label">Escribe para buscar o crear</div>
            )}
          </div>
        </div>
      ), document.body)}
    </span>
  )
}
