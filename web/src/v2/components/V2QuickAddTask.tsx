// Añadir tarea rápida bajo un nodo (contexto o conversación). Enter crea la tarea.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { useToast } from '../../components/Toast'
import { extractDateFromEnd, recurrenceToString } from '../../utils/naturalDate'

export default function V2QuickAddTask({ parentId }: { parentId: string }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const add = () => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Extraer fecha/hora/recurrencia en lenguaje natural (mismo parser que la
    // captura rápida del outliner y del chat) — evita que "todos los dias de
    // 12 a 14" se cree como texto plano sin hora ni recurrencia.
    const dp = extractDateFromEnd(trimmed)
    const cleanText = dp ? dp.cleanText : trimmed
    const n = store.createNode({ text: cleanText.trim() || trimmed, parentId, isTask: true })

    const updates: Record<string, unknown> = { status: 'pending' }
    if (dp?.parsed.date) {
      if (dp.timeStr) {
        const [h, m] = dp.timeStr.split(':').map(Number)
        const d = new Date(dp.parsed.date)
        d.setHours(h, m, 0, 0)
        updates.due = d.toISOString()
        updates.isEvent = true
        if (dp.endTimeStr) {
          const [eh, em] = dp.endTimeStr.split(':').map(Number)
          const dEnd = new Date(dp.parsed.date)
          dEnd.setHours(eh, em, 0, 0)
          updates.dueEnd = dEnd.toISOString()
        }
      } else {
        updates.due = dp.parsed.date.toISOString()
      }
      if (dp.parsed.recurrence) {
        updates.recurrence = recurrenceToString(dp.parsed.recurrence)
      }
    }
    store.updateNode(n.id, updates)
    showToast(t('ai.actionTaskCreated', 'Tarea creada'))
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
