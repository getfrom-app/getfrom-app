// MARK: - InferredNodeObject (paridad Mac v8.30)
//
// Detecta el "tipo" de un nodo sin que el usuario lo etiquete manualmente:
// busca hashtags reconocidos en el texto + revisa flags estructurales.
// Reglas (orden de prioridad):
//  1. .meeting    — #reunión / #meeting / #reunion
//  2. .book       — #libro / #book
//  3. .decision   — #decisión / #decision
//  4. .reference  — #ref / #referencia
//  5. .person     — #persona / #person
//  6. .day        — node.isDiaryEntry
//  7. .temporal   — extraData.temporalType != null
//  8. .event      — node.isEvent
//  9. .task       — node.status != null
// 10. .note       — fallback

import type { Node } from '../types'

export type InferredKind =
  | 'person' | 'meeting' | 'book' | 'decision' | 'reference'
  | 'event' | 'task' | 'day' | 'temporal' | 'note'

export interface InferredObject {
  kind: InferredKind
  label: string
  icon: string
  color: string
}

const KIND_META: Record<InferredKind, Omit<InferredObject, 'kind'>> = {
  person:    { label: 'persona',    icon: '👤', color: '#3389d9' },
  meeting:   { label: 'reunión',    icon: '🧑‍🤝‍🧑', color: '#8c5ce5' },
  book:      { label: 'libro',      icon: '📚', color: '#996640' },
  decision:  { label: 'decisión',   icon: '✅', color: '#33a680' },
  reference: { label: 'referencia', icon: '🔖', color: '#7280a6' },
  event:     { label: 'evento',     icon: '📅', color: '#e566a6' },
  task:      { label: 'tarea',      icon: '☑',  color: '#4080f2' },
  day:       { label: 'día',        icon: '☀',  color: '#ff9919' },
  temporal:  { label: 'temporal',   icon: '🗓', color: '#888888' },
  note:      { label: 'nota',       icon: '📄', color: '#888888' },
}

const HASHTAG_PATTERNS: { kind: InferredKind; regex: RegExp }[] = [
  { kind: 'meeting',   regex: /#(?:reunión|reunion|meeting)\b/i },
  { kind: 'book',      regex: /#(?:libro|book)\b/i },
  { kind: 'decision',  regex: /#(?:decisión|decision)\b/i },
  { kind: 'reference', regex: /#(?:referencia|ref)\b/i },
  { kind: 'person',    regex: /#(?:persona|person)\b/i },
]

export function inferNodeObject(node: Node): InferredObject {
  const text = node.text || ''
  // 1-5: hashtags
  for (const { kind, regex } of HASHTAG_PATTERNS) {
    if (regex.test(text)) return { kind, ...KIND_META[kind] }
  }
  // 6: diary
  if (node.isDiaryEntry) return { kind: 'day', ...KIND_META.day }
  // 7: temporal
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed.temporalType) return { kind: 'temporal', ...KIND_META.temporal }
  } catch { /* ignore */ }
  // 8: event
  if (node.isEvent) return { kind: 'event', ...KIND_META.event }
  // 9: task
  if (node.status != null) return { kind: 'task', ...KIND_META.task }
  // 10: note
  return { kind: 'note', ...KIND_META.note }
}

export function inferredObjectFor(kind: InferredKind): InferredObject {
  return { kind, ...KIND_META[kind] }
}
