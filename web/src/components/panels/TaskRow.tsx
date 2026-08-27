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
import { docOfTask } from '../../utils/docTasks'
import Icon from '../../v2/components/Icon'

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
  // Mes SIEMPRE (día suelto sin mes es ambiguo en listas como «Futuro», donde
  // las fechas pueden caer meses después — Alberto, 22 jul: "falta el mes y el
  // año"). Año solo si distinto del actual, para no recargar las fechas cercanas.
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
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
/** ¿Tiene fecha y es anterior a hoy? Mismo criterio de fecha (sin hora) que
 *  `dueColor` — una sola fuente de verdad para "atrasada" en toda la web. */
export function isTaskOverdue(n: Node): boolean {
  if (!n.due) return false
  const d = new Date(n.due); const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return dd < t0
}
export function recLabel(n: Node, t: (k: string, opts?: Record<string, unknown>) => string): string | null {
  if (!n.recurrence) return null
  // Formato `unit` o `unit:N` (N = intervalo, ver recurrenceToString en naturalDate.ts).
  // Antes esto solo miraba la unidad e ignoraba el intervalo — una tarea "cada
  // quince días" (daily:15) mostraba el chip «cada día», idéntico a una diaria
  // de verdad (Alberto, 22 jul: "esta tarea es cada 15 días, y en el chip pone
  // cada día").
  const m = n.recurrence.match(/^(daily|weekly|monthly|yearly)(?::i?(\d+))?$/)
  if (!m) return t('tip.recShortGeneric')
  const unit = m[1]
  const interval = m[2] ? parseInt(m[2], 10) || 1 : 1
  if (interval <= 1) {
    return ({ daily: t('tip.recDailyShort'), weekly: t('tip.recWeeklyShort'), monthly: t('tip.recMonthlyShort'), yearly: t('tip.recYearlyShort') } as Record<string, string>)[unit] || t('tip.recShortGeneric')
  }
  const everyNKey = ({ daily: 'tip.recDailyEveryN', weekly: 'tip.recWeeklyEveryN', monthly: 'tip.recMonthlyEveryN', yearly: 'tip.recYearlyEveryN' } as Record<string, string>)[unit]
  return everyNKey ? t(everyNKey, { n: interval }) : t('tip.recShortGeneric')
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
  // El propio taskNode.ts lo deja dicho: "`status` dice que es una tarea;
  // `isEvent` dice que va al timeline del día y a Google Calendar. No son dos
  // tipos, son dos propiedades del mismo tipo." El 24 ago se introdujo aquí un
  // punto (evento, sin checkbox) para CUALQUIER `isEvent`, tratándolo como
  // excluyente de `status` — rompía justo esa ortogonalidad: una tarea a la
  // que solo le pones una hora concreta ("Probar WhatsApp a las 16:00") se
  // vuelve `isEvent` automáticamente (ver DiaryPanelComponents.setDue) y
  // dejaba de poder completarse desde aquí (Alberto, 27 ago 2026: "eso no
  // quiere decir que sean eventos... son tareas con hora"). Ahora el punto
  // (sin checkbox, sin poder completarse) queda solo para lo que de verdad no
  // tiene `status` — un evento crudo de Google nunca sincronizado como tarea.
  const isEvent = !!node.isEvent
  const hasStatus = node.status != null
  const done = hasStatus && node.status === 'done'
  const time = timeLabel(node, i18n.language)
  const due = showDue ? dueLabel(node, i18n.language) : ''
  const rec = recLabel(node, t)
  const taskDoc = docOfTask(node)
  return (
    <div
      ref={rowRef}
      className={`dc-row ${isEvent && !hasStatus ? 'dc-row--event' : ''} ${done ? 'dc-row--done' : ''}`}
      data-node-id={node.id}
      style={style}
      onClick={() => openNodeDetail(node.id)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: node.id, x: e.clientX, y: e.clientY } })) }}
      {...dragProps}
    >
      {!hasStatus ? (
        // Indicador de evento en vez de checkbox — mismo hueco visual que
        // .dc-check (ver comentario de .dc-event-dot en styles/index.css), pero
        // sin acción de completar: un evento SIN status (crudo, nunca
        // sincronizado como tarea) se reprograma, no se marca hecho. Una
        // tarea con hora concreta SÍ tiene `status` — lleva checkbox normal,
        // aunque también sea `isEvent` (ver comentario arriba).
        <span className="dc-event-dot" title={t('search.chipEvent')} />
      ) : (
        <button
          className={`dc-check ${done ? 'dc-check--done' : ''}`}
          onClick={e => { e.stopPropagation(); toggleTaskDone(node) }}
          title={t('daily.markDone')} aria-label={t('daily.markDone')}
        >{done ? <Icon name="check" size={11} strokeWidth={2.6} /> : null}</button>
      )}
      {/* Dos líneas (Alberto, 4 ago 2026: "las tareas de la tab agenda se deben leer
          completas" — con checkbox + título + fecha + chip de contexto compitiendo en
          una sola línea, el título llegaba a encogerse casi a 0px en filas con chip).
          Título SIEMPRE en su propia línea, a ancho completo — mismo patrón .dc-row-main/
          .dc-row-l1/.dc-row-l2 que ya usa PorPlanificarPanel, ahora también aquí (el
          componente ÚNICO de fila de tarea, así que se aplica a Agenda, Elementos,
          Contexto y otros días a la vez — no una copia distinta por pestaña). */}
      <div className="dc-row-main">
        <div className="dc-row-l1">
          <span className="dc-text dc-text--wrap">{node.text ? renderInline(node.text) : t('common.noTitle')}</span>
          {extra}
        </div>
        <div className="dc-row-l2">
          {due && (
            <span className="dc-due" style={{ cursor: 'pointer', color: dueColor(node) }}
              title={t('dailyCockpit.editDateRecurrence')}
              onClick={e => { e.stopPropagation(); onOpenDate(node) }}>{due}</span>
          )}
          {/* Mismo badge «+» que las tareas sin fecha, ahora también con fecha —
              antes vivía dentro de TaskHoverActions (solo visible al hover de
              toda la fila): las atrasadas parecían no tener el mismo "+" que
              las sin fecha (27 ago 2026, Alberto: "igualalo... en la segunda
              fila, igual que las sin fecha"). */}
          {due && !done && (
            <span className="dc-due dc-due--empty" title={t('dailyCockpit.editDateRecurrence')}
              onClick={e => { e.stopPropagation(); onOpenDate(node) }}>+</span>
          )}
          {/* Hashtag junto a la fecha, sin píldora (24 ago 2026, paridad iOS:
              "quita los bordes... inclúyelos junto a la fecha"). Sigue siendo
              clicable para reasignar — a diferencia de iOS, la web no tiene
              swipe, así que aquí el clic es la ÚNICA forma de cambiarlo. */}
          <RowContextChip node={node} flat />
          {/* Sin fecha: badge para ponerla, mismo patrón que el «?» de contexto — un
              solo glifo, sin texto (así no necesita traducción en los 12 idiomas)
              (Alberto, 5 ago 2026: "que no tienen fecha, podrían tener debajo del
              título un pequeño badge para añadirle fecha... como el badge de
              interrogación de contexto"). Sustituye al botón de calendario que antes
              vivía en TaskHoverActions — visible solo al hover y redundante con esto
              (quitado de ahí). Solo para tareas abiertas: una tarea hecha sin fecha no
              necesita invitar a ponérsela. */}
          {!node.due && !done && (
            <span className="dc-due dc-due--empty" title={t('dailyCockpit.editDateRecurrence')}
              onClick={e => { e.stopPropagation(); onOpenDate(node) }}>+</span>
          )}
          {time && <span className="dc-time">{time}</span>}
          {rec && <span className="dc-rec" title={rec}><Icon name="repeat" size={12} /> {rec}</span>}
          {/* Tarea DE UN DOCUMENTO: se dice de cuál. Sin esto, en el cockpit un
              «seguimiento» suelto no dice de quién es — y pulsar la fila abre ese
              documento (V2App.onOpenNode), así que el chip explica adónde lleva. */}
          {taskDoc && (
            <span className="dc-rec" title={taskDoc.text || ''}>
              <Icon name="document" size={12} /> {taskDoc.text || t('common.noTitle')}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <TaskHoverActions node={node} onOpenDate={onOpenDate} />
        </div>
      </div>
    </div>
  )
}
