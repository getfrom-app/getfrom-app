/**
 * ElementsPanel — el BUSCADOR universal del lienzo (estilo Heptabase). Lista TODOS los
 * elementos del lienzo (globalmente): textos, tareas, eventos, enlaces, PDFs, imágenes y
 * contextos. Buscador de texto + filtro por TIPO; al filtrar por Tareas/Eventos aparece un
 * sub-filtro (hoy/abiertas/cerradas/futuras/sin fecha). Clic en una fila → vuela al elemento
 * en el lienzo y abre su panel. Lista VIRTUALIZADA → escala a miles de elementos (años de
 * trabajo) sin pegarse.
 */
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, firstLineTitle } from '../../utils/docNode'
import { isMarkedContext } from '../../utils/cajones'
import { openNodeDetail } from '../../utils/canvasNav'

type ElemKind = 'text' | 'task' | 'event' | 'link' | 'pdf' | 'image' | 'context'
type TaskSub = 'all' | 'today' | 'open' | 'done' | 'future' | 'nodate'

interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string; due?: string | null; status?: string | null }

const ed = (n: Node): Record<string, unknown> => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } }

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
  if (isDocNode(n) || store.isNote(n)) return 'text'
  return null
}

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Sub-filtro de tareas/eventos por su `due`/`status`. */
function matchesTaskSub(r: ElemRow, sub: TaskSub): boolean {
  if (sub === 'all') return true
  if (sub === 'open') return r.status === 'pending'
  if (sub === 'done') return r.status === 'done'
  if (sub === 'nodate') return !r.due
  if (!r.due) return false
  const d = new Date(r.due); const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 24 * 3600 * 1000
  if (sub === 'today') return d >= start && d < new Date(start.getTime() + dayMs)
  if (sub === 'future') return d >= new Date(start.getTime() + dayMs)
  return true
}

const KIND_ICON: Record<ElemKind, string> = { text: '📝', task: '☑️', event: '📅', link: '🔗', pdf: '📄', image: '🖼', context: '📁' }
const ROW_H = 46

export default function ElementsPanel() {
  const { t } = useTranslation()
  const s = useStore()
  const [filter, setFilter] = useState<ElemKind | 'all'>('all')
  const [taskSub, setTaskSub] = useState<TaskSub>('all')
  const [q, setQ] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // TODOS los elementos del lienzo (globalmente), más recientes primero.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      const title = (n.text || firstLineTitle(n.body) || snippet.slice(0, 60) || t('common.noTitle'))
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '', due: n.due, status: n.status })
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion, t])

  const nq = q.trim().toLowerCase()
  const showTaskSub = filter === 'task' || filter === 'event'
  const filtered = useMemo(() => rows.filter(r => {
    if (filter !== 'all' && r.kind !== filter) return false
    if (showTaskSub && !matchesTaskSub(r, taskSub)) return false
    if (!nq) return true
    return r.title.toLowerCase().includes(nq) || r.snippet.toLowerCase().includes(nq)
  }), [rows, filter, taskSub, showTaskSub, nq])

  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>), [rows])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  })

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
  const SUB_CHIPS: { key: TaskSub; label: string }[] = [
    { key: 'all',    label: t('elements.subAll', 'Todas') },
    { key: 'today',  label: t('elements.subToday', 'Hoy') },
    { key: 'open',   label: t('elements.subOpen', 'Abiertas') },
    { key: 'done',   label: t('elements.subDone', 'Cerradas') },
    { key: 'future', label: t('elements.subFuture', 'Futuras') },
    { key: 'nodate', label: t('elements.subNoDate', 'Sin fecha') },
  ]

  function open(id: string) {
    openNodeDetail(id)
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 16px 8px', flexShrink: 0 }}>
        <div className="rc-section-label" style={{ marginBottom: 10 }}>{t('elements.title')}</div>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={t('elements.searchPlaceholder')}
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', marginBottom: 10, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHIPS.map(c => (
            <button key={c.key} onClick={() => { setFilter(c.key); if (c.key !== 'task' && c.key !== 'event') setTaskSub('all') }}
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
        {showTaskSub && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {SUB_CHIPS.map(c => (
              <button key={c.key} onClick={() => setTaskSub(c.key)}
                style={{
                  fontSize: 11.5, padding: '3px 9px', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid ' + (taskSub === c.key ? 'var(--accent,#6c5ce7)' : 'transparent'),
                  background: taskSub === c.key ? 'var(--bg-hover,#f0edfb)' : 'transparent',
                  color: taskSub === c.key ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
                }}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary,#999)', marginTop: 8 }}>
          {t('elements.showing', { count: filtered.length, defaultValue: '{{count}} elementos' })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 80px' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vi => {
              const r = filtered[vi.index]
              return (
                <div
                  key={r.id}
                  className="dc-row"
                  onClick={() => open(r.id)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_H, transform: `translateY(${vi.start}px)`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text,#222)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    {r.snippet && r.snippet !== r.title && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
