import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store, nodeMeta } from '../../store/nodeStore'
import { useGlobalSelection, toggleNodeSelection, clearGlobalSelection, getGlobalSelectedIds, openSelectionMenu } from './Outliner'
import type { Node } from '../../types'
import { ensureDayPath, getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import { CONTEXT_KNOWLEDGE, isContextKnowledge } from '../../utils/knowledgeNodes'
import InlineRenderer, { detectBlockType, renderInlineToHtml } from './InlineRenderer'
import { unfurlUrl, isUrl } from '../../api/unfurl'
import SlashMenu, { type SlashSelectPayload } from './SlashMenu'
import { includesNormalized } from '../../utils/normalize'
import TemplateCodePicker from './TemplateCodePicker'
import NodeTableView from '../views/NodeTableView'
import NodeKanbanView from '../views/NodeKanbanView'
import NodeCalendarView from '../views/NodeCalendarView'
import NodeContextMenu from './NodeContextMenu'
import FormatToolbar from './FormatToolbar'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'
import { updateCalendarEvent, createCalendarEvent, fromRecToRRule } from '../../api/googleCalendar'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO } from '../../utils/dates'
import { ensureTagInTree } from '../../utils/tagsHelper'
import { findContextRoot } from '../../utils/rootLookup'
import { isInPapelera } from '../../utils/papeleraHelper'
import { nextRecurrence, extractDateFromEnd, recurrenceFromString, recurrenceToString } from '../../utils/naturalDate'
import type { RecurrenceConfig, DateExtraction } from '../../utils/naturalDate'
import { buildTaskVerbRegex } from '../../store/predictionStore'
import AutoContextBadge, { ContextPlaceholderBadge } from './AutoContextBadge'
import { scheduleClassify, cancelClassify, getCachedClassify, extractUserKnowledge, extractContextKnowledge, buildClassifyContexts, type ClassifyResult } from '../../api/autoClassify'
import { saveUserKnowledgeToProfile } from '../../api/userKnowledge'

// Deduplicación de extracción de conocimiento entre desmonte/remonte del componente.
// Set a nivel de módulo: persiste mientras el JS bundle esté cargado (toda la sesión).
const extractedKnowledgeNodes = new Set<string>()

// Timers pendientes de actualización de "Lo que From sabe" por contextId.
// Garantiza un único timer por contexto — si varios nodos se clasifican en el mismo contexto
// en <5 min, solo se dispara una actualización al final.
const contextKnowledgePendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
// Timestamps de la última actualización por contextId (cooldown 5 min).
const contextKnowledgeLastUpdate = new Map<string, number>()

// ── Smart Dates ───────────────────────────────────────────────────────────────
function parseInlineDate(text: string): { text: string; due: string | null } {
  const now = new Date()
  const patterns: Array<{ regex: RegExp; getDate: (m: RegExpMatchArray | null) => Date }> = [
    {
      regex: /\s+@hoy\b/i,
      getDate: () => { const d = new Date(now); d.setHours(23, 59, 0, 0); return d },
    },
    {
      regex: /\s+@mañana\b/i,
      getDate: () => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d },
    },
    {
      regex: /\s+@lunes\b/i,
      getDate: () => {
        const d = new Date(now)
        const day = d.getDay()
        const diff = day === 0 ? 1 : day === 1 ? 7 : 8 - day
        d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d
      },
    },
    {
      regex: /\s+@martes\b/i,
      getDate: () => {
        const d = new Date(now)
        const day = d.getDay()
        const diff = day < 2 ? 2 - day : 9 - day
        d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d
      },
    },
    {
      regex: /\s+@miércoles\b/i,
      getDate: () => {
        const d = new Date(now)
        const day = d.getDay()
        const diff = day < 3 ? 3 - day : 10 - day
        d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d
      },
    },
    {
      regex: /\s+@jueves\b/i,
      getDate: () => {
        const d = new Date(now)
        const day = d.getDay()
        const diff = day < 4 ? 4 - day : 11 - day
        d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d
      },
    },
    {
      regex: /\s+@viernes\b/i,
      getDate: () => {
        const d = new Date(now)
        const day = d.getDay()
        const diff = day < 5 ? 5 - day : 12 - day
        d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d
      },
    },
    {
      // @14:30 — hora específica de hoy
      regex: /\s+@(\d{1,2}):(\d{2})\b/,
      getDate: (m) => {
        const d = new Date(now)
        if (m) { d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0) }
        return d
      },
    },
    {
      // @dd/mm o @dd/mm/yyyy
      regex: /\s+@(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/,
      getDate: (m) => {
        if (!m) return now
        const d = new Date(parseInt(m[3] || String(now.getFullYear())), parseInt(m[2]) - 1, parseInt(m[1]))
        d.setHours(9, 0, 0, 0)
        return d
      },
    },
  ]

  for (const { regex, getDate } of patterns) {
    const m = text.match(regex)
    if (m) {
      const cleanText = text.replace(regex, '').trim()
      return { text: cleanText, due: getDate(m).toISOString() }
    }
  }
  return { text, due: null }
}

interface Props {
  node: Node
  depth: number
  isSelected: boolean
  selectedId?: string | null  // para propagar isSelected a nodos hijos
  isMultiSelected?: boolean
  onSelect: (id: string) => void
  onSelectNext: (id: string, dir: 'up' | 'down') => void
  onShiftSelect?: (id: string) => void
  filterText?: string
  highlightText?: string  // resalta coincidencias (subrayado amarillo) SIN ocultar hijos no coincidentes
  filterMatchIds?: Set<string>    // WF smart filter — IDs que coinciden
  filterAncestorIds?: Set<string> // ancestros de nodos coincidentes (precomputado, evita getAllDescendants)
  isFirstEmpty?: boolean  // primer nodo de nota vacía — muestra placeholder siempre
  flat?: boolean  // modo virtualizado: la lista plana ya monta los hijos → este nodo NO los renderiza
}

const COMMON_TYPES = [
  'tarea', 'proyecto', 'área', 'referencia', 'evento', 'nota',
  'reunión', 'idea', 'decisión', 'lectura', 'apuntes', 'recurso',
  'pendiente', 'importante', 'trabajo', 'personal',
]

// ── Context usage tracking (in-memory, resets on page load) ──────────────────
const _ctxUsageCount = new Map<string, number>()
export function recordCtxUsage(slug: string) {
  _ctxUsageCount.set(slug, (_ctxUsageCount.get(slug) || 0) + 1)
}

interface PickerItem {
  id: string
  label: string
  // Extra metadata shown only for @ mentions
  status?: string | null
  types?: string[]
  bodyPreview?: string
  group?: 'context' | 'note'  // para @ picker con dos secciones
  isNote?: boolean            // nota (tiene hijos) vs párrafo (hoja)
}

interface InlinePicker {
  type: '@' | 'mirror' | 'move'
  query: string
  items: PickerItem[]
  activeIdx: number
}

/** Animación "fly to filter": el elemento fuente vuela hasta la barra de filtro */
function flyToFilter(sourceEl: HTMLElement, filterQuery: string) {
  const filterInput = document.querySelector('.wf-topbar-filter-input') as HTMLElement | null
  const srcRect = sourceEl.getBoundingClientRect()

  // Crear clon flotante en posición exacta del elemento original
  const clone = sourceEl.cloneNode(true) as HTMLElement
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${srcRect.left}px`,
    top: `${srcRect.top}px`,
    width: `${srcRect.width}px`,
    height: `${srcRect.height}px`,
    margin: '0',
    zIndex: '9999',
    pointerEvents: 'none',
    transition: 'left 280ms cubic-bezier(0.4,0,0.2,1), top 280ms cubic-bezier(0.4,0,0.2,1), transform 280ms, opacity 280ms',
    transformOrigin: 'left center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    // Aplicar mismo estilo visible
    color: '#7c3aed',
    fontSize: '0.8em',
    fontWeight: '500',
    borderBottom: '1px dashed rgba(124,58,237,0.5)',
    padding: '0 2px',
    background: 'transparent',
  })
  document.body.appendChild(clone)

  const dstRect = filterInput
    ? filterInput.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: 8, width: 120, height: 28 }

  // Forzar layout antes de animar
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      Object.assign(clone.style, {
        left: `${dstRect.left + dstRect.width * 0.1}px`,
        top: `${dstRect.top + (dstRect.height - srcRect.height) / 2}px`,
        transform: 'scale(0.7)',
        opacity: '0',
      })
    })
  })

  setTimeout(() => {
    clone.remove()
    // Disparar el filtro
    window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: filterQuery }))
    // Flash en la barra de filtro para feedback visual
    if (filterInput) {
      const filterBar = filterInput.closest('.wf-topbar-filter') as HTMLElement | null
      if (filterBar) {
        filterBar.classList.add('filter-flash')
        setTimeout(() => filterBar.classList.remove('filter-flash'), 400)
      }
      filterInput.focus()
    }
  }, 300)
}

function getCaretPosition(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
  return range.toString().length
}

function getCursorRect(el: HTMLElement): DOMRect {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) return rect
  }
  return el.getBoundingClientRect()
}

// Module-level drag state (shared across all OutlinerNode instances)
let _draggedNodeId: string | null = null
let _draggedNodeIds: string[] = []  // todos los nodos arrastrados (multi-select), ordenados visualmente
let _dropAsChild = false // true cuando el drop debe hacer al nodo arrastrado hijo del destino

/** Exportado: IDs que se están arrastrando actualmente (vacío si no hay drag activo) */
export function getDraggedIds(): string[] { return _draggedNodeIds }
/** Exportado: ID del nodo arrastrado (o null) */
export function getDraggedId(): string | null { return _draggedNodeId }

function getAllDescendants(nodeId: string): string[] {
  const result: string[] = []
  const queue = [nodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const children = store.children(id)
    for (const child of children) {
      result.push(child.id)
      queue.push(child.id)
    }
  }
  return result
}

export default function OutlinerNode({ node, depth, isSelected, selectedId, isMultiSelected: _isMultiSelectedProp, onSelect, onSelectNext, onShiftSelect, filterText, highlightText, filterMatchIds, filterAncestorIds, isFirstEmpty, flat }: Props) {
  const navigate = useNavigate()
  // Cada nodo calcula su propio estado de multi-selección desde el estado global,
  // en lugar de heredar el boolean del padre. Esto permite seleccionar nodos
  // en distintos niveles de jerarquía con drag-to-select.
  const globalSelectedIds = useGlobalSelection()
  const isMultiSelected = globalSelectedIds.has(node.id)
  const contentRef = useRef<HTMLDivElement>(null)
  // Ref siempre actualizado con el texto más reciente — evita stale closure en handleFocus
  const nodeTextRef = useRef(node.text)
  nodeTextRef.current = node.text
  // Captura posición de clic antes de que handleFocus reemplace innerHTML con textContent
  const pendingCursorPosRef = useRef<number | null>(null)
  // Cuando el foco viene de un clic (no de teclado), impide que el useEffect de isSelected
  // sobreescriba la posición del cursor que handleFocus acaba de restaurar.
  const skipIsSelectedCursorRef = useRef(false)
  const children = store.children(node.id)
  // Colapsado — cuando hay filtro activo y este nodo tiene descendientes que coinciden,
  // forzamos la expansión para que el usuario vea los resultados aunque estuviera colapsado.
  const isCollapsed = ((node.isCollapsed !== false) && children.length > 0)
  const [isEditing, setIsEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [datePrediction, setDatePrediction] = useState<DateExtraction | null>(null)
  // Predicción de pizarra — el texto es exactamente "pizarra"
  const [whiteboardPrediction, setWhiteboardPrediction] = useState(false)
  // Predicción de tarea — el texto empieza por un verbo de acción
  const [taskPrediction, setTaskPrediction] = useState(false)
  // Animación "checkbox aparece" cuando el nodo se convierte en tarea
  const [taskConverting, setTaskConverting] = useState(false)
  const prevStatusRef = useRef<string | null | undefined>(node.status)
  // Autocompletado de contextos — detecta nombres de 🧠 Contexto mientras escribes
  const [ctxCompletion, setCtxCompletion] = useState<{
    slug: string; displayName: string; typedLen: number; ghost: string
  } | null>(null)
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [showCodePicker, setShowCodePicker] = useState(false)
  const [codeQuery, setCodeQuery] = useState('')
  const [picker, setPicker] = useState<InlinePicker | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  // Auto-clasificación de contexto — badge sutil con sugerencia IA
  const [autoCtxResult, setAutoCtxResult] = useState<ClassifyResult | null>(() => {
    // 1. Primero: caché en memoria de la sesión actual (más reciente)
    const cached = getCachedClassify(node.id)
    if (cached) return cached
    // 2. Fallback: extraData persistido (sobrevive desmonte/remonte y recargas)
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._autoContextId !== undefined) {
        return {
          contextId: ed._autoContextId || null,
          confidence: typeof ed._autoContextConfidence === 'number' ? ed._autoContextConfidence : 0,
        }
      }
    } catch { /* ignore */ }
    return null
  })
  // Guard: solo disparar scheduleClassify si el usuario ha editado este nodo en la sesión actual.
  // Evita que al montar 160 nodos en la vista "Sin clasificar" se disparen 160 clasificaciones simultáneas.
  const hasUserEditedRef = useRef(false)
  // Guard: solo extraer conocimiento del usuario una vez por nodo por sesión.
  const hasExtractedUserKnowledgeRef = useRef(false)
  // Timer de debounce para la extracción de conocimiento del usuario (5s).
  const extractUserKnowledgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lógica de extracción de conocimiento extraída como función independiente.
  // Se puede llamar fire-and-forget incluso después del desmonte del componente,
  // porque store es un singleton de Zustand que persiste mientras el bundle esté cargado.
  const doExtractUserKnowledge = useCallback(async (text: string, nodeId: string) => {
    // Deduplicación: no procesar el mismo nodo dos veces en la misma sesión
    if (hasExtractedUserKnowledgeRef.current || extractedKnowledgeNodes.has(nodeId)) return
    if (text.trim().length < 15) return
    extractedKnowledgeNodes.add(nodeId)
    hasExtractedUserKnowledgeRef.current = true
    try {
      const perfilNode = store.perfilIANode?.() ?? null
      const existingProfileLines: string[] = perfilNode
        ? store.children(perfilNode.id)
            .filter(n => !n.deletedAt && (n.text || '').trim().length > 3)
            .slice(0, 50)
            .map(n => (n.text || '').trim())
        : []
      const existingProfile = existingProfileLines.join('. ')
      // Enrutado: si el nodo está dentro de un contexto, solo extraer lo GLOBAL.
      const contextName = store.primaryContextName(nodeId)
      const knowledge = await extractUserKnowledge(text.trim(), existingProfile || undefined, contextName)
      if (!knowledge) return
      await saveUserKnowledgeToProfile(knowledge.people, knowledge.facts)
    } catch { /* silencioso */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup del timer de extracción de conocimiento al desmontar el nodo.
  // IMPORTANTE: si había un timer pendiente al desmontar (p.ej. navegación, remount rápido,
  // nodo creado por agente), lo cancelamos pero disparamos la extracción fire-and-forget.
  // store es singleton — puede usarse después del desmonte sin problema.
  useEffect(() => {
    return () => {
      if (extractUserKnowledgeTimerRef.current) {
        clearTimeout(extractUserKnowledgeTimerRef.current)
        extractUserKnowledgeTimerRef.current = null
        // Fire-and-forget: capturamos node.id y node.text del closure del efecto de montaje.
        // El texto actual se lee desde store para evitar stale closure.
        const currentNode = store.getNode(node.id)
        const text = (currentNode?.text || node.text || '').trim()
        doExtractUserKnowledge(text, node.id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dispara la actualización de "Lo que From sabe" del contexto dado.
  // Fire-and-forget: no bloquea el UI.
  // Usa el nodo actual + sus hijos directos como nueva información a aprender,
  // y el conocimiento existente en "🧠 Lo que From sabe" para deduplicar.
  const doTriggerContextKnowledgeUpdate = useCallback(async (contextId: string) => {
    const ctxNode = store.getNode(contextId)
    if (!ctxNode || ctxNode.deletedAt) return
    try {
      // 1. Recoger el nodo actual + sus hijos directos (hasta 30) como nueva información
      const newSamples: string[] = [
        (node.text || '').trim(),
        ...store.children(node.id).filter(c => !c.deletedAt).slice(0, 30).map(c => (c.text || '').trim()),
      ].filter(s => s.length > 2)
      if (newSamples.length === 0) return

      // 2. Leer conocimiento existente en "🧠 Lo que From sabe" para deduplicar
      const KNOWLEDGE_NODE_TEXT = CONTEXT_KNOWLEDGE  // Fase 1: crea viejo; reconoce ambos
      const existingKnowledgeNode = store.children(contextId).find(n => !n.deletedAt && isContextKnowledge(n.text))
      const existingKnowledge = existingKnowledgeNode
        ? store.children(existingKnowledgeNode.id).filter(n => !n.deletedAt).map(n => n.text || '').join('. ')
        : ''

      // 3. Llamar a la IA pasando newSamples y existingKnowledge para deduplicar
      const knowledge = await extractContextKnowledge(ctxNode.text || '', existingKnowledge, newSamples)

      // 4. Si no hay nada nuevo, no tocar el árbol
      if (knowledge.keywords.length === 0 && knowledge.people.length === 0 && knowledge.topics.length === 0) {
        contextKnowledgeLastUpdate.set(contextId, Date.now())
        return
      }

      // 5. Obtener o crear el nodo "🧠 Lo que From sabe"
      let knowledgeNodeId: string
      if (existingKnowledgeNode) {
        knowledgeNodeId = existingKnowledgeNode.id
      } else {
        const allSibs = store.children(contextId).filter(n => !n.deletedAt)
        const maxOrder = allSibs.length > 0 ? Math.max(...allSibs.map(c => c.siblingOrder)) : 0
        const newNode = store.createNode({ text: KNOWLEDGE_NODE_TEXT, parentId: contextId, siblingOrder: maxOrder + 1000 })
        knowledgeNodeId = newNode.id
      }

      // 6. Fusionar nueva información con lo ya existente (append, no reemplazar)
      const existingChildren = store.children(knowledgeNodeId).filter(n => !n.deletedAt)
      let maxOrder = existingChildren.length > 0 ? Math.max(...existingChildren.map(c => c.siblingOrder)) : 0

      const PREFIXES: Array<{ prefix: string; key: keyof typeof knowledge }> = [
        { prefix: 'Palabras clave:', key: 'keywords' },
        { prefix: 'Personas:', key: 'people' },
        { prefix: 'Temas frecuentes:', key: 'topics' },
      ]
      for (const { prefix, key } of PREFIXES) {
        const newItems = knowledge[key] as string[]
        if (newItems.length === 0) continue
        const existingNode = existingChildren.find(n => (n.text || '').startsWith(prefix))
        if (existingNode) {
          // Extraer items ya presentes y añadir solo los nuevos
          const currentText = existingNode.text || ''
          const currentItems = currentText.replace(prefix, '').split(',').map(s => s.trim()).filter(s => s && s !== '—')
          const merged = [...currentItems]
          for (const item of newItems) {
            if (!merged.some(existing => existing.toLowerCase() === item.toLowerCase())) {
              merged.push(item)
            }
          }
          store.updateNode(existingNode.id, { text: `${prefix} ${merged.join(', ')}` })
        } else {
          maxOrder += 1000
          store.createNode({ text: `${prefix} ${newItems.join(', ')}`, parentId: knowledgeNodeId, siblingOrder: maxOrder })
        }
      }

      // 7. Registrar timestamp en Map local (evita re-renders)
      contextKnowledgeLastUpdate.set(contextId, Date.now())
    } catch { /* silencioso */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.text])

  // Determina si el nodo ya tiene contexto asignado manualmente
  // (bien vía badge de corrección, bien vía @mention en el texto)
  const nodeHasManualContext = useMemo(() => {
    // 1. Flag explícito en extraData
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._contextManuallySet === '1') return true
    } catch { /* ignore */ }
    // 2. ¿El nodo tiene @mentions de contexto en el texto?
    if (/@\w/.test(node.text || '')) return true
    // 3. ¿El nodo tiene user-tags en types[] (contextos del árbol)?
    const builtinTags = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota','bucle'])
    const userTypes = (node.types || []).filter(t => !builtinTags.has(t))
    if (userTypes.length > 0) return true
    return false
  }, [node.types, node.extraData, node.text])

  // ID del contexto asignado al nodo (via badge o cualquier flujo que añade user-types[]).
  // Cubre dos casos:
  //   1. _contextManuallySet=1 en extraData (asignado via badge en v9.6.82+)
  //   2. userTypes.length > 0 sin el flag (asignado por flujos anteriores: drag-to-context, etc.)
  // @mentions de texto no generan badge — el texto ya lo muestra visualmente.
  const manuallySetContextId = useMemo(() => {
    const builtinTags = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])
    const userTypes = (node.types || []).filter(t => !builtinTags.has(t))
    if (userTypes.length === 0) return null
    // Solo mostrar badge si el contexto viene de una asignación explícita (no @mention en texto)
    // → _contextManuallySet=1 (badge v9.6.82+) O userTypes presente (flujos anteriores)
    // Excluir si el único "contexto" es un @mention en el texto (no aparece en types[] normalmente,
    // pero nodeHasManualContext ya lo detecta vía /@\w/.test — aquí buscamos en types[])
    const tagsRoot = findContextRoot()
    if (!tagsRoot) return null
    const contextNodes = store.children(tagsRoot.id).filter(n => !n.deletedAt)
    for (const typeName of userTypes) {
      const ctxNode = contextNodes.find(n => n.text === typeName)
      if (ctxNode) return ctxNode.id
    }
    return null
  }, [node.types, node.extraData])

  // Cuando se asigna un contexto a este nodo (IA o manual), disparar la actualización
  // de "Lo que From sabe" para ese contexto con debounce de 5 min por contextId.
  // Esto mantiene el conocimiento del contexto actualizado sin que el usuario tenga que abrirlo.
  const effectiveContextId = autoCtxResult?.contextId ?? manuallySetContextId ?? null
  useEffect(() => {
    if (!effectiveContextId) return
    // Cooldown: no programar si ya se actualizó en los últimos 5 minutos
    const fiveMinutes = 5 * 60 * 1000
    const lastUpdate = contextKnowledgeLastUpdate.get(effectiveContextId) ?? 0
    if (Date.now() - lastUpdate < fiveMinutes) return
    // Cancelar timer anterior para este contexto (deduplicación entre nodos)
    const existing = contextKnowledgePendingTimers.get(effectiveContextId)
    if (existing) clearTimeout(existing)
    // Programar actualización en 5 minutos — si más nodos se clasifican en el mismo contexto
    // antes de que expire, el timer se reinicia y solo se lanza una vez al final.
    const timer = setTimeout(() => {
      contextKnowledgePendingTimers.delete(effectiveContextId)
      doTriggerContextKnowledgeUpdate(effectiveContextId)
    }, fiveMinutes)
    contextKnowledgePendingTimers.set(effectiveContextId, timer)
    // No cancelamos el timer al desmontar — queremos que se ejecute aunque este nodo
    // se desmonte. El Map persiste a nivel de módulo durante toda la sesión.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveContextId])

  // Determina si el nodo ES un contexto (hijo directo de 🧠 Contexto).
  // Los contextos no deben mostrar badge de contexto — no tiene sentido preguntar
  // "¿en qué contexto está este contexto?".
  const isContextNode = useMemo(() => {
    const tagsRoot = findContextRoot()
    if (!tagsRoot) return false
    return node.parentId === tagsRoot.id
  }, [node.parentId])

  // Comprueba si el nodo está dentro de una estructura restringida donde no tiene
  // sentido clasificar ni mostrar badge:
  //   1. Dentro de un nodo de contexto (hijo de 🧠 Contexto)
  //   2. Dentro del nodo de perfil (_perfilIA === '1')
  //   3. Dentro de la Papelera
  // NOTA: La Agenda NO está bloqueada — el usuario escribe contenido real en el diario
  // que sí debe clasificarse. Solo bloqueamos los nodos de contexto y perfil porque
  // ya tienen su contexto implícito por posición.
  const isInsideRestrictedAncestor = useMemo(() => {
    const contextoRoot = findContextRoot()
    // Raíces de sistema FUERA de Agenda: ni ellas ni sus subárboles se clasifican
    // ni muestran chip de contexto. (Agenda y 🏠 From NO están aquí a propósito.)
    const NON_AGENDA_ROOTS = new Set(['📋 Plantillas','⚡ Prompts','🤖 Agentes','📊 Paneles','🔍 Filtros','🗑 Papelera'])

    // Empezar por el PROPIO nodo (para cubrir las raíces de sistema en sí mismas).
    let cur = store.getNode(node.id)
    let depth = 0
    while (cur && depth < 10) {
      try {
        const ed = JSON.parse(cur.extraData || '{}')
        if (ed._perfilIA === '1') return true
      } catch { /* ignore */ }
      if (contextoRoot && cur.id === contextoRoot.id) return true
      if (NON_AGENDA_ROOTS.has((cur.text || '').trim())) return true
      if (!cur.parentId) break
      cur = store.getNode(cur.parentId)
      depth++
    }
    return false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.parentId, node.text])

  // Comprueba si el nodo está dentro de estructuras donde NO debe extraerse conocimiento del usuario.
  // Igual que isInsideRestrictedAncestor EXCEPTO que la Agenda no bloquea:
  // los nodos escritos por el usuario dentro del diario SÍ alimentan el perfil IA.
  // Solo bloqueamos: contextos, perfil IA, papelera.
  const isInsideKnowledgeRestricted = useMemo(() => {
    const contextoRoot = findContextRoot()

    let cur = store.getNode(node.parentId ?? '')
    let depth = 0
    while (cur && depth < 6) {
      try {
        const ed = JSON.parse(cur.extraData || '{}')
        if (ed._perfilIA === '1') return true
      } catch { /* ignore */ }
      if (contextoRoot && cur.id === contextoRoot.id) return true
      if ((cur.text || '') === '🗑 Papelera') return true
      cur = store.getNode(cur.parentId ?? '')
      depth++
    }
    return false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.parentId])

  // ── Ancla de contexto ───────────────────────────────────────────────────────
  // Un nodo es "ancla" (muestra chip "+ Contexto" y se autoclasifica) solo si:
  //   · está por debajo de un día de la agenda (tiene ancestro diary), y
  //   · NO es un heading (los headings se tratan como párrafo: heredan, no llevan contexto), y
  //   · es hijo directo de un día (cada tema del diario)  O  tiene hijos (sección/contenedor).
  // Todo lo demás —texto plano, headings, hojas sueltas— hereda el contexto de su
  // ancestro y no muestra chip. El usuario siempre puede asignar contexto manualmente
  // desde el menú contextual (override), aunque el nodo no sea ancla.
  const isContextAnchor = useMemo(() => {
    if (isContextNode || isInsideRestrictedAncestor) return false
    // Headings = párrafo: nunca anclan contexto
    const bt = detectBlockType(node.text || '')
    if (bt === 'h1' || bt === 'h2' || bt === 'h3') return false
    // Buscar ancestro día (diary entry). El padre inmediato siendo diary ⇒ hijo directo del día.
    let cur = store.getNode(node.parentId ?? '')
    let parentIsDay = false
    let hasDayAncestor = false
    let depth = 0
    while (cur && depth < 12) {
      if (cur.isDiaryEntry) {
        hasDayAncestor = true
        if (depth === 0) parentIsDay = true
        break
      }
      cur = store.getNode(cur.parentId ?? '')
      depth++
    }
    if (!hasDayAncestor) return false
    const hasChildren = children.some(c => !c.deletedAt)
    return parentIsDay || hasChildren
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.parentId, node.text, isContextNode, isInsideRestrictedAncestor, children.length])

  // Debounce sobre node.text — dispara extractUserKnowledge si el texto lleva 5s
  // estable (sin cambios) y cumple los criterios. Cubre nodos sin interacción directa.
  // Si el componente se desmonta antes de que expire el timer (navegación, remount rápido,
  // nodo creado por agente), el cleanup cancela el timer Y dispara la extracción fire-and-forget
  // usando doExtractUserKnowledge (ver useEffect de cleanup más arriba).
  useEffect(() => {
    if (hasExtractedUserKnowledgeRef.current) return
    // Para extractUserKnowledge usamos isInsideKnowledgeRestricted (no bloquea Agenda)
    // porque los nodos escritos dentro del diario SÍ deben alimentar el perfil IA.
    if (isInsideKnowledgeRestricted) return
    const text = (node.text || '').trim()
    if (text.length < 15) return
    if (node.isDiaryEntry) return
    // Reiniciar el timer — solo disparar tras 5s de estabilidad
    if (extractUserKnowledgeTimerRef.current) {
      clearTimeout(extractUserKnowledgeTimerRef.current)
    }
    extractUserKnowledgeTimerRef.current = setTimeout(() => {
      extractUserKnowledgeTimerRef.current = null
      doExtractUserKnowledge(text, node.id)
    }, 5_000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.text, node.isDiaryEntry, isInsideKnowledgeRestricted])

  // Al montar: si el nodo no tiene _autoContextId en extraData (nunca clasificado o badge perdido
  // por desmonte/remonte), disparar clasificación con delay largo (3000ms) para no saturar.
  // Esto cubre el caso: usuario crea nodo → escribe → Enter (desmonte) → remonte sin clasificar.
  // El delay evita el freeze: no dispara para nodos ya clasificados (tienen _autoContextId en extraData).
  useEffect(() => {
    // Solo para nodos sin clasificación persistida en extraData
    let hasPersistedAutoCtx = false
    try {
      const ed = JSON.parse(node.extraData || '{}')
      hasPersistedAutoCtx = ed._autoContextId !== undefined
    } catch { /* ignore */ }
    if (hasPersistedAutoCtx) return

    // No clasificar si el nodo está dentro de una estructura restringida
    if (isInsideRestrictedAncestor) return

    // No disparar para nodos con contexto manual
    if (nodeHasManualContext) return

    // Texto mínimo
    const text = (node.text || '').trim()
    if (!text || text.length < 4) return

    // No disparar para nodos de diario
    if (node.isDiaryEntry) return

    // Solo nodos ancla: hijo directo del día o nodo con hijos (no headings, no hojas sueltas).
    // Los párrafos/headings/hojas heredan el contexto de su ancestro y no se clasifican.
    if (!isContextAnchor) return

    // Obtener contextos disponibles (incl. subcontextos)
    const perfilNode = store.perfilIANode?.() ?? null
    const contexts = buildClassifyContexts(perfilNode?.id)
    if (contexts.length === 0) return

    // Recoger muestras del perfil IA para mejorar la clasificación
    const userProfileSamples: string[] = perfilNode
      ? store.children(perfilNode.id)
          .filter(n => !n.deletedAt && (n.text || '').trim().length > 3)
          .slice(0, 50)
          .map(n => (n.text || '').trim())
      : []

    // Delay largo (3000ms en lugar de 800ms) para no saturar al cargar la vista con múltiples nodos.
    // Una vez clasificado y guardado en extraData, este bloque no vuelve a dispararse (hasPersistedAutoCtx=true).
    scheduleClassify(node.id, text, contexts, (id, result) => {
      if (id !== node.id) return
      setAutoCtxResult(result)
      try {
        const currentNode = store.getNode(node.id)
        const ed = JSON.parse(currentNode?.extraData || node.extraData || '{}')
        ed._autoContextId = result.contextId ?? ''
        ed._autoContextConfidence = result.confidence
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
    }, 3000, userProfileSamples.length > 0 ? userProfileSamples : undefined)
    return () => cancelClassify(node.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Disparar clasificación cuando el nodo cambia de texto y no tiene contexto manual.
  // GUARD: solo se ejecuta si el usuario ha editado el nodo en esta sesión (hasUserEditedRef.current).
  // Esto evita que al montar N nodos en la vista "Sin clasificar" se disparen N clasificaciones
  // simultáneas que congelen el hilo principal. La clasificación de nodos históricos se hace
  // vía el botón "Clasificar todos", no mediante este efecto.
  useEffect(() => {
    // Solo disparar si el usuario ha escrito en este nodo durante la sesión actual
    if (!hasUserEditedRef.current) return
    // No clasificar si el nodo está dentro de una estructura restringida (contexto, perfil, agenda)
    if (isInsideRestrictedAncestor) {
      cancelClassify(node.id)
      return
    }
    // No clasificar nodos especiales o ya clasificados manualmente
    if (nodeHasManualContext) {
      cancelClassify(node.id)
      setAutoCtxResult(null)
      return
    }
    // No clasificar nodos sin texto significativo o nodos sistema
    const text = (node.text || '').trim()
    if (!text || text.length < 4) {
      cancelClassify(node.id)
      setAutoCtxResult(null)
      return
    }
    // No clasificar nodos de diario o dividers
    if (node.isDiaryEntry) {
      cancelClassify(node.id)
      setAutoCtxResult(null)
      return
    }
    // Solo clasificar nodos ancla: hijo directo del día o nodo con hijos.
    // Headings, párrafos y hojas sueltas heredan el contexto de su ancestro — no se clasifican.
    if (!isContextAnchor) {
      cancelClassify(node.id)
      setAutoCtxResult(null)
      return
    }
    // Obtener contextos disponibles del usuario (incl. subcontextos)
    const perfilNodeEdit = store.perfilIANode?.() ?? null
    const contexts = buildClassifyContexts(perfilNodeEdit?.id)
    if (contexts.length === 0) return
    // Recoger muestras del perfil IA para mejorar la clasificación
    const userProfileEdit: string[] | undefined = perfilNodeEdit
      ? store.children(perfilNodeEdit.id)
          .filter(n => !n.deletedAt && (n.text || '').trim().length > 3)
          .slice(0, 50)
          .map(n => (n.text || '').trim())
      : undefined
    scheduleClassify(node.id, text, contexts, (id, result) => {
      if (id !== node.id) return
      setAutoCtxResult(result)
      // Persistir el resultado en extraData para que sobreviva desmonte/remonte
      try {
        const currentNode = store.getNode(node.id)
        const ed = JSON.parse(currentNode?.extraData || node.extraData || '{}')
        ed._autoContextId = result.contextId ?? ''
        ed._autoContextConfidence = result.confidence
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
    }, 800, userProfileEdit?.length ? userProfileEdit : undefined)
    // Si el nodo ya tiene un contexto asignado, re-programar actualización del conocimiento
    // con debounce largo (30 min) para capturar ediciones prolongadas a lo largo del tiempo.
    // El usuario puede seguir editando el nodo durante horas o días — este trigger garantiza
    // que el contexto aprende del nuevo contenido aunque la clasificación ya esté confirmada.
    const ctxIdForUpdate = autoCtxResult?.contextId ?? manuallySetContextId ?? null
    if (ctxIdForUpdate && hasUserEditedRef.current) {
      const existingTimer = contextKnowledgePendingTimers.get(ctxIdForUpdate)
      if (existingTimer) clearTimeout(existingTimer)
      const timer = setTimeout(() => {
        contextKnowledgePendingTimers.delete(ctxIdForUpdate)
        doTriggerContextKnowledgeUpdate(ctxIdForUpdate)
      }, 1_800_000) // 30 minutos
      contextKnowledgePendingTimers.set(ctxIdForUpdate, timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.text, node.status, node.types, nodeHasManualContext, isContextAnchor])

  // Abrir panel de propiedades desde el context menu externo
  useEffect(() => {
    function handleOpenTaskProps(e: Event) {
      const detail = (e as CustomEvent).detail as { nodeId: string }
      if (detail?.nodeId !== node.id) return
      // Abrir el quick props panel centrado en el nodo
      const el = document.querySelector(`[data-node-id="${node.id}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        setQuickPropsPos({ top: rect.bottom + 4, left: rect.left })
        setShowQuickProps(true)
      }
    }
    window.addEventListener('from:open-task-props', handleOpenTaskProps)
    return () => window.removeEventListener('from:open-task-props', handleOpenTaskProps)
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [dateAssignedMsg, setDateAssignedMsg] = useState<string | null>(null)
  // Filter exit animation — delayed hide when node leaves active filter
  // filterExiting: currently playing exit animation
  // filterHidden:  animation complete, node should return null
  const [filterExiting, setFilterExiting] = useState(false)
  const [filterHidden, setFilterHidden] = useState(false)
  const filterExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Quick-props inline popup (fecha/hora/repetición/prioridad)
  const [showQuickProps, setShowQuickProps] = useState(false)
  const [quickPropsPos, setQuickPropsPos] = useState<{ top: number; left: number } | null>(null)
  const quickPropsBtnRef = useRef<HTMLButtonElement>(null)
  const quickPropsPopupRef = useRef<HTMLDivElement>(null)
  // Event badge popup
  const [showEventProp, setShowEventProp] = useState(false)
  const [eventPropPos, setEventPropPos] = useState<{ top: number; left: number } | null>(null)
  const prevIsEventRef = useRef(node.isEvent)
  const eventMountedRef = useRef(false)
  // Auto-open popup SOLO cuando el nodo acaba de convertirse en evento (inline -e o /event),
  // no al montar un nodo que ya era evento (recarga de página).
  useEffect(() => {
    if (!eventMountedRef.current) {
      eventMountedRef.current = true
      prevIsEventRef.current = node.isEvent
      return
    }
    if (node.isEvent && !prevIsEventRef.current) {
      setTimeout(() => {
        if (eventBadgeBtnRef.current) {
          const rect = eventBadgeBtnRef.current.getBoundingClientRect()
          setEventPropPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)) })
          setShowEventProp(true)
        }
      }, 80)
    }
    prevIsEventRef.current = node.isEvent
  }, [node.isEvent]) // eslint-disable-line
  const eventBadgeBtnRef = useRef<HTMLButtonElement>(null)
  const eventBadgePopupRef = useRef<HTMLDivElement>(null)
  const gcalSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Meta typed (color, block, icon, _resource…). Cache por referencia de Node.
  const meta = nodeMeta(node)
  const extraBlock = meta.block

  // Mirror: si este nodo tiene _mirrorOf, usar el nodo original como fuente de texto
  const mirrorOfId = (() => {
    try { return JSON.parse(node.extraData || '{}')._mirrorOf as string | undefined } catch { return undefined }
  })()
  const mirrorSourceNode = mirrorOfId ? store.getNode(mirrorOfId) ?? null : null
  const displayNode = mirrorSourceNode ?? node
  // Label de destino para espejos de tarea movida (ej. "Vie 30 may")
  const mirrorDestLabel = (() => {
    try { return JSON.parse(node.extraData || '{}')._mirrorDestLabel as string | undefined } catch { return undefined }
  })()

  // ctx-ref legacy (ya no se crea, pero puede haber nodos viejos) — ignorar
  const ctxRef = null
  // moved-ref legacy — ignorar (ahora se usan espejos nativos)
  const movedRef = null

  // Para espejos: usar el nodo original como fuente de status/event/due
  // El mirror node en sí tiene status=null, pero queremos mostrar el checkbox del original
  const effectiveNode = mirrorSourceNode ?? node

  const blockType = extraBlock ?? detectBlockType(displayNode.text)
  const isHeading = blockType === 'h1' || blockType === 'h2' || blockType === 'h3'

  // Auto-normalizar nodos con prefijo markdown pero sin extraBlock guardado.
  // Se activa la primera vez que se renderiza el nodo (ej. creados por Claude MCP, pegados).
  // Hace store.updateNode en background — sin bloquear el render.
  useEffect(() => {
    if (extraBlock) return // ya normalizado
    const text = displayNode.text
    const mdMap: Array<[string, string]> = [['### ', 'h3'], ['## ', 'h2'], ['# ', 'h1']]
    for (const [prefix, kind] of mdMap) {
      if (text.startsWith(prefix)) {
        const targetId = mirrorOfId ?? node.id
        try {
          const ed = JSON.parse(node.extraData || '{}')
          ed._block = kind
          store.updateNode(targetId, { text: text.slice(prefix.length), extraData: JSON.stringify(ed) })
        } catch {}
        break
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, displayNode.text])
  const isDivider = blockType === 'divider'
  const isBullet = blockType === 'bullet'
  const isNota = (node.types || []).includes('nota')
  const isBucle = (node.types || []).includes('bucle')
  const isBucleClosed = isBucle && node.status === 'done'
  const nodeIcon = meta.icon ?? null
  // Color: deriva del primer tag que tenga color asignado (sin contar tags built-in)
  const nodeColor = (() => {
    // Color de eventos GCal (borde izquierdo con el color del calendario)
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._gcalColor) return ed._gcalColor
    } catch { /* ignore */ }
    // Color de tag del usuario
    const builtinTags = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])
    const userTags = (node.types || []).filter(t => !builtinTags.has(t))
    for (const tag of userTags) {
      const c = store.tagColor(tag)
      if (c) return c
    }
    return null
  })()

  // Filter: if filterText is active and this node doesn't match, hide it
  // But keep parent visible if any descendant matches
  const activeFilter = filterText && filterText.trim()
  // WF smart filter: use filterMatchIds if provided, otherwise fall back to text search
  const matchesFilter = filterMatchIds
    ? filterMatchIds.has(node.id)
    : (!activeFilter || includesNormalized(node.text, filterText!))
  // anyDescendantMatches: ¿algún hijo coincide? → mostrar este nodo como ancestro.
  // Si tenemos filterAncestorIds precomputado (O(1)), lo usamos directamente.
  // Si no, fallback a getAllDescendants (texto libre) — solo en filtro local sin smart filter.
  const anyDescendantMatches = (activeFilter || filterMatchIds) && !matchesFilter
    ? filterAncestorIds
      ? filterAncestorIds.has(node.id)  // O(1) — precomputado por applyWFFilter
      : getAllDescendants(node.id).some(id => {
          const n = store.getNode(id)
          if (!n || n.deletedAt) return false
          return includesNormalized(n.text, filterText!)
        })
    : false

  // Sync DOM text with node.text when not editing.
  // Si estamos editando (isEditing=true) pero el store cambió externamente
  // (undo/redo), también actualizamos el DOM para que ⌘Z funcione en texto.
  useEffect(() => {
    if (!contentRef.current) return

    if (isEditing) {
      // Sólo sincronizar si undo/redo cambió el texto externamente —
      // es decir, el DOM ya no coincide con el store.
      const domText = (contentRef.current.textContent || '').replace(/ /g, ' ')
      if (domText === displayNode.text) return
      // Texto cambiado externamente (undo/redo): actualizar DOM y cursor al final
      contentRef.current.textContent = displayNode.text
      nodeTextRef.current = displayNode.text
      const sel = window.getSelection()
      if (sel && contentRef.current) {
        const range = document.createRange()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      return
    }

    const forced = (extraBlock === 'bullet' || extraBlock === 'h1' || extraBlock === 'h2' || extraBlock === 'h3')
      ? extraBlock as 'bullet' | 'h1' | 'h2' | 'h3'
      : undefined
    const hl = (activeFilter ? filterText : undefined) ?? (highlightText?.trim() ? highlightText : undefined)
    const newHtml = renderInlineToHtml(displayNode.text, hl, forced)
    if (contentRef.current.innerHTML !== newHtml) {
      contentRef.current.innerHTML = newHtml
    }
  }, [displayNode.text, isEditing, filterText, highlightText, extraBlock]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animación cuando el nodo pasa de null → pending (se convierte en tarea)
  useEffect(() => {
    if (prevStatusRef.current === null && node.status === 'pending') {
      setTaskConverting(true)
      setTimeout(() => setTaskConverting(false), 380)
    }
    prevStatusRef.current = node.status
  }, [node.status])

  // Re-evaluar predicciones cuando el usuario añade palabras al diccionario
  useEffect(() => {
    function onWordsChanged() {
      if (!isEditing || !contentRef.current) return
      const text = (contentRef.current.textContent || '').replace(/ /g, ' ')
      const normedText = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      if (node.status === null && !node.isEvent && text.length > 5 && buildTaskVerbRegex().test(normedText)) {
        setTaskPrediction(true)
      }
    }
    window.addEventListener('from:prediction-words-changed', onWordsChanged)
    return () => window.removeEventListener('from:prediction-words-changed', onWordsChanged)
  }, [isEditing, node.status, node.isEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus when selected + scroll into view
  // Sin guarda !isEditing: el efecto sólo corre cuando isSelected CAMBIA (dep array),
  // no en cada render. Al deseleccionar reseteamos isEditing para que el siguiente
  // ciclo de selección siempre funcione.
  useEffect(() => {
    if (isSelected && contentRef.current) {
      // Si el foco vino de un clic (mousedown), handleFocus ya colocó el cursor donde
      // el usuario hizo clic. No sobreescribir con cursor-al-final.
      if (skipIsSelectedCursorRef.current) {
        skipIsSelectedCursorRef.current = false
        setIsEditing(true)
        contentRef.current.closest('.outliner-node')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        return
      }
      setIsEditing(true)
      contentRef.current.focus()
      // Scroll the node into view
      contentRef.current.closest('.outliner-node')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(contentRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    } else if (!isSelected) {
      setIsEditing(false)
    }
  }, [isSelected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar modales con Escape
  useEffect(() => {
    if (!showQuickProps && !showEventProp) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowQuickProps(false)
        setShowEventProp(false)
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [showQuickProps, showEventProp])

  // ── Helpers de evento ────────────────────────────────────────────────────
  const evtDueDate = isoToLocalDate(node.due)
  const evtDueTime = isoToLocalTime(node.due)
  const evtEndDate = isoToLocalDate(node.dueEnd)
  const evtEndTime = isoToLocalTime(node.dueEnd)
  const evtLocationStored = (nodeMeta(node).location ?? '')
  const gcalEventId_evt = (nodeMeta(node).gcalEventId ?? null)

  function setEvtDueField(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    const updates: Record<string, unknown> = { due: makeDueISO(date, time) }
    // Si se establece una hora de inicio y el fin no tiene hora todavía → auto-poner fin = inicio + 1h
    if (time && !hasLocalTime(node.dueEnd)) {
      const startDt = new Date(`${date}T${time}:00`)
      startDt.setHours(startDt.getHours() + 1)
      const endDate = [startDt.getFullYear(), String(startDt.getMonth() + 1).padStart(2, '0'), String(startDt.getDate()).padStart(2, '0')].join('-')
      const endTime = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`
      updates.dueEnd = makeDueISO(endDate, endTime)
    }
    store.updateNode(node.id, updates)
    scheduleGCalSync()
  }
  function setEvtEndField(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { dueEnd: null }); return }
    store.updateNode(node.id, { dueEnd: makeDueISO(date, time) })
    scheduleGCalSync()
  }
  function setEvtLocationField(loc: string) {
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    if (loc.trim()) ed.location = loc.trim(); else delete ed.location
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    scheduleGCalSync()
  }
  function scheduleGCalSync() {
    if (gcalSyncTimerRef.current) clearTimeout(gcalSyncTimerRef.current)
    gcalSyncTimerRef.current = setTimeout(async () => {
      const due = store.getNode(node.id)?.due
      if (!due) return
      const dueEnd = store.getNode(node.id)?.dueEnd
      const end = dueEnd || new Date(new Date(due).getTime() + 3600000).toISOString()
      let loc = ''
      try { loc = JSON.parse(store.getNode(node.id)?.extraData || '{}').location || '' } catch {}
      const gcalId = (() => { try { return JSON.parse(store.getNode(node.id)?.extraData || '{}').gcalEventId } catch { return null } })()
      try {
        const rec = fromRecToRRule(store.getNode(node.id)?.recurrence)
        if (gcalId) {
          await updateCalendarEvent(gcalId, { title: node.text || 'Evento', start: due, end, location: loc || undefined, recurrence: rec })
        } else {
          const result = await createCalendarEvent({ title: node.text || 'Evento', start: due, end, location: loc || undefined, recurrence: rec })
          let ed: Record<string, unknown> = {}
          try { ed = JSON.parse(store.getNode(node.id)?.extraData || '{}') } catch {}
          ed.gcalEventId = result.id
          store.updateNode(node.id, { extraData: JSON.stringify(ed) })
        }
      } catch { /* sin conexión GCal */ }
    }, 900)
  }

  // Badge de fecha para tareas: "hoy", "mañana", "lun 8 jun"
  const taskDueBadge = node.status !== null && !node.isEvent && node.due ? (() => {
    const d = new Date(node.due)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) return { label: 'hoy', overdue: false }
    if (d.getTime() === tomorrow.getTime()) return { label: 'mañana', overdue: false }
    const overdue = d < today
    const sameYear = d.getFullYear() === today.getFullYear()
    const sameMonth = sameYear && d.getMonth() === today.getMonth()
    const label = d.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      ...(sameMonth ? {} : { month: 'short' }),
    })
    return { label, overdue }
  })() : null

  const evtBadgeLabel = node.due ? (() => {
    const d = new Date(node.due)
    const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const localTime = isoToLocalTime(node.due)
    const timeStr = hasLocalTime(node.due) ? ' ' + localTime : ''
    return dateStr + timeStr
  })() : null

  function buildMovePickerItems(query: string): PickerItem[] {
    const q = query.trim().toLowerCase()
    const today = getTodayDiaryUnderAgenda()
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = ensureDayPath(tomorrowDate)
    const quickItems: PickerItem[] = [
      { id: today.id, label: 'Hoy', group: 'note' as const },
      { id: tomorrow.id, label: 'Mañana', group: 'note' as const },
    ].filter(item => !q || item.label.toLowerCase().includes(q) ||
      normalizeNFD(item.label).includes(normalizeNFD(q)))
    const nodeItems = store.allActive()
      .filter(n => !n.deletedAt && n.id !== node.id && n.text &&
        (!q || n.text.toLowerCase().includes(q) || normalizeNFD(n.text).includes(normalizeNFD(q))))
      .filter(n => n.id !== today.id && n.id !== tomorrow.id)
      .slice(0, 8)
      .map(n => ({ id: n.id, label: n.text, status: n.status, group: 'note' as const }))
    return [...quickItems, ...nodeItems]
  }

  function normalizeNFD(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  function buildPickerItems(type: '@', query: string): PickerItem[] {
    if (type === '@') {
      // @ — contextos del árbol 🧠 Contexto: buscar por nombre visible, no por slug
      const treeItems: { id: string; label: string; slug: string }[] = []
      const tagsRoot = findContextRoot()
      if (tagsRoot) {
        function collectContextNodes(parentId: string, prefix: string) {
          for (const child of store.children(parentId)) {
            if (child.deletedAt) continue
            const slug = (prefix ? prefix + '/' : '') +
              (child.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
            treeItems.push({ id: slug, label: child.text || slug, slug })
            collectContextNodes(child.id, slug)
          }
        }
        collectContextNodes(tagsRoot.id, '')
      }
      // Fallback: allUsedTags que no estén ya en treeItems
      const existingSlugs = new Set(treeItems.map(i => i.slug))
      const userTags = store.allUsedTags().filter(t => !existingSlugs.has(t))
      const allItems = [
        ...treeItems,
        ...userTags.map(t => ({ id: t, label: t, slug: t })),
        ...COMMON_TYPES.filter(t => !existingSlugs.has(t)).map(t => ({ id: t, label: t, slug: t })),
      ]
      const q = query.trim().toLowerCase()
      const nodeCurrentTypes = new Set(node.types || [])
      const contextItems = allItems
        .filter(item => !q || item.label.toLowerCase().includes(q) || item.slug.includes(q))
        .sort((a, b) => {
          // 1. Contexts already on this node rise to the very top
          const aOnNode = nodeCurrentTypes.has(a.id) ? 1 : 0
          const bOnNode = nodeCurrentTypes.has(b.id) ? 1 : 0
          if (aOnNode !== bOnNode) return bOnNode - aOnNode
          // 2. Sort by usage frequency
          const au = _ctxUsageCount.get(a.id) || 0
          const bu = _ctxUsageCount.get(b.id) || 0
          if (au !== bu) return bu - au
          // 3. Starts-with match for the typed query
          const al = a.label.toLowerCase(), bl = b.label.toLowerCase()
          const aStarts = al.startsWith(q), bStarts = bl.startsWith(q)
          if (aStarts && !bStarts) return -1
          if (!aStarts && bStarts) return 1
          return al.localeCompare(bl)
        })
        .slice(0, 8)
        .map(item => ({ id: item.id, label: item.label, group: 'context' as const }))

      // Grupo "Notas": búsqueda por texto, excluyendo papelera. Distinción nota/párrafo:
      // una NOTA tiene hijos; un PÁRRAFO es una hoja. Las notas se priorizan arriba.
      const noteItems = q
        ? store.allActive()
            .filter(n => !n.deletedAt && n.id !== node.id && n.text && n.text.toLowerCase().includes(q) && !isInPapelera(n.id))
            .map(n => ({ n, isNote: store.children(n.id).some(c => !c.deletedAt) }))
            .sort((a, b) => {
              if (a.isNote !== b.isNote) return a.isNote ? -1 : 1   // notas primero
              const as = a.n.text.toLowerCase().startsWith(q), bs = b.n.text.toLowerCase().startsWith(q)
              if (as !== bs) return as ? -1 : 1
              return a.n.text.localeCompare(b.n.text)
            })
            .slice(0, 8)
            .map(({ n, isNote }) => ({ id: n.id, label: n.text, status: n.status, types: n.types || [], isNote, group: 'note' as const }))
        : []

      return [...contextItems, ...noteItems]
    }
    // # — search nodes (node references), include status/types/body preview
    return store.allActive()
      .filter(n => !n.deletedAt && n.id !== node.id && n.text && n.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map(n => ({
        id: n.id,
        label: n.text,
        status: n.status,
        types: n.types || [],
        bodyPreview: n.body ? n.body.slice(0, 30) : undefined,
      }))
  }

  const handleInput = useCallback(() => {
    // Marcar que el usuario ha editado este nodo en la sesión actual
    // (habilita el trigger de auto-clasificación en el useEffect correspondiente)
    hasUserEditedRef.current = true
    // Normalizar NBSP → espacio regular (el prefijo del slash menu usa NBSP
    // para evitar que el browser colapse el trailing space en contentEditable)
    const text = (contentRef.current?.textContent || '').replace(/ /g, ' ')
    // Auto-sync bidireccional: types[] refleja los @contextos del texto.
    // Los #tags han sido eliminados de Fromly — solo @ para contextos.
    const BUILTIN_TYPES = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])
    const atTags = new Set([...(text.match(/@([\wÀ-ɏ\/\-]+)/g) || [])].map(t => t.slice(1)))
    const allContextTags = new Set([...atTags])
    const currentTypes = node.types || []
    const newTypes = [
      ...currentTypes.filter(t => BUILTIN_TYPES.has(t) || allContextTags.has(t)),
      ...[...allContextTags].filter(t => !currentTypes.includes(t)),
    ]
    // Solo actualizar types si realmente cambió (evita escritura inútil)
    const typesChanged = newTypes.length !== currentTypes.length ||
      newTypes.some((t, i) => t !== currentTypes[i])
    // Si es un nodo espejo, redirigir las ediciones al nodo original
    const targetNodeId = mirrorOfId ?? node.id
    if (typesChanged) {
      store.updateNode(targetNodeId, { text, types: newTypes })
      // NOTA: ensureTagInTree se llama en onBlur, no aquí, para no crear
      // un nodo en 🧠 Contexto por cada tecla mientras el usuario escribe.
    } else {
      store.updateNode(targetNodeId, { text })
    }

    // Slash menu: '/' en cualquier posición del cursor
    const slashPos = getCaretPosition(contentRef.current!)
    const beforeSlashCheck = text.slice(0, slashPos)
    const slashDetect = beforeSlashCheck.match(/(^|[\s])\/([^\s]*)$/)
    if (slashDetect) {
      setShowSlash(true)
      setSlashQuery(slashDetect[2])
      setPicker(null)
      setShowCodePicker(false)
      setCodeQuery('')
    } else {
      setShowSlash(false)
      setSlashQuery('')
    }

    // Template code picker: '{{' trigger
    const codeDetect = beforeSlashCheck.match(/\{\{([^}\s]*)$/)
    if (codeDetect && !slashDetect) {
      setShowCodePicker(true)
      setCodeQuery(codeDetect[1] || '')
    } else {
      setShowCodePicker(false)
      setCodeQuery('')
    }

    // Auto-conversión markdown al escribir (estilo Notion: el prefijo desaparece tras el espacio):
    if (!text.startsWith('/')) {
      const markdownTriggers: Array<[string, 'bullet' | 'h1' | 'h2' | 'h3']> = [
        ['### ', 'h3'],
        ['## ', 'h2'],
        ['# ', 'h1'],
        ['- ', 'bullet'],
      ]
      for (const [prefix, kind] of markdownTriggers) {
        if (text === prefix) {
          // Trigger limpio: nodo vacío con sólo el prefijo
          let ed: Record<string, unknown> = {}
          try { ed = JSON.parse(node.extraData || '{}') } catch {}
          ed._block = kind
          nodeTextRef.current = ''
          store.updateNode(node.id, { text: '', extraData: JSON.stringify(ed) })
          if (contentRef.current) {
            contentRef.current.textContent = ''
          }
          return
        }
        if (text.startsWith(prefix) && !extraBlock) {
          // Prefijo al inicio con contenido detrás → convertir y limpiar
          let ed: Record<string, unknown> = {}
          try { ed = JSON.parse(node.extraData || '{}') } catch {}
          ed._block = kind
          const newText = text.slice(prefix.length)
          nodeTextRef.current = newText
          store.updateNode(node.id, { text: newText, extraData: JSON.stringify(ed) })
          if (contentRef.current) {
            contentRef.current.textContent = newText
            // Cursor al final
            const range = document.createRange()
            const sel = window.getSelection()
            range.selectNodeContents(contentRef.current)
            range.collapse(false)
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
          return
        }
      }
      if (text === '---') {
        // Divider automático
        nodeTextRef.current = '---'
        store.updateNode(node.id, { text: '---' })
        if (contentRef.current) contentRef.current.textContent = ''
      }
    }

    // Detect @ trigger (contextos/tags) and # trigger (node references)
    const pos = getCaretPosition(contentRef.current!)
    const before = text.slice(0, pos)

    const atMatch = before.match(/@([^@\n]*)$/)

    // Detectar "mover a [query]" en el texto completo (case-insensitive, ignora acentos)
    const moveMatch = text.match(/(?:mover a|move to)\s*(.*)$/i)

    if (picker?.type === 'mirror') {
      // En modo mirror, el texto que escribe es el query de búsqueda
      const query = text
      const items = store.allActive()
        .filter(n => !n.deletedAt && n.id !== node.id && n.text && n.text.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map(n => ({ id: n.id, label: n.text, status: n.status, types: n.types || [], bodyPreview: n.body?.slice(0, 30) }))
      setPicker(p => p ? { ...p, query, items, activeIdx: 0 } : p)
    } else if (moveMatch) {
      const query = moveMatch[1]
      const items = buildMovePickerItems(query)
      setPicker({ type: 'move', query, items, activeIdx: 0 })
    } else if (atMatch) {
      const query = atMatch[1]
      const items = buildPickerItems('@', query)
      setPicker({ type: '@', query, items, activeIdx: 0 })
    } else {
      setPicker(null)
    }

    // Text expansion: detectar si el texto termina en un trigger configurado
    // Mostrar hint visual si hay un shortcut coincidente
    const shortcuts = getShortcuts()
    const matchingShortcut = shortcuts.find(s => text.endsWith(s.trigger))
    if (matchingShortcut) {
      contentRef.current?.classList.add('has-expansion')
    } else {
      contentRef.current?.classList.remove('has-expansion')
    }

    const expanded = tryExpand(text, shortcuts)
    if (expanded) {
      contentRef.current?.classList.remove('has-expansion')
      nodeTextRef.current = expanded
      store.updateNode(node.id, { text: expanded })
      if (contentRef.current) {
        contentRef.current.textContent = expanded
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }

    // ── Detección de intención de tarea por verbo de acción ────────────────
    // Usa el regex dinámico (built-in + palabras custom del usuario)
    const normedText = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    if (node.status === null && !node.isEvent && text.length > 5 && buildTaskVerbRegex().test(normedText)) {
      setTaskPrediction(true)
    } else {
      setTaskPrediction(false)
    }

    // ── Detección "pizarra" → predicción de pizarra digital ─────────────────
    const normedForWb = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    setWhiteboardPrediction(/\bpizarra\b|\bwhiteboard\b/.test(normedForWb))

    // ── Detección de fecha al final de cualquier nodo ──────────────────────
    if (text.length > 3) {
      setDatePrediction(extractDateFromEnd(text))
    } else {
      setDatePrediction(null)
    }

    // ── Autocompletado de contextos (sin @) ─────────────────────────────────
    // Solo si no hay @ picker activo y el texto tiene >= 3 chars
    if (!picker && text.length >= 3) {
      const pos = contentRef.current ? getCaretPosition(contentRef.current) : text.length
      const beforeCursor = text.slice(0, pos)
      // No activar si ya hay un @ justo antes (lo gestiona el picker)
      if (!/@[\wÀ-ɏ\s]*$/.test(beforeCursor)) {
        const ctxNodes: { slug: string; displayName: string }[] = []
        // Solo hijos directos del nodo 🧠 Contexto (o 🏷 Tags legacy)
        const tagsRoot = findContextRoot()
        if (tagsRoot) {
          for (const child of store.children(tagsRoot.id)) {
            if (child.deletedAt || !child.text) continue
            const slug = child.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
            ctxNodes.push({ slug, displayName: child.text })
          }
        }

        const normStr = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        let found: typeof ctxCompletion = null

        for (const ctx of ctxNodes) {
          const ctxNorm = normStr(ctx.displayName)
          // Buscar el prefijo más largo del final de beforeCursor que coincida con inicio del contexto
          for (let len = Math.min(beforeCursor.length, ctxNorm.length - 1); len >= 3; len--) {
            const tail = normStr(beforeCursor.slice(-len))
            // Debe empezar en límite de palabra (espacio, inicio o puntuación)
            const charBefore = beforeCursor[beforeCursor.length - len - 1]
            const isWordStart = !charBefore || /[\s,;:([\-]/.test(charBefore)
            if (isWordStart && ctxNorm.startsWith(tail) && tail !== ctxNorm) {
              const ghost = ctx.displayName.slice(len) // resto sin cambiar case
              found = { slug: ctx.slug, displayName: ctx.displayName, typedLen: len, ghost }
              break
            }
          }
          if (found) break
        }
        setCtxCompletion(found)
      } else {
        setCtxCompletion(null)
      }
    } else {
      setCtxCompletion(null)
    }
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPickerSelection(item: PickerItem) {
    if (!picker || !contentRef.current) return

    // ── Move: mover el nodo al destino seleccionado ──
    if (picker.type === 'move') {
      const rawText = contentRef.current?.textContent || ''
      // Quitar "mover a [query]" del texto, conservando el texto previo
      const cleanText = rawText.replace(/\s*(?:mover a|move to)\s*.*/i, '').trim()
      const siblings = store.children(item.id)
      const maxOrder = siblings.reduce((max, n) => Math.max(max, n.siblingOrder), 0)
      store.updateNode(node.id, { text: cleanText, parentId: item.id, siblingOrder: maxOrder + 1000 })
      if (contentRef.current) contentRef.current.textContent = cleanText
      setPicker(null)
      window.dispatchEvent(new CustomEvent('from:toast', {
        detail: { message: `→ Movido a "${(item.label || '').slice(0, 30)}"`, type: 'success' }
      }))
      return
    }

    // ── Mirror: convertir el nodo actual en espejo del nodo seleccionado ──
    if (picker.type === 'mirror') {
      const originalNode = store.getNode(item.id)
      if (!originalNode) { setPicker(null); return }
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      ed._mirrorOf = item.id
      store.updateNode(node.id, { text: originalNode.text, extraData: JSON.stringify(ed) })
      if (contentRef.current) contentRef.current.textContent = originalNode.text || ''
      setPicker(null)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `⬡ Espejo de "${(originalNode.text || '').slice(0, 30)}" creado`, type: 'success' } }))
      return
    }

    const text = contentRef.current.textContent || ''
    const pos = getCaretPosition(contentRef.current)
    const before = text.slice(0, pos)
    const trigger = picker.type === '@' ? '@' : '#'
    // Remove the trigger + query
    const queryLen = picker.query.length
    const newBefore = before.slice(0, before.length - queryLen - 1) // remove @/# + query
    const after = text.slice(pos)

    if (picker.type === '@' && item.group === 'note') {
      // @ + nota genérica → insertar [[wiki-link]] inline donde se escribió
      const wikiText = `[[${item.label}]]`
      const newText = newBefore + wikiText + (after || '')
      store.updateNode(node.id, { text: newText })
      if (contentRef.current) {
        // Renderizar inline inmediatamente
        contentRef.current.innerHTML = renderInlineToHtml(newText)
        // Cursor después del [[wiki-link]]
        const sel = window.getSelection()
        const range = document.createRange()
        // Encontrar el nodo de texto después del mention-inline
        const allNodes = Array.from(contentRef.current.childNodes)
        const mentionIdx = allNodes.findIndex(n => (n as HTMLElement).classList?.contains('mention-inline'))
        if (mentionIdx >= 0 && allNodes[mentionIdx + 1]) {
          range.setStart(allNodes[mentionIdx + 1], 0)
        } else {
          range.selectNodeContents(contentRef.current)
          range.collapse(false)
        }
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      setPicker(null)
      return
    }

    if (picker.type === '@') {
      // @ context/tag: siempre al final del texto, no inline donde se escribió
      const tagText = `@${item.id}`
      const cleanText = (newBefore + after).trim()
      const newText = cleanText + (cleanText ? ' ' : '') + tagText
      const newTypes = (node.types || []).includes(item.id) ? node.types : [...(node.types || []), item.id]
      store.updateNode(node.id, { text: newText, types: newTypes })
      ensureTagInTree(item.id)
      // Track usage for frecuency-based sorting in future @ pickers
      recordCtxUsage(item.id)
      if (contentRef.current) {
        // Renderizar inline inmediatamente (no esperar al blur)
        contentRef.current.innerHTML = renderInlineToHtml(newText)
        // Cursor al final del contenido renderizado
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    } else {
      // # reference: insert #NodeName in text as node reference
      const refText = `#${item.label}`
      const newText = newBefore + refText + after
      // Save ref in extraData
      let extraData: Record<string, unknown> = {}
      try { extraData = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      const existingRefs: string[] = Array.isArray(extraData.refs) ? extraData.refs as string[] : []
      if (!existingRefs.includes(item.id)) {
        extraData.refs = [...existingRefs, item.id]
      }
      store.updateNode(node.id, { text: newText, extraData: JSON.stringify(extraData) })
      if (contentRef.current) {
        contentRef.current.textContent = newText
        const insertPos = newBefore.length + refText.length
        const range = document.createRange()
        const sel = window.getSelection()
        const textNode = contentRef.current.firstChild
        if (textNode) {
          range.setStart(textNode, Math.min(insertPos, textNode.textContent?.length || 0))
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }
    }

    setPicker(null)
    // Suppress unused variable warning
    void trigger
  }

  const handleFocus = useCallback(() => {
    // Espejos de mirrors de padre (no editables) — los espejos de tarea sí se pueden editar
    setIsEditing(true)
    if (contentRef.current) {
      const savedPos = pendingCursorPosRef.current
      pendingCursorPosRef.current = null
      contentRef.current.textContent = nodeTextRef.current

      if (savedPos !== null) {
        // Foco vino de un clic — restaurar cursor donde hizo clic.
        // Señalar al useEffect de isSelected que no sobreescriba el cursor.
        skipIsSelectedCursorRef.current = true
        try {
          const textNode = contentRef.current.firstChild
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const pos = Math.min(savedPos, (textNode.textContent?.length ?? 0))
            const range = document.createRange()
            range.setStart(textNode, pos)
            range.collapse(true)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        } catch { /* ignore */ }
      }
    }
    // onSelect DESPUÉS de restaurar cursor (para que isSelected effect vea la bandera)
    onSelect(node.id)
  }, [node.id, onSelect]) // nodeTextRef / pendingCursorPosRef / skipIsSelectedCursorRef son refs estables

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    setShowSlash(false)
    setDatePrediction(null)
    setCtxCompletion(null)
    setTaskPrediction(false)
    // Delay picker hide to allow click
    setTimeout(() => setPicker(null), 150)

    // ── Aprendizaje del usuario: extraer datos relevantes del nodo al perder el foco ──
    // Se dispara para CUALQUIER nodo con texto ≥ 20 chars, sin importar tipo.
    // Al hacer blur: si hay un timer pendiente (del useEffect de 5s), se cancela y se
    // ejecuta inmediatamente vía doExtractUserKnowledge. La deduplicación (extractedKnowledgeNodes
    // + hasExtractedUserKnowledgeRef) evita doble extracción si el nodo también procesó el timer.
    const blurText = (contentRef.current?.textContent || node.text || '').trim()

    // Si hay un timer pendiente del useEffect (5s), cancelarlo — ejecutaremos inmediatamente
    const hadPendingTimer = extractUserKnowledgeTimerRef.current !== null
    if (extractUserKnowledgeTimerRef.current) {
      clearTimeout(extractUserKnowledgeTimerRef.current)
      extractUserKnowledgeTimerRef.current = null
    }

    if (
      (hasUserEditedRef.current || hadPendingTimer) &&
      !isInsideKnowledgeRestricted &&
      blurText.length >= 20
    ) {
      // Fire-and-forget — doExtractUserKnowledge aplica deduplicación interna
      doExtractUserKnowledge(blurText, node.id)
    }

    // Auto-crear nodos en 🏷 Tags para tags completos escritos manualmente.
    // Se ejecuta aquí (blur) y no en handleInput para no crear un nodo por cada tecla.
    const finalText = contentRef.current?.textContent || ''
    const BUILTIN = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])
    const tags = [...(finalText.match(/#([\wÀ-ɏ\/\-]+)/g) || [])].map(t => t.slice(1))
    for (const tag of tags) {
      if (!BUILTIN.has(tag)) {
        try { ensureTagInTree(tag) } catch { /* silencioso */ }
      }
    }

    // Nodo vacío = no existe. Si pierde el foco sin contenido, se borra.
    // Excepción: diarios, y nodos recién creados (< 2s) — el usuario puede estar
    // llegando a ellos (e.g., crea con Enter y el foco tarda en llegar).
    const currentText = (contentRef.current?.textContent || '').trim()
    if (currentText === '' && !node.isDiaryEntry) {
      // Período de gracia: si el nodo se creó hace menos de 2 segundos, no borrar
      const createdAt = node.createdAt ? new Date(node.createdAt).getTime() : 0
      const isVeryNew = Date.now() - createdAt < 2000
      if (isVeryNew) return

      // Pequeño delay para que los clicks en otros elementos se procesen primero
      setTimeout(() => {
        const still = store.getNode(node.id)
        if (still && !still.deletedAt && !(still.text || '').trim()) {
          // Segunda comprobación: si el nodo se creó hace menos de 2s, no borrar
          const age = Date.now() - (still.createdAt ? new Date(still.createdAt).getTime() : 0)
          if (age < 2000) return
          store.deleteNode(node.id)
        }
      }, 200)
    }
  }, [node.id, node.isDiaryEntry])

  function createSiblingBelow() {
    if (store.atFreeNodeLimit()) return  // free: bloquea al llegar a 1.000 nodos + muestra paywall
    const sibs = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
    const i = sibs.findIndex(n => n.id === node.id)
    const next = sibs[i + 1]
    const newOrder = next ? (node.siblingOrder + next.siblingOrder) / 2 : node.siblingOrder + 1
    const newNode = store.createNode({ text: '', parentId: node.parentId, siblingOrder: newOrder })
    onSelect(newNode.id)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const text = contentRef.current?.textContent || ''

    // If slash menu is open, let it handle arrow keys and Enter/Escape
    if (showSlash) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
        return
      }
    }

    // ── Aceptar autocompletado de contexto (Tab o Enter) ─────────────────────
    if (ctxCompletion && !picker && !showSlash) {
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault()
        acceptCtxCompletion()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setCtxCompletion(null)
        return
      }
    }

    // ── Predicción combinada: tarea + fecha (verbo de acción + indicador temporal) ──
    if (taskPrediction && datePrediction && !picker && !showSlash && !ctxCompletion) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setTaskPrediction(false)
        setDatePrediction(null)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        // Si el datePrediction detectó evento (hora o keyword), acceptDatePrediction ya lo marca como isEvent
        // Solo forzar tarea si NO es un evento detectado
        if (!datePrediction?.isEvent) {
          store.updateNode(node.id, { status: 'pending' })
        }
        setTaskPrediction(false)
        // acceptDatePrediction maneja isEvent/status según la predicción
        acceptDatePrediction()
        createSiblingBelow()
        return
      }
    }

    // ── Predicción pizarra: Tab/Enter convierte en pizarra y navega ──────────
    if (whiteboardPrediction && !picker && !showSlash && !ctxCompletion) {
      if (e.key === 'Escape') {
        e.preventDefault(); setWhiteboardPrediction(false); return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault()
        setWhiteboardPrediction(false)
        let ed: Record<string, unknown> = {}
        try { ed = JSON.parse(node.extraData || '{}') } catch {}
        ed._isWhiteboard = '1'
        // Quitar la palabra "pizarra/whiteboard" del texto, conservar el resto
        const cleanWbText = (contentRef.current?.textContent || node.text || '')
          .replace(/\s*\bpizarra\b|\s*\bwhiteboard\b/gi, '').trim() || 'Pizarra'
        store.updateNode(node.id, { extraData: JSON.stringify(ed), text: cleanWbText })
        if (contentRef.current) contentRef.current.textContent = cleanWbText
        navigate(`/node/${node.id}`)
        return
      }
    }

    // ── Predicción de tarea sola: Escape cancela, Enter convierte antes de crear hermano ──
    if (taskPrediction && !picker && !showSlash && !datePrediction && !ctxCompletion) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setTaskPrediction(false)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        // Convertir a tarea ANTES de que el Enter cree el hermano
        store.updateNode(node.id, { status: 'pending' })
        setTaskPrediction(false)
        // dejar que el Enter siga su curso normal (crea el hermano)
      }
    }

    // ── Aceptar predicción de fecha (Tab o Enter sin modificadores) ──────────
    if (datePrediction && !picker && !showSlash) {
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault()
        acceptDatePrediction()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDatePrediction(null)
        return
      }
    }

    // Inline picker navigation
    if (picker) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPicker(p => p ? { ...p, activeIdx: Math.min(p.activeIdx + 1, p.items.length - 1) } : p)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPicker(p => p ? { ...p, activeIdx: Math.max(p.activeIdx - 1, 0) } : p)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (picker.items.length > 0) {
          applyPickerSelection(picker.items[picker.activeIdx])
        } else if (picker.type === '@' && picker.query) {
          // No hay items en el picker pero hay query — confirmar el contexto tal cual
          setPicker(null)
          try { ensureTagInTree(picker.query) } catch { /* silencioso */ }
        }
        return
      }
      if (e.key === 'Tab' && picker.type === '@') {
        e.preventDefault()
        if (picker.items.length > 0) {
          applyPickerSelection(picker.items[picker.activeIdx])
        } else if (picker.query) {
          setPicker(null)
          try { ensureTagInTree(picker.query) } catch { /* silencioso */ }
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setPicker(null)
        return
      }
    }

    // Escape: limpiar selección de texto si la hay
    if (e.key === 'Escape') {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) {
        e.preventDefault()
        sel.removeAllRanges()
        return
      }
    }

    // Cmd+/ → ciclar heading H1 → H2 → H3 → normal
    if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      const currentText = nodeTextRef.current
      const currentBlockType = detectBlockType(currentText)
      let newText = currentText
      if (currentBlockType === 'text') {
        newText = '# ' + currentText.replace(/^#+ /, '')
      } else if (currentBlockType === 'h1') {
        newText = '## ' + currentText.replace(/^#+ /, '')
      } else if (currentBlockType === 'h2') {
        newText = '### ' + currentText.replace(/^#+ /, '')
      } else {
        newText = currentText.replace(/^#+ /, '')
      }
      nodeTextRef.current = newText
      store.updateNode(node.id, { text: newText })
      if (contentRef.current) contentRef.current.textContent = newText
      return
    }

    // Cmd+T dentro del outliner → toggle tarea del nodo activo
    if (e.key === 't' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      // Solo si no hay texto seleccionado (para no interferir con el modal global de nueva tarea)
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        e.preventDefault()
        e.stopPropagation() // Evitar que MainLayout abra el modal de nueva tarea
        toggleTask()
        return
      }
    }

    // Cmd+B/I/E → formato inline (solo si hay selección)
    if ((e.key === 'b' || e.key === 'i' || e.key === 'e') && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.toString()) {
        e.preventDefault()
        if (e.key === 'b') applyFormat('bold')
        else if (e.key === 'i') applyFormat('italic')
        else if (e.key === 'e') applyFormat('code')
        return
      }
    }

    // Cmd+Enter (Mac) / Ctrl+Enter (Win) → ciclar estado: normal → pendiente → hecha → normal
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      if (node.status === null || node.status === undefined) {
        // Normal → Tarea pendiente
        store.updateNode(node.id, { status: 'pending' })
      } else if (node.status === 'pending') {
        // Pendiente → Completada
        store.updateNode(node.id, { status: 'done' })
      } else {
        // Completada → Normal (quita la tarea)
        store.updateNode(node.id, { status: null, due: null })
      }
      return
    }

    // Cmd+Shift+F → toggle favorito (atajo desacoplado)
    if (e.key === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault()
      store.updateNode(node.id, { isFavorite: !node.isFavorite })
      return
    }

    // Cmd+Shift+C → copiar enlace del nodo al clipboard
    if (e.key === 'c' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      const url = `${window.location.origin}/app/node/${node.id}`
      navigator.clipboard.writeText(url).catch(() => {})
      return
    }

    // Cmd+D → duplicar nodo
    if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault()
      const dup = store.createNode({
        text: node.text,
        parentId: node.parentId,
        siblingOrder: node.siblingOrder + 0.25,
        isTask: node.status !== null,
        types: node.types,
      })
      store.updateNode(dup.id, { priority: node.priority, status: node.status })
      onSelect(dup.id)
      return
    }

    // Cmd+↑ → mover nodo arriba
    if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const siblings = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
      const idx = siblings.findIndex(n => n.id === node.id)
      if (idx > 0) {
        const prev = siblings[idx - 1]
        const prevPrev = siblings[idx - 2]
        const newOrder = prevPrev ? (prevPrev.siblingOrder + prev.siblingOrder) / 2 : prev.siblingOrder - 1
        store.updateNode(node.id, { siblingOrder: newOrder })
      }
      return
    }

    // Cmd+↓ → mover nodo abajo
    if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const siblings = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
      const idx = siblings.findIndex(n => n.id === node.id)
      if (idx < siblings.length - 1) {
        const next = siblings[idx + 1]
        const nextNext = siblings[idx + 2]
        const newOrder = nextNext ? (next.siblingOrder + nextNext.siblingOrder) / 2 : next.siblingOrder + 1
        store.updateNode(node.id, { siblingOrder: newOrder })
      }
      return
    }

    // Helper: apply smart date from current text, show badge, update DOM
    function applySmartDate(currentText: string): boolean {
      const { text: cleanText, due } = parseInlineDate(currentText)
      if (!due) return false
      nodeTextRef.current = cleanText
      store.updateNode(node.id, { text: cleanText, due, status: node.status ?? 'pending' })
      if (contentRef.current) contentRef.current.textContent = cleanText
      const d = new Date(due)
      const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      setDateAssignedMsg(`📅 ${label}`)
      setTimeout(() => setDateAssignedMsg(null), 1500)
      return true
    }

    // Shift+Enter → zoom in al nodo actual + cursor en primer hijo vacío
    // Equivale a hacer clic en el dot bullet: entra en el nodo como contexto.
    if (e.key === 'Enter' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      // Guardar texto actual si ha cambiado
      const currentText = contentRef.current?.textContent ?? ''
      if (currentText !== node.text) {
        store.updateNode(node.id, { text: currentText })
      }
      // Navegar al nodo
      navigate(`/node/${node.id}`)
      // Tras navegar, crear o focalizar el primer hijo vacío
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('wf:new-child-today', { detail: { parentId: node.id } }))
      }, 150)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()

      // Lista de elementos (- o extraBlock=bullet): Enter continúa lista o sale si está vacío
      if (isBullet) {
        const isExtraBullet = extraBlock === 'bullet'
        const bulletContent = isExtraBullet ? text.trim() : (text.startsWith('- ') ? text.slice(2).trim() : text.trim())
        if (bulletContent === '') {
          // Bullet vacío → igual que nodo vacío: navegar al anterior y borrar
          if (depth > 0) {
            const parent = store.getNode(node.parentId!)
            if (parent) {
              store.updateNode(node.id, { parentId: parent.parentId, siblingOrder: parent.siblingOrder + 0.5 })
              return
            }
          }
          onSelectNext(node.id, 'up')
          store.deleteNode(node.id)
          return
        }
        // Bullet con contenido → crear siguiente elemento de lista (con flag _block=bullet).
        const sibsB = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
        const idxB = sibsB.findIndex(n => n.id === node.id)
        const nextB = sibsB[idxB + 1]
        const newOrderB = nextB ? (node.siblingOrder + nextB.siblingOrder) / 2 : node.siblingOrder + 1
        const newBullet = store.createNode({
          text: '',
          parentId: node.parentId,
          siblingOrder: newOrderB,
          extraData: { _block: 'bullet' },
        })
        onSelect(newBullet.id)
        return
      }

      // Enter en bullet vacío:
      // - Si está indentado (depth > 0) → desindentar (igual que Backspace)
      // - Si está al nivel raíz → borrar y cursor al anterior
      if (text === '') {
        if (depth > 0) {
          const parent = store.getNode(node.parentId!)
          if (parent) {
            store.updateNode(node.id, { parentId: parent.parentId, siblingOrder: parent.siblingOrder + 0.5 })
            return
          }
        }
        onSelectNext(node.id, 'up')
        store.deleteNode(node.id)
        return
      }

      // Smart date parse FIRST — create sibling after assigning date
      if (applySmartDate(text)) { createSiblingBelow(); return }

      // Detect inline shortcuts at end of text: -t (tarea), -b (bucle), -e (evento)
      const trimmed = text.trimEnd()
      if (trimmed.endsWith(' -t') || trimmed.endsWith(' -t')) {
        const cleanText = trimmed.slice(0, -3).trimEnd()
        nodeTextRef.current = cleanText
        const todayISOt = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        store.updateNode(node.id, { text: cleanText, status: 'pending', due: node.due ?? todayISOt })
        if (contentRef.current) contentRef.current.textContent = cleanText
        // Fall through — create sibling below
      } else if (trimmed.endsWith(' -e') || trimmed.endsWith(' -e')) {
        // (Eliminado sufijo -b: bucle ya no existe como concepto.)
        const cleanText = trimmed.slice(0, -3).trimEnd()
        nodeTextRef.current = cleanText
        const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        store.updateNode(node.id, { text: cleanText, isEvent: true, status: null, due: todayISO })
        if (contentRef.current) contentRef.current.textContent = cleanText
        // Fall through — create sibling below
      } else {
      // Paridad Mac v8.30: -a (agente), -p (prompt). Reusan NBSP variant.
      const nbspA = trimmed.endsWith('\u00a0-a')
      const nbspP = trimmed.endsWith('\u00a0-p')
      if (trimmed.endsWith(' -a') || nbspA) {
        const cleanText = trimmed.slice(0, -3).trimEnd()
        nodeTextRef.current = cleanText
        const existingTypes = node.types || []
        const types = existingTypes.includes('agente') ? existingTypes : [...existingTypes, 'agente']
        let ed: Record<string, unknown> = {}
        try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
        ed.elementMode = 'agente'
        store.updateNode(node.id, { text: cleanText, types, extraData: JSON.stringify(ed) })
        if (contentRef.current) contentRef.current.textContent = cleanText
        return
      }
      if (trimmed.endsWith(' -p') || nbspP) {
        const cleanText = trimmed.slice(0, -3).trimEnd()
        nodeTextRef.current = cleanText
        const existingTypes = node.types || []
        const types = existingTypes.includes('prompt') ? existingTypes : [...existingTypes, 'prompt']
        let ed: Record<string, unknown> = {}
        try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
        ed.elementMode = 'prompt'
        store.updateNode(node.id, { text: cleanText, types, extraData: JSON.stringify(ed) })
        if (contentRef.current) contentRef.current.textContent = cleanText
        return
      }
      }
      // Create sibling justo debajo — siempre crea, aunque haya nodos después.
      // siblingOrder = midpoint entre el actual y el siguiente (o +1 si no hay).
      const siblings = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
      const idx = siblings.findIndex(n => n.id === node.id)
      const nextSibling = siblings[idx + 1]
      const newOrder = nextSibling
        ? (node.siblingOrder + nextSibling.siblingOrder) / 2
        : node.siblingOrder + 1
      const newNode = store.createNode({
        text: '',
        parentId: node.parentId,
        siblingOrder: newOrder,
      })
      onSelect(newNode.id)
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      // Smart date parse on Tab too
      if (applySmartDate(text)) return

      if (e.shiftKey) {
        // Outdent: move to parent's parent
        if (node.parentId) {
          const parent = store.getNode(node.parentId)
          if (parent) {
            store.updateNode(node.id, { parentId: parent.parentId, siblingOrder: parent.siblingOrder + 0.5 })
          }
        }
      } else {
        // Indent: make child of previous sibling
        const siblings = store.children(node.parentId)
        const idx = siblings.findIndex(n => n.id === node.id)
        if (idx > 0) {
          const prevSibling = siblings[idx - 1]
          const prevChildren = store.children(prevSibling.id)
          const order = prevChildren.length > 0
            ? prevChildren[prevChildren.length - 1].siblingOrder + 1
            : Date.now()
          store.updateNode(node.id, { parentId: prevSibling.id, siblingOrder: order })
          // Expand prev sibling if collapsed (efímero, sin sync)
          if (prevSibling.isCollapsed) {
            store.setCollapsedLocal(prevSibling.id, false)
          }
        }
      }
    }

    if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault()
      onSelectNext(node.id, 'up')
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault()
      onSelectNext(node.id, 'down')
    }

    if (e.key === 'Backspace' && text === '') {
      e.preventDefault()
      if (depth > 0) {
        // Nodo vacío e INDENTADO (depth > 0) → desindentar un nivel
        // depth === 0 significa que está al nivel raíz del outliner actual,
        // aunque tenga parentId (p.ej. diary.id) → en ese caso hay que borrar.
        const parent = store.getNode(node.parentId!)
        if (parent) {
          store.updateNode(node.id, { parentId: parent.parentId, siblingOrder: parent.siblingOrder + 0.5 })
          return
        }
      }
      // Nivel raíz del outliner: borrar y mover cursor al bullet anterior
      onSelectNext(node.id, 'up')
      // Limpiar espejos que apuntan a este nodo antes de borrarlo
      const nowIso = new Date().toISOString()
      store.allActive().forEach(n => {
        try {
          const ed = JSON.parse(n.extraData || '{}')
          if (ed._mirrorOf === node.id) store.updateNode(n.id, { deletedAt: nowIso })
        } catch { /* ignore */ }
      })
      store.deleteNode(node.id)
    }

    // Cmd+] → indent, Cmd+[ → outdent (Mac shortcut)
    if (e.key === ']' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const siblings = store.children(node.parentId)
      const idx = siblings.findIndex(n => n.id === node.id)
      if (idx > 0) {
        const prevSibling = siblings[idx - 1]
        const prevChildren = store.children(prevSibling.id)
        const order = prevChildren.length > 0
          ? prevChildren[prevChildren.length - 1].siblingOrder + 1
          : Date.now()
        store.updateNode(node.id, { parentId: prevSibling.id, siblingOrder: order })
      }
    }

    if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (node.parentId) {
        const parent = store.getNode(node.parentId)
        if (parent) {
          store.updateNode(node.id, { parentId: parent.parentId, siblingOrder: parent.siblingOrder + 0.5 })
        }
      }
    }
  }, [node, onSelect, onSelectNext, showSlash, picker]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent<HTMLElement>) {
    _draggedNodeId = node.id
    // Si el nodo arrastrado pertenece a la selección múltiple, arrastrar todos
    const selected = getGlobalSelectedIds()
    if (selected.has(node.id) && selected.size > 1) {
      // Ordenar por siblingOrder para mantener el orden relativo al soltar
      _draggedNodeIds = [...selected].sort((a, b) => {
        const na = store.getNode(a), nb = store.getNode(b)
        return (na?.siblingOrder ?? 0) - (nb?.siblingOrder ?? 0)
      })
    } else {
      _draggedNodeIds = [node.id]
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Archivos del sistema operativo (Finder) → aceptar con cursor 'copy', no mover nodos
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      return
    }
    // Aceptar drag tanto del outliner interno como del agenda/timeline.
    const hasExternalId = !!e.dataTransfer.types.find(t => t === 'cal-node-id' || t === 'text/plain')
    if (!_draggedNodeId && !hasExternalId) return
    // Ignorar si el destino es uno de los nodos arrastrados
    if (_draggedNodeIds.includes(node.id)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    _dropAsChild = (e.clientX - rect.left) / rect.width > 0.65
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function isDescendant(potentialAncestorId: string, checkId: string): boolean {
    let cur = store.getNode(checkId)
    const visited = new Set<string>([checkId])
    while (cur?.parentId && !visited.has(cur.parentId)) {
      if (cur.parentId === potentialAncestorId) return true
      visited.add(cur.parentId)
      cur = store.getNode(cur.parentId)
    }
    return false
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)

    // Fallback a dataTransfer para drops externos (agenda/timeline)
    const primaryId = _draggedNodeId || e.dataTransfer.getData('cal-node-id') || e.dataTransfer.getData('text/plain')
    const nodesToMove = _draggedNodeIds.length > 0 ? _draggedNodeIds : (primaryId ? [primaryId] : [])
    const asChild = _dropAsChild
    _draggedNodeId = null
    _draggedNodeIds = []
    _dropAsChild = false

    if (!nodesToMove.length) return

    // Filtrar: no mover al propio destino ni a sus descendientes
    const valid = nodesToMove.filter(id => id !== node.id && !isDescendant(id, node.id))
    if (!valid.length) return

    if (asChild) {
      // ── Indentados como hijos del destino ───────────────────────────────
      const targetChildren = store.children(node.id).sort((a, b) => a.siblingOrder - b.siblingOrder)
      const base = targetChildren.length > 0
        ? targetChildren[0].siblingOrder - valid.length * 1000
        : 1000
      valid.forEach((id, i) => {
        store.updateNode(id, { parentId: node.id, siblingOrder: base + i * 1000 })
      })
      clearGlobalSelection()
      return
    }

    // ── Al mismo nivel que el destino, antes de él ──────────────────────
    const targetParentId = node.parentId
    // Obtener hermanos SIN los nodos que vamos a mover (para calcular posiciones limpias)
    const siblings = store.children(targetParentId)
      .filter(n => !valid.includes(n.id))
      .sort((a, b) => a.siblingOrder - b.siblingOrder)
    const targetIdx = siblings.findIndex(n => n.id === node.id)
    const targetOrder = node.siblingOrder
    const beforeOrder = targetIdx > 0 ? siblings[targetIdx - 1].siblingOrder : targetOrder - valid.length * 1000

    // Repartir equitativamente entre beforeOrder y targetOrder
    const gap = targetOrder - beforeOrder
    const step = gap / (valid.length + 1)
    valid.forEach((id, i) => {
      store.updateNode(id, {
        parentId: targetParentId,
        siblingOrder: beforeOrder + step * (i + 1),
      })
    })
    clearGlobalSelection()
  }

  function handleDragEnd() {
    _draggedNodeId = null
    _draggedNodeIds = []
    setIsDragOver(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  function applyFormat(type: import('./FormatToolbar').FormatType, extra?: string) {
    if (type === 'copy') {
      const plainText = contentRef.current?.textContent || ''
      navigator.clipboard.writeText(plainText).catch(console.error)
      return
    }

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !contentRef.current) return
    const selectedText = sel.toString()
    if (!selectedText) return

    const range = sel.getRangeAt(0)
    let wrapped = ''
    if (type === 'bold')          wrapped = `**${selectedText}**`
    else if (type === 'italic')   wrapped = `*${selectedText}*`
    else if (type === 'code')     wrapped = `\`${selectedText}\``
    else if (type === 'strikethrough') wrapped = `~~${selectedText}~~`
    else if (type === 'underline') wrapped = `<u>${selectedText}</u>`
    else if (type === 'link')     wrapped = `[${selectedText}](url)`
    else if (type === 'h1')       wrapped = `# ${selectedText}`
    else if (type === 'h2')       wrapped = `## ${selectedText}`
    else if (type === 'h3')       wrapped = `### ${selectedText}`
    else if (type === 'text-color') {
      wrapped = extra ? `<span style="color:${extra}">${selectedText}</span>` : selectedText
    }
    else if (type === 'highlight') {
      wrapped = extra ? `<span style="background-color:${extra};border-radius:2px;padding:0 2px">${selectedText}</span>` : selectedText
    }

    // Reemplazar la selección con texto formateado
    range.deleteContents()
    range.insertNode(document.createTextNode(wrapped))
    sel.removeAllRanges()

    // Sincronizar al store
    const newText = contentRef.current.textContent || ''
    nodeTextRef.current = newText
    store.updateNode(node.id, { text: newText })
  }

  function toggleCollapse() {
    // Colapso efímero por sesión (sin sync): expandir = isCollapsed false.
    store.setCollapsedLocal(node.id, node.isCollapsed === false)
  }

  /** ID de navegación: para espejos de padre, navega al nodo real */
  const navTargetId = mirrorOfId && !mirrorSourceNode?.isDiaryEntry ? mirrorOfId : node.id

  /** Borrar nodo + limpiar espejos que lo referencian */
  function deleteWithCleanup() {
    const now = new Date().toISOString()
    // Borrar espejos (_mirrorOf) que apuntan a este nodo
    store.allActive().forEach(n => {
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._mirrorOf === node.id) store.updateNode(n.id, { deletedAt: now })
      } catch { /* ignore */ }
    })
    // Si está bajo un espejo de padre, borrarlo si queda vacío
    if (node.parentId) {
      const parent = store.getNode(node.parentId)
      if (parent) {
        try {
          const ed = JSON.parse(parent.extraData || '{}')
          if (ed._mirrorOf) {
            const remaining = store.children(parent.id).filter(c => !c.deletedAt && c.id !== node.id)
            if (remaining.length === 0) store.updateNode(parent.id, { deletedAt: now })
          }
        } catch { /* ignore */ }
      }
    }
    store.updateNode(node.id, { deletedAt: now })
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `"${(node.text || 'Nodo').slice(0, 30)}" eliminado`, type: 'info' } }))
  }

  function acceptDatePrediction() {
    if (!datePrediction) return
    const { cleanText, parsed, timeStr, isEvent: detectedAsEvent } = datePrediction as DateExtraction & { recurrence?: RecurrenceConfig }
    setDatePrediction(null)
    nodeTextRef.current = cleanText
    store.updateNode(node.id, { text: cleanText })
    if (contentRef.current) contentRef.current.textContent = cleanText
    const targetDate = new Date(parsed.date); targetDate.setHours(0,0,0,0)
    const updates: Record<string, unknown> = { due: targetDate.toISOString() }
    if (timeStr) {
      const h = parseInt(timeStr.split(':')[0]), m = parseInt(timeStr.split(':')[1])
      updates.due = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), h, m).toISOString()
    }
    // Si la predicción detectó evento (tiene hora o keywords de evento) → marcar como evento, no tarea
    if (detectedAsEvent || timeStr) {
      updates.isEvent = true
      updates.status = null
    } else {
      updates.status = node.status ?? 'pending'
    }
    if (parsed.recurrence) updates.recurrence = recurrenceToString(parsed.recurrence)
    store.updateNode(node.id, updates)
    // Sync a GCal si hay hora (falla silenciosamente si GCal no está conectado)
    if (timeStr) scheduleGCalSync()
    const label = parsed.label + (timeStr ? ` · ${timeStr}` : '')
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `📅 Fecha: ${label}`, type: 'success' } }))
  }

  function acceptCtxCompletion() {
    if (!ctxCompletion || !contentRef.current) return
    const text = contentRef.current.textContent || ''
    const pos = getCaretPosition(contentRef.current)
    const before = text.slice(0, pos)
    const after = text.slice(pos)
    // Quitar el trozo que ya escribió el usuario y reemplazar por @slug al final
    const beforeWithout = before.slice(0, before.length - ctxCompletion.typedLen)
    const cleanText = (beforeWithout + after).trim()
    const tagText = `@${ctxCompletion.slug}`
    const newText = cleanText + (cleanText ? ' ' : '') + tagText
    const newTypes = (node.types || []).includes(ctxCompletion.slug)
      ? node.types : [...(node.types || []), ctxCompletion.slug]
    store.updateNode(node.id, { text: newText, types: newTypes })
    ensureTagInTree(ctxCompletion.slug)
    if (contentRef.current) {
      contentRef.current.innerHTML = renderInlineToHtml(newText)
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(contentRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setCtxCompletion(null)
  }

  /** Crea la siguiente instancia de un nodo recurrente en el día correcto del diario */
  function spawnRecurrence(rec: RecurrenceConfig) {
    try {
      const parent = store.getNode(node.parentId || '')
      const baseDate = parent?.diaryDate ? new Date(parent.diaryDate) : new Date()
      baseDate.setHours(0, 0, 0, 0)
      const nextDate = nextRecurrence(baseDate, rec)
      const dayNode = ensureDayPath(nextDate)
      const sibs = store.children(dayNode.id)
      const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(x => x.siblingOrder)) : 0
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch {}

      // Calcular el due del nuevo nodo:
      // - Evento con hora → preservar la hora en el nuevo día
      // - Tarea o evento sin hora → usar la fecha del nuevo día
      let newDue: string | undefined
      if (node.due) {
        const origDue = new Date(node.due)
        const hasTime = origDue.getHours() !== 0 || origDue.getMinutes() !== 0
        if (hasTime) {
          newDue = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(),
            origDue.getHours(), origDue.getMinutes()).toISOString()
        } else {
          newDue = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()).toISOString()
        }
      }

      const newNode = store.createNode({
        text: node.text,
        parentId: dayNode.id,
        siblingOrder: lastOrder + 1000,
        isTask: !node.isEvent,  // tarea si no es evento
        types: node.types,
      })
      store.updateNode(newNode.id, {
        ...(node.isEvent ? { isEvent: true } : { status: 'pending' }),
        ...(newDue ? { due: newDue } : {}),
        recurrence: node.recurrence ?? undefined,
        extraData: JSON.stringify({ ...ed, _recurrence: rec }),
      })
    } catch (e) {
      console.error('[recurrence] Error creando siguiente instancia:', e)
    }
  }

  function toggleTask() {
    if (node.status === null) {
      const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      store.updateNode(node.id, { status: 'pending', due: node.due ?? todayISO })
    } else if (node.status === 'pending') {
      store.updateNode(node.id, { status: 'done' })
      // ── Recurrencia: crear siguiente instancia ────────────────────────────
      // Prioritario: node.recurrence (campo DB); fallback: extraData._recurrence (legado)
      const recStr = node.recurrence
      let rec: RecurrenceConfig | undefined
      if (recStr) {
        rec = recurrenceFromString(recStr) ?? undefined
      } else {
        try {
          const ed = JSON.parse(node.extraData || '{}')
          rec = ed._recurrence as RecurrenceConfig | undefined
        } catch {}
      }
      if (rec) spawnRecurrence(rec)
    } else {
      store.updateNode(node.id, { status: null })
    }
  }

  /** Alterna solo entre pending y done sin eliminar el tipo tarea (para click en el checkbox) */
  function toggleCheckbox() {
    if (node.status === 'done') {
      store.updateNode(node.id, { status: 'pending' })
    } else {
      // pending o null → done (con gestión de recurrencia igual que toggleTask)
      store.updateNode(node.id, { status: 'done' })
      // ── Recurrencia: crear siguiente instancia ────────────────────────────
      // Prioritario: node.recurrence (campo DB); fallback: extraData._recurrence (legado)
      const recStr = node.recurrence
      let rec: RecurrenceConfig | undefined
      if (recStr) {
        rec = recurrenceFromString(recStr) ?? undefined
      } else {
        try {
          const ed = JSON.parse(node.extraData || '{}')
          rec = ed._recurrence as RecurrenceConfig | undefined
        } catch {}
      }
      if (rec) spawnRecurrence(rec)
    }
  }

  function toggleBucle(e: React.MouseEvent) {
    e.stopPropagation()
    store.updateNode(node.id, { status: node.status === 'done' ? null : 'done' })
  }

  function openNode() {
    navigate(`/node/${node.id}`)
  }

  function handleCodeSelect(code: string) {
    const el = contentRef.current
    if (!el) { setShowCodePicker(false); setCodeQuery(''); return }
    const text = nodeTextRef.current
    const caretPos = getCaretPosition(el)
    const beforeCaret = text.slice(0, caretPos)
    const braceIdx = beforeCaret.lastIndexOf('{{')
    if (braceIdx === -1) { setShowCodePicker(false); setCodeQuery(''); return }
    const inserted = `{{${code}}}`
    const newText = text.slice(0, braceIdx) + inserted + text.slice(caretPos)
    nodeTextRef.current = newText
    store.updateNode(node.id, { text: newText })
    el.textContent = newText
    // Reposicionar cursor tras el código insertado
    try {
      const range = document.createRange()
      const sel = window.getSelection()
      const textNode = el.firstChild
      if (textNode) {
        const newPos = Math.min(braceIdx + inserted.length, (textNode as Text).length)
        range.setStart(textNode, newPos)
        range.collapse(true)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    } catch { /* ignore */ }
    setShowCodePicker(false)
    setCodeQuery('')
  }

  /**
   * Cuando un nodo con hijos se convierte en heading, sus hijos "suben" al mismo
   * nivel que el heading: dejan de ser hijos del heading y pasan a ser hermanos
   * inmediatamente después de él. Resultado: heading + contenido al mismo nivel
   * (estilo documento).
   */
  function liftChildrenAfterHeading(headingNodeId: string) {
    const headingNode = store.getNode(headingNodeId)
    if (!headingNode) return
    const children = store.children(headingNodeId).filter(c => !c.deletedAt)
    if (children.length === 0) return

    const grandParentId = headingNode.parentId
    const siblings = store.children(grandParentId).filter(c => !c.deletedAt).sort((a, b) => a.siblingOrder - b.siblingOrder)
    const headingIdx = siblings.findIndex(s => s.id === headingNodeId)
    const nextSibling = headingIdx >= 0 ? siblings[headingIdx + 1] : undefined

    // Calcular rango de siblingOrder para insertar los hijos entre el heading y su siguiente hermano.
    const baseOrder = headingNode.siblingOrder
    const endOrder = nextSibling ? nextSibling.siblingOrder : baseOrder + children.length * 1000 + 1000
    const step = (endOrder - baseOrder) / (children.length + 1)

    children.forEach((child, i) => {
      store.updateNode(child.id, {
        parentId: grandParentId,
        siblingOrder: baseOrder + step * (i + 1),
      })
    })
  }

  function handleSlashSelect(payload: SlashSelectPayload) {
    const { prefix, action } = payload

    // ── move-to-prompt: reabrir slash con "mover a " pre-rellenado ──────────
    if (action === 'move-to-prompt') {
      setSlashQuery('mover a ')
      setShowSlash(true)
      return
    }

    setShowSlash(false)
    setSlashQuery('')

    // Preserve existing text: remove the slash+query and apply prefix to the rest
    const currentText = contentRef.current?.textContent || nodeTextRef.current || ''
    const curPos = (() => {
      try { return getCaretPosition(contentRef.current!) } catch { return currentText.length }
    })()
    const beforeCursor = currentText.slice(0, curPos)
    const slashIdx = beforeCursor.lastIndexOf('/')
    const beforeSlash = slashIdx >= 0 ? currentText.slice(0, slashIdx).trimEnd() : ''
    const afterCursor = currentText.slice(curPos).trimStart()
    const existingContent = (beforeSlash + (afterCursor ? ' ' + afterCursor : '')).trimStart()
    // No usar trimEnd cuando el prefix termina en espacio (heading, bullet, quote…).
    // detectBlockType depende del espacio tras `#`/`##`/`###`/`-`/`>` para detectar el bloque.
    const prefixEndsInSpace = prefix.endsWith(' ')
    const newText = prefixEndsInSpace && !existingContent
      ? prefix
      : (prefix + existingContent).trimEnd()

    nodeTextRef.current = newText

    const todayISOslash = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const updates: Record<string, unknown> = { text: newText }
    if (action === 'bullet') {
      // Bullet: marca via extraData._block='bullet'. No usar prefijo "- " visible.
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch {}
      ed._block = 'bullet'
      updates.text = existingContent
      updates.extraData = JSON.stringify(ed)
      nodeTextRef.current = existingContent as string
      store.updateNode(node.id, updates)
      if (contentRef.current) {
        contentRef.current.textContent = existingContent
        contentRef.current.focus()
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      return
    }
    if (action === 'heading-1' || action === 'heading-2' || action === 'heading-3') {
      // Heading: marca via extraData._block='h1'/'h2'/'h3'. Texto sin prefijo "# ".
      const level = action === 'heading-1' ? 'h1' : action === 'heading-2' ? 'h2' : 'h3'
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch {}
      ed._block = level
      updates.text = existingContent
      updates.extraData = JSON.stringify(ed)
      nodeTextRef.current = existingContent as string
      store.updateNode(node.id, updates)
      // Si el nodo tiene hijos, subirlos al padre del heading como hermanos inmediatamente después.
      // Resultado: heading seguido de su contenido al mismo nivel (estilo documento).
      liftChildrenAfterHeading(node.id)
      if (contentRef.current) {
        contentRef.current.textContent = existingContent
        contentRef.current.focus()
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      return
    }
    if (action === 'task') {
      updates.status = 'pending'
      if (!node.due) updates.due = todayISOslash
    } else if (action === 'expand') {
      // "Ampliar": la tarea actual se convierte en nota contenedora con su
      // copia como primera sub-tarea. Si no es tarea, no-op.
      if (node.status !== null) {
        const result = store.expandToContainer(node.id)
        if (result) navigate(`/node/${result.containerId}`)
      }
      return
    } else if (action === 'event') {
      updates.isEvent = true
      updates.status = null
      if (!node.due) updates.due = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    } else if (action === 'whiteboard') {
      // Marcar como pizarra y navegar al nodo
      // updates.text ya contiene el texto limpio (sin el /pizarra) calculado por handleSlashSelect
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      ed._isWhiteboard = '1'
      updates.extraData = JSON.stringify(ed)
      // Si no queda texto (el nodo solo tenía /pizarra), usar "Pizarra" como título
      if (!updates.text) updates.text = 'Pizarra'
      store.updateNode(node.id, updates)
      navigate(`/node/${node.id}`)
      return
    } else if (action === 'nota') {
      // Crear nodo vacío con tipo nota y navegar inmediatamente
      const existingTypes = node.types || []
      if (!existingTypes.includes('nota')) {
        updates.types = [...existingTypes, 'nota']
      }
      updates.text = prefix // prefix = '' para nota
      store.updateNode(node.id, updates)
      navigate(`/node/${node.id}`)
      return
    } else if (action === 'resource') {
      // Marcar como recurso. La ResourcesView lo recogerá. Paridad Mac.
      updates.isResource = true
      updates.status = null
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      ed._resourceType = 'url'
      ed._resourceStatus = 'pending'
      updates.extraData = JSON.stringify(ed)
    } else if (action === 'agent') {
      // Agente IA: marca el tipo. La AgentsView lo recoge.
      const existingTypes = node.types || []
      if (!existingTypes.includes('agente')) {
        updates.types = [...existingTypes, 'agente']
      }
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      ed.elementMode = 'agente'
      updates.extraData = JSON.stringify(ed)
    } else if (action === 'prompt') {
      // Plantilla de prompt reusable.
      const existingTypes = node.types || []
      if (!existingTypes.includes('prompt')) {
        updates.types = [...existingTypes, 'prompt']
      }
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      ed.elementMode = 'prompt'
      updates.extraData = JSON.stringify(ed)
    } else if (action === 'view-table' || action === 'view-kanban' || action === 'view-calendar' || action === 'view-list') {
      // Marcar este nodo como bloque vista inline. Guardamos viewBlock+_inline
      // en extraData. Los componentes inline renderizan el nodo como tabla/
      // kanban/calendario en lugar de su texto plano.
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
      ed.viewBlock = action === 'view-table' ? 'tabla'
        : action === 'view-kanban' ? 'kanban'
        : action === 'view-list'    ? 'lista'
        : 'calendario'
      ed._inline = '1'
      // Si el nodo no tiene texto aún (limpiando ya el /tabla/etc), ponerle un título descriptivo
      const defaultLabel = action === 'view-table' ? 'Tabla'
        : action === 'view-kanban' ? 'Kanban'
        : action === 'view-list'    ? 'Lista' : 'Calendario'
      // newText ya viene con el slash query stripped (cálculo de arriba)
      const finalText = newText.trim() || defaultLabel
      store.updateNode(node.id, {
        text: finalText,
        extraData: JSON.stringify(ed),
      })
      // Forzar re-render del contenido limpio (sin /ta o lo que fuera)
      if (contentRef.current) contentRef.current.textContent = finalText
      nodeTextRef.current = finalText
      return
    }

    // ── Nuevas acciones WF ──────────────────────────────────────────────────
    if (action === 'move-today') {
      const today = new Date(); today.setHours(0,0,0,0)
      store.updateNode(node.id, { due: today.toISOString(), status: node.status ?? 'pending' })
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: '📅 Fecha: hoy', type: 'success' } }))
      return
    } else if (action === 'move-tomorrow') {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0)
      store.updateNode(node.id, { due: d.toISOString(), status: node.status ?? 'pending' })
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: '📅 Fecha: mañana', type: 'success' } }))
      return
    } else if (action === 'move-next-week') {
      const d = new Date()
      const dow = d.getDay()
      d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow)); d.setHours(0,0,0,0)
      store.updateNode(node.id, { due: d.toISOString(), status: node.status ?? 'pending' })
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: '📅 Fecha: próxima semana', type: 'success' } }))
      return
    } else if (action === 'move-to' && payload.moveToDate) {
      const d = new Date(payload.moveToDate); d.setHours(0,0,0,0)
      const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      const updates: Record<string, unknown> = { due: d.toISOString(), status: node.status ?? 'pending' }
      if (payload.moveToRecurrence) updates.recurrence = recurrenceToString(payload.moveToRecurrence)
      store.updateNode(node.id, updates)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `📅 Fecha: ${label}`, type: 'success' } }))
      return
    } else if (action === 'expand-all') {
      const getAllDescEx = (id: string): string[] => {
        const kids = store.children(id)
        return kids.flatMap(k => [k.id, ...getAllDescEx(k.id)])
      }
      store.setCollapsedLocal(node.id, false)
      for (const id of getAllDescEx(node.id)) store.setCollapsedLocal(id, false)
      return
    } else if (action === 'collapse-all') {
      const getAllDescCo = (id: string): string[] => {
        const kids = store.children(id)
        return kids.flatMap(k => [k.id, ...getAllDescCo(k.id)])
      }
      for (const id of getAllDescCo(node.id)) store.setCollapsedLocal(id, true)
      return
    } else if (action === 'count-children') {
      const count = store.children(node.id).filter(c => !c.deletedAt).length
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `${count} nodo${count !== 1 ? 's' : ''} hijo${count !== 1 ? 's' : ''}` } }))
      return
    } else if (action === 'ai-summarize') {
      window.dispatchEvent(new CustomEvent('from:ai-inline', { detail: { nodeId: node.id, prompt: 'Resume el contenido de este nodo y sus hijos en un párrafo conciso.' } }))
      return
    } else if (action === 'ai-find-tasks') {
      window.dispatchEvent(new CustomEvent('from:ai-inline', { detail: { nodeId: node.id, prompt: 'Encuentra y lista todas las tareas pendientes o acciones mencionadas en este nodo y sus hijos.' } }))
      return
    } else if (action === 'ai-draft-outline') {
      window.dispatchEvent(new CustomEvent('from:ai-inline', { detail: { nodeId: node.id, prompt: 'Crea un esquema estructurado (outline) del contenido de este nodo.' } }))
      return
    } else if (action === 'ai-fix-grammar') {
      window.dispatchEvent(new CustomEvent('from:ai-inline', { detail: { nodeId: node.id, prompt: 'Corrige los errores gramaticales y de estilo del texto de este nodo manteniendo el significado.' } }))
      return
    } else if (action === 'ai-make-shorter') {
      window.dispatchEvent(new CustomEvent('from:ai-inline', { detail: { nodeId: node.id, prompt: 'Reescribe este contenido de forma más concisa y directa, sin perder información clave.' } }))
      return
    } else if (action === 'add-shortcut') {
      // Atajo eliminado — solo togglear favorito
      store.updateNode(node.id, { isFavorite: !node.isFavorite })
      return
    } else if (action === 'delete') {
      deleteWithCleanup()
      return
    } else if (action === 'mirror') {
      // Abrir picker de búsqueda para seleccionar el nodo a espejar
      // El nodo actual (donde se escribió /Espejo) se vaciará y convertirá en el espejo
      const allNodes = store.allActive()
        .filter(n => !n.deletedAt && n.id !== node.id && n.text)
        .slice(0, 10)
        .map(n => ({ id: n.id, label: n.text, status: n.status, types: n.types || [], bodyPreview: n.body?.slice(0, 30) }))
      store.updateNode(node.id, { text: '' })
      if (contentRef.current) contentRef.current.textContent = ''
      setPicker({ type: 'mirror', query: '', items: allNodes, activeIdx: 0 })
      setTimeout(() => contentRef.current?.focus(), 0)
      return
    } else if (action === 'duplicate') {
      const parentId = node.parentId
      const sibs = store.children(parentId)
      const newOrder = node.siblingOrder + 1
      for (const s of sibs) {
        if (s.siblingOrder >= newOrder && s.id !== node.id) {
          store.updateNode(s.id, { siblingOrder: s.siblingOrder + 1 })
        }
      }
      store.createNode({
        text: node.text,
        parentId,
        isTask: node.status !== null && node.status !== undefined,
        due: node.due,
        siblingOrder: newOrder,
      })
      return
    } else if (action === 'add-date') {
      const dateStr = prompt('Fecha de vencimiento (YYYY-MM-DD):', new Date().toISOString().slice(0, 10))
      if (dateStr) {
        const d = new Date(dateStr + 'T00:00:00')
        if (!isNaN(d.getTime())) {
          store.updateNode(node.id, { due: d.toISOString(), status: node.status ?? 'pending' })
        }
      }
      return
    } else if (action === 'recurrence' && payload.recurrence) {
      // Asignar recurrencia al nodo: guardar en node.recurrence (campo DB) y extraData._recurrence (legado)
      const rec = payload.recurrence
      const recStr = recurrenceToString(rec)
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch {}
      ed._recurrence = rec
      store.updateNode(node.id, {
        recurrence: recStr,
        extraData: JSON.stringify(ed),
        // Si no es tarea aún, convertir a tarea pendiente
        ...(node.status === null ? { status: 'pending' } : {}),
      })
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Repetición configurada: ${rec.display}`, type: 'success' } }))
      return
    }

    store.updateNode(node.id, updates)

    if (contentRef.current) {
      const displayText = newText.replace(/ $/, ' ')
      contentRef.current.textContent = displayText
      contentRef.current.focus()
      const textNode = contentRef.current.firstChild
      const range = document.createRange()
      const sel = window.getSelection()
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, displayText.length)
        range.collapse(true)
      } else {
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
      }
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }

  const hasChildren = children.length > 0

  // Overdue check — usa effectiveNode (el original si es espejo)
  const isOverdue = !!effectiveNode.due && effectiveNode.status !== 'done' && (() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return new Date(effectiveNode.due!) < todayStart
  })()

  // Clase de color del checkbox (usa effectiveNode para espejos)
  const isToday = !!effectiveNode.due && !isOverdue && (() => {
    const d = new Date(effectiveNode.due!)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  })()

  const taskCheckClass = effectiveNode.status === 'done'
    ? 'task-sq--done'
    : isOverdue
      ? 'task-sq--overdue'
      : isToday
        ? 'task-sq--pending'         // amarillo — tarea de hoy
        : 'task-sq--future'          // azul — futura o sin fecha

  // ── Recurso ──────────────────────────────────────────────────────────────
  const resourceData = (() => {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (!ed._resource) return null
      return { status: (ed._resourceStatus || 'pending') as string, url: ed._resourceUrl as string | undefined }
    } catch { return null }
  })()
  // No mostrar checkbox de recurso pendiente para archivos (pdf, imagen, file) — solo para URLs
  const isResourcePending = !!resourceData && resourceData.status === 'pending'
    && !['pdf','image','file'].includes(((() => { try { return JSON.parse(node.extraData||'{}')._resourceType } catch { return null } })()||''))
  // URL navegable del nodo (recurso o campo resourceUrl)
  const nodeUrl = resourceData?.url || node.resourceUrl || null

  // Tipo de recurso para mostrar thumbnail
  const nodeResourceType = (() => {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      return (ed._resourceType || node.resourceType || null) as string | null
    } catch { return null }
  })()
  const isImageResource = nodeUrl && (nodeResourceType === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(nodeUrl))

  // Auto-detect URL en texto del nodo inline → marca como recurso + unfurl
  useEffect(() => {
    const text = (node.text || '').trim()
    if (!isUrl(text)) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._resource) return
    } catch {}
    // Marcar como recurso (y quitar status de tarea para que muestre icono de enlace)
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    ed._resource = true
    ed._resourceUrl = text
    store.updateNode(node.id, { extraData: JSON.stringify(ed), status: null })
    // Unfurl
    unfurlUrl(text).then(meta => {
      let ed2: Record<string, unknown> = {}
      try { ed2 = JSON.parse(store.getNode(node.id)?.extraData || '{}') } catch {}
      ed2._resourceMeta = meta
      ed2._resourceType = meta.type
      store.updateNode(node.id, { text: meta.title || text, extraData: JSON.stringify(ed2) })
    }).catch(() => {})
  }, [node.text]) // eslint-disable-line

  // Quick-props helpers: fecha/hora/repetición/prioridad en el popup inline
  const qDueDate = isoToLocalDate(node.due)
  const qDueTime = isoToLocalTime(node.due)
  function setQDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    store.updateNode(node.id, { due: makeDueISO(date, time) })
  }
  const qDueBadgeLabel = node.due
    ? new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : 'sin fecha'
  const qNextMondayDays = (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })()

  // Nodo es ancestro (da contexto) pero no coincide él mismo → estilo atenuado WF
  const isAncestorContext = anyDescendantMatches && !matchesFilter && !!filterMatchIds

  // Filtro activo y este nodo es ancestro: forzar expansión para mostrar la cadena hasta el match.
  // Si el nodo ES el match directo y tiene descendientes que también coinciden (está en filterAncestorIds),
  // expandirlo para que se vean esos hijos. Si no tiene hijos-match, colapsarlo.
  // anyDescendantMatches solo es true cuando !matchesFilter, así que para nodos que
  // coinciden Y tienen hijos-match usamos filterAncestorIds directamente.
  const hasMatchingDescendants = !!(filterAncestorIds?.has(node.id))
  // Sin filtro activo: comportamiento normal (respetar isCollapsed del usuario).
  // Con filtro activo: si es match directo sin hijos-match, ocultar hijos; si es
  //   ancestro de match o está expandido, mostrarlos.
  const showChildren = !(activeFilter || filterMatchIds)
    ? !isCollapsed  // sin filtro: respetar el estado de colapso del chevron
    : matchesFilter && !hasMatchingDescendants
      ? false  // filtro activo, match directo sin hijos-match → colapsar
      : (!isCollapsed || anyDescendantMatches || hasMatchingDescendants)

  // Filter exit animation — when node leaves active filter, animate out before hiding
  const shouldFilterHide = !!(activeFilter && !matchesFilter && !anyDescendantMatches)
  useEffect(() => {
    if (shouldFilterHide && !filterHidden && !filterExiting) {
      // Start exit animation; hide for real after it completes
      setFilterExiting(true)
      filterExitTimerRef.current = setTimeout(() => {
        setFilterExiting(false)
        setFilterHidden(true)
      }, 320)
    }
    if (!shouldFilterHide) {
      if (filterExitTimerRef.current) clearTimeout(filterExitTimerRef.current)
      setFilterExiting(false)
      setFilterHidden(false)
    }
    return () => {
      if (filterExitTimerRef.current) clearTimeout(filterExitTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFilterHide])

  // Hide node: only after animation completes
  if (filterHidden) return null

  // moved-ref: NO hacer render custom — dejar que el nodo renderice normalmente
  // con la clase node-row--moved-ref aplicada vía nodeRowClass.
  // Esto garantiza alineación 100% idéntica al resto de nodos.

  // Determine CSS class for block type
  const nodeRowClass = [
    'node-row',
    isSelected ? 'selected' : '',
    isMultiSelected ? 'multi-selected' : '',
    node.status === 'done' && !isBucle ? 'done' : '',
    isHeading ? `node-row--${blockType}` : '',
    isBullet ? 'node-row--bullet' : '',
    isDragOver ? 'drag-over' : '',
    isAncestorContext ? 'wf-filter-ancestor' : '',
    ctxRef ? 'node-row--ctx-ref' : '',
    taskConverting ? 'node-row--task-converting' : '',
    mirrorOfId ? 'node-row--mirror' : '',
    filterExiting ? 'node-row--filter-exit' : '',
  ].filter(Boolean).join(' ')

  // Picker position — fixed al viewport (portal a document.body)
  const pickerStyle: React.CSSProperties = { position: 'fixed', zIndex: 1000 }
  if (contentRef.current && picker) {
    const rect = getCursorRect(contentRef.current)
    pickerStyle.top = rect.bottom + 4
    pickerStyle.left = Math.max(8, Math.min(rect.left, window.innerWidth - 220))
  }

  return (
    <div
      className="outliner-node"
      data-node-id={node.id}
      style={{ '--depth': depth } as React.CSSProperties}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isSelected}
    >
      <div
        className={nodeRowClass}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        onClick={e => {
          if (e.shiftKey && onShiftSelect) {
            e.preventDefault()
            onShiftSelect(node.id)
          }
        }}
        style={nodeColor
          ? { boxShadow: `inset 3px 0 0 ${nodeColor}`, paddingLeft: depth * 22 }
          : { paddingLeft: depth * 22 }
        }
      >

        {/* Drag handle — visible en hover. Arrastra para mover; clic para seleccionar/deseleccionar (+ hijos). */}
        {!isDivider && (
          <span
            className={`node-drag-handle${isMultiSelected ? ' node-drag-handle--selected' : ''}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            title="Arrastra para mover · Click para seleccionar/deseleccionar"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              toggleNodeSelection(node.id, store)
              // Abrir el menú en la mitad derecha de la ventana para no tapar el texto del nodo
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const menuX = Math.max(window.innerWidth * 0.55, rect.right + 8)
              openSelectionMenu({ x: menuX, y: rect.top })
            }}
            aria-label="Seleccionar nodo"
          >⋮⋮</span>
        )}

        {/* Three-dot hover menu (WF-style) — siempre en DOM para no desplazar contenido */}
        {!isDivider && (
          <button
            className={`node-three-dot-btn${hovered ? ' node-three-dot-btn--visible' : ''}`}
            onClick={e => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setContextMenu({ x: rect.left, y: rect.bottom })
            }}
            title="Más opciones"
            tabIndex={-1}
            aria-hidden={!hovered}
          >
            ···
          </button>
        )}

        {/* Collapse toggle — hidden for headings and dividers */}
        {!isDivider && (
          <button
            className={`collapse-btn ${(hasChildren && !isHeading) ? '' : 'invisible'}`}
            onClick={e => {
              if (e.altKey) {
                // Alt+Click: colapsar/expandir todo el subárbol
                const allDesc = getAllDescendants(node.id)
                const anyExpanded = allDesc.some(id => store.getNode(id)?.isCollapsed === false)
                for (const id of allDesc) {
                  store.setCollapsedLocal(id, anyExpanded)
                }
                store.setCollapsedLocal(node.id, anyExpanded)
              } else {
                toggleCollapse()
              }
            }}
            tabIndex={-1}
            aria-label={isCollapsed ? 'Expandir nodo' : 'Colapsar nodo'}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expandir (click) · Alt+click: expandir todo' : 'Colapsar (click) · Alt+click: colapsar todo'}
            style={{ position: 'relative' }}
          >
            <svg
              className={`collapse-arrow ${isCollapsed ? 'collapsed' : ''}`}
              width="10" height="10" viewBox="0 0 10 10"
            >
              <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
            {/* Número de hijos eliminado: redundante con el chevron */}
          </button>
        )}

        {/* Bullet / task checkbox / nota icon — hidden for headings and dividers */}
        {/* node-bullet-slot: gutter de ancho fijo (44px) que alinea SIEMPRE el inicio del texto
            en la misma columna, tenga el nodo 1 marcador (nota/texto) o 2 (nav-dot + checkbox en
            tareas/eventos/recursos). Los marcadores se pegan al texto (justify-flex-end). */}
        {!isDivider && !isHeading && (
          <span className="node-bullet-slot">
            {effectiveNode.isEvent ? (
              // Evento: nav-dot + icono calendario (igual para espejos, el muted viene del CSS del row)
              <>
                <button className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`} onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }} tabIndex={-1} title={mirrorOfId ? 'Espejo → ver original' : 'Abrir evento'} />
                <button
                  className="bullet-btn bullet-btn--event"
                  onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }}
                  tabIndex={-1}
                  title="Evento"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="2" width="14" height="13" rx="2"/>
                    <path d="M1 6h14M5 1v3M11 1v3"/>
                  </svg>
                </button>
              </>
            ) : isBucle ? (
              // Bucle: nav-dot + icono de bucle. Abierto = arco violeta; cerrado = círculo gris.
              <>
                <button className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`} onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }} tabIndex={-1} title={mirrorOfId ? 'Espejo → ver original' : 'Zoom in →'} />
                <button
                  className={`bullet-btn bullet-btn--bucle ${isBucleClosed ? 'bullet-btn--bucle-closed' : 'bullet-btn--bucle-open'}`}
                  onClick={toggleBucle}
                  tabIndex={-1}
                  aria-label="Abrir/cerrar bucle"
                  title={isBucleClosed ? 'Bucle cerrado — clic para reabrir' : 'Bucle abierto — clic para cerrar'}
                >
                  {isBucleClosed ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="7" cy="7" r="4.5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 7a4.5 4.5 0 1 1-1.3-3.2"/>
                      <path d="M11.5 1.8v2.7H8.8"/>
                    </svg>
                  )}
                </button>
              </>
            ) : effectiveNode.status !== null ? (
              // Tarea: nav-dot + checkbox (igual para espejos, el muted viene del CSS del row)
              <>
                <button className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`} onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }} tabIndex={-1} title={mirrorOfId ? 'Espejo → ver original' : 'Zoom in →'} />
                <button
                  className={`bullet-btn task ${taskCheckClass}`}
                  onClick={toggleCheckbox}
                  tabIndex={-1}
                  aria-label="Toggle tarea"
                  title="Marcar hecha/pendiente"
                >
                  {effectiveNode.status === 'done' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
                      <path d="M3.5 7l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
                    </svg>
                  )}
                </button>
              </>
            ) : (nodeUrl && !['pdf','image','file'].includes(nodeResourceType||'')) ? (
              // Enlace/URL: icono 🔗 como bullet → navega a la nota (como cualquier otro bullet)
              <button
                className="bullet-btn nota-btn"
                onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }}
                tabIndex={-1}
                title="Abrir nota"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13H13a2 2 0 0 0 0-4h-1M6 3H3a2 2 0 0 0 0 4h1M8 8h0"/>
                  <path d="M6 8h4"/>
                </svg>
              </button>
            ) : isResourcePending ? (
              // Recurso pendiente: nav-dot + checkbox cian
              <>
                <button
                  className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }}
                  tabIndex={-1}
                  title="Abrir recurso"
                />
                <button
                  className="bullet-btn task task-sq--resource"
                  onClick={e => {
                    e.stopPropagation()
                    let ed: Record<string, unknown> = {}
                    try { ed = JSON.parse(node.extraData || '{}') } catch {}
                    ed._resourceStatus = resourceData?.status === 'done' ? 'pending' : 'done'
                    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
                  }}
                  tabIndex={-1}
                  title="Marcar recurso como procesado"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
                  </svg>
                </button>
              </>
            ) : (() => { try { return JSON.parse(node.extraData||'{}')._isWhiteboard === '1' } catch { return false } })() ? (
              // Pizarra digital: icono de pizarra, click abre el nodo
              <button
                className="bullet-btn nota-btn"
                onClick={() => navigate(`/node/${node.id}`)}
                tabIndex={-1}
                title="Clic para abrir pizarra"
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3182ce', letterSpacing: '-0.5px' }}>WB</span>
              </button>
            ) : nodeResourceType === 'pdf' ? (
              // Archivo PDF: icono PDF, click abre el nodo
              <button
                className="bullet-btn nota-btn"
                onClick={() => navigate(`/node/${node.id}`)}
                tabIndex={-1}
                aria-label="Abrir PDF"
                title="Clic para abrir PDF"
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e53e3e', letterSpacing: '-0.5px' }}>PDF</span>
              </button>
            ) : nodeResourceType === 'image' ? (
              // Archivo imagen: icono imagen, click abre el nodo
              <button
                className="bullet-btn nota-btn"
                onClick={() => navigate(`/node/${node.id}`)}
                tabIndex={-1}
                aria-label="Abrir imagen"
                title="Clic para abrir imagen"
              >
                <span style={{ fontSize: 12 }}>🖼</span>
              </button>
            ) : node.isResource ? (
              // Archivo genérico: icono adjunto, click abre el nodo
              <button
                className="bullet-btn nota-btn"
                onClick={() => navigate(`/node/${node.id}`)}
                tabIndex={-1}
                title="Clic para abrir archivo"
              >
                <span style={{ fontSize: 12 }}>📎</span>
              </button>
            ) : isNota ? (
              // Nota hija: icono de página, click navega
              <button
                className="bullet-btn nota-btn"
                onClick={() => navigate(`/node/${node.id}`)}
                tabIndex={-1}
                aria-label="Abrir nota"
                title="Clic para abrir esta nota"
              >
                <span style={{ fontSize: 12 }}>📄</span>
              </button>
            ) : isBullet ? (
              // Lista: nav-dot igual que texto normal (visible/invisible según hijos)
              <button
                className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                tabIndex={-1}
                title="Zoom in →"
              />
            ) : (
              // Texto normal: dot navegador (igual para espejos)
              <button className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`} onClick={e => { e.stopPropagation(); navigate(`/node/${navTargetId}`) }} tabIndex={-1} title={mirrorOfId ? 'Espejo → ver original' : 'Zoom in →'} />
            )}
          </span>
        )}

        {/* Text area + badges — divider shows hr */}
        {isDivider ? (
          <div className="node-text node-text--divider">
            <hr className="block-divider" />
          </div>
        ) : (
          <div
            className="node-text-group"
            onMouseDown={e => {
              // Doble/triple clic → dejar que el browser seleccione palabra/línea con su comportamiento nativo
              if (e.detail >= 2) return
              // Capturar posición de cursor en mousedown para restaurarla tras el cambio
              // de contenido HTML→texto plano que ocurre en handleFocus.
              // También maneja clics en badges (fuera del contentEditable).
              if (isNota) return
              if ((e.target as HTMLElement).closest('button, input, select, [role="button"]')) return
              if (!contentRef.current) return
              const clickedInContent = contentRef.current === e.target || contentRef.current.contains(e.target as unknown as globalThis.Node)
              if (!isEditing) {
                // Transición HTML→texto: capturar posición precisa o fin si el clic fue en un badge
                if (clickedInContent) {
                  try {
                    const cr = document.caretRangeFromPoint(e.clientX, e.clientY)
                    if (cr && contentRef.current.contains(cr.startContainer)) {
                      const r = document.createRange()
                      r.setStart(contentRef.current, 0)
                      r.setEnd(cr.startContainer, cr.startOffset)
                      pendingCursorPosRef.current = r.toString().length
                    } else {
                      pendingCursorPosRef.current = nodeTextRef.current.length
                    }
                  } catch { pendingCursorPosRef.current = nodeTextRef.current.length }
                } else {
                  // Clic en badge → cursor al final del texto
                  pendingCursorPosRef.current = nodeTextRef.current.length
                }
              } else if (!clickedInContent) {
                // Ya en modo edición, clic en badge → cursor al final
                pendingCursorPosRef.current = nodeTextRef.current.length
              }
              // isEditing && clickedInContent → el browser maneja el cursor directamente
            }}
            onClick={e => {
              // Doble/triple clic → el browser ya seleccionó palabra/línea — no interferir
              if (e.detail >= 2) return
              if (!isNota && !(e.target as HTMLElement).closest('button, input, select, [role="button"]')) {
                contentRef.current?.focus()
                // Si ya estábamos en modo edición y hay posición pendiente (p.ej. clic en badge),
                // handleFocus no volverá a dispararse → aplicar cursor aquí
                if (isEditing && pendingCursorPosRef.current !== null && contentRef.current) {
                  const pos = pendingCursorPosRef.current
                  pendingCursorPosRef.current = null
                  try {
                    const textNode = contentRef.current.firstChild
                    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                      const p = Math.min(pos, textNode.textContent?.length ?? 0)
                      const range = document.createRange()
                      range.setStart(textNode, p)
                      range.collapse(true)
                      window.getSelection()?.removeAllRanges()
                      window.getSelection()?.addRange(range)
                    }
                  } catch { /* ignore */ }
                }
              }
            }}
          >
            {/* Icono inline del nodo */}
            {nodeIcon && <span className="node-inline-icon">{nodeIcon}</span>}
            {/* Lista: dash visual "–" decorativo */}
            {isBullet && <span className="lista-dash" aria-hidden="true">–</span>}
            {/* Nodo tipo 'nota': texto clicable no editable que navega */}
            {isNota ? (
              <div
                className="node-text node-text--nota"
                onClick={() => navigate(`/node/${node.id}`)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {node.text || 'Sin título'}
              </div>
            ) : (
            /* contentEditable SIN hijos React — el contenido se gestiona
               via useEffect (innerHTML) para evitar el bug removeChild del reconciler */
            <div
              ref={contentRef}
              className={`node-text ${!isEditing ? 'node-text--rendered' : ''} ${(blockType === 'h1' || blockType === 'h2' || blockType === 'h3') ? `node-text--${blockType}` : ''}${isFirstEmpty ? ' node-text--first-empty' : ''}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            style={{ outline: 0, outlineWidth: 0, border: 'none', boxShadow: 'none', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onClick={e => {
              // Triple click → seleccionar todo el texto del nodo
              if (e.detail >= 3) {
                e.preventDefault()
                const sel = window.getSelection()
                const range = document.createRange()
                range.selectNodeContents(e.currentTarget)
                sel?.removeAllRanges()
                sel?.addRange(range)
                return
              }

              const target = e.target as HTMLElement

              // Click en @context-inline → animar y filtrar
              const ctxEl = target.classList.contains('context-inline')
                ? target
                : target.closest('.context-inline') as HTMLElement | null
              if (ctxEl && !isEditing) {
                e.preventDefault()
                e.stopPropagation()
                const slug = ctxEl.dataset.slug || ''
                if (slug && document.querySelector('.wf-layout')) {
                  flyToFilter(ctxEl, `@${slug}`)
                }
                return
              }

              // Click en mention-inline ([[wiki-link]]) → animar+filtrar en WF, navegar en modo normal
              const mentionEl = target.classList.contains('mention-inline')
                ? target
                : target.closest('.mention-inline') as HTMLElement | null
              if (mentionEl && !isEditing) {
                e.preventDefault()
                // En WF mode: animar hacia el filtro y filtrar por referencias a esa nota
                if (document.querySelector('.wf-layout')) {
                  const rawText = mentionEl.textContent || ''
                  const refText = mentionEl.dataset.refText ||
                    rawText.replace(/^\[\[/, '').replace(/\]\]$/, '').trim()
                  if (refText) {
                    // Buscar el nodo referenciado para filtrar por su ID
                    const refNode = store.allActive().find(n =>
                      !n.deletedAt && (n.text === refText || n.text.toLowerCase() === refText.toLowerCase())
                    )
                    // Filtrar: buscar texto [[refText]] captura todos los nodos que lo mencionan
                    flyToFilter(mentionEl, `[[${refNode?.text || refText}]]`)
                  }
                  return
                }
                // Fuera de WF mode: navegar al nodo referenciado
                const rawText = mentionEl.textContent || ''
                const refText = mentionEl.dataset.refText ||
                  rawText.replace(/^@/, '').replace(/^\[\[/, '').replace(/\]\]$/, '')
                // Buscar en extraData.refs primero
                try {
                  const ed = JSON.parse(node.extraData || '{}')
                  const refIds: string[] = ed.refs || []
                  const refNode = refIds.map(id => store.getNode(id)).find(n => n && !n.deletedAt)
                  if (refNode) { navigate(`/node/${refNode.id}`); return }
                } catch { /* ignore */ }
                // Buscar por texto exacto o parcial
                const found = store.allActive().find(n =>
                  (n.text === refText || n.text.toLowerCase().includes(refText.toLowerCase())) && !n.deletedAt
                )
                if (found) navigate(`/node/${found.id}`)
                return
              }

              // Click en hashtag inline
              if (target.classList.contains('tag-inline') || target.closest('.tag-inline')) {
                const tagEl = target.classList.contains('tag-inline') ? target : target.closest('.tag-inline') as HTMLElement
                const tagText = tagEl.textContent?.replace(/^#/, '') || ''
                if (tagText && !isEditing) {
                  e.preventDefault()
                  // En WF mode: navegar al nodo del tag (zoom in) si existe
                  if (document.querySelector('.wf-layout')) {
                    // Import dinámico para evitar circular dep
                    import('../../utils/tagsHelper').then(({ resolveTagDefNode }) => {
                      const defNode = resolveTagDefNode(tagText)
                      if (defNode) navigate(`/node/${defNode.id}`)
                      else navigate(`/tag/${tagText}`)
                    }).catch(() => navigate(`/tag/${tagText}`))
                  } else {
                    navigate(`/tag/${tagText}`)
                  }
                }
              }
            }}
            data-placeholder={isFirstEmpty ? "Escribe '/' para comandos" : "Escribe algo..."}
            data-first-placeholder={isFirstEmpty ? "Escribe '/' para comandos" : undefined}
            onPaste={e => {
              // Siempre obtener text/plain limpio — sanitizar artefactos HTML que Chrome
              // puede incluir en text/plain al copiar un enlace (ej: url" target="_blank" rel=...)
              let clipText = e.clipboardData.getData('text/plain')
              const htmlClip = e.clipboardData.getData('text/html')

              // Detectar si text/plain tiene atributos HTML contaminados
              // Patrón típico: https://url" target="_blank" rel="..." >texto
              if (clipText && /"\s+(target|rel|class|id|style)=/.test(clipText) && htmlClip) {
                // Extraer URL limpia desde text/html
                const tmp = document.createElement('div')
                tmp.innerHTML = htmlClip
                const anchor = tmp.querySelector('a')
                if (anchor?.href && /^https?:\/\//.test(anchor.href)) {
                  clipText = anchor.href
                } else {
                  // Fallback: extraer solo la parte de URL antes de las comillas
                  const urlMatch = clipText.match(/^(https?:\/\/[^\s"'<>]+)/)
                  if (urlMatch) clipText = urlMatch[1]
                }
              }

              const urlRegex = /^https?:\/\/[^\s]+$/

              // Si hay texto seleccionado y el portapapeles es una URL → aplicar como enlace
              const sel = window.getSelection()
              if (sel && !sel.isCollapsed && urlRegex.test(clipText.trim()) && contentRef.current?.contains(sel.anchorNode)) {
                e.preventDefault()
                const url = clipText.trim()
                const selectedText = sel.toString()
                const linked = `[${selectedText}](${url})`
                const range = sel.getRangeAt(0)
                range.deleteContents()
                range.insertNode(document.createTextNode(linked))
                sel.removeAllRanges()
                const newText = contentRef.current?.textContent || ''
                nodeTextRef.current = newText
                store.updateNode(node.id, { text: newText })
                return
              }

              // Detectar si el texto pegado es una URL y el nodo está vacío →
              // pegar URL limpia para que el useEffect auto-detect la convierta en recurso
              const curContent = contentRef.current?.textContent || ''
              if (urlRegex.test(clipText.trim()) && curContent.trim() === '') {
                e.preventDefault()
                const url = clipText.trim()
                nodeTextRef.current = url
                store.updateNode(node.id, { text: url })
                if (contentRef.current) contentRef.current.textContent = url
                return
              }

              const lines = clipText.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
              if (lines.length <= 1) {
                // Siempre prevenir paste del browser para evitar que pegue HTML rico
                // (ej. <a href="..."> con atributos como texto plano)
                e.preventDefault()
                const sel = window.getSelection()
                if (sel && sel.rangeCount && contentRef.current) {
                  const range = sel.getRangeAt(0)
                  range.deleteContents()
                  const textNode = document.createTextNode(clipText)
                  range.insertNode(textNode)
                  range.setStartAfter(textNode)
                  range.collapse(true)
                  sel.removeAllRanges()
                  sel.addRange(range)
                  const newText = contentRef.current.textContent || ''
                  nodeTextRef.current = newText
                  store.updateNode(node.id, { text: newText })
                }
                return
              }
              e.preventDefault()

              // Helper: detectar formato markdown de una línea y extraer texto + metadatos
              function parseMarkdownLine(raw: string): { text: string; blockType: string | null; isTask: boolean; status: string | null } {
                let s = raw
                let blockType: string | null = null
                let isTask = false
                let status: string | null = null
                // Headings
                if (/^### /.test(s)) { blockType = 'h3'; s = s.slice(4) }
                else if (/^## /.test(s)) { blockType = 'h2'; s = s.slice(3) }
                else if (/^# /.test(s)) { blockType = 'h1'; s = s.slice(2) }
                // Tasks [ ] [x]
                else if (/^[-*] \[x\] /i.test(s)) { isTask = true; status = 'done'; s = s.replace(/^[-*] \[x\] /i, '') }
                else if (/^[-*] \[ \] /i.test(s)) { isTask = true; status = 'pending'; s = s.replace(/^[-*] \[ \] /i, '') }
                else if (/^\- \[x\] /i.test(s)) { isTask = true; status = 'done'; s = s.slice(6) }
                else if (/^\- \[ \] /i.test(s)) { isTask = true; status = 'pending'; s = s.slice(6) }
                // Lista / bullet
                else if (/^[-*] /.test(s)) { blockType = 'bullet'; s = s.slice(2) }
                return { text: s.trim(), blockType, isTask, status }
              }

              // Primera línea va al nodo actual
              const curText = contentRef.current?.textContent || ''
              const { text: firstText, blockType: firstBlock, isTask: firstIsTask, status: firstStatus } = parseMarkdownLine(lines[0])
              const firstLine = (curText + firstText).trim()
              nodeTextRef.current = firstLine
              const firstUpdates: Record<string, unknown> = { text: firstLine }
              if (firstBlock) {
                let ed: Record<string, unknown> = {}
                try { ed = JSON.parse(node.extraData || '{}') } catch {}
                ed._block = firstBlock
                firstUpdates.extraData = JSON.stringify(ed)
              }
              if (firstIsTask) { firstUpdates.status = firstStatus ?? 'pending' }
              store.updateNode(node.id, firstUpdates)
              if (contentRef.current) contentRef.current.textContent = firstLine

              // Las líneas siguientes crean nodos hermanos
              let prevOrder = node.siblingOrder
              let lastId = node.id
              for (let i = 1; i < lines.length; i++) {
                const { text: lineText, blockType, isTask, status: lineStatus } = parseMarkdownLine(lines[i])
                if (!lineText) continue
                prevOrder += 0.5
                const newNodeData: Record<string, unknown> = { text: lineText, parentId: node.parentId, siblingOrder: prevOrder }
                if (blockType) {
                  newNodeData.extraData = JSON.stringify({ _block: blockType })
                }
                if (isTask) { newNodeData.status = lineStatus ?? 'pending' }
                const created = store.createNode(newNodeData as Parameters<typeof store.createNode>[0])
                lastId = created.id
              }
              onSelect(lastId)
            }}
          />
            )}

            {/* Badge de destino para espejos de tarea movida (→ Vie 30 may) — después del texto */}
            {mirrorDestLabel && (
              <span className="node-mirror-dest-badge">→ {mirrorDestLabel}</span>
            )}

            {/* Priority badge — click para cambiar */}
            {node.priority && (
              <span
                className={`node-priority-dot ${node.priority}`}
                title={`Prioridad ${node.priority === 'high' ? 'alta' : node.priority === 'medium' ? 'media' : 'baja'} (click para cambiar)`}
                onClick={e => {
                  e.stopPropagation()
                  const cycle: Record<string, 'medium' | 'low' | null> = { high: 'medium', medium: 'low', low: null }
                  store.updateNode(node.id, { priority: cycle[node.priority!] })
                }}
              />
            )}
            {/* Recurrencia badge */}
            {node.recurrence && (() => {
              const [unit, nStr] = node.recurrence.split(':')
              const n = parseInt(nStr || '1') || 1
              const unitLabels: Record<string, [string, string]> = {
                daily: ['día', 'días'], weekly: ['sem.', 'sem.'],
                monthly: ['mes', 'meses'], yearly: ['año', 'años'],
              }
              const [sing, plur] = unitLabels[unit] || [unit, unit]
              const txt = n === 1 ? sing : `${n} ${plur}`
              const removeRecurrence = (e: React.MouseEvent) => {
                e.stopPropagation(); e.preventDefault()
                store.updateNode(node.id, { recurrence: null })
              }
              // Clic derecho elimina la recurrencia; también hay una × al pasar el ratón.
              return (
                <span
                  className="node-type-badge recurrence"
                  title={`Repite cada ${txt} · clic derecho o × para quitar`}
                  onContextMenu={removeRecurrence}
                >
                  🔁 {txt}
                  <button
                    className="node-badge-remove"
                    onClick={removeRecurrence}
                    title="Quitar recurrencia"
                    aria-label="Quitar recurrencia"
                  >×</button>
                </span>
              )
            })()}

            {/* Contexto badge — tres modos:
                1) Confirmado (manuallySetContextId): el usuario asignó contexto via badge.
                   Siempre visible, estilo sólido sin ✦. Click abre dropdown para cambiar.
                2) Sugerencia IA (autoCtxResult): la IA clasificó el nodo. Solo cuando no
                   hay contexto manual. Muestra ✦ y el nombre del contexto sugerido.
                3) Placeholder "+ Contexto": el nodo es candidato a clasificación pero la IA
                   no lo ha procesado aún (autoCtxResult===null) y no tiene contexto manual.
                   Siempre visible para que el usuario pueda asignar contexto manualmente. */}
            {/* Badge de contexto: no mostrar en nodos restringidos (dentro de contextos, perfil, papelera) */}
            {!isContextNode && !isInsideRestrictedAncestor && manuallySetContextId ? (
              <AutoContextBadge
                node={node}
                result={autoCtxResult ?? { contextId: manuallySetContextId, confidence: 1 }}
                assignedContextId={manuallySetContextId}
                onContextAssigned={id => { if (id === node.id) setAutoCtxResult(null) }}
              />
            ) : (!isContextNode && !isInsideRestrictedAncestor && !nodeHasManualContext && autoCtxResult !== null) ? (
              <AutoContextBadge
                node={node}
                result={autoCtxResult}
                onContextAssigned={id => { if (id === node.id) setAutoCtxResult(null) }}
              />
            ) : (!isContextNode && !isInsideRestrictedAncestor && !nodeHasManualContext && autoCtxResult === null && !node.isDiaryEntry && isContextAnchor) ? (
              <ContextPlaceholderBadge
                node={node}
                onContextAssigned={id => { if (id === node.id) setAutoCtxResult(null) }}
              />
            ) : null}

            {/* Event badge — fecha/hora/lugar, click abre popup de propiedades del evento */}
            {node.isEvent && (
              <div className="node-qp-wrap">
                <button
                  ref={eventBadgeBtnRef}
                  className={`node-qp-badge node-event-qp-badge${node.due ? ' has-date' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    if (!showEventProp && eventBadgeBtnRef.current) {
                      const rect = eventBadgeBtnRef.current.getBoundingClientRect()
                      setEventPropPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)) })
                    }
                    setShowEventProp(v => !v)
                  }}
                  tabIndex={-1}
                  title="Fecha, lugar y propiedades del evento"
                >
                  {evtBadgeLabel ? `📅 ${evtBadgeLabel}` : 'sin fecha'}
                </button>
                {showEventProp && createPortal(
                  <div
                    className="nqp-modal-overlay"
                    onMouseDown={e => { e.stopPropagation(); setShowEventProp(false) }}
                  >
                  <div
                    ref={eventBadgePopupRef}
                    className="node-qp-popup node-evt-popup nqp-modal-box"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Fechas rápidas */}
                    <div className="nqp-quick-row">
                      {[{ label: 'Hoy', days: 0 }, { label: 'Mañana', days: 1 }, { label: 'Lunes', days: qNextMondayDays }].map(({ label, days }) => {
                        const d = new Date(); d.setDate(d.getDate() + days)
                        const iso = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
                        return (
                          <button key={label} className={`nqp-qbtn${evtDueDate === iso ? ' active' : ''}`}
                            onClick={() => setEvtDueField(iso, hasLocalTime(node.due) ? evtDueTime : '')}>{label}</button>
                        )
                      })}
                      {node.due && (
                        <button className="nqp-qbtn nqp-clear" onClick={() => { store.updateNode(node.id, { due: null, dueEnd: null, isEvent: false }) }}>✕</button>
                      )}
                    </div>
                    {/* Inicio */}
                    <div className="nqp-label">Inicio</div>
                    <div className="nqp-inputs-row">
                      <input type="date" className="nqp-date-input" value={evtDueDate}
                        onChange={e => setEvtDueField(e.target.value, hasLocalTime(node.due) ? evtDueTime : '')} />
                      <input type="time" className="nqp-time-input"
                        value={hasLocalTime(node.due) ? evtDueTime : ''}
                        onChange={e => setEvtDueField(evtDueDate, e.target.value)} disabled={!evtDueDate}
                        placeholder="HH:MM" />
                      {hasLocalTime(node.due) && (
                        <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
                          onClick={() => setEvtDueField(evtDueDate, '')} title="Quitar hora">✕h</button>
                      )}
                    </div>
                    {/* Fin */}
                    <div className="nqp-label">Fin</div>
                    <div className="nqp-inputs-row">
                      <input type="date" className="nqp-date-input" value={evtEndDate}
                        onChange={e => setEvtEndField(e.target.value, hasLocalTime(node.dueEnd) ? evtEndTime : '')} disabled={!evtDueDate} />
                      <input type="time" className="nqp-time-input"
                        value={hasLocalTime(node.dueEnd) ? evtEndTime : ''}
                        onChange={e => setEvtEndField(evtEndDate, e.target.value)} disabled={!evtEndDate}
                        placeholder="HH:MM" />
                      {hasLocalTime(node.dueEnd) && (
                        <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
                          onClick={() => setEvtEndField(evtEndDate, '')} title="Quitar hora">✕h</button>
                      )}
                    </div>
                    {/* Lugar */}
                    <div className="nqp-label">Lugar</div>
                    <input type="text" className="nqp-date-input" style={{ width: '100%' }}
                      value={evtLocationStored} placeholder="Añadir lugar..."
                      onChange={e => setEvtLocationField(e.target.value)} />

                    {/* Recurrencia del evento */}
                    <div className="nqp-label">Repetición</div>
                    <div className="nqp-rec-row">
                      <button className={`nqp-chip${!node.recurrence ? ' active' : ''}`}
                        onClick={() => { store.updateNode(node.id, { recurrence: null }); scheduleGCalSync() }}>–</button>
                      <input type="number" className="nqp-rec-n" min={1} max={999}
                        value={node.recurrence ? (parseInt(node.recurrence.split(':')[1] || '1') || 1) : 1}
                        disabled={!node.recurrence}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const n = Math.max(1, parseInt(e.target.value) || 1)
                          const unit = node.recurrence ? node.recurrence.split(':')[0] : 'daily'
                          store.updateNode(node.id, { recurrence: n === 1 ? unit : `${unit}:${n}` })
                          scheduleGCalSync()
                        }}
                      />
                      {([['daily', 'días'], ['weekly', 'sem.'], ['monthly', 'meses'], ['yearly', 'años']] as [string, string][]).map(([unit, label]) => (
                        <button key={unit}
                          className={`nqp-chip${!!node.recurrence && node.recurrence.split(':')[0] === unit ? ' active' : ''}`}
                          onClick={() => {
                            const n = node.recurrence ? (parseInt(node.recurrence.split(':')[1] || '1') || 1) : 1
                            store.updateNode(node.id, { recurrence: n === 1 ? unit : `${unit}:${n}` })
                            scheduleGCalSync()
                          }}
                        >{label}</button>
                      ))}
                    </div>

                    {gcalEventId_evt && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', opacity: 0.7 }}>
                        ↑ Cambios sincronizados con Google Calendar
                      </div>
                    )}
                  </div>
                  </div>,
                  document.body
                )}
              </div>
            )}

            {/* Chips de contexto asignados vía types[] (sin @ en texto) */}
            {(() => {
              // No mostrar chips de contexto en nodos restringidos (los propios
              // contextos, perfil, plantillas/prompts/agentes, papelera).
              if (isContextNode || isInsideRestrictedAncestor) return null
              const BUILTIN = new Set(['bucle','agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec','nota'])
              const textLower = (displayNode.text || '').toLowerCase()
              const ctxRoot = findContextRoot()
              if (!ctxRoot) return null
              return (node.types || [])
                .filter(slug => {
                  if (BUILTIN.has(slug)) return false
                  // Ignorar si ya está como @slug en el texto
                  if (textLower.includes('@' + slug.replace(/-/g, ''))) return false
                  return true
                })
                .map(slug => {
                  // Buscar el nodo contexto que corresponde a este slug
                  const ctxNode = store.children(ctxRoot.id).find(n => {
                    if (n.deletedAt) return false
                    const s = (n.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9\-\/]/g,'')
                    return s === slug
                  })
                  if (!ctxNode) return null
                  let ctxColor = '#7c3aed'
                  try { const ed = JSON.parse(ctxNode.extraData || '{}'); if (ed._tagColor) ctxColor = ed._tagColor } catch { /* ignore */ }
                  return (
                    <span
                      key={`ctx-type-${slug}`}
                      className="context-inline"
                      data-slug={slug}
                      style={{
                        background: ctxColor + '18',
                        color: ctxColor,
                        border: `1px solid ${ctxColor}40`,
                        borderRadius: 4,
                        fontSize: '0.8em',
                        fontWeight: 500,
                        padding: '0 5px',
                        marginLeft: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {ctxNode.text}
                    </span>
                  )
                })
                .filter(Boolean)
            })()}

            {/* Badge de fecha + botones de acción rápida en hover */}
            {taskDueBadge && (
              <span className="node-due-badge-wrap">
                <span
                  className={`node-due-badge${taskDueBadge.overdue ? ' node-due-badge--overdue' : ''}`}
                  title={new Date(node.due!).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                >
                  {taskDueBadge.label}
                </span>
                <span className="node-date-actions">
                  <button
                    className="node-date-action-btn"
                    title="Mover a mañana"
                    onMouseDown={e => {
                      e.preventDefault(); e.stopPropagation()
                      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0)
                      store.updateNode(node.id, { due: d.toISOString() })
                    }}
                  >→ mañana</button>
                  <button
                    className="node-date-action-btn node-date-action-btn--remove"
                    title="Quitar fecha"
                    onMouseDown={e => {
                      e.preventDefault(); e.stopPropagation()
                      store.updateNode(node.id, { due: null })
                    }}
                  >× fecha</button>
                </span>
              </span>
            )}

            {/* Badge de recurrencia — lee de node.recurrence o extraData._recurrence */}
            {node.status !== null && !node.isEvent && (() => {
              // Prioritario: node.recurrence (campo DB unificado)
              if (node.recurrence) {
                const rec = recurrenceFromString(node.recurrence)
                if (rec) return (
                  <span className="node-recurrence-badge" title={`Repite: ${rec.display}`}>
                    ↻ {rec.display}
                  </span>
                )
              }
              // Fallback: extraData._recurrence (legado)
              try {
                const rec = JSON.parse(node.extraData || '{}')._recurrence as RecurrenceConfig | undefined
                if (!rec) return null
                return (
                  <span className="node-recurrence-badge" title={`Repite: ${rec.display}`}>
                    ↻ {rec.display}
                  </span>
                )
              } catch { return null }
            })()}

            {/* Badge combinado tarea+fecha */}
            {taskPrediction && datePrediction && isEditing && !ctxCompletion && (
              <span className="from-ghost from-ghost--task-date">
                <span className="from-ghost-text">
                  {'☐ '}{datePrediction.parsed.label}
                  {datePrediction.timeStr ? ` · ${datePrediction.timeStr}` : ''}
                </span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">↵</span>
              </span>
            )}

            {/* Badge predicción de tarea sola */}
            {taskPrediction && !datePrediction && isEditing && !ctxCompletion && (
              <span className="from-ghost from-ghost--task">
                <span className="from-ghost-text">☐ tarea</span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">↵</span>
              </span>
            )}

            {whiteboardPrediction && isEditing && !ctxCompletion && (
              <span className="from-ghost" style={{ color: '#3182ce' }}>
                <span className="from-ghost-text">🖊 pizarra</span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">↵</span>
              </span>
            )}

            {/* Autocompletado de contexto */}
            {ctxCompletion && isEditing && !datePrediction && (
              <span className="from-ghost from-ghost--ctx">
                <span className="from-ghost-text">{ctxCompletion.ghost}</span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">⇥</span>
              </span>
            )}

            {/* Ghost de fecha sola */}
            {datePrediction && !taskPrediction && isEditing && (
              <span className="from-ghost">
                <span className="from-ghost-text">
                  {datePrediction.parsed.label}
                  {datePrediction.timeStr ? ` · ${datePrediction.timeStr}` : ''}
                </span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">↵</span>
              </span>
            )}

            {/* Estrella eliminada — usar /atajo, menú ··· o clic derecho */}

            {/* Thumbnail inline para nodos imagen */}
            {isImageResource && !isEditing && (
              <img
                src={nodeUrl!}
                alt={node.text || ''}
                className="node-image-thumb"
                onClick={e => { e.stopPropagation(); window.open(nodeUrl!, '_blank') }}
              />
            )}

            {/* Chip ↗ para abrir el enlace — siempre visible, pegado al texto */}
            {nodeUrl && !['pdf','image','file'].includes(nodeResourceType||'') && !isEditing && (
              <a
                href={nodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="node-link-chip"
                onClick={e => e.stopPropagation()}
                title={nodeUrl}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/>
                  <path d="M10 2h4v4"/><path d="M14 2L8 8"/>
                </svg>
              </a>
            )}
          </div>
        )}

      </div>

      {/* Smart date assigned badge */}
      {dateAssignedMsg && (
        <div className="node-date-assigned-badge">{dateAssignedMsg}</div>
      )}

      {/* Format toolbar — aparece al seleccionar texto */}
      {/* FormatToolbar: se muestra solo cuando hay selección DENTRO de este nodo */}
      <FormatToolbar onFormat={applyFormat} nodeRef={contentRef} />

      {/* Slash menu */}
      {showSlash && (
        <SlashMenu
          anchorEl={contentRef.current}
          query={slashQuery}
          onSelect={handleSlashSelect}
          onClose={() => { setShowSlash(false); setSlashQuery('') }}
        />
      )}

      {/* Template code picker — trigger: {{ */}
      {showCodePicker && (
        <TemplateCodePicker
          anchorEl={contentRef.current}
          query={codeQuery}
          onSelect={handleCodeSelect}
          onClose={() => { setShowCodePicker(false); setCodeQuery('') }}
        />
      )}

      {/* Inline picker (@ / # / mirror / move) — portal para evitar conflicto DOM */}
      {picker && picker.items.length > 0 && createPortal(
        <div className="inline-picker" style={pickerStyle}>
          {picker.type === 'move' && (
            <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--accent)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
              → Mover a...
            </div>
          )}
          {picker.type === 'mirror' && (
            <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
              ⬡ Espejo — selecciona el nodo a reflejar aquí
            </div>
          )}
          {picker.type === 'move' ? picker.items.map((item, idx) => (
            <button
              key={item.id}
              className={`inline-picker-item ${idx === picker.activeIdx ? 'active' : ''}`}
              onMouseDown={e => { e.preventDefault(); applyPickerSelection(item) }}
            >
              <span className="inline-picker-icon">→</span>
              <span className="inline-picker-content">
                <span className="inline-picker-label">{item.label}</span>
              </span>
            </button>
          )) : picker.type === '@' ? (() => {
            const contextItems = picker.items.filter(i => i.group === 'context')
            const noteItems = picker.items.filter(i => i.group === 'note')
            const renderItem = (item: PickerItem, idx: number) => (
              <button
                key={item.id}
                className={`inline-picker-item ${idx === picker.activeIdx ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); applyPickerSelection(item) }}
              >
                <span className="inline-picker-icon">
                  {item.group === 'context' ? '@' : item.isNote ? '📄' : '¶'}
                </span>
                <span className="inline-picker-content">
                  <span className="inline-picker-label">{item.label}</span>
                  {item.group === 'note' && (
                    <span className="inline-picker-preview">{item.isNote ? 'Nota' : 'Párrafo'}</span>
                  )}
                </span>
              </button>
            )
            return (
              <>
                {contextItems.length > 0 && (
                  <>
                    <div className="inline-picker-section-header">Contextos</div>
                    {contextItems.map((item, i) => renderItem(item, i))}
                  </>
                )}
                {noteItems.length > 0 && (
                  <>
                    <div className="inline-picker-section-header" style={{ borderTop: contextItems.length > 0 ? '1px solid var(--border)' : undefined, marginTop: contextItems.length > 0 ? 4 : 0 }}>Notas</div>
                    {noteItems.map((item, i) => renderItem(item, contextItems.length + i))}
                  </>
                )}
              </>
            )
          })() : picker.items.map((item, idx) => (
            <button
              key={item.id}
              className={`inline-picker-item ${idx === picker.activeIdx ? 'active' : ''}`}
              onMouseDown={e => { e.preventDefault(); applyPickerSelection(item) }}
            >
              <span className="inline-picker-icon">⬡</span>
              <span className="inline-picker-content">
                <span className="inline-picker-label">{item.label}</span>
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Inline view block — renderiza tabla/kanban/calendar EN VEZ de los hijos como bullets */}
      {!flat && showChildren && (() => {
        try {
          const ed = JSON.parse(node.extraData || '{}')
          if (ed._inline !== '1') return null
          const kind = ed.viewBlock
          if (kind === 'tabla') {
            return (
              <div className="outliner-inline-view" style={{ marginLeft: (depth + 1) * 22 }} onClick={e => e.stopPropagation()}>
                <NodeTableView parentId={node.id} />
              </div>
            )
          }
          if (kind === 'kanban') {
            return (
              <div className="outliner-inline-view" style={{ marginLeft: (depth + 1) * 22 }} onClick={e => e.stopPropagation()}>
                <NodeKanbanView parentId={node.id} />
              </div>
            )
          }
          if (kind === 'calendario') {
            return (
              <div className="outliner-inline-view" style={{ marginLeft: (depth + 1) * 22 }} onClick={e => e.stopPropagation()}>
                <NodeCalendarView parentId={node.id} />
              </div>
            )
          }
          return null
        } catch { return null }
      })()}

      {/* Children — selectedId se propaga para que los hijos sepan si están seleccionados.
          Si este nodo es un inline view block, no renderizamos hijos como bullets (los muestra la vista).
          En modo `flat` (virtualizado) la lista plana ya monta los hijos → este nodo no los recurre. */}
      {!flat && showChildren && (() => {
        try {
          const ed = JSON.parse(node.extraData || '{}')
          if (ed._inline === '1') return null
        } catch { /* fallthrough */ }
        // Excluir tareas atómicas del body — viven en el panel derecho (Tareas asociadas)
        let bodyChildren = children.filter(c => !(c.isAtomic && c.status !== null))
        // Con filtro smart activo y este nodo tiene hijos-match: solo mostrar hijos que
        // son match o ancestros de match. Evita renderizar hermanos irrelevantes.
        // hasMatchingDescendants cubre el caso en que el padre también coincide con el filtro
        // (anyDescendantMatches es false si matchesFilter es true).
        if (filterMatchIds && filterMatchIds.size > 0 && (anyDescendantMatches || hasMatchingDescendants)) {
          bodyChildren = bodyChildren.filter(c =>
            filterMatchIds.has(c.id) || filterAncestorIds?.has(c.id)
          )
        }
        const childNodes = bodyChildren.map(child => (
          <OutlinerNode
            key={child.id}
            node={child}
            depth={depth + 1}
            isSelected={selectedId === child.id}
            selectedId={selectedId}
            isMultiSelected={isMultiSelected}
            onSelect={onSelect}
            onSelectNext={onSelectNext}
            onShiftSelect={onShiftSelect}
            filterText={filterText}
            highlightText={highlightText}
            filterMatchIds={filterMatchIds}
            filterAncestorIds={filterAncestorIds}
          />
        ))
        // Zona de drop al final de los hijos — permite soltar después del último hijo
        const lastChildOrder = bodyChildren.length > 0
          ? Math.max(...bodyChildren.map(c => c.siblingOrder))
          : 0
        const ChildDropTrailer = () => {
          const [over, setOver] = useState(false)
          return bodyChildren.length > 0 ? (
            <div
              style={{
                minHeight: 16,
                marginLeft: (depth + 1) * 22,
                borderTop: over ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'border-color 0.1s',
              }}
              onDragOver={e => {
                if (!_draggedNodeId) return
                e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={e => {
                e.preventDefault(); setOver(false)
                const ids = _draggedNodeIds.length > 0 ? _draggedNodeIds : (_draggedNodeId ? [_draggedNodeId] : [])
                if (!ids.length) return
                ids.forEach((id, i) => {
                  if (id !== node.id) store.updateNode(id, { parentId: node.id, siblingOrder: lastChildOrder + (i + 1) * 1000 })
                })
                clearGlobalSelection()
              }}
            />
          ) : null
        }
        return <>{childNodes}<ChildDropTrailer key="child-trailer" /></>
      })()}

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          node={node}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onNavigate={navigate}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
