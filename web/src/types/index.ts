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
  isSeguimiento: boolean
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
