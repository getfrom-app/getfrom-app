/**
 * TimelinePanel — Panel de planificación temporal colapsable.
 *
 * Muestra una rejilla de horas (06:00–24:00) donde las tareas con `due`
 * aparecen como bloques arrastrables. Se puede cambiar entre vista Día y Semana.
 *
 * Integración:
 *   · Se abre desde NodeView cuando el nodo es un diary entry (isDiaryEntry=true).
 *   · Drag desde el árbol: los nodos con [data-node-id] y draggable=true
 *     depositan su ID en dataTransfer('nodeId') — el panel los recoge.
 *   · Drag de bloques existentes: mueve due/dueEnd.
 *   · Clic en slot vacío: crea tarea nueva en la nota diaria con ese due.
 *   · Resize desde el borde inferior: amplía dueEnd.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

// ── Constantes de geometría ────────────────────────────────────────────────

const HOUR_START   = 6            // 06:00
const HOUR_END     = 24           // 24:00
const TOTAL_HOURS  = HOUR_END - HOUR_START  // 18
const SLOT_HEIGHT  = 44           // px por 30 min
const HOUR_HEIGHT  = SLOT_HEIGHT * 2        // 88 px por hora
const PX_PER_MIN   = SLOT_HEIGHT / 30       // ≈1.467 px/min
const DAY_COL_W    = 140          // px por columna en vista semana
const TIME_AXIS_W  = 44           // px para el eje de horas

// ── Helpers de tiempo ──────────────────────────────────────────────────────

function minFromDayStart(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() - HOUR_START * 60
}

function topPx(date: Date): number {
  return Math.max(0, minFromDayStart(date) * PX_PER_MIN)
}

function durationPx(startMs: number, endMs: number): number {
  return Math.max(SLOT_HEIGHT, (endMs - startMs) / 60000 * PX_PER_MIN)
}

function snapToSlot(y: number): number {
  // Snap al slot de 30 min más cercano
  return Math.round(y / SLOT_HEIGHT) * SLOT_HEIGHT
}

function pxToDate(px: number, baseDate: Date): Date {
  const slotted = snapToSlot(px)
  const mins    = slotted / PX_PER_MIN + HOUR_START * 60
  const d = new Date(baseDate)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()  === b.getMonth()
    && a.getDate()   === b.getDate()
}

function weekDays(anchorDate: Date): Date[] {
  // Lunes a domingo de la semana del anchorDate
  const d = new Date(anchorDate)
  const day = d.getDay()                    // 0=Dom
  const diffToMon = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diffToMon)
  d.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d)
    dd.setDate(dd.getDate() + i)
    return dd
  })
}

const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                      'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function dayLabel(d: Date): string {
  const dow = d.getDay()
  const idx = dow === 0 ? 6 : dow - 1  // 0=Lun
  return `${DAYS_SHORT[idx]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Tipos internos ─────────────────────────────────────────────────────────

interface TaskBlock {
  node:  Node
  top:   number   // px
  height: number  // px
  color: string
}

function blockColor(n: Node): string {
  if (n.status === 'done')    return 'var(--green)'
  if (n.status === 'future')  return 'var(--accent)'
  if (n.due && new Date(n.due) < new Date()) return 'var(--red)'
  return 'var(--accent)'
}

// ── Calcula bloques para un día ────────────────────────────────────────────

function blocksForDay(nodes: Node[], day: Date): TaskBlock[] {
  const blocks: TaskBlock[] = []
  for (const n of nodes) {
    if (!n.due || n.deletedAt) continue
    const due = new Date(n.due)
    if (!sameDay(due, day)) continue
    if (due.getHours() < HOUR_START || due.getHours() >= HOUR_END) continue
    const end = n.dueEnd ? new Date(n.dueEnd) : new Date(due.getTime() + 60 * 60000)
    blocks.push({
      node: n,
      top:    topPx(due),
      height: durationPx(due.getTime(), end.getTime()),
      color:  blockColor(n),
    })
  }
  return blocks.sort((a, b) => a.top - b.top)
}

// ── Componente principal ───────────────────────────────────────────────────

interface Props {
  diaryNode:  Node            // nodo de diario (isDiaryEntry=true)
  onClose:    () => void
}

type ViewMode = 'day' | 'week'

export default function TimelinePanel({ diaryNode, onClose }: Props) {
  const s        = useStore()
  const { t }    = useTranslation()
  const [mode, setMode] = useState<ViewMode>('day')

  // Fecha base del diary
  const baseDate = diaryNode.diaryDate
    ? new Date(diaryNode.diaryDate)
    : new Date()

  // Nodo bajo el que crear nuevas tareas
  const parentNodeId = diaryNode.id

  // ── Estado de drag de bloque existente ──────────────────────────────────
  // dragBlock: { nodeId, offsetY (px dentro del bloque al inicio del drag) }
  const dragBlock   = useRef<{ nodeId: string; offsetY: number } | null>(null)
  const resizeBlock = useRef<{ nodeId: string; origEnd: number } | null>(null)
  const colRef      = useRef<HTMLDivElement>(null)
  const gridRef     = useRef<HTMLDivElement>(null)

  // ── Crea tarea nueva en la nota diaria ────────────────────────────────

  function createTaskAtTime(day: Date, pxFromTop: number) {
    const due = pxToDate(pxFromTop, day)
    if (due.getHours() < HOUR_START || due.getHours() >= HOUR_END) return
    const dueEnd = new Date(due.getTime() + 60 * 60000) // 1h por defecto
    store.createNode({
      text:    '',
      parentId: parentNodeId,
      isTask:  true,
      due:     due.toISOString(),
    })
  }

  // ── Drop desde el árbol (HTML5 DnD) ──────────────────────────────────

  function handleSlotDrop(e: React.DragEvent, day: Date, pxFromTop: number) {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('nodeId')
    if (!nodeId) return
    const node = store.getNode(nodeId)
    if (!node) return
    const due = pxToDate(pxFromTop, day)
    const dueEnd = node.dueEnd
      ? new Date(new Date(node.dueEnd).getTime() - new Date(node.due!).getTime() + due.getTime())
      : new Date(due.getTime() + 60 * 60000)
    store.updateNode(nodeId, { due: due.toISOString(), dueEnd: dueEnd.toISOString() })
  }

  // ── Drag de bloque existente (mouse) ─────────────────────────────────

  const handleBlockMouseDown = useCallback((e: React.MouseEvent, nodeId: string, blockTop: number) => {
    e.stopPropagation()
    const offsetY = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top
    dragBlock.current = { nodeId, offsetY }

    function onMouseMove(ev: MouseEvent) {
      if (!dragBlock.current || !gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      const rawY = ev.clientY - rect.top - dragBlock.current.offsetY
      const snapped = snapToSlot(rawY)
      const clampedTop = Math.max(0, Math.min(TOTAL_HOURS * HOUR_HEIGHT - SLOT_HEIGHT, snapped))
      // Preview visual — sólo posición del bloque
      const el = document.querySelector(`[data-block-id="${dragBlock.current.nodeId}"]`) as HTMLElement
      if (el) el.style.top = `${clampedTop}px`
    }

    function onMouseUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (!dragBlock.current || !gridRef.current) return
      const { nodeId } = dragBlock.current
      const rect = gridRef.current.getBoundingClientRect()
      const rawY = ev.clientY - rect.top - dragBlock.current.offsetY
      const snapped = snapToSlot(Math.max(0, rawY))
      // Calcular día (para semana: dividir por DAY_COL_W)
      const rawX = ev.clientX - rect.left - TIME_AXIS_W
      const colIdx = mode === 'week'
        ? Math.max(0, Math.min(6, Math.floor(rawX / DAY_COL_W)))
        : 0
      const days = mode === 'week' ? weekDays(baseDate) : [baseDate]
      const day = days[colIdx] ?? days[0]!
      const due = pxToDate(snapped, day!)
      const node = store.getNode(nodeId)
      if (node?.due) {
        const origDur = node.dueEnd
          ? new Date(node.dueEnd).getTime() - new Date(node.due).getTime()
          : 60 * 60000
        const dueEnd = new Date(due.getTime() + origDur)
        store.updateNode(nodeId, { due: due.toISOString(), dueEnd: dueEnd.toISOString() })
      }
      dragBlock.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [baseDate, mode])

  // ── Resize bloque (borde inferior) ───────────────────────────────────

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const node = store.getNode(nodeId)
    if (!node?.due) return
    const origEnd = node.dueEnd
      ? new Date(node.dueEnd).getTime()
      : new Date(node.due).getTime() + 60 * 60000
    resizeBlock.current = { nodeId, origEnd }

    function onMouseMove(ev: MouseEvent) {
      if (!resizeBlock.current || !gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      const rawY = ev.clientY - rect.top
      const snapped = snapToSlot(rawY)
      const node = store.getNode(resizeBlock.current.nodeId)
      if (!node?.due) return
      const dueTop = topPx(new Date(node.due))
      const minHeight = SLOT_HEIGHT
      const h = Math.max(minHeight, snapped - dueTop)
      const el = document.querySelector(`[data-block-id="${resizeBlock.current.nodeId}"]`) as HTMLElement
      if (el) el.style.height = `${h}px`
    }

    function onMouseUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (!resizeBlock.current || !gridRef.current) return
      const { nodeId } = resizeBlock.current
      const rect = gridRef.current.getBoundingClientRect()
      const rawY = ev.clientY - rect.top
      const snapped = snapToSlot(rawY)
      const node = store.getNode(nodeId)
      if (!node?.due) { resizeBlock.current = null; return }
      const dueTop = topPx(new Date(node.due))
      const h = Math.max(SLOT_HEIGHT, snapped - dueTop)
      const mins = h / PX_PER_MIN
      const due = new Date(node.due)
      const dueEnd = new Date(due.getTime() + mins * 60000)
      store.updateNode(nodeId, { dueEnd: dueEnd.toISOString() })
      resizeBlock.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // ── Scroll to now on mount ────────────────────────────────────────────

  useEffect(() => {
    const now = new Date()
    const top = topPx(now) - 80
    if (top > 0 && colRef.current) {
      colRef.current.scrollTop = top
    }
  }, [])

  // ── Render de bloques de un día ──────────────────────────────────────

  const allNodes = s.allActive().filter(n => n.status !== null)

  function renderDayColumn(day: Date, colIdx: number = 0) {
    const blocks = blocksForDay(allNodes, day)
    const isToday = sameDay(day, new Date())
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
    const nowTop  = (nowMins - HOUR_START * 60) * PX_PER_MIN

    return (
      <div
        key={day.toDateString()}
        className="tl-day-col"
        style={{ width: mode === 'week' ? DAY_COL_W : '100%', minWidth: mode === 'week' ? DAY_COL_W : undefined }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          handleSlotDrop(e, day, e.clientY - rect.top)
        }}
        onClick={e => {
          if ((e.target as HTMLElement).closest('.tl-block')) return
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          createTaskAtTime(day, e.clientY - rect.top)
        }}
      >
        {/* Línea de "ahora" */}
        {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS * HOUR_HEIGHT && (
          <div className="tl-now-line" style={{ top: nowTop }} />
        )}

        {/* Slots de fondo (alternados para medias horas) */}
        {Array.from({ length: TOTAL_HOURS * 2 }, (_, i) => (
          <div
            key={i}
            className={`tl-slot ${i % 2 === 0 ? 'tl-slot--hour' : 'tl-slot--half'}`}
            style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
          />
        ))}

        {/* Bloques de tareas */}
        {blocks.map(b => {
          const due    = new Date(b.node.due!)
          const dueEnd = b.node.dueEnd
            ? new Date(b.node.dueEnd)
            : new Date(due.getTime() + 60 * 60000)

          return (
            <div
              key={b.node.id}
              data-block-id={b.node.id}
              className="tl-block"
              style={{
                top:    b.top,
                height: b.height,
                background: b.color,
                left: 2, right: 2,
              }}
              onMouseDown={e => handleBlockMouseDown(e, b.node.id, b.top)}
              title={`${b.node.text}\n${formatTime(due)} – ${formatTime(dueEnd)}`}
            >
              <div className="tl-block-time">{formatTime(due)}</div>
              <div className="tl-block-text">{b.node.text || t('common.noTitle')}</div>
              {/* Resize handle */}
              <div
                className="tl-block-resize"
                onMouseDown={e => handleResizeMouseDown(e, b.node.id)}
              />
            </div>
          )
        })}
      </div>
    )
  }

  // ── Tareas sin hora (arrastrar al grid) ──────────────────────────────
  // Todas las tareas activas sin `due` asignado — draggables al timeline.

  const unscheduled = allNodes.filter(n =>
    n.status === 'pending' && !n.due && !n.deletedAt
  ).slice(0, 30)   // máx 30 para no sobrecargar

  // ── Días de la vista ──────────────────────────────────────────────────

  const days = mode === 'week' ? weekDays(baseDate) : [baseDate]
  const today = sameDay(baseDate, new Date())

  // ── Layout ──────────────────────────────────────────────────────────

  return (
    <div className="tl-panel">
      {/* Header */}
      <div className="tl-header">
        <div className="tl-header-left">
          <span className="tl-header-title">
            {mode === 'day'
              ? dayLabel(baseDate)
              : `Semana del ${baseDate.getDate()} ${MONTHS_SHORT[baseDate.getMonth()]}`}
          </span>
        </div>
        <div className="tl-header-tabs">
          <button
            className={`tl-tab ${mode === 'day' ? 'tl-tab--active' : ''}`}
            onClick={() => setMode('day')}
          >{t('timeline.dayMode')}</button>
          <button
            className={`tl-tab ${mode === 'week' ? 'tl-tab--active' : ''}`}
            onClick={() => setMode('week')}
          >{t('timeline.weekMode')}</button>
        </div>
        <button className="tl-close" onClick={onClose} title={t('timelinePanel.close')}>×</button>
      </div>

      {/* Tareas sin hora — arrastrar al grid */}
      {unscheduled.length > 0 && (
        <div className="tl-unscheduled">
          <div className="tl-unscheduled-label">{t('panel.noDate')} — arrastra al timeline</div>
          <div className="tl-unscheduled-list">
            {unscheduled.map(n => (
              <div
                key={n.id}
                className="tl-unscheduled-item"
                draggable
                onDragStart={e => e.dataTransfer.setData('nodeId', n.id)}
                title={n.text}
              >
                <span className="tl-unscheduled-dot" />
                <span className="tl-unscheduled-text">{n.text || t('common.noTitle')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body — eje de horas + columnas */}
      <div className="tl-body" ref={colRef}>

        {/* Encabezados de días (solo semana) */}
        {mode === 'week' && (
          <div className="tl-day-headers">
            <div style={{ width: TIME_AXIS_W, flexShrink: 0 }} />
            {days.map(d => (
              <div
                key={d.toDateString()}
                className={`tl-day-header ${sameDay(d, new Date()) ? 'tl-day-header--today' : ''}`}
                style={{ width: DAY_COL_W, flexShrink: 0 }}
              >
                {dayLabel(d)}
              </div>
            ))}
          </div>
        )}

        {/* Grid: eje de horas + columnas */}
        <div className="tl-grid" ref={gridRef} style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>

          {/* Eje de horas */}
          <div className="tl-axis" style={{ width: TIME_AXIS_W }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="tl-axis-label"
                style={{ top: i * HOUR_HEIGHT - 8 }}
              >
                {formatHour(HOUR_START + i)}
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          <div className="tl-cols" style={{ flex: 1 }}>
            {days.map((d, i) => renderDayColumn(d, i))}
          </div>
        </div>
      </div>
    </div>
  )
}
