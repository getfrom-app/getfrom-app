// TaskHoverActions — acciones de hover comunes a CUALQUIER fila de tarea, esté
// donde esté (columna del día, contextos, etc.). Mismo set en todos los sitios:
//   🎯 al foco de hoy (toggle)  ·  → mover a Futuro  ·  🗑 borrar.
// Se ocultan y aparecen en hover por el contenedor `.dc-actions` (la fila debe
// ser `.dc-row`). Para tareas completadas solo se muestra borrar.
// ⚠️ El botón de "poner/cambiar fecha" que vivía aquí se quitó (Alberto, 5 ago
// 2026): con fecha, el propio badge `.dc-due` de TaskRow ya abre `onOpenDate` al
// clicarlo; sin fecha, el nuevo badge `.dc-due--empty` ("+") hace lo mismo — el
// botón de hover quedó puramente redundante en los dos casos.
import type { Node } from '../../types'
import { useTranslation } from 'react-i18next'
import { scheduleTask } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { store } from '../../store/nodeStore'

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
      {/* → Futuro: aparca la tarea (status='future') para sacarla rápido del día sin
          borrarla ni tener que abrir el modal de fecha (Alberto, 22 jul: "que el
          usuario pueda desplazar rápidamente una tarea... y volverla a dejar en ese
          bloque futuro para volverla a agendar"). */}
      {!done && node.status !== 'future' && (
        <button className="dc-action" title={t('taskHover.moveToFuture', 'Mover a Futuro')}
          onClick={e => { e.stopPropagation(); store.updateNode(node.id, { status: 'future' }) }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" />
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
