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
import { dueLabel, dueColor } from '../../components/panels/TaskRow'
import { taskCheckState } from '../../utils/taskNode'
import Icon from './Icon'
import type { Node } from '../../types'

// Mismas clases `dc-*` que TaskRow.tsx (la fila de tarea única del resto de la
// app: Hoy, Elementos, otros días…) — no una copia con estilo propio (Alberto,
// 3 sep 2026: "que sea el mismo estilo que las tareas de la columna
// derecha"). Checkbox + título en la primera línea, fecha + «+» en la
// segunda — sin chip de contexto: aquí siempre es el del propio documento,
// repetirlo no aporta nada.
function TaskRow({ task, flash }: { task: Node; flash: boolean }) {
  const { t, i18n } = useTranslation()
  const done = task.status === 'done'
  const rec = task.recurrence ? recurrenceFromString(task.recurrence) : null
  const due = dueLabel(task, i18n.language)
  // Fecha y recurrencia se editan en el MISMO sitio que cualquier tarea (TaskPropsModal,
  // vía el evento global) — nada de un editor propio que se desincronice.
  const openProps = () => window.dispatchEvent(new CustomEvent('from:open-task-props', { detail: { nodeId: task.id } }))
  return (
    <div className={`dc-row${done ? ' dc-row--done' : ''}${flash ? ' v2-doctask--flash' : ''}`}>
      <button className={`dc-check dc-check--${taskCheckState(task)}`} onClick={() => toggleTaskDone(task)}
        title={done ? t('tip.reopen', 'Reabrir') : t('tip.complete', 'Completar')}>
        {done ? <Icon name="check" size={11} strokeWidth={2.6} /> : null}
      </button>
      <div className="dc-row-main">
        <div className="dc-row-l1">
          <span className="dc-text dc-text--wrap">{task.text}</span>
        </div>
        <div className="dc-row-l2">
          {due && (
            <span className="dc-due" style={{ cursor: 'pointer', color: dueColor(task) }}
              title={t('taskPropsModal.title', 'Fecha, recurrencia y prioridad')} onClick={openProps}>{due}</span>
          )}
          {!done && (
            <span className="dc-due dc-due--empty" title={t('taskPropsModal.title', 'Fecha, recurrencia y prioridad')}
              onClick={openProps}>+</span>
          )}
          {rec && <span className="dc-rec" title={rec.display}><Icon name="repeat" size={12} /> {rec.display}</span>}
        </div>
      </div>
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
