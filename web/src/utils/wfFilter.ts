/**
 * wfFilter — Motor de filtros estilo Workflowy para experiment/workflowy
 * Soporta operadores: hoy, mañana, semana, tarea, pendiente, hecho, evento, #tag
 */
import type { Node } from '../types'
import { normalizeText } from './normalize'

interface FilterResult {
  matchIds: Set<string>       // nodos que coinciden
  ancestorIds: Set<string>   // ancestros de coincidencias (visibles pero atenuados)
  hasFilter: boolean
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function isTomorrow(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date()
  t.setDate(t.getDate() + 1)
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function isThisWeek(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0,0,0,0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return d >= start && d < end
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date()
  t.setHours(0,0,0,0)
  return d < t
}

export function applyWFFilter(
  nodes: Map<string, Node>,
  filterText: string
): FilterResult {
  const text = normalizeText(filterText.trim())

  if (!text) return { matchIds: new Set(), ancestorIds: new Set(), hasFilter: false }

  // Parse tokens — respetar [[wiki-link]] como token único
  const rawTokens: string[] = []
  const tokenRegex = /\[\[[^\]]+\]\]|@[\wÀ-ɏ\/\-]+|#[\wÀ-ɏ\/\-]+|\S+/g
  let m: RegExpExecArray | null
  while ((m = tokenRegex.exec(filterText.trim())) !== null) rawTokens.push(m[0])
  const tokens = rawTokens.map(t => normalizeText(t)).filter(Boolean)

  const matchIds = new Set<string>()

  for (const node of nodes.values()) {
    if (node.deletedAt) continue

    let matches = true
    for (const token of tokens) {
      let tokenMatch = false

      if (token === 'hoy') {
        tokenMatch = isToday(node.due) || isToday(node.diaryDate)
      } else if (token === 'mañana') {
        tokenMatch = isTomorrow(node.due)
      } else if (token === 'semana') {
        tokenMatch = isThisWeek(node.due)
      } else if (token === 'tarea' || token === 'tipo:tarea') {
        tokenMatch = node.status !== null && node.status !== undefined
      } else if (token === 'evento' || token === 'tipo:evento') {
        tokenMatch = !!node.isEvent
      } else if (token === 'pendiente') {
        tokenMatch = node.status === 'pending'
      } else if (token === 'hecho') {
        tokenMatch = node.status === 'done'
      } else if (token === 'overdue' || token === 'vencido') {
        tokenMatch = node.status === 'pending' && isOverdue(node.due)
      } else if (token.startsWith('@') || token.startsWith('#')) {
        const tagName = token.slice(1)
        tokenMatch = (node.types || []).some(t => normalizeText(t).includes(tagName)) ||
                     normalizeText(node.text || '').includes(token)
      } else if (token.startsWith('[[') && token.endsWith(']]')) {
        // [[wiki-link]]: encuentra nodos que mencionan esa nota
        const refName = normalizeText(token.slice(2, -2))
        tokenMatch = normalizeText(node.text || '').includes(`[[${refName}`) ||
                     normalizeText(node.body || '').includes(`[[${refName}`)
      } else {
        // Plain text search — sin tildes ni mayúsculas
        tokenMatch = normalizeText(node.text || '').includes(token) ||
                     normalizeText(node.body || '').includes(token)
      }

      if (!tokenMatch) { matches = false; break }
    }

    if (matches) matchIds.add(node.id)
  }

  // Build ancestor set — con detección de ciclos para evitar bucle infinito
  // si existe alguna referencia circular de padres en el árbol.
  const ancestorIds = new Set<string>()
  for (const id of matchIds) {
    let node = nodes.get(id)
    const visited = new Set<string>([id])
    while (node?.parentId && !visited.has(node.parentId)) {
      visited.add(node.parentId)
      ancestorIds.add(node.parentId)
      node = nodes.get(node.parentId)
    }
  }

  return { matchIds, ancestorIds, hasFilter: true }
}

/** Operadores que activan el motor de filtros inteligente */
const SMART_OPERATORS = ['hoy', 'mañana', 'semana', 'tarea', 'pendiente', 'hecho', 'vencido', 'overdue', 'evento', 'tipo:']

export function isSmartQuery(text: string): boolean {
  const lower = text.toLowerCase()
  return SMART_OPERATORS.some(op => lower.includes(op)) || lower.includes('#') || lower.includes('@') || lower.includes('[[')
}

/** Suggestion chips to show below filter input */
export const FILTER_SUGGESTIONS = [
  { label: 'Hoy', query: 'hoy' },
  { label: 'Tareas', query: 'tarea' },
  { label: 'Pendientes', query: 'pendiente' },
  { label: 'Esta semana', query: 'semana' },
  { label: 'Vencidas', query: 'vencido' },
  { label: 'Eventos', query: 'evento' },
]
