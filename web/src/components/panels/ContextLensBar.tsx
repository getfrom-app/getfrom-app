// Barra de la LENTE DE CONTEXTO: selector compacto para filtrar por contexto.
// De momento se monta en la columna del día (DayColumn); el estado es global
// (contextLensStore) para extenderlo luego al resto de la app.
import { useState, useRef, useEffect } from 'react'
import { store } from '../../store/nodeStore'
import { listContexts } from '../../utils/contextLens'
import { useLensContextId, setLensContextId } from '../../store/contextLensStore'

export default function ContextLensBar({ inline = false }: { inline?: boolean } = {}) {
  const activeId = useLensContextId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const contexts = listContexts()

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [open])

  if (contexts.length === 0) return null
  const active = activeId ? store.getNode(activeId) : null
  const activeLabel = active && !active.deletedAt ? (active.text || 'Contexto') : null

  return (
    <div className={`ctx-lens${inline ? ' ctx-lens--inline' : ''}`} ref={ref}>
      <button
        className={`ctx-lens-pill${activeLabel ? ' ctx-lens-pill--on' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Filtrar por contexto"
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 4h14l-5 6v5l-4 2v-7z" />
        </svg>
        <span className="ctx-lens-name">{activeLabel || 'Todos los contextos'}</span>
        {activeLabel
          ? <span className="ctx-lens-clear" title="Quitar filtro" onClick={e => { e.stopPropagation(); setLensContextId(null) }}>✕</span>
          : <span className="ctx-lens-caret">▾</span>}
      </button>

      {open && (
        <div className="ctx-lens-menu">
          <button className={`ctx-lens-item${!activeId ? ' active' : ''}`} onClick={() => { setLensContextId(null); setOpen(false) }}>
            Todos los contextos
          </button>
          <div className="ctx-lens-sep" />
          {contexts.map(c => (
            <button key={c.id} className={`ctx-lens-item${activeId === c.id ? ' active' : ''}`}
              onClick={() => { setLensContextId(c.id); setOpen(false) }}>
              {c.text || 'Contexto'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
