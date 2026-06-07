import { describe, it, expect } from 'vitest'
import { flattenVisibleTree, type ChildSource } from '../components/outliner/flattenTree'
import type { Node } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────────────

let _order = 0
function makeNode(id: string, parentId: string | null, extra: Partial<Node> = {}): Node {
  return {
    id, parentId,
    siblingOrder: extra.siblingOrder ?? _order++,
    text: id,
    types: [], collections: [],
    isCollapsed: undefined, // por defecto: colapsado (no expande)
    deletedAt: null,
    ...extra,
  } as unknown as Node
}

/** Store mock: children(parentId) ordenado por siblingOrder, como el real. */
function mockStore(nodes: Node[]): ChildSource {
  return {
    children(parentId: string | null): Node[] {
      return nodes
        .filter((n) => n.parentId === parentId && !n.deletedAt)
        .sort((a, b) => a.siblingOrder - b.siblingOrder)
    },
  }
}

const ids = (rows: { node: Node; depth: number }[]) => rows.map((r) => r.node.id)
const pairs = (rows: { node: Node; depth: number }[]) => rows.map((r) => `${r.node.id}@${r.depth}`)

// ── Tests ────────────────────────────────────────────────────────────────────

describe('flattenVisibleTree', () => {
  it('árbol todo colapsado → solo el primer nivel', () => {
    const nodes = [
      makeNode('a', null), makeNode('b', null),
      makeNode('a1', 'a'), makeNode('a2', 'a'), // hijos de a, pero a está colapsado
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(ids(rows)).toEqual(['a', 'b'])
  })

  it('nodo expandido (isCollapsed===false) incluye sus hijos en pre-orden', () => {
    const nodes = [
      makeNode('a', null, { isCollapsed: false, siblingOrder: 0 }),
      makeNode('a1', 'a', { siblingOrder: 0 }),
      makeNode('a2', 'a', { siblingOrder: 1 }),
      makeNode('b', null, { siblingOrder: 1 }),
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(pairs(rows)).toEqual(['a@0', 'a1@1', 'a2@1', 'b@0'])
  })

  it('expansión profunda respeta la profundidad', () => {
    const nodes = [
      makeNode('a', null, { isCollapsed: false }),
      makeNode('a1', 'a', { isCollapsed: false }),
      makeNode('a1x', 'a1'),
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(pairs(rows)).toEqual(['a@0', 'a1@1', 'a1x@2'])
  })

  it('excluye nodos de sistema (_system)', () => {
    const nodes = [
      makeNode('a', null),
      makeNode('sys', null, { extraData: JSON.stringify({ _system: true }) }),
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(ids(rows)).toEqual(['a'])
  })

  it('excluye tareas atómicas con estado (viven en panel derecho)', () => {
    const nodes = [
      makeNode('a', null, { isCollapsed: false }),
      makeNode('atom', 'a', { isAtomic: true, status: 'pending' as any }),
      makeNode('normal', 'a'),
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(ids(rows)).toEqual(['a', 'normal'])
  })

  it('inline view block (_inline) no expande hijos como bullets', () => {
    const nodes = [
      makeNode('tabla', null, { isCollapsed: false, extraData: JSON.stringify({ _inline: '1', viewBlock: 'tabla' }) }),
      makeNode('fila1', 'tabla'),
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(ids(rows)).toEqual(['tabla']) // las filas las pinta la tabla, no el árbol
  })

  it('excludeDiaryEntries solo afecta al primer nivel', () => {
    const nodes = [
      makeNode('diaryRoot', null, { isDiaryEntry: true }),       // excluido (nivel 0)
      makeNode('contenedor', null, { isCollapsed: false }),
      makeNode('diaryHijo', 'contenedor', { isDiaryEntry: true }), // NO excluido (nivel 1)
    ]
    const rows = flattenVisibleTree(mockStore(nodes), null, { excludeDiaryEntries: true })
    expect(ids(rows)).toEqual(['contenedor', 'diaryHijo'])
  })

  it('guarda anti-ciclo: un padre corrupto no provoca bucle infinito', () => {
    const nodes = [
      makeNode('a', null, { isCollapsed: false }),
      makeNode('b', 'a', { isCollapsed: false }),
    ]
    // Forzar ciclo: a pasa a ser hijo de b
    ;(nodes[0] as any).parentId = 'b'
    // raíz = 'a' para entrar al ciclo a→b→a
    const rows = flattenVisibleTree(mockStore([nodes[0], nodes[1]]), 'a')
    // No debe colgarse y cada id aparece una vez como máximo
    expect(new Set(ids(rows)).size).toBe(ids(rows).length)
  })

  it('lista plana de un contenedor ancho (caso de congelación) preserva orden', () => {
    const kids = Array.from({ length: 200 }, (_, i) => makeNode(`k${i}`, 'big', { siblingOrder: i }))
    const nodes = [makeNode('big', null, { isCollapsed: false }), ...kids]
    const rows = flattenVisibleTree(mockStore(nodes), null)
    expect(rows.length).toBe(201)
    expect(rows[0].node.id).toBe('big')
    expect(rows[1].node.id).toBe('k0')
    expect(rows[200].node.id).toBe('k199')
  })
})
