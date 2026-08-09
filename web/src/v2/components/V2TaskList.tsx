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

export default function V2TaskList({ tasks }: { tasks: Node[] }) {
  const { t } = useTranslation()
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const propsNode = propsNodeId ? store.getNode(propsNodeId) : null

  // Las COMPLETADAS se pliegan (Alberto, 6 ago 2026: "deberían colapsarse en un grupo
  // de finalizadas para no ocupar más espacio"). Un contexto vivo acumula meses de
  // tareas hechas, y tachadas entre medias empujaban las pendientes fuera de la vista.
  // Se quedan a un clic, de la más reciente a la más antigua.
  const pending = tasks.filter(n => n.status !== 'done')
  const done = tasks.filter(n => n.status === 'done')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

  const row = (task: Node) => (
    <TaskRow key={task.id} node={task} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
  )

  return (
    <div>
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
