// TaskHoverActions — acciones de hover comunes a CUALQUIER fila de tarea, esté
// donde esté (columna del día, contextos, etc.). Mismo set en todos los sitios:
//   🎯 al foco de hoy (toggle)  ·  📅 poner/cambiar fecha (abre el modal de
//   fecha + repetición + prioridad vía onOpenDate)  ·  🗑 borrar.
// Se ocultan y aparecen en hover por el contenedor `.dc-actions` (la fila debe
// ser `.dc-row`). Para tareas completadas solo se muestra borrar.
import type { Node } from '../../types'
import { useTranslation } from 'react-i18next'
import { scheduleTask } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'

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
          Las tareas que ya tienen fecha no llevan este botón. */}
      {!done && !node.due && (
        <button className="dc-action dc-action--hoy" title={t('taskHover.scheduleToday')}
          onClick={e => { e.stopPropagation(); scheduleTask(node, 0) }}>
          Hoy
        </button>
      )}
      {!done && (
        <button className="dc-action" title={node.due ? 'Cambiar fecha' : 'Poner fecha'}
          onClick={e => { e.stopPropagation(); onOpenDate(node) }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="14" height="13" rx="2" /><path d="M3 8.5h14M7 3v3M13 3v3" />
          </svg>
        </button>
      )}
      <button className="dc-action dc-action--del" title={t('common.delete')}
        onClick={e => { e.stopPropagation(); trashNode(node.id) }}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
        </svg>
      </button>
    </span>
  )
}
