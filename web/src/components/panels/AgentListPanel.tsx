/**
 * AgentListPanel — lista de agentes en la columna derecha.
 * Mismo patrón unificado que Contextos y Prompts: clic en un agente abre su
 * contenido (hijos) en la ventana central y la columna derecha pasa a sus
 * propiedades. Pie: «Nuevo agente…».
 */
import React, { useState, useRef, useEffect } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { getAgentesNode, getAgentData } from '../../utils/agentesHelper'

interface Props {
  onSelectAgent: (nodeId: string) => void
  selectedAgentId?: string | null
}

export default function AgentListPanel({ onSelectAgent, selectedAgentId }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [adding, setAdding]         = useState(false)
  const [newName, setNewName]       = useState('')
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const newInputRef    = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (adding) setTimeout(() => newInputRef.current?.focus(), 30) }, [adding])

  const agentesNode = getAgentesNode()
  const agents = agentesNode
    ? store.children(agentesNode.id).filter(n => !n.deletedAt && (() => { try { return JSON.parse(n.extraData || '{}')._agentDef === '1' } catch { return false } })())
    : []
  void s.nodesVersion

  function createAgent(name: string) {
    const clean = name.trim()
    if (!clean) return
    const root = getAgentesNode()
    if (!root) return
    const sibs = store.children(root.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const node = store.createNode({ text: `🤖 ${clean}`, parentId: root.id, siblingOrder: maxOrder + 1000 })
    store.updateNode(node.id, {
      extraData: JSON.stringify({ _agentDef: '1', _agentId: node.id, _agentIcon: '🤖', _agentSystemPrompt: '', _agentUserMessage: '', _agentEnabled: 'true', _agentSchedule: '' }),
    })
    store.createNode({ text: '', parentId: node.id })
    onSelectAgent(node.id)
  }
  function confirmAdd() { const name = newName.trim(); setAdding(false); setNewName(''); createAgent(name) }

  function startRename(nodeId: string, currentText: string, e: React.MouseEvent) {
    e.stopPropagation(); setRenamingId(nodeId); setRenameValue(currentText)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }
  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null); setRenameValue('')
  }
  function deleteAgent(nodeId: string, e: React.MouseEvent) { e.stopPropagation(); store.deleteNode(nodeId) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '8px 0 4px' }}>
      <div style={{ padding: '2px 16px 8px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {t('agents.panelHint', 'Tus agentes. Ábrelos para editar sus instrucciones y configurarlos.')}
      </div>

      {agents.map(a => {
        const isActive   = selectedAgentId === a.id
        const isHovered  = hoveredId === a.id
        const isRenaming = renamingId === a.id
        const data = getAgentData(a.id)
        const enabled = data?.enabled ?? true
        return (
          <div key={a.id}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 16px',
                cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(62,92,118,0.08)' : isHovered ? 'var(--bg-hover)' : 'transparent',
                opacity: enabled ? 1 : 0.5,
              }}
              onMouseEnter={() => setHoveredId(a.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => { if (!isRenaming) onSelectAgent(a.id) }}
            >
              <span style={{ fontSize: 14, width: 18, flexShrink: 0, textAlign: 'center' }}>{data?.icon || '🤖'}</span>
              {isRenaming ? (
                <input
                  ref={renameInputRef} value={renameValue}
                  onChange={e => setRenameValue(e.target.value)} onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmRename() } if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null); setRenameValue('') } }}
                  onBlur={confirmRename}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
              ) : (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(a.text || '').replace(/^\p{Emoji_Presentation}\s*/u, '').trim() || a.text || t('common.noTitle')}
                </span>
              )}
              {!isRenaming && (isHovered || isActive) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <button title={t('common.rename', 'Renombrar')} onClick={e => startRename(a.id, a.text || '', e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '2px 4px', borderRadius: 3, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/></svg>
                  </button>
                  <button title={t('common.delete', 'Eliminar')} onClick={e => deleteAgent(a.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}>×</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {!adding ? (
        <div
          style={{ padding: '6px 16px', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'text', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => { setAdding(true); setTimeout(() => newInputRef.current?.focus(), 30) }}
        >
          <span style={{ width: 18, display: 'inline-block', flexShrink: 0, textAlign: 'center', opacity: 0.6 }}>+</span>
          <span style={{ fontStyle: 'italic', opacity: 0.6 }}>{t('agents.newAgent', 'Nuevo agente…')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', gap: 6 }}>
          <span style={{ width: 18, flexShrink: 0, display: 'inline-block' }} />
          <input
            ref={newInputRef} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd() } if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
            onBlur={() => { if (newName.trim()) confirmAdd(); else { setAdding(false); setNewName('') } }}
            placeholder={t('agents.newAgentPlaceholder', 'Nombre del agente…')}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      )}
    </div>
  )
}
