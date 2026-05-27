/**
 * agendaHelper — Árbol temporal de WF
 * Jerarquía exclusiva: 📅 Agenda → Año → Mes → Día
 * NO busca nunca en jerarquía antigua (Semana, etc.)
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export const AGENDA_ROOT_NAME = '📅 Agenda'

// ── Primitivas ────────────────────────────────────────────────────────────────

export function findAgendaRoot(): Node | undefined {
  return store.children(null).find(n => !n.deletedAt && n.text === AGENDA_ROOT_NAME)
}

export function getOrCreateAgendaRoot(): Node {
  return findAgendaRoot() ?? store.createNode({ text: AGENDA_ROOT_NAME, parentId: null })
}

function getOrCreateYear(year: number, agendaId: string): Node {
  const yearText = String(year)
  return store.children(agendaId).find(c => !c.deletedAt && c.text === yearText)
    ?? store.createNode({ text: yearText, parentId: agendaId })
}

function getOrCreateMonth(monthIdx: number, yearId: string): Node {
  const monthText = MONTHS_ES[monthIdx]
  return store.children(yearId).find(c => !c.deletedAt && c.text?.toLowerCase() === monthText.toLowerCase())
    ?? store.createNode({ text: monthText, parentId: yearId })
}

function getOrCreateDay(date: Date, monthId: string): Node {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate()
  const existing = store.children(monthId).find(c => {
    if (c.deletedAt || !c.diaryDate) return false
    const dt = new Date(c.diaryDate)
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d
  })
  if (existing) return existing
  const dayDate = new Date(y, m, d, 0, 0, 0, 0)
  const dayText = dayDate.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())
  return store.createNode({
    text: dayText,
    parentId: monthId,
    isDiaryEntry: true,
    diaryDate: dayDate.toISOString(),
  })
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Crea (si no existe) y devuelve el nodo del día dado
 * bajo la jerarquía Agenda → Año → Mes → Día.
 * NUNCA busca fuera de Agenda.
 */
export function ensureDayPath(date: Date): Node {
  const agenda = getOrCreateAgendaRoot()
  const yearN  = getOrCreateYear(date.getFullYear(), agenda.id)
  const monthN = getOrCreateMonth(date.getMonth(), yearN.id)
  return getOrCreateDay(date, monthN.id)
}

/**
 * Devuelve la nota de HOY buscando SOLO bajo Agenda.
 * Si no existe bajo Agenda la crea — ignora completamente
 * cualquier diary entry que exista bajo jerarquías antiguas (Semana...).
 */
export function getTodayDiaryUnderAgenda(): Node {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()

  // Buscar SOLO bajo Agenda → Año → Mes
  const agenda = findAgendaRoot()
  if (agenda) {
    const yearNode = store.children(agenda.id)
      .find(c => !c.deletedAt && c.text === String(y))
    if (yearNode) {
      const monthNode = store.children(yearNode.id)
        .find(c => !c.deletedAt && c.text?.toLowerCase() === MONTHS_ES[m].toLowerCase())
      if (monthNode) {
        const dayNode = store.children(monthNode.id).find(c => {
          if (c.deletedAt || !c.diaryDate) return false
          const dt = new Date(c.diaryDate)
          return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d
        })
        if (dayNode) return dayNode
      }
    }
  }

  // No existe bajo Agenda → crear la jerarquía completa
  return ensureDayPath(today)
}

// Mantener para compatibilidad con imports existentes
export { getOrCreateYear as getOrCreateYearNode, getOrCreateMonth as getOrCreateMonthNode, getOrCreateDay as getOrCreateDayNode }
