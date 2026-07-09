// Alta rápida de TAREA y EVENTO para un día concreto (nota diaria de la Agenda).
// Crea el nodo como hijo del día con `due` = ese día → aparece ya estilizado en los
// bloques de DayColumn (checkbox/pills/hover para tareas; badge de hora para eventos).
import { useState } from 'react'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'

export default function V2DayQuickAdd({ dayNode }: { dayNode: Node }) {
  const [taskText, setTaskText] = useState('')
  const [evtText, setEvtText] = useState('')

  const dayDate = () => {
    const d = dayNode.diaryDate ? new Date(dayNode.diaryDate) : new Date()
    d.setHours(9, 0, 0, 0)
    return d.toISOString()
  }

  const addTask = () => {
    const tx = taskText.trim(); if (!tx) return
    const n = store.createNode({ text: tx, parentId: dayNode.id, isTask: true })
    store.updateNode(n.id, { status: 'pending', due: dayDate() })
    setTaskText('')
  }
  const addEvent = () => {
    const tx = evtText.trim(); if (!tx) return
    const n = store.createNode({ text: tx, parentId: dayNode.id })
    store.updateNode(n.id, { isEvent: true, due: dayDate() })
    setEvtText('')
  }

  return (
    <div style={{ display: 'flex', gap: 8, margin: '4px 0 10px' }}>
      <input
        className="v2-quickadd" style={{ flex: 1 }}
        placeholder="＋ Tarea del día…"
        value={taskText}
        onChange={e => setTaskText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask() } }}
      />
      <input
        className="v2-quickadd" style={{ flex: 1 }}
        placeholder="＋ Evento del día…"
        value={evtText}
        onChange={e => setEvtText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEvent() } }}
      />
    </div>
  )
}
