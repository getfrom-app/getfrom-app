// NoteColumn — columna derecha de una nota NORMAL (no diaria). Muestra el bloque
// «Movidos»: nodos que se han movido a esta nota y aún no se han colocado en el
// lienzo. Se arrastran al lienzo para colocarlos (al fijarlos, salen de aquí).

import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { renderInline } from '../outliner/InlineRenderer'
import { isMovedNode, nodeHasPin } from '../../utils/dayColumn'
import { trashNode } from '../../utils/papeleraHelper'
import { findTagNodeBySlug } from '../../utils/tagsHelper'
import { nodeCtxRefs, contextColor, contextParent } from '../../utils/cajones'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO } from '../../utils/dates'
import RowContextChip from './RowContextChip'

const BUILTIN_TYPES = new Set(['bucle','captura','agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec','nota','proyecto'])

/** Contextos a los que pertenece un nodo: por ID (_ctxRefs) y por slug @ en types[]. */
function nodeContexts(node: Node): Node[] {
  const out: Node[] = []
  const seen = new Set<string>()
  for (const id of nodeCtxRefs(node)) {
    const c = store.getNode(id); if (c && !c.deletedAt && !seen.has(c.id)) { seen.add(c.id); out.push(c) }
  }
  for (const slug of (node.types || [])) {
    if (BUILTIN_TYPES.has(slug)) continue
    const c = findTagNodeBySlug(slug); if (c && !c.deletedAt && !seen.has(c.id)) { seen.add(c.id); out.push(c) }
  }
  return out
}

const TrashIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
  </svg>
)

export default function NoteColumn({ node }: { node: Node }) {
  useStore()
  const navigate = useNavigate()

  // Movidos = hijos marcados `_moved` y aún sin colocar en el lienzo.
  const moved = store.children(node.id).filter(c => isMovedNode(c) && !nodeHasPin(c))
  const contexts = nodeContexts(node)
  const isTask = node.status !== null && node.status !== undefined && !node.isEvent

  // Propiedades de tarea (fecha / prioridad / repetición) editables aquí mismo.
  const dueDate = isoToLocalDate(node.due)
  const dueTime = isoToLocalTime(node.due)
  const setDue = (date: string, time: string) => { if (!date) store.updateNode(node.id, { due: null }); else store.updateNode(node.id, { due: makeDueISO(date, time) }) }
  const parseRec = (r: string) => { const [unit, nStr] = r.split(':'); return { n: parseInt(nStr || '1') || 1, unit } }
  const applyRec = (n: number, unit: string) => { const safe = Math.max(1, n); store.updateNode(node.id, { recurrence: safe === 1 ? unit : `${unit}:${safe}` }) }
  const recUnits: [string, string][] = [['daily', 'días'], ['weekly', 'sem.'], ['monthly', 'mes.'], ['yearly', 'año']]
  const qMon = (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })()
  const prioOpts: { v: Node['priority']; l: string; c: string }[] = [
    { v: null, l: '–', c: '' }, { v: 'low', l: 'Baja', c: '#6b7280' }, { v: 'medium', l: 'Media', c: '#f59e0b' }, { v: 'high', l: 'Alta', c: '#ef4444' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Propiedades de tarea — fecha, prioridad, repetición (editable). */}
      {isTask && (
        <div className="dc-group">
          <div className="rc-section-label" style={{ marginBottom: 6 }}>Fecha</div>
          <div className="nqp-quick-row">
            {[{ label: 'Hoy', days: 0 }, { label: 'Mañana', days: 1 }, { label: 'Lunes', days: qMon }, { label: '+7d', days: 7 }].map(({ label, days }) => {
              const d = new Date(); d.setDate(d.getDate() + days)
              const iso = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
              return <button key={label} className={`nqp-qbtn${dueDate === iso ? ' active' : ''}`} onClick={() => setDue(iso, hasLocalTime(node.due) ? dueTime : '')}>{label}</button>
            })}
            {node.due && <button className="nqp-qbtn nqp-clear" onClick={() => store.updateNode(node.id, { due: null })}>✕</button>}
          </div>
          <div className="nqp-inputs-row" style={{ marginTop: 6 }}>
            <input type="date" className="nqp-date-input" value={dueDate} onChange={e => setDue(e.target.value, hasLocalTime(node.due) ? dueTime : '')} />
            <input type="time" className="nqp-time-input" value={hasLocalTime(node.due) ? dueTime : ''} onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} placeholder="HH:MM" />
          </div>

          <div className="rc-section-label" style={{ marginTop: 12, marginBottom: 6 }}>Prioridad</div>
          <div className="nqp-chips-row">
            {prioOpts.map(opt => (
              <button key={String(opt.v)} className={`nqp-chip${node.priority === opt.v ? ' active' : ''}`}
                style={opt.c ? { color: opt.c, ...(node.priority === opt.v ? { borderColor: opt.c, background: opt.c + '20' } : {}) } : {}}
                onClick={() => store.updateNode(node.id, { priority: opt.v })}>{opt.l}</button>
            ))}
          </div>

          <div className="rc-section-label" style={{ marginTop: 12, marginBottom: 6 }}>Repetición</div>
          <div className="nqp-rec-row">
            <button className={`nqp-chip${!node.recurrence ? ' active' : ''}`} onClick={() => store.updateNode(node.id, { recurrence: null })}>–</button>
            <input type="number" className="nqp-rec-n" min={1} max={999} value={node.recurrence ? parseRec(node.recurrence).n : 1} disabled={!node.recurrence}
              onChange={e => { const n = Math.max(1, parseInt(e.target.value) || 1); applyRec(n, node.recurrence ? parseRec(node.recurrence).unit : 'daily') }} />
            {recUnits.map(([unit, label]) => (
              <button key={unit} className={`nqp-chip${!!node.recurrence && parseRec(node.recurrence).unit === unit ? ' active' : ''}`}
                onClick={() => applyRec(node.recurrence ? parseRec(node.recurrence).n : 1, unit)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Contextos a los que pertenece la nota — clic para navegar. */}
      {contexts.length > 0 && (
        <div className="dc-group">
          <div className="rc-section-label" style={{ marginBottom: 6 }}>Contextos</div>
          {contexts.map(c => {
            const color = contextColor(c.id)
            const parent = contextParent(c.id)
            return (
              <div key={c.id} className="dc-row" onClick={() => navigate(`/node/${c.id}`)}>
                <span className="dc-check" style={{ border: 'none', background: 'none', color }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 7.4V3a1 1 0 0 1 1-1h4.4a1 1 0 0 1 .7.3l6 6a1 1 0 0 1 0 1.4l-4.4 4.4a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1-.3-.7z"/><circle cx="5.2" cy="5.2" r="1"/>
                  </svg>
                </span>
                <span className="dc-text">{c.text || 'Contexto'}</span>
                {parent && <span className="dc-parent">{parent.text}</span>}
              </div>
            )
          })}
        </div>
      )}

    <div className="dc-group">
      <div className="rc-section-label" style={{ marginBottom: 6 }}>Movidos</div>
      {moved.length === 0 ? (
        <div style={{ padding: '4px 10px 8px', fontSize: 12, color: 'var(--text-tertiary, #aaa)' }}>
          Mueve nodos a esta nota y aparecerán aquí.
        </div>
      ) : moved.map(c => (
        <div
          key={c.id}
          className="dc-row dc-row--capture"
          data-node-id={c.id}
          draggable
          onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'copy' }}
          onClick={() => navigate(`/node/${c.id}`)}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: c.id, x: e.clientX, y: e.clientY } })) }}
          title="Arrastra al lienzo para colocarlo"
        >
          <span className="dc-capture-grip">⠿</span>
          <span className="dc-text">{c.text ? renderInline(c.text) : 'Nodo'}</span>
          <RowContextChip node={c} />
          <button className="dc-del" title="Eliminar" onClick={e => { e.stopPropagation(); trashNode(c.id) }}>{TrashIcon}</button>
        </div>
      ))}
    </div>
    </div>
  )
}
