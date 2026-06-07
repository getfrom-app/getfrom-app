import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock de la API: bootstrapLoad usa apiRequest('/ops/bootstrap'); setLive(true)
// arranca el ciclo de ops que hace apiRequest('/ops/pull'). Mockeamos ambos.
vi.mock('../api/client', () => ({
  getToken: () => 'test-token',
  apiRequest: vi.fn(),
  syncNodes: vi.fn(),
}))

import { store } from '../store/nodeStore'
import { apiRequest } from '../api/client'

// Nodos de ejemplo en la MISMA forma que devuelve /ops/bootstrap (= /sync):
// columnas de syncNodes + types/collections ya como arrays.
function node(id: string, text: string, parentId: string | null, extra: Record<string, unknown> = {}) {
  return {
    id, parentId, text, body: null, siblingOrder: 0,
    types: [], collections: [], status: null,
    isActive: false, isEvent: false, isDiaryEntry: false, isChat: false,
    isCollapsed: false, isFavorite: false, due: null, dueEnd: null,
    priority: null, recurrence: null, diaryDate: null, extraData: null,
    isAtomic: false, publicSlug: null, deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    workspaceId: '00000000-0000-0000-0000-000000000001',
    ...extra,
  }
}

// Nodos de sistema con ids deterministas + contenido del usuario + uno borrado.
const BOOTSTRAP_NODES = [
  node('sys-agenda', '📅 Agenda', null),
  node('sys-prompts', '⚡ Prompts', null),
  node('sys-contexto', '🧠 Contexto', null),
  node('user-1', 'Nota del usuario', 'sys-contexto'),
  node('user-2', 'Otra nota', 'sys-contexto'),
  node('borrado-1', 'Nodo borrado', null, { deletedAt: '2026-05-01T00:00:00.000Z' }),
]
const LIVE_COUNT = BOOTSTRAP_NODES.filter(n => !n.deletedAt).length // 5

function mockApi(bootstrapResp: unknown) {
  ;(apiRequest as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (path === '/ops/bootstrap') {
      if (bootstrapResp instanceof Error) return Promise.reject(bootstrapResp)
      return Promise.resolve(bootstrapResp)
    }
    if (path.startsWith('/ops/pull')) return Promise.resolve({ ops: [], hasMore: false, latestSeq: 0 })
    return Promise.resolve({})
  })
}

describe('bootstrapLoad — carga inicial desde /ops/bootstrap', () => {
  beforeEach(() => {
    store.nodes.clear()
    store.isGuest = false
    vi.clearAllMocks()
  })

  it('carga el árbol completo y NO recrea nodos (los de sistema ya existen)', async () => {
    mockApi({
      syncAt: '2026-06-07T10:00:00.000Z',
      opsClientEnabled: true, opsLive: true,
      nodes: BOOTSTRAP_NODES, workspaces: [],
    })
    const ok = await store.bootstrapLoad()
    expect(ok).toBe(true)
    // El árbol vivo se cargó completo (5 nodos), no 49 ni 0.
    expect(store.allActive().length).toBe(LIVE_COUNT)
    // Los nodos de sistema están presentes con su id determinista.
    expect(store.getNode('sys-agenda')?.text).toBe('📅 Agenda')
    expect(store.getNode('sys-prompts')?.text).toBe('⚡ Prompts')
    // El nodo borrado está en el map pero NO cuenta como activo.
    expect(store.getNode('borrado-1')?.deletedAt).toBeTruthy()
    // Jerarquía correcta: las notas cuelgan de Contexto.
    expect(store.children('sys-contexto').length).toBe(2)
  })

  it('NO deja el árbol vacío aunque haya muchos nodos (regresión 49 nodos)', async () => {
    const many = Array.from({ length: 200 }, (_, i) => node(`n${i}`, `Nodo ${i}`, null))
    mockApi({ syncAt: '2026-06-07T10:00:00.000Z', opsClientEnabled: true, opsLive: true, nodes: many, workspaces: [] })
    const ok = await store.bootstrapLoad()
    expect(ok).toBe(true)
    expect(store.allActive().length).toBe(200)
  })

  it('devuelve false si /ops/bootstrap falla → el caller hace fallback a /sync', async () => {
    mockApi(new Error('HTTP 500'))
    const ok = await store.bootstrapLoad()
    expect(ok).toBe(false)
    expect(store.allActive().length).toBe(0)
  })

  it('opsLive=false: carga el árbol igual (transporte lo decide el caller)', async () => {
    mockApi({ syncAt: '2026-06-07T10:00:00.000Z', opsClientEnabled: false, opsLive: false, nodes: BOOTSTRAP_NODES, workspaces: [] })
    const ok = await store.bootstrapLoad()
    expect(ok).toBe(true)
    expect(store.allActive().length).toBe(LIVE_COUNT)
  })
})
