import { useRef, useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import InlineRenderer, { detectBlockType } from './InlineRenderer'
import SlashMenu from './SlashMenu'

interface Props {
  node: Node
  depth: number
  isSelected: boolean
  onSelect: (id: string) => void
  onSelectNext: (id: string, dir: 'up' | 'down') => void
}

export default function OutlinerNode({ node, depth, isSelected, onSelect, onSelectNext }: Props) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  const children = store.children(node.id)
  const isCollapsed = node.isCollapsed && children.length > 0
  const [isEditing, setIsEditing] = useState(false)
  const [showSlash, setShowSlash] = useState(false)

  const blockType = detectBlockType(node.text)
  const isHeading = blockType === 'h1' || blockType === 'h2' || blockType === 'h3'
  const isDivider = blockType === 'divider'

  // Sync DOM text with node.text when not editing
  useEffect(() => {
    if (!isEditing && contentRef.current && contentRef.current.textContent !== node.text) {
      contentRef.current.textContent = node.text
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

  const handleInput = useCallback(() => {
    const text = contentRef.current?.textContent || ''
    store.updateNode(node.id, { text })

    // Show slash menu when user types '/' at the very beginning
    if (text === '/') {
      setShowSlash(true)
    } else if (!text.startsWith('/')) {
      setShowSlash(false)
    }
  }, [node.id])

  const handleFocus = useCallback(() => {
    setIsEditing(true)
    onSelect(node.id)
    // Show plain text in the contentEditable
    if (contentRef.current) {
      contentRef.current.textContent = node.text
    }
  }, [node.id, node.text, onSelect])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    setShowSlash(false)
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

    if (e.key === 'Enter') {
      e.preventDefault()
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
  }, [node, onSelect, onSelectNext, showSlash])

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

  function handleSlashSelect(prefix: string, isTask?: boolean) {
    setShowSlash(false)
    const newText = prefix
    store.updateNode(node.id, {
      text: newText,
      ...(isTask ? { status: 'pending' } : {}),
    })
    // Restore cursor position in contentEditable
    if (contentRef.current) {
      contentRef.current.textContent = newText
      contentRef.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(contentRef.current)
      range.collapse(false)
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
  ].filter(Boolean).join(' ')

  return (
    <div className="outliner-node" style={{ '--depth': depth } as React.CSSProperties}>
      <div className={nodeRowClass}>
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
          <div
            ref={contentRef}
            className={`node-text ${isEditing ? '' : 'node-text--rendered'}`}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            data-placeholder="Escribe algo..."
          >
            {!isEditing && node.text ? (
              <InlineRenderer text={node.text} />
            ) : null}
          </div>
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

      {/* Slash menu */}
      {showSlash && (
        <SlashMenu
          anchorEl={contentRef.current}
          onSelect={handleSlashSelect}
          onClose={() => setShowSlash(false)}
        />
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
    </div>
  )
}
