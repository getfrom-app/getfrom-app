/**
 * AutoContextBadge — Badge sutil de auto-clasificación de contexto.
 *
 * Muestra un chip pequeño junto al texto del nodo con el contexto sugerido por IA.
 * - Confidence >= 0.6 → color del contexto
 * - Confidence < 0.6 → gris con "?"
 * - Click → dropdown con lista de contextos para corregir
 * - Al corregir → guarda ejemplo few-shot y asigna el contexto al nodo
 *
 * Modo "confirmado" (assignedContextId prop):
 * - Muestra el contexto asignado manualmente por el usuario (sin prefijo ✦, opacidad plena)
 * - Click sigue abriendo el dropdown para cambiar el contexto si se desea
 *
 * El dropdown incluye campo de búsqueda con autofocus para filtrar contextos.
 * Si el texto no coincide exactamente con ningún contexto, aparece "+ Crear 'X'" al final.
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
import { saveExample, cancelClassify, CONFIDENCE_THRESHOLD, type ClassifyResult } from '../../api/autoClassify'
import { useTranslation } from 'react-i18next'
import type { Node as FromNode } from '../../types'

interface Props {
  node: FromNode
  result: ClassifyResult
  onContextAssigned: (nodeId: string) => void
  /** ID del contexto asignado manualmente. Cuando se pasa, el badge se muestra en modo "confirmado"
   *  (sin ✦, opacidad plena) independientemente del resultado IA. */
  assignedContextId?: string
}

export default function AutoContextBadge({ node, result, onContextAssigned, assignedContextId }: Props) {
  // node aquí es FromNode (del vault de From), no el DOM Node
  const { t } = useTranslation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [searchText, setSearchText] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Modo confirmado: el usuario asignó el contexto manualmente
  const isConfirmedMode = !!assignedContextId

  // Obtener la lista de contextos del usuario
  const tagsRoot = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
  const contextNodes = tagsRoot
    ? store.children(tagsRoot.id).filter(n => !n.deletedAt)
    : []

  // Filtrado y lógica de crear nuevo contexto
  const searchLower = searchText.trim().toLowerCase()
  const filteredContextNodes = searchLower
    ? contextNodes.filter(n => n.text.toLowerCase().includes(searchLower))
    : contextNodes
  const exactMatch = searchLower
    ? contextNodes.some(n => n.text.toLowerCase() === searchLower)
    : false
  const canCreateNew = searchText.trim().length > 0 && !exactMatch

  // Nodo del contexto sugerido (IA) o asignado (manual)
  const activeContextId = isConfirmedMode ? assignedContextId : result.contextId
  const suggestedCtxNode = activeContextId
    ? contextNodes.find(n => n.id === activeContextId)
    : null

  const highConfidence = isConfirmedMode ? true : result.confidence >= CONFIDENCE_THRESHOLD

  // Color del badge
  const badgeColor = (highConfidence || isConfirmedMode) && suggestedCtxNode
    ? (() => {
        try {
          const ed = JSON.parse(suggestedCtxNode.extraData || '{}')
          return ed._tagColor || '#7c3aed'
        } catch { return '#7c3aed' }
      })()
    : '#888'

  // Cerrar dropdown al clicar fuera
  useEffect(() => {
    if (!showDropdown) return
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as globalThis.Node) &&
          btnRef.current && !btnRef.current.contains(e.target as globalThis.Node)) {
        setShowDropdown(false)
        setSearchText('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  // Autofocus en el campo de búsqueda al abrir el dropdown
  useEffect(() => {
    if (showDropdown) {
      setTimeout(() => searchRef.current?.focus(), 30)
    }
  }, [showDropdown])

  function openDropdown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)),
      })
    }
    setSearchText('')
    setShowDropdown(v => !v)
  }

  function createAndAssignContext() {
    const name = searchText.trim()
    if (!name) return
    const root = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
    if (!root) return
    const sibs = store.children(root.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const newNode = store.createNode({ text: name, parentId: root.id, siblingOrder: maxOrder + 1000 })
    assignContext(newNode.id)
  }

  function assignContext(contextNodeId: string | null) {
    setShowDropdown(false)
    setSearchText('')
    // Guardar ejemplo few-shot si hay texto y contexto seleccionado
    if (contextNodeId && node.text?.trim()) {
      saveExample(node.text.trim(), contextNodeId)
    }
    // Construir el nuevo array de types[], removiendo el contexto anterior si era manual
    const builtinTags = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])
    const existingTypes = node.types || []
    // Quitar cualquier contexto de usuario que hubiera antes (solo uno a la vez)
    const typesWithoutUserCtx = existingTypes.filter(t => builtinTags.has(t))
    if (contextNodeId) {
      // Leer directamente del store para incluir nodos recién creados
      const currentTagsRoot = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
      const currentContextNodes = currentTagsRoot ? store.children(currentTagsRoot.id).filter(n => !n.deletedAt) : contextNodes
      const contextNode = currentContextNodes.find(n => n.id === contextNodeId)
      const tagName = contextNode?.text || ''
      if (tagName) {
        const newTypes = typesWithoutUserCtx.includes(tagName)
          ? typesWithoutUserCtx
          : [...typesWithoutUserCtx, tagName]
        store.updateNode(node.id, { types: newTypes })
      }
      // Marcar como asignado manualmente en extraData y limpiar sugerencia IA
      try {
        const ed = JSON.parse(node.extraData || '{}')
        ed._contextManuallySet = '1'
        delete ed._autoContextId
        delete ed._autoContextConfidence
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
    } else {
      // "Sin contexto": quitar todos los user-context types y limpiar flag
      store.updateNode(node.id, { types: typesWithoutUserCtx })
      try {
        const ed = JSON.parse(node.extraData || '{}')
        delete ed._contextManuallySet
        delete ed._autoContextId
        delete ed._autoContextConfidence
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
    }
    // Cancelar clasificaciones pendientes y limpiar caché
    cancelClassify(node.id)
    onContextAssigned(node.id)
  }

  const badgeLabel = isConfirmedMode
    ? (suggestedCtxNode?.text || '?')
    : highConfidence && suggestedCtxNode
      ? suggestedCtxNode.text
      : result.confidence > 0 && suggestedCtxNode
        ? `? ${suggestedCtxNode.text}`
        : '?'

  const badgeTitle = isConfirmedMode
    ? t('autoCtx.badgeTooltipManual', { context: suggestedCtxNode?.text || '' })
    : t('autoCtx.badgeTooltip', { confidence: Math.round(result.confidence * 100) })

  return (
    <>
      <button
        ref={btnRef}
        className="auto-ctx-badge"
        style={{
          background: badgeColor + '22',
          color: badgeColor,
          border: `1px solid ${badgeColor}70`,
          borderRadius: 4,
          padding: '0 6px',
          fontSize: '0.78em',
          fontWeight: 500,
          cursor: 'pointer',
          lineHeight: '18px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          opacity: isConfirmedMode ? 1 : highConfidence ? 1 : 0.65,
          transition: 'opacity 0.2s',
        }}
        title={badgeTitle}
        onMouseDown={e => e.preventDefault()}
        onClick={openDropdown}
        tabIndex={-1}
      >
        {isConfirmedMode ? badgeLabel : `✦ ${badgeLabel}`}
      </button>

      {showDropdown && createPortal(
        <div
          className="auto-ctx-dropdown"
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            minWidth: 200,
            maxWidth: 280,
            padding: '6px 0',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Campo de búsqueda con autofocus */}
          <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={searchRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder={t('autoCtx.searchOrCreate', 'Buscar o crear...')}
              style={{
                width: '100%',
                padding: '4px 8px',
                background: 'var(--bg-primary, var(--bg-secondary))',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canCreateNew) {
                    createAndAssignContext()
                  } else if (filteredContextNodes.length === 1) {
                    assignContext(filteredContextNodes[0].id)
                  }
                } else if (e.key === 'Escape') {
                  setShowDropdown(false)
                  setSearchText('')
                }
                e.stopPropagation()
              }}
            />
          </div>
          {/* Lista filtrada de contextos */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredContextNodes.map(ctx => {
              const isSelected = ctx.id === activeContextId
              let ctxColor = '#7c3aed'
              try {
                const ed = JSON.parse(ctx.extraData || '{}')
                if (ed._tagColor) ctxColor = ed._tagColor
              } catch { /* ignore */ }
              return (
                <button
                  key={ctx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 12px',
                    background: isSelected ? ctxColor + '18' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: isSelected ? ctxColor : 'var(--text-primary)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = ctxColor + '12')}
                  onMouseLeave={e => (e.currentTarget.style.background = isSelected ? ctxColor + '18' : 'transparent')}
                  onClick={() => assignContext(ctx.id)}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ctxColor, flexShrink: 0 }} />
                  {ctx.text}
                  {isSelected && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>✓ {isConfirmedMode ? t('autoCtx.assigned') : t('autoCtx.suggested')}</span>}
                </button>
              )
            })}
          </div>
          {/* Opción "+ Crear 'X'" si no hay coincidencia exacta */}
          {canCreateNew && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 2 }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--accent, #7c3aed)',
                  textAlign: 'left',
                  fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={createAndAssignContext}
              >
                + {t('autoCtx.createContext', 'Crear')} "{searchText.trim()}"
              </button>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: canCreateNew ? 0 : 4 }}>
            <button
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => assignContext(null)}
            >
              {t('autoCtx.noContext')}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/**
 * ContextPlaceholderBadge — Badge "+ Contexto" siempre visible cuando no hay contexto asignado.
 * Se usa en OutlinerNode (outliner normal) y en NodeView (cabecera del nodo abierto).
 * Al hacer clic abre el dropdown de contextos para asignación manual inmediata.
 */
export function ContextPlaceholderBadge({ node, onContextAssigned }: {
  node: FromNode
  onContextAssigned: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [searchText, setSearchText] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const tagsRoot = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
  const contextNodes = tagsRoot ? store.children(tagsRoot.id).filter(n => !n.deletedAt) : []

  // Filtrado y lógica de crear nuevo contexto
  const searchLower = searchText.trim().toLowerCase()
  const filteredContextNodes = searchLower
    ? contextNodes.filter(n => n.text.toLowerCase().includes(searchLower))
    : contextNodes
  const exactMatch = searchLower
    ? contextNodes.some(n => n.text.toLowerCase() === searchLower)
    : false
  const canCreateNew = searchText.trim().length > 0 && !exactMatch

  useEffect(() => {
    if (!showDropdown) return
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as globalThis.Node) &&
          btnRef.current && !btnRef.current.contains(e.target as globalThis.Node)) {
        setShowDropdown(false)
        setSearchText('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  // Autofocus en el campo de búsqueda al abrir el dropdown
  useEffect(() => {
    if (showDropdown) {
      setTimeout(() => searchRef.current?.focus(), 30)
    }
  }, [showDropdown])

  function openDropdown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)),
      })
    }
    setSearchText('')
    setShowDropdown(v => !v)
  }

  function assignContext(contextNodeId: string) {
    setShowDropdown(false)
    setSearchText('')
    // Obtener lista actualizada de contextos para el nodo recién creado
    const allContextNodes = tagsRoot ? store.children(tagsRoot.id).filter(n => !n.deletedAt) : []
    if (node.text?.trim()) saveExample(node.text.trim(), contextNodeId)
    const contextNode = allContextNodes.find(n => n.id === contextNodeId)
    const tagName = contextNode?.text || ''
    if (tagName) {
      const existingTypes = node.types || []
      if (!existingTypes.includes(tagName)) {
        store.updateNode(node.id, { types: [...existingTypes, tagName] })
      }
    }
    try {
      const ed = JSON.parse(node.extraData || '{}')
      ed._contextManuallySet = '1'
      delete ed._autoContextId
      delete ed._autoContextConfidence
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch { /* ignore */ }
    cancelClassify(node.id)
    onContextAssigned(node.id)
  }

  function createAndAssignContext() {
    const name = searchText.trim()
    if (!name) return
    const root = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
    if (!root) return
    const sibs = store.children(root.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const newNode = store.createNode({ text: name, parentId: root.id, siblingOrder: maxOrder + 1000 })
    assignContext(newNode.id)
  }

  if (contextNodes.length === 0 && !canCreateNew) return null

  return (
    <>
      <button
        ref={btnRef}
        className="auto-ctx-badge auto-ctx-badge--placeholder"
        style={{
          background: 'transparent',
          color: 'var(--text-tertiary)',
          border: '1px dashed var(--border)',
          borderRadius: 4,
          padding: '0 6px',
          fontSize: '0.78em',
          fontWeight: 500,
          cursor: 'pointer',
          lineHeight: '18px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          opacity: 0.7,
          transition: 'opacity 0.2s',
        }}
        title={t('autoCtx.assignContext', 'Asignar contexto')}
        onMouseDown={e => e.preventDefault()}
        onClick={openDropdown}
        tabIndex={-1}
      >
        + {t('autoCtx.assignContext', 'Contexto')}
      </button>

      {showDropdown && createPortal(
        <div
          className="auto-ctx-dropdown"
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            minWidth: 200,
            maxWidth: 280,
            padding: '6px 0',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Campo de búsqueda con autofocus */}
          <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={searchRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder={t('autoCtx.searchOrCreate', 'Buscar o crear...')}
              style={{
                width: '100%',
                padding: '4px 8px',
                background: 'var(--bg-primary, var(--bg-secondary))',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canCreateNew) {
                    createAndAssignContext()
                  } else if (filteredContextNodes.length === 1) {
                    assignContext(filteredContextNodes[0].id)
                  }
                } else if (e.key === 'Escape') {
                  setShowDropdown(false)
                  setSearchText('')
                }
                e.stopPropagation()
              }}
            />
          </div>
          {/* Lista filtrada de contextos */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredContextNodes.map(ctx => {
              let ctxColor = '#7c3aed'
              try {
                const ed = JSON.parse(ctx.extraData || '{}')
                if (ed._tagColor) ctxColor = ed._tagColor
              } catch { /* ignore */ }
              return (
                <button
                  key={ctx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = ctxColor + '12')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => assignContext(ctx.id)}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ctxColor, flexShrink: 0 }} />
                  {ctx.text}
                </button>
              )
            })}
          </div>
          {/* Opción "+ Crear 'X'" si no hay coincidencia exacta */}
          {canCreateNew && (
            <div style={{ borderTop: filteredContextNodes.length > 0 ? '1px solid var(--border)' : 'none', marginTop: 2 }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--accent, #7c3aed)',
                  textAlign: 'left',
                  fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={createAndAssignContext}
              >
                + {t('autoCtx.createContext', 'Crear')} "{searchText.trim()}"
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
