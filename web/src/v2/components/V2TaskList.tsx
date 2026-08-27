// Lista de tareas de Fromly 2.0 — usa el TaskRow ÚNICO compartido con toda la app
// (Hoy/DailyCockpit, Elementos, otros días): checkbox, texto, chips de hora/día/
// repetición, chip de contexto y acciones de hover son SIEMPRE los mismos aquí y
// en cualquier otra pestaña — un solo componente, no una copia por pestaña.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import TaskRow from '../../components/panels/TaskRow'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import type { Node } from '../../types'

/** Comparador ÚNICO de tareas pendientes. Exportado para que cualquier lista de
 *  tareas de la app use exactamente el mismo orden (paridad iOS `sortTasksForList`). */
export function comparePendingTasks(a: Node, b: Node): number {
  const da = a.due ? Date.parse(a.due) : Number.POSITIVE_INFINITY
  const db = b.due ? Date.parse(b.due) : Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  return (a.text || '').localeCompare(b.text || '')
}

export default function V2TaskList({ tasks, hideCheckbox }: { tasks: Node[]; hideCheckbox?: boolean }) {
  const { t } = useTranslation()
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const propsNode = propsNodeId ? store.getNode(propsNodeId) : null

  // Las COMPLETADAS se pliegan (Alberto, 6 ago 2026: "deberían colapsarse en un grupo
  // de finalizadas para no ocupar más espacio"). Un contexto vivo acumula meses de
  // tareas hechas, y tachadas entre medias empujaban las pendientes fuera de la vista.
  // Se quedan a un clic, de la más reciente a la más antigua.
  // Orden ÚNICO de las pendientes: primero lo que tiene fecha, de la más antigua a
  // la más nueva (lo atrasado arriba), y al final lo que no tiene fecha, alfabético.
  // Antes salían en el orden en que las devolvía el store — o sea, sin orden: en la
  // lista de un contexto se leía «29 jul, 9 jul, 23 jun, 18 jun…» y era imposible
  // saber qué vencía antes (Alberto, 20 ago 2026). Es el MISMO criterio que ya usaba
  // el cockpit de Hoy y que ahora usa también el iPhone (`sortTasksForList`).
  const pending = tasks.filter(n => n.status !== 'done').sort(comparePendingTasks)
  const done = tasks.filter(n => n.status === 'done')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

  const row = (task: Node) => (
    <TaskRow key={task.id} node={task} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} hideCheckbox={hideCheckbox} />
  )

  return (
    <div>
      {/* Empty state: antes la cabecera «Tareas» quedaba seguida de la nada
          (auditoría 28 ago 2026). */}
      {pending.length === 0 && done.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary,#999)', padding: '2px 0 6px' }}>
          {t('v2.taskList.empty', 'Sin tareas pendientes ✓')}
        </div>
      )}
      {pending.map(row)}
      {done.length > 0 && (
        <>
          <button className="v2-done-toggle" onClick={() => setShowDone(v => !v)}>
            {t('v2.taskList.doneCount', 'Completadas ({{count}})', { count: done.length })}
          </button>
          {showDone && done.map(row)}
        </>
      )}
      {propsNode && <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />}
    </div>
  )
}
