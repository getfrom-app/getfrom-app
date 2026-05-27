/**
 * agendaHelper — Utilidades para el árbol temporal de WF
 *
 * Jerarquía: 📅 Agenda → Año → Mes → Día (sin Semana)
 *
 * El nodo raíz se llama "📅 Agenda". Se reconocen también nombres legacy
 * ("Calendario", "Calendar", "Planificador") para compatibilidad.
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export const AGENDA_ROOT_NAME = '📅 Agenda'

/** Busca el nodo raíz Agenda */
export function findAgendaRoot(): Node | undefined {
  return store.children(null).find(n => !n.deletedAt && n.text === AGENDA_ROOT_NAME)
}

/** Encuentra o crea el nodo raíz Agenda */
export function getOrCreateAgendaRoot(): Node {
  return findAgendaRoot() ?? store.createNode({ text: AGENDA_ROOT_NAME, parentId: null })
}

/** Encuentra o crea el nodo de año bajo Agenda */
export function getOrCreateYearNode(year: number, agendaId?: string): Node {
  const agenda = agendaId ? store.getNode(agendaId) : getOrCreateAgendaRoot()
  if (!agenda) return getOrCreateAgendaRoot() // fallback
  const yearText = String(year)
  const existing = store.children(agenda.id).find(c => !c.deletedAt && c.text === yearText)
  if (existing) return existing
  return store.createNode({ text: yearText, parentId: agenda.id })
}

/** Encuentra o crea el nodo de mes bajo el año */
export function getOrCreateMonthNode(monthIdx: number, yearId: string): Node {
  const monthText = MONTHS_ES[monthIdx]
  const existing = store.children(yearId).find(
    c => !c.deletedAt && c.text?.toLowerCase() === monthText.toLowerCase()
  )
  if (existing) return existing
  return store.createNode({ text: monthText, parentId: yearId })
}

/** Encuentra o crea el nodo de día (diary entry) bajo el mes */
export function getOrCreateDayNode(date: Date, monthId: string): Node {
  const year  = date.getFullYear()
  const month = date.getMonth()
  const day   = date.getDate()
  // Buscar por diaryDate
  const existing = store.children(monthId).find(c => {
    if (c.deletedAt || !c.diaryDate) return false
    const d = new Date(c.diaryDate)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
  })
  if (existing) return existing
  // Crear
  const dayDate = new Date(year, month, day, 0, 0, 0, 0)
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

/**
 * Navega a la nota de un día concreto, creando toda la jerarquía si es necesario.
 * Devuelve el nodo del día.
 * SIEMPRE busca bajo el árbol Agenda — ignora entradas bajo jerarquía antigua (Semana...).
 */
export function ensureDayPath(date: Date): Node {
  const agenda = getOrCreateAgendaRoot()
  const yearN  = getOrCreateYearNode(date.getFullYear(), agenda.id)
  const monthN = getOrCreateMonthNode(date.getMonth(), yearN.id)
  return getOrCreateDayNode(date, monthN.id)
}

/**
 * Devuelve la nota de hoy.
 * Estrategia:
 *  1. Si ya existe un diary entry para hoy en cualquier parte del store → lo usa
 *  2. Si no → crea la jerarquía Agenda → Año → Mes → Día y lo crea ahí
 *
 * Así evitamos conflictos con nodos creados desde Mac/iOS y race conditions de sync.
 */
export function getTodayDiaryUnderAgenda(): Node {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()

  // 1. Buscar en TODO el store (incluye nodos del Mac/iOS)
  const existing = Array.from(store.nodes.values()).find(n => {
    if (!n.isDiaryEntry || n.deletedAt || !n.diaryDate) return false
    const dt = new Date(n.diaryDate)
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d
  })
  if (existing) return existing

  // 2. No existe — crear bajo Agenda
  const agenda  = getOrCreateAgendaRoot()
  const yearN   = getOrCreateYearNode(y, agenda.id)
  const monthN  = getOrCreateMonthNode(m, yearN.id)
  return getOrCreateDayNode(today, monthN.id)
}
