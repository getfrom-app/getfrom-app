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
import { useState } from 'react'
import type { Node } from '../../types'
import { useTranslation } from 'react-i18next'
import { scheduleTask, postponeTask, detachFromRecurrence } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { isTaskOverdue } from './TaskRow'
import Icon from '../../v2/components/Icon'
import RecurrenceScopeConfirm from './RecurrenceScopeConfirm'

export default function TaskHoverActions({ node, onOpenDate }: {
  node: Node
  /** Abre el modal de fecha/repetición/prioridad para este nodo (TaskPropsPopover). */
  onOpenDate: (n: Node) => void
}) {
  const { t } = useTranslation()
  const done = node.status === 'done'
  const overdue = isTaskOverdue(node)
  // «¿Solo esta instancia o todas las siguientes?» (27 ago 2026, Alberto:
  // "cuando se edita o mueve o borra un evento recurrente... debe preguntar
  // igual que Apple Calendar"). Solo hace falta preguntar si la tarea ES
  // recurrente — el resto de tareas siguen actuando al instante, como
  // siempre. `pending` guarda qué acción ejecutar según la respuesta.
  const [pending, setPending] = useState<{ verb: string; run: (scope: 'this' | 'all') => void } | null>(null)
  function withScope(verb: string, run: (scope: 'this' | 'all') => void) {
    if (!node.recurrence) { run('all'); return }
    setPending({ verb, run })
  }

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
          onClick={e => {
            e.stopPropagation()
            withScope(t('taskHover.scheduleToday', 'mover a hoy'), scope => {
              if (scope === 'this') detachFromRecurrence(node)
              scheduleTask(node, 0)
            })
          }}>
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
          onClick={e => {
            e.stopPropagation()
            withScope(t('common.tomorrow', 'mañana'), scope => {
              if (scope === 'this') detachFromRecurrence(node)
              postponeTask(node, 1)
            })
          }}>
          {t('common.tomorrow')}
        </button>
      )}
      {!done && node.due && node.isEvent && (
        <button className="dc-action" title={t('daily.postpone', 'Posponer')}
          onClick={e => { e.stopPropagation(); onOpenDate(node) }}>
          {t('daily.postpone', 'Posponer')}
        </button>
      )}
      {/* El «+» de fecha/repetición ya no vive aquí (hover-only) — ahora es un
          badge siempre visible en TaskRow, junto al chip de fecha, igual que
          el de las tareas sin fecha (27 ago 2026, Alberto). */}
      <button className="dc-action dc-action--del" title={t('common.delete')}
        onClick={e => {
          e.stopPropagation()
          withScope(t('common.delete', 'eliminar'), scope => {
            if (scope === 'this') detachFromRecurrence(node)
            trashNode(node.id)
          })
        }}>
        <Icon name="trash" size={13} />
      </button>
      {pending && (
        <RecurrenceScopeConfirm
          verb={pending.verb}
          onChoose={scope => { pending.run(scope); setPending(null) }}
          onCancel={() => setPending(null)}
        />
      )}
    </span>
  )
}
