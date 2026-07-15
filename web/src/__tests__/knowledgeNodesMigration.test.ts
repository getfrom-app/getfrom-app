// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import { migrateKnowledgeNodesToFromly, migrateContextKnowledgeToMemoria } from '../api/userKnowledge'
import {
  PROFILE_KNOWLEDGE,
  CONTEXT_KNOWLEDGE,
  PROFILE_KNOWLEDGE_OLD,
  CONTEXT_KNOWLEDGE_OLD,
  CONTEXT_KNOWLEDGE_OLD_FROMLY,
  isProfileKnowledge,
  isContextKnowledge,
} from '../utils/knowledgeNodes'

// FASE 2 del rebrand: los nodos de conocimiento son text-keyed (sin id determinista).
// La migración renombra in situ el texto VIEJO ("From") al nuevo ("Fromly") sin
// duplicar (mismo id), respetando la distinción exacta Perfil ("…sobre ti") vs
// contexto (cuyo texto es prefijo del de Perfil).
describe('migrateKnowledgeNodesToFromly', () => {
  beforeEach(() => {
    store.nodes.clear()
    try { localStorage.removeItem('from_knowledge_fromly_v1') } catch { /* */ }
  })

  it('renombra el nodo de Perfil viejo → Fromly, mismo id, sin duplicar', () => {
    const n = store.createNode({ text: PROFILE_KNOWLEDGE_OLD, parentId: null })
    migrateKnowledgeNodesToFromly()
    const after = store.getNode(n.id)
    expect(after?.text).toBe(PROFILE_KNOWLEDGE)
    // Mismo id, no se creó otro nodo
    const live = [...store.nodes.values()].filter(x => !x.deletedAt)
    expect(live.length).toBe(1)
    expect(live[0].id).toBe(n.id)
  })

  it('renombra el nodo de contexto viejo → Fromly sin tocar el de Perfil (prefijo)', () => {
    const profile = store.createNode({ text: PROFILE_KNOWLEDGE_OLD, parentId: null })
    const ctx = store.createNode({ text: CONTEXT_KNOWLEDGE_OLD, parentId: null })
    migrateKnowledgeNodesToFromly()
    // Cada uno va a SU variante nueva, sin colisión de prefijo
    expect(store.getNode(profile.id)?.text).toBe(PROFILE_KNOWLEDGE)
    expect(store.getNode(ctx.id)?.text).toBe(CONTEXT_KNOWLEDGE)
  })

  it('es idempotente: los nodos ya en "Fromly" no se tocan', () => {
    const n = store.createNode({ text: PROFILE_KNOWLEDGE, parentId: null })
    migrateKnowledgeNodesToFromly()
    expect(store.getNode(n.id)?.text).toBe(PROFILE_KNOWLEDGE)
  })

  it('los finders reconocen tanto el texto viejo como el nuevo', () => {
    expect(isProfileKnowledge(PROFILE_KNOWLEDGE_OLD)).toBe(true)
    expect(isProfileKnowledge(PROFILE_KNOWLEDGE)).toBe(true)
    expect(isContextKnowledge(CONTEXT_KNOWLEDGE_OLD)).toBe(true)
    expect(isContextKnowledge(CONTEXT_KNOWLEDGE)).toBe(true)
    // El de contexto NO debe matchear como Perfil (y viceversa)
    expect(isProfileKnowledge(CONTEXT_KNOWLEDGE)).toBe(false)
    expect(isContextKnowledge(PROFILE_KNOWLEDGE)).toBe(false)
  })
})

// FASE 3: la memoria de CONTEXTO deja de llamarse "Lo que Fromly sabe" → "Memoria"
// (el Perfil no cambia). Mismo patrón de renombrado in situ, sin duplicar.
describe('migrateContextKnowledgeToMemoria', () => {
  beforeEach(() => {
    store.nodes.clear()
    try { localStorage.removeItem('from_knowledge_memoria_v1') } catch { /* */ }
  })

  it('renombra el nodo de contexto "Lo que Fromly sabe" → "Memoria", mismo id', () => {
    const n = store.createNode({ text: CONTEXT_KNOWLEDGE_OLD_FROMLY, parentId: null })
    migrateContextKnowledgeToMemoria()
    const after = store.getNode(n.id)
    expect(after?.text).toBe(CONTEXT_KNOWLEDGE)
    const live = [...store.nodes.values()].filter(x => !x.deletedAt)
    expect(live.length).toBe(1)
    expect(live[0].id).toBe(n.id)
  })

  it('no toca el nodo de Perfil ("…sobre ti")', () => {
    const profile = store.createNode({ text: PROFILE_KNOWLEDGE, parentId: null })
    migrateContextKnowledgeToMemoria()
    expect(store.getNode(profile.id)?.text).toBe(PROFILE_KNOWLEDGE)
  })

  it('es idempotente: un nodo ya en "Memoria" no se toca', () => {
    const n = store.createNode({ text: CONTEXT_KNOWLEDGE, parentId: null })
    migrateContextKnowledgeToMemoria()
    expect(store.getNode(n.id)?.text).toBe(CONTEXT_KNOWLEDGE)
  })

  it('el finder reconoce los tres nombres históricos', () => {
    expect(isContextKnowledge(CONTEXT_KNOWLEDGE_OLD)).toBe(true)
    expect(isContextKnowledge(CONTEXT_KNOWLEDGE_OLD_FROMLY)).toBe(true)
    expect(isContextKnowledge(CONTEXT_KNOWLEDGE)).toBe(true)
  })
})
