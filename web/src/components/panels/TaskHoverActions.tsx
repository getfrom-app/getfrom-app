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
import Icon from '../../v2/components/Icon'

export default function TaskHoverActions({ node, onOpenDate }: {
  node: Node
  /** Abre el modal de fecha/repetición/prioridad para este nodo (TaskPropsPopover). */
  onOpenDate: (n: Node) => void
}) {
  const { t } = useTranslation()
  const done = node.status === 'done'

  return (
    <span className="dc-actions">
      {/* «Hoy» SOLO para tareas sin fecha (Por planificar): las programa para hoy.
          Las tareas que ya tienen fecha no llevan este botón — para esas está
          «Mañana», justo debajo. */}
      {!done && !node.due && (
        <button className="dc-action dc-action--hoy" title={t('taskHover.scheduleToday')}
          onClick={e => { e.stopPropagation(); scheduleTask(node, 0) }}>
          Hoy
        </button>
      )}
      {/* «Mañana» SOLO para TAREAS abiertas que YA tienen fecha — mover una
          tarea sin fecha «al futuro» no tiene sentido, para eso está «Hoy».
          Un EVENTO no lleva este atajo directo (26 ago 2026, Alberto: "quitar
          el hover que pone Mañana [en eventos]... ponemos Posponer y se abre
          un modal para elegir nueva fecha") — un evento normalmente tiene
          hora y lugar concretos, así que "mañana a la misma hora" no es un
          valor por defecto razonable como sí lo es para una tarea; mejor
          abrir el selector completo (`onOpenDate`, mismo popover que el
          badge de fecha) que mover a ciegas. */}
      {!done && node.due && !node.isEvent && (
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
      <button className="dc-action dc-action--del" title={t('common.delete')}
        onClick={e => { e.stopPropagation(); trashNode(node.id) }}>
        <Icon name="trash" size={13} />
      </button>
    </span>
  )
}
