/**
 * PlannerPanel — Panel lateral derecho de planificación temporal.
 *
 * Se abre desde el botón de calendario en el top-bar.
 * Muestra únicamente el timeline (Día / Semana / Mes) sin columna de tareas:
 * el árbol central de From sirve como lista de tareas.
 *
 * Redimensionable arrastrando el borde izquierdo.
 * Time blocks: nodos _timeBlock:"1". GCal events como time blocks.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import { getCalendarEventsRange, type CalendarEvent } from '../../api/googleCalendar'
import { GCalEventEditor } from './DiaryRightPanel'
import { useUserStore } from '../../store/userStore'

// ── Geometría fija ────────────────────────────────────────────────────────
const HOUR_START    = 6
const HOUR_END      = 24
const TOTAL_HOURS   = HOUR_END - HOUR_START
const AXIS_W        = 40
const DEFAULT_W     = 420
const MIN_W         = 280
const MAX_W         = 900
const DEFAULT_SLOT_H  = 40   // px por 30 min (zoom por defecto)
const DEFAULT_DAY_CNT = 5    // columnas de día visibles por defecto
const MIN_SLOT_H    = 14     // zoom out máximo (18h en pantalla pequeña)
const MAX_SLOT_H    = 110    // zoom in máximo (~3h visibles)
const MIN_DAY_CNT   = 2
const MAX_DAY_CNT   = 7
const PRE_DAYS      = 10     // días pre-renderizados a cada lado

// ── Helpers ────────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
function fmtHH(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

const DAYS_S   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MONTHS_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function dayLabel(d: Date) { return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}` }

type ViewMode = 'day' | 'year'
interface Block { kind:'task'|'standalone'|'gcal'; id:string; text:string; start:Date; end:Date; color:string; linkedId?:string; gcalEvent?:CalendarEvent }

// ── Leer time blocks ───────────────────────────────────────────────────────
function getBlocks(day: Date, gcalEvents: CalendarEvent[]): Block[] {
  const blocks: Block[] = []
  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt) continue
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (ed._timeBlock !== '1') continue
      const start = new Date(n.due)
      if (!sameDay(start, day)) continue
      const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
      const linked = ed._linkedTaskId ? store.getNode(ed._linkedTaskId) : null
      blocks.push({ kind: ed._linkedTaskId ? 'task' : 'standalone', id: n.id,
        text: linked ? linked.text : n.text, start, end,
        color: ed._linkedTaskId ? 'var(--accent)' : '#8b5cf6', linkedId: ed._linkedTaskId })
    } catch {}
  }
  for (const ev of gcalEvents) {
    if (ev.allDay) continue
    const start = new Date(ev.start)
    if (!sameDay(start, day)) continue
    blocks.push({ kind:'gcal', id:ev.id, text:ev.title, start, end: new Date(ev.end),
      color: ev.backgroundColor || '#4a90d9', gcalEvent: ev })
  }
  return blocks.sort((a,b) => a.start.getTime() - b.start.getTime())
}

// ══════════════════════════════════════════════════════════════════════════
// PlannerPanel
// ══════════════════════════════════════════════════════════════════════════

interface Props { onClose: () => void }

export default function PlannerPanel({ onClose }: Props) {
  const s        = useStore()
  const us       = useUserStore()
  const navigate = useNavigate()

  const today = startOfDay(new Date())
  const [viewMode,       setViewMode]       = useState<ViewMode>('day')
  const [centerDate,     setCenterDate]     = useState(today)
  // Zoom vertical (altura de slot 30 min) y horizontal (días visibles)
  const [slotH,          setSlotH]          = useState(DEFAULT_SLOT_H)
  const [visibleDayCnt,  setVisibleDayCnt]  = useState(DEFAULT_DAY_CNT)

  // Geometría derivada del zoom actual
  const hourH    = slotH * 2
  const pxPerMin = slotH / 30
  const snapPx   = (y: number) => Math.round(y / (slotH / 2)) * (slotH / 2)
  const topPx    = (d: Date)   => Math.max(0, (d.getHours()*60 + d.getMinutes() - HOUR_START*60) * pxPerMin)
  const heightPx = (s: number, e: number) => Math.max(slotH/2, (e-s)/60000 * pxPerMin)
  const pxToTime = (px: number, day: Date) => {
    const mins = snapPx(Math.max(0, px)) / pxPerMin + HOUR_START * 60
    const d = new Date(day); d.setHours(Math.floor(mins/60), Math.min(59, mins%60), 0, 0); return d
  }
  const [gcalEvents,  setGcalEvents]  = useState<CalendarEvent[]>([])
  const [editingGcal, setEditingGcal] = useState<CalendarEvent | null>(null)
  const [ctxMenu, setCtxMenu]         = useState<{x:number;y:number;b:Block}|null>(null)
  // Bloque inline en creación: posición + texto en progreso
  const [newBlock, setNewBlock]       = useState<{day:Date;start:Date;top:number;text:string}|null>(null)
  const newBlockRef                   = useRef<HTMLInputElement>(null)

  // ── Ancho con resize ──────────────────────────────────────────────────────
  const [panelW, setPanelW] = useState(() => {
    const saved = localStorage.getItem('planner-panel-w')
    return saved ? Math.max(MIN_W, Math.min(MAX_W, parseInt(saved))) : DEFAULT_W
  })
  const resizingW = useRef(false)

  function handleResizeBarDown(e: React.MouseEvent) {
    e.preventDefault()
    resizingW.current = true
    const startX = e.clientX
    const startW = panelW
    function onMove(ev: MouseEvent) {
      if (!resizingW.current) return
      const delta = startX - ev.clientX   // arrastra izquierda → más ancho
      const newW  = Math.max(MIN_W, Math.min(MAX_W, startW + delta))
      setPanelW(newW)
    }
    function onUp() {
      resizingW.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem('planner-panel-w', String(panelW))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── GCal ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!us.googleConnected) return
    getCalendarEventsRange(addDays(centerDate,-14), addDays(centerDate,14)).then(setGcalEvents).catch(()=>{})
  }, [us.googleConnected, centerDate.toDateString()]) // eslint-disable-line

  // ── colW dinámico ─────────────────────────────────────────────────────────
  const [colW, setColW] = useState(120)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function update() {
      if (!timelineRef.current) return
      const avail = timelineRef.current.clientWidth - AXIS_W - 2
      setColW(Math.max(60, Math.floor(avail / visibleDayCnt)))
    }
    update()
    const ro = new ResizeObserver(update)
    if (timelineRef.current) ro.observe(timelineRef.current)
    return () => ro.disconnect()
  }, [panelW, visibleDayCnt])

  // ── Drag eje vertical → zoom Y ────────────────────────────────────────────
  function handleAxisDrag(e: React.MouseEvent) {
    e.preventDefault()
    const startY     = e.clientY
    const startSlotH = slotH
    const scrollEl   = scrollVRef.current
    const scrollFrac = scrollEl ? scrollEl.scrollTop / (TOTAL_HOURS * startSlotH * 2) : 0
    function onMove(ev: MouseEvent) {
      const delta   = startY - ev.clientY   // arriba = zoom in
      const newSlot = Math.max(MIN_SLOT_H, Math.min(MAX_SLOT_H, startSlotH + delta * 0.5))
      setSlotH(newSlot)
      if (scrollEl) scrollEl.scrollTop = scrollFrac * TOTAL_HOURS * newSlot * 2
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Drag cabecera → zoom X ────────────────────────────────────────────────
  function handleHeadersDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.pp-col-head')) return
    e.preventDefault()
    const startX   = e.clientX
    const startCnt = visibleDayCnt
    function onMove(ev: MouseEvent) {
      const steps = Math.round((ev.clientX - startX) / 40)  // derecha = menos días
      setVisibleDayCnt(Math.max(MIN_DAY_CNT, Math.min(MAX_DAY_CNT, startCnt + steps)))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function resetZoom() { setSlotH(DEFAULT_SLOT_H); setVisibleDayCnt(DEFAULT_DAY_CNT) }

  // ── Días visibles — pre-renderizamos PRE_DAYS a cada lado ────────────────
  const visibleDays = useMemo(() =>
    Array.from({ length: PRE_DAYS*2+1 }, (_, i) => addDays(centerDate, i - PRE_DAYS))
  , [centerDate.toDateString()]) // eslint-disable-line

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollHRef = useRef<HTMLDivElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const scrollVRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (viewMode !== 'day' || !scrollHRef.current) return
    const pos = Math.max(0, PRE_DAYS * colW - (scrollHRef.current.clientWidth - AXIS_W) / 2 + colW / 2)
    scrollHRef.current.scrollLeft = pos
    if (headRef.current) headRef.current.scrollLeft = pos
  }, [viewMode, centerDate.toDateString(), colW]) // eslint-disable-line

  useEffect(() => {
    const grid = scrollHRef.current; if (!grid) return
    const sync = () => { if (headRef.current) headRef.current.scrollLeft = grid.scrollLeft }
    grid.addEventListener('scroll', sync, {passive:true})
    return () => grid.removeEventListener('scroll', sync)
  }, [viewMode])

  useLayoutEffect(() => {
    if (!scrollVRef.current) return
    scrollVRef.current.scrollTop = Math.max(0, topPx(new Date()) - 100)
  }, [viewMode])

  // ── Refs para drag/resize de bloques ─────────────────────────────────────
  const justResized = useRef(false)
  const justDragged = useRef(false)
  const resizeRef   = useRef<{id:string}|null>(null)

  // ── Drop en columna ───────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, day: Date, colEl: HTMLElement) {
    e.preventDefault()
    const taskId  = e.dataTransfer.getData('plannerTaskId') || e.dataTransfer.getData('nodeId')
    const blockId = e.dataTransfer.getData('plannerBlockId')
    const rect    = colEl.getBoundingClientRect()

    if (taskId) {
      const rawY = e.clientY - rect.top
      const start = pxToTime(rawY, day)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
      const node = store.getNode(taskId)
      if (!node) return
      const diaryNode = ensureDayPath(day)

      // Solo mover al nuevo día si es una TAREA (status !== null) bajo otro diary day
      if (node.status !== null) {
        let curParent = node.parentId ? store.getNode(node.parentId) : null
        while (curParent) {
          if (curParent.isDiaryEntry) {
            if (!sameDay(new Date(curParent.diaryDate!), day)) store.updateNode(taskId, { parentId: diaryNode.id })
            break
          }
          curParent = curParent.parentId ? store.getNode(curParent.parentId) : null
        }
      }
      // Para cualquier nodo (tarea, proyecto, nota…): crear time block vinculado
      store.createNode({ text: node.text || 'Time block', parentId: diaryNode.id,
        due: start.toISOString(), extraData: { _timeBlock:'1', _linkedTaskId: taskId } })
    } else if (blockId) {
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const start   = pxToTime(e.clientY - rect.top - offsetY, day)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
      const n = store.getNode(blockId)
      if (!n?.due) return
      const dur = n.dueEnd ? new Date(n.dueEnd).getTime() - new Date(n.due).getTime() : 3600000
      store.updateNode(blockId, { due: start.toISOString(), dueEnd: new Date(start.getTime()+dur).toISOString(),
        parentId: ensureDayPath(day).id })
    }
  }

  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if ((e.target as HTMLElement).closest('.pp-block') || (e.target as HTMLElement).closest('.pp-new-block')) return
    const rawY  = e.clientY - colEl.getBoundingClientRect().top
    const start = pxToTime(rawY, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    setNewBlock({ day, start, top: snapPx(rawY), text: '' })
    setTimeout(() => newBlockRef.current?.focus(), 20)
  }

  function commitNewBlock() {
    if (!newBlock) return
    if (newBlock.text.trim()) {
      store.createNode({
        text:      newBlock.text.trim(),
        parentId:  ensureDayPath(newBlock.day).id,
        due:       newBlock.start.toISOString(),
        extraData: { _timeBlock: '1' },
      })
    }
    setNewBlock(null)
  }

  // ── Drag bloque ───────────────────────────────────────────────────────────
  function handleBlockDragStart(e: React.DragEvent, b: Block) {
    if (b.kind === 'gcal') { e.preventDefault(); return }
    const el = e.currentTarget as HTMLElement
    e.dataTransfer.setData('plannerBlockId', b.id)
    e.dataTransfer.setData('plannerBlockOffsetY', String(Math.round(e.clientY - el.getBoundingClientRect().top)))
    e.dataTransfer.effectAllowed = 'move'
    justDragged.current = false
    const onEnd = () => { justDragged.current = true; setTimeout(()=>{justDragged.current=false},200); el.removeEventListener('dragend',onEnd) }
    el.addEventListener('dragend', onEnd)
  }

  // ── Resize bloque ─────────────────────────────────────────────────────────
  function handleBlockResize(e: React.MouseEvent, blockId: string) {
    e.stopPropagation(); e.preventDefault()
    resizeRef.current = { id: blockId }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const el = document.querySelector(`[data-pp-block="${resizeRef.current.id}"]`) as HTMLElement
      const col = el?.closest('.pp-col') as HTMLElement
      if (!el || !col) return
      const n = store.getNode(resizeRef.current.id)
      if (!n?.due) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(n.due)))
      el.style.height = h + 'px'
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const { id } = resizeRef.current; resizeRef.current = null
      const n = store.getNode(id); if (!n?.due) return
      const col = document.querySelector(`[data-pp-block="${id}"]`)?.closest('.pp-col') as HTMLElement
      if (!col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(n.due)))
      store.updateNode(id, { dueEnd: new Date(new Date(n.due).getTime() + h/pxPerMin*60000).toISOString() })
      justResized.current = true; setTimeout(()=>{justResized.current=false}, 200)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Render bloque ─────────────────────────────────────────────────────────
  function renderBlock(b: Block) {
    const canDrag = b.kind !== 'gcal'
    return (
      <div key={b.id} data-pp-block={b.id}
        className={`pp-block pp-block--${b.kind}`}
        style={{ top: topPx(b.start), height: heightPx(b.start.getTime(), b.end.getTime()),
          background: b.color, left: 2, right: 2 }}
        draggable={canDrag}
        onDragStart={e => handleBlockDragStart(e, b)}
        onClick={e => {
          e.stopPropagation()
          if (justResized.current || justDragged.current) return
          if (b.kind === 'gcal' && b.gcalEvent) setEditingGcal(b.gcalEvent)
          else if (b.linkedId) navigate(`/node/${b.linkedId}`)  // cualquier nodo vinculado
        }}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({x:e.clientX,y:e.clientY,b}) }}
        title={`${b.text}\n${fmtHH(b.start)} – ${fmtHH(b.end)}`}
      >
        <div className="pp-block-time">{fmtHH(b.start)}</div>
        <div className="pp-block-text">{b.text || 'Sin título'}</div>
        {canDrag && <div className="pp-block-resize" onMouseDown={e=>handleBlockResize(e,b.id)} />}
      </div>
    )
  }

  // ── Render columna ────────────────────────────────────────────────────────
  function renderCol(day: Date) {
    const isToday  = sameDay(day, today)
    const isCenter = sameDay(day, centerDate)
    const nowTop   = topPx(new Date())
    return (
      <div key={day.toISOString()} className="pp-col-wrap" style={{ width: colW, flexShrink: 0 }}>
        <div className="pp-col" style={{ height: TOTAL_HOURS * hourH }}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>handleDrop(e, day, e.currentTarget)}
          onClick={e=>handleSlotClick(e, day, e.currentTarget)}
        >
          {Array.from({length: TOTAL_HOURS*4}, (_,i) => (
            <div key={i} className={`pp-slot ${i%4===0?'pp-slot--hr':i%2===0?'pp-slot--half':'pp-slot--qtr'}`} style={{top: i*(slotH/2)}} />
          ))}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS*hourH && <div className="pp-now" style={{top:nowTop}} />}
          {getBlocks(day, gcalEvents).map(renderBlock)}

          {/* Bloque inline en creación */}
          {newBlock && sameDay(newBlock.day, day) && (
            <div
              className="pp-new-block"
              style={{ top: newBlock.top, left: 2, right: 2 }}
            >
              <div className="pp-block-time">{fmtHH(newBlock.start)}</div>
              <input
                ref={newBlockRef}
                className="pp-new-block-input"
                value={newBlock.text}
                placeholder="Nombre…"
                onChange={e => setNewBlock(b => b ? {...b, text: e.target.value} : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewBlock() }
                  if (e.key === 'Escape') setNewBlock(null)
                }}
                onBlur={commitNewBlock}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Año — cuadrícula 3×4 con los 12 meses ────────────────────────────────
  function renderYear() {
    const year = centerDate.getFullYear()
    return (
      <div className="pp-year-grid">
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const firstOfMonth = new Date(year, monthIdx, 1)
          const totalDays    = daysInMonth(firstOfMonth)
          const firstDow     = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
          const cells: (number | null)[] = []
          for (let i = 0; i < firstDow; i++) cells.push(null)
          for (let d = 1; d <= totalDays; d++) cells.push(d)

          return (
            <div key={monthIdx} className="pp-year-month">
              {/* Nombre del mes */}
              <div className="pp-year-month-name">{MONTHS_L[monthIdx]}</div>
              {/* Cabecera días de la semana */}
              <div className="pp-year-dow-row">
                {['L','M','X','J','V','S','D'].map(d => (
                  <div key={d} className="pp-year-dow">{d}</div>
                ))}
              </div>
              {/* Días */}
              <div className="pp-year-days">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="pp-year-day pp-year-day--empty" />
                  const date    = new Date(year, monthIdx, d)
                  const isTod   = sameDay(date, today)
                  const hasGcal = gcalEvents.some(ev => !ev.allDay && sameDay(new Date(ev.start), date))
                  return (
                    <div
                      key={d}
                      className={`pp-year-day ${isTod ? 'pp-year-day--today' : ''}`}
                      onClick={() => { setCenterDate(startOfDay(date)); setViewMode('day') }}
                      title={date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })}
                    >
                      {d}
                      {hasGcal && <div className="pp-year-day-dot" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Nav title ─────────────────────────────────────────────────────────────
    const navTitle = viewMode === 'day'
    ? centerDate.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })
    : `${centerDate.getFullYear()}`

  function navDelta(d: number) {
    setCenterDate(prev => viewMode === 'day'
      ? addDays(prev, d)
      : new Date(prev.getFullYear() + d, prev.getMonth(), 1)
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pp-root" style={{ width: panelW }}>
      {/* Drag handle — borde izquierdo */}
      <div className="pp-resize-bar" onMouseDown={handleResizeBarDown} />

      {/* Header */}
      <div className="pp-header">
        <div className="pp-view-tabs">
          {(['day','year'] as ViewMode[]).map(m => (
            <button key={m} className={`pp-tab ${viewMode===m?'pp-tab--active':''}`} onClick={()=>setViewMode(m)}>
              {m==='day'?'Día':'Año'}
            </button>
          ))}
        </div>
        <button className="pp-nav-btn" onClick={()=>navDelta(-1)}>‹</button>
        <span className="pp-nav-title">{navTitle}</span>
        <button className="pp-nav-btn" onClick={()=>navDelta(1)}>›</button>
        <button className="pp-today-btn" onClick={()=>setCenterDate(today)}>Hoy</button>
        <button className="pp-close-btn" onClick={onClose} title="Cerrar">×</button>
      </div>

      {/* Timeline */}
      <div className="pp-timeline" ref={scrollVRef}>
        {viewMode === 'year' ? renderYear() : (
          <>
            {/* Cabeceras sync */}
            <div className="pp-heads" ref={headRef} onMouseDown={handleHeadersDrag}
              title="Arrastra izq/der para ver más/menos días (2–7)">
              {/* Esquina reset — clic restablece zoom por defecto */}
              <div className="pp-zoom-reset" style={{width: AXIS_W, flexShrink:0}}
                onClick={e => { e.stopPropagation(); resetZoom() }}
                title={`Reset zoom — ${visibleDayCnt} días · ${Math.round(slotH)}px/30min`}>
                ⊙
              </div>
              {visibleDays.map(d => (
                <div key={d.toISOString()} className={`pp-col-head ${sameDay(d,today)?'pp-col-head--today':''} ${sameDay(d,centerDate)?'pp-col-head--center':''}`}
                  style={{width:colW, flexShrink:0}}>
                  {dayLabel(d)}
                </div>
              ))}
            </div>
            {/* Grid horizontal */}
            <div className={`pp-grid ${viewMode==='day'?'pp-grid--scroll':''}`} ref={el => { (scrollHRef as any).current = el; (timelineRef as any).current = el }}>
              <div className="pp-axis" style={{width:AXIS_W, height: TOTAL_HOURS*hourH}}
                onMouseDown={handleAxisDrag} title="Arrastra arriba/abajo para hacer zoom">
                {Array.from({length:TOTAL_HOURS+1},(_,i) => (
                  <div key={i} className="pp-axis-label" style={{top: i*hourH-8}}>
                    {String(HOUR_START+i).padStart(2,'0')}:00
                  </div>
                ))}
              </div>
              <div style={{display:'flex'}}>
                {visibleDays.map(d => renderCol(d))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:998}} onClick={()=>setCtxMenu(null)} />
          <div className="pp-ctx" style={{left:ctxMenu.x,top:ctxMenu.y}}>
            {ctxMenu.b.kind==='gcal' && <button onClick={()=>{ const d=ensureDayPath(ctxMenu.b.start); store.createNode({text:ctxMenu.b.text,parentId:d.id}); setCtxMenu(null) }}>📄 Crear nodo</button>}
            {ctxMenu.b.kind==='task' && ctxMenu.b.linkedId && <button onClick={()=>{navigate(`/node/${ctxMenu.b.linkedId!}`);setCtxMenu(null)}}>→ Ir a la tarea</button>}
            {ctxMenu.b.kind==='standalone' && <button onClick={()=>{ const d=ensureDayPath(ctxMenu.b.start); store.createNode({text:ctxMenu.b.text,parentId:d.id,isTask:true}); store.deleteNode(ctxMenu.b.id); setCtxMenu(null) }}>✓ Convertir a tarea</button>}
            {ctxMenu.b.kind!=='gcal' && <button className="pp-ctx-danger" onClick={()=>{store.deleteNode(ctxMenu.b.id);setCtxMenu(null)}}>Eliminar time block</button>}
          </div>
        </>
      )}

      {editingGcal && (
        <GCalEventEditor event={editingGcal} modal onClose={()=>setEditingGcal(null)}
          onUpdated={ev=>{setGcalEvents(p=>p.map(x=>x.id===ev.id?ev:x));setEditingGcal(null)}}
          onDeleted={id=>{setGcalEvents(p=>p.filter(x=>x.id!==id));setEditingGcal(null)}} />
      )}
    </div>
  )
}
