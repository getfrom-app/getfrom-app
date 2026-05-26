export interface Node {
  id: string
  parentId: string | null
  text: string
  body: string | null
  siblingOrder: number
  types: string[]
  collections: string[]
  status: 'pending' | 'done' | 'future' | null
  isActive: boolean
  isEvent: boolean
  /** @deprecated v8.12: el concepto "bucle" se eliminó. La migración v8.12
   *  lo deja en false para todos los nodos. Permanece en el schema por
   *  retrocompat con Mac/iOS hasta que se coordine eliminación global.
   *  No usar en código nuevo. */
  isSeguimiento: boolean
  // ── Columnas promovidas de extraData en v8.24 ──────────────────────────
  /** Color de acento del nodo (hex). Antes vivía en extraData.color. */
  color?: string | null
  /** Tipo de bloque inline: bullet|h1|h2|h3. Antes extraData._block. */
  block?: string | null
  /** ID del evento en Google Calendar (si está sincronizado). Antes extraData.gcalEventId. */
  gcalEventId?: string | null
  /** Ubicación de un evento. Antes extraData.location. */
  location?: string | null
  // ── Columnas promovidas en v8.27 ───────────────────────────────────────
  /** True si el nodo es un recurso (link/web/youtube). Antes extraData._resource. */
  isResource?: boolean | null
  /** Icono inline del nodo (emoji). Antes extraData.icon. */
  icon?: string | null
  // ── Columnas promovidas en v8.29 ───────────────────────────────────────
  /** URL del recurso. Antes extraData._resourceUrl. */
  resourceUrl?: string | null
  /** Tipo de recurso (url|youtube|podcast|article|book). Antes _resourceType. */
  resourceType?: string | null
  /** Estado del recurso (pending|consuming|done). Antes _resourceStatus. */
  resourceStatus?: string | null
  // ── Columna promovida en v8.30 ─────────────────────────────────────────
  /** Schema/valores de propiedades (tablas). JSON string. Antes _props. */
  props?: string | null
  isDiaryEntry: boolean
  isChat: boolean
  isCollapsed: boolean
  isFavorite: boolean
  due: string | null
  dueEnd: string | null
  priority: 'high' | 'medium' | 'low' | null
  recurrence: string | null
  diaryDate: string | null
  extraData: string | null
  publicSlug: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  workspaceId: string
  // Local only
  _isDirty?: boolean
  _children?: string[] // computed
}

export interface Workspace {
  id: string
  name: string
  color?: string
  icon?: string
}

export interface User {
  id: string
  email: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoggedIn: boolean
}

export interface SyncResponse {
  syncAt: string
  nodes: Node[]
  workspaces: Workspace[]
}

export type ViewMode = 'list' | 'table' | 'kanban' | 'calendar'

export interface TagDefinition {
  id: string
  name: string
  displayName: string
  body: string | null
}
