// Abrir la nota diaria de una fecha cualquiera (creándola si no existe, con id
// determinista → nunca duplica). Reutiliza el patrón de TemporalChildrenBlock,
// para que el mini-calendario lleve a un día y la columna del día se pinte igual.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { diaryId } from './deterministicId'

export function ensureDiaryForDate(date: Date): Node {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const targetEnd = new Date(target.getTime() + 86400000)
  const existing = [...store.nodes.values()].find(n => {
    if (!n.isDiaryEntry || n.deletedAt || !n.diaryDate) return false
    const dd = new Date(n.diaryDate)
    return dd >= target && dd < targetEnd
  })
  if (existing) return existing
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return store.createNode({
    text: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
    parentId: null,
    isDiaryEntry: true,
    diaryDate: `${y}-${m}-${dd}T00:00:00.000Z`,
    predefinedId: diaryId(date) ?? undefined, // canónico → nunca duplica
  })
}
