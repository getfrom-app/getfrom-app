/**
 * teachMagic — Enseñar a Magic con corrección en lenguaje natural.
 *
 * Flujo:
 * 1. El usuario escribe o graba una corrección sobre un nodo
 *    (ej. "esto no es de la isla, es de mi trading" / "Marina es mi novia, no mi tía").
 * 2. Se envía a /ai/teach junto al nodo, los contextos y el perfil.
 * 3. El servidor interpreta y devuelve acciones a aplicar + una regla a recordar.
 * 4. applyTeachResult aplica las acciones (reasignar contexto, cambiar tipo, añadir al perfil)
 *    y guarda la regla en learningsStore (que alimenta clasificador y Magic).
 */

import { apiRequest } from './client'
import { store } from '../store/nodeStore'
import { learningsStore } from '../store/learningsStore'
import { buildClassifyContexts } from './autoClassify'
import { PROFILE_KNOWLEDGE, isProfileKnowledge } from '../utils/knowledgeNodes'

const BUILTIN_TAGS = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])

export interface TeachResult {
  contextId: string | null
  setType: 'task' | 'event' | 'loop' | 'note' | null
  profileFact: string | null
  rule: string
}

/** Etiqueta legible del tipo actual del nodo (para dar contexto al modelo). */
function nodeTypeLabel(node: { status?: string | null; isEvent?: boolean; types?: string[] }): string {
  if (node.status !== null && node.status !== undefined) return 'tarea'
  if (node.isEvent) return 'evento'
  if ((node.types || []).includes('bucle')) return 'bucle'
  return 'nota'
}

/** Contextos de usuario actualmente asignados al nodo (texto), excluyendo tags de sistema. */
function currentContextLabel(node: { types?: string[] }): string {
  const userTypes = (node.types || []).filter(t => !BUILTIN_TAGS.has(t))
  return userTypes.length > 0 ? userTypes.join(', ') : ''
}

/** Líneas del perfil IA del usuario (hijos directos del nodo perfil). */
function readProfileLines(): string[] {
  const perfil = store.perfilIANode?.() ?? null
  if (!perfil) return []
  return store.children(perfil.id)
    .filter(n => !n.deletedAt && (n.text || '').trim().length > 3)
    .slice(0, 50)
    .map(n => (n.text || '').trim())
}

/** Envía la corrección al servidor y devuelve las acciones interpretadas. */
export async function teachMagic(correction: string, nodeId: string): Promise<TeachResult> {
  const node = store.getNode(nodeId)
  const contexts = buildClassifyContexts(store.perfilIANode?.()?.id)
  const result = await apiRequest<TeachResult>('/ai/teach', {
    method: 'POST',
    body: JSON.stringify({
      correction,
      node: node ? {
        text: node.text || '',
        type: nodeTypeLabel(node),
        context: currentContextLabel(node),
      } : undefined,
      contexts: contexts.map(c => ({ id: c.id, name: c.name, parentId: c.parentId ?? null })),
      userProfile: readProfileLines(),
    }),
  })
  return result
}

/** Reasigna el nodo a un contexto (vía types[]), quitando los contextos de usuario previos. */
function applyContext(nodeId: string, contextNodeId: string): string | null {
  const node = store.getNode(nodeId)
  const ctx = store.getNode(contextNodeId)
  if (!node || !ctx) return null
  const tagName = ctx.text || ''
  if (!tagName) return null
  const typesWithoutUserCtx = (node.types || []).filter(t => BUILTIN_TAGS.has(t))
  const newTypes = typesWithoutUserCtx.includes(tagName) ? typesWithoutUserCtx : [...typesWithoutUserCtx, tagName]
  store.updateNode(nodeId, { types: newTypes })
  try {
    const ed = JSON.parse(node.extraData || '{}')
    ed._contextManuallySet = '1'
    delete ed._autoContextId
    delete ed._autoContextConfidence
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  } catch { /* ignore */ }
  return tagName
}

/** Cambia el tipo del nodo (tarea / evento / bucle / nota). */
function applyType(nodeId: string, setType: NonNullable<TeachResult['setType']>): string {
  const node = store.getNode(nodeId)
  if (!node) return ''
  const types = node.types || []
  switch (setType) {
    case 'task': {
      const due = new Date(); due.setHours(23, 59, 59, 0)
      store.updateNode(nodeId, { status: 'pending', due: due.toISOString(), types: types.filter(t => t !== 'bucle'), isEvent: false })
      return 'tarea'
    }
    case 'event':
      store.updateNode(nodeId, { isEvent: true, status: null, due: null, types: types.filter(t => t !== 'bucle') })
      return 'evento'
    case 'loop':
      store.updateNode(nodeId, { types: types.includes('bucle') ? types : [...types, 'bucle'], isEvent: false })
      return 'bucle'
    case 'note':
      store.updateNode(nodeId, { status: null, due: null, isEvent: false, types: types.filter(t => t !== 'bucle') })
      return 'nota'
  }
}

/** Añade un hecho al perfil IA del usuario, bajo "🧠 Lo que From sabe sobre ti". */
async function addProfileFact(fact: string): Promise<void> {
  let perfil = store.perfilIANode?.() ?? null
  if (!perfil) {
    try { perfil = await store.getOrCreatePerfilIA() } catch { return }
  }
  if (!perfil) return
  const LEARN_SECTION = PROFILE_KNOWLEDGE  // Fase 1: crea con texto viejo; reconoce ambos
  let learnNode = store.children(perfil.id).find(n => !n.deletedAt && isProfileKnowledge(n.text))
  if (!learnNode) {
    const sibs = store.children(perfil.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    learnNode = store.createNode({ text: LEARN_SECTION, parentId: perfil.id, siblingOrder: maxOrder + 1000 })
  }
  const children = store.children(learnNode.id).filter(n => !n.deletedAt)
  // Evitar duplicado exacto
  if (children.some(n => (n.text || '').trim().toLowerCase() === fact.trim().toLowerCase())) return
  const maxOrder = children.length > 0 ? Math.max(...children.map(c => c.siblingOrder)) : 0
  store.createNode({ text: fact.trim(), parentId: learnNode.id, siblingOrder: maxOrder + 1000 })
}

/**
 * Aplica el resultado de teach al nodo y guarda la regla.
 * Devuelve un resumen legible de lo que se aplicó (para feedback al usuario).
 */
export async function applyTeachResult(nodeId: string, result: TeachResult): Promise<string[]> {
  const summary: string[] = []
  const node = store.getNode(nodeId)

  if (result.contextId) {
    const tagName = applyContext(nodeId, result.contextId)
    if (tagName) summary.push(`Contexto → ${tagName}`)
  }
  if (result.setType) {
    const label = applyType(nodeId, result.setType)
    if (label) summary.push(`Tipo → ${label}`)
  }
  if (result.profileFact) {
    await addProfileFact(result.profileFact)
    summary.push(`Perfil: ${result.profileFact}`)
  }
  if (result.rule && result.rule.trim()) {
    learningsStore.add({
      text: result.rule.trim(),
      category: 'behavior',
      nodeText: node?.text || undefined,
      source: 'manual',
    })
    summary.push('Magic lo recordará')
  }
  return summary
}
