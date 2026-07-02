/**
 * ElementsPanel — «Elementos» del lienzo actual (estilo Heptabase): lista todos los
 * textos, selecciones de PDF, imágenes y PDFs del lienzo, filtrables por tipo y
 * buscables por texto. Clic en una fila → vuela a esa tarjeta en el lienzo.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, firstLineTitle } from '../../utils/docNode'

type ElemKind = 'text' | 'selection' | 'image' | 'pdf'

interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string }

function classify(n: Node): ElemKind | null {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(n.extraData || '{}') } catch { /* vacío */ }
  if (ed._pdfSelection === '1') return 'selection'
  const rType = ed._resourceType as string | undefined
  if (rType === 'image') return 'image'
  if (rType === 'pdf') return 'pdf'
  if (isDocNode(n)) return 'text'
  return null
}

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const KIND_ICON: Record<ElemKind, string> = { text: '📝', selection: '✂️', image: '🖼', pdf: '📄' }

export default function ElementsPanel({ nodeId, onBack }: { nodeId: string; onBack?: () => void }) {
  const { t } = useTranslation()
  useStore()
  const [filter, setFilter] = useState<ElemKind | 'all'>('all')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const out: ElemRow[] = []
    const seen = new Set<string>()
    function walk(id: string) {
      if (seen.has(id)) return
      seen.add(id)
      for (const c of store.children(id)) {
        if (c.deletedAt) continue
        const kind = classify(c)
        if (kind) {
          const snippet = stripHtml(c.body)
          const title = (c.text || firstLineTitle(c.body) || snippet.slice(0, 60) || t('common.noTitle'))
          out.push({ id: c.id, kind, title, snippet })
        }
        walk(c.id)
      }
    }
    walk(nodeId)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, t, store.getNode(nodeId)])

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.kind !== filter) return false
    if (!q.trim()) return true
    const needle = q.trim().toLowerCase()
    return r.title.toLowerCase().includes(needle) || r.snippet.toLowerCase().includes(needle)
  })

  const counts = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>)

  const CHIPS: { key: ElemKind | 'all'; label: string }[] = [
    { key: 'all', label: t('elements.all') },
    { key: 'text', label: t('elements.texts') },
    { key: 'selection', label: t('elements.selections') },
    { key: 'image', label: t('elements.images') },
    { key: 'pdf', label: t('elements.pdfs') },
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 88px' }}>
      <div className="rc-section-label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', fontSize: 13, padding: 0 }}>‹</button>}
        {t('elements.title')}
      </div>
      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder={t('elements.searchPlaceholder')}
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', marginBottom: 10, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13 }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {CHIPS.map(c => (
          <button key={c.key} onClick={() => setFilter(c.key)}
            style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
              border: '1px solid ' + (filter === c.key ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'),
              background: filter === c.key ? 'var(--accent,#6c5ce7)' : 'var(--bg,#fff)',
              color: filter === c.key ? '#fff' : 'var(--text-secondary,#666)',
            }}>
            {c.label}{c.key !== 'all' ? ` (${counts[c.key] || 0})` : ` (${rows.length})`}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px 4px' }}>
          {t('elements.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map(r => (
            <div key={r.id} className="dc-row" style={{ cursor: 'pointer' }}
              onClick={() => window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: r.id } }))}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text,#222)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                {r.snippet && r.snippet !== r.title && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
