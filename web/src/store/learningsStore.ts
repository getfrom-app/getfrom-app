/**
 * learningsStore — Sistema de aprendizaje de Magic (From AI)
 *
 * Almacena correcciones y preferencias que el usuario enseña a From.
 *
 * Persistencia: cada regla es un NODO hijo del contenedor "🧠 Reglas de Magic"
 * bajo el perfil IA. Así el aprendizaje sincroniza por cuenta (web, Mac, móvil)
 * a través del sistema de nodos existente — NO depende del dispositivo.
 * Se migra automáticamente lo que hubiera en localStorage (versiones antiguas).
 *
 * Fuentes de aprendizaje:
 *  · Manual: "Enseñar a Magic" en el menú contextual del nodo
 *  · Chat: correcciones interpretadas por /ai/teach
 */

import { useEffect, useState } from 'react'
import { store } from './nodeStore'
import { getProfileContainer } from '../api/userKnowledge'

const STORAGE_KEY = 'from_magic_learnings'        // legacy — solo migración
const MIGRATED_KEY = 'from_magic_learnings_migrated'
const RULES_SECTION = '🧠 Reglas de Magic'

export type LearningCategory = 'type' | 'context' | 'behavior' | 'positive'

export interface Learning {
  id: string
  createdAt: string          // ISO
  text: string               // Regla en lenguaje natural para el prompt
  category: LearningCategory
  nodeText?: string          // Texto del nodo que lo provocó
  source: 'manual' | 'auto'
}

interface LearningMeta {
  _magicLearning: string
  cat: LearningCategory
  src: 'manual' | 'auto'
  nodeText?: string
}

function buildMeta(category: LearningCategory, source: 'manual' | 'auto', nodeText?: string): Record<string, string> {
  const meta: Record<string, string> = { _magicLearning: '1', cat: category, src: source }
  if (nodeText) meta.nodeText = nodeText
  return meta
}

function parseLearning(node: { id: string; text?: string | null; extraData?: string | null; createdAt?: string | null }): Learning | null {
  let meta: Partial<LearningMeta> = {}
  try { meta = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  if (meta._magicLearning !== '1') return null
  return {
    id: node.id,
    createdAt: node.createdAt || new Date().toISOString(),
    text: (node.text || '').trim(),
    category: meta.cat || 'behavior',
    nodeText: meta.nodeText,
    source: meta.src || 'manual',
  }
}

// ── Store singleton (respaldado en nodos) ─────────────────────────────────────

class LearningsStore {
  private listeners = new Set<() => void>()

  constructor() {
    // Migración única desde localStorage → nodos.
    try {
      if (!localStorage.getItem(MIGRATED_KEY)) {
        const legacy: Learning[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        if (Array.isArray(legacy) && legacy.length > 0) {
          // Diferida: el store de nodos puede no estar hidratado al construir.
          setTimeout(() => this.migrate(legacy), 1500)
        } else {
          localStorage.setItem(MIGRATED_KEY, '1')
        }
      }
    } catch { /* ignore */ }
  }

  private migrate(legacy: Learning[]) {
    try {
      const container = getProfileContainer(RULES_SECTION)
      if (!container) return // reintenta en la próxima carga
      const existing = new Set(store.children(container.id).filter(n => !n.deletedAt).map(n => (n.text || '').trim()))
      let order = 1000
      for (const l of legacy) {
        const text = (l.text || '').trim()
        if (!text || existing.has(text)) continue
        store.createNode({ text, parentId: container.id, siblingOrder: order, extraData: buildMeta(l.category, l.source, l.nodeText) })
        order += 1000
      }
      localStorage.setItem(MIGRATED_KEY, '1')
      localStorage.removeItem(STORAGE_KEY)
      this.notify()
    } catch { /* reintenta en la próxima carga */ }
  }

  private notify() { this.listeners.forEach(fn => fn()) }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getAll(): Learning[] {
    const container = getProfileContainer(RULES_SECTION, false)
    if (!container) return []
    return store.children(container.id)
      .filter(n => !n.deletedAt)
      .map(parseLearning)
      .filter((l): l is Learning => l !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** Añade una nueva corrección. Evita duplicados exactos por texto. */
  add(item: Omit<Learning, 'id' | 'createdAt'>): Learning | null {
    const text = item.text.trim()
    if (!text) return null
    const container = getProfileContainer(RULES_SECTION)
    if (!container) return null
    const siblings = store.children(container.id).filter(n => !n.deletedAt)
    if (siblings.some(n => (n.text || '').trim() === text)) return null
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(c => c.siblingOrder)) : 0
    const node = store.createNode({ text, parentId: container.id, siblingOrder: maxOrder + 1000, extraData: buildMeta(item.category, item.source, item.nodeText) })
    this.notify()
    return parseLearning(node)
  }

  update(id: string, text: string) {
    const clean = text.trim()
    if (!clean) return
    store.updateNode(id, { text: clean })
    this.notify()
  }

  remove(id: string) {
    store.deleteNode(id)
    this.notify()
  }

  clear() {
    const container = getProfileContainer(RULES_SECTION, false)
    if (!container) return
    store.children(container.id).filter(n => !n.deletedAt).forEach(n => store.deleteNode(n.id))
    this.notify()
  }

  /**
   * Genera el bloque de aprendizajes para inyectar en el system prompt de IA.
   * Devuelve null si no hay nada que inyectar.
   */
  buildPromptBlock(): string | null {
    const items = this.getAll().filter(i => i.category !== 'positive').slice(0, 40)
    if (items.length === 0) return null
    const lines = items.map(i => `- ${i.text}`)
    return `Lo que el usuario ha enseñado a Magic:\n${lines.join('\n')}`
  }
}

export const learningsStore = new LearningsStore()

export function useLearningsStore() {
  const [, rerender] = useState(0)
  // Reactivo tanto a cambios propios como a cambios del store de nodos
  // (p.ej. reglas que llegan por sync desde otro dispositivo).
  useEffect(() => {
    const unsubLs = learningsStore.subscribe(() => rerender(n => n + 1))
    const unsubStore = store.subscribe(() => rerender(n => n + 1))
    return () => { unsubLs(); unsubStore() }
  }, [])
  return learningsStore
}

// ── Helpers para generar reglas de aprendizaje ───────────────────────────────

/** Genera el texto de la regla a partir de la opción elegida por el usuario */
export function buildLearningText(
  option: TeachOption,
  node: { text?: string | null; types?: string[] }
): string {
  const nodeRef = node.text ? `"${node.text.slice(0, 40)}"` : 'este tipo de nodos'

  switch (option) {
    case 'not_task':
      return `No interpretar ${nodeRef} ni similares como tareas; son notas o información.`
    case 'not_event':
      return `No interpretar ${nodeRef} ni similares como eventos de calendario.`
    case 'should_be_task':
      return `Contenido similar a ${nodeRef} debe crearse como tarea pendiente.`
    case 'should_be_event':
      return `Contenido similar a ${nodeRef} debe crearse como evento de calendario.`
    case 'wrong_context':
      return `El contexto "${(node.types || []).join(', ')}" no es correcto para ${nodeRef}.`
    case 'correct':
      return `La interpretación de ${nodeRef} es correcta; reforzar este patrón.`
    default:
      return option
  }
}

export type TeachOption =
  | 'not_task'
  | 'not_event'
  | 'should_be_task'
  | 'should_be_event'
  | 'wrong_context'
  | 'correct'
  | string  // free-form
