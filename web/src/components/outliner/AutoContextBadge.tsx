/**
 * AutoContextBadge — Badge sutil de auto-clasificación de contexto.
 *
 * Muestra un chip pequeño junto al texto del nodo con el contexto sugerido por IA.
 * - Confidence >= 0.6 → color del contexto
 * - Confidence < 0.6 → gris con "?"
 * - Click → dropdown con lista de contextos para corregir
 * - Al corregir → guarda ejemplo few-shot y asigna el contexto al nodo
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
}

export default function AutoContextBadge({ node, result, onContextAssigned }: Props) {
  // node aquí es FromNode (del vault de From), no el DOM Node
  const { t } = useTranslation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Obtener la lista de contextos del usuario
  const tagsRoot = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
  const contextNodes = tagsRoot
    ? store.children(tagsRoot.id).filter(n => !n.deletedAt)
    : []

  // Nodo del contexto sugerido
  const suggestedCtxNode = result.contextId
    ? contextNodes.find(n => n.id === result.contextId)
    : null

  const highConfidence = result.confidence >= CONFIDENCE_THRESHOLD

  // Color del badge
  const badgeColor = highConfidence && suggestedCtxNode
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
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
    setShowDropdown(v => !v)
  }

  function assignContext(contextNodeId: string | null) {
    setShowDropdown(false)
    // Guardar ejemplo few-shot si hay texto y contexto seleccionado
    if (contextNodeId && node.text?.trim()) {
      saveExample(node.text.trim(), contextNodeId)
    }
    // Asignar el contexto al nodo vía types[]
    if (contextNodeId) {
      const contextNode = contextNodes.find(n => n.id === contextNodeId)
      const tagName = contextNode?.text || ''
      if (tagName) {
        const existingTypes = node.types || []
        if (!existingTypes.includes(tagName)) {
          store.updateNode(node.id, { types: [...existingTypes, tagName] })
        }
      }
      // Marcar como asignado manualmente en extraData y limpiar sugerencia IA
      try {
        const ed = JSON.parse(node.extraData || '{}')
        ed._contextManuallySet = '1'
        delete ed._autoContextId
        delete ed._autoContextConfidence
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
    }
    // Cancelar clasificaciones pendientes y limpiar caché
    cancelClassify(node.id)
    onContextAssigned(node.id)
  }

  const badgeLabel = highConfidence && suggestedCtxNode
    ? suggestedCtxNode.text
    : result.confidence > 0 && suggestedCtxNode
      ? `? ${suggestedCtxNode.text}`
      : '?'

  return (
    <>
      <button
        ref={btnRef}
        className="auto-ctx-badge"
        style={{
          background: badgeColor + '18',
          color: badgeColor,
          border: `1px solid ${badgeColor}40`,
          borderRadius: 4,
          padding: '0 6px',
          fontSize: '0.78em',
          fontWeight: 500,
          cursor: 'pointer',
          lineHeight: '18px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          opacity: highConfidence ? 0.9 : 0.65,
          transition: 'opacity 0.2s',
        }}
        title={t('autoCtx.badgeTooltip', { confidence: Math.round(result.confidence * 100) })}
        onMouseDown={e => e.preventDefault()}
        onClick={openDropdown}
        tabIndex={-1}
      >
        ✦ {badgeLabel}
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
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            minWidth: 200,
            maxWidth: 280,
            padding: '6px 0',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ padding: '4px 12px 6px', fontSize: 11, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
            {t('autoCtx.dropdownTitle')}
          </div>
          {contextNodes.map(ctx => {
            const isSelected = ctx.id === result.contextId
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
                {isSelected && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>✓ sugerido</span>}
              </button>
            )
          })}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
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
