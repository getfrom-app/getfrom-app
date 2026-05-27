import { syncNodes, getToken } from '../api/client'
import type { Node, Workspace } from '../types'
import { generateId } from '../utils/id'

const GUEST_NODES_KEY = 'from_guest_nodes'

// Plantilla que se pre-rellena al crear el perfil IA por primera vez.
// El usuario la edita y borra las instrucciones que no necesite.
const PERFIL_IA_TEMPLATE = `Rellena este perfil para que la IA te conozca. Habla en primera persona. Borra estas instrucciones cuando termines.

## Quién soy
Nombre:
Ubicación:
Profesión / actividad principal:

## Mis proyectos y negocios
(Lista aquí tus proyectos, con una frase de contexto para cada uno)

## Mis preferencias de comunicación
- Háblame siempre de tú, directo y sin rodeos
- Sin introducciones ni frases de relleno
(Añade las tuyas)

## Contexto adicional
(Cualquier otra información que la IA deba tener en cuenta)`
const GUEST_WORKSPACES_KEY = 'from_guest_workspaces'

type Listener = () => void

// ── NodeMeta: typed wrapper sobre extraData ────────────────────────────────
// Antes hacíamos JSON.parse(node.extraData || '{}') en cada render por nodo.
// Ahora cacheamos por referencia (WeakMap). Como updateNode SIEMPRE crea un
// nuevo objeto Node (...spread), el cache se invalida automáticamente cuando
// el nodo cambia.
export interface NodeMeta {
  color?: string
  block?: 'bullet' | 'h1' | 'h2' | 'h3'
  resource?: boolean
  resourceStatus?: string
  resourceMeta?: unknown
  resourceUrl?: string
  resourceType?: string
  resourceKind?: string
  gcalEventId?: string
  location?: string
  props?: unknown[]
  views?: unknown[]
  inline?: string
  viewBlock?: string
  reminderColId?: string
  tagDefinition?: string
  area?: string
  temporalType?: string
  areaCtx?: string
  linkedNodeId?: string
  refs?: string[]
  savedSearchQuery?: string
  icon?: string
  [key: string]: unknown
}
const _metaCache = new WeakMap<Node, NodeMeta>()
const EMPTY_META: NodeMeta = {}
export function nodeMeta(node: Node | null | undefined): NodeMeta {
  if (!node) return EMPTY_META
  let m = _metaCache.get(node)
  if (m) return m
  try {
    const raw = JSON.parse(node.extraData || '{}') as Record<string, unknown>
    // v8.24: las columnas reales del Node (color, block, gcalEventId, location)
    // tienen prioridad sobre extraData. Fallback a extraData para retrocompat.
    const colColor = (node as unknown as { color?: string | null }).color || undefined
    const colBlock = (node as unknown as { block?: string | null }).block || undefined
    const colGcal = (node as unknown as { gcalEventId?: string | null }).gcalEventId || undefined
    const colLocation = (node as unknown as { location?: string | null }).location || undefined
    const colResource = (node as unknown as { isResource?: boolean | null }).isResource ?? undefined
    const colIcon = (node as unknown as { icon?: string | null }).icon || undefined
    m = {
      color: colColor || (typeof raw.color === 'string' ? raw.color : undefined),
      block: ['bullet','h1','h2','h3'].includes((colBlock || raw._block) as string)
        ? ((colBlock || raw._block) as NodeMeta['block']) : undefined,
      resource: colResource !== undefined ? !!colResource : !!raw._resource,
      resourceStatus: raw._resourceStatus as string | undefined,
      resourceMeta: raw._resourceMeta,
      resourceUrl: raw._resourceUrl as string | undefined,
      resourceType: raw._resourceType as string | undefined,
      resourceKind: raw._resourceKind as string | undefined,
      gcalEventId: colGcal || (raw.gcalEventId as string | undefined),
      location: colLocation || (raw.location as string | undefined),
      props: Array.isArray(raw._props) ? raw._props : undefined,
      views: Array.isArray(raw._views) ? raw._views : undefined,
      inline: raw._inline as string | undefined,
      viewBlock: raw.viewBlock as string | undefined,
      reminderColId: raw._reminderColId as string | undefined,
      tagDefinition: raw._tagDefinition as string | undefined,
      area: raw.area as string | undefined,
      temporalType: raw.temporalType as string | undefined,
      areaCtx: raw._areaCtx as string | undefined,
      linkedNodeId: raw._linkedNodeId as string | undefined,
      refs: Array.isArray(raw.refs) ? raw.refs as string[] : undefined,
      savedSearchQuery: raw.savedSearchQuery as string | undefined,
      icon: colIcon || (raw.icon as string | undefined),
    }
    // Mantener el resto del JSON crudo accessible (forward-compat)
    for (const k of Object.keys(raw)) if (!(k in (m as object))) (m as Record<string, unknown>)[k] = raw[k]
    _metaCache.set(node, m)
  } catch {
    m = EMPTY_META
  }
  return m
}
/** Helpers cortos para los campos más comunes. */
export function nodeColor(n: Node | null | undefined): string | undefined { return nodeMeta(n).color }
export function nodeBlock(n: Node | null | undefined): NodeMeta['block'] { return nodeMeta(n).block }
export function nodeIsResource(n: Node | null | undefined): boolean { return !!nodeMeta(n).resource }
export function nodeGcalEventId(n: Node | null | undefined): string | undefined { return nodeMeta(n).gcalEventId }
export function nodeLocation(n: Node | null | undefined): string | undefined { return nodeMeta(n).location }

/** Devuelve el JSON crudo de extraData con `changes` aplicados, escrito con
 *  las claves legacy (`_block`, `_resource`...) para retrocompat con server. */
export function patchExtraData(node: Node, changes: Partial<{
  color?: string | null
  block?: 'bullet' | 'h1' | 'h2' | 'h3' | null
  gcalEventId?: string | null
  location?: string | null
  icon?: string | null
}>): string {
  let raw: Record<string, unknown> = {}
  try { raw = JSON.parse(node.extraData || '{}') } catch { /* */ }
  const KEY_MAP: Record<string, string> = {
    color: 'color',
    block: '_block',
    gcalEventId: 'gcalEventId',
    location: 'location',
    icon: 'icon',
  }
  for (const [k, v] of Object.entries(changes)) {
    const ssKey = KEY_MAP[k]
    if (!ssKey) continue
    if (v === null || v === undefined || v === '') delete raw[ssKey]
    else raw[ssKey] = v
  }
  return JSON.stringify(raw)
}

export class NodeStore {
  nodes: Map<string, Node> = new Map()
  workspaces: Workspace[] = []
  lastSyncAt: string | null = null
  isSyncing = false
  isGuest: boolean = !getToken()
  private listeners: Set<Listener> = new Set()
  private dirtyIds: Set<string> = new Set()
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private history: Array<{ nodes: Map<string, Node> }> = []
  private historyIndex = -1
  private readonly MAX_HISTORY = 50

  private snapshot() {
    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push({ nodes: new Map(this.nodes) })
    if (this.history.length > this.MAX_HISTORY) this.history.shift()
    this.historyIndex = this.history.length - 1
  }

  undo() {
    if (this.historyIndex <= 0) return
    this.historyIndex--
    this.nodes = new Map(this.history[this.historyIndex].nodes)
    this.notify()
    this.scheduleSyncDebounced()
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return
    this.historyIndex++
    this.nodes = new Map(this.history[this.historyIndex].nodes)
    this.notify()
    this.scheduleSyncDebounced()
  }

  get canUndo() { return this.historyIndex > 0 }
  get canRedo() { return this.historyIndex < this.history.length - 1 }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify() {
    this.listeners.forEach(l => l())
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getNode(id: string): Node | undefined {
    return this.nodes.get(id)
  }

  // ── Cache de hijos por parentId — se invalida en cada mutación ────────
  private _childrenCache: Map<string | null, Node[]> | null = null
  private invalidateChildrenCache() { this._childrenCache = null }
  private buildChildrenCache(): Map<string | null, Node[]> {
    const idx = new Map<string | null, Node[]>()
    for (const node of this.nodes.values()) {
      if (node.deletedAt) continue
      const arr = idx.get(node.parentId)
      if (arr) arr.push(node); else idx.set(node.parentId, [node])
    }
    for (const arr of idx.values()) arr.sort((a, b) => a.siblingOrder - b.siblingOrder)
    return idx
  }

  children(parentId: string | null): Node[] {
    if (!this._childrenCache) this._childrenCache = this.buildChildrenCache()
    return this._childrenCache.get(parentId) ?? []
  }

  allActive(): Node[] {
    return [...this.nodes.values()].filter(n => !n.deletedAt)
  }

  /// Nodo perfil de la IA (paridad Mac NodeService.perfilIANode).
  /// Identificado por extraData._perfilIA == "1". El cuerpo (node.body) es
  /// el texto que el usuario escribe como contexto personal para la IA.
  perfilIANode(): Node | null {
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._perfilIA === '1') return n
      } catch { /* ignore */ }
    }
    return null
  }

  /// Crea (si no existe) o devuelve el nodo perfil IA.
  async getOrCreatePerfilIA(): Promise<Node> {
    const existing = this.perfilIANode()
    if (existing) return existing
    const created = this.createNode({
      text: 'Perfil para la IA',
      parentId: null,
      extraData: { _perfilIA: '1' },
    })
    // Plantilla de ayuda para el usuario
    this.updateNode(created.id, { body: PERFIL_IA_TEMPLATE })
    return created
  }

  todayDiary(): Node | null {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const matches: Node[] = []
    for (const node of this.nodes.values()) {
      if (!node.isDiaryEntry || node.deletedAt) continue
      if (node.diaryDate) {
        const d = new Date(node.diaryDate)
        if (d >= today && d < tomorrow) matches.push(node)
      }
    }
    if (matches.length === 0) return null
    if (matches.length === 1) return matches[0]
    // Duplicados detectados — elegir canónico (más hijos, después más antiguo)
    matches.sort((a, b) => {
      const ca = this.children(a.id).length
      const cb = this.children(b.id).length
      if (cb !== ca) return cb - ca
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    })
    return matches[0]
  }

  /**
   * Encuentra diarios duplicados para el mismo día local y los fusiona:
   * - Canónico = más hijos (más contenido), después más antiguo
   * - Reparenta hijos de los duplicados al canónico
   * - Soft-delete de los duplicados
   * Devuelve el número de duplicados fusionados.
   */
  /**
   * Fusiona nodos temporales duplicados (Año/Mes/Semana) creados por el bug
   * v7.89 y anteriores. Solo afecta:
   * - Años (text="2026"): si hay varios → canónico = más descendientes
   * - Meses bajo un año (text="Mayo"): mismo padre año → fusionar
   * - Semanas bajo un mes (text="Semana 22"): mismo padre mes → fusionar
   *
   * Para cada duplicado: reparenta hijos al canónico + soft-delete del duplicado.
   * Devuelve el conteo. SEGURO: no toca nodos que no encajen en el patrón.
   */
  mergeDuplicateTemporalNodes(): { years: number; months: number; weeks: number } {
    const MONTHS = new Set(['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])
    const isYear  = (t: string) => /^\d{4}$/.test(t)
    const isMonth = (t: string) => MONTHS.has(t)
    const isWeek  = (t: string) => /^Semana \d+$/i.test(t)

    let yearsMerged = 0, monthsMerged = 0, weeksMerged = 0

    // Helper: cuenta TODOS los descendientes activos de un nodo
    const countDescendants = (id: string): number => {
      let count = 0
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        const kids = this.children(cur).filter(n => !n.deletedAt)
        count += kids.length
        for (const k of kids) stack.push(k.id)
      }
      return count
    }

    const mergeGroup = (dups: Node[]): boolean => {
      if (dups.length < 2) return false
      dups.sort((a, b) => countDescendants(b.id) - countDescendants(a.id) ||
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      const canonical = dups[0]
      for (const dup of dups.slice(1)) {
        for (const child of this.children(dup.id).filter(n => !n.deletedAt)) {
          this.updateNode(child.id, { parentId: canonical.id })
        }
        this.deleteNode(dup.id)
      }
      return true
    }

    // 1. Years (top-level con texto YYYY)
    const allActive = [...this.nodes.values()].filter(n => !n.deletedAt && !n.isDiaryEntry)
    const yearsByText = new Map<string, Node[]>()
    for (const n of allActive) {
      if (!n.parentId && isYear(n.text || '')) {
        const k = n.text!
        if (!yearsByText.has(k)) yearsByText.set(k, [])
        yearsByText.get(k)!.push(n)
      }
    }
    for (const [, group] of yearsByText) {
      if (mergeGroup(group)) yearsMerged += group.length - 1
    }

    // Re-snapshot tras year merges
    const afterYears = [...this.nodes.values()].filter(n => !n.deletedAt && !n.isDiaryEntry)

    // 2. Months: hijos directos de un Año, texto = mes exacto
    const monthsByYear = new Map<string, Node[]>()  // key = parentId|monthText
    for (const n of afterYears) {
      if (!n.parentId || !isMonth(n.text || '')) continue
      const parent = this.getNode(n.parentId)
      if (!parent || !isYear(parent.text || '')) continue
      const k = `${parent.id}|${n.text}`
      if (!monthsByYear.has(k)) monthsByYear.set(k, [])
      monthsByYear.get(k)!.push(n)
    }
    for (const [, group] of monthsByYear) {
      if (mergeGroup(group)) monthsMerged += group.length - 1
    }

    // 3. Weeks: hijos directos de un Mes, texto = "Semana N"
    const afterMonths = [...this.nodes.values()].filter(n => !n.deletedAt && !n.isDiaryEntry)
    const weeksByMonth = new Map<string, Node[]>()
    for (const n of afterMonths) {
      if (!n.parentId || !isWeek(n.text || '')) continue
      const parent = this.getNode(n.parentId)
      if (!parent || !isMonth(parent.text || '')) continue
      const k = `${parent.id}|${n.text}`
      if (!weeksByMonth.has(k)) weeksByMonth.set(k, [])
      weeksByMonth.get(k)!.push(n)
    }
    for (const [, group] of weeksByMonth) {
      if (mergeGroup(group)) weeksMerged += group.length - 1
    }

    return { years: yearsMerged, months: monthsMerged, weeks: weeksMerged }
  }

  /**
   * Limpia nodos que están incorrectamente bajo nodos de estructura temporal
   * (año "2026", mes "Mayo", semana "Semana 22"). La jerarquía correcta es:
   *   2026 → sólo meses   Mayo → sólo semanas   Semana N → sólo diary entries
   * Cualquier nota/tarea real que tenga como parent un nodo temporal se mueve
   * a root (parentId = null). Las diary entries son la excepción: sus parents
   * son semanas → correcto, no se tocan.
   */
  fixTemporalHierarchyOrphans(): number {
    const MONTHS_SET = new Set(['Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])
    const isTemporal = (n: Node) => {
      const t = (n.text || '').trim()
      return /^\d{4}$/.test(t) || MONTHS_SET.has(t) || /^Semana \d+$/i.test(t)
    }

    let moved = 0
    for (const [id, node] of this.nodes.entries()) {
      if (node.deletedAt || !node.parentId) continue
      if (node.isDiaryEntry) continue     // diary entries bajo semana/mes → correcto
      if (isTemporal(node)) continue      // nodos temporales (año/mes/semana) pueden estar bajo otro temporal

      const parent = this.getNode(node.parentId)
      if (!parent || parent.deletedAt || !isTemporal(parent)) continue

      // Nota/tarea real hija directa de nodo temporal → mover a root
      this.nodes.set(id, { ...node, parentId: null, _isDirty: true, updatedAt: new Date().toISOString() })
      this.dirtyIds.add(id)
      moved++
    }
    if (moved > 0) this.invalidateChildrenCache()
    return moved
  }

  mergeDuplicateDiaries(): number {
    const byDay = new Map<string, Node[]>()
    for (const node of this.nodes.values()) {
      if (!node.isDiaryEntry || node.deletedAt || !node.diaryDate) continue
      const d = new Date(node.diaryDate)
      // Clave por día local (mismos componentes que usa createTodayDiary)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(node)
    }
    let merged = 0
    for (const [, diaries] of byDay) {
      if (diaries.length < 2) continue
      diaries.sort((a, b) => {
        const ca = this.children(a.id).length
        const cb = this.children(b.id).length
        if (cb !== ca) return cb - ca
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      })
      const canonical = diaries[0]
      for (const dup of diaries.slice(1)) {
        // Reparentar hijos del duplicado al canónico
        for (const child of this.children(dup.id)) {
          this.updateNode(child.id, { parentId: canonical.id })
        }
        this.deleteNode(dup.id)
        merged++
      }
    }
    return merged
  }

  tagDefinitions(): Node[] {
    return this.allActive().filter(n => {
      try {
        const ed = JSON.parse(n.extraData || '{}')
        return !!ed._tagDefinition
      } catch { return false }
    })
  }

  tagName(node: Node): string | null {
    try {
      return JSON.parse(node.extraData || '{}')._tagDefinition || null
    } catch { return null }
  }

  /** Todos los tags únicos: de types[] + #hashtags en títulos de nodos activos */
  allUsedTags(): string[] {
    const builtins = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])
    const tagSet = new Set<string>()
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      // Desde types[]
      for (const t of (n.types || [])) {
        if (!builtins.has(t)) tagSet.add(t)
      }
      // También desde #hashtags en el título (retrocompatibilidad)
      const titleTags = (n.text || '').match(/#([\wÀ-ɏ\/\-]+)/g) || []
      for (const tag of titleTags) {
        const t = tag.slice(1)
        if (!builtins.has(t)) tagSet.add(t)
      }
    }
    return Array.from(tagSet).sort()
  }

  /** Contar nodos que tienen un tag específico */
  tagNodeCount(tagName: string): number {
    let count = 0
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      if ((n.types || []).includes(tagName)) count++
    }
    return count
  }

  /** Nodo de definición de un tag (con _tagDefinition en extraData) o null */
  getTagDefNode(tagName: string): Node | null {
    // 1. Buscar en árbol Tags por slug (nueva forma)
    // Evitar import circular: buscar directamente sin usar tagsHelper
    const tagsRoot = this.children(null).find(n => !n.deletedAt && n.text === '🏷 Tags')
    if (tagsRoot) {
      const slug = tagName.toLowerCase()
      const parts = slug.split('/')
      let parent = tagsRoot
      let found: Node | null = null
      for (const part of parts) {
        const match = this.children(parent.id).find(c =>
          !c.deletedAt &&
          (c.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '') === part
        )
        if (!match) { found = null; break }
        found = match
        parent = match
      }
      if (found && found.id !== tagsRoot.id) return found
    }
    // 2. Fallback: _tagDefinition en extraData (legado)
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._tagDefinition?.toLowerCase() === tagName.toLowerCase()) return n
      } catch {}
    }
    return null
  }

  /**
   * Devuelve { tagName: body } para los tags del nodo dado que tienen una
   * definición con cuerpo no vacío. Útil para inyectar contexto en la IA.
   */
  tagDefinitionsForNode(nodeId: string): Record<string, string> {
    const node = this.nodes.get(nodeId)
    if (!node) return {}
    const out: Record<string, string> = {}
    for (const tagName of node.types || []) {
      const def = this.getTagDefNode(tagName)
      const body = def?.body?.trim()
      if (body && body.length > 0) out[tagName] = body
    }
    return out
  }

  // ── Recursos ────────────────────────────────────────────────────────────────

  /** Todos los nodos marcados como recurso */
  allResources(): Node[] {
    return this.allActive().filter(n => {
      if (n.deletedAt) return false
      // Comprobar columna promovida primero (post-migración v8.27)
      if (n.isResource) return true
      // Fallback a extraData._resource (pre-migración o datos legacy)
      try { return !!JSON.parse(n.extraData || '{}')._resource } catch { return false }
    })
  }

  /** ¿Es una nota "container" (proyecto de facto)? Una nota normal que tiene
   *  ≥1 descendiente con status === 'pending'. No es ella misma tarea/evento/
   *  recurso/diaria. Reemplaza al concepto antiguo de "bucle". */
  isLiveContainer(node: Node, options?: { requireUnscheduled?: boolean }): boolean {
    if (!node || node.deletedAt) return false
    if (node.isDiaryEntry) return false
    // Las tareas (status !== null) SÍ pueden ser contenedores si tienen hijas pendientes.
    // Solo excluir eventos y recursos — no son contextos de trabajo.
    if (node.isEvent) return false
    try { if (JSON.parse(node.extraData || '{}')._resource) return false } catch { /* ignore */ }
    // Excluir nodos de estructura temporal (año/mes/semana) — no son contextos reales
    const MONTHS_T = new Set(['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])
    const t = (node.text || '').trim()
    if (/^\d{4}$/.test(t)) return false
    if (MONTHS_T.has(t)) return false
    if (/^Semana \d+$/i.test(t)) return false
    const want = options?.requireUnscheduled
    const stack: string[] = [node.id]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      const kids = this.children(id)
      for (const k of kids) {
        if (k.deletedAt) continue
        if (k.status === 'pending') {
          if (!want || !k.due) return true
        }
        if (!visited.has(k.id)) stack.push(k.id)
      }
    }
    return false
  }

  /** Devuelve todas las notas "container" vivas. */
  liveContainers(options?: { requireUnscheduled?: boolean }): Node[] {
    return this.allActive()
      .filter(n => this.isLiveContainer(n, options))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /** Tareas pendientes descendientes de un container. Si requireUnscheduled,
   *  solo las que no tienen due asignado. */
  containerPendingTasks(nodeId: string, options?: { requireUnscheduled?: boolean }): Node[] {
    const want = options?.requireUnscheduled
    const result: Node[] = []
    const stack: string[] = [nodeId]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      const kids = this.children(id)
      for (const k of kids) {
        if (k.deletedAt) continue
        if (k.status === 'pending' && (!want || !k.due)) result.push(k)
        if (!visited.has(k.id)) stack.push(k.id)
      }
    }
    return result
  }

  /** "Ampliar" una tarea → se convierte en contenedor con su propia copia como
   *  primera sub-tarea. Devuelve { containerId, firstChildId }. */
  expandToContainer(taskId: string): { containerId: string; firstChildId: string } | null {
    const task = this.getNode(taskId)
    if (!task || task.status === null) return null
    // 1. Crear la copia como primera sub-tarea, conservando todas las props
    const child = this.createNode({
      text: task.text,
      parentId: task.id,
      siblingOrder: 1,
      isTask: true,
    })
    this.updateNode(child.id, {
      status: task.status,
      due: task.due,
      dueEnd: task.dueEnd,
      priority: task.priority,
      recurrence: task.recurrence,
      types: task.types,
    })
    // 2. El nodo padre pasa a ser nota (container): sin status, sin fecha,
    //    sin prioridad, sin recurrencia. Su texto se conserva como título.
    this.updateNode(task.id, {
      status: null,
      due: null,
      dueEnd: null,
      priority: null,
      recurrence: null,
      isEvent: false,
    })
    return { containerId: task.id, firstChildId: child.id }
  }

  /** Tareas vinculadas a un nodo: hijos directos con status + legacy _linkedNodeId */
  linkedTasks(nodeId: string): Node[] {
    const byParent = this.children(nodeId).filter(n => !n.deletedAt && n.status !== null)
    const byLink = this.allActive().filter(n => {
      if (n.deletedAt || n.status === null || n.parentId === nodeId) return false
      try { return JSON.parse(n.extraData || '{}')._linkedNodeId === nodeId } catch { return false }
    })
    return [...byParent, ...byLink]
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  /** Color del tag: primero mira si hay color personalizado en la definición, si no usa hash */
  tagColor(tagName: string): string {
    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']
    // Buscar color personalizado en nodo de definición
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._tagDefinition === tagName && ed._tagColor) return ed._tagColor
      } catch {}
    }
    let hash = 0
    for (let i = 0; i < tagName.length; i++) hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
    return COLORS[Math.abs(hash) % COLORS.length]
  }

  /** Borrar un tag de todos los nodos y eliminar su definición */
  deleteTag(tagName: string) {
    this.snapshot()
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      const types = (n.types || [])
      if (types.includes(tagName)) {
        this.updateNode(n.id, { types: types.filter(t => t !== tagName) })
      }
      // Borrar nodo de definición
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._tagDefinition === tagName) this.updateNode(n.id, { deletedAt: new Date().toISOString() })
      } catch {}
    }
  }

  /** Renombrar un tag en todos los nodos y en su definición */
  renameTag(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) return
    this.snapshot()
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      const types = (n.types || [])
      if (types.includes(oldName)) {
        this.updateNode(n.id, { types: types.map(t => t === oldName ? newName : t) })
      }
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._tagDefinition === oldName) {
          ed._tagDefinition = newName
          this.updateNode(n.id, { text: newName, extraData: JSON.stringify(ed) })
        }
      } catch {}
    }
  }

  /** Establecer o quitar color personalizado para un tag */
  setTagColor(tagName: string, color: string | null) {
    // Buscar nodo de definición existente
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._tagDefinition === tagName) {
          if (color) ed._tagColor = color; else delete ed._tagColor
          this.updateNode(n.id, { extraData: JSON.stringify(ed) })
          return
        }
      } catch {}
    }
    // No existe definición: crearla
    const workspaceId = this.workspaces[0]?.id || '00000000-0000-0000-0000-000000000001'
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const ed: Record<string, string> = { _tagDefinition: tagName }
    if (color) ed._tagColor = color
    const node = {
      id, parentId: null, text: tagName, body: null,
      siblingOrder: Date.now(), types: [], collections: [],
      status: null, isActive: false, isEvent: false, isSeguimiento: false,
      isDiaryEntry: false, isChat: false, isCollapsed: false, isFavorite: false,
      due: null, dueEnd: null, priority: null, recurrence: null, diaryDate: null,
      extraData: JSON.stringify(ed), publicSlug: null, deletedAt: null,
      createdAt: now, updatedAt: now, workspaceId, _isDirty: true,
    }
    this.nodes.set(id, node as any)
    this.dirtyIds.add(id)
    this.notify()
  }

  // ── Áreas ─────────────────────────────────────────────────────────────────

  allAreas(): string[] {
    const areas = new Set<string>()
    for (const node of this.nodes.values()) {
      if (node.deletedAt) continue
      try {
        const ed = JSON.parse(node.extraData || '{}')
        if (ed.area) areas.add(ed.area)
      } catch { /* ignore */ }
    }
    return Array.from(areas).sort()
  }

  getNodeArea(nodeId: string): string | null {
    const node = this.nodes.get(nodeId)
    if (!node) return null
    try { return JSON.parse(node.extraData || '{}').area || null } catch { return null }
  }

  setNodeArea(nodeId: string, area: string | null) {
    const node = this.nodes.get(nodeId)
    if (!node) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (area) ed.area = area
      else delete ed.area
      this.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    } catch {
      if (area) this.updateNode(nodeId, { extraData: JSON.stringify({ area }) })
    }
  }

  nodesInArea(area: string): Node[] {
    return this.allActive().filter(n => {
      try { return JSON.parse(n.extraData || '{}').area === area } catch { return false }
    })
  }

  pendingTasks(): Node[] {
    return this.allActive()
      .filter(n => n.status === 'pending')
      .sort((a, b) => {
        if (a.due && b.due) return a.due < b.due ? -1 : 1
        if (a.due) return -1
        if (b.due) return 1
        return b.updatedAt < a.updatedAt ? -1 : 1
      })
  }

  /** Get the full breadcrumb path for a node as text */
  getNodePath(nodeId: string): string {
    const parts: string[] = []
    let cur = this.nodes.get(nodeId)
    while (cur?.parentId) {
      const parent = this.nodes.get(cur.parentId)
      if (!parent) break
      parts.unshift(parent.text || 'Sin título')
      cur = parent
    }
    return parts.join(' / ')
  }

  /** Recently edited nodes (non-diary, non-deleted), sorted by updatedAt */
  recentlyEdited(limit = 10): Node[] {
    return this.allActive()
      .filter(n => !n.isDiaryEntry)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  }

  /** Total word count across all active notes */
  totalWordCount(): number {
    let count = 0
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      if (n.text) count += n.text.trim().split(/\s+/).length
      if (n.body) count += n.body.trim().split(/\s+/).length
    }
    return count
  }

  /** Overdue pending tasks */
  overdueTasks(): Node[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return this.allActive().filter(n => {
      if (n.status !== 'pending' || !n.due) return false
      return new Date(n.due) < today
    })
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  private applyNode(raw: unknown): void {
    const n = raw as Node
    if (!n.id) return
    // Defensive: si types/collections vienen como string JSON pero están
    // malformados, no debe romper el sync entero (problema observado tras
    // backfill de columnas v8.30+). Fallback a array vacío.
    try {
      n.types = typeof n.types === 'string' ? JSON.parse(n.types) : (n.types || [])
    } catch {
      n.types = []
    }
    try {
      n.collections = typeof n.collections === 'string' ? JSON.parse(n.collections) : (n.collections || [])
    } catch {
      n.collections = []
    }
    this.nodes.set(n.id, n)
    // NO invalidamos cache aquí: sync llama applyNode N veces; lo invalidamos
    // una sola vez al final del sync para no rebuildear N veces.
  }

  createNode(params: {
    text: string
    parentId: string | null
    siblingOrder?: number
    isTask?: boolean
    due?: string | null
    isDiaryEntry?: boolean
    diaryDate?: string | null
    types?: string[]
    extraData?: Record<string, string>
    isAtomic?: boolean
  }): Node {
    this.snapshot()
    const workspaceId = this.workspaces[0]?.id || '00000000-0000-0000-0000-000000000001'
    const now = new Date().toISOString()
    const id = generateId()
    const node: Node = {
      id,
      parentId: params.parentId,
      text: params.text,
      body: null,
      siblingOrder: params.siblingOrder ?? Date.now(),
      types: params.types || [],
      collections: [],
      status: params.isTask ? 'pending' : null,
      isActive: false,
      isEvent: false,
      isSeguimiento: false,
      isDiaryEntry: params.isDiaryEntry || false,
      isChat: false,
      isCollapsed: false,
      isFavorite: false,
      due: params.due || null,
      dueEnd: null,
      priority: null,
      recurrence: null,
      diaryDate: params.diaryDate || null,
      extraData: params.extraData ? JSON.stringify(params.extraData) : null,
      isAtomic: params.isAtomic || false,
      publicSlug: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      workspaceId,
      _isDirty: true,
    }
    this.nodes.set(id, node)
    this.invalidateChildrenCache()
    this.dirtyIds.add(id)
    this.notify()
    this.scheduleSyncDebounced()
    return node
  }

  updateNode(id: string, changes: Partial<Node>): void {
    const node = this.nodes.get(id)
    if (!node) return
    this.snapshot()

    // Lógica de recurrencia: cuando se marca done y tiene recurrencia,
    // calcular la siguiente fecha y dejarla como pending
    let finalChanges = changes
    if (changes.status === 'done' && node.recurrence && node.status !== 'done') {
      const nextDue = this.calculateNextRecurrence(node.recurrence, node.due)
      if (nextDue) {
        finalChanges = { ...changes, status: 'pending', due: nextDue }
      }
    }

    const updated = { ...node, ...finalChanges, updatedAt: new Date().toISOString(), _isDirty: true }
    this.nodes.set(id, updated)
    // Invalidar siempre el cache: guarda referencias de Node y al hacer spread
    // creamos un objeto nuevo — el cache quedaría apuntando al objeto viejo.
    this.invalidateChildrenCache()
    this.dirtyIds.add(id)
    this.notify()
    this.scheduleSyncDebounced()
  }

  private calculateNextRecurrence(recurrence: string, currentDue: string | null): string | null {
    const base = currentDue ? new Date(currentDue) : new Date()
    const next = new Date(base)
    const [type, intervalStr] = recurrence.split(':')
    const interval = parseInt(intervalStr || '1') || 1
    if (type === 'daily') next.setDate(next.getDate() + interval)
    else if (type === 'weekly') next.setDate(next.getDate() + 7 * interval)
    else if (type === 'monthly') next.setMonth(next.getMonth() + interval)
    else if (type === 'yearly') next.setFullYear(next.getFullYear() + interval)
    else return null
    return next.toISOString()
  }

  deleteNode(id: string): void {
    this.updateNode(id, { deletedAt: new Date().toISOString() })
  }

  /**
   * Programa un nodo en una fecha del calendario.
   * Modelo: `due` solo significa "cuándo trabajar en esto". NO convierte el
   * nodo en tarea ni cambia su naturaleza (seguimiento/recurso/nota).
   * - Seguimiento: mantiene status (pendiente/futuro) y suma due
   * - Recurso: mantiene _resource y suma due
   * - Tarea normal: due + status:pending
   * - Nota plana: solo due
   */
  // ── Propiedades custom (estilo Notion) ───────────────────────────────────
  // Schema en padre: extraData._props = [{id, name, type, options?}]
  //                  extraData._views = [{id, name, kind, columns, sort, group}]
  //                  extraData._activeView = "vN"
  // Valores en hijo: extraData._props = { [propId]: value }
  //
  // Builtin column ids: __title, __status, __due, __priority, __tags, __children

  getPropSchema(parentId: string): Array<{ id: string; name: string; type: string; options?: Array<{ id: string; label: string; color?: string }> }> {
    const parent = this.getNode(parentId)
    if (!parent) return []
    try {
      const ed = JSON.parse(parent.extraData || '{}')
      return Array.isArray(ed._props) ? ed._props : []
    } catch { return [] }
  }

  setPropSchema(parentId: string, schema: Array<{ id: string; name: string; type: string; options?: Array<{ id: string; label: string; color?: string }> }>): void {
    const parent = this.getNode(parentId)
    if (!parent) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(parent.extraData || '{}') } catch { /* ignore */ }
    ed._props = schema
    this.updateNode(parentId, { extraData: JSON.stringify(ed) })
  }

  addPropColumn(parentId: string, name: string, type: string, options?: Array<{ id: string; label: string; color?: string }>): string {
    const schema = this.getPropSchema(parentId)
    const id = 'col_' + Math.random().toString(36).slice(2, 10)
    schema.push({ id, name, type, ...(options ? { options } : {}) })
    this.setPropSchema(parentId, schema)
    return id
  }

  renamePropColumn(parentId: string, colId: string, newName: string): void {
    const schema = this.getPropSchema(parentId)
    const col = schema.find(c => c.id === colId)
    if (!col) return
    col.name = newName
    this.setPropSchema(parentId, schema)
  }

  deletePropColumn(parentId: string, colId: string): void {
    const schema = this.getPropSchema(parentId).filter(c => c.id !== colId)
    this.setPropSchema(parentId, schema)
  }

  getPropValue(nodeId: string, colId: string): unknown {
    const node = this.getNode(nodeId)
    if (!node) return undefined
    try {
      const ed = JSON.parse(node.extraData || '{}')
      return ed._props?.[colId]
    } catch { return undefined }
  }

  setPropValue(nodeId: string, colId: string, value: unknown): void {
    const node = this.getNode(nodeId)
    if (!node) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
    const props = (ed._props && typeof ed._props === 'object' && !Array.isArray(ed._props))
      ? { ...ed._props as Record<string, unknown> }
      : {}
    if (value === undefined || value === null || value === '') delete props[colId]
    else props[colId] = value
    ed._props = props
    this.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }

  // ── Vistas múltiples ────────────────────────────────────────────────────

  getViews(parentId: string): Array<{ id: string; name: string; kind: 'table' | 'kanban' | 'calendar' | 'list'; columns?: string[]; sort?: { by: string; dir: 'asc' | 'desc' } | null; group?: { by: string } | null; filter?: { col: string; op: string; val: unknown } | null }> {
    const parent = this.getNode(parentId)
    if (!parent) return []
    try {
      const ed = JSON.parse(parent.extraData || '{}')
      return Array.isArray(ed._views) ? ed._views : []
    } catch { return [] }
  }

  setViews(parentId: string, views: Array<{ id: string; name: string; kind: 'table' | 'kanban' | 'calendar' | 'list'; columns?: string[]; sort?: { by: string; dir: 'asc' | 'desc' } | null; group?: { by: string } | null; filter?: { col: string; op: string; val: unknown } | null }>): void {
    const parent = this.getNode(parentId)
    if (!parent) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(parent.extraData || '{}') } catch { /* ignore */ }
    ed._views = views
    this.updateNode(parentId, { extraData: JSON.stringify(ed) })
  }

  getActiveViewId(parentId: string): string | null {
    const parent = this.getNode(parentId)
    if (!parent) return null
    try {
      const ed = JSON.parse(parent.extraData || '{}')
      return ed._activeView ?? null
    } catch { return null }
  }

  setActiveViewId(parentId: string, viewId: string): void {
    const parent = this.getNode(parentId)
    if (!parent) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(parent.extraData || '{}') } catch { /* ignore */ }
    ed._activeView = viewId
    this.updateNode(parentId, { extraData: JSON.stringify(ed) })
  }

  /**
   * Busca el ancestro recurso más cercano (incluyendo el propio nodo).
   * Devuelve {url, kind} si existe.
   */
  findAncestorResource(nodeId: string): { url: string; kind: 'youtube' | 'article' | 'podcast' } | null {
    let current: Node | undefined = this.getNode(nodeId)
    while (current) {
      try {
        const ed = JSON.parse(current.extraData || '{}')
        if (ed._resource && ed._resourceUrl) {
          const url = ed._resourceUrl as string
          const type = (ed._resourceType || 'url') as string
          const kind: 'youtube' | 'article' | 'podcast' =
            type === 'youtube' || /youtu\.?be/.test(url) ? 'youtube'
            : type === 'podcast' ? 'podcast' : 'article'
          return { url, kind }
        }
      } catch { /* ignore */ }
      if (!current.parentId) break
      current = this.getNode(current.parentId)
    }
    return null
  }

  scheduleNodeAt(nodeId: string, iso: string): string | null {
    const node = this.getNode(nodeId)
    if (!node) return null
    // Bucle: NO se puede agendar. Es un contenedor binario abierto/cerrado.
    if (node.isSeguimiento || (node.types || []).includes('bucle')) return null
    const updates: Partial<Node> = { due: iso }
    // Limpiar dueEnd al reprogramar — si no, una duración antigua haría que el
    // bloque se extienda al día siguiente y aparezca duplicado en el calendario
    if (node.dueEnd) updates.dueEnd = null
    // Si no tiene status y no es recurso/evento → tratar como tarea (status pendiente)
    let isResource = false
    try { isResource = !!JSON.parse(node.extraData || '{}')._resource } catch { /* ignore */ }
    const hasOwnState = isResource || node.isEvent || node.status !== null
    if (!hasOwnState) {
      updates.status = 'pending'
    }
    this.updateNode(nodeId, updates)
    return nodeId
  }

  /** Colapsar todos los nodos que tienen hijos */
  collapseAll(parentId: string | null): void {
    const toCollapse = this.allActive().filter(n => n.parentId === parentId || !parentId)
    toCollapse.forEach(n => {
      if (this.children(n.id).length > 0) {
        this.updateNode(n.id, { isCollapsed: true })
      }
    })
  }

  /** Expandir todos los nodos */
  expandAll(parentId: string | null): void {
    const toExpand = this.allActive().filter(n => parentId ? n.parentId === parentId : true)
    toExpand.forEach(n => {
      if (n.isCollapsed) {
        this.updateNode(n.id, { isCollapsed: false })
      }
    })
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  private scheduleSyncDebounced() {
    if (this.syncTimer) clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => this.sync(), 1500)
  }

  private persistGuest() {
    try {
      const nodes = [...this.nodes.values()]
      localStorage.setItem(GUEST_NODES_KEY, JSON.stringify(nodes))
      localStorage.setItem(GUEST_WORKSPACES_KEY, JSON.stringify(this.workspaces))
    } catch { /* ignore quota errors */ }
  }

  async loadGuest(): Promise<void> {
    try {
      const raw = localStorage.getItem(GUEST_NODES_KEY)
      const rawWs = localStorage.getItem(GUEST_WORKSPACES_KEY)
      if (raw) {
        const nodes: Node[] = JSON.parse(raw)
        for (const n of nodes) this.applyNode(n)
        this.invalidateChildrenCache()
      }
      if (rawWs) {
        this.workspaces = JSON.parse(rawWs)
      }
      // Ensure default workspace
      if (this.workspaces.length === 0) {
        this.workspaces = [{ id: '00000000-0000-0000-0000-000000000001', name: 'Mi espacio', color: null, icon: null, description: null, siblingOrder: 0, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as Workspace]
      }
    } catch { /* ignore parse errors */ }
    // NOTA: dedupe + reparent automáticos DESACTIVADOS — causaron pérdida de
    // estructura al reparentar nodos cuyo padre estaba soft-deleted. Pendiente
    // reimplementar de forma segura (con confirmación del usuario).
    // If no diary for today, create one
    if (!this.todayDiary()) {
      await this.createTodayDiary()
    }
    this.notify()
  }

  async sync(force = false): Promise<void> {
    // En modo invitado, persistir en localStorage y no llamar al servidor
    if (this.isGuest) {
      this.persistGuest()
      this.dirtyIds.clear()
      return
    }

    if (this.isSyncing && !force) return
    this.isSyncing = true
    this.notify()

    const dirtyNodes = force
      ? [...this.nodes.values()].filter(n => n._isDirty)
      : [...this.dirtyIds].map(id => this.nodes.get(id)).filter(Boolean) as Node[]

    const payload = {
      lastSyncAt: this.lastSyncAt,
      workspaces: [],
      deletedWorkspaceIds: [],
      nodes: dirtyNodes.map(n => ({
        ...n,
        types: JSON.stringify(n.types || []),
        collections: JSON.stringify(n.collections || []),
        _isDirty: undefined,
        _children: undefined,
      })),
    }

    // FIX bug de revert: snapshot de los IDs que SE ENVÍAN para distinguirlos
    // de los que se modifiquen DURANTE el await (race condition que causaba
    // que cambios locales se perdieran al recibir la respuesta del servidor).
    const sentIds = new Set(dirtyNodes.map(n => n.id))

    try {
      const res = await syncNodes(payload)
      this.lastSyncAt = res.syncAt
      // Solo limpiar los IDs que se enviaron (no los modificados DURANTE el await)
      for (const id of sentIds) this.dirtyIds.delete(id)

      // Apply server nodes (merge)
      // Defensive: un nodo con datos corruptos no debe romper el sync entero.
      for (const rawNode of res.nodes) {
        try {
          const n = rawNode as Node
          if (!this.nodes.has(n.id)) {
            this.applyNode(n)
          } else {
            // Si el nodo se ha modificado localmente DESPUÉS de empezar este sync
            // (está en dirtyIds), NO sobrescribir — el próximo sync lo enviará.
            if (this.dirtyIds.has(n.id)) {
              continue
            }
            // Server wins solo si no hay cambios locales pendientes
            this.applyNode(n)
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[sync] node skipped due to parse error:', err, rawNode)
        }
      }
      // Invalidar cache de hijos una sola vez tras aplicar todos los nodos
      this.invalidateChildrenCache()

      if (res.workspaces?.length > 0) {
        this.workspaces = res.workspaces as Workspace[]
      }

      // Clear dirty flags on successfully synced nodes
      for (const node of this.nodes.values()) {
        if (node._isDirty && !this.dirtyIds.has(node.id)) {
          this.nodes.set(node.id, { ...node, _isDirty: false })
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Token expirado o inválido → redirigir al login
        if (err.message === 'UNAUTHORIZED' || err.message.includes('401')) {
          window.dispatchEvent(new Event('from:unauthorized'))
        }
        // Límite free
        if (err.message === 'FREE_LIMIT_REACHED') {
          window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'node_limit' } }))
        }
      }
      console.error('Sync failed:', err)
    } finally {
      this.isSyncing = false
      this.notify()
    }
  }

  async initialLoad(): Promise<void> {
    await this.sync()

    // Limpieza silenciosa: nodo vacío = no existe.
    // Período de gracia de 60s — no borrar nodos recién creados donde el cursor
    // puede estar (el servidor ya aplica la misma lógica en el sync).
    const graceCutoff = Date.now() - 60_000
    for (const node of this.nodes.values()) {
      if (!node.deletedAt && !node.isDiaryEntry && !(node.text || '').trim()) {
        const createdMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
        if (createdMs < graceCutoff) {
          this.deleteNode(node.id)
        }
      }
    }

    // Fusionar diarios duplicados (mismo día local) — seguro: solo afecta
    // a nodos isDiaryEntry, reparenta hijos al canónico, no toca otros nodos.
    const mergedCount = this.mergeDuplicateDiaries()
    if (mergedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[diary] fusionados ${mergedCount} diarios duplicados`)
      await this.sync()
    }

    // Fusionar nodos temporales duplicados (Año/Mes/Semana) — limpieza del
    // bug de v7.89 y anteriores donde navigateToTemporalNode podía
    // reparentar notas existentes con el mismo texto.
    const temporalMerged = this.mergeDuplicateTemporalNodes()
    const totalTemporal = temporalMerged.years + temporalMerged.months + temporalMerged.weeks
    if (totalTemporal > 0) {
      // eslint-disable-next-line no-console
      console.log(`[temporal] fusionados ${totalTemporal} duplicados:`,
        `${temporalMerged.years} años,`,
        `${temporalMerged.months} meses,`,
        `${temporalMerged.weeks} semanas`)
      await this.sync()
    }

    // Limpiar nodos incorrectamente bajo estructura temporal (2026/Mayo/Semana N).
    // Cualquier nota/tarea que tenga un nodo temporal como parent directo
    // se mueve a root — la jerarquía correcta es Año→Mes→Semana→DiaryEntry→nota.
    const temporalOrphans = this.fixTemporalHierarchyOrphans()
    if (temporalOrphans > 0) {
      // eslint-disable-next-line no-console
      console.log(`[temporal-orphans] ${temporalOrphans} nodos movidos a root desde estructura temporal`)
      this.notify()
      await this.sync()
    }

    // v8.12: ELIMINACIÓN del concepto "bucle". Batch sin notify por nodo
    // (con muchos bucles, un notify por iteración congelaba la app).
    let migrated = 0
    const nowIso = new Date().toISOString()
    for (const [id, node] of this.nodes.entries()) {
      if (node.deletedAt) continue
      const isBucle = node.isSeguimiento || (node.types || []).includes('bucle')
      if (!isBucle) continue
      const newTypes = (node.types || []).filter(t => t !== 'bucle')
      this.nodes.set(id, {
        ...node,
        isSeguimiento: false,
        types: newTypes,
        status: node.status === 'pending' && !node.due ? null : node.status,
        due: null,
        dueEnd: null,
        recurrence: null,
        isEvent: false,
        updatedAt: nowIso,
        _isDirty: true,
      })
      this.dirtyIds.add(id)
      migrated++
    }
    if (migrated > 0) {
      this.invalidateChildrenCache()
      // eslint-disable-next-line no-console
      console.log(`[migration v8.12] ${migrated} bucles convertidos a notas normales`)
      this.notify()
      await this.sync()
    }

    // v8.23: migrar nodos con bloque por prefijo de texto ("- foo", "# foo")
    // a extraData._block (modelo nuevo, Notion-style sin prefijo visible).
    let blockMigrated = 0
    const blockNowIso = new Date().toISOString()
    for (const [id, node] of this.nodes.entries()) {
      if (node.deletedAt) continue
      const meta = nodeMeta(node)
      if (meta.block) continue // ya migrado
      const text = node.text || ''
      let kind: 'bullet' | 'h1' | 'h2' | 'h3' | null = null
      let stripLen = 0
      if (text.startsWith('### ')) { kind = 'h3'; stripLen = 4 }
      else if (text.startsWith('## ')) { kind = 'h2'; stripLen = 3 }
      else if (text.startsWith('# ')) { kind = 'h1'; stripLen = 2 }
      else if (text.startsWith('- ')) { kind = 'bullet'; stripLen = 2 }
      if (!kind) continue
      const newExtra = patchExtraData(node, { block: kind })
      this.nodes.set(id, {
        ...node,
        text: text.slice(stripLen),
        extraData: newExtra,
        updatedAt: blockNowIso,
        _isDirty: true,
      })
      this.dirtyIds.add(id)
      blockMigrated++
    }
    if (blockMigrated > 0) {
      this.invalidateChildrenCache()
      // eslint-disable-next-line no-console
      console.log(`[migration v8.23] ${blockMigrated} bloques migrados a extraBlock`)
      this.notify()
      await this.sync()
    }

    // v8.24: mover color/_block/gcalEventId/location de extraData a columnas
    // reales del Node. Backfill silencioso.
    let promoted = 0
    const promotedNowIso = new Date().toISOString()
    for (const [id, node] of this.nodes.entries()) {
      if (node.deletedAt) continue
      let raw: Record<string, unknown> = {}
      try { raw = JSON.parse(node.extraData || '{}') } catch { continue }
      const nAny = node as unknown as { color?: string | null; block?: string | null; gcalEventId?: string | null; location?: string | null }
      const updates: Partial<Node> & { color?: string | null; block?: string | null; gcalEventId?: string | null; location?: string | null } = {}
      let changed = false
      if (!nAny.color && typeof raw.color === 'string') { updates.color = raw.color; delete raw.color; changed = true }
      if (!nAny.block && typeof raw._block === 'string' && ['bullet','h1','h2','h3'].includes(raw._block)) { updates.block = raw._block; delete raw._block; changed = true }
      if (!nAny.gcalEventId && typeof raw.gcalEventId === 'string') { updates.gcalEventId = raw.gcalEventId; delete raw.gcalEventId; changed = true }
      if (!nAny.location && typeof raw.location === 'string') { updates.location = raw.location; delete raw.location; changed = true }
      if (!changed) continue
      this.nodes.set(id, {
        ...node,
        ...updates,
        extraData: Object.keys(raw).length > 0 ? JSON.stringify(raw) : null,
        updatedAt: promotedNowIso,
        _isDirty: true,
      } as Node)
      this.dirtyIds.add(id)
      promoted++
    }
    if (promoted > 0) {
      this.invalidateChildrenCache()
      // eslint-disable-next-line no-console
      console.log(`[migration v8.24] ${promoted} nodos: color/block/gcalEventId/location promovidos a columnas`)
      this.notify()
      await this.sync()
    }

    // v8.27: promover _resource (boolean) y icon a columnas.
    let promoted27 = 0
    const promoted27NowIso = new Date().toISOString()
    for (const [id, node] of this.nodes.entries()) {
      if (node.deletedAt) continue
      let raw: Record<string, unknown> = {}
      try { raw = JSON.parse(node.extraData || '{}') } catch { continue }
      const nAny = node as unknown as { isResource?: boolean | null; icon?: string | null }
      const updates: Partial<Node> & { isResource?: boolean; icon?: string | null } = {}
      let changed = false
      if (nAny.isResource == null && raw._resource === true) { updates.isResource = true; delete raw._resource; changed = true }
      if (!nAny.icon && typeof raw.icon === 'string') { updates.icon = raw.icon; delete raw.icon; changed = true }
      if (!changed) continue
      this.nodes.set(id, {
        ...node,
        ...updates,
        extraData: Object.keys(raw).length > 0 ? JSON.stringify(raw) : null,
        updatedAt: promoted27NowIso,
        _isDirty: true,
      } as Node)
      this.dirtyIds.add(id)
      promoted27++
    }
    if (promoted27 > 0) {
      this.invalidateChildrenCache()
      // eslint-disable-next-line no-console
      console.log(`[migration v8.27] ${promoted27} nodos: isResource/icon promovidos a columnas`)
      this.notify()
      await this.sync()
    }

    // If no diary for today, create one
    if (!this.todayDiary()) {
      await this.createTodayDiary()
    }
  }

  private creatingDiaryPromise: Promise<void> | null = null
  private async createTodayDiary(): Promise<void> {
    // Lock: si ya hay una creación en curso, esperar a que termine y reverificar
    if (this.creatingDiaryPromise) {
      await this.creatingDiaryPromise
      if (this.todayDiary()) return
    }
    this.creatingDiaryPromise = this._createTodayDiaryImpl()
    try { await this.creatingDiaryPromise }
    finally { this.creatingDiaryPromise = null }
  }

  private async _createTodayDiaryImpl(): Promise<void> {
    const today = new Date()
    const dateStr = today.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    // Guardar como UTC midnight de la fecha LOCAL para evitar cruces de día
    // en servidores/clientes con distintas zonas horarias (e.g. UTC+2 → Z)
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const diaryDateISO = `${y}-${m}-${d}T00:00:00.000Z`

    this.createNode({
      text: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
      parentId: null,
      isDiaryEntry: true,
      diaryDate: diaryDateISO,
    })

    await this.sync()
  }
}

export const store = new NodeStore()

// React hook
import { useState, useEffect, useRef } from 'react'

/**
 * Sin selector: el componente se re-renderiza en CADA mutación del store.
 * Es el comportamiento histórico y sigue siendo válido para vistas que
 * dependen de cualquier cambio.
 */
export function useStore(): NodeStore
/**
 * Con selector: el componente sólo se re-renderiza si el valor devuelto
 * por el selector cambia (comparación estricta `Object.is`). Útil cuando
 * sólo necesitas un slice concreto (p.ej. `useStore(s => s.getNode(id))`).
 */
export function useStore<T>(selector: (s: NodeStore) => T, isEqual?: (a: T, b: T) => boolean): T
export function useStore<T>(
  selector?: (s: NodeStore) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): NodeStore | T {
  const [, forceUpdate] = useState(0)
  const sliceRef = useRef<T | undefined>(selector ? selector(store) : undefined)
  useEffect(() => {
    const unsub = store.subscribe(() => {
      if (!selector) {
        forceUpdate(n => n + 1)
        return
      }
      const next = selector(store)
      if (!isEqual(next, sliceRef.current as T)) {
        sliceRef.current = next
        forceUpdate(n => n + 1)
      }
    })
    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return selector ? (sliceRef.current as T) : store
}
