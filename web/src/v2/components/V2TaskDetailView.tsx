// Detalle de una TAREA o EVENTO en la columna derecha de Fromly 2.0.
// Antes esto caía en V2NoteBody (editor de documento genérico): abría un body VACÍO
// que el DocEditor titulaba «Documento» y esa palabra PISABA el nombre real de la
// tarea al guardar — el bug grave que reportó Alberto («me encuentro tantos
// elementos llamados Documento»). Sigue siendo una TAREA: checkbox + chips de
// fecha/hora/repetición (clic abre el popover real) + su contexto (clic navega,
// antes no hacía nada) + un espacio de NOTAS libre (no el body de la tarea).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { containerNotesNode, getOrCreateContainerNotes } from '../../utils/cajones'
import { timeLabel, dueLabel, dueColor, recLabel } from '../../components/panels/TaskRow'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import { V2NoteBody, V2NoteContext } from './V2DetailView'
import Icon from './Icon'

interface Props {
  node: Node
  onSelectCtx: (id: string) => void
}

export default function V2TaskDetailView({ node, onSelectCtx }: Props) {
  useStore()
  const { t, i18n } = useTranslation()
  const [showProps, setShowProps] = useState(false)
  const done = node.status === 'done'

  // Get-or-create FUERA del render (antes vivía en un useMemo, que ejecuta
  // `store.createNode` en fase de render la primera vez que se abre una tarea
  // sin «Notas» todavía — mutación con efecto secundario durante el render de
  // OTRO componente suscrito al store, `V2App` entre ellos: React lo marcaba
  // con "Cannot update a component while rendering a different component").
  // Lectura (`containerNotesNode`) sigue siendo síncrona para no perder un
  // render con las notas ya existentes; solo la CREACIÓN pasa a un efecto.
  const [notesNode, setNotesNode] = useState<Node | null>(() => containerNotesNode(node.id))
  useEffect(() => {
    setNotesNode(containerNotesNode(node.id) ?? getOrCreateContainerNotes(node.id))
  }, [node.id])

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
          >{done ? <Icon name="check" size={12} strokeWidth={2.4} /> : null}</button>
        )}
        <button className="v2-el-ctxchip" style={{ cursor: 'pointer', border: 'none', background: 'var(--bg-hover)' }}
          onClick={() => setShowProps(v => !v)} title={t('dailyCockpit.editDateRecurrence')}>
          <Icon name="calendar" size={13} /> {due || t('modal.dueDate')}
        </button>
        {time && <span className="dc-time">{time}</span>}
        {rec && <span className="dc-rec"><Icon name="repeat" size={13} /> {rec}</span>}
        <button
          title={t('tip.delete', 'Eliminar')}
          onClick={() => { trashNode(node.id); window.dispatchEvent(new Event('from:close-detail')) }}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>

      {/* Contexto — chip + lápiz para editarlo (antes solo lectura: si había
          contexto navegaba, si no, "Sin contexto" era un texto inerte). Mismo
          patrón que cualquier nota (V2NoteContext, ver V2DetailView.tsx). */}
      <div style={{ marginBottom: 8 }}>
        <V2NoteContext node={node} onSelectCtx={onSelectCtx} inline />
      </div>

      {/* Notas — EL MISMO editor completo que cualquier nota, NO es el título de la tarea. */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>{t('v2.context.notes', 'Notas')}</div>
        {notesNode && <V2NoteBody node={notesNode} onSelectCtx={onSelectCtx} inlinePage hideContext />}
      </div>

      {showProps && <TaskPropsPopover node={node} allowDelete onDeleted={() => window.dispatchEvent(new Event('from:close-detail'))} onClose={() => setShowProps(false)} />}
    </div>
  )
}
