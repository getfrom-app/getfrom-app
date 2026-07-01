/**
 * ContextListPanel — lista de contextos en panel derecho
 * Hover: lápiz (renombrar) + × (eliminar), igual que los filtros guardados
 * Incluye sección "Sin clasificar" con nodos sin contexto asignado.
 * Soporta drag & drop: arrastrar un nodo desde la lista "Sin clasificar"
 * y soltarlo sobre un contexto para asignárselo.
 * El nodo Perfil IA aparece siempre fijo encima de la lista de contextos.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
import { findContextRoot } from '../../utils/rootLookup'
import { useTranslation } from 'react-i18next'
import { getUnclassifiedIds } from '../../utils/unclassified'
import { DRAG_NODE_ID_KEY } from '../views/FilteredList'

/** Constante especial para indicar el filtro "Sin clasificar" */
export const UNCLASSIFIED_FILTER_ID = '__unclassified__'

/** Clave dataTransfer para arrastrar un contexto sobre otro (anidar) */
export const DRAG_CONTEXT_ID_KEY = 'application/x-from-context-id'

interface Props {
  onSelectContext: (nodeId: string) => void
  selectedContextId?: string | null
}

/**
 * Asigna un contexto a un nodo usando el mismo mecanismo que AutoContextBadge.
 * Añade el tagName a types[] y marca _contextManuallySet=1 en extraData.
 */
function assignContextToNode(nodeId: string, contextNodeId: string) {
  const node = store.getNode(nodeId)
  if (!node) return
  const tagsRoot = findContextRoot()
  if (!tagsRoot) return
  const contextNodes = store.children(tagsRoot.id).filter(n => !n.deletedAt)
  const contextNode = contextNodes.find(n => n.id === contextNodeId)
  if (!contextNode) return
  const tagName = contextNode.text || ''
  if (!tagName) return
  const existingTypes = node.types || []
  if (!existingTypes.includes(tagName)) {
    store.updateNode(nodeId, { types: [...existingTypes, tagName] })
  }
  try {
    const ed = JSON.parse(node.extraData || '{}')
    ed._contextManuallySet = '1'
    delete ed._autoContextId
    delete ed._autoContextConfidence
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  } catch { /* ignore */ }
}

export default function ContextListPanel({ onSelectContext, selectedContextId }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set())
  const [addingCtx, setAddingCtx]       = useState(false)
  const [newCtxName, setNewCtxName]     = useState('')
  const [hoveredId, setHoveredId]       = useState<string | null>(null)
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameValue, setRenameValue]   = useState('')
  // ID del contexto sobre el que se está haciendo dragOver (feedback visual)
  const [dragOverId, setDragOverId]     = useState<string | null>(null)
  const newCtxInputRef  = useRef<HTMLInputElement>(null)
  const renameInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingCtx) setTimeout(() => newCtxInputRef.current?.focus(), 30)
  }, [addingCtx])

  function createNamedContext(name: string) {
    const clean = name.trim()
    if (!clean) return
    const root = findContextRoot()
    if (!root) return
    // Evitar duplicado por nombre
    const existing = store.children(root.id).find(n => !n.deletedAt && (n.text || '').trim().toLowerCase() === clean.toLowerCase())
    if (existing) { onSelectContext(existing.id); return }
    const sibs = store.children(root.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const newNode = store.createNode({ text: clean, parentId: root.id, siblingOrder: maxOrder + 1000 })
    onSelectContext(newNode.id)
  }

  function createCtx() {
    const name = newCtxName.trim()
    setAddingCtx(false)
    setNewCtxName('')
    createNamedContext(name)
  }

  function startRename(nodeId: string, currentText: string, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(nodeId)
    setRenameValue(currentText)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }

  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null)
    setRenameValue('')
  }

  function deleteCtx(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    store.deleteNode(nodeId)
  }

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Drag & drop de nodo a contexto ────────────────────────────────────────

  function handleDragOver(e: React.DragEvent, contextId: string) {
    const types = e.dataTransfer.types
    const isNodeDrag = types.includes(DRAG_NODE_ID_KEY)
    const isCtxDrag = types.includes(DRAG_CONTEXT_ID_KEY)
    if (!isNodeDrag && !isCtxDrag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(contextId)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Solo limpiar si salimos del elemento (no de un hijo)
    if (!e.currentTarget.contains(e.relatedTarget as Element)) {
      setDragOverId(null)
    }
  }

  /** ¿targetId es descendiente de ctxId (o el mismo)? — evita ciclos al anidar */
  function isDescendantOf(targetId: string, ctxId: string): boolean {
    let cur = store.getNode(targetId)
    while (cur) {
      if (cur.id === ctxId) return true
      if (!cur.parentId) return false
      cur = store.getNode(cur.parentId)
    }
    return false
  }

  function handleDrop(e: React.DragEvent, contextId: string) {
    e.preventDefault()
    setDragOverId(null)
    // Anidar un contexto dentro de otro (re-parent)
    const draggedCtxId = e.dataTransfer.getData(DRAG_CONTEXT_ID_KEY)
    if (draggedCtxId) {
      if (draggedCtxId === contextId) return
      // No permitir soltar un contexto dentro de uno de sus propios descendientes
      if (isDescendantOf(contextId, draggedCtxId)) return
      store.updateNode(draggedCtxId, { parentId: contextId })
      setExpandedIds(prev => { const next = new Set(prev); next.add(contextId); return next })
      return
    }
    // Asignar un nodo clasificado a este contexto
    const nodeId = e.dataTransfer.getData(DRAG_NODE_ID_KEY)
    if (!nodeId) return
    assignContextToNode(nodeId, contextId)
  }

  function handleCtxDragStart(e: React.DragEvent, contextId: string) {
    e.dataTransfer.setData(DRAG_CONTEXT_ID_KEY, contextId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function renderCtx(nodeId: string, depth: number): React.ReactNode {
    const node = s.getNode(nodeId)
    if (!node || node.deletedAt) return null
    // Subcontextos = hijos que NO son nodos de conocimiento (🧠) ni clasificados.
    // La asignación a contexto usa types[], no parentId — por tanto los únicos
    // hijos reales de un contexto son subcontextos o nodos 🧠 (excluidos).
    const kids = s.children(nodeId).filter(n => !n.deletedAt && !(n.text || '').startsWith('🧠'))
    const isActive    = selectedContextId === nodeId
    const expanded    = expandedIds.has(nodeId)
    const isHovered   = hoveredId === nodeId
    const isRenaming  = renamingId === nodeId
    const isDragOver  = dragOverId === nodeId

    return (
      <div key={nodeId}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: `5px 8px 5px ${16 + depth * 16}px`,
            cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isDragOver
              ? 'rgba(139,92,246,0.18)'
              : isActive
                ? 'rgba(139,92,246,0.08)'
                : isHovered
                  ? 'var(--bg-hover)'
                  : 'transparent',
            outline: isDragOver ? '2px solid var(--accent)' : 'none',
            borderRadius: isDragOver ? 5 : 0,
            transition: 'background 0.1s, outline 0.1s',
          }}
          draggable={!isRenaming}
          onDragStart={e => handleCtxDragStart(e, nodeId)}
          onMouseEnter={() => setHoveredId(nodeId)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => { if (!isRenaming) onSelectContext(nodeId) }}
          onDragOver={e => handleDragOver(e, nodeId)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, nodeId)}
        >
          {kids.length > 0 ? (
            <span
              style={{ fontSize: 14, opacity: 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', userSelect: 'none', cursor: 'pointer' }}
              onClick={e => toggleExpand(nodeId, e)}
            >›</span>
          ) : (
            <span style={{ width: 18, flexShrink: 0, display: 'inline-block' }} />
          )}

          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null); setRenameValue('') }
              }}
              onBlur={confirmRename}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
            />
          ) : (
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.text || t('common.noTitle')}
            </span>
          )}

          {/* Botones hover: lápiz + × */}
          {!isRenaming && (isHovered || isActive) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <button
                title={t('common.rename')}
                onClick={e => startRename(nodeId, node.text || '', e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '2px 4px', borderRadius: 3, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/>
                </svg>
              </button>
              <button
                title={t('common.delete')}
                onClick={e => deleteCtx(nodeId, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error, #e53e3e)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >×</button>
            </div>
          )}
        </div>
        {expanded && kids.map(k => renderCtx(k.id, depth + 1))}
      </div>
    )
  }

  const contextoRoot = findContextRoot()

  // Nodo perfil IA — identificado por extraData._perfilIA === '1'
  const perfilNode = useMemo(() => {
    return s.allActive().find(n => {
      try { return JSON.parse(n.extraData || '{}')._perfilIA === '1' } catch { return false }
    }) ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion])

  // Contextos normales — excluir el nodo de perfil de la lista principal
  const contextos = contextoRoot
    ? s.children(contextoRoot.id).filter(n => !n.deletedAt && n.id !== perfilNode?.id)
    : []

  // Contador coherente con la lista (mismo util: solo Agenda, sin clasificados)
  const unclassifiedCount = useMemo(() => getUnclassifiedIds().size, [s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const isUnclassifiedActive = selectedContextId === UNCLASSIFIED_FILTER_ID

  const isPerfilActive = perfilNode ? selectedContextId === perfilNode.id : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '8px 0 4px' }}>
      {/* Perfil IA — siempre fijo encima de la lista de contextos */}
      {perfilNode && (
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 4, paddingBottom: 4 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px 5px 16px',
              cursor: 'pointer', fontSize: 13,
              color: isPerfilActive ? 'var(--accent)' : 'var(--text-primary)',
              background: isPerfilActive ? 'rgba(139,92,246,0.08)' : 'transparent',
              fontWeight: isPerfilActive ? 600 : 500,
            }}
            onClick={() => navigate('/node/' + perfilNode.id)}
          >
            <span style={{ fontSize: 14, width: 18, flexShrink: 0, textAlign: 'center' }}>🧠</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('profile.panelLabel')}
            </span>
          </div>
        </div>
      )}

      {/* Filtro especial: Sin clasificar */}
      {unclassifiedCount > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
          {/* Fila principal: filtro + contador */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px 5px 16px',
              cursor: 'pointer', fontSize: 13,
              color: isUnclassifiedActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isUnclassifiedActive ? 'rgba(139,92,246,0.08)' : 'transparent',
            }}
            onClick={() => onSelectContext(UNCLASSIFIED_FILTER_ID)}
          >
            <span style={{ fontSize: 14, opacity: 0.5, width: 18, flexShrink: 0, textAlign: 'center' }}>✦</span>
            <span style={{ flex: 1 }}>{t('autoCtx.unclassifiedFilter')}</span>
            <span style={{
              background: isUnclassifiedActive ? 'var(--accent)' : 'var(--bg-hover)',
              color: isUnclassifiedActive ? '#fff' : 'var(--text-tertiary)',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}>{unclassifiedCount}</span>
          </div>
        </div>
      )}

      {contextos.map(c => renderCtx(c.id, 0))}

      {/* Empty-state: sugerencias de contextos iniciales para empezar desde cero */}
      {contextos.length === 0 && !addingCtx && (
        <div style={{ padding: '8px 16px 6px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 8 }}>
            {t('ctx.starterHint', 'Los contextos agrupan tus notas por tema. Crea uno para empezar:')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              t('ctx.starterPersonal', 'Personal'),
              t('ctx.starterFamily', 'Familia y amigos'),
              t('ctx.starterWork', 'Trabajo'),
              t('ctx.starterHobbies', 'Aficiones'),
              t('ctx.starterTravel', 'Viajes'),
              t('ctx.starterIdeas', 'Ideas'),
            ].map(name => (
              <button
                key={name}
                onClick={() => createNamedContext(name)}
                style={{
                  background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 14,
                  padding: '4px 11px', fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <span style={{ opacity: 0.7 }}>+</span> {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!addingCtx ? (
        <div
          style={{ padding: '5px 16px', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'text', display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => { setAddingCtx(true); setTimeout(() => newCtxInputRef.current?.focus(), 30) }}
        >
          <span style={{ width: 18, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Nuevo contexto…</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', padding: '5px 16px', gap: 4 }}>
          <span style={{ width: 18, flexShrink: 0, display: 'inline-block' }} />
          <input
            ref={newCtxInputRef}
            value={newCtxName}
            onChange={e => setNewCtxName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); createCtx() }
              if (e.key === 'Escape') { setAddingCtx(false); setNewCtxName('') }
            }}
            onBlur={() => { if (newCtxName.trim()) createCtx(); else { setAddingCtx(false); setNewCtxName('') } }}
            placeholder={t('contextListPanel.namePlaceholder')}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      )}
    </div>
  )
}
