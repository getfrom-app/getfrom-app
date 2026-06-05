/**
 * agendaHelper — Árbol temporal de WF
 * Jerarquía exclusiva: 📅 Agenda → Año → Mes → Día
 * NO busca nunca en jerarquía antigua (Semana, etc.)
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { structuralId, diaryId } from './deterministicId'

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
  return findAgendaRoot() ?? store.createNode({ text: AGENDA_ROOT_NAME, parentId: null, predefinedId: structuralId('agenda') ?? undefined })
}

function getOrCreateYear(year: number, agendaId: string): Node {
  const yearText = String(year)
  return store.children(agendaId).find(c => !c.deletedAt && c.text === yearText)
    ?? store.createNode({ text: yearText, parentId: agendaId, predefinedId: structuralId(`year-${year}`) ?? undefined,
        extraData: { viewBlock: 'calendario', temporalType: 'year', temporalKey: yearText, calScale: 'Año' } })
}

function getOrCreateMonth(monthIdx: number, yearId: string): Node {
  const monthText = MONTHS_ES[monthIdx]
  const yearText = store.getNode(yearId)?.text ?? ''
  return store.children(yearId).find(c => !c.deletedAt && c.text?.toLowerCase() === monthText.toLowerCase())
    ?? store.createNode({ text: monthText, parentId: yearId, predefinedId: structuralId(`month-${yearText}-${monthIdx}`) ?? undefined,
        extraData: { viewBlock: 'calendario', temporalType: 'month', temporalKey: `${yearText}-${monthIdx + 1}`, calScale: 'Mes' } })
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
    siblingOrder: d,   // día del mes (1-31) como orden → siempre cronológico
    predefinedId: diaryId(dayDate) ?? undefined,  // canónico (idéntico a iOS) → no duplica
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

/**
 * relocateRootDiariesToAgenda — mueve diarios sueltos de root hacia Agenda
 *
 * Se llama una vez tras initialLoad() para sanear el estado: si existen
 * nodos isDiaryEntry en root (parentId === null) Y existe 📅 Agenda, los
 * reubica bajo la jerarquía correcta Agenda → Año → Mes → Día.
 *
 * Caso habitual: versiones anteriores creaban el diario en root, ahora
 * debe vivir bajo Agenda. Solo mueve, no duplica.
 */
export async function relocateRootDiariesToAgenda(): Promise<void> {
  const agenda = findAgendaRoot()
  if (!agenda) return  // sin Agenda no hacemos nada

  const rootDiaries = store.allActive().filter(n => n.isDiaryEntry && !n.parentId && n.diaryDate)
  if (rootDiaries.length === 0) return

  for (const diary of rootDiaries) {
    const date = new Date(diary.diaryDate!)
    // Obtener o crear la jerarquía Agenda → Año → Mes
    const agendaId = agenda.id
    const yearNode = await getOrCreateYear(date.getFullYear(), agendaId)
    const monthNode = await getOrCreateMonth(date.getMonth(), yearNode.id)

    // Comprobar si ya existe un diario para ese día bajo la jerarquía Agenda
    const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate()
    const existing = store.children(monthNode.id).find(c => {
      if (c.deletedAt || !c.diaryDate || c.id === diary.id) return false
      const dt = new Date(c.diaryDate)
      return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d
    })

    if (existing) {
      // Ya hay un diario bajo Agenda → mover hijos del diario root al existente y borrar root
      for (const child of store.children(diary.id)) {
        store.updateNode(child.id, { parentId: existing.id })
      }
      store.deleteNode(diary.id)
    } else {
      // No hay diario bajo Agenda → mover el diario root allí
      store.updateNode(diary.id, { parentId: monthNode.id })
    }
  }

  // Forzar sync inmediato para que el cambio se persista en el servidor
  // antes de que el usuario pueda recargar la página (sin esto, la reubicación
  // podría perderse si el usuario recarga en los primeros 1.5s)
  await store.sync(true)
}

// ── Limpieza de contexto en nodos estructurales (año/mes) ──────────────────────

function isYearText(text: string | null | undefined): boolean {
  return /^\d{4}$/.test((text || '').trim())
}

function isMonthText(text: string | null | undefined): boolean {
  const t = (text || '').trim().toLowerCase()
  return MONTHS_ES.some(m => m.toLowerCase() === t)
}

/**
 * cleanupYearMonthContexts — quita contexto y chip de los nodos de Año y Mes.
 *
 * Los nodos estructurales de la Agenda (Año → Mes) nunca deben llevar contexto,
 * pero versiones anteriores podían asignárselo (clasificación IA o arrastre).
 * Esta migración recorre 📅 Agenda → Año → Mes y elimina:
 *   - tipos de contexto en types[] (los que coinciden con un nodo de 🧠 Contexto)
 *   - flags de extraData: _autoContextId, _autoContextConfidence, _contextManuallySet
 */
export function cleanupYearMonthContexts(): void {
  const agenda = findAgendaRoot()
  if (!agenda) return

  // Conjunto de nombres de contexto válidos (para distinguir de tags builtin)
  const ctxRoot = store.children(null).find(n => !n.deletedAt && (n.text === '🧠 Contexto' || n.text === '🏷 Tags'))
  const contextNames = new Set(
    ctxRoot ? store.children(ctxRoot.id).filter(n => !n.deletedAt && n.text).map(n => n.text) : []
  )

  const strip = (node: Node) => {
    let changed = false
    const patch: Partial<Node> = {}

    // Quitar de types[] los que sean contextos
    const types = node.types || []
    const cleanTypes = types.filter(t => !contextNames.has(t))
    if (cleanTypes.length !== types.length) { patch.types = cleanTypes; changed = true }

    // Limpiar flags de contexto en extraData
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._autoContextId !== undefined || ed._autoContextConfidence !== undefined || ed._contextManuallySet !== undefined) {
        delete ed._autoContextId
        delete ed._autoContextConfidence
        delete ed._contextManuallySet
        patch.extraData = JSON.stringify(ed)
        changed = true
      }
    } catch { /* extraData no parseable — ignorar */ }

    if (changed) store.updateNode(node.id, patch)
  }

  for (const year of store.children(agenda.id).filter(n => !n.deletedAt && isYearText(n.text))) {
    strip(year)
    for (const month of store.children(year.id).filter(n => !n.deletedAt && isMonthText(n.text))) {
      strip(month)
    }
  }
}

// Mantener para compatibilidad con imports existentes
export { getOrCreateYear as getOrCreateYearNode, getOrCreateMonth as getOrCreateMonthNode, getOrCreateDay as getOrCreateDayNode }
