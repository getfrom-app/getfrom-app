/**
 * ContextListPanel — lista de contextos en panel derecho
 * Hover: lápiz (renombrar) + × (eliminar), igual que los filtros guardados
 * Incluye sección "Sin clasificar" con nodos sin contexto asignado.
 */
import React, { useState, useRef, useEffect } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
import { useTranslation } from 'react-i18next'
import { getCachedClassify, CONFIDENCE_THRESHOLD } from '../../api/autoClassify'

/** Constante especial para indicar el filtro "Sin clasificar" */
export const UNCLASSIFIED_FILTER_ID = '__unclassified__'

interface Props {
  onSelectContext: (nodeId: string) => void
  selectedContextId?: string | null
}

export default function ContextListPanel({ onSelectContext, selectedContextId }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set())
  const [addingCtx, setAddingCtx]       = useState(false)
  const [newCtxName, setNewCtxName]     = useState('')
  const [hoveredId, setHoveredId]       = useState<string | null>(null)
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameValue, setRenameValue]   = useState('')
  const newCtxInputRef  = useRef<HTMLInputElement>(null)
  const renameInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingCtx) setTimeout(() => newCtxInputRef.current?.focus(), 30)
  }, [addingCtx])

  function createCtx() {
    const name = newCtxName.trim()
    setAddingCtx(false)
    setNewCtxName('')
    if (!name) return
    const root = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
    if (!root) return
    const sibs = store.children(root.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const newNode = store.createNode({ text: name, parentId: root.id, siblingOrder: maxOrder + 1000 })
    onSelectContext(newNode.id)
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

  function renderCtx(nodeId: string, depth: number): React.ReactNode {
    const node = s.getNode(nodeId)
    if (!node || node.deletedAt) return null
    const kids = s.children(nodeId).filter(n => !n.deletedAt && s.children(n.id).filter(k => !k.deletedAt).length > 0)
    const isActive   = selectedContextId === nodeId
    const expanded   = expandedIds.has(nodeId)
    const isHovered  = hoveredId === nodeId
    const isRenaming = renamingId === nodeId

    return (
      <div key={nodeId}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: `5px 8px 5px ${16 + depth * 16}px`,
            cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isActive ? 'rgba(139,92,246,0.08)' : isHovered ? 'var(--bg-hover)' : 'transparent',
          }}
          onMouseEnter={() => setHoveredId(nodeId)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => { if (!isRenaming) onSelectContext(nodeId) }}
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
                title="Renombrar"
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
                title="Eliminar"
                onClick={e => deleteCtx(nodeId, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error, #e53e3e)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >×</button>
            </div>
          )}
        </div>
        {kids.length > 0 && expanded && kids.map(k => renderCtx(k.id, depth + 1))}
      </div>
    )
  }

  const contextoRoot = s.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
  const contextos = contextoRoot ? s.children(contextoRoot.id).filter(n => !n.deletedAt) : []

  // Calcular cuántos nodos están sin clasificar (sin user-tags en types[])
  const builtinTags = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])
  const unclassifiedCount = s.allActive().filter(n => {
    if (n.isDiaryEntry || n.deletedAt) return false
    // ¿tiene contextos manuales?
    const userTypes = (n.types || []).filter(t => !builtinTags.has(t))
    if (userTypes.length > 0) return false
    // ¿tiene @mention de contexto?
    if (/@\w/.test(n.text || '')) return false
    // ¿fue asignado manualmente via badge?
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (ed._contextManuallySet === '1') return false
    } catch { /* ignore */ }
    // Solo contar nodos con texto significativo
    return (n.text || '').trim().length >= 4
  }).length

  const isUnclassifiedActive = selectedContextId === UNCLASSIFIED_FILTER_ID

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '8px 0 4px' }}>
      {/* Filtro especial: Sin clasificar */}
      {unclassifiedCount > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px 5px 16px',
            cursor: 'pointer', fontSize: 13,
            color: isUnclassifiedActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isUnclassifiedActive ? 'rgba(139,92,246,0.08)' : 'transparent',
            borderBottom: '1px solid var(--border)',
            marginBottom: 4,
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
      )}

      {contextos.map(c => renderCtx(c.id, 0))}

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
            placeholder="Nombre del contexto…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      )}
    </div>
  )
}
