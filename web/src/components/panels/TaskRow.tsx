// TaskRow — fila de TAREA ÚNICA para toda la app: Hoy (DailyCockpit), Elementos
// (ElementsPanel), columna de otros días (DayColumn) y Fromly 2.0 (V2TaskList).
// Antes cada sitio tenía su propia copia ligeramente distinta (a unos les faltaba
// el chip de día, a otros el de repetición) — con este componente único, un cambio
// aquí se refleja en TODAS las pestañas a la vez, no hay que ir una por una.
// checkbox · texto · chip de hora · chip de día (color según atrasada/hoy/futura,
// clic abre el popover de fecha) · chip de repetición · chip de contexto · acciones
// de hover (calendario/eliminar).
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '../../types'
import { renderInline } from '../outliner/InlineRenderer'
import { openNodeDetail } from '../../utils/canvasNav'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import RowContextChip from './RowContextChip'
import TaskHoverActions from './TaskHoverActions'

// Exportadas: las reutiliza V2TaskDetailView (chips de fecha/hora/repetición en el
// detalle de una tarea/evento abierta en la columna derecha) — mismo cálculo, una
// sola fuente de verdad.
export function timeLabel(n: Node, lang: string): string | null {
  if (!n.due) return null
  const d = new Date(n.due)
  if (d.getHours() === 0 && d.getMinutes() === 0) return null
  return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })
}
export function dueLabel(n: Node, lang: string): string {
  if (!n.due) return ''
  const d = new Date(n.due)
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric' })
}
/** Color del chip de fecha: atrasada=rojo, hoy=ámbar, futura=azul. */
export function dueColor(n: Node): string {
  if (!n.due) return 'var(--text-tertiary)'
  const d = new Date(n.due); const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (dd < t0) return '#e03131'
  if (dd === t0) return '#f59e0b'
  return '#3b82f6'
}
export function recLabel(n: Node, t: (k: string) => string): string | null {
  if (!n.recurrence) return null
  const u = n.recurrence.split(':')[0]
  return ({ daily: t('tip.recDailyShort'), weekly: t('tip.recWeeklyShort'), monthly: t('tip.recMonthlyShort'), yearly: t('tip.recYearlyShort') } as Record<string, string>)[u] || t('tip.recShortGeneric')
}

interface Props {
  node: Node
  /** Abre el popover de fecha/repetición/prioridad (TaskPropsPopover). */
  onOpenDate: (n: Node) => void
  /** Mostrar el chip de DÍA si tiene fecha (por defecto sí; «Hoy» lo omite cuando
   *  la tarea ya está en su sección «Para hoy» y sería redundante). */
  showDue?: boolean
  /** Arrastrar al planificador — solo lo usa la columna de Hoy. */
  dragProps?: HTMLAttributes<HTMLDivElement>
  /** Ref del contenedor — solo lo usa Hoy (scroll-to-row del planificador). */
  rowRef?: (el: HTMLDivElement | null) => void
  /** Extra tras el texto (p.ej. el nombre del padre) — lo usa el «Bucles» de Hoy. */
  extra?: ReactNode
  /** Estilo del contenedor — lo usa Elementos (posicionamiento absoluto virtualizado). */
  style?: CSSProperties
}

export default function TaskRow({ node, onOpenDate, showDue = true, dragProps, rowRef, extra, style }: Props) {
  const { t, i18n } = useTranslation()
  const done = node.status === 'done'
  const time = timeLabel(node, i18n.language)
  const due = showDue ? dueLabel(node, i18n.language) : ''
  const rec = recLabel(node, t)
  return (
    <div
      ref={rowRef}
      className={`dc-row ${done ? 'dc-row--done' : ''}`}
      data-node-id={node.id}
      style={style}
      onClick={() => openNodeDetail(node.id)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: node.id, x: e.clientX, y: e.clientY } })) }}
      {...dragProps}
    >
      <button
        className={`dc-check ${done ? 'dc-check--done' : ''}`}
        onClick={e => { e.stopPropagation(); toggleTaskDone(node) }}
        title={t('daily.markDone')} aria-label={t('daily.markDone')}
      >{done ? '✓' : ''}</button>
      <span className="dc-text">{node.text ? renderInline(node.text) : t('common.noTitle')}</span>
      {extra}
      {time && <span className="dc-time">{time}</span>}
      {due && (
        <span className="dc-due" style={{ cursor: 'pointer', color: dueColor(node), flexShrink: 0 }}
          title={t('dailyCockpit.editDateRecurrence')}
          onClick={e => { e.stopPropagation(); onOpenDate(node) }}>{due}</span>
      )}
      {rec && <span className="dc-rec" title={rec}>🔁 {rec}</span>}
      <RowContextChip node={node} />
      <TaskHoverActions node={node} onOpenDate={onOpenDate} />
    </div>
  )
}
