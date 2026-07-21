// DayColumn — columna unificada de una nota diaria, de arriba a abajo:
//   1. Eventos de Google Calendar del día (sueltos, alineados a la izquierda)
//   2. Atrasadas · 3. Para hoy  (cockpit «bare», sin caja)
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
import { diaryDayTitle } from '../../utils/agendaHelper'
import { collectDailyCockpit, toggleTaskDone } from '../../utils/dailyCockpit'
import { getCalendarEvents, deleteCalendarEvent, type CalendarEvent } from '../../api/googleCalendar'
import { gcalEventNodeId } from '../../utils/deterministicId'
import { useUserStore } from '../../store/userStore'
import RowContextChip from './RowContextChip'
import TaskHoverActions from './TaskHoverActions'
import TaskRow, { timeLabel } from './TaskRow'
import { firstContextOf, contextColor } from '../../utils/cajones'
import { TaskPropsPopover, GCalEventEditor } from './DiaryPanelComponents'
import NewEventModal from '../modals/NewEventModal'

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
  const { t, i18n } = useTranslation()

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

  // Auto-reparación defensiva: si este día llegó con el título corrompido a
  // «Documento» (el bug del editor pisando el título de un nodo que no debía) o
  // vacío, se restaura aquí — sea cual sea la función que lo trajo hasta aquí
  // (ensureDayPath ya repara, pero store.todayDiary()/getTodayDiaryUnderAgenda
  // pueden devolver el nodo tal cual sin pasar por ese camino).
  useEffect(() => {
    if (!node.isDiaryEntry || !node.diaryDate) return
    if (node.text && node.text !== 'Documento') return
    store.updateNode(node.id, { text: diaryDayTitle(new Date(node.diaryDate)) })
  }, [node.id, node.isDiaryEntry, node.diaryDate, node.text])

  // Modal de nuevo evento — «+» de la cabecera «Eventos». Cuelga de ESTE día
  // concreto (no siempre de hoy), con esa fecha como valor por defecto.
  const [showNewEvent, setShowNewEvent] = useState(false)

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
  // Menú clic derecho de un evento GCal crudo (sin nodo local — el menú global
  // `from:open-rowmenu`/RightColMenu necesita un nodeId real, así que este es
  // aparte, igual que hace PlannerPanel para sus bloques 'gcal' (Alberto, 22 jul:
  // "el bloque de eventos de hoy también tiene que tener su botón derecho").
  const [gcalCtxMenu, setGcalCtxMenu] = useState<{ x: number; y: number; ev: CalendarEvent } | null>(null)
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

  // Tareas de HOY (todo el día + con hora) — se fusionan en «Eventos de hoy» en
  // vez de duplicarse también en «Para hacer» (Alberto, 22 jul: "poner la tarea
  // solamente en el bloque eventos de hoy, pero poner el checkbox junto al
  // título"). DailyCockpit las oculta de Para Hacer vía `hideToday`.
  const cockpit = isToday ? collectDailyCockpit() : null
  const todayTasks = cockpit?.today ?? []

  // Lista única de «Eventos de hoy»: gcal crudo + eventos-nodo + tareas de hoy,
  // ordenada cronológicamente (Alberto: "deben aparecer ordenados
  // cronológicamente" — antes gcal crudo y eventos-nodo se renderizaban en dos
  // pasadas separadas, sin mezclar ni ordenar entre sí).
  type AgendaRow =
    | { kind: 'gcal'; sortTime: number; ev: CalendarEvent }
    | { kind: 'eventNode'; sortTime: number; n: Node }
    | { kind: 'task'; sortTime: number; n: Node }
  const agendaRows: AgendaRow[] = [
    ...extraEvents.map(ev => ({ kind: 'gcal' as const, sortTime: new Date(ev.start).getTime(), ev })),
    ...eventNodes.map(n => ({ kind: 'eventNode' as const, sortTime: n.due ? new Date(n.due).getTime() : 0, n })),
    ...todayTasks.map(n => ({ kind: 'task' as const, sortTime: n.due ? new Date(n.due).getTime() : 0, n })),
  ].sort((a, b) => a.sortTime - b.sortTime)

  // Reparación: una tarea de hoy con hora que no se completó a tiempo pasa a
  // «atrasada» al día siguiente — le quitamos la hora para que vuelva como
  // tarea de TODO EL DÍA, no arrastrando una hora ya obsoleta (Alberto: "en
  // caso de no completarla, volvería al día siguiente como tarea de todo el
  // día"). Efecto defensivo, igual que la reparación del título del diario.
  const overdueTimedSig = cockpit ? cockpit.overdue.map(n => `${n.id}:${n.due}`).join('|') : ''
  useEffect(() => {
    if (!cockpit) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    for (const n of cockpit.overdue) {
      if (!n.due) continue
      const d = new Date(n.due)
      if (d.getHours() === 0 && d.getMinutes() === 0) continue // ya es todo el día
      if (d >= todayStart) continue
      d.setHours(0, 0, 0, 0)
      store.updateNode(n.id, { due: d.toISOString() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueTimedSig])

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
      {/* 1. Eventos del día — gcal crudo + eventos-nodo + (HOY) tareas con fecha hoy,
          fusionados en una única lista cronológica (Alberto: "deben aparecer
          ordenados cronológicamente"; las tareas de hoy se muestran aquí con
          checkbox en vez de duplicarse en «Para hacer»). Cabecera SIEMPRE visible
          (aunque no haya eventos aún) para poder crear el primero con el «+». */}
      <div className="dc-group">
        <div className="dc-group-headrow">
          {header('eventos', isToday ? t('tip.eventsToday') : t('tip.eventsDay'), 'dc-group-label--event')}
          <button className="dc-group-add" onClick={() => setShowNewEvent(true)} title={t('modal.newEvent')}>+</button>
        </div>
        {!collapsed.has('eventos') && agendaRows.map(row => {
          if (row.kind === 'gcal') {
            const ev = row.ev
            const allDay = ev.allDay
            const timeStr = allDay ? t('tip.allDay') : `${hhmm(ev.start)}–${hhmm(ev.end)}`
            return (
              <div key={`gcal:${ev.id}`} className="dc-row dc-row--event"
                onClick={() => setEditingGcal(ev)} style={{ cursor: 'pointer' }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setGcalCtxMenu({ x: e.clientX, y: e.clientY, ev }) }}
                title={t('tip.editGcalEvent')}>
                <span className="dc-event-dot" style={ev.backgroundColor ? { background: ev.backgroundColor } : undefined} />
                <span className="dc-ev-badge dc-ev-badge--lead">{timeStr}</span>
                <span className="dc-text">{ev.title || t('search.chipEvent')}</span>
              </div>
            )
          }
          if (row.kind === 'task') {
            const task = row.n
            const done = task.status === 'done'
            const timeStr = timeLabel(task, i18n.language) || t('tip.allDay')
            return (
              <div key={`task:${task.id}`} className={`dc-row dc-row--event ${done ? 'dc-row--done' : ''}`} data-node-id={task.id}
                draggable
                onDragStart={e => { e.dataTransfer.setData('nodeId', task.id); e.dataTransfer.effectAllowed = 'move' }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: task.id, x: e.clientX, y: e.clientY } })) }}>
                <button className={`dc-check ${done ? 'dc-check--done' : ''}`}
                  onClick={e => { e.stopPropagation(); toggleTaskDone(task) }}
                  title={t('daily.markDone')} aria-label={t('daily.markDone')}>{done ? '✓' : ''}</button>
                <span className="dc-ev-badge dc-ev-badge--lead">{timeStr}</span>
                <span className="dc-text" onClick={() => openNodeDetail(task.id)} style={{ cursor: 'pointer' }}>
                  {task.text ? renderInline(task.text) : t('common.noTitle')}
                </span>
                {delBtn(task)}
              </div>
            )
          }
          const ev = row.n
          const color = getGcalColor(ev)
          const allDay = isAllDay(ev)
          const rec = recShort(ev.recurrence, t)
          const timeStr = allDay ? t('tip.allDay') : (ev.due ? `${hhmm(ev.due)}–${hhmm(ev.dueEnd)}` : '')
          return (
            <div key={`node:${ev.id}`}>
              <div className="dc-row dc-row--event" data-node-id={ev.id}
                draggable
                onDragStart={e => { e.dataTransfer.setData('nodeId', ev.id); e.dataTransfer.effectAllowed = 'copy' }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: ev.id, x: e.clientX, y: e.clientY } })) }}>
                <span className="dc-event-dot" style={color ? { background: color } : undefined} />
                <button
                  className="dc-ev-badge dc-ev-badge--lead"
                  onClick={e => { e.stopPropagation(); setEditEv(id => id === ev.id ? null : ev.id) }}
                  title={t('tip.editTimeAndRepeat')}
                >
                  {timeStr}{rec && <span className="dc-ev-rec">🔁 {rec}</span>}
                </button>
                <span className="dc-text" onClick={() => openNodeDetail(ev.id)} style={{ cursor: 'pointer' }}>
                  {ev.text ? renderInline(ev.text) : t('search.chipEvent')}
                </span>
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

      {/* 2-3. HOY → cockpit (Atrasadas · Para hoy — hideToday: hoy ya vive en Eventos). */}
      {isToday && <DailyCockpit bare disablePlanner hideToday />}

      {/* Otros días → tareas con due en ESE día. TaskRow ÚNICO (mismo que Hoy/Elementos). */}
      {!isToday && dayTasks.length > 0 && (
        <div className="dc-group">
          {header('tareas', t('tip.dayTasks'))}
          {!collapsed.has('tareas') && dayTasks.map(task => (
            <TaskRow key={task.id} node={task} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
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

      {/* Menú clic derecho de un evento GCal crudo — Renombrar (reutiliza el mismo
          modal de edición, ya tiene el campo de título), Convertir en tarea
          (materializa sin hora, tarea de hoy) y Eliminar. */}
      {gcalCtxMenu && (
        <>
          <div onPointerDown={() => setGcalCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setGcalCtxMenu(null) }}
            style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
          <div className="node-ctx-menu" style={{ position: 'fixed', top: gcalCtxMenu.y, left: gcalCtxMenu.x, zIndex: 3000 }}
            onClick={e => e.stopPropagation()}>
            <button className="node-ctx-item" onClick={() => { setEditingGcal(gcalCtxMenu.ev); setGcalCtxMenu(null) }}>
              {t('rightColMenu.rename', 'Renombrar')}
            </button>
            <button className="node-ctx-item" onClick={() => {
              const ev = gcalCtxMenu.ev
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const newNode = store.createNode({ text: ev.title || t('search.chipEvent'), parentId: node.id, predefinedId: gcalEventNodeId(ev.id) ?? undefined })
              store.updateNode(newNode.id, {
                status: 'pending', due: today.toISOString(),
                gcalEventId: ev.id, extraData: JSON.stringify({ _gcalEventId: ev.id }),
              })
              setGcalCtxMenu(null)
            }}>{t('rightColMenu.convertToTask')}</button>
            <div className="node-ctx-sep" />
            <button className="node-ctx-item node-ctx-item--danger" onClick={async () => {
              const ev = gcalCtxMenu.ev
              try { await deleteCalendarEvent(ev.id) } catch { /* noop */ }
              setGcalEvents(p => p.filter(x => x.id !== ev.id))
              setGcalCtxMenu(null)
            }}>{t('rightColMenu.delete')}</button>
          </div>
        </>
      )}

      {/* Modal de edición del evento de Google (clic en una fila de evento) */}
      {editingGcal && (
        <GCalEventEditor event={editingGcal} modal onClose={() => setEditingGcal(null)}
          linkedNodeId={store.allActive().find(n => n.gcalEventId === editingGcal.id)?.id}
          onCreateNode={() => {
            // Crear bajo demanda un DOCUMENTO local vinculado al evento (no por
            // defecto). `_doc:'1'` — es un documento, no un nodo genérico
            // (Alberto, 22 jul: "en lugar de eso, se debe crear documento").
            const ev = editingGcal
            const newNode = store.createNode({ text: ev.title || t('search.chipEvent'), parentId: node.id, predefinedId: gcalEventNodeId(ev.id) ?? undefined })
            store.updateNode(newNode.id, {
              isEvent: true, due: ev.start, dueEnd: ev.end,
              gcalEventId: ev.id, // columna: la usa el dedup del planner (n.gcalEventId)
              extraData: JSON.stringify({ _doc: '1', _gcalEventId: ev.id, _gcalColor: ev.backgroundColor || '' }),
            })
            openNodeDetail(newNode.id)
            return newNode.id
          }}
          onUpdated={ev => { setGcalEvents(p => p.map(x => x.id === ev.id ? ev : x)); setEditingGcal(null) }}
          onDeleted={id => { setGcalEvents(p => p.filter(x => x.id !== id)); setEditingGcal(null) }} />
      )}

      {/* Nuevo evento del día — «+» de la cabecera «Eventos». Cuelga de ESTE día. */}
      {showNewEvent && (
        <NewEventModal
          parentId={node.id}
          defaultDateStr={node.diaryDate ? node.diaryDate.slice(0, 10) : undefined}
          onClose={() => setShowNewEvent(false)}
          onCreated={id => window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: id } }))}
        />
      )}
    </>
  )
}
