// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import {
  ensureAtajosNode,
  createFilterShortcut,
  getShortcutData,
  migrateNodeShortcutsToFavorites,
} from '../utils/atajosHelper'

// Unificación de favoritos: los nodos-puntero legacy (_shortcutNodeId) bajo el
// contenedor de filtros se convierten en node.isFavorite y se borran. Los filtros
// de query reales NO se tocan.
describe('migrateNodeShortcutsToFavorites', () => {
  beforeEach(() => { store.nodes.clear() })

  it('convierte punteros legacy en isFavorite y los borra; respeta filtros reales', () => {
    // ensureAtajosNode no crea en store casi vacío (<3 nodos): sembramos relleno
    store.createNode({ text: 'a', parentId: null })
    store.createNode({ text: 'b', parentId: null })
    // El nodo destino que estaba "favoriteado" via el viejo sistema (sin isFavorite aún)
    const target = store.createNode({ text: 'Mi nodo favorito', parentId: null })
    expect(target.isFavorite).toBeFalsy()

    // Contenedor de filtros + un filtro de query real + un puntero legacy a nodo
    const container = ensureAtajosNode()
    createFilterShortcut('Pendientes', 'pendiente')
    const pointer = store.createNode({ text: 'Mi nodo favorito', parentId: container.id })
    store.updateNode(pointer.id, { extraData: JSON.stringify({ _shortcutNodeId: target.id, _shortcutQuery: `node:${target.id}` }) })

    migrateNodeShortcutsToFavorites()

    // El destino queda marcado favorito; el puntero se borra
    expect(store.getNode(target.id)?.isFavorite).toBe(true)
    expect(store.getNode(pointer.id)?.deletedAt).toBeTruthy()

    // El filtro de query real sigue vivo y visible
    const live = store.children(container.id).filter(n => !n.deletedAt)
    expect(live.length).toBe(1)
    expect(getShortcutData(live[0].id)?.query).toBe('pendiente')
    expect(getShortcutData(live[0].id)?.nodeId).toBeUndefined()
  })

  it('es idempotente (segunda pasada no hace nada)', () => {
    store.createNode({ text: 'a', parentId: null })
    store.createNode({ text: 'b', parentId: null })
    store.createNode({ text: 'c', parentId: null })
    const container = ensureAtajosNode()
    createFilterShortcut('Esta semana', 'semana')
    migrateNodeShortcutsToFavorites()
    migrateNodeShortcutsToFavorites()
    const live = store.children(container.id).filter(n => !n.deletedAt)
    expect(live.length).toBe(1)
  })
})
