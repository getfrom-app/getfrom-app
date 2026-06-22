// DayColumn — columna unificada de una nota diaria, de arriba a abajo:
//   1. Eventos de Google Calendar del día (sueltos, alineados a la izquierda)
//   2. Atrasadas · 3. Para hoy · 4. Bucles abiertos  (cockpit «bare», sin caja)
//   5. Nodos del día (outliner editable; excluye los eventos del bloque 1)
//
// Se reutiliza en el panel derecho «Día» (modo pizarra, sin el bloque de nodos
// porque viven en el lienzo) e inline en el centro (modo lista, con todo).
// Cada cabecera de bloque colapsa su contenido (clic). Persistente.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import Outliner from '../outliner/Outliner'
import DailyCockpit from '../views/DailyCockpit'
import { renderInline } from '../outliner/InlineRenderer'
import { pushEventTitleChanges, pushEventToGcal, deleteGcalEventForNode, getGcalColor } from '../../utils/gcalNodesSync'
import { trashNode } from '../../utils/papeleraHelper'
import { getDayColumnData } from '../../utils/dayColumn'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import RowContextChip from './RowContextChip'

// Icono de papelera (botón de eliminar al hover en cualquier fila de la columna).
const TrashIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
  </svg>
)

type OutlinerExtraProps = Omit<React.ComponentProps<typeof Outliner>, 'parentId' | 'excludeIds'>

// ── Badge de evento: hora + repetición ────────────────────────────────────────
const REC_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No se repite' },
  { value: 'daily:1', label: 'Cada día' },
  { value: 'weekly:1', label: 'Cada semana' },
  { value: 'monthly:1', label: 'Cada mes' },
  { value: 'yearly:1', label: 'Cada año' },
]
function hhmm(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function withTime(baseIso: string, hm: string): string {
  const d = new Date(baseIso)
  const [h, m] = hm.split(':').map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toISOString()
}
function isAllDay(n: Node): boolean {
  try { return JSON.parse(n.extraData || '{}')._gcalAllDay === '1' } catch { return false }
}
function recShort(rec?: string | null): string | null {
  if (!rec) return null
  const u = rec.split(':')[0]
  return ({ daily: 'cada día', weekly: 'cada semana', monthly: 'cada mes', yearly: 'cada año' } as Record<string, string>)[u] || 'repite'
}

export default function DayColumn({
  node,
  outlinerProps,
  includeNodes = true,
}: {
  node: Node
  outlinerProps?: OutlinerExtraProps
  includeNodes?: boolean
}) {
  useStore()
  const navigate = useNavigate()

  // Colapsado por bloque (cabecera clicable). Persistente.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('from_daycol_collapsed') || '[]')) } catch { return new Set() }
  })
  function toggle(k: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      localStorage.setItem('from_daycol_collapsed', JSON.stringify([...next]))
      return next
    })
  }
  const header = (k: string, label: string, cls = '') => (
    <button className={`dc-group-label dc-group-toggle ${cls}`} onClick={e => { e.stopPropagation(); toggle(k) }}>
      <span className="dc-group-chevron">{collapsed.has(k) ? '›' : '▾'}</span>{label}
    </button>
  )

  // Evento cuyo badge está en edición (popover hora/repetición).
  const [editEv, setEditEv] = useState<string | null>(null)
  const patchEvent = (id: string, updates: Partial<Node>) => {
    store.updateNode(id, updates)
    const fresh = store.getNode(id)
    if (fresh) pushEventToGcal(fresh) // empuja hora/repetición/título a Google
  }

  // Datos de la columna (eventos + capturas SIN duplicar con el cockpit) + ids a
  // excluir del bloque «Nodos» (todo lo que ya vive en la columna derecha).
  const raw = getDayColumnData(node)
  const { isToday, rightColumnIds } = raw
  const eventIds = rightColumnIds
  const eventNodes = raw.eventNodes
  const captureNodes = raw.captureNodes
  const dayTasks = raw.dayTasks
  const areaNodes = raw.areaNodes
  // Áreas: pulsar = la cámara del lienzo vuela a esa vista guardada.
  const flyToArea = (id: string) => window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))

  // Eliminar una fila de la columna (evento → también en Google; resto → Papelera).
  const deleteRow = (n: Node) => {
    deleteGcalEventForNode(n)
    trashNode(n.id)
  }
  const delBtn = (n: Node) => (
    <button className="dc-del" title="Eliminar" onClick={e => { e.stopPropagation(); deleteRow(n) }}>{TrashIcon}</button>
  )

  // Empujar a Google los títulos de eventos editados (debounce; anti-bucle dentro).
  const evSig = eventNodes.map(c => `${c.id}:${c.text}`).join('|')
  const titleTimer = useRef<number | null>(null)
  useEffect(() => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = window.setTimeout(() => { pushEventTitleChanges(node) }, 1400)
    return () => { if (titleTimer.current) clearTimeout(titleTimer.current) }
  }, [evSig, node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* 1. Eventos de Google Calendar del día */}
      {eventNodes.length > 0 && (
        <div className="dc-group">
          {header('eventos', isToday ? 'Eventos de hoy' : 'Eventos del día', 'dc-group-label--event')}
          {!collapsed.has('eventos') && eventNodes.map(ev => {
            const color = getGcalColor(ev)
            const allDay = isAllDay(ev)
            const rec = recShort(ev.recurrence)
            const timeLabel = allDay ? 'Todo el día' : (ev.due ? `${hhmm(ev.due)}–${hhmm(ev.dueEnd)}` : '')
            return (
              <div key={ev.id}>
                <div className="dc-row dc-row--event" data-node-id={ev.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('nodeId', ev.id); e.dataTransfer.effectAllowed = 'copy' }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: ev.id, x: e.clientX, y: e.clientY } })) }}>
                  <span className="dc-event-dot" style={color ? { background: color } : undefined} />
                  <span className="dc-text" onClick={() => navigate(`/node/${ev.id}`)} style={{ cursor: 'pointer' }}>
                    {ev.text ? renderInline(ev.text) : 'Evento'}
                  </span>
                  <button
                    className="dc-ev-badge"
                    onClick={e => { e.stopPropagation(); setEditEv(id => id === ev.id ? null : ev.id) }}
                    title="Editar hora y repetición"
                  >
                    {timeLabel}{rec && <span className="dc-ev-rec">🔁 {rec}</span>}
                  </button>
                  {delBtn(ev)}
                </div>
                {editEv === ev.id && !allDay && ev.due && (
                  <div className="dc-ev-edit" onClick={e => e.stopPropagation()}>
                    <label>Inicio
                      <input type="time" defaultValue={hhmm(ev.due)}
                        onChange={e => e.target.value && patchEvent(ev.id, { due: withTime(ev.due!, e.target.value) })} />
                    </label>
                    <label>Fin
                      <input type="time" defaultValue={hhmm(ev.dueEnd || ev.due)}
                        onChange={e => e.target.value && patchEvent(ev.id, { dueEnd: withTime(ev.dueEnd || ev.due!, e.target.value) })} />
                    </label>
                    <label>Repetición
                      <select defaultValue={ev.recurrence || ''}
                        onChange={e => patchEvent(ev.id, { recurrence: e.target.value || null })}>
                        {REC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 2-4. HOY → cockpit (Atrasadas · Para hoy · Bucles). */}
      {isToday && <DailyCockpit bare disablePlanner />}

      {/* Otros días → tareas con due en ESE día. */}
      {!isToday && dayTasks.length > 0 && (
        <div className="dc-group">
          {header('tareas', 'Tareas del día')}
          {!collapsed.has('tareas') && dayTasks.map(t => (
            <div key={t.id} className={`dc-row ${t.status === 'done' ? 'dc-row--done' : ''}`} data-node-id={t.id}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: t.id, x: e.clientX, y: e.clientY } })) }}>
              <button className={`dc-check ${t.status === 'done' ? 'dc-check--done' : ''}`}
                onClick={e => { e.stopPropagation(); toggleTaskDone(t) }} title="Completar" aria-label="Completar">
                {t.status === 'done' ? '✓' : ''}
              </button>
              <span className="dc-text" onClick={() => navigate(`/node/${t.id}`)} style={{ cursor: 'pointer' }}>
                {t.text ? renderInline(t.text) : 'Tarea'}
              </span>
              {hhmm(t.due) !== '00:00' && t.due && <span className="dc-time">{hhmm(t.due)}</span>}
              <RowContextChip node={t} />
              {delBtn(t)}
            </div>
          ))}
        </div>
      )}

      {/* Áreas — vistas guardadas del lienzo. Pulsa para volar a esa vista. */}
      {areaNodes.length > 0 && (
        <div className="dc-group">
          {header('areas', 'Áreas')}
          {!collapsed.has('areas') && areaNodes.map(a => (
            <div key={a.id} className="dc-row" data-node-id={a.id}
              onClick={() => flyToArea(a.id)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: a.id, x: e.clientX, y: e.clientY } })) }}
              title="Ir a esta vista del lienzo" style={{ cursor: 'pointer' }}>
              <span className="dc-event-dot" style={{ background: 'var(--accent,#6c5ce7)' }} />
              <span className="dc-text">{a.text ? renderInline(a.text) : 'Área'}</span>
              {delBtn(a)}
            </div>
          ))}
        </div>
      )}

      {/* 5. Nodos del día (sin los eventos, que ya van arriba). En pizarra NO se
             monta aquí: los nodos viven en el lienzo (includeNodes=false). */}
      {includeNodes && (
        <div className="dc-group">
          {header('nodos', 'Nodos')}
          {!collapsed.has('nodos') && (
            <Outliner parentId={node.id} excludeIds={eventIds} {...outlinerProps} />
          )}
        </div>
      )}

      {/* 6. Capturas — bandeja de entrada (fondo). Arrástralas al lienzo para colocarlas. */}
      {captureNodes.length > 0 && (
        <div className="dc-group">
          {header('capturas', 'Capturas')}
          {!collapsed.has('capturas') && captureNodes.map(c => (
            <div
              key={c.id}
              className="dc-row dc-row--capture"
              data-node-id={c.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'copy' }}
              onClick={() => navigate(`/node/${c.id}`)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: c.id, x: e.clientX, y: e.clientY } })) }}
              title="Arrastra al lienzo para colocarla"
            >
              <span className="dc-capture-grip">⠿</span>
              <span className="dc-text">{c.text ? renderInline(c.text) : 'Captura'}</span>
              <RowContextChip node={c} />
              {delBtn(c)}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
