/**
 * learningsStore — Sistema de aprendizaje de Magic (From AI)
 *
 * Almacena correcciones y preferencias que el usuario enseña a From.
 * Se persiste en localStorage y se inyecta en el prompt del sistema de IA
 * para que Magic mejore progresivamente su comprensión del usuario.
 *
 * Fuentes de aprendizaje:
 *  · Manual: "Enseñar a Magic" en el menú contextual del nodo
 *  · Automático: detección de cambios en nodos creados por Magic (futuro)
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'from_magic_learnings'

export type LearningCategory = 'type' | 'context' | 'behavior' | 'positive'

export interface Learning {
  id: string
  createdAt: string          // ISO
  text: string               // Regla en lenguaje natural para el prompt
  category: LearningCategory
  nodeText?: string          // Texto del nodo que lo provocó
  source: 'manual' | 'auto'
}

// ── Persistencia ────────────────────────────────────────────────────────────

function load(): Learning[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function save(items: Learning[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// ── Store singleton ──────────────────────────────────────────────────────────

class LearningsStore {
  private items: Learning[] = load()
  private listeners = new Set<() => void>()

  private notify() { this.listeners.forEach(fn => fn()) }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getAll(): Learning[] {
    return [...this.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** Añade una nueva corrección. Evita duplicados exactos. */
  add(item: Omit<Learning, 'id' | 'createdAt'>): Learning | null {
    // Evitar duplicados por texto exacto
    if (this.items.some(i => i.text === item.text)) return null

    const newItem: Learning = {
      id: `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...item,
    }
    this.items = [newItem, ...this.items]
    save(this.items)
    this.notify()
    return newItem
  }

  update(id: string, text: string) {
    this.items = this.items.map(i => i.id === id ? { ...i, text } : i)
    save(this.items)
    this.notify()
  }

  remove(id: string) {
    this.items = this.items.filter(i => i.id !== id)
    save(this.items)
    this.notify()
  }

  clear() {
    this.items = []
    save(this.items)
    this.notify()
  }

  /**
   * Genera el bloque de aprendizajes para inyectar en el system prompt de IA.
   * Devuelve null si no hay nada que inyectar.
   */
  buildPromptBlock(): string | null {
    const items = this.items.filter(i => i.category !== 'positive').slice(0, 40)
    if (items.length === 0) return null

    const lines = items.map(i => `- ${i.text}`)
    return `Lo que el usuario ha enseñado a Magic:\n${lines.join('\n')}`
  }
}

export const learningsStore = new LearningsStore()

export function useLearningsStore() {
  const [, rerender] = useState(0)
  useEffect(() => learningsStore.subscribe(() => rerender(n => n + 1)), [])
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
