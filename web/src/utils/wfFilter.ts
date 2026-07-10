/**
 * wfFilter — Motor de filtros para Fromly
 *
 * Soporta:
 *   - Operadores booleanos: "y" (AND), "o" (OR)
 *     Ejemplo: "tarea y vencido o hoy"
 *     → (tarea AND vencido) OR hoy
 *   - Operadores de fecha: hoy, mañana, semana, mes, pasado, futuro
 *   - Operadores de estado: tarea, pendiente, hecho, vencido/overdue
 *   - Operadores especiales: sin-fecha, con-fecha, favorito, diario, recurso, evento
 *   - Tags: #tag, @contexto
 *   - Wiki-links: [[nombre]]
 *   - Texto libre (búsqueda por contenido)
 *
 * Precedencia: AND > OR  (igual que en lógica booleana estándar)
 *   "a y b o c" → (a AND b) OR c
 */

import type { Node } from '../types'
import { normalizeText } from './normalize'
import { structuralId } from './deterministicId'

interface FilterResult {
  matchIds: Set<string>
  ancestorIds: Set<string>
  hasFilter: boolean
}

// ── Helpers de fecha ───────────────────────────────────────────────────────

function todayMidnight(): Date {
  const d = new Date(); d.setHours(0,0,0,0); return d
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr), t = todayMidnight()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function isTomorrow(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0,0,0,0)
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function isThisWeek(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0)
  const end = new Date(start); end.setDate(start.getDate() + 7)
  return d >= start && d < end
}

function isThisMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr), now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d < todayMidnight()
}

/** Ayer y antes
 * - Nodos de diario (isDiaryEntry): usa diaryDate
 * - Tareas/notas regulares: usa SOLO due (diaryDate es metadata de dónde se creó, no vencimiento)
 */
function isPast(node: Node): boolean {
  // Para diarios: usar diaryDate
  if (node.isDiaryEntry) {
    if (!node.diaryDate) return false
    return new Date(node.diaryDate) < todayMidnight()
  }
  // Para tareas/notas: solo la fecha de vencimiento explícita
  if (!node.due) return false
  return new Date(node.due) < todayMidnight()
}

/** Mañana en adelante
 * - Nodos de diario: usa diaryDate
 * - Tareas/notas: usa due
 */
function isFuture(node: Node): boolean {
  const ref = node.isDiaryEntry ? node.diaryDate : node.due
  if (!ref) return false
  const d = new Date(ref)
  const tomorrow = todayMidnight(); tomorrow.setDate(tomorrow.getDate() + 1)
  return d >= tomorrow
}

// ── Matching de un token contra un nodo ───────────────────────────────────

function matchesToken(token: string, node: Node, nodes: Map<string, Node>): boolean {
  switch (token) {
    // Fecha — ES + EN
    case 'hoy':
    case 'today':    return isToday(node.due) || isToday(node.diaryDate)
    case 'manana':
    case 'mañana':
    case 'tomorrow': return isTomorrow(node.due)
    case 'semana':
    case 'week':     return isThisWeek(node.due)
    case 'mes':
    case 'month':    return isThisMonth(node.due) || isThisMonth(node.diaryDate)
    case 'pasado':
    case 'past':     return isPast(node)
    case 'futuro':
    case 'future':   return isFuture(node)
    case 'con-fecha':
    case 'con fecha':
    case 'confecha':
    case 'dated':    return !!node.due

    // Estado de tarea — ES + EN
    case 'tarea':
    case 'task':
    case 'tipo:tarea':  return node.status !== null && node.status !== undefined
    case 'pendiente':
    case 'pending':     return node.status === 'pending'
    case 'hecho':
    case 'done':
    case 'completed':   return node.status === 'done'
    case 'futuro-tarea':
    case 'programada':
    case 'scheduled':   return node.status === 'future'
    case 'vencido':
    case 'overdue':     return node.status === 'pending' && isOverdue(node.due)
    case 'sin-fecha':
    case 'sinfecha':
    case 'undated':     return node.status === 'pending' && !node.due

    // Tipo de nodo — ES + EN
    case 'nota':
    case 'note':
    case 'tipo:nota':   return node.status === null && !node.isEvent && !node.isResource
    case 'evento':
    case 'event':
    case 'tipo:evento': return !!node.isEvent
    case 'favorito':
    case 'favorite':    return !!node.isFavorite
    case 'diario':
    case 'journal':
    case 'diary':       return !!node.isDiaryEntry
    case 'recurso':
    case 'resource':    return !!node.isResource
    case 'archivo':
    case 'file': {
      // Archivos subidos: tienen _resourceKey en extraData o _resourceType image/pdf/file
      if (!node.isResource) return false
      try {
        const ed = JSON.parse(node.extraData || '{}')
        return !!(ed._resourceKey || ['image','pdf','file'].includes(ed._resourceType))
      } catch { return false }
    }
    case 'enlace':
    case 'link': {
      // URLs pegadas: isResource pero sin _resourceKey (no subido)
      if (!node.isResource) return false
      try {
        const ed = JSON.parse(node.extraData || '{}')
        return !ed._resourceKey && !['image','pdf','file'].includes(ed._resourceType)
      } catch { return false }
    }
    case 'documento':
    case 'document':
    case 'doc': {
      // Documento de texto rico (TipTap): extraData._doc === '1'
      try { return JSON.parse(node.extraData || '{}')._doc === '1' } catch { return false }
    }
    case 'pdf': {
      try {
        const ed = JSON.parse(node.extraData || '{}')
        return ed._resourceType === 'pdf' || /\.pdf($|\?)/i.test(ed._resourceUrl || node.resourceUrl || '')
      } catch { return false }
    }
    case 'imagen':
    case 'image':
    case 'img': {
      try {
        const ed = JSON.parse(node.extraData || '{}')
        return ed._resourceType === 'image' || /\.(jpe?g|png|gif|webp|svg)($|\?)/i.test(ed._resourceUrl || node.resourceUrl || '')
      } catch { return false }
    }
    case 'activo':      return !!node.isActive
    case 'captura':
    case 'capture':     return (node.types || []).includes('captura')
    case 'cajon':
    case 'cajón':
    case 'cajones':
    case 'proyecto':
    case 'proyectos':   { try { const a = JSON.parse(node.extraData || '{}')._ctxRefs; return Array.isArray(a) && a.length > 0 } catch { return false } }

    default:
      // @tag o #tag
      if (token.startsWith('@') || token.startsWith('#')) {
        const tagName = token.slice(1)
        // Solo comprobar types[] — el filtro de contexto muestra nodos con
        // ese contexto ASIGNADO (@contexto en types[]), no descendientes del
        // nodo de definición en 🧠 Contexto (isStructuralChild eliminado).
        return (node.types || []).some(t => normalizeText(t).includes(tagName))
      }

      // [[wiki-link]]
      if (token.startsWith('[[') && token.endsWith(']]')) {
        const refName = normalizeText(token.slice(2, -2))
        return normalizeText(node.text || '').includes(`[[${refName}`) ||
               normalizeText(node.body || '').includes(`[[${refName}`)
      }

      // node:id
      if (token.startsWith('node:')) {
        const targetNodeId = token.slice(5)
        if (node.id === targetNodeId) return false
        const isDescendant = (() => {
          let cur = nodes.get(node.id)
          const vis = new Set<string>()
          while (cur?.parentId && !vis.has(cur.id)) {
            vis.add(cur.id)
            if (cur.parentId === targetNodeId) return true
            cur = nodes.get(cur.parentId)
          }
          return false
        })()
        const targetNode = nodes.get(targetNodeId)
        const targetSlug = targetNode
          ? (targetNode.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
          : ''
        const hasSlug = !!targetSlug && (
          (node.types || []).some(t => t === targetSlug || t.endsWith('/' + targetSlug)) ||
          normalizeText(node.text || '').includes(`@${targetSlug}`)
        )
        return isDescendant || hasSlug
      }

      // Texto libre
      return normalizeText(node.text || '').includes(token) ||
             normalizeText(node.body || '').includes(token)
  }
}

// ── Parser de consulta con booleanos ──────────────────────────────────────
//
// La consulta se divide por " o " (OR) en grupos.
// Cada grupo se divide por " y " y por espacios (AND implícito).
// Las palabras de conexión "y" y "o" se eliminan de los tokens.
//
// "tarea y vencido o hoy" → [[tarea, vencido], [hoy]]
// "pendiente vencido o hoy mañana" → [[pendiente, vencido], [hoy, mañana]]

function parseOrGroups(filterText: string): string[][] {
  // Dividir por " o " como separador OR (con espacios para no romper "@o" o "octubre")
  const orParts = filterText.split(/\s+(?:o|or)\s+/i)
  return orParts.map(part => {
    // Tokenizar cada parte (respetar [[wiki]], @tag, #tag)
    const rawTokens: string[] = []
    const tokenRegex = /\[\[[^\]]+\]\]|@[\wÀ-ɏ\/\-]+|#[\wÀ-ɏ\/\-]+|\S+/g
    let m: RegExpExecArray | null
    while ((m = tokenRegex.exec(part)) !== null) rawTokens.push(m[0])
    // Normalizar y filtrar "y" / "and" (AND explícito — ya es el comportamiento por defecto)
    return rawTokens
      .map(t => normalizeText(t))
      .filter(t => t && t !== 'y' && t !== 'and')
  }).filter(g => g.length > 0)
}

// ── Función principal ──────────────────────────────────────────────────────

export function applyWFFilter(
  nodes: Map<string, Node>,
  filterText: string
): FilterResult {
  const text = filterText.trim()
  if (!text) return { matchIds: new Set(), ancestorIds: new Set(), hasFilter: false }

  const orGroups = parseOrGroups(text)
  if (orGroups.length === 0 || orGroups.every(g => g.length === 0)) {
    return { matchIds: new Set(), ancestorIds: new Set(), hasFilter: false }
  }

  const matchIds = new Set<string>()

  // El filtro SOLO busca dentro de 📅 Agenda. Todo lo demás (contextos,
  // papelera, carpetas de sistema, perfil IA, atajos…) queda fuera del scope.
  // Robusto al reparent bajo 🏠 From: por id determinista; fallback por texto SIN
  // exigir parentId=null (Agenda ya no vive en la raíz tras introducir 🏠 From).
  let agendaRootId: string | null = null
  const detAgendaId = structuralId('agenda')
  const detAgenda = detAgendaId ? nodes.get(detAgendaId) : undefined
  if (detAgenda && !detAgenda.deletedAt) {
    agendaRootId = detAgenda.id
  } else {
    for (const n of nodes.values()) {
      if (!n.deletedAt && (n.text || '') === '📅 Agenda') { agendaRootId = n.id; break }
    }
  }

  // Precalcular si un nodo desciende de un id concreto (subiendo por parentId)
  function isDescendantOf(nodeId: string, ancestorId: string): boolean {
    let cur = nodes.get(nodeId)
    const visited = new Set<string>()
    while (cur?.parentId && !visited.has(cur.parentId)) {
      visited.add(cur.parentId)
      if (cur.parentId === ancestorId) return true
      cur = nodes.get(cur.parentId)
    }
    return false
  }

  for (const node of nodes.values()) {
    if (node.deletedAt) continue
    // Scope: solo descendientes de 📅 Agenda (no el propio nodo Agenda).
    // Si no existe Agenda, no hay nada que filtrar.
    if (!agendaRootId || !isDescendantOf(node.id, agendaRootId)) continue

    // Un nodo coincide si CUALQUIER grupo OR coincide (OR entre grupos)
    // Un grupo coincide si TODOS sus tokens coinciden (AND dentro de grupo)
    const matches = orGroups.some(andTokens =>
      andTokens.every(token => matchesToken(token, node, nodes))
    )

    if (matches) matchIds.add(node.id)
  }

  // Construir ancestros
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

// ── Detección de consulta inteligente ─────────────────────────────────────

const SMART_OPERATORS = [
  // Español
  'hoy', 'mañana', 'semana', 'mes', 'pasado', 'futuro',
  'tarea', 'pendiente', 'hecho', 'vencido', 'overdue',
  'sin-fecha', 'sinfecha', 'con-fecha', 'confecha',
  'nota', 'favorito', 'diario', 'recurso', 'archivo', 'enlace', 'activo', 'evento', 'tipo:', 'captura',
  'documento', 'pdf', 'imagen',
  // English
  'today', 'tomorrow', 'week', 'month', 'past', 'future',
  'task', 'pending', 'done', 'completed', 'scheduled', 'undated', 'dated',
  'note', 'favorite', 'journal', 'diary', 'resource', 'file', 'link', 'event',
  'document', 'doc', 'image', 'img',
]

export function isSmartQuery(text: string): boolean {
  const lower = text.toLowerCase()
  return SMART_OPERATORS.some(op => lower.includes(op)) ||
    lower.includes('#') || lower.includes('@') || lower.includes('[[') || lower.startsWith('node:')
}

// ── Sugerencias de chips del filtro ───────────────────────────────────────

export const FILTER_SUGGESTIONS_ES = [
  { label: 'Hoy',         query: 'hoy' },
  { label: 'Tareas',      query: 'tarea' },
  { label: 'Pendientes',  query: 'pendiente' },
  { label: 'Vencidas',    query: 'vencido' },
  { label: 'Esta semana', query: 'semana' },
  { label: 'Este mes',    query: 'mes' },
  { label: 'Pasado',      query: 'pasado' },
  { label: 'Futuro',      query: 'futuro' },
  { label: 'Sin fecha',   query: 'sin-fecha' },
  { label: 'Favoritos',   query: 'favorito' },
  { label: 'Eventos',     query: 'evento' },
]

export const FILTER_SUGGESTIONS_EN = [
  { label: 'Today',       query: 'today' },
  { label: 'Tasks',       query: 'task' },
  { label: 'Pending',     query: 'pending' },
  { label: 'Overdue',     query: 'overdue' },
  { label: 'This week',   query: 'week' },
  { label: 'This month',  query: 'month' },
  { label: 'Past',        query: 'past' },
  { label: 'Future',      query: 'future' },
  { label: 'No date',     query: 'undated' },
  { label: 'Favorites',   query: 'favorite' },
  { label: 'Events',      query: 'event' },
]

// Para compatibilidad con código existente
export const FILTER_SUGGESTIONS = FILTER_SUGGESTIONS_ES

export function getFilterSuggestions(lang: string) {
  return lang.startsWith('en') ? FILTER_SUGGESTIONS_EN : FILTER_SUGGESTIONS_ES
}

// ── Ejemplos de consultas booleanas (para el placeholder/ayuda) ────────────
//
//   tarea y vencido          → tareas pendientes con fecha pasada
//   pendiente y sin-fecha    → tareas sin fecha asignada
//   hoy o mañana             → nodos de hoy o de mañana
//   tarea y hoy o tarea y mañana  → tareas de hoy o de mañana
//   favorito y pendiente     → tareas favoritas pendientes
//   pasado y pendiente       → todas las tareas no hechas de días anteriores
//   futuro y tarea           → tareas programadas para el futuro
