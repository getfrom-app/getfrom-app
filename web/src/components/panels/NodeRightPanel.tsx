import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { createCalendarEvent } from '../../api/googleCalendar'

interface Props {
  node: Node
}

export default function NodeRightPanel({ node }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const [newType, setNewType] = useState('')

  // ── Fecha helpers ────────────────────────────────────────────────────────
  const dueDate = node.due ? node.due.slice(0, 10) : ''
  const dueTime = node.due ? node.due.slice(11, 16) : ''
  const dueEndDate = node.dueEnd ? node.dueEnd.slice(0, 10) : ''
  const dueEndTime = node.dueEnd ? node.dueEnd.slice(11, 16) : ''

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T00:00:00`).toISOString()
    store.updateNode(node.id, { due: iso })
  }
  function setDueEnd(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { dueEnd: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T23:59:00`).toISOString()
    store.updateNode(node.id, { dueEnd: iso })
  }
  function setStatus(status: Node['status']) { store.updateNode(node.id, { status }) }
  function setPriority(priority: Node['priority']) { store.updateNode(node.id, { priority }) }
  function toggleFavorite() { store.updateNode(node.id, { isFavorite: !node.isFavorite }) }
  function toggleSeguimiento() {
    const newVal = !node.isSeguimiento
    const updates: Record<string, unknown> = { isSeguimiento: newVal }
    if (newVal && node.status !== null) updates.status = null
    store.updateNode(node.id, updates as Parameters<typeof store.updateNode>[1])
  }
  // ── Event popup ──────────────────────────────────────────────────────────
  const [showEventPopup, setShowEventPopup] = useState(false)
  const [evtPopupPos, setEvtPopupPos] = useState<{ top: number; left: number } | null>(null)
  const eventBtnRef = useRef<HTMLButtonElement>(null)
  const eventPopupRef = useRef<HTMLDivElement>(null)
  const [evtDate, setEvtDate] = useState('')
  const [evtTime, setEvtTime] = useState('09:00')
  const [evtEndDate, setEvtEndDate] = useState('')
  const [evtEndTime, setEvtEndTime] = useState('10:00')
  const [evtLocation, setEvtLocation] = useState('')
  const [evtSyncing, setEvtSyncing] = useState(false)
  const [evtMsg, setEvtMsg] = useState<string | null>(null)

  // Cierra popup al hacer click fuera
  useEffect(() => {
    if (!showEventPopup) return
    function handler(e: MouseEvent) {
      if (
        eventPopupRef.current && !eventPopupRef.current.contains(e.target as globalThis.Node) &&
        (!eventBtnRef.current || !eventBtnRef.current.contains(e.target as globalThis.Node))
      ) setShowEventPopup(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEventPopup])

  function openEventPopup() {
    if (node.isEvent) {
      // Si ya es evento, lo quita directamente
      store.updateNode(node.id, { isEvent: false })
      return
    }
    const rect = eventBtnRef.current?.getBoundingClientRect()
    if (rect) setEvtPopupPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 280) })
    // Pre-rellenar con datos existentes del nodo
    setEvtDate(node.due ? node.due.slice(0, 10) : '')
    setEvtTime(node.due ? node.due.slice(11, 16) || '09:00' : '09:00')
    setEvtEndDate(node.dueEnd ? node.dueEnd.slice(0, 10) : '')
    setEvtEndTime(node.dueEnd ? node.dueEnd.slice(11, 16) || '10:00' : '10:00')
    try { setEvtLocation(JSON.parse(node.extraData || '{}').location || '') } catch { setEvtLocation('') }
    setEvtMsg(null)
    setShowEventPopup(true)
  }

  async function saveEvent() {
    if (!evtDate) return
    const startIso = new Date(`${evtDate}T${evtTime || '09:00'}:00`).toISOString()
    const endIso = evtEndDate
      ? new Date(`${evtEndDate}T${evtEndTime || '10:00'}:00`).toISOString()
      : new Date(new Date(startIso).getTime() + 3600000).toISOString()
    // Actualizar nodo
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    if (evtLocation.trim()) ed.location = evtLocation.trim()
    else delete ed.location
    store.updateNode(node.id, {
      isEvent: true,
      status: 'pending',
      due: startIso,
      dueEnd: evtEndDate ? endIso : null,
      extraData: JSON.stringify(ed),
    })
    // Sincronizar con Google Calendar
    setEvtSyncing(true)
    setEvtMsg(null)
    try {
      const result = await createCalendarEvent({
        title: node.text || 'Evento',
        start: startIso,
        end: endIso,
        description: node.body || undefined,
      })
      let ed2: Record<string, unknown> = {}
      try { ed2 = JSON.parse(node.extraData || '{}') } catch {}
      ed2.gcalEventId = result.id
      if (evtLocation.trim()) ed2.location = evtLocation.trim()
      store.updateNode(node.id, { extraData: JSON.stringify(ed2) })
      setEvtMsg('✓ Sincronizado con Google Calendar')
    } catch {
      setEvtMsg('Evento guardado (sin sincronización GCal)')
    } finally {
      setEvtSyncing(false)
    }
    setTimeout(() => setShowEventPopup(false), 1200)
  }

  const evtLocation_stored = (() => { try { return JSON.parse(node.extraData || '{}').location || '' } catch { return '' } })()
  const gcalEventId = (() => { try { return JSON.parse(node.extraData || '{}').gcalEventId || null } catch { return null } })()

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
    { value: null, label: '○ Sin estado' },
    { value: 'pending', label: '● Pendiente' },
    { value: 'future', label: '◆ Futuro' },
    { value: 'done', label: '✓ Hecho' },
  ]
  const priorityOptions: { value: Node['priority']; label: string; style?: React.CSSProperties }[] = [
    { value: null, label: '— Ninguna' },
    { value: 'low', label: '▽ Baja' },
    { value: 'medium', label: '△ Media', style: { color: '#f59e0b' } },
    { value: 'high', label: '▲ Alta', style: { color: '#ef4444' } },
  ]
  // Helpers para repetición flexible (x días, x semanas, etc.)
  const recUnits: [string, string][] = [['daily', 'días'], ['weekly', 'sem.'], ['monthly', 'meses'], ['yearly', 'años']]
  function parseRec(r: string | null | undefined) {
    if (!r) return { n: 1, unit: 'daily' }
    const [unit, nStr] = r.split(':')
    return { n: parseInt(nStr || '1') || 1, unit }
  }
  function applyRec(n: number, unit: string) {
    const safe = Math.max(1, Math.round(n) || 1)
    store.updateNode(node.id, { recurrence: safe === 1 ? unit : `${unit}:${safe}` })
  }
  const nodeColor = (() => { try { return JSON.parse(node.extraData || '{}').color || null } catch { return null } })()
  const colors = [null, '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
  function setColor(color: string | null) {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (color) ed.color = color; else delete ed.color
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch {
      if (color) store.updateNode(node.id, { extraData: JSON.stringify({ color }) })
    }
  }

  return (
    <>
    <div className="node-right-panel">

      {/* Ver área completa — solo cuando hay tag definitions */}
      {tagNodes.map(td => (
        <div key={td.id} className="prop-section">
          <button className="prop-area-link" onClick={() => navigate(`/node/${td.id}`)}>
            <span className="prop-area-link-icon">◈</span>
            <span>{s.tagName(td)}</span>
            <span className="prop-area-link-arrow">→</span>
          </button>
        </div>
      ))}

      {/* ── Acciones rápidas ─────────────────────────────────────────────── */}
      <div className="prop-row">
        <button className={`prop-icon-btn ${node.isFavorite ? 'active' : ''}`} onClick={toggleFavorite} title="Fijar">
          📌 Fijado
        </button>
        <button
          className={`prop-icon-btn ${node.status !== null && !node.isSeguimiento ? 'active' : ''}`}
          onClick={() => {
            if (node.status !== null && !node.isSeguimiento) {
              store.updateNode(node.id, { status: null })
            } else {
              store.updateNode(node.id, { status: 'pending', isSeguimiento: false })
            }
          }}
          title="Tarea"
        >
          ○ Tarea
        </button>
        <button
          ref={eventBtnRef}
          className={`prop-icon-btn ${node.isEvent ? 'active event' : ''}`}
          onClick={openEventPopup}
          title={node.isEvent ? 'Quitar evento' : 'Convertir en evento'}
        >
          📅 Evento
        </button>
        <button className={`prop-icon-btn ${isLocked ? 'active' : ''}`} onClick={toggleLocked} title={isLocked ? 'Desbloquear' : 'Bloquear'}>
          {isLocked ? '🔒' : '🔓'} {isLocked ? 'Bloqueado' : 'Bloquear'}
        </button>
      </div>

      {/* ── Estado ──────────────────────────────────────────────────────────── */}
      {(node.status !== null || node.isSeguimiento) && (
        <div className="prop-section">
          <div className="prop-section-label">Estado</div>
          {node.isSeguimiento && node.status !== 'done' ? (
            // Seguimiento activo
            <div className="prop-pills">
              <button className="prop-pill active" onClick={() => store.updateNode(node.id, { status: null })}>
                ● Activo
              </button>
              <button className="prop-pill" onClick={() => store.updateNode(node.id, { status: 'done' })}>
                ✓ Completado
              </button>
            </div>
          ) : node.isSeguimiento ? (
            // Seguimiento completado
            <div className="prop-pills">
              <button className="prop-pill" onClick={() => store.updateNode(node.id, { status: null })}>
                ● Activo
              </button>
              <button className="prop-pill active" onClick={() => store.updateNode(node.id, { status: 'done' })}>
                ✓ Completado
              </button>
            </div>
          ) : (
            // Tarea: Sin estado / Pendiente / Hecho
            <div className="prop-pills">
              {statusOptions.map(opt => (
                <button key={String(opt.value)} className={`prop-pill ${node.status === opt.value ? 'active' : ''}`} onClick={() => setStatus(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Prioridad ───────────────────────────────────────────────────────── */}
      {node.status !== null && !node.isSeguimiento && (
        <div className="prop-section">
          <div className="prop-section-label">Prioridad</div>
          <div className="prop-pills">
            {priorityOptions.map(opt => (
              <button key={String(opt.value)} className={`prop-pill ${node.priority === opt.value ? 'active' : ''}`} onClick={() => setPriority(opt.value)} style={opt.style}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Fecha ───────────────────────────────────────────────────────────── */}
      {node.status !== null && !node.isSeguimiento && (
        <div className="prop-section">
          <div className="prop-section-label">Fecha</div>
          <div className="prop-quick-dates">
            {[
              { label: 'Hoy', days: 0 },
              { label: 'Mañana', days: 1 },
              { label: 'Prx. lunes', days: (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })() },
              { label: 'Prx. semana', days: 7 },
            ].map(({ label, days }) => {
              const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0)
              const iso = d.toISOString().slice(0, 10)
              return (
                <button key={label} className={`prop-quick-date-btn ${dueDate === iso ? 'active' : ''}`} onClick={() => setDue(iso, dueTime || '09:00')}>
                  {label}
                </button>
              )
            })}
            {dueDate && <button className="prop-quick-date-btn" onClick={() => setDue('', '')}>✕</button>}
          </div>
          <div className="prop-datetime" style={{ marginTop: 6 }}>
            <input type="date" className="prop-date-input" value={dueDate} onChange={e => setDue(e.target.value, dueTime)} />
            <input type="time" className="prop-time-input" value={dueTime} onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} />
          </div>
        </div>
      )}

      {/* ── Propiedades de evento ────────────────────────────────────────── */}
      {node.isEvent && (
        <div className="prop-section prop-section--event">
          <div className="prop-section-label">
            📅 Evento
            {gcalEventId && <span className="prop-gcal-badge" title="Sincronizado con Google Calendar">GCal ✓</span>}
          </div>

          {/* Fecha inicio */}
          <div className="prop-event-row">
            <span className="prop-event-field-label">Inicio</span>
            <div className="prop-datetime">
              <input type="date" className="prop-date-input" value={dueDate}
                onChange={e => setDue(e.target.value, dueTime)} />
              <input type="time" className="prop-time-input" value={dueTime}
                onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} />
            </div>
          </div>

          {/* Fecha fin */}
          <div className="prop-event-row">
            <span className="prop-event-field-label">Fin</span>
            <div className="prop-datetime">
              <input type="date" className="prop-date-input" value={dueEndDate}
                onChange={e => setDueEnd(e.target.value, dueEndTime)} />
              <input type="time" className="prop-time-input" value={dueEndTime}
                onChange={e => setDueEnd(dueEndDate, e.target.value)} disabled={!dueEndDate} />
            </div>
          </div>

          {/* Localización */}
          <div className="prop-event-row">
            <span className="prop-event-field-label">Lugar</span>
            <input
              type="text"
              className="prop-event-location"
              value={evtLocation_stored}
              placeholder="Añadir lugar..."
              onChange={e => {
                let ed: Record<string, unknown> = {}
                try { ed = JSON.parse(node.extraData || '{}') } catch {}
                if (e.target.value.trim()) ed.location = e.target.value
                else delete ed.location
                store.updateNode(node.id, { extraData: JSON.stringify(ed) })
              }}
            />
          </div>

          {/* Acción: (re)sincronizar con GCal */}
          <button
            className="prop-event-sync-btn"
            onClick={async () => {
              if (!node.due) return
              const endFallback = node.dueEnd || new Date(new Date(node.due).getTime() + 3600000).toISOString()
              setEvtSyncing(true)
              setEvtMsg(null)
              try {
                await createCalendarEvent({
                  title: node.text || 'Evento',
                  start: node.due,
                  end: endFallback,
                  description: node.body || undefined,
                })
                setEvtMsg('✓ Sincronizado con Google Calendar')
              } catch {
                setEvtMsg('No conectado a Google Calendar')
              } finally {
                setEvtSyncing(false)
              }
            }}
            disabled={evtSyncing || !node.due}
          >
            {evtSyncing ? '↻ Sincronizando...' : '↑ Sincronizar con Google Calendar'}
          </button>
          {evtMsg && <div className="prop-event-msg">{evtMsg}</div>}
        </div>
      )}

      {/* ── Fecha fin standalone (solo si no es evento) ───────────────── */}
      {!node.isEvent && node.dueEnd && (
        <div className="prop-section">
          <div className="prop-section-label">Fecha fin</div>
          <div className="prop-datetime">
            <input type="date" className="prop-date-input" value={dueEndDate} onChange={e => setDueEnd(e.target.value, dueEndTime)} />
            <input type="time" className="prop-time-input" value={dueEndTime} onChange={e => setDueEnd(dueEndDate, e.target.value)} disabled={!dueEndDate} />
          </div>
        </div>
      )}

      {/* ── Repetición ──────────────────────────────────────────────────────── */}
      {node.status !== null && !node.isSeguimiento && (
        <div className="prop-section">
          <div className="prop-section-label">Repetición</div>
          <div className="prop-rec-row">
            {/* Sin repetición */}
            <button
              className={`prop-pill${!node.recurrence ? ' active' : ''}`}
              onClick={() => store.updateNode(node.id, { recurrence: null })}
            >–</button>
            {/* Número */}
            <input
              type="number"
              className="prop-rec-n"
              min={1} max={999}
              value={node.recurrence ? parseRec(node.recurrence).n : 1}
              onChange={e => {
                const n = Math.max(1, parseInt(e.target.value) || 1)
                const unit = node.recurrence ? parseRec(node.recurrence).unit : 'daily'
                applyRec(n, unit)
              }}
              disabled={!node.recurrence}
            />
            {/* Unidades */}
            {recUnits.map(([unit, label]) => (
              <button
                key={unit}
                className={`prop-pill${node.recurrence && parseRec(node.recurrence).unit === unit ? ' active' : ''}`}
                onClick={() => applyRec(node.recurrence ? parseRec(node.recurrence).n : 1, unit)}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Color ───────────────────────────────────────────────────────────── */}
      <div className="prop-section">
        <div className="prop-section-label">Color</div>
        <div className="prop-color-chips">
          {colors.map(c => (
            <button key={c || 'none'} className={`prop-color-chip ${(nodeColor || null) === c ? 'active' : ''}`} style={{ background: c || 'transparent', border: c ? 'none' : '1px solid var(--border)' }} onClick={() => setColor(c)} title={c || 'Sin color'}>
              {!c && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>✕</span>}
            </button>
          ))}
        </div>
      </div>

    </div>

    {/* ── Popup creación de evento (portal) ─────────────────────────── */}
    {showEventPopup && evtPopupPos && createPortal(
      <div
        ref={eventPopupRef}
        className="evt-popup"
        style={{ position: 'fixed', top: evtPopupPos.top, left: evtPopupPos.left, zIndex: 400 }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="evt-popup-title">📅 Nuevo evento</div>

        {/* Fecha inicio */}
        <div className="evt-popup-row">
          <span className="evt-popup-label">Inicio</span>
          <div className="evt-popup-inputs">
            <input type="date" className="nqp-date-input" value={evtDate}
              onChange={e => setEvtDate(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && evtDate) saveEvent() }}
              autoFocus
            />
            <input type="time" className="nqp-time-input" value={evtTime}
              onChange={e => setEvtTime(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && evtDate) saveEvent() }}
              disabled={!evtDate}
            />
          </div>
        </div>

        {/* Fecha fin */}
        <div className="evt-popup-row">
          <span className="evt-popup-label">Fin</span>
          <div className="evt-popup-inputs">
            <input type="date" className="nqp-date-input" value={evtEndDate}
              onChange={e => setEvtEndDate(e.target.value)}
              disabled={!evtDate}
            />
            <input type="time" className="nqp-time-input" value={evtEndTime}
              onChange={e => setEvtEndTime(e.target.value)}
              disabled={!evtEndDate}
            />
          </div>
        </div>

        {/* Lugar */}
        <div className="evt-popup-row">
          <span className="evt-popup-label">Lugar</span>
          <input type="text" className="evt-popup-location" value={evtLocation}
            onChange={e => setEvtLocation(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && evtDate) saveEvent() }}
            placeholder="Localización (opcional)"
          />
        </div>

        {/* Mensaje estado */}
        {evtMsg && <div className={`evt-popup-msg${evtMsg.startsWith('✓') ? ' ok' : ''}`}>{evtMsg}</div>}

        {/* Acciones */}
        <div className="evt-popup-actions">
          <button className="evt-popup-cancel" onClick={() => setShowEventPopup(false)}>Cancelar</button>
          <button
            className="evt-popup-save"
            onClick={saveEvent}
            disabled={!evtDate || evtSyncing}
          >
            {evtSyncing ? '↻ Guardando...' : '📅 Guardar evento'}
          </button>
        </div>

        {!evtDate && (
          <div className="evt-popup-hint">Se requiere una fecha para crear el evento</div>
        )}
      </div>,
      document.body
    )}
    </>
  )
}
