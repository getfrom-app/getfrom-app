/**
 * ElementsPanel — «Elementos» del lienzo actual (estilo Heptabase): lista todos los
 * textos, selecciones de PDF, imágenes y PDFs del lienzo, filtrables por tipo y
 * buscables por texto. Clic en una fila → vuela a esa tarjeta en el lienzo.
 * Pensado para escalar a cientos/miles de elementos: orden por recencia, límite con
 * «cargar más» y agrupación por documento de origen para las selecciones de PDF.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, firstLineTitle } from '../../utils/docNode'

type ElemKind = 'text' | 'selection' | 'image' | 'pdf'

interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string; sourceId?: string }

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
const PAGE_SIZE = 150

export default function ElementsPanel({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  useStore()
  const [filter, setFilter] = useState<ElemKind | 'all'>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

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
          let sourceId: string | undefined
          if (kind === 'selection') {
            try { sourceId = (JSON.parse(c.extraData || '{}')._pdfSourceId as string) || undefined } catch { /* vacío */ }
          }
          out.push({ id: c.id, kind, title, snippet, updatedAt: c.updatedAt, sourceId })
        }
        walk(c.id)
      }
    }
    walk(nodeId)
    // Más recientes primero — con cientos/miles de elementos es lo más útil por defecto.
    out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, t, store.getNode(nodeId)])

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.kind !== filter) return false
    if (!q.trim()) return true
    const needle = q.trim().toLowerCase()
    return r.title.toLowerCase().includes(needle) || r.snippet.toLowerCase().includes(needle)
  })
  const shown = filtered.slice(0, limit)

  const counts = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>)

  const CHIPS: { key: ElemKind | 'all'; label: string }[] = [
    { key: 'all', label: t('elements.all') },
    { key: 'text', label: t('elements.texts') },
    { key: 'selection', label: t('elements.selections') },
    { key: 'image', label: t('elements.images') },
    { key: 'pdf', label: t('elements.pdfs') },
  ]

  // Agrupar SELECCIONES por documento de origen (estilo Heptabase: los highlights se
  // navegan por el PDF del que vienen) — muy útil en cuanto hay más de un puñado.
  const groupBySource = filter === 'selection'
  const groups: { key: string; title: string; rows: ElemRow[] }[] = groupBySource
    ? (() => {
        const m = new Map<string, ElemRow[]>()
        for (const r of shown) {
          const key = r.sourceId || '__none__'
          if (!m.has(key)) m.set(key, [])
          m.get(key)!.push(r)
        }
        return [...m.entries()].map(([key, rs]) => ({
          key, rows: rs,
          title: key === '__none__' ? t('common.noTitle') : (store.getNode(key)?.text || t('common.noTitle')),
        }))
      })()
    : [{ key: 'all', title: '', rows: shown }]

  function Row({ r }: { r: ElemRow }) {
    return (
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
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 88px' }}>
      <div className="rc-section-label" style={{ marginBottom: 10 }}>{t('elements.title')}</div>
      <input
        value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE_SIZE) }}
        placeholder={t('elements.searchPlaceholder')}
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', marginBottom: 10, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13 }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {CHIPS.map(c => (
          <button key={c.key} onClick={() => { setFilter(c.key); setLimit(PAGE_SIZE) }}
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
        <>
          {groups.map(g => (
            <div key={g.key} style={{ marginBottom: 10 }}>
              {groupBySource && (
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary,#999)', textTransform: 'uppercase', letterSpacing: .3, padding: '4px 4px', cursor: g.key !== '__none__' ? 'pointer' : 'default' }}
                  onClick={() => g.key !== '__none__' && window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: g.key } }))}>
                  📄 {g.title} · {g.rows.length}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.rows.map(r => <Row key={r.id} r={r} />)}
              </div>
            </div>
          ))}
          {filtered.length > shown.length && (
            <button onClick={() => setLimit(l => l + PAGE_SIZE)}
              style={{ width: '100%', marginTop: 6, padding: '8px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text-secondary,#666)', cursor: 'pointer' }}>
              {t('elements.loadMore', { n: filtered.length - shown.length })}
            </button>
          )}
        </>
      )}
    </div>
  )
}
