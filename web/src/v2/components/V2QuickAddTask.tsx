// Añadir tarea rápida bajo un nodo (contexto o conversación). Enter crea la tarea.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'

export default function V2QuickAddTask({ parentId }: { parentId: string }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const add = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const n = store.createNode({ text: trimmed, parentId, isTask: true })
    store.updateNode(n.id, { status: 'pending' })
    setText('')
  }
  return (
    <input
      className="v2-quickadd"
      placeholder={t('v2.addTaskEllipsis', '＋ Añadir tarea…')}
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
    />
  )
}
