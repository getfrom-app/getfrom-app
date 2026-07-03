/**
 * SearchPanel — columna «Favoritos + Recientes» (acceso rápido). La BÚSQUEDA universal del
 * lienzo vive ahora en `ElementsPanel` (buscador + filtro por tipo). Aquí: los elementos
 * editados recientemente + tus favoritos. Clic → vuela al elemento en el lienzo + abre su panel.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { openNodeDetail } from '../../utils/canvasNav'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, firstLineTitle } from '../../utils/docNode'
import { isMarkedContext } from '../../utils/cajones'

// Props se mantienen por compatibilidad con MainLayout; solo se usa onClose.
interface Props {
  filterText?: string
  onFilter?: (text: string) => void
  onClose: () => void
  onSelectContext?: (id: string) => void
  activeContextId?: string | null
}

type ElemKind = 'text' | 'task' | 'event' | 'link' | 'pdf' | 'image' | 'context'
const KIND_ICON: Record<ElemKind, string> = { text: '📝', task: '☑️', event: '📅', link: '🔗', pdf: '📄', image: '🖼', context: '📁' }
const ed = (n: Node): Record<string, unknown> => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } }
const stripHtml = (html?: string | null) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function classify(n: Node): ElemKind | null {
  if (n.deletedAt) return null
  const e = ed(n)
  if (e._absorbedBy != null) return null
  if (isMarkedContext(n)) return 'context'
  if (n.status != null) return 'task'
  if (n.isEvent) return 'event'
  const rt = e._resourceType as string | undefined
  if (rt === 'image' || e._imageUrl) return 'image'
  if (rt === 'pdf') return 'pdf'
  if (n.isResource || e._resourceUrl || e._resource) return 'link'
  if (isDocNode(n) || store.isNote(n)) return 'text'
  return null
}

export default function SearchPanel({ onClose }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Elementos editados recientemente (globalmente).
  const recent = useMemo(() => {
    void s.nodesVersion
    const out: { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string }[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (kind === 'context') continue // los contextos no son "recientes" útiles aquí
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      const title = (n.text || firstLineTitle(n.body) || snippet.slice(0, 60) || t('common.noTitle'))
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '' })
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return out.slice(0, 25)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion, t])

  function open(id: string) {
    openNodeDetail(id)
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  return (
    <div ref={rootRef} className="search-panel" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Favoritos arriba (acceso inmediato) */}
      <FavoritesSection onOpen={open} />

      {/* Recientes */}
      <div className="rc-section-label" style={{ marginTop: 4 }}>{t('search.recentElements', 'Recientes')}</div>
      {recent.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-tertiary)' }}>{t('elements.empty', 'Nada aún')}</div>
      ) : recent.map(r => (
        <div
          key={r.id}
          onClick={() => open(r.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text,#222)' }}>{r.title}</div>
            {r.snippet && r.snippet !== r.title && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.snippet}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Sección de Favoritos ─────────────────────────────────────────────────────

function FavoritesSection({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const s = useStore()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const favorites = s.allActive().filter(n => n.isFavorite && !n.deletedAt && n.text)
  if (favorites.length === 0) return null

  function startRename(n: { id: string; text: string }, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(n.id)
    setRenameValue(n.text)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }
  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null); setRenameValue('')
  }
  function cancelRename() { setRenamingId(null); setRenameValue('') }
  function unfavorite(id: string, e: React.MouseEvent) { e.stopPropagation(); store.updateNode(id, { isFavorite: false }) }

  return (
    <div>
      <div className="rc-section-label">{t('searchPanel.favorites')}</div>
      {favorites.slice(0, 20).map(n => {
        const isRenaming = renamingId === n.id
        const isHovered = hoveredId === n.id
        return (
          <div
            key={n.id}
            onClick={() => { if (!isRenaming) onOpen(n.id) }}
            onMouseEnter={() => setHoveredId(n.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px 4px 12px', cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
              color: 'var(--text-secondary)',
              background: isHovered && !isRenaming ? 'var(--bg-hover)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>★</span>
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                }}
                onBlur={confirmRename}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
              />
            ) : (
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.text}</span>
            )}
            {!isRenaming && isHovered && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  title={t('common.rename')}
                  onClick={e => startRename(n, e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '2px 4px', borderRadius: 3, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/>
                  </svg>
                </button>
                <button
                  title={t('common.removeFavorite')}
                  onClick={e => unfavorite(n.id, e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error, #e53e3e)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >×</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
