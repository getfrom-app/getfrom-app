// captureHelper — lógica compartida de creación de nodos desde texto libre.
//
// Extraída de UnifiedCapture.saveAndClose para reutilizarla desde:
//  - la ventana de captura (UnifiedCapture)
//  - la ventana flotante "capture" del Mac (tray / icono barra de menús)
//  - el deep-link silencioso from://capture?text=…&silent=1 (Atajo de Apple)
//
// NO toca la UI: no hace toast, ni navega, ni cierra modales. El llamador decide.
// Sí sincroniza (store.sync) salvo que se pida lo contrario.

import { store } from '../store/nodeStore'
import { getTodayDiaryUnderAgenda } from './agendaHelper'

// El tipo Node no se exporta desde nodeStore; lo derivamos de createNode.
type Node = ReturnType<typeof store.createNode>

import { extractDateFromEnd, recurrenceToString } from './naturalDate'
import { buildTaskVerbRegex } from '../store/predictionStore'

export type ForceType = 'task' | 'event' | 'note' | 'bucle' | null

const FORCE_SHORTCUTS: Record<string, Exclude<ForceType, null>> = {
  '-t': 'task', '-e': 'event', '-n': 'note', '-b': 'bucle',
}

function normalizeNFD(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Detecta el tipo forzado por shortcut inline (-t/-e/-n/-b o "bucle" al final). */
export function detectForceType(t: string): { forceType: ForceType; cleanText: string } {
  const trimmed = t.trimEnd()
  for (const [shortcut, type] of Object.entries(FORCE_SHORTCUTS)) {
    if (trimmed.endsWith(' ' + shortcut) || trimmed === shortcut) {
      return { forceType: type, cleanText: trimmed.slice(0, -shortcut.length).trimEnd() }
    }
  }
  if (/\s+bucle$/i.test(trimmed) || /^bucle$/i.test(trimmed)) {
    const clean = trimmed.replace(/\s*bucle$/i, '').trim()
    return { forceType: 'bucle', cleanText: clean }
  }
  return { forceType: null, cleanText: t }
}

export interface CreateFromTextOpts {
  /** Contextos asignados como chips (sin @ en el texto). */
  assignedCtx?: { slug?: string | null }[]
  /** Fallback de tipo cuando el shortcut ya se eliminó del texto (UI). */
  forceTypeLock?: ForceType
  /** Pista de la predicción de tarea de la UI. */
  taskPredictionHint?: boolean
  /** Si false, no llama a store.sync (raro; por defecto sincroniza). */
  sync?: boolean
}

export interface CreateFromTextResult {
  node: Node
  type: 'task' | 'event' | 'note' | 'bucle'
}

/**
 * Crea un nodo en la nota diaria a partir de texto libre, aplicando:
 * tipo forzado, detección de tarea/evento, fecha natural al final,
 * recurrencia y contextos (chips + @menciones).
 *
 * Devuelve el nodo creado y su tipo, o null si el texto está vacío.
 */
export function createNodeFromText(rawTextInput: string, opts: CreateFromTextOpts = {}): CreateFromTextResult | null {
  const rawText = rawTextInput.trim()
  if (!rawText) return null
  if (store.atFreeNodeLimit()) return null  // free: bloquea al llegar a 1.000 nodos + muestra paywall

  const today = getTodayDiaryUnderAgenda()
  const sibs = store.children(today.id)
  const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(s => s.siblingOrder)) : 0

  const { forceType: ft, cleanText: afterForce } = detectForceType(rawText)
  const effective = ft ?? opts.forceTypeLock ?? null
  const effectiveText = effective ? afterForce : rawText

  const dp = extractDateFromEnd(effectiveText)
  const cleanText = dp ? dp.cleanText : effectiveText
  const isBucle = effective === 'bucle'
  const isTask = !isBucle && (
    effective === 'task' ||
    (effective !== 'note' && effective !== 'event' &&
      ((opts.taskPredictionHint ?? false) || (dp !== null && buildTaskVerbRegex().test(normalizeNFD(effectiveText)))))
  )
  const isEvent = effective === 'event'

  const types: string[] = []
  if (isBucle) types.push('bucle')
  for (const ctx of opts.assignedCtx ?? []) {
    if (ctx.slug && !types.includes(ctx.slug)) types.push(ctx.slug)
  }
  const atMentions = rawText.match(/@([\wÀ-ɏ\-]+)/g)
  if (atMentions) {
    for (const m of atMentions) {
      const slug = m.slice(1).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-').replace(/[^a-z0-9\-/]/g, '')
      if (slug && !types.includes(slug)) types.push(slug)
    }
  }

  const node = store.createNode({
    text: cleanText.trim(),
    parentId: today.id,
    siblingOrder: lastOrder + 1000,
    ...(isTask ? { isTask: true } : {}),
    ...(types.length > 0 ? { types } : {}),
  })

  if (dp?.parsed.date) {
    const updates: Record<string, unknown> = {}
    if (dp.timeStr || isEvent) {
      const [h, m] = (dp.timeStr || '00:00').split(':').map(Number)
      const d = new Date(dp.parsed.date)
      d.setHours(h, m, 0, 0)
      updates.due = d.toISOString()
      updates.isEvent = true
    } else {
      updates.due = dp.parsed.date.toISOString()
      if (isTask) updates.status = 'pending'
    }
    if (dp.parsed.recurrence) {
      updates.recurrence = recurrenceToString(dp.parsed.recurrence)
    }
    store.updateNode(node.id, updates)
  } else if (isEvent) {
    store.updateNode(node.id, { isEvent: true })
  } else if (isTask) {
    store.updateNode(node.id, { status: 'pending' })
  }

  if (opts.sync !== false) store.sync(true).catch(() => {})

  const type: CreateFromTextResult['type'] = isEvent ? 'event' : isBucle ? 'bucle' : isTask ? 'task' : 'note'
  return { node, type }
}

/** Etiqueta legible (i18n-friendly fallback) para el tipo creado. */
export function labelForType(type: CreateFromTextResult['type']): string {
  switch (type) {
    case 'event': return 'Evento'
    case 'bucle': return 'Bucle'
    case 'task': return 'Tarea'
    default: return 'Nota'
  }
}
