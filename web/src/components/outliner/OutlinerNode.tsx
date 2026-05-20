import { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import InlineRenderer, { detectBlockType, renderInlineToHtml } from './InlineRenderer'
import SlashMenu, { type SlashSelectPayload } from './SlashMenu'
import NodeContextMenu from './NodeContextMenu'
import FormatToolbar from './FormatToolbar'

interface Props {
  node: Node
  depth: number
  isSelected: boolean
  onSelect: (id: string) => void
  onSelectNext: (id: string, dir: 'up' | 'down') => void
}

const COMMON_TYPES = ['tarea', 'proyecto', 'área', 'referencia', 'evento', 'nota']

interface InlinePicker {
  type: '@' | '#'
  query: string
  items: Array<{ id: string; label: string }>
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

export default function OutlinerNode({ node, depth, isSelected, onSelect, onSelectNext }: Props) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  // Ref siempre actualizado con el texto más reciente — evita stale closure en handleFocus
  const nodeTextRef = useRef(node.text)
  nodeTextRef.current = node.text
  const children = store.children(node.id)
  const isCollapsed = node.isCollapsed && children.length > 0
  const [isEditing, setIsEditing] = useState(false)
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [picker, setPicker] = useState<InlinePicker | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDragOverChild, setIsDragOverChild] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const blockType = detectBlockType(node.text)
  const isHeading = blockType === 'h1' || blockType === 'h2' || blockType === 'h3'
  const isDivider = blockType === 'divider'

  // Sync DOM text with node.text when not editing
  // Setear contenido via innerHTML cuando NO editando — evita poner hijos React
  // dentro de contentEditable (causa bug removeChild en reconciler de React)
  useEffect(() => {
    if (isEditing || !contentRef.current) return
    const newHtml = renderInlineToHtml(node.text)
    if (contentRef.current.innerHTML !== newHtml) {
      contentRef.current.innerHTML = newHtml
    }
  }, [node.text, isEditing])

  // Focus when selected
  useEffect(() => {
    if (isSelected && contentRef.current && !isEditing) {
      setIsEditing(true)
      contentRef.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(contentRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [isSelected]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildPickerItems(type: '@' | '#', query: string): Array<{ id: string; label: string }> {
    if (type === '#') {
      return COMMON_TYPES
        .filter(t => t.includes(query.toLowerCase()))
        .map(t => ({ id: t, label: t }))
    }
    // @ — search nodes
    return store.allActive()
      .filter(n => !n.deletedAt && n.id !== node.id && n.text && n.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map(n => ({ id: n.id, label: n.text }))
  }

  const handleInput = useCallback(() => {
    // Normalizar NBSP → espacio regular (el prefijo del slash menu usa NBSP
    // para evitar que el browser colapse el trailing space en contentEditable)
    const text = (contentRef.current?.textContent || '').replace(/ /g, ' ')
    store.updateNode(node.id, { text })

    // Slash menu: '/' sola o seguida de query (ej. '/tit', '/tar')
    if (text.startsWith('/')) {
      setShowSlash(true)
      setSlashQuery(text.slice(1))  // query = texto tras '/'
      setPicker(null)
    } else {
      setShowSlash(false)
      setSlashQuery('')
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
      // Add type to node, remove #tag from text
      const newText = newBefore + after
      const newTypes = node.types.includes(item.id) ? node.types : [...node.types, item.id]
      store.updateNode(node.id, { text: newText, types: newTypes })
      if (contentRef.current) {
        contentRef.current.textContent = newText
        // Move caret to end of newBefore
        const range = document.createRange()
        const sel = window.getSelection()
        const textNode = contentRef.current.firstChild
        if (textNode) {
          range.setStart(textNode, Math.min(newBefore.length, textNode.textContent?.length || 0))
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
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const text = contentRef.current?.textContent || ''

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

    // Cmd+Shift+F → toggle favorite
    if (e.key === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault()
      store.updateNode(node.id, { isFavorite: !node.isFavorite })
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

    if (e.key === 'Enter') {
      e.preventDefault()
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
      // Create sibling below
      const newNode = store.createNode({
        text: '',
        parentId: node.parentId,
        siblingOrder: node.siblingOrder + 0.5,
      })
      onSelect(newNode.id)
    }

    if (e.key === 'Tab') {
      e.preventDefault()
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
  }, [node, onSelect, onSelectNext, showSlash, picker]) // eslint-disable-line react-hooks/exhaustive-deps

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

  function applyFormat(type: 'bold' | 'italic' | 'code' | 'strikethrough' | 'link') {
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

    // Actualizar ref inmediatamente para que handleFocus use el texto correcto
    nodeTextRef.current = prefix

    const updates: Record<string, unknown> = { text: prefix }
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
    }

    store.updateNode(node.id, updates)

    if (contentRef.current) {
      // NBSP para trailing space: Chrome colapsa spaces regulares en contentEditable
      const displayPrefix = prefix.replace(/ $/, ' ')
      contentRef.current.textContent = displayPrefix
      contentRef.current.focus()
      const textNode = contentRef.current.firstChild
      const range = document.createRange()
      const sel = window.getSelection()
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, displayPrefix.length)
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

  // Determine CSS class for block type
  const nodeRowClass = [
    'node-row',
    isSelected ? 'selected' : '',
    node.status === 'done' ? 'done' : '',
    isHeading ? `node-row--${blockType}` : '',
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

  return (
    <div className="outliner-node" style={{ '--depth': depth } as React.CSSProperties}>
      <div
        className={nodeRowClass}
        draggable={!isDivider && !isHeading}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
      >

        {/* Collapse toggle — hidden for headings and dividers */}
        {!isDivider && (
          <button
            className={`collapse-btn ${(hasChildren && !isHeading) ? '' : 'invisible'}`}
            onClick={toggleCollapse}
            tabIndex={-1}
            aria-label="Colapsar"
          >
            <svg
              className={`collapse-arrow ${isCollapsed ? 'collapsed' : ''}`}
              width="10" height="10" viewBox="0 0 10 10"
            >
              <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        {/* Bullet / task checkbox — hidden for headings and dividers */}
        {!isDivider && !isHeading && (
          <button
            className={`bullet-btn ${node.status !== null ? 'task' : ''}`}
            onClick={node.status !== null ? toggleTask : undefined}
            onDoubleClick={node.status === null ? toggleTask : undefined}
            tabIndex={-1}
            aria-label={node.status !== null ? 'Toggle tarea' : 'Bullet'}
          >
            {node.status === 'done' ? (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            ) : node.status === 'pending' ? (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            ) : (
              <span className="bullet-dot" />
            )}
          </button>
        )}

        {/* Text area — divider shows hr */}
        {isDivider ? (
          <div className="node-text node-text--divider">
            <hr className="block-divider" />
          </div>
        ) : (
          /* contentEditable SIN hijos React — el contenido se gestiona
             via useEffect (innerHTML) para evitar el bug removeChild del reconciler */
          <div
            ref={contentRef}
            className={`node-text ${!isEditing ? 'node-text--rendered' : ''}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            data-placeholder="Escribe algo..."
          />
        )}

        {/* Open node button */}
        {!isDivider && (
          <button
            className="node-open-btn"
            onClick={openNode}
            tabIndex={-1}
            title="Abrir nodo"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M5 2H2v8h8V7M7 1h4m0 0v4m0-4L5.5 6.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            </svg>
          </button>
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
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Children */}
      {!isCollapsed && children.map(child => (
        <OutlinerNode
          key={child.id}
          node={child}
          depth={depth + 1}
          isSelected={isSelected && false} // selection handled by parent
          onSelect={onSelect}
          onSelectNext={onSelectNext}
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
