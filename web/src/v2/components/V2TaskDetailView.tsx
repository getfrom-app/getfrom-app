// Detalle de una TAREA o EVENTO en la columna derecha de Fromly 2.0.
// Antes esto caía en V2NoteBody (editor de documento genérico): abría un body VACÍO
// que el DocEditor titulaba «Documento» y esa palabra PISABA el nombre real de la
// tarea al guardar — el bug grave que reportó Alberto («me encuentro tantos
// elementos llamados Documento»). Sigue siendo una TAREA: checkbox + chips de
// fecha/hora/repetición (clic abre el popover real) + su contexto (clic navega,
// antes no hacía nada) + un espacio de NOTAS libre (no el body de la tarea).
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { firstContextOf, contextColor, getOrCreateContainerNotes } from '../../utils/cajones'
import { timeLabel, dueLabel, dueColor, recLabel } from '../../components/panels/TaskRow'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import { V2NoteBody } from './V2DetailView'

interface Props {
  node: Node
  onSelectCtx: (id: string) => void
}

export default function V2TaskDetailView({ node, onSelectCtx }: Props) {
  useStore()
  const { t, i18n } = useTranslation()
  const [showProps, setShowProps] = useState(false)
  const done = node.status === 'done'
  const ctx = firstContextOf(node)

  const notesNode = useMemo(() => getOrCreateContainerNotes(node.id), [node.id])

  const time = timeLabel(node, i18n.language)
  const due = dueLabel(node, i18n.language)
  const rec = recLabel(node, t)

  return (
    <div style={{ padding: '4px 18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
        {node.status != null && (
          <button
            className={`dc-check ${done ? 'dc-check--done' : ''}`}
            onClick={() => toggleTaskDone(node)}
            title={t('daily.markDone')} aria-label={t('daily.markDone')}
          >{done ? '✓' : ''}</button>
        )}
        <button className="v2-el-ctxchip" style={{ cursor: 'pointer', border: 'none', background: 'var(--bg-hover)' }}
          onClick={() => setShowProps(v => !v)} title={t('dailyCockpit.editDateRecurrence')}>
          📅 {due || t('modal.dueDate')}
        </button>
        {time && <span className="dc-time">{time}</span>}
        {rec && <span className="dc-rec">🔁 {rec}</span>}
        <button
          title={t('tip.delete', 'Eliminar')}
          onClick={() => { trashNode(node.id); window.dispatchEvent(new Event('from:close-detail')) }}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>

      {/* Contexto — clic navega (sidebar + columna derecha), antes no hacía nada. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {ctx ? (
          <button className="v2-el-ctxchip" style={{ ['--chip' as string]: contextColor(ctx.id), cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent' }}
            onClick={() => onSelectCtx(ctx.id)}>
            {ctx.text}
          </button>
        ) : (
          <span className="v2-el-meta">{t('v2.taskDetail.noContext', 'Sin contexto')}</span>
        )}
      </div>

      {/* Notas — EL MISMO editor completo que cualquier nota, NO es el título de la tarea. */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📝 {t('v2.context.notes', 'Notas')}</div>
        <V2NoteBody node={notesNode} onSelectCtx={onSelectCtx} inlinePage hideContext />
      </div>

      {showProps && <TaskPropsPopover node={node} allowDelete onDeleted={() => window.dispatchEvent(new Event('from:close-detail'))} onClose={() => setShowProps(false)} />}
    </div>
  )
}
