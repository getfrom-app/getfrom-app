/**
 * ElementsPanel — el BUSCADOR universal del lienzo (estilo Heptabase). Lista TODOS los
 * elementos del lienzo (globalmente, no solo el lienzo actual): textos, tareas, eventos,
 * enlaces, PDFs, imágenes y contextos. Buscador de texto + filtro por TIPO. Clic en una
 * fila → vuela a ese elemento en el lienzo y abre su panel derecho.
 * Pensado para escalar a miles: orden por recencia, límite con «cargar más».
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, firstLineTitle } from '../../utils/docNode'
import { isMarkedContext } from '../../utils/cajones'
import { openNodeDetail } from '../../utils/canvasNav'

type ElemKind = 'text' | 'task' | 'event' | 'link' | 'pdf' | 'image' | 'context'

interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string }

const ed = (n: Node): Record<string, unknown> => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } }

/** Clasifica un nodo en un tipo de elemento del lienzo, o null si no es buscable
 *  (línea suelta, nodo de sistema, o ya absorbido dentro de una tarjeta). */
function classify(n: Node): ElemKind | null {
  if (n.deletedAt) return null
  const e = ed(n)
  if (e._absorbedBy != null) return null       // oculto dentro de un bloque → no es elemento suelto
  if (isMarkedContext(n)) return 'context'
  if (n.status != null) return 'task'
  if (n.isEvent) return 'event'
  const rt = e._resourceType as string | undefined
  if (rt === 'image' || e._imageUrl) return 'image'
  if (rt === 'pdf') return 'pdf'
  if (n.isResource || e._resourceUrl || e._resource) return 'link'
  if (e._pdfSelection === '1') return 'text'    // selección de PDF = fragmento de texto
  if (isDocNode(n) || store.isNote(n)) return 'text'
  return null
}

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const KIND_ICON: Record<ElemKind, string> = { text: '📝', task: '☑️', event: '📅', link: '🔗', pdf: '📄', image: '🖼', context: '📁' }
const PAGE_SIZE = 150

export default function ElementsPanel() {
  const { t } = useTranslation()
  const s = useStore()
  const [filter, setFilter] = useState<ElemKind | 'all'>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  // TODOS los elementos del lienzo (globalmente), más recientes primero.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      const title = (n.text || firstLineTitle(n.body) || snippet.slice(0, 60) || t('common.noTitle'))
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '' })
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion, t])

  const nq = q.trim().toLowerCase()
  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.kind !== filter) return false
    if (!nq) return true
    return r.title.toLowerCase().includes(nq) || r.snippet.toLowerCase().includes(nq)
  })
  const shown = filtered.slice(0, limit)
  const counts = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>)

  const CHIPS: { key: ElemKind | 'all'; label: string }[] = [
    { key: 'all',     label: t('elements.all') },
    { key: 'text',    label: t('elements.texts') },
    { key: 'task',    label: t('elements.tasks') },
    { key: 'event',   label: t('elements.events') },
    { key: 'link',    label: t('elements.links') },
    { key: 'pdf',     label: t('elements.pdfs') },
    { key: 'image',   label: t('elements.images') },
    { key: 'context', label: t('elements.contexts') },
  ]

  function open(id: string) {
    openNodeDetail(id) // abre el panel derecho según el tipo (texto/tarea/evento/contexto…)
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } })) // y vuela a él
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shown.map(r => (
              <div key={r.id} className="dc-row" style={{ cursor: 'pointer' }} onClick={() => open(r.id)}>
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
          {filtered.length > shown.length && (
            <button onClick={() => setLimit(l => l + PAGE_SIZE)}
              style={{ width: '100%', marginTop: 6, padding: '8px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text-secondary,#666)', cursor: 'pointer' }}>
              {t('elements.loadMore', { n: filtered.length - shown.length, count: filtered.length - shown.length })}
            </button>
          )}
        </>
      )}
    </div>
  )
}
