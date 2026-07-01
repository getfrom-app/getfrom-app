import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore, nodeMeta } from '../../store/nodeStore'
import type { Node } from '../../types'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fromRecToRRule } from '../../api/googleCalendar'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO } from '../../utils/dates'
import ResourcePanel from './ResourcePanel'

interface Props {
  node: Node
}

export default function NodeRightPanel({ node }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [newType, setNewType] = useState('')

  // ── Recurso ──────────────────────────────────────────────────────────────
  const isResource = nodeMeta(node).resource
  function toggleResource() {
    const newValue = !isResource
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    if (newValue) { ed._resource = true } else { delete ed._resource }
    // Actualizar también la columna promovida isResource (viene del servidor como false explícito)
    store.updateNode(node.id, { extraData: JSON.stringify(ed), isResource: newValue } as Parameters<typeof store.updateNode>[1] & { isResource?: boolean })
  }

  // ── Fecha helpers ────────────────────────────────────────────────────────
  const dueDate    = isoToLocalDate(node.due)
  const dueTime    = isoToLocalTime(node.due)
  const dueEndDate = isoToLocalDate(node.dueEnd)
  const dueEndTime = isoToLocalTime(node.dueEnd)

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    const updates: Record<string, unknown> = { due: makeDueISO(date, time) }
    // Si se establece hora de inicio y el fin no tiene hora → auto-poner fin = inicio + 1h
    if (time && !hasLocalTime(node.dueEnd)) {
      const startDt = new Date(`${date}T${time}:00`)
      startDt.setHours(startDt.getHours() + 1)
      const endDate = [startDt.getFullYear(), String(startDt.getMonth() + 1).padStart(2, '0'), String(startDt.getDate()).padStart(2, '0')].join('-')
      const endTime = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`
      updates.dueEnd = makeDueISO(endDate, endTime)
    }
    store.updateNode(node.id, updates)
  }
  function setDueEnd(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { dueEnd: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T23:59:00`).toISOString()
    store.updateNode(node.id, { dueEnd: iso })
  }
  function setStatus(status: Node['status']) {
    // Regla: future o done implican que la nota deja de tener fecha activa
    const updates: Partial<Node> = { status }
    if (status === 'future' || status === 'done') updates.due = null
    store.updateNode(node.id, updates)
  }
  function setPriority(priority: Node['priority']) { store.updateNode(node.id, { priority }) }
  function toggleFavorite() { store.updateNode(node.id, { isFavorite: !node.isFavorite }) }
  // toggleSeguimiento eliminado en v8.25 (campo isSeguimiento). El bucle actual usa types:'bucle'.
  // ── Modal de creación de evento (centrado, grande) ───────────────────────
  const [showEventPopup, setShowEventPopup] = useState(false)
  const eventBtnRef = useRef<HTMLButtonElement>(null)
  const eventPopupRef = useRef<HTMLDivElement>(null)
  const [evtDate, setEvtDate] = useState('')
  const [evtTime, setEvtTime] = useState('')          // vacío = sin hora
  const [evtEndDate, setEvtEndDate] = useState('')
  const [evtEndTime, setEvtEndTime] = useState('')
  const [evtLocation, setEvtLocation] = useState('')
  const [evtRec, setEvtRec] = useState<string | null>(null)   // repetición del modal
  const [evtSyncing, setEvtSyncing] = useState(false)
  const [evtMsg, setEvtMsg] = useState<string | null>(null)

  // ── Auto-sync silencioso a GCal al cambiar cualquier propiedad del evento ──
  useEffect(() => {
    if (!node.isEvent || !node.due) return
    const gcalId = (nodeMeta(node).gcalEventId ?? null)
    const timer = setTimeout(async () => {
      const end = node.dueEnd || new Date(new Date(node.due!).getTime() + 3600000).toISOString()
      let loc = ''
      try { loc = JSON.parse(node.extraData || '{}').location || '' } catch {}
      try {
        const rrule = fromRecToRRule(node.recurrence)
        if (gcalId) {
          await updateCalendarEvent(gcalId, {
            title: node.text || 'Evento',
            start: node.due!,
            end,
            description: node.body || undefined,
            location: loc || undefined,
            recurrence: rrule,
          })
        } else {
          // Primera vez — crear y guardar el ID
          const result = await createCalendarEvent({
            title: node.text || 'Evento',
            start: node.due!,
            end,
            description: node.body || undefined,
            location: loc || undefined,
            recurrence: rrule,
          })
          let ed: Record<string, unknown> = {}
          try { ed = JSON.parse(node.extraData || '{}') } catch {}
          ed.gcalEventId = result.id
          store.updateNode(node.id, { extraData: JSON.stringify(ed) })
        }
      } catch { /* sin conexión GCal — silencioso */ }
    }, 1200)
    return () => clearTimeout(timer)
  }, [node.isEvent, node.text, node.due, node.dueEnd, node.body, node.extraData, node.recurrence]) // eslint-disable-line react-hooks/exhaustive-deps

  function openEventPopup() {
    if (node.isEvent) {
      store.updateNode(node.id, { isEvent: false })
      return
    }
    // Pre-rellenar con datos existentes del nodo
    setEvtDate(isoToLocalDate(node.due) || '')
    setEvtTime(isoToLocalTime(node.due) || '')
    setEvtEndDate(isoToLocalDate(node.dueEnd) || '')
    setEvtEndTime(isoToLocalTime(node.dueEnd) || '')
    setEvtRec(node.recurrence || null)
    try { setEvtLocation(JSON.parse(node.extraData || '{}').location || '') } catch { setEvtLocation('') }
    setEvtMsg(null)
    setShowEventPopup(true)
  }

  async function saveEvent() {
    if (!evtDate) return
    const startIso = evtTime
      ? new Date(`${evtDate}T${evtTime}:00`).toISOString()
      : new Date(`${evtDate}T00:00:00`).toISOString()
    const endIso = evtEndDate
      ? new Date(`${evtEndDate}T${evtEndTime || '23:59'}:00`).toISOString()
      : evtTime
        ? new Date(new Date(startIso).getTime() + 3600000).toISOString()
        : null
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    if (evtLocation.trim()) ed.location = evtLocation.trim(); else delete ed.location
    store.updateNode(node.id, {
      isEvent: true, status: 'pending',
      due: startIso, dueEnd: endIso,
      recurrence: evtRec,
      extraData: JSON.stringify(ed),
    })
    setEvtSyncing(true); setEvtMsg(null)
    try {
      const rrule = fromRecToRRule(evtRec)
      const result = await createCalendarEvent({
        title: node.text || 'Evento', start: startIso,
        end: endIso || new Date(new Date(startIso).getTime() + 3600000).toISOString(),
        description: node.body || undefined,
        recurrence: rrule,
      })
      let ed2: Record<string, unknown> = {}
      try { ed2 = JSON.parse(node.extraData || '{}') } catch {}
      ed2.gcalEventId = result.id
      if (evtLocation.trim()) ed2.location = evtLocation.trim()
      store.updateNode(node.id, { extraData: JSON.stringify(ed2) })
      setEvtMsg('✓ ' + t('nodeRightPanel.syncedGcal'))
    } catch {
      setEvtMsg(t('nodeRightPanel.savedNoGcal'))
    } finally { setEvtSyncing(false) }
    setTimeout(() => setShowEventPopup(false), evtMsg ? 1200 : 0)
  }

  const evtLocation_stored = (nodeMeta(node).location ?? '')
  const gcalEventId = (nodeMeta(node).gcalEventId ?? null)

  function toggleEvent() { store.updateNode(node.id, { isEvent: !node.isEvent }) }
  const isLocked = (() => {
    try { return JSON.parse(node.extraData || '{}').locked === true } catch { return false }
  })()
  function toggleLocked() {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      ed.locked = !isLocked
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch {
      store.updateNode(node.id, { extraData: JSON.stringify({ locked: !isLocked }) })
    }
  }
  function addType(type: string) {
    const t = type.trim().toLowerCase()
    if (!t || (node.types || []).includes(t)) return
    store.updateNode(node.id, { types: [...(node.types || []), t] })
    setNewType('')
  }
  function removeType(type: string) {
    store.updateNode(node.id, { types: (node.types || []).filter(t => t !== type) })
  }

  // Tag definition nodes → "Ver área completa"
  const tags = node.types || []
  const tagNodes = s.tagDefinitions().filter(td => tags.includes(s.tagName(td) || ''))

  const statusOptions: { value: Node['status']; label: string }[] = [
    { value: null, label: `○ ${t('nodeRightPanel.statusNone')}` },
    { value: 'pending', label: `● ${t('nodeRightPanel.statusPending')}` },
    { value: 'future', label: `◆ ${t('nodeRightPanel.statusFuture')}` },
    { value: 'done', label: `✓ ${t('nodeRightPanel.statusDone')}` },
  ]
  const priorityOptions: { value: Node['priority']; label: string; style?: React.CSSProperties }[] = [
    { value: null, label: `— ${t('nodeRightPanel.prioNone')}` },
    { value: 'low', label: `▽ ${t('nodeRightPanel.prioLow')}` },
    { value: 'medium', label: `△ ${t('nodeRightPanel.prioMedium')}`, style: { color: '#f59e0b' } },
    { value: 'high', label: `▲ ${t('nodeRightPanel.prioHigh')}`, style: { color: '#ef4444' } },
  ]
  // Helpers para repetición flexible (x días, x semanas, etc.)
  const recUnits: [string, string][] = [['daily', t('nodeRightPanel.unitDays')], ['weekly', t('nodeRightPanel.unitWeeksShort')], ['monthly', t('nodeRightPanel.unitMonths')], ['yearly', t('nodeRightPanel.unitYears')]]
  function parseRec(r: string | null | undefined) {
    if (!r) return { n: 1, unit: 'daily' }
    const [unit, nStr] = r.split(':')
    return { n: parseInt(nStr || '1') || 1, unit }
  }
  function applyRec(n: number, unit: string) {
    const safe = Math.max(1, Math.round(n) || 1)
    store.updateNode(node.id, { recurrence: safe === 1 ? unit : `${unit}:${safe}` })
  }
  // ── Estado unificado (tareas, eventos, recursos) ────────────────────────
  // Para recursos: usa _resourceStatus; para tareas/eventos: usa node.status
  const resourceStatus = nodeMeta(node).resourceStatus ?? 'pending'
  function setResourceStatus(val: string) {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      ed._resourceStatus = val
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch {
      store.updateNode(node.id, { extraData: JSON.stringify({ _resourceStatus: val }) })
    }
  }

  // ── Tareas asociadas (solo en notas, no tareas/eventos/recursos) ─────────
  const [newTaskText, setNewTaskText] = useState('')
  const [taskInputVisible, setTaskInputVisible] = useState(false)
  const taskInputRef = useRef<HTMLInputElement>(null)

  const associatedTasks = s.children(node.id)
    .filter(c => !c.deletedAt && c.status !== null && c.isAtomic)
    .sort((a, b) => {
      if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime()
      if (a.due) return -1; if (b.due) return 1
      return a.siblingOrder - b.siblingOrder
    })

  function createAssociatedTask() {
    const text = newTaskText.trim()
    if (!text) { setTaskInputVisible(false); return }
    const today = new Date(); today.setHours(0,0,0,0)
    const maxOrder = s.children(node.id).reduce((m, c) => Math.max(m, c.siblingOrder), 0)
    store.createNode({ text, parentId: node.id, isTask: true, due: today.toISOString(),
      isAtomic: true, siblingOrder: maxOrder + 1000 })
    setNewTaskText('')
    setTaskInputVisible(false)
  }

  const showTasksBlock = node.status === null && !node.isEvent && !nodeMeta(node).resource

  // ── Determinar el tipo de nodo ─────────────────────────────────────────
  const isTask     = node.status !== null && !node.isEvent && !isResource
  const showProps  = node.status !== null || node.isEvent || isResource // tarea/evento/recurso

  return (
    <>
    <div className="node-right-panel">

      {/* ── Tareas asociadas — solo para notas planas ─────────────────────── */}
      {showTasksBlock && (
        <div className="node-right-tasks-block">
          <div className="node-right-tasks-header">
            <span className="node-right-tasks-label">{t('panel.tasks')}</span>
            <button className="node-right-tasks-add" onClick={() => {
              setTaskInputVisible(true)
              setTimeout(() => taskInputRef.current?.focus(), 50)
            }} title={t('topbar.newTask')}>＋</button>
          </div>
          {associatedTasks.map(task => {
            const isOverdue = task.due ? new Date(task.due) < new Date(new Date().setHours(0,0,0,0)) : false
            return (
              <div key={task.id} className="node-right-task-row"
                onClick={() => navigate(`/node/${task.id}`)}>
                <button className="node-right-task-check"
                  onClick={e => { e.stopPropagation()
                    store.updateNode(task.id, { status: task.status === 'done' ? null : 'done' })
                  }}>
                  {task.status === 'done' ? '✓' : '○'}
                </button>
                <span className={`node-right-task-text${task.status === 'done' ? ' done' : ''}${isOverdue ? ' overdue' : ''}`}>
                  {task.text || t('common.noTitle')}
                </span>
                {task.due && (
                  <span className={`node-right-task-due${isOverdue ? ' overdue' : ''}`}>
                    {new Date(task.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            )
          })}
          {taskInputVisible && (
            <div className="node-right-task-input-row">
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>○</span>
              <input ref={taskInputRef} className="node-right-task-input" placeholder={t('panel.newTask')}
                value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createAssociatedTask()
                  if (e.key === 'Escape') { setTaskInputVisible(false); setNewTaskText('') }
                }}
                onBlur={() => { if (!newTaskText) setTaskInputVisible(false) }}
              />
            </div>
          )}
          {!taskInputVisible && associatedTasks.length === 0 && (
            <button className="node-right-tasks-empty" onClick={() => {
              setTaskInputVisible(true)
              setTimeout(() => taskInputRef.current?.focus(), 50)
            }}>{t('panel.addTask')}</button>
          )}
        </div>
      )}

      {/* Ver área completa */}
      {tagNodes.map(td => (
        <div key={td.id} className="prop-section">
          <button className="prop-area-link" onClick={() => navigate(`/node/${td.id}`)}>
            <span className="prop-area-link-icon">◈</span>
            <span>{s.tagName(td)}</span>
            <span className="prop-area-link-arrow">→</span>
          </button>
        </div>
      ))}

      {/* ── Botones Tarea / Evento / Recurso — siempre visibles ─────────── */}
      <div className="prop-row">
        <button
          className={`prop-icon-btn ${isTask ? 'active' : ''}`}
          onClick={() => {
            if (isTask) { store.updateNode(node.id, { status: null }) }
            else if (!isResource && !node.isEvent) {
              store.updateNode(node.id, { status: 'pending', due: node.due ?? new Date(new Date().setHours(0,0,0,0)).toISOString() })
            }
          }}
          title={isResource ? t('nodeRightPanel.isResource') : node.isEvent ? t('nodeRightPanel.isEvent') : isTask ? t('nodeRightPanel.removeTask') : t('nodeRightPanel.makeTask')}
          style={isResource || node.isEvent ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >{t('panel.taskToggle')}</button>
        <button
          ref={eventBtnRef}
          className={`prop-icon-btn ${node.isEvent ? 'active event' : ''}`}
          onClick={openEventPopup}
          title={node.isEvent ? t('nodeRightPanel.removeEvent') : t('nodeRightPanel.makeEvent')}
        >{t('panel.event')}</button>
        <button
          className={`prop-icon-btn ${isResource ? 'active resource' : ''}`}
          onClick={toggleResource}
          title={isResource ? t('nodeRightPanel.removeResource') : t('nodeRightPanel.makeResource')}
        >🔗 {t('panel.resources')}</button>
      </div>

      {/* ── ResourcePanel: thumbnail + URL + tipo (solo recursos) ─────────── */}
      {isResource && <ResourcePanel node={node} />}

      {/* ════════════════════════════════════════════════════════════════════
          BLOQUE PROPIEDADES: Estado → Fecha → Repetición → Prioridad
          Visible solo para tareas, eventos y recursos
          ════════════════════════════════════════════════════════════════════ */}

      {/* ── 1. ESTADO ────────────────────────────────────────────────────── */}
      {showProps && (
        <div className="prop-section">
          <div className="prop-section-label">{t('search.filterStatus')}</div>
          {isResource ? (
            // Recursos: estado propio (resourceStatus)
            <div className="prop-pills">
              {([['pending',`● ${t('nodeRightPanel.statusPending')}`],['future',`◆ ${t('nodeRightPanel.statusFuture')}`],['done',`✓ ${t('nodeRightPanel.statusDone')}`]] as [string,string][]).map(([val, label]) => (
                <button key={val} className={`prop-pill ${resourceStatus === val ? 'active' : ''}`}
                  onClick={() => setResourceStatus(val)}>{label}</button>
              ))}
            </div>
          ) : (
            // Tareas y eventos: node.status
            <div className="prop-pills">
              {statusOptions.map(opt => (
                <button key={String(opt.value)} className={`prop-pill ${node.status === opt.value ? 'active' : ''}`}
                  onClick={() => setStatus(opt.value)}>{opt.label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 2. FECHA (tareas y recursos; eventos tienen su sección propia) ── */}
      {showProps && !node.isEvent && node.status !== 'future' && node.status !== 'done' && (
        <div className="prop-section">
          <div className="prop-section-label">{t('common.date')}</div>
          <div className="prop-quick-dates">
            {[
              { label: t('common.today'), days: 0 },
              { label: t('nodeRightPanel.tomorrow'), days: 1 },
              { label: t('nodeRightPanel.nextMondayShort'), days: (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })() },
              { label: t('nodeRightPanel.nextWeekShort'), days: 7 },
            ].map(({ label, days }) => {
              const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0)
              const iso = d.toISOString().slice(0, 10)
              return (
                <button key={label} className={`prop-quick-date-btn ${dueDate === iso ? 'active' : ''}`}
                  onClick={() => setDue(iso, hasLocalTime(node.due) ? dueTime : '')}>{label}</button>
              )
            })}
            {dueDate && <button className="prop-quick-date-btn" onClick={() => setDue('', '')}>✕</button>}
          </div>
          <div className="prop-datetime" style={{ marginTop: 6 }}>
            <input type="date" className="prop-date-input" value={dueDate}
              onChange={e => setDue(e.target.value, hasLocalTime(node.due) ? dueTime : '')} />
            <input type="time" className="prop-time-input" value={hasLocalTime(node.due) ? dueTime : ''}
              onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} placeholder="HH:MM" />
            {hasLocalTime(node.due) && dueDate && (
              <button className="prop-quick-date-btn" onClick={() => setDue(dueDate, '')} title={t('common.removeTime')}>✕h</button>
            )}
          </div>
          {/* Fecha fin (standalone para tareas/recursos) */}
          {node.dueEnd && (
            <div className="prop-datetime" style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>{t('nodeRightPanel.endLabel')}</span>
              <input type="date" className="prop-date-input" value={dueEndDate} onChange={e => setDueEnd(e.target.value, dueEndTime)} />
              <input type="time" className="prop-time-input" value={dueEndTime} onChange={e => setDueEnd(dueEndDate, e.target.value)} disabled={!dueEndDate} />
            </div>
          )}
        </div>
      )}

      {/* ── 2b. FECHA EVENTO (inicio/fin/hora/lugar/GCal) ────────────────── */}
      {node.isEvent && (
        <div className="prop-section prop-section--event">
          <div className="prop-section-label">
            {t('common.date')}
            {gcalEventId && <span className="prop-gcal-badge" title={t('tip.syncedGoogle')}>GCal ✓</span>}
          </div>
          <div className="prop-event-row">
            <span className="prop-event-field-label">{t('common.start')}</span>
            <div className="prop-datetime">
              <input type="date" className="prop-date-input" value={dueDate}
                onChange={e => setDue(e.target.value, hasLocalTime(node.due) ? dueTime : '')} />
              {hasLocalTime(node.due) ? (
                <>
                  <input type="time" className="prop-time-input" value={dueTime}
                    onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} />
                  <button className="prop-quick-date-btn" onClick={() => setDue(dueDate, '')} title={t('common.removeTime')}>✕h</button>
                </>
              ) : (
                <button className="prop-quick-date-btn" onClick={() => {
                  const now = new Date(); const h = now.getHours(); const m = Math.ceil(now.getMinutes() / 15) * 15
                  setDue(dueDate, `${String(h).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`)
                }} title={t('nodeRightPanel.addTime')} disabled={!dueDate}>{t('nodeRightPanel.addTimeBtn')}</button>
              )}
            </div>
          </div>
          {hasLocalTime(node.due) && (
            <div className="prop-event-row">
              <span className="prop-event-field-label">{t('nodeRightPanel.endLabel')}</span>
              <div className="prop-datetime">
                <input type="date" className="prop-date-input" value={dueEndDate}
                  onChange={e => setDueEnd(e.target.value, dueEndTime)} />
                <input type="time" className="prop-time-input" value={dueEndTime}
                  onChange={e => setDueEnd(dueEndDate, e.target.value)} disabled={!dueEndDate} />
              </div>
            </div>
          )}
          <div className="prop-event-row">
            <span className="prop-event-field-label">{t('nodeRightPanel.place')}</span>
            <input type="text" className="prop-event-location" value={evtLocation_stored}
              placeholder={t('ph.addLocation')}
              onChange={e => {
                let ed: Record<string, unknown> = {}
                try { ed = JSON.parse(node.extraData || '{}') } catch {}
                if (e.target.value.trim()) ed.location = e.target.value; else delete ed.location
                store.updateNode(node.id, { extraData: JSON.stringify(ed) })
              }}
              onBlur={async () => {
                if (!gcalEventId || !node.due) return
                try {
                  await updateCalendarEvent(gcalEventId, {
                    title: node.text || 'Evento', start: node.due,
                    end: node.dueEnd || new Date(new Date(node.due).getTime() + 3600000).toISOString(),
                    location: evtLocation_stored || undefined,
                  })
                  setEvtMsg('✓ ' + t('nodeRightPanel.updatedGcal'))
                  setTimeout(() => setEvtMsg(null), 2500)
                } catch { /* silencioso */ }
              }}
            />
          </div>
          {gcalEventId && <div className="prop-event-synced-hint">{t('nodeRightPanel.syncedHint')}</div>}
          <button className="prop-event-delete-btn"
            title={t('tip.deleteEventGcal')}
            onClick={async () => {
              if (!window.confirm(t('nodeRightPanel.confirmDeleteEvent') + (gcalEventId ? '\n' + t('nodeRightPanel.confirmDeleteEventGcal') : ''))) return
              if (gcalEventId) { try { await deleteCalendarEvent(gcalEventId) } catch { /* silencioso */ } }
              store.updateNode(node.id, { isEvent: false, due: null, dueEnd: null })
              let ed: Record<string, unknown> = {}
              try { ed = JSON.parse(node.extraData || '{}') } catch {}
              delete ed.gcalEventId; delete ed.location
              store.updateNode(node.id, { extraData: JSON.stringify(ed) })
            }}>{t('nodeRightPanel.deleteEvent')}</button>
        </div>
      )}

      {/* ── 3. REPETICIÓN (tareas, eventos, recursos) ─────────────────────── */}
      {showProps && (
        <div className="prop-section">
          <div className="prop-section-label">{t('common.repeat')}</div>
          <div className="prop-rec-row">
            <button className={`prop-pill${!node.recurrence ? ' active' : ''}`}
              onClick={() => store.updateNode(node.id, { recurrence: null })}>–</button>
            <input type="number" className="prop-rec-n" min={1} max={999}
              value={node.recurrence ? parseRec(node.recurrence).n : 1}
              onChange={e => {
                const n = Math.max(1, parseInt(e.target.value) || 1)
                const unit = node.recurrence ? parseRec(node.recurrence).unit : 'daily'
                applyRec(n, unit)
              }}
              disabled={!node.recurrence}
            />
            {recUnits.map(([unit, label]) => (
              <button key={unit}
                className={`prop-pill${node.recurrence && parseRec(node.recurrence).unit === unit ? ' active' : ''}`}
                onClick={() => applyRec(node.recurrence ? parseRec(node.recurrence).n : 1, unit)}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. PRIORIDAD (solo tareas pendientes) ────────────────────────── */}
      {isTask && node.status === 'pending' && (
        <div className="prop-section">
          <div className="prop-section-label">{t('kanban.byPriority')}</div>
          <div className="prop-pills">
            {priorityOptions.map(opt => (
              <button key={String(opt.value)} className={`prop-pill ${node.priority === opt.value ? 'active' : ''}`}
                onClick={() => setPriority(opt.value)} style={opt.style}>{opt.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Propiedades custom (siempre visibles) ───────────────────────── */}
      {!node.isDiaryEntry && (() => {
        const propParentId = node.parentId || node.id
        const schema = store.getPropSchema(propParentId)
        return (
          <div className="prop-section">
            <div className="prop-section-label prop-section-label--row">
              {t('panel.properties')}
              <button className="prop-add-btn" title={t('tip.addProperty')}
                onClick={() => {
                  const name = prompt(t('nodeRightPanel.promptPropName'))
                  if (!name || !name.trim()) return
                  const typeStr = prompt(t('nodeRightPanel.promptPropType'), 'text')
                  const validTypes = ['text','number','select','multi_select','date','checkbox','url','tag']
                  const type = validTypes.includes(typeStr || '') ? (typeStr as string) : 'text'
                  store.addPropColumn(propParentId, name.trim(), type)
                }}>＋</button>
            </div>
            {schema.length === 0 ? (
              <div className="prop-empty-hint">{t('nodeRightPanel.propsEmpty')}</div>
            ) : (
              <div className="prop-custom-list">
                {schema.map(col => <PropertyRow key={col.id} node={node} col={col} />)}
              </div>
            )}
          </div>
        )
      })()}

    </div>

    {/* ── Modal creación de evento — centrado, grande ──────────────── */}
    {showEventPopup && createPortal(
      <div
        className="evt-modal-backdrop"
        onMouseDown={e => { if (e.target === e.currentTarget) setShowEventPopup(false) }}
      >
        <div ref={eventPopupRef} className="evt-modal" onMouseDown={e => e.stopPropagation()}>
          <div className="evt-modal-header">
            <span className="evt-modal-title">{t('nodeRightPanel.newEvent')}</span>
            <button className="evt-modal-close" onClick={() => setShowEventPopup(false)}>✕</button>
          </div>

          {/* Fecha (obligatoria) */}
          <div className="evt-modal-field">
            <label className="evt-modal-label">{t('common.date')} *</label>
            <div className="evt-modal-quick-dates">
              {[
                { label: t('common.today'), days: 0 }, { label: t('nodeRightPanel.tomorrow'), days: 1 },
                { label: t('nodeRightPanel.nextMonday'), days: (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })() },
              ].map(({ label, days }) => {
                const d = new Date(); d.setDate(d.getDate() + days)
                const iso = d.toISOString().slice(0, 10)
                return (
                  <button key={label} className={`evt-modal-qbtn ${evtDate === iso ? 'active' : ''}`}
                    onClick={() => setEvtDate(iso)}>{label}</button>
                )
              })}
            </div>
            <input type="date" className="evt-modal-input" value={evtDate}
              onChange={e => setEvtDate(e.target.value)} autoFocus />
          </div>

          {/* Hora inicio (opcional) */}
          <div className="evt-modal-field">
            <label className="evt-modal-label">{t('nodeRightPanel.startTime')} <span className="evt-modal-opt">{t('nodeRightPanel.optional')}</span></label>
            <div className="evt-modal-row">
              <input type="time" className="evt-modal-input evt-modal-input--time" value={evtTime}
                onChange={e => setEvtTime(e.target.value)} disabled={!evtDate} placeholder="HH:MM" />
              {evtTime && (
                <button className="evt-modal-clear" onClick={() => setEvtTime('')} title={t('common.removeTime')}>✕</button>
              )}
            </div>
          </div>

          {/* Hora fin — solo si hay hora de inicio */}
          {evtTime && (
            <div className="evt-modal-field">
              <label className="evt-modal-label">{t('nodeRightPanel.endTime')} <span className="evt-modal-opt">{t('nodeRightPanel.optional')}</span></label>
              <input type="time" className="evt-modal-input evt-modal-input--time" value={evtEndTime}
                onChange={e => setEvtEndTime(e.target.value)} disabled={!evtTime} placeholder="HH:MM" />
            </div>
          )}

          {/* Repetición */}
          <div className="evt-modal-field">
            <label className="evt-modal-label">{t('common.repeat')} <span className="evt-modal-opt">{t('nodeRightPanel.optional')}</span></label>
            <div className="prop-rec-row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <button className={`prop-pill${!evtRec ? ' active' : ''}`}
                onClick={() => setEvtRec(null)}>–</button>
              <input type="number" className="prop-rec-n" min={1} max={999}
                value={evtRec ? parseRec(evtRec).n : 1}
                onChange={e => {
                  const n = Math.max(1, parseInt(e.target.value) || 1)
                  const unit = evtRec ? parseRec(evtRec).unit : 'daily'
                  const safe = Math.max(1, Math.round(n) || 1)
                  setEvtRec(safe === 1 ? unit : `${unit}:${safe}`)
                }}
                disabled={!evtRec}
              />
              {recUnits.map(([unit, label]) => (
                <button key={unit}
                  className={`prop-pill${evtRec && parseRec(evtRec).unit === unit ? ' active' : ''}`}
                  onClick={() => { const n = evtRec ? parseRec(evtRec).n : 1; setEvtRec(n === 1 ? unit : `${unit}:${n}`) }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Lugar (opcional) */}
          <div className="evt-modal-field">
            <label className="evt-modal-label">{t('nodeRightPanel.place')} <span className="evt-modal-opt">{t('nodeRightPanel.optional')}</span></label>
            <input type="text" className="evt-modal-input" value={evtLocation}
              onChange={e => setEvtLocation(e.target.value)} placeholder={t('ph.addLocation')} />
          </div>

          {evtMsg && <div className={`evt-popup-msg${evtMsg.startsWith('✓') ? ' ok' : ''}`}>{evtMsg}</div>}

          <div className="evt-modal-actions">
            <button className="evt-popup-cancel" onClick={() => setShowEventPopup(false)}>{t('common.cancel')}</button>
            <button className="evt-popup-save" onClick={saveEvent} disabled={!evtDate || evtSyncing}>
              {evtSyncing ? `↻ ${t('common.saving')}` : t('panel.event')}
            </button>
          </div>
          {!evtDate && <div className="evt-popup-hint">{t('nodeRightPanel.dateRequired')}</div>}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

// ── PropertyRow ─────────────────────────────────────────────────────────────
// Fila de propiedad custom en el panel derecho.

const NODE_BUILTIN_TYPES = new Set(['bucle','agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec'])

function PropertyRow({ node, col }: { node: Node; col: { id: string; name: string; type: string; options?: Array<{ id: string; label: string; color?: string }> } }) {
  // Tag: lee de node.types[]
  if (col.type === 'tag') {
    const tags = (node.types || []).filter(t => !NODE_BUILTIN_TYPES.has(t))
    return (
      <div className="prop-custom-row">
        <span className="prop-custom-name">{col.name}</span>
        <input
          className="prop-custom-input"
          defaultValue={tags.join(' ')}
          placeholder="tag1 tag2..."
          onBlur={e => {
            const newTags = e.target.value.split(/\s+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
            const builtin = (node.types || []).filter(t => NODE_BUILTIN_TYPES.has(t))
            store.updateNode(node.id, { types: [...builtin, ...newTags] })
          }}
        />
      </div>
    )
  }
  const v = store.getPropValue(node.id, col.id)
  function commit(val: unknown) { store.setPropValue(node.id, col.id, val) }
  return (
    <div className="prop-custom-row">
      <span className="prop-custom-name">{col.name}</span>
      {col.type === 'text' && (
        <input
          className="prop-custom-input"
          defaultValue={v == null ? '' : String(v)}
          onBlur={e => commit(e.target.value || null)}
        />
      )}
      {col.type === 'number' && (
        <input
          className="prop-custom-input"
          type="number"
          defaultValue={v == null ? '' : String(v)}
          onBlur={e => commit(e.target.value === '' ? null : Number(e.target.value))}
        />
      )}
      {col.type === 'checkbox' && (
        <input
          type="checkbox"
          checked={!!v}
          onChange={e => commit(e.target.checked)}
        />
      )}
      {col.type === 'date' && (
        <input
          className="prop-custom-input"
          type="date"
          defaultValue={v ? String(v).slice(0, 10) : ''}
          onBlur={e => commit(e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : null)}
        />
      )}
      {col.type === 'url' && (
        <input
          className="prop-custom-input"
          type="url"
          defaultValue={v == null ? '' : String(v)}
          onBlur={e => commit(e.target.value || null)}
          placeholder="https://..."
        />
      )}
      {col.type === 'select' && (
        <select
          className="prop-custom-input"
          value={String(v ?? '')}
          onChange={e => commit(e.target.value || null)}
        >
          <option value="">—</option>
          {(col.options || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )}
    </div>
  )
}
