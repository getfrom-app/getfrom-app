// DayColumn — columna unificada de una nota diaria, de arriba a abajo:
//   1. Eventos de Google Calendar del día (sueltos, alineados a la izquierda)
//   2. Atrasadas · 3. Para hoy · 4. Bucles abiertos  (cockpit «bare», sin caja)
//   5. Nodos del día (outliner editable; excluye los eventos del bloque 1)
//
// Se reutiliza en el panel derecho «Día» (modo pizarra, sin el bloque de nodos
// porque viven en el lienzo) e inline en el centro (modo lista, con todo).
// Cada cabecera de bloque colapsa su contenido (clic). Persistente.

import { useEffect, useRef, useState } from 'react'
import { openNodeDetail } from '../../utils/canvasNav'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import Outliner from '../outliner/Outliner'
import DailyCockpit from '../views/DailyCockpit'
import { renderInline } from '../outliner/InlineRenderer'
import { pushEventTitleChanges, pushEventToGcal, deleteGcalEventForNode, getGcalColor, getGcalEventId } from '../../utils/gcalNodesSync'
import { trashNode } from '../../utils/papeleraHelper'
import { getDayColumnData } from '../../utils/dayColumn'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { getCalendarEvents, type CalendarEvent } from '../../api/googleCalendar'
import { gcalEventNodeId } from '../../utils/deterministicId'
import { useUserStore } from '../../store/userStore'
import RowContextChip from './RowContextChip'
import TaskHoverActions from './TaskHoverActions'
import { firstContextOf, contextColor } from '../../utils/cajones'
import { TaskPropsPopover, GCalEventEditor } from './DiaryPanelComponents'

// Icono de papelera (botón de eliminar al hover en cualquier fila de la columna).
const TrashIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
  </svg>
)

type OutlinerExtraProps = Omit<React.ComponentProps<typeof Outliner>, 'parentId' | 'excludeIds'>

// ── Badge de evento: hora + repetición ────────────────────────────────────────
type TFn = (k: string) => string
const recOptions = (t: TFn): { value: string; label: string }[] => [
  { value: '', label: t('tip.recNone') },
  { value: 'daily:1', label: t('tip.recDaily') },
  { value: 'weekly:1', label: t('tip.recWeekly') },
  { value: 'monthly:1', label: t('tip.recMonthly') },
  { value: 'yearly:1', label: t('tip.recYearly') },
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
function recShort(rec: string | null | undefined, t: TFn): string | null {
  if (!rec) return null
  const u = rec.split(':')[0]
  return ({ daily: t('tip.recDailyShort'), weekly: t('tip.recWeeklyShort'), monthly: t('tip.recMonthlyShort'), yearly: t('tip.recYearlyShort') } as Record<string, string>)[u] || t('tip.recShortGeneric')
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
  const us = useUserStore()
  const { t } = useTranslation()

  // Eventos de Google del día: se traen de Google (NO se materializan como nodos).
  // Se pintan en el bloque de eventos; clic → modal de edición + botón «Crear nodo».
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([])
  const [editingGcal, setEditingGcal] = useState<CalendarEvent | null>(null)
  useEffect(() => {
    if (!node.isDiaryEntry || !node.diaryDate || !us.googleConnected) { setGcalEvents([]); return }
    let cancelled = false
    getCalendarEvents(new Date(node.diaryDate)).then(evs => { if (!cancelled) setGcalEvents(evs) }).catch(() => {})
    return () => { cancelled = true }
  }, [node.id, node.isDiaryEntry, node.diaryDate, us.googleConnected])

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
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const [editArea, setEditArea] = useState<string | null>(null) // id del área en renombrado inline
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
  // Eventos de Google que NO tienen un nodo local enlazado (esos ya salen como eventNodes).
  const linkedGcalIds = new Set(eventNodes.map(n => getGcalEventId(n)).filter(Boolean))
  const extraEvents = gcalEvents.filter(e => !linkedGcalIds.has(e.id))
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
    <button className="dc-del" title={t('common.delete')} onClick={e => { e.stopPropagation(); deleteRow(n) }}>{TrashIcon}</button>
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
      {(eventNodes.length > 0 || extraEvents.length > 0) && (
        <div className="dc-group">
          {header('eventos', isToday ? t('tip.eventsToday') : t('tip.eventsDay'), 'dc-group-label--event')}
          {!collapsed.has('eventos') && extraEvents.map(ev => {
            const allDay = ev.allDay
            const timeLabel = allDay ? t('tip.allDay') : `${hhmm(ev.start)}–${hhmm(ev.end)}`
            return (
              <div key={ev.id} className="dc-row dc-row--event"
                onClick={() => setEditingGcal(ev)} style={{ cursor: 'pointer' }}
                title={t('tip.editGcalEvent')}>
                <span className="dc-event-dot" style={ev.backgroundColor ? { background: ev.backgroundColor } : undefined} />
                <span className="dc-text">{ev.title || t('search.chipEvent')}</span>
                <span className="dc-ev-badge">{timeLabel}</span>
              </div>
            )
          })}
          {!collapsed.has('eventos') && eventNodes.map(ev => {
            const color = getGcalColor(ev)
            const allDay = isAllDay(ev)
            const rec = recShort(ev.recurrence, t)
            const timeLabel = allDay ? t('tip.allDay') : (ev.due ? `${hhmm(ev.due)}–${hhmm(ev.dueEnd)}` : '')
            return (
              <div key={ev.id}>
                <div className="dc-row dc-row--event" data-node-id={ev.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('nodeId', ev.id); e.dataTransfer.effectAllowed = 'copy' }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: ev.id, x: e.clientX, y: e.clientY } })) }}>
                  <span className="dc-event-dot" style={color ? { background: color } : undefined} />
                  <span className="dc-text" onClick={() => openNodeDetail(ev.id)} style={{ cursor: 'pointer' }}>
                    {ev.text ? renderInline(ev.text) : t('search.chipEvent')}
                  </span>
                  <button
                    className="dc-ev-badge"
                    onClick={e => { e.stopPropagation(); setEditEv(id => id === ev.id ? null : ev.id) }}
                    title={t('tip.editTimeAndRepeat')}
                  >
                    {timeLabel}{rec && <span className="dc-ev-rec">🔁 {rec}</span>}
                  </button>
                  {delBtn(ev)}
                </div>
                {editEv === ev.id && !allDay && ev.due && (
                  <div className="dc-ev-edit" onClick={e => e.stopPropagation()}>
                    <label>{t('tip.start')}
                      <input type="time" defaultValue={hhmm(ev.due)}
                        onChange={e => e.target.value && patchEvent(ev.id, { due: withTime(ev.due!, e.target.value) })} />
                    </label>
                    <label>{t('tip.end')}
                      <input type="time" defaultValue={hhmm(ev.dueEnd || ev.due)}
                        onChange={e => e.target.value && patchEvent(ev.id, { dueEnd: withTime(ev.dueEnd || ev.due!, e.target.value) })} />
                    </label>
                    <label>{t('tip.repeat')}
                      <select defaultValue={ev.recurrence || ''}
                        onChange={e => patchEvent(ev.id, { recurrence: e.target.value || null })}>
                        {recOptions(t).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          {header('tareas', t('tip.dayTasks'))}
          {!collapsed.has('tareas') && dayTasks.map(task => (
            <div key={task.id} className={`dc-row ${task.status === 'done' ? 'dc-row--done' : ''}`} data-node-id={task.id}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: task.id, x: e.clientX, y: e.clientY } })) }}>
              <button className={`dc-check ${task.status === 'done' ? 'dc-check--done' : ''}`}
                onClick={e => { e.stopPropagation(); toggleTaskDone(task) }} title={t('daily.markDone')} aria-label={t('daily.markDone')}>
                {task.status === 'done' ? '✓' : ''}
              </button>
              <span className="dc-text" onClick={() => openNodeDetail(task.id)} style={{ cursor: 'pointer' }}>
                {task.text ? renderInline(task.text) : t('tip.task')}
              </span>
              {hhmm(task.due) !== '00:00' && task.due && <span className="dc-time">{hhmm(task.due)}</span>}
              <RowContextChip node={task} />
              <TaskHoverActions node={task} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Áreas — regiones del lienzo. Pulsa para volar; agrupadas por CONTEXTO. */}
      {areaNodes.length > 0 && (() => {
        // Agrupar por contexto (C): contextos con áreas + «Sin contexto» al final.
        const byCtx = new Map<string, { ctx: Node | null; areas: Node[] }>()
        for (const a of areaNodes) {
          const cx = firstContextOf(a)
          const key = cx?.id ?? '__none__'
          if (!byCtx.has(key)) byCtx.set(key, { ctx: cx, areas: [] })
          byCtx.get(key)!.areas.push(a)
        }
        const groups = [...byCtx.values()].sort((g1, g2) => (g1.ctx ? 0 : 1) - (g2.ctx ? 0 : 1))
        const renderArea = (a: Node) => {
          const actx = firstContextOf(a)
          const dot = actx ? contextColor(actx.id) : 'var(--accent,#6c5ce7)'
          const editing = editArea === a.id
          return (
            <div key={a.id} className="dc-row" data-node-id={a.id}
              onClick={() => { if (!editing) flyToArea(a.id) }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: a.id, x: e.clientX, y: e.clientY } })) }}
              title={t('tip.goToArea')} style={{ cursor: 'pointer' }}>
              <span className="dc-event-dot" style={{ background: dot }} />
              {editing ? (
                <input autoFocus defaultValue={a.text || ''} className="dc-text"
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: 'inherit' }}
                  onClick={e => e.stopPropagation()}
                  onBlur={e => { const v = e.target.value.trim(); if (v && v !== a.text) store.updateNode(a.id, { text: v }); setEditArea(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditArea(null) }} />
              ) : (
                <span className="dc-text" onDoubleClick={e => { e.stopPropagation(); setEditArea(a.id) }} title={t('tip.doubleClickRename')}>{a.text ? renderInline(a.text) : t('tip.area')}</span>
              )}
              <RowContextChip node={a} />
              <button className="dc-del" title={a.isFavorite ? t('tip.unfavorite') : t('tip.favorite')}
                onClick={e => { e.stopPropagation(); store.updateNode(a.id, { isFavorite: !a.isFavorite }) }}
                style={{ color: a.isFavorite ? '#f59e0b' : undefined }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill={a.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.94l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"/></svg>
              </button>
              <button className="dc-del" title={t('tip.deleteArea')}
                onClick={e => {
                  e.stopPropagation()
                  for (const ch of store.children(a.id)) if (!ch.deletedAt) store.updateNode(ch.id, { parentId: a.parentId })
                  trashNode(a.id)
                }}>{TrashIcon}</button>
            </div>
          )
        }
        return (
          <div className="dc-group">
            {header('areas', t('tip.areas'))}
            {!collapsed.has('areas') && groups.map(g => (
              <div key={g.ctx?.id ?? '__none__'}>
                {byCtx.size > 1 && (
                  <div className="rc-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 2px' }}>
                    {g.ctx && <span className="dc-event-dot" style={{ background: contextColor(g.ctx.id) }} />}
                    {g.ctx ? g.ctx.text : t('tip.noContext')}
                  </div>
                )}
                {g.areas.map(renderArea)}
              </div>
            ))}
          </div>
        )
      })()}

      {/* 5. Nodos del día (sin los eventos, que ya van arriba). En pizarra NO se
             monta aquí: los nodos viven en el lienzo (includeNodes=false). */}
      {includeNodes && (
        <div className="dc-group">
          {header('nodos', t('tip.nodes'))}
          {!collapsed.has('nodos') && (
            <Outliner parentId={node.id} excludeIds={eventIds} {...outlinerProps} />
          )}
        </div>
      )}

      {/* 6. Capturas — bandeja de entrada (fondo). Arrástralas al lienzo para colocarlas. */}
      {captureNodes.length > 0 && (
        <div className="dc-group">
          {header('capturas', t('search.chipCaptura'))}
          {!collapsed.has('capturas') && captureNodes.map(c => (
            <div
              key={c.id}
              className="dc-row dc-row--capture"
              data-node-id={c.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'copy' }}
              onClick={() => openNodeDetail(c.id)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: c.id, x: e.clientX, y: e.clientY } })) }}
              title={t('tip.dragToCanvas')}
            >
              <span className="dc-capture-grip">⠿</span>
              <span className="dc-text">{c.text ? renderInline(c.text) : t('tip.capture')}</span>
              <RowContextChip node={c} />
              {delBtn(c)}
            </div>
          ))}
        </div>
      )}
      {propsNodeId && (() => {
        const pn = store.getNode(propsNodeId)
        return pn ? <TaskPropsPopover node={pn} allowRename allowDelete onClose={() => setPropsNodeId(null)} /> : null
      })()}

      {/* Modal de edición del evento de Google (clic en una fila de evento) */}
      {editingGcal && (
        <GCalEventEditor event={editingGcal} modal onClose={() => setEditingGcal(null)}
          linkedNodeId={store.allActive().find(n => n.gcalEventId === editingGcal.id)?.id}
          onCreateNode={() => {
            // Crear bajo demanda un nodo local vinculado al evento (no por defecto).
            const ev = editingGcal
            const newNode = store.createNode({ text: ev.title || t('search.chipEvent'), parentId: node.id, predefinedId: gcalEventNodeId(ev.id) ?? undefined })
            store.updateNode(newNode.id, {
              isEvent: true, due: ev.start, dueEnd: ev.end,
              gcalEventId: ev.id, // columna: la usa el dedup del planner (n.gcalEventId)
              extraData: JSON.stringify({ _gcalEventId: ev.id, _gcalColor: ev.backgroundColor || '' }),
            })
            openNodeDetail(newNode.id)
          }}
          onUpdated={ev => { setGcalEvents(p => p.map(x => x.id === ev.id ? ev : x)); setEditingGcal(null) }}
          onDeleted={id => { setGcalEvents(p => p.filter(x => x.id !== id)); setEditingGcal(null) }} />
      )}
    </>
  )
}
