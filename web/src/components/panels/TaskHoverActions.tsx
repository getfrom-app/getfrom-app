// TaskHoverActions — acciones de hover comunes a CUALQUIER fila de tarea, esté
// donde esté (columna del día, contextos, chat, elementos…). Mismo set en
// todos los sitios: «Hoy» (programar para hoy) · «Posponer» (mañana/+7d/sin
// fecha) · papelera. Se ocultan y aparecen en hover por el contenedor
// `.dc-actions` (la fila debe ser `.dc-row`). Para tareas completadas solo se
// muestra borrar.
// ⚠️ El botón de "poner/cambiar fecha" que vivía aquí se quitó (Alberto, 5 ago
// 2026): con fecha, el propio badge `.dc-due` de TaskRow ya abre `onOpenDate` al
// clicarlo; sin fecha, el nuevo badge `.dc-due--empty` ("+") hace lo mismo — el
// botón de hover quedó puramente redundante en los dos casos.
// «Posponer» (24 ago 2026, paridad con el swipe de iOS en el chat —
// `AssistantSwipeRow`/`AssistantChatView.swift`: Completar+Contexto a la
// izquierda, Posponer+Eliminar a la derecha). Completar ya vive en el
// checkbox `.dc-check` de TaskRow, siempre visible, no solo al hover; Contexto
// ya vive en `RowContextChip`, también siempre visible y clicable — ninguno
// de los dos necesitaba duplicarse aquí. Posponer sí era un hueco real: la
// única forma de mover una fecha ya puesta era abrir el popover completo
// (`onOpenDate`/TaskPropsPopover). Reutiliza `postponeTask` (`dailyCockpit.ts`,
// ya cubierto por tests).
// ⚠️ Simplificado (24 ago 2026, misma tarde): el desplegable Mañana/+7d/Quitar
// fecha se quita — Alberto: "es más simple" un botón directo "Mañana", igual
// que el swipe de iOS (que ya era una única acción, sin menú).
import type { Node } from '../../types'
import { useTranslation } from 'react-i18next'
import { scheduleTask, postponeTask } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { isTaskOverdue } from './TaskRow'
import Icon from '../../v2/components/Icon'

export default function TaskHoverActions({ node, onOpenDate }: {
  node: Node
  /** Abre el modal de fecha/repetición/prioridad para este nodo (TaskPropsPopover). */
  onOpenDate: (n: Node) => void
}) {
  const { t } = useTranslation()
  const done = node.status === 'done'
  const overdue = isTaskOverdue(node)

  return (
    <span className="dc-actions">
      {/* «Hoy» para tareas SIN fecha (Por planificar) y para tareas ATRASADAS
          (27 ago 2026, Alberto: "las atrasadas deberían mostrar el botón hoy,
          en lugar de mañana" — antes de atrasada mostraba «Mañana» igual que
          una futura, cuando lo que de verdad hace falta con algo que ya venció
          es traerlo a HOY, no volver a aplazarlo). Sin fecha o atrasada son el
          mismo caso de fondo: no hay una fecha futura razonable ya puesta. */}
      {!done && (!node.due || overdue) && (
        <button className="dc-action dc-action--hoy" title={t('taskHover.scheduleToday')}
          onClick={e => { e.stopPropagation(); scheduleTask(node, 0) }}>
          Hoy
        </button>
      )}
      {/* «Mañana» SOLO para TAREAS abiertas con fecha FUTURA/hoy (ni atrasada
          ni sin fecha, ambas cubiertas arriba por «Hoy»). Un EVENTO no lleva
          este atajo directo (26 ago 2026, Alberto: "quitar el hover que pone
          Mañana [en eventos]... ponemos Posponer y se abre un modal para
          elegir nueva fecha") — mejor abrir el selector completo que mover a
          ciegas una hora/lugar concretos. */}
      {!done && node.due && !overdue && !node.isEvent && (
        <button className="dc-action" title={t('common.tomorrow')}
          onClick={e => { e.stopPropagation(); postponeTask(node, 1) }}>
          {t('common.tomorrow')}
        </button>
      )}
      {!done && node.due && node.isEvent && (
        <button className="dc-action" title={t('daily.postpone', 'Posponer')}
          onClick={e => { e.stopPropagation(); onOpenDate(node) }}>
          {t('daily.postpone', 'Posponer')}
        </button>
      )}
      {/* «+» — abre la ventana de fecha/repetición completa, igual que ya
          hacía (siempre visible, no solo al hover) el badge de las tareas SIN
          fecha (27 ago 2026, Alberto: "deberían mostrar el botón + en la
          segunda fila... igual que las tareas sin fecha"). Para una tarea con
          fecha el texto de la fecha YA abre lo mismo al clicarlo, pero no es
          obvio que sea clicable — este «+» lo hace explícito también aquí. */}
      {!done && node.due && (
        <button className="dc-action dc-action--plus" title={t('dailyCockpit.editDateRecurrence')}
          onClick={e => { e.stopPropagation(); onOpenDate(node) }}>
          <Icon name="plus" size={13} />
        </button>
      )}
      <button className="dc-action dc-action--del" title={t('common.delete')}
        onClick={e => { e.stopPropagation(); trashNode(node.id) }}>
        <Icon name="trash" size={13} />
      </button>
    </span>
  )
}
