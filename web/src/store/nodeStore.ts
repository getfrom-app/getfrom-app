import { syncNodes, getToken } from '../api/client'
import type { Node, Workspace } from '../types'
import { generateId } from '../utils/id'

const GUEST_NODES_KEY = 'from_guest_nodes'
const GUEST_WORKSPACES_KEY = 'from_guest_workspaces'

type Listener = () => void

class NodeStore {
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

  children(parentId: string | null): Node[] {
    const result: Node[] = []
    for (const node of this.nodes.values()) {
      if (node.deletedAt) continue
      if (node.parentId === parentId) result.push(node)
    }
    return result.sort((a, b) => a.siblingOrder - b.siblingOrder)
  }

  allActive(): Node[] {
    return [...this.nodes.values()].filter(n => !n.deletedAt)
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

    // 2. Months: hijos directos de un Año, texto = mes
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
    for (const n of this.nodes.values()) {
      if (n.deletedAt) continue
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._tagDefinition?.toLowerCase() === tagName.toLowerCase()) return n
      } catch {}
    }
    return null
  }

  // ── Recursos ────────────────────────────────────────────────────────────────

  /** Todos los nodos marcados como recurso */
  allResources(): Node[] {
    return this.allActive().filter(n => {
      if (n.deletedAt) return false
      try { return !!JSON.parse(n.extraData || '{}')._resource } catch { return false }
    })
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
    n.types = typeof n.types === 'string' ? JSON.parse(n.types) : (n.types || [])
    n.collections = typeof n.collections === 'string' ? JSON.parse(n.collections) : (n.collections || [])
    // Auto-migración: notas con 'bucle' en types → isSeguimiento (bucle eliminado de la UI)
    if (n.types.includes('bucle')) {
      n.isSeguimiento = true
      n.types = n.types.filter((t: string) => t !== 'bucle')
    }
    this.nodes.set(n.id, n)
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
      publicSlug: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      workspaceId,
      _isDirty: true,
    }
    this.nodes.set(id, node)
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
    // Bucle: no debe tener fecha. Ignorar agendado silenciosamente.
    if (node.isSeguimiento) return null
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

    try {
      const res = await syncNodes(payload)
      this.lastSyncAt = res.syncAt
      this.dirtyIds.clear()

      // Apply server nodes (merge)
      for (const rawNode of res.nodes) {
        const n = rawNode as Node
        if (!this.nodes.has(n.id)) {
          this.applyNode(n)
        } else {
          const local = this.nodes.get(n.id)!
          // Server wins if not locally dirty
          if (!this.dirtyIds.has(n.id)) {
            this.applyNode(n)
          } else if (n.updatedAt > local.updatedAt) {
            this.applyNode(n)
            this.dirtyIds.delete(n.id)
          }
        }
      }

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

    // Migración REVERTIDA v7.95: bucle ahora es concepto separado, no status.
    // Limpiamos status:pending + due:null en nodos isSeguimiento (eran la
    // migración de v7.65 que ahora deshacemos). Sus tareas hijas no se tocan.
    let reverted = 0
    for (const node of this.nodes.values()) {
      if (node.deletedAt) continue
      if (node.isSeguimiento && node.status === 'pending' && !node.due) {
        this.updateNode(node.id, { status: null })
        reverted++
      }
      // Bucles NO deben tener fecha: limpiar si por error la tienen
      if (node.isSeguimiento && node.due) {
        this.updateNode(node.id, { due: null })
        reverted++
      }
    }
    if (reverted > 0) {
      // eslint-disable-next-line no-console
      console.log(`[migration] ${reverted} bucles limpiados (status y/o due)`)
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
import { useState, useEffect } from 'react'

export function useStore() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const unsub = store.subscribe(() => forceUpdate(n => n + 1))
    return unsub
  }, [])
  return store
}
