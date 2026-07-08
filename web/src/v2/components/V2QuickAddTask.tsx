// Añadir tarea rápida bajo un nodo (contexto o conversación). Enter crea la tarea.
import { useState } from 'react'
import { store } from '../../store/nodeStore'

export default function V2QuickAddTask({ parentId }: { parentId: string }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (!t) return
    const n = store.createNode({ text: t, parentId, isTask: true })
    store.updateNode(n.id, { status: 'pending' })
    setText('')
  }
  return (
    <input
      className="v2-quickadd"
      placeholder="＋ Añadir tarea…"
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
    />
  )
}
