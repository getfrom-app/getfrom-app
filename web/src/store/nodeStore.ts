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
    for (const node of this.nodes.values()) {
      if (!node.isDiaryEntry || node.deletedAt) continue
      if (node.diaryDate) {
        const d = new Date(node.diaryDate)
        if (d >= today && d < tomorrow) return node
      }
    }
    return null
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

  // ── Mutations ─────────────────────────────────────────────────────────────

  private applyNode(raw: unknown): void {
    const n = raw as Node
    if (!n.id) return
    n.types = typeof n.types === 'string' ? JSON.parse(n.types) : (n.types || [])
    n.collections = typeof n.collections === 'string' ? JSON.parse(n.collections) : (n.collections || [])
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
    const updated = { ...node, ...changes, updatedAt: new Date().toISOString(), _isDirty: true }
    this.nodes.set(id, updated)
    this.dirtyIds.add(id)
    this.notify()
    this.scheduleSyncDebounced()
  }

  deleteNode(id: string): void {
    this.updateNode(id, { deletedAt: new Date().toISOString() })
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
      // Detectar límite free (402 FREE_LIMIT_REACHED)
      if (err instanceof Error && err.message === 'FREE_LIMIT_REACHED') {
        window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'node_limit' } }))
      }
      console.error('Sync failed:', err)
    } finally {
      this.isSyncing = false
      this.notify()
    }
  }

  async initialLoad(): Promise<void> {
    await this.sync()

    // If no diary for today, create one
    if (!this.todayDiary()) {
      await this.createTodayDiary()
    }
  }

  private async createTodayDiary(): Promise<void> {
    const today = new Date()
    const dateStr = today.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    const diaryDate = new Date(today)
    diaryDate.setHours(0, 0, 0, 0)

    this.createNode({
      text: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
      parentId: null,
      isDiaryEntry: true,
      diaryDate: diaryDate.toISOString(),
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
