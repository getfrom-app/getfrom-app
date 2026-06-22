// Chip de CONTEXTO para las filas de la columna derecha (cockpit/capturas/movidos).
// Sistema único por _ctxRefs (un contexto por nodo). «?» si no tiene; el nombre si
// lo tiene. Al pulsar abre un menú con buscador, dots de color, agrupado por contexto
// padre y navegable con flechas + Enter (escala a cientos de contextos).
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { listContextsForParent, isContextClosed, firstContextOf, setNodeContext, createContext, contextColor, contextParent } from '../../utils/cajones'
import type { Node } from '../../types'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function RowContextChip({ node }: { node: Node }) {
  const [menu, setMenu] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const contexts = listContextsForParent().filter(c => !isContextClosed(c))
  const current = firstContextOf(node)

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

  const nq = norm(q.trim())
  const filtered = useMemo(() => nq ? contexts.filter(c => norm(c.text || '').includes(nq)) : contexts, [nq, contexts])
  const exact = nq ? contexts.some(c => norm(c.text || '') === nq) : false
  const canCreate = !!q.trim() && !exact

  // Agrupar por contexto padre (las áreas raíz, sin padre, en el grupo «·»).
  const groups = useMemo(() => {
    const m = new Map<string, Node[]>()
    for (const c of filtered) {
      const key = contextParent(c.id)?.text || ''
      const arr = m.get(key); if (arr) arr.push(c); else m.set(key, [c])
    }
    // Grupo sin padre primero.
    return [...m.entries()].sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0])))
  }, [filtered])

  // Lista plana (en el orden renderizado) para la navegación con flechas.
  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups])
  const total = flat.length + (canCreate ? 1 : 0)
  useEffect(() => { setActiveIdx(0) }, [nq])

  function pick(ctx: Node) {
    setNodeContext(node.id, current?.id === ctx.id ? null : ctx.id)
    setMenu(null); setQ('')
  }
  function createAndPick() {
    const name = q.trim(); if (!name) return
    setNodeContext(node.id, createContext(name).id)
    setMenu(null); setQ('')
  }
  function confirmActive() {
    if (activeIdx < flat.length) pick(flat[activeIdx])
    else if (canCreate) createAndPick()
  }

  const open = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setQ(''); setActiveIdx(0)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const up = window.innerHeight - r.bottom < 320
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 250))
    setMenu(up ? { x, y: window.innerHeight - r.top + 4, up: true } : { x, y: r.bottom + 4, up: false })
  }

  let runningIdx = -1  // índice global mientras se renderiza, para casar con activeIdx

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
          <input
            ref={inputRef}
            className="ctx-pick-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, Math.max(0, total - 1))) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); confirmActive() }
              else if (e.key === 'Escape') { e.preventDefault(); setMenu(null); setQ('') }
            }}
            placeholder="Buscar o crear contexto…"
          />
          <div className="ctx-pick-list">
            {groups.map(([parentName, items]) => (
              <div key={parentName || '·'}>
                {parentName && <div className="ctx-pick-group">{parentName}</div>}
                {items.map(c => {
                  runningIdx++
                  const idx = runningIdx
                  const active = idx === activeIdx
                  const isCur = current?.id === c.id
                  return (
                    <button key={c.id} className={`ctx-pick-item${active ? ' active' : ''}`}
                      onMouseEnter={() => setActiveIdx(idx)} onClick={() => pick(c)}>
                      <span className="ctx-pick-dot" style={{ background: contextColor(c.id) }} />
                      <span className="ctx-pick-name">{c.text || 'Contexto'}</span>
                      {isCur && <span className="ctx-pick-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            ))}
            {canCreate && (() => {
              runningIdx++
              const idx = runningIdx
              return (
                <button className={`ctx-pick-item ctx-pick-create${idx === activeIdx ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIdx(idx)} onClick={createAndPick}>
                  <span className="ctx-pick-dot ctx-pick-dot--new">+</span>
                  <span className="ctx-pick-name">Crear «{q.trim()}»</span>
                </button>
              )
            })()}
            {flat.length === 0 && !canCreate && <div className="ctx-pick-empty">Escribe para buscar o crear</div>}
          </div>
        </div>
      ), document.body)}
    </span>
  )
}
