// Lista de tareas de Fromly 2.0 con el MISMO estilo que la columna Hoy (dc-row):
// checkbox, texto con chips inline, chip de fecha/hora + recurrencia, acciones al
// hover (calendario/eliminar vía TaskHoverActions) y clic → abre su nota a la derecha
// (openNodeDetail → from:open-detail, que V2App escucha). Editar fecha/recurrencia
// abre el TaskPropsPopover real de la v1.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { renderInline } from '../../components/outliner/InlineRenderer'
import TaskHoverActions from '../../components/panels/TaskHoverActions'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { openNodeDetail } from '../../utils/canvasNav'
import type { Node } from '../../types'

function dueColor(n: Node): string {
  if (!n.due) return 'var(--text-tertiary)'
  const d = new Date(n.due); const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (dd < t0) return '#e03131'
  if (dd === t0) return '#f59e0b'
  return '#3b82f6'
}

export default function V2TaskList({ tasks }: { tasks: Node[] }) {
  const { t, i18n } = useTranslation()
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const propsNode = propsNodeId ? store.getNode(propsNodeId) : null
  const loc = i18n.language === 'en' ? 'en-US' : 'es-ES'

  const dueLabel = (n: Node) => n.due ? new Date(n.due).toLocaleDateString(loc, { weekday: 'short', day: 'numeric' }) : ''
  const timeLabel = (n: Node) => {
    if (!n.due) return ''
    const d = new Date(n.due)
    if (d.getHours() === 0 && d.getMinutes() === 0) return ''
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  }

  const openProps = (id: string) => setPropsNodeId(p => p === id ? null : id)

  return (
    <div>
      {tasks.map(n => (
        <div
          key={n.id}
          className={`dc-row ${n.status === 'done' ? 'dc-row--done' : ''}`}
          onClick={() => openNodeDetail(n.id)}
        >
          <button
            className={`dc-check ${n.status === 'done' ? 'dc-check--done' : ''}`}
            onClick={e => { e.stopPropagation(); toggleTaskDone(n) }}
            title={t('daily.markDone')}
          >{n.status === 'done' ? '✓' : ''}</button>
          <div className="dc-row-main">
            <div className="dc-row-l1">
              <span className="dc-text">{n.text ? renderInline(n.text) : t('common.noTitle')}</span>
              <TaskHoverActions node={n} onOpenDate={nn => openProps(nn.id)} />
            </div>
            <div className="dc-row-l2">
              {timeLabel(n) && <span className="dc-time">{timeLabel(n)}</span>}
              {dueLabel(n) && (
                <span className="dc-due" style={{ cursor: 'pointer', color: dueColor(n) }}
                  title={t('dailyCockpit.editDateRecurrence')}
                  onClick={e => { e.stopPropagation(); openProps(n.id) }}>{dueLabel(n)}</span>
              )}
              {n.recurrence && (
                <span className="dc-due" style={{ cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); openProps(n.id) }}>🔁</span>
              )}
            </div>
          </div>
        </div>
      ))}
      {propsNode && <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />}
    </div>
  )
}
