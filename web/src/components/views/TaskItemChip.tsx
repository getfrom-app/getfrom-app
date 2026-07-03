// TaskItemChip — NodeView de React para cada casilla de tarea DENTRO de un texto del
// lienzo. Añade, junto al checkbox nativo de TipTap, un pequeño chip clicable (fecha
// si tiene, o «···» si no) que abre el MISMO modal de propiedades (fecha/recurrencia/
// prioridad) que usa el outliner — `TaskPropsModal`, disparado con el evento global
// `from:open-task-props` ya escuchado por MainLayout, sin duplicar lógica.
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { store, useStore } from '../../store/nodeStore'

function formatDue(due: string | null | undefined): string | null {
  if (!due) return null
  const d = new Date(due)
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  const day = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return hasTime ? `${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : day
}

const PRIORITY_DOT: Record<string, string> = { high: '#e03131', medium: '#f08c00', low: '#868e96' }

export default function TaskItemChip({ node, updateAttributes }: NodeViewProps) {
  useStore()
  const checked = !!node.attrs.checked
  const dataNodeId = node.attrs.dataNodeId as string | null
  const linked = dataNodeId ? store.getNode(dataNodeId) : null

  const openProps = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!dataNodeId) return // casilla recién creada, aún sin nodo-tarea real (llega en <500ms)
    window.dispatchEvent(new CustomEvent('from:open-task-props', { detail: { nodeId: dataNodeId } }))
  }

  const dueLabel = linked ? formatDue(linked.due) : null
  const dot = linked?.priority ? PRIORITY_DOT[linked.priority] : null

  return (
    <NodeViewWrapper as="li" data-checked={checked ? 'true' : 'false'}>
      <label contentEditable={false}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => updateAttributes({ checked: !checked })}
        />
      </label>
      <NodeViewContent as="div" />
      <button
        contentEditable={false}
        title={dueLabel ? `${dueLabel} — editar` : 'Fecha, recurrencia, prioridad'}
        onMouseDown={e => e.preventDefault()}
        onClick={openProps}
        className="task-item-chip"
        style={{ opacity: dataNodeId ? 1 : 0.3, pointerEvents: dataNodeId ? 'auto' : 'none' }}
      >
        {dot && <span className="task-item-chip-dot" style={{ background: dot }} />}
        {dueLabel || '···'}
      </button>
    </NodeViewWrapper>
  )
}
