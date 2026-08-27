// Bloque «Tareas» de un DOCUMENTO — el seguimiento de un alumno, un cliente o un
// proyecto vive en su propio documento, no como una tarea suelta en otro sitio
// (Alberto, 6 ago 2026: "si tengo un documento de Alejandro Mantecón que es un
// alumno me gustaría poder establecer tareas en el propio documento, por ejemplo
// seguimiento cada 15 días").
//
// Lo que se ve aquí NO es una lista aparte: son las tareas reales del documento
// (utils/docTasks.ts) — las escritas con una casilla en el cuerpo y las creadas
// desde aquí, incluidas las instancias que la recurrencia ya movió al día que
// tocaba. Pulsarlas en el cockpit o en el planner abre este documento (V2App).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { tasksOfDoc } from '../../utils/docTasks'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { recurrenceFromString } from '../../utils/naturalDate'
import { fmtDate } from '../../utils/formatDate'
import Icon from './Icon'
import type { Node } from '../../types'

function TaskRow({ task, flash }: { task: Node; flash: boolean }) {
  const { t, i18n } = useTranslation()
  const done = task.status === 'done'
  const rec = task.recurrence ? recurrenceFromString(task.recurrence) : null
  // Fecha y recurrencia se editan en el MISMO sitio que cualquier tarea (TaskPropsModal,
  // vía el evento global) — nada de un editor propio que se desincronice.
  const openProps = () => window.dispatchEvent(new CustomEvent('from:open-task-props', { detail: { nodeId: task.id } }))
  return (
    <div className={`v2-doctask${done ? ' v2-doctask--done' : ''}${flash ? ' v2-doctask--flash' : ''}`}>
      <input type="checkbox" checked={done} onChange={() => toggleTaskDone(task)} title={done ? t('tip.reopen', 'Reabrir') : t('tip.complete', 'Completar')} />
      <span className="v2-doctask-title">{task.text}</span>
      <button className="v2-doctask-chip" onClick={openProps} title={t('taskPropsModal.title', 'Fecha, recurrencia y prioridad')}>
        {task.due ? fmtDate(task.due, i18n.language) : '···'}
        {rec && <span className="v2-doctask-rec"><Icon name="repeat" size={11} /> {rec.display}</span>}
      </button>
    </div>
  )
}

export default function V2DocTasks({ docId }: { docId: string }) {
  useStore()
  const { t } = useTranslation()
  const [showDone, setShowDone] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)

  // Abrir el documento desde una de sus tareas (cockpit, planner, buscador) resalta
  // la tarea concreta: sin eso, el salto deja al usuario en un documento largo sin
  // pista de por qué está ahí.
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { docId?: string; taskId?: string }
      if (d?.docId !== docId || !d.taskId) return
      setFlashId(d.taskId)
      setShowDone(true)
      setTimeout(() => setFlashId(null), 2200)
    }
    window.addEventListener('from:highlight-doc-task', h as EventListener)
    return () => window.removeEventListener('from:highlight-doc-task', h as EventListener)
  }, [docId])

  const tasks = tasksOfDoc(docId)
  const pending = tasks.filter(n => n.status !== 'done')
  const done = tasks.filter(n => n.status === 'done')

  // Sin botón "+ Tarea": las tareas del documento se crean con el comando slash
  // en el propio cuerpo (Alberto, 27 ago 2026: "ya no es necesario, se pueden
  // crear con el comando slash, y ese bloque en la parte superior ensucia").
  // El bloque solo se pinta si YA hay tareas — nada que mostrar, nada que limpiar.
  if (pending.length === 0 && done.length === 0) return null

  return (
    <div className="v2-doctasks">
      <div className="v2-section-label" style={{ padding: '0 0 4px' }}>{t('docTasks.title', 'Tareas')}</div>
      {pending.map(n => <TaskRow key={n.id} task={n} flash={flashId === n.id} />)}
      {done.length > 0 && (
        showDone
          ? done.map(n => <TaskRow key={n.id} task={n} flash={flashId === n.id} />)
          : <button className="v2-done-toggle" onClick={() => setShowDone(true)}>
              {t('v2.taskList.doneCount', 'Completadas ({{count}})', { count: done.length })}
            </button>
      )}
    </div>
  )
}
