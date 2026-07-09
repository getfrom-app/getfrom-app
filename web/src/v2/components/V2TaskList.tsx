// Lista de tareas de Fromly 2.0 — usa el TaskRow ÚNICO compartido con toda la app
// (Hoy/DailyCockpit, Elementos, otros días): checkbox, texto, chips de hora/día/
// repetición, chip de contexto y acciones de hover son SIEMPRE los mismos aquí y
// en cualquier otra pestaña — un solo componente, no una copia por pestaña.
import { useState } from 'react'
import { store } from '../../store/nodeStore'
import TaskRow from '../../components/panels/TaskRow'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import type { Node } from '../../types'

export default function V2TaskList({ tasks }: { tasks: Node[] }) {
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const propsNode = propsNodeId ? store.getNode(propsNodeId) : null

  return (
    <div>
      {tasks.map(task => (
        <TaskRow key={task.id} node={task} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
      ))}
      {propsNode && <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />}
    </div>
  )
}
