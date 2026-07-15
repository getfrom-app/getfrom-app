/**
 * PromptListPanel — lista de prompts en la columna derecha.
 * Mismo patrón que ContextListPanel: al hacer clic en un prompt se abre su
 * contenido en la ventana central y la columna derecha pasa a sus propiedades.
 * Hover: lápiz (renombrar) + × (eliminar). Pie: «Nuevo prompt…».
 */
import React, { useState, useRef, useEffect } from 'react'
import type { TFunction } from 'i18next'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { getOrCreatePromptsRoot, getPromptsRoot, listPrompts, ensurePromptDef, getPromptActivation } from '../../utils/promptsHelper'
import { useAIChat } from '../../store/aiChatStore'

interface Props {
  onSelectPrompt: (nodeId: string) => void
  selectedPromptId?: string | null
}

function activationLabel(act: string, t: TFunction): string | null {
  if (act === 'diary') return t('prompts.actDiaryShort', 'Auto · diario')
  if (act === 'task') return t('prompts.actTaskShort', 'Auto · tareas')
  if (act.startsWith('context:')) {
    const id = act.slice('context:'.length)
    const n = store.getNode(id)
    return n ? `Auto · ${n.text}` : t('prompts.actContextShort', 'Auto · contexto')
  }
  return null
}

export default function PromptListPanel({ onSelectPrompt, selectedPromptId }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const chat = useAIChat()
  const [adding, setAdding]         = useState(false)
  const [newName, setNewName]       = useState('')
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const newInputRef    = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) setTimeout(() => newInputRef.current?.focus(), 30)
  }, [adding])

  // Asegurar que la raíz existe al abrir el panel
  useEffect(() => { getOrCreatePromptsRoot() }, [])

  function createPrompt(name: string) {
    const clean = name.trim()
    if (!clean) return
    const root = getOrCreatePromptsRoot()
    const sibs = store.children(root.id).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const node = store.createNode({ text: clean, parentId: root.id, siblingOrder: maxOrder + 1000 })
    ensurePromptDef(node.id)
    // Semilla: un hijo vacío para que el usuario empiece a escribir el contenido
    store.createNode({ text: '', parentId: node.id })
    onSelectPrompt(node.id)
  }

  function confirmAdd() {
    const name = newName.trim()
    setAdding(false); setNewName('')
    createPrompt(name)
  }

  function startRename(nodeId: string, currentText: string, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(nodeId); setRenameValue(currentText)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }
  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null); setRenameValue('')
  }
  function deletePrompt(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (chat.activePromptId === nodeId) chat.setActivePrompt(null)
    store.deleteNode(nodeId)
  }

  const root = getPromptsRoot()
  const prompts = root ? listPrompts() : []
  void s.nodesVersion

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '8px 0 4px' }}>
      <div style={{ padding: '2px 16px 8px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {t('prompts.panelHint', 'Tus prompts para Magic. Ábrelos para editar las instrucciones y elegir cuándo se activan.')}
      </div>

      {prompts.map(p => {
        const isActive   = selectedPromptId === p.id
        const isHovered  = hoveredId === p.id
        const isRenaming = renamingId === p.id
        const isRunning  = chat.activePromptId === p.id
        let icon = '⚡'
        try { icon = JSON.parse(p.extraData || '{}')._promptIcon || '⚡' } catch { /* */ }
        const actLabel = activationLabel(getPromptActivation(p.id), t)
        return (
          <div key={p.id}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px 6px 16px',
                cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(62,92,118,0.08)' : isHovered ? 'var(--bg-hover)' : 'transparent',
              }}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => { if (!isRenaming) onSelectPrompt(p.id) }}
            >
              <span style={{ fontSize: 14, width: 18, flexShrink: 0, textAlign: 'center' }}>{icon}</span>
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
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.text || t('common.noTitle')}
                  </span>
                  {actLabel && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {actLabel}
                    </span>
                  )}
                </div>
              )}

              {isRunning && !isRenaming && (
                <span title={t('prompts.activeNow', 'Activo en Magic')} style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>●</span>
              )}

              {!isRenaming && (isHovered || isActive) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <button
                    title={t('common.rename', 'Renombrar')}
                    onClick={e => startRename(p.id, p.text || '', e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '2px 4px', borderRadius: 3, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/>
                    </svg>
                  </button>
                  <button
                    title={t('common.delete', 'Eliminar')}
                    onClick={e => deletePrompt(p.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
                  >×</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {prompts.length === 0 && !adding && (
        <div style={{ padding: '8px 16px 6px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 8 }}>
            {t('prompts.starterHint', 'Crea un prompt para empezar. Por ejemplo:')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              t('prompts.starterDiary', 'Diario del día'),
              t('prompts.starterBrainstorm', 'Brainstorming'),
              t('prompts.starterCoach', 'Coach personal'),
            ].map(name => (
              <button
                key={name}
                onClick={() => createPrompt(name)}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 14, padding: '4px 11px', fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
              >
                <span style={{ opacity: 0.7 }}>+</span> {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!adding ? (
        <div
          style={{ padding: '6px 16px', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'text', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => { setAdding(true); setTimeout(() => newInputRef.current?.focus(), 30) }}
        >
          <span style={{ width: 18, display: 'inline-block', flexShrink: 0, textAlign: 'center', opacity: 0.6 }}>+</span>
          <span style={{ fontStyle: 'italic', opacity: 0.6 }}>{t('prompts.newPrompt', 'Nuevo prompt…')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', gap: 6 }}>
          <span style={{ width: 18, flexShrink: 0, display: 'inline-block' }} />
          <input
            ref={newInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmAdd() }
              if (e.key === 'Escape') { setAdding(false); setNewName('') }
            }}
            onBlur={() => { if (newName.trim()) confirmAdd(); else { setAdding(false); setNewName('') } }}
            placeholder={t('prompts.newPromptPlaceholder', 'Nombre del prompt…')}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      )}
    </div>
  )
}
