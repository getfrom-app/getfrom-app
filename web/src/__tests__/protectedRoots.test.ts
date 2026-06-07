import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { isProtectedSystemRoot } from '../utils/rootLookup'

// Las raíces de sistema no se pueden eliminar. Sin token, structuralId() es null,
// así que probamos la protección por el flag _perfilIA (camino independiente del id).
describe('protección de raíces de sistema', () => {
  beforeEach(() => { store.nodes.clear() })

  it('store.deleteNode NO borra un nodo Perfil IA (flag _perfilIA)', () => {
    const perfil = store.createNode({ text: '🧠 Perfil de IA', parentId: null })
    store.updateNode(perfil.id, { extraData: JSON.stringify({ _perfilIA: '1' }) })
    store.deleteNode(perfil.id)
    expect(store.getNode(perfil.id)?.deletedAt).toBeFalsy()  // sigue vivo
    expect(isProtectedSystemRoot(perfil.id)).toBe(true)
  })

  it('store.deleteNode SÍ borra un nodo normal', () => {
    const n = store.createNode({ text: 'una nota cualquiera', parentId: null })
    store.deleteNode(n.id)
    expect(store.getNode(n.id)?.deletedAt).toBeTruthy()
    expect(isProtectedSystemRoot(n.id)).toBe(false)
  })
})
