// Lista de tareas de Fromly 2.0 — MISMO markup que la columna del diario (DayColumn):
// dc-row + dc-check (checkbox real de Fromly), dc-text con renderInline, hora, chip de
// contexto (RowContextChip) detrás del texto, acciones al hover (TaskHoverActions →
// abre el TaskPropsPopover real con calendario), menú contextual (clic derecho) y clic
// en el texto → abre su nota a la derecha.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { renderInline } from '../../components/outliner/InlineRenderer'
import RowContextChip from '../../components/panels/RowContextChip'
import TaskHoverActions from '../../components/panels/TaskHoverActions'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { openNodeDetail } from '../../utils/canvasNav'
import type { Node } from '../../types'

function hhmm(iso?: string | null): string {
  if (!iso) return '00:00'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function V2TaskList({ tasks }: { tasks: Node[] }) {
  const { t } = useTranslation()
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const propsNode = propsNodeId ? store.getNode(propsNodeId) : null

  return (
    <div>
      {tasks.map(task => (
        <div
          key={task.id}
          className={`dc-row ${task.status === 'done' ? 'dc-row--done' : ''}`}
          data-node-id={task.id}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: task.id, x: e.clientX, y: e.clientY } })) }}
        >
          <button
            className={`dc-check ${task.status === 'done' ? 'dc-check--done' : ''}`}
            onClick={e => { e.stopPropagation(); toggleTaskDone(task) }}
            title={t('daily.markDone')} aria-label={t('daily.markDone')}
          >{task.status === 'done' ? '✓' : ''}</button>
          <span className="dc-text" onClick={() => openNodeDetail(task.id)} style={{ cursor: 'pointer' }}>
            {task.text ? renderInline(task.text) : t('tip.task')}
          </span>
          {hhmm(task.due) !== '00:00' && task.due && <span className="dc-time">{hhmm(task.due)}</span>}
          <RowContextChip node={task} />
          <TaskHoverActions node={task} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
        </div>
      ))}
      {propsNode && <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />}
    </div>
  )
}
