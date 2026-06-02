/**
 * ContextListPanel — lista de contextos en panel derecho
 * Reemplaza la sección CONTEXTOS del sidebar izquierdo (eliminado v9.5.20)
 */
import React, { useState, useRef, useEffect } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
import { useTranslation } from 'react-i18next'

interface Props {
  onSelectContext: (nodeId: string) => void
  selectedContextId?: string | null
}

export default function ContextListPanel({ onSelectContext, selectedContextId }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [addingCtx, setAddingCtx] = useState(false)
  const [newCtxName, setNewCtxName] = useState('')
  const newCtxInputRef = useRef<HTMLInputElement>(null)

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
    const kids = s.children(nodeId)
      .filter(n => !n.deletedAt && s.children(n.id).filter(k => !k.deletedAt).length > 0)
    const isActive = selectedContextId === nodeId
    const expanded = expandedIds.has(nodeId)
    return (
      <div key={nodeId}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: `5px 16px 5px ${16 + depth * 16}px`,
            cursor: 'pointer', fontSize: 13, borderRadius: 4,
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isActive ? 'rgba(139,92,246,0.08)' : 'transparent',
          }}
          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          onClick={() => onSelectContext(nodeId)}
        >
          {kids.length > 0 ? (
            <span
              style={{ fontSize: 14, opacity: 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', userSelect: 'none', cursor: 'pointer' }}
              onClick={e => toggleExpand(nodeId, e)}
            >›</span>
          ) : (
            <span style={{ width: 18, flexShrink: 0, display: 'inline-block' }} />
          )}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.text || t('common.noTitle')}
          </span>
        </div>
        {kids.length > 0 && expanded && kids.map(k => renderCtx(k.id, depth + 1))}
      </div>
    )
  }

  const contextoRoot = s.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
  const contextos = contextoRoot ? s.children(contextoRoot.id).filter(n => !n.deletedAt) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '8px 0 4px' }}>
      {/* Lista de contextos */}
      {contextos.map(c => renderCtx(c.id, 0))}

      {/* Nodo vacío al final — clic para crear nuevo contexto */}
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
