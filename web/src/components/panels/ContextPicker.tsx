// ContextPicker — selector de contexto reutilizable: buscador + dots de color +
// agrupado por contexto padre + navegación con flechas/Enter + «Crear «x»».
// Lo usan RowContextChip (chip «?») y RightColMenu (clic derecho). Renderiza el
// input + la lista; el contenedor (chrome/posición) lo pone el llamante.
import { useState, useRef, useEffect, useMemo } from 'react'
import { listContextsForParent, isContextClosed, createContext, contextColor, contextParent } from '../../utils/cajones'
import type { Node } from '../../types'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ContextPicker({ currentId, onPick, autoFocus = true }: {
  currentId: string | null
  /** id del contexto elegido/creado, o null para QUITAR (al pulsar el actual). */
  onPick: (id: string | null) => void
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const contexts = listContextsForParent().filter(c => !isContextClosed(c))

  useEffect(() => { if (autoFocus) setTimeout(() => inputRef.current?.focus(), 20) }, [autoFocus])

  const nq = norm(q.trim())
  const filtered = useMemo(() => nq ? contexts.filter(c => norm(c.text || '').includes(nq)) : contexts, [nq, contexts])
  const exact = nq ? contexts.some(c => norm(c.text || '') === nq) : false
  const canCreate = !!q.trim() && !exact

  const groups = useMemo(() => {
    const m = new Map<string, Node[]>()
    for (const c of filtered) {
      const key = contextParent(c.id)?.text || ''
      const arr = m.get(key); if (arr) arr.push(c); else m.set(key, [c])
    }
    return [...m.entries()].sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0])))
  }, [filtered])

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups])
  const total = flat.length + (canCreate ? 1 : 0)
  useEffect(() => { setActiveIdx(0) }, [nq])

  function pick(ctx: Node) { onPick(currentId === ctx.id ? null : ctx.id) }
  function createAndPick() { const name = q.trim(); if (name) onPick(createContext(name).id) }
  function confirmActive() {
    if (activeIdx < flat.length) pick(flat[activeIdx])
    else if (canCreate) createAndPick()
  }

  let runningIdx = -1
  return (
    <>
      <input
        ref={inputRef}
        className="ctx-pick-search"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, Math.max(0, total - 1))) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); confirmActive() }
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
              return (
                <button key={c.id} className={`ctx-pick-item${idx === activeIdx ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIdx(idx)} onClick={() => pick(c)}>
                  <span className="ctx-pick-dot" style={{ background: contextColor(c.id) }} />
                  <span className="ctx-pick-name">{c.text || 'Contexto'}</span>
                  {currentId === c.id && <span className="ctx-pick-check">✓</span>}
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
    </>
  )
}
