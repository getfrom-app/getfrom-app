// TaskItemChip — NodeView de React para cada casilla de tarea DENTRO de un texto del
// lienzo. Añade, junto al checkbox nativo de TipTap, un pequeño chip clicable (fecha
// si tiene, o «···» si no) que abre el MISMO modal de propiedades (fecha/recurrencia/
// prioridad) que usa el outliner — `TaskPropsModal`, disparado con el evento global
// `from:open-task-props` ya escuchado por MainLayout, sin duplicar lógica.
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { store, useStore } from '../../store/nodeStore'
import { taskCheckState, TASK_CHECK_COLORS } from '../../utils/taskNode'
import { dueLabel, dueColor, timeLabel, recLabel } from '../panels/TaskRow'
import { useTranslation } from 'react-i18next'
import Icon from '../../v2/components/Icon'

const PRIORITY_DOT: Record<string, string> = { high: '#e03131', medium: '#f08c00', low: '#868e96' }

export default function TaskItemChip({ node, updateAttributes }: NodeViewProps) {
  useStore()
  const { t, i18n } = useTranslation()
  const checked = !!node.attrs.checked
  const dataNodeId = node.attrs.dataNodeId as string | null
  const linked = dataNodeId ? store.getNode(dataNodeId) : null

  const openProps = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!dataNodeId) return // casilla recién creada, aún sin nodo-tarea real (llega en <500ms)
    window.dispatchEvent(new CustomEvent('from:open-task-props', { detail: { nodeId: dataNodeId } }))
  }

  const due = linked ? dueLabel(linked, i18n.language) : ''
  const time = linked ? timeLabel(linked, i18n.language) : null
  const rec = linked ? recLabel(linked, t) : null
  const dot = linked?.priority ? PRIORITY_DOT[linked.priority] : null
  // Checkbox estilo Logseq, mismo color que el resto de la app (Alberto, 3
  // sep 2026, ver utils/taskNode.ts). Sin nodo-tarea enlazado todavía (recién
  // creada, llega en <500ms) solo sabemos si está marcada o no — sin fecha,
  // así que gris/verde según `checked` hasta que el nodo real aparezca.
  const checkColor = TASK_CHECK_COLORS[linked ? taskCheckState(linked) : (checked ? 'done' : 'nodate')]

  return (
    <NodeViewWrapper as="li" data-checked={checked ? 'true' : 'false'}>
      <label contentEditable={false}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => updateAttributes({ checked: !checked })}
          style={{ background: checkColor }}
        />
      </label>
      {/* Segunda línea = la de TaskRow (fecha coloreada + «+» que abre el modal
          de propiedades), no un chip «···» pegado al título: mismo formato que el
          resto de tareas de Fromly (Alberto, 6 sep 2026). Sin chip de contexto:
          es el del propio documento. */}
      <div className="task-item-body">
        <NodeViewContent as="div" />
        {dataNodeId && (
          <div className="dc-row-l2 task-item-l2" contentEditable={false}>
            {dot && <span className="task-item-chip-dot" style={{ background: dot }} />}
            {due && linked && (
              <span className="dc-due" style={{ cursor: 'pointer', color: dueColor(linked) }}
                title={t('dailyCockpit.editDateRecurrence')} onMouseDown={e => e.preventDefault()} onClick={openProps}>{due}</span>
            )}
            {!checked && (
              <span className="dc-due dc-due--empty" title={t('dailyCockpit.editDateRecurrence')}
                onMouseDown={e => e.preventDefault()} onClick={openProps}>+</span>
            )}
            {time && <span className="dc-time">{time}</span>}
            {rec && <span className="dc-rec" title={rec}><Icon name="repeat" size={12} /> {rec}</span>}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
