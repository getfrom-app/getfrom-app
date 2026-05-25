import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import InlineRenderer, { detectBlockType, renderInlineToHtml } from './InlineRenderer'
import SlashMenu, { type SlashSelectPayload } from './SlashMenu'
import NodeContextMenu from './NodeContextMenu'
import FormatToolbar from './FormatToolbar'
import { aiInlineStream } from '../../api/client'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'

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
    store.updateNode(node.id, { text })

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
        }
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
        store.updateNode(node.id, { text: cleanText, status: 'pending' })
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
        store.updateNode(node.id, { text: cleanText, isEvent: true, status: 'pending' })
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
      store.updateNode(node.id, { status: 'pending' })
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

    const updates: Record<string, unknown> = { text: newText }
    if (action === 'task') {
      updates.status = 'pending'
    } else if (action === 'bucle') {
      updates.status = 'pending'
      const existingTypes = node.types || []
      if (!existingTypes.includes('bucle')) {
        updates.types = [...existingTypes, 'bucle']
      }
    } else if (action === 'event') {
      updates.isEvent = true
      updates.status = 'pending'
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

  // Picker position — relative to the node row
  const pickerStyle: React.CSSProperties = { position: 'absolute', zIndex: 200 }
  if (contentRef.current && picker) {
    const rect = getCursorRect(contentRef.current)
    const containerRect = contentRef.current.closest('.outliner-node')?.getBoundingClientRect()
    if (containerRect) {
      pickerStyle.top = rect.bottom - containerRect.top + 4
      pickerStyle.left = Math.max(0, rect.left - containerRect.left)
    }
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
              // Seguimiento: checkbox cuadrado morado (activo) o verde (completado)
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

        {/* Text area — divider shows hr */}
        {isDivider ? (
          <div className="node-text node-text--divider">
            <hr className="block-divider" />
          </div>
        ) : (
          <>
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
          </>
        )}


        {/* Body indicator dot */}
        {node.body && node.body.trim().length > 0 && !isDivider && (
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
        {!node.priority && node.status !== null && (
          <span
            className="node-priority-dot add"
            title="Sin prioridad (click para añadir)"
            onClick={e => {
              e.stopPropagation()
              store.updateNode(node.id, { priority: 'high' })
            }}
          />
        )}

        {/* Evento / Recurrencia badge */}
        {node.isEvent && <span className="node-type-badge event" title="Evento">📅</span>}
        {node.recurrence && <span className="node-type-badge recurrence" title={`Repite: ${node.recurrence}`}>🔁</span>}

        {/* Fecha de vencimiento */}
        {node.due && !node.isEvent && (() => {
          const d = new Date(node.due)
          const label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
          return <span className={`node-due-chip ${isOverdue ? 'overdue' : ''}`} title={d.toLocaleDateString('es-ES', { dateStyle: 'full' })}>📅 {label}</span>
        })()}

        {/* Favorito badge */}
        {node.isFavorite && (
          <span
            className="node-fav-badge"
            title="Fijado (click para quitar)"
            onClick={e => { e.stopPropagation(); store.updateNode(node.id, { isFavorite: false }) }}
          >★</span>
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
