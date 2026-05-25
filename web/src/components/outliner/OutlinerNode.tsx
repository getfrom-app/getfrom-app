import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import InlineRenderer, { detectBlockType, renderInlineToHtml } from './InlineRenderer'
import { unfurlUrl, isUrl } from '../../api/unfurl'
import SlashMenu, { type SlashSelectPayload } from './SlashMenu'
import NodeContextMenu from './NodeContextMenu'
import FormatToolbar from './FormatToolbar'
import { aiInlineStream } from '../../api/client'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'
import { updateCalendarEvent, createCalendarEvent, fromRecToRRule } from '../../api/googleCalendar'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO } from '../../utils/dates'

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
  isFirstEmpty?: boolean  // primer nodo de nota vacía — muestra placeholder siempre
}

const COMMON_TYPES = [
  'tarea', 'proyecto', 'área', 'referencia', 'evento', 'nota',
  'reunión', 'idea', 'decisión', 'lectura', 'apuntes', 'recurso',
  'pendiente', 'importante', 'trabajo', 'personal',
]

interface PickerItem {
  id: string
  label: string
  // Extra metadata shown only for @ mentions
  status?: string | null
  types?: string[]
  bodyPreview?: string
}

interface InlinePicker {
  type: '@' | '#'
  query: string
  items: PickerItem[]
  activeIdx: number
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

export default function OutlinerNode({ node, depth, isSelected, selectedId, isMultiSelected, onSelect, onSelectNext, onShiftSelect, filterText, isFirstEmpty }: Props) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  // Ref siempre actualizado con el texto más reciente — evita stale closure en handleFocus
  const nodeTextRef = useRef(node.text)
  nodeTextRef.current = node.text
  const children = store.children(node.id)
  const isCollapsed = node.isCollapsed && children.length > 0
  const [isEditing, setIsEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [picker, setPicker] = useState<InlinePicker | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDragOverChild, setIsDragOverChild] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isAiStreaming, setIsAiStreaming] = useState(false)
  const [aiPendingText, setAiPendingText] = useState<string | null>(null)
  const aiOriginalText = useRef<string>('')
  // IA inline: estado del prompt previo al stream
  const [isAiPrompting, setIsAiPrompting] = useState(false)
  const [aiPromptText, setAiPromptText] = useState('')
  const aiPromptRef = useRef<HTMLInputElement>(null)
  const [dateAssignedMsg, setDateAssignedMsg] = useState<string | null>(null)
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

  const blockType = detectBlockType(node.text)
  const isHeading = blockType === 'h1' || blockType === 'h2' || blockType === 'h3'
  const isDivider = blockType === 'divider'
  const isBullet = blockType === 'bullet'
  const isNota = (node.types || []).includes('nota')

  // Icono del nodo (extraData.icon)
  const nodeIcon = useMemo(() => {
    try { return JSON.parse(node.extraData || '{}').icon || null } catch { return null }
  }, [node.extraData])

  // Color del nodo (extraData.color)
  const nodeColor = useMemo(() => {
    try { return JSON.parse(node.extraData || '{}').color || null } catch { return null }
  }, [node.extraData])

  // Filter: if filterText is active and this node doesn't match, hide it
  // But keep parent visible if any descendant matches
  const activeFilter = filterText && filterText.trim()
  const matchesFilter = !activeFilter || node.text.toLowerCase().includes(filterText!.toLowerCase())
  const anyDescendantMatches = activeFilter && !matchesFilter
    ? getAllDescendants(node.id).some(id => {
        const n = store.getNode(id)
        return n && !n.deletedAt && n.text.toLowerCase().includes(filterText!.toLowerCase())
      })
    : false

  // Sync DOM text with node.text when not editing
  // Setear contenido via innerHTML cuando NO editando — evita poner hijos React
  // dentro de contentEditable (causa bug removeChild en reconciler de React)
  useEffect(() => {
    if (isEditing || !contentRef.current) return
    const newHtml = renderInlineToHtml(node.text, activeFilter ? filterText : undefined)
    if (contentRef.current.innerHTML !== newHtml) {
      contentRef.current.innerHTML = newHtml
    }
  }, [node.text, isEditing, filterText]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus when selected + scroll into view
  // Sin guarda !isEditing: el efecto sólo corre cuando isSelected CAMBIA (dep array),
  // no en cada render. Al deseleccionar reseteamos isEditing para que el siguiente
  // ciclo de selección siempre funcione.
  useEffect(() => {
    if (isSelected && contentRef.current) {
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

  // Cerrar quick-props popup al hacer click fuera
  useEffect(() => {
    if (!showQuickProps) return
    function handler(e: MouseEvent) {
      if (
        quickPropsPopupRef.current && !quickPropsPopupRef.current.contains(e.target as globalThis.Node) &&
        (!quickPropsBtnRef.current || !quickPropsBtnRef.current.contains(e.target as globalThis.Node))
      ) {
        setShowQuickProps(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showQuickProps])

  // Cerrar event badge popup al hacer click fuera
  useEffect(() => {
    if (!showEventProp) return
    function handler(e: MouseEvent) {
      if (
        eventBadgePopupRef.current && !eventBadgePopupRef.current.contains(e.target as globalThis.Node) &&
        (!eventBadgeBtnRef.current || !eventBadgeBtnRef.current.contains(e.target as globalThis.Node))
      ) setShowEventProp(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEventProp])

  // ── Helpers de evento ────────────────────────────────────────────────────
  const evtDueDate = isoToLocalDate(node.due)
  const evtDueTime = isoToLocalTime(node.due)
  const evtEndDate = isoToLocalDate(node.dueEnd)
  const evtEndTime = isoToLocalTime(node.dueEnd)
  const evtLocationStored = (() => { try { return JSON.parse(node.extraData || '{}').location || '' } catch { return '' } })()
  const gcalEventId_evt = (() => { try { return JSON.parse(node.extraData || '{}').gcalEventId || null } catch { return null } })()

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

  const evtBadgeLabel = node.due ? (() => {
    const d = new Date(node.due)
    const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const localTime = isoToLocalTime(node.due)
    const timeStr = hasLocalTime(node.due) ? ' ' + localTime : ''
    return dateStr + timeStr
  })() : null

  function buildPickerItems(type: '@' | '#', query: string): PickerItem[] {
    if (type === '#') {
      // Combinar tags del usuario (allUsedTags) + tipos comunes, filtrar por query
      const userTags = store.allUsedTags()
      const allTags = Array.from(new Set([...userTags, ...COMMON_TYPES]))
      return allTags
        .filter(t => !query || t.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map(t => ({ id: t, label: t }))
    }
    // @ — search nodes, include status/types/body preview
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
    // Normalizar NBSP → espacio regular (el prefijo del slash menu usa NBSP
    // para evitar que el browser colapse el trailing space en contentEditable)
    const text = (contentRef.current?.textContent || '').replace(/ /g, ' ')
    // Auto-sync bidireccional: types[] refleja los #tags del texto.
    // Preservamos types "builtin" (bucle, agente, etc.) que no son tags visuales.
    const BUILTIN_TYPES = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])
    const hashTags = new Set([...(text.match(/#([\wÀ-ɏ\/\-]+)/g) || [])].map(t => t.slice(1)))
    const currentTypes = node.types || []
    const newTypes = [
      ...currentTypes.filter(t => BUILTIN_TYPES.has(t) || hashTags.has(t)),
      ...[...hashTags].filter(t => !currentTypes.includes(t)),
    ]
    // Solo actualizar types si realmente cambió (evita escritura inútil)
    const typesChanged = newTypes.length !== currentTypes.length ||
      newTypes.some((t, i) => t !== currentTypes[i])
    if (typesChanged) {
      store.updateNode(node.id, { text, types: newTypes })
    } else {
      store.updateNode(node.id, { text })
    }

    // Slash menu: '/' en cualquier posición del cursor
    const slashPos = getCaretPosition(contentRef.current!)
    const beforeSlashCheck = text.slice(0, slashPos)
    const slashDetect = beforeSlashCheck.match(/(^|[\s])\/([^\s]*)$/)
    if (slashDetect) {
      setShowSlash(true)
      setSlashQuery(slashDetect[2])
      setPicker(null)
    } else {
      setShowSlash(false)
      setSlashQuery('')
    }

    // Auto-conversión markdown al escribir:
    // '# ' al inicio → H1, '## ' → H2, '### ' → H3, '> ' → quote, '--- ' → divider
    if (!text.startsWith('/')) {
      if (text === '# ' || text === '## ' || text === '### ' || text === '> ') {
        // El usuario escribió el markdown prefix → mantener para detectBlockType
        // No hacer nada aquí, detectBlockType lo manejará en el render
      }
      if (text === '---') {
        // Divider automático
        nodeTextRef.current = '---'
        store.updateNode(node.id, { text: '---' })
        if (contentRef.current) contentRef.current.textContent = ''
      }
    }

    // Detect @ and # triggers
    const pos = getCaretPosition(contentRef.current!)
    const before = text.slice(0, pos)

    const atMatch = before.match(/@(\w*)$/)
    const hashMatch = before.match(/#(\w*)$/)

    if (atMatch) {
      const query = atMatch[1]
      const items = buildPickerItems('@', query)
      setPicker({ type: '@', query, items, activeIdx: 0 })
    } else if (hashMatch) {
      const query = hashMatch[1]
      const items = buildPickerItems('#', query)
      setPicker({ type: '#', query, items, activeIdx: 0 })
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
        // Cursor al final
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPickerSelection(item: { id: string; label: string }) {
    if (!picker || !contentRef.current) return
    const text = contentRef.current.textContent || ''
    const pos = getCaretPosition(contentRef.current)
    const before = text.slice(0, pos)
    const trigger = picker.type === '@' ? '@' : '#'
    // Remove the trigger + query
    const queryLen = picker.query.length
    const newBefore = before.slice(0, before.length - queryLen - 1) // remove @/# + query
    const after = text.slice(pos)

    if (picker.type === '#') {
      // Tag siempre al final del texto, no inline donde se escribió
      const tagText = `#${item.id}`
      const cleanText = (newBefore + after).trim()
      const newText = cleanText + (cleanText ? ' ' : '') + tagText
      const newTypes = (node.types || []).includes(item.id) ? node.types : [...(node.types || []), item.id]
      store.updateNode(node.id, { text: newText, types: newTypes })
      if (contentRef.current) {
        contentRef.current.textContent = newText
        // Cursor al final
        const range = document.createRange()
        const sel = window.getSelection()
        const textNode = contentRef.current.firstChild
        if (textNode && textNode.textContent) {
          range.setStart(textNode, textNode.textContent.length)
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }
    } else {
      // @ reference: insert @NodeName in text
      const refText = `@${item.label}`
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
    setIsEditing(true)
    onSelect(node.id)
    // Usar ref (no closure) para obtener el texto más reciente y evitar
    // que handleFocus restaure el texto antiguo (e.g., '/') después de
    // que handleSlashSelect ya lo haya actualizado
    if (contentRef.current) {
      contentRef.current.textContent = nodeTextRef.current
    }
  }, [node.id, onSelect]) // nodeTextRef es estable, no necesita estar en deps

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    setShowSlash(false)
    // Delay picker hide to allow click
    setTimeout(() => setPicker(null), 150)

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const text = contentRef.current?.textContent || ''

    // AI pending state: Tab=accept, Escape=discard, any other key=accept then type
    if (aiPendingText !== null && !isAiStreaming) {
      const clearPending = () => {
        if (contentRef.current) contentRef.current.classList.remove('node-text--ai-pending')
        setAiPendingText(null)
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        // Aceptar: guardar en store
        const finalText = aiPendingText.replace(/ /g, ' ')
        nodeTextRef.current = finalText
        store.updateNode(node.id, { text: finalText })
        clearPending()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        // Descartar: restaurar texto original
        if (contentRef.current) contentRef.current.textContent = aiOriginalText.current
        nodeTextRef.current = aiOriginalText.current
        clearPending()
        return
      }
      // Ignorar teclas modificadoras solas y Cmd+Space (regenerar, manejado abajo)
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key) && !(e.key === ' ' && (e.metaKey || e.ctrlKey))) {
        // Cualquier otra tecla: aceptar texto IA y continuar escribiendo
        const finalText = aiPendingText.replace(/ /g, ' ')
        nodeTextRef.current = finalText
        store.updateNode(node.id, { text: finalText })
        clearPending()
        // No preventDefault — la tecla sigue su curso normal
      }
    }

    // If slash menu is open, let it handle arrow keys and Enter/Escape
    if (showSlash) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
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
      if (e.key === 'Enter' && picker.items.length > 0) {
        e.preventDefault()
        applyPickerSelection(picker.items[picker.activeIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setPicker(null)
        return
      }
    }

    // Espacio al inicio del bullet vacío → mostrar input de prompt IA (como Mac)
    if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !showSlash && !picker) {
      const sel = window.getSelection()
      const cursorAtStart = sel && sel.focusOffset === 0 && text === ''
      if (cursorAtStart) {
        e.preventDefault()
        setIsAiPrompting(true)
        setTimeout(() => aiPromptRef.current?.focus(), 0)
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

    // Cmd+Space → completar con IA inline
    if (e.key === ' ' && (e.metaKey || e.ctrlKey) && !isAiStreaming) {
      e.preventDefault()
      e.stopPropagation()
      const currentText = contentRef.current?.textContent || ''
      if (!currentText.trim()) return
      // Si hay texto pendiente, descartar y regenerar
      if (aiPendingText !== null) {
        if (contentRef.current) contentRef.current.classList.remove('node-text--ai-pending')
        setAiPendingText(null)
        if (contentRef.current) contentRef.current.textContent = aiOriginalText.current
      }
      aiOriginalText.current = currentText
      setIsAiStreaming(true)
      let aiText = ''
      const resource = store.findAncestorResource(node.id)
      aiInlineStream(
        currentText + '\n',
        undefined,
        (chunk) => {
          aiText += chunk
          if (contentRef.current) {
            contentRef.current.textContent = currentText + aiText
            // Cursor al final
            const range = document.createRange()
            const sel = window.getSelection()
            const textNode = contentRef.current.firstChild
            if (textNode) {
              range.setStart(textNode, contentRef.current.textContent?.length || 0)
              range.collapse(true)
              sel?.removeAllRanges()
              sel?.addRange(range)
            }
          }
        },
        resource ? { resourceUrl: resource.url, resourceKind: resource.kind } : undefined
      ).then(() => {
        const fullText = (currentText + aiText).replace(/ /g, ' ')
        // Fase 2: modo ghost — NO guardar en store todavía
        setAiPendingText(fullText)
        if (contentRef.current) {
          contentRef.current.textContent = fullText
          contentRef.current.classList.add('node-text--ai-pending')
          // Cursor al final
          const range = document.createRange()
          const sel = window.getSelection()
          const textNode = contentRef.current.firstChild
          if (textNode) {
            range.setStart(textNode, contentRef.current.textContent?.length || 0)
            range.collapse(true)
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        }
      }).catch(console.error).finally(() => setIsAiStreaming(false))
      return
    }

    // Cmd+Enter → marcar tarea como done/pending
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      if (node.status !== null) {
        store.updateNode(node.id, { status: node.status === 'done' ? 'pending' : 'done' })
      }
      return
    }

    // Cmd+Shift+F → toggle favorite
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

    if (e.key === 'Enter') {
      e.preventDefault()

      // Lista de elementos (- ): Enter continúa lista o sale si está vacío
      if (isBullet) {
        const bulletContent = text.startsWith('- ') ? text.slice(2).trim() : text.trim()
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
        // Bullet con contenido → crear siguiente elemento de lista
        const newBullet = store.createNode({
          text: '- ',
          parentId: node.parentId,
          siblingOrder: node.siblingOrder + 0.5,
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

      // Smart date parse FIRST
      if (applySmartDate(text)) return

      // Detect inline shortcuts at end of text: -t (tarea), -b (bucle), -e (evento)
      const trimmed = text.trimEnd()
      if (trimmed.endsWith(' -t') || trimmed.endsWith(' -t')) {
        const cleanText = trimmed.slice(0, -3).trimEnd()
        nodeTextRef.current = cleanText
        const todayISOt = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        store.updateNode(node.id, { text: cleanText, status: 'pending', due: node.due ?? todayISOt })
        if (contentRef.current) contentRef.current.textContent = cleanText
        return
      }
      if (trimmed.endsWith(' -b') || trimmed.endsWith(' -b')) {
        const cleanText = trimmed.slice(0, -3).trimEnd()
        const newTypes = node.types?.includes('bucle') ? node.types : [...(node.types || []), 'bucle']
        nodeTextRef.current = cleanText
        store.updateNode(node.id, { text: cleanText, status: 'pending', types: newTypes })
        if (contentRef.current) contentRef.current.textContent = cleanText
        return
      }
      if (trimmed.endsWith(' -e') || trimmed.endsWith(' -e')) {
        const cleanText = trimmed.slice(0, -3).trimEnd()
        nodeTextRef.current = cleanText
        const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        store.updateNode(node.id, { text: cleanText, isEvent: true, status: null, due: todayISO })
        if (contentRef.current) contentRef.current.textContent = cleanText
        return
      }
      // Create sibling below — o navegar al siguiente si ya está vacío
      // (nodo vacío = no existe, no acumular)
      const siblings = store.children(node.parentId)
      const idx = siblings.findIndex(n => n.id === node.id)
      const nextSibling = siblings[idx + 1]
      if (nextSibling && !(nextSibling.text || '').trim()) {
        // El siguiente ya está vacío: navegar a él en lugar de crear otro
        onSelect(nextSibling.id)
      } else {
        const newNode = store.createNode({
          text: '',
          parentId: node.parentId,
          siblingOrder: node.siblingOrder + 0.5,
        })
        onSelect(newNode.id)
      }
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
          // Expand prev sibling if collapsed
          if (prevSibling.isCollapsed) {
            store.updateNode(prevSibling.id, { isCollapsed: false })
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
  }, [node, onSelect, onSelectNext, showSlash, picker, aiPendingText, isAiStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    _draggedNodeId = node.id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!_draggedNodeId || _draggedNodeId === node.id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function isDescendant(potentialAncestorId: string, checkId: string): boolean {
    let cur = store.getNode(checkId)
    while (cur?.parentId) {
      if (cur.parentId === potentialAncestorId) return true
      cur = store.getNode(cur.parentId)
    }
    return false
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const draggedId = _draggedNodeId
    _draggedNodeId = null
    if (!draggedId || draggedId === node.id) return

    const draggedNode = store.getNode(draggedId)
    if (!draggedNode) return

    // Evitar mover un nodo a su propio descendiente
    if (isDescendant(draggedId, node.id)) return

    if (draggedNode.parentId === node.parentId) {
      // MISMO PADRE → reordenar (comportamiento existente)
      const siblings = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
      const targetIdx = siblings.findIndex(n => n.id === node.id)
      if (targetIdx === -1) return
      const before = targetIdx > 0 ? siblings[targetIdx - 1].siblingOrder : siblings[targetIdx].siblingOrder - 1000
      const newOrder = (before + siblings[targetIdx].siblingOrder) / 2
      store.updateNode(draggedId, { siblingOrder: newOrder })
    } else {
      // DIFERENTE PADRE → reparenting: mover antes del nodo destino
      const newSiblings = store.children(node.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
      const targetIdx = newSiblings.findIndex(n => n.id === node.id)
      const before = targetIdx > 0 ? newSiblings[targetIdx - 1].siblingOrder : (newSiblings[targetIdx]?.siblingOrder ?? 0) - 1000
      const after = newSiblings[targetIdx]?.siblingOrder ?? before + 2000
      const newOrder = (before + after) / 2
      store.updateNode(draggedId, { parentId: node.parentId, siblingOrder: newOrder })
    }
  }

  function handleDropAsChild(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOverChild(false)
    const draggedId = _draggedNodeId
    _draggedNodeId = null
    if (!draggedId || draggedId === node.id) return
    const draggedNode = store.getNode(draggedId)
    if (!draggedNode) return
    // Verificar que no es descendiente
    if (isDescendant(draggedId, node.id)) return
    // Mover como último hijo de este nodo
    const childNodes = store.children(node.id).sort((a, b) => a.siblingOrder - b.siblingOrder)
    const lastOrder = childNodes.length > 0 ? childNodes[childNodes.length - 1].siblingOrder : 0
    store.updateNode(draggedId, { parentId: node.id, siblingOrder: lastOrder + 1000 })
    // Expandir si estaba colapsado
    if (node.isCollapsed) {
      store.updateNode(node.id, { isCollapsed: false })
    }
  }

  function handleDragEnd() {
    _draggedNodeId = null
    setIsDragOver(false)
    setIsDragOverChild(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  function applyFormat(type: 'bold' | 'italic' | 'code' | 'strikethrough' | 'underline' | 'link' | 'copy') {
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
    if (type === 'bold') wrapped = `**${selectedText}**`
    else if (type === 'italic') wrapped = `*${selectedText}*`
    else if (type === 'code') wrapped = `\`${selectedText}\``
    else if (type === 'strikethrough') wrapped = `~~${selectedText}~~`
    else if (type === 'underline') wrapped = `<u>${selectedText}</u>`
    else if (type === 'link') wrapped = `[${selectedText}](url)`

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
    store.updateNode(node.id, { isCollapsed: !node.isCollapsed })
  }

  function toggleTask() {
    if (node.status === null) {
      const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      store.updateNode(node.id, { status: 'pending', due: node.due ?? todayISO })
    } else if (node.status === 'pending') {
      store.updateNode(node.id, { status: 'done' })
    } else {
      store.updateNode(node.id, { status: null })
    }
  }

  function openNode() {
    navigate(`/node/${node.id}`)
  }

  function handleSlashSelect({ prefix, action }: SlashSelectPayload) {
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
    const newText = (prefix + existingContent).trimEnd()

    nodeTextRef.current = newText

    const todayISOslash = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const updates: Record<string, unknown> = { text: newText }
    if (action === 'task') {
      updates.status = 'pending'
      if (!node.due) updates.due = todayISOslash
    } else if (action === 'bucle') {
      updates.status = 'pending'
      if (!node.due) updates.due = todayISOslash
      const existingTypes = node.types || []
      if (!existingTypes.includes('bucle')) {
        updates.types = [...existingTypes, 'bucle']
      }
    } else if (action === 'event') {
      updates.isEvent = true
      updates.status = null
      if (!node.due) updates.due = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
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

  // Overdue check — reutilizado en checkbox y due-chip
  const isOverdue = !!node.due && node.status !== 'done' && (() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return new Date(node.due!) < todayStart
  })()

  // Clase de color del checkbox de tarea según estado/vencimiento
  const taskCheckClass = node.status === 'done'
    ? 'task-sq--done'
    : node.status === 'future'
      ? 'task-sq--future'
      : isOverdue
        ? 'task-sq--overdue'
        : 'task-sq--pending'

  // ── Recurso ──────────────────────────────────────────────────────────────
  const resourceData = (() => {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (!ed._resource) return null
      return { status: (ed._resourceStatus || 'pending') as string }
    } catch { return null }
  })()
  const isResourcePending = !!resourceData && resourceData.status === 'pending'

  // Auto-detect URL en texto del nodo inline → marca como recurso + unfurl
  useEffect(() => {
    const text = (node.text || '').trim()
    if (!isUrl(text)) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._resource) return
    } catch {}
    // Marcar como recurso
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    ed._resource = true
    ed._resourceUrl = text
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
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

  // Determine CSS class for block type
  const nodeRowClass = [
    'node-row',
    isSelected ? 'selected' : '',
    isMultiSelected ? 'multi-selected' : '',
    node.status === 'done' ? 'done' : '',
    isHeading ? `node-row--${blockType}` : '',
    isBullet ? 'node-row--bullet' : '',
    isDragOver ? 'drag-over' : '',
  ].filter(Boolean).join(' ')

  // Picker position — fixed al viewport (portal a document.body)
  const pickerStyle: React.CSSProperties = { position: 'fixed', zIndex: 1000 }
  if (contentRef.current && picker) {
    const rect = getCursorRect(contentRef.current)
    pickerStyle.top = rect.bottom + 4
    pickerStyle.left = Math.max(8, Math.min(rect.left, window.innerWidth - 220))
  }

  if (activeFilter && !matchesFilter && !anyDescendantMatches) return null

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
        draggable={!isDivider && !isHeading}
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
          ? { borderLeft: `3px solid ${nodeColor}`, paddingLeft: depth * 22 + (isBullet ? 12 : 4) }
          : { paddingLeft: depth * 22 + (isBullet ? 8 : 0) }
        }
      >

        {/* Collapse toggle — hidden for headings and dividers */}
        {!isDivider && (
          <button
            className={`collapse-btn ${(hasChildren && !isHeading) ? '' : 'invisible'}`}
            onClick={e => {
              if (e.altKey) {
                // Alt+Click: colapsar/expandir todo el subárbol
                const allDesc = getAllDescendants(node.id)
                const anyExpanded = allDesc.some(id => !store.getNode(id)?.isCollapsed)
                for (const id of allDesc) {
                  store.updateNode(id, { isCollapsed: anyExpanded })
                }
                store.updateNode(node.id, { isCollapsed: anyExpanded })
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
            {isCollapsed && children.length > 0 && (
              <span className="node-children-count">{children.length}</span>
            )}
          </button>
        )}

        {/* Bullet / task checkbox / nota icon — hidden for headings and dividers */}
        {!isDivider && !isHeading && (
          <>
            {node.isSeguimiento ? (
              // Seguimiento: nav-dot (navega) + checkbox cuadrado morado/verde
              <>
                <button
                  className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                  tabIndex={-1}
                  title="Abrir nota activa"
                />
                <button
                  className={`bullet-seguimiento-dot ${node.status === 'done' ? 'done' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    store.updateNode(node.id, {
                      status: node.status === 'done' ? null : 'done'
                    })
                  }}
                  tabIndex={-1}
                  title={node.status === 'done' ? 'Completado — clic para reactivar' : 'Activo — clic para completar'}
                >
                  {node.status === 'done' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <rect x="1" y="1" width="12" height="12" rx="3" stroke="#22c55e" strokeWidth="1.5" fill="#22c55e" fillOpacity="0.18"/>
                      <path d="M3.5 7l2.5 2.5 4.5-4.5" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <rect x="1" y="1" width="12" height="12" rx="3" stroke="var(--accent)" strokeWidth="1.5" fill="var(--accent)" fillOpacity="0.14"/>
                    </svg>
                  )}
                </button>
              </>
            ) : node.isEvent ? (
              // Evento: nav-dot + icono calendario azul
              <>
                <button
                  className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                  tabIndex={-1}
                  title="Abrir evento"
                />
                <button
                  className="bullet-btn bullet-btn--event"
                  onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                  tabIndex={-1}
                  title="Evento"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="2" width="14" height="13" rx="2"/>
                    <path d="M1 6h14M5 1v3M11 1v3"/>
                  </svg>
                </button>
              </>
            ) : node.status !== null ? (
              // Tarea: nav-dot (navega al nodo) + checkbox cuadrado coloreado
              <>
                <button
                  className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                  tabIndex={-1}
                  title="Abrir nota"
                />
                <button
                  className={`bullet-btn task ${taskCheckClass}`}
                  onClick={toggleTask}
                  tabIndex={-1}
                  aria-label="Toggle tarea"
                  title="Marcar hecha/pendiente"
                >
                  {node.status === 'done' ? (
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
            ) : isResourcePending ? (
              // Recurso pendiente: nav-dot + checkbox cian
              <>
                <button
                  className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                  onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
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
              // Bullet explícito: punto •
              <button
                className="bullet-btn"
                onClick={undefined}
                tabIndex={-1}
                aria-label="Bullet"
              >
                <span className="bullet-dot" />
              </button>
            ) : (
              // Texto normal: dot navegador (visible en hover, o siempre si tiene hijos)
              <button
                className={`bullet-nav-dot ${hasChildren ? 'bullet-nav-dot--has-children' : ''}`}
                onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                tabIndex={-1}
                title="Abrir nota"
              />
            )}
          </>
        )}

        {/* Text area + badges — divider shows hr */}
        {isDivider ? (
          <div className="node-text node-text--divider">
            <hr className="block-divider" />
          </div>
        ) : (
          <div
            className="node-text-group"
            onClick={e => {
              if (!isNota && !isAiPrompting && !(e.target as HTMLElement).closest('button, input, select, [role="button"]')) {
                contentRef.current?.focus()
              }
            }}
          >
            {/* Icono inline del nodo */}
            {nodeIcon && <span className="node-inline-icon">{nodeIcon}</span>}
            {/* Nodo tipo 'nota': texto clicable no editable que navega */}
            {isAiPrompting ? (
              // Input de prompt IA — igual que Mac: ✦ + escribir prompt + Enter
              <div className="node-ai-prompt-container">
                <span className="node-ai-prompt-icon">✦</span>
                <input
                  ref={aiPromptRef}
                  className="node-ai-prompt-input"
                  placeholder="Pide a la IA..."
                  value={aiPromptText}
                  onChange={e => setAiPromptText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!aiPromptText.trim()) {
                        setIsAiPrompting(false)
                        setAiPromptText('')
                        setTimeout(() => contentRef.current?.focus(), 0)
                        return
                      }
                      const prompt = aiPromptText
                      setIsAiPrompting(false)
                      setAiPromptText('')
                      setIsAiStreaming(true)
                      let aiText = ''
                      aiInlineStream(prompt, undefined, (chunk) => {
                        aiText += chunk
                        nodeTextRef.current = aiText
                        if (contentRef.current) contentRef.current.textContent = aiText
                      }).catch(console.error).finally(() => {
                        setIsAiStreaming(false)
                        store.updateNode(node.id, { text: aiText })
                      })
                    }
                    if (e.key === 'Escape') {
                      setIsAiPrompting(false)
                      setAiPromptText('')
                      setTimeout(() => contentRef.current?.focus(), 0)
                    }
                  }}
                  onBlur={() => {
                    // Si pierde foco sin enviar, cancelar
                    setTimeout(() => {
                      if (!aiPromptRef.current || document.activeElement !== aiPromptRef.current) {
                        setIsAiPrompting(false)
                        setAiPromptText('')
                      }
                    }, 100)
                  }}
                />
              </div>
            ) : isNota ? (
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
              className={`node-text ${!isEditing ? 'node-text--rendered' : ''}${isFirstEmpty ? ' node-text--first-empty' : ''}`}
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
              const target = e.target as HTMLElement

              // Click en mention-inline → navegar al nodo referenciado (@ o [[wiki]])
              const mentionEl = target.classList.contains('mention-inline')
                ? target
                : target.closest('.mention-inline') as HTMLElement | null
              if (mentionEl && !isEditing) {
                e.preventDefault()
                // Extraer texto: quitar @ al inicio, o [[...]]
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

              // Click en hashtag inline → navegar a TagView
              if (target.classList.contains('tag-inline') || target.closest('.tag-inline')) {
                const tagEl = target.classList.contains('tag-inline') ? target : target.closest('.tag-inline') as HTMLElement
                const tagText = tagEl.textContent?.replace(/^#/, '') || ''
                if (tagText && !isEditing) {
                  e.preventDefault()
                  navigate(`/tag/${tagText}`)
                }
              }
            }}
            data-placeholder={isFirstEmpty ? "Escribe '/' para comandos" : "Escribe algo..."}
            data-first-placeholder={isFirstEmpty ? "Escribe '/' para comandos" : undefined}
            onPaste={e => {
              const clipText = e.clipboardData.getData('text/plain')

              // Detectar si el texto pegado es una URL y el nodo está vacío
              const urlRegex = /^https?:\/\/[^\s]+$/
              const curContent = contentRef.current?.textContent || ''
              if (urlRegex.test(clipText.trim()) && curContent.trim() === '') {
                e.preventDefault()
                const url = clipText.trim()
                let domain = url
                try { domain = new URL(url).hostname } catch { /* ignore */ }
                const linkText = `[${domain}](${url})`
                nodeTextRef.current = linkText
                store.updateNode(node.id, { text: linkText })
                if (contentRef.current) contentRef.current.textContent = linkText
                return
              }

              const lines = clipText.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
              if (lines.length <= 1) return // Paste normal de una línea
              e.preventDefault()
              // La primera línea va al nodo actual
              const curText = contentRef.current?.textContent || ''
              const firstLine = (curText + lines[0]).trim()
              nodeTextRef.current = firstLine
              store.updateNode(node.id, { text: firstLine })
              if (contentRef.current) contentRef.current.textContent = firstLine
              // Las líneas siguientes crean nodos hermanos
              let prevOrder = node.siblingOrder
              let lastId = node.id
              for (let i = 1; i < lines.length; i++) {
                prevOrder += 0.5
                const newNode = store.createNode({ text: lines[i].trim(), parentId: node.parentId, siblingOrder: prevOrder })
                lastId = newNode.id
              }
              onSelect(lastId)
            }}
          />
            )}

            {/* Body indicator dot */}
            {node.body && node.body.trim().length > 0 && (
              <span className="node-body-dot" title={`Con descripción (${node.body.split(/\s+/).filter(Boolean).length} palabras)`} />
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
            {!node.priority && node.status !== null && !node.isSeguimiento && (
              <span
                className="node-priority-dot add"
                title="Sin prioridad (click para añadir)"
                onClick={e => {
                  e.stopPropagation()
                  store.updateNode(node.id, { priority: 'high' })
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
              return <span className="node-type-badge recurrence" title={`Repite cada ${txt}`}>🔁 {txt}</span>
            })()}

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
                {showEventProp && eventPropPos && createPortal(
                  <div
                    ref={eventBadgePopupRef}
                    className="node-qp-popup node-evt-popup"
                    style={{ position: 'fixed', top: eventPropPos.top, left: eventPropPos.left, zIndex: 300 }}
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
                  </div>,
                  document.body
                )}
              </div>
            )}

            {/* Quick-props badge: tareas (no eventos, tienen su propio badge) */}
            {node.status !== null && !node.isSeguimiento && !node.isEvent && (
              <div className="node-qp-wrap">
                <button
                  ref={quickPropsBtnRef}
                  className={`node-qp-badge${node.due ? (isOverdue ? ' has-date overdue' : ' has-date') : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    if (!showQuickProps && quickPropsBtnRef.current) {
                      const rect = quickPropsBtnRef.current.getBoundingClientRect()
                      setQuickPropsPos({
                        top: rect.bottom + 4,
                        left: Math.max(8, Math.min(rect.left, window.innerWidth - 232))
                      })
                    }
                    setShowQuickProps(v => !v)
                  }}
                  tabIndex={-1}
                  title="Fecha, hora, repetición, prioridad"
                >
                  {node.due ? `📅 ${qDueBadgeLabel}` : 'sin fecha'}
                </button>
                {showQuickProps && quickPropsPos && createPortal(
                  <div
                    ref={quickPropsPopupRef}
                    className="node-qp-popup"
                    style={{ position: 'fixed', top: quickPropsPos.top, left: quickPropsPos.left, zIndex: 300 }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Fechas rápidas */}
                    <div className="nqp-quick-row">
                      {[
                        { label: 'Hoy', days: 0 },
                        { label: 'Mañana', days: 1 },
                        { label: 'Lunes', days: qNextMondayDays },
                        { label: '+7 días', days: 7 },
                      ].map(({ label, days }) => {
                        const d = new Date(); d.setDate(d.getDate() + days)
                        const iso = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
                        return (
                          <button
                            key={label}
                            className={`nqp-qbtn${qDueDate === iso ? ' active' : ''}`}
                            onClick={() => setQDue(iso, hasLocalTime(node.due) ? qDueTime : '')}
                          >{label}</button>
                        )
                      })}
                      {node.due && (
                        <button className="nqp-qbtn nqp-clear" onClick={() => store.updateNode(node.id, { due: null, recurrence: null })}>✕</button>
                      )}
                    </div>
                    {/* Inputs fecha + hora (hora opcional) */}
                    <div className="nqp-inputs-row">
                      <input type="date" className="nqp-date-input" value={qDueDate}
                        onChange={e => setQDue(e.target.value, hasLocalTime(node.due) ? qDueTime : '')} />
                      <input type="time" className="nqp-time-input"
                        value={hasLocalTime(node.due) ? qDueTime : ''}
                        onChange={e => setQDue(qDueDate, e.target.value)} disabled={!qDueDate}
                        placeholder="HH:MM" />
                      {hasLocalTime(node.due) && (
                        <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
                          onClick={() => setQDue(qDueDate, '')} title="Quitar hora">✕h</button>
                      )}
                    </div>
                    {/* Repetición: número + unidad */}
                    <div className="nqp-label">Repetición</div>
                    <div className="nqp-rec-row">
                      <button
                        className={`nqp-chip${!node.recurrence ? ' active' : ''}`}
                        onClick={() => store.updateNode(node.id, { recurrence: null })}
                      >–</button>
                      <input
                        type="number"
                        className="nqp-rec-n"
                        min={1} max={999}
                        value={node.recurrence ? (parseInt(node.recurrence.split(':')[1] || '1') || 1) : 1}
                        disabled={!node.recurrence}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const n = Math.max(1, parseInt(e.target.value) || 1)
                          const unit = node.recurrence ? node.recurrence.split(':')[0] : 'daily'
                          store.updateNode(node.id, { recurrence: n === 1 ? unit : `${unit}:${n}` })
                        }}
                      />
                      {([['daily', 'días'], ['weekly', 'sem.'], ['monthly', 'meses'], ['yearly', 'años']] as [string, string][]).map(([unit, label]) => (
                        <button
                          key={unit}
                          className={`nqp-chip${!!node.recurrence && node.recurrence.split(':')[0] === unit ? ' active' : ''}`}
                          onClick={() => {
                            const n = node.recurrence ? (parseInt(node.recurrence.split(':')[1] || '1') || 1) : 1
                            store.updateNode(node.id, { recurrence: n === 1 ? unit : `${unit}:${n}` })
                          }}
                        >{label}</button>
                      ))}
                    </div>
                    {/* Prioridad */}
                    <div className="nqp-label">Prioridad</div>
                    <div className="nqp-chips-row">
                      {([
                        { v: null,     l: '–',    c: '' },
                        { v: 'low',    l: 'Baja',  c: '#6b7280' },
                        { v: 'medium', l: 'Media', c: '#f59e0b' },
                        { v: 'high',   l: 'Alta',  c: '#ef4444' },
                      ] as { v: Node['priority']; l: string; c: string }[]).map(opt => (
                        <button key={String(opt.v)}
                          className={`nqp-chip${node.priority === opt.v ? ' active' : ''}`}
                          style={opt.c ? { color: opt.c, ...(node.priority === opt.v ? { borderColor: opt.c, background: opt.c + '20' } : {}) } : {}}
                          onClick={() => store.updateNode(node.id, { priority: opt.v })}
                        >{opt.l}</button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}

            {/* Favorito badge */}
            {node.isFavorite && (
              <span
                className="node-fav-badge"
                title="Fijado (click para quitar)"
                onClick={e => { e.stopPropagation(); store.updateNode(node.id, { isFavorite: false }) }}
              >★</span>
            )}
          </div>
        )}

      </div>

      {/* Drop zone: make child */}
      {!isDivider && !isHeading && (
        <div
          className={`drop-as-child ${isDragOverChild ? 'active' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragOverChild(true) }}
          onDragLeave={() => setIsDragOverChild(false)}
          onDrop={handleDropAsChild}
        />
      )}

      {/* Smart date assigned badge */}
      {dateAssignedMsg && (
        <div className="node-date-assigned-badge">{dateAssignedMsg}</div>
      )}

      {/* Format toolbar — aparece al seleccionar texto */}
      {isEditing && <FormatToolbar onFormat={applyFormat} />}

      {/* Slash menu */}
      {showSlash && (
        <SlashMenu
          anchorEl={contentRef.current}
          query={slashQuery}
          onSelect={handleSlashSelect}
          onClose={() => { setShowSlash(false); setSlashQuery('') }}
        />
      )}

      {/* Inline picker (@ and #) — portal para evitar conflicto DOM */}
      {picker && picker.items.length > 0 && createPortal(
        <div className="inline-picker" style={pickerStyle}>
          {picker.items.map((item, idx) => (
            <button
              key={item.id}
              className={`inline-picker-item ${idx === picker.activeIdx ? 'active' : ''}`}
              onMouseDown={e => {
                e.preventDefault()
                applyPickerSelection(item)
              }}
            >
              <span className="inline-picker-icon">{picker.type === '#' ? '#' : '@'}</span>
              <span className="inline-picker-content">
                <span className="inline-picker-label">{item.label}</span>
                {picker.type === '@' && (
                  <span className="inline-picker-meta">
                    {item.status === 'pending' && <span className="inline-picker-badge status-pending">○</span>}
                    {item.status === 'done' && <span className="inline-picker-badge status-done">✓</span>}
                    {(item.types || []).includes('bucle') && <span className="inline-picker-badge type-bucle">↺</span>}
                    {(item.types || []).some(t => ['tarea', 'proyecto', 'área', 'referencia', 'evento', 'nota'].includes(t)) && (
                      <span className="inline-picker-badge type-label">
                        {(item.types || []).find(t => ['tarea', 'proyecto', 'área', 'referencia', 'evento', 'nota'].includes(t))}
                      </span>
                    )}
                    {item.bodyPreview && (
                      <span className="inline-picker-preview">{item.bodyPreview}{(item.bodyPreview?.length ?? 0) >= 30 ? '…' : ''}</span>
                    )}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Children — selectedId se propaga para que los hijos sepan si están seleccionados */}
      {!isCollapsed && children.map(child => (
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
        />
      ))}

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
