// ElementsFilters — buscador + filtro por tipo + orden de Elementos, en la
// COLUMNA DERECHA (28 ago 2026, Alberto: "dijimos que harías la columna
// derecha para filtros y buscador. hazlo"). Escribe en `elementsBrowserStore`
// — el centro (ElementsPanel) lee de ahí y filtra en tiempo real, sin que
// este componente conozca la lista de resultados ni el centro conozca este
// panel: el store es el único punto de contacto.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { classify, type ElemKind, type ElemRow } from '../../components/panels/ElementsPanel'
import { isInPapelera } from '../../utils/papeleraHelper'
import { elementsBrowserStore, useElementsBrowserStore, type ElementsTaskSub } from '../../store/elementsBrowserStore'

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function ElementsFilters() {
  const { t } = useTranslation()
  const s = useStore()
  const browser = useElementsBrowserStore()
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  // Mismo barrido que ElementsPanel (utils/panels/ElementsPanel.classify) —
  // solo para los RECUENTOS de cada chip, no se reutiliza la lista de filas.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (isInPapelera(n.id)) continue
      out.push({ id: n.id, kind, title: '', snippet: stripHtml(n.body), updatedAt: n.updatedAt || '', createdAt: n.createdAt || '', due: n.due, status: n.status })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion])
  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>), [rows])
  const favCount = useMemo(() => { void s.nodesVersion; return rows.filter(r => store.getNode(r.id)?.isFavorite).length }, [rows, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const CHIPS: { key: ElemKind | 'all' | 'favorite'; label: string }[] = [
    { key: 'all',      label: t('elements.all') },
    { key: 'favorite', label: t('elements.favorites', 'Favoritos') },
    { key: 'text',    label: t('elements.texts') },
    { key: 'group',   label: t('elements.groups', 'Grupos') },
    { key: 'canvas',  label: t('elements.canvases', 'Lienzos') },
    { key: 'task',    label: t('elements.tasks') },
    { key: 'link',    label: t('elements.links') },
    { key: 'pdf',     label: t('elements.pdfs') },
    { key: 'highlight', label: t('elements.highlights', 'Subrayados') },
    { key: 'cita',    label: t('elements.citas', 'Citas') },
    { key: 'image',   label: t('elements.images') },
    { key: 'agent',   label: t('elements.agents', 'Agentes') },
    { key: 'prompt',  label: t('elements.prompts', 'Prompts') },
    { key: 'conversation', label: t('elements.conversations', 'Conversaciones') },
  ]
  const SUB_CHIPS: { key: ElementsTaskSub; label: string }[] = [
    { key: 'all',    label: t('elements.subAll', 'Todas') },
    { key: 'today',  label: t('elements.subToday', 'Hoy') },
    { key: 'open',   label: t('elements.subOpen', 'Abiertas') },
    { key: 'done',   label: t('elements.subDone', 'Cerradas') },
    { key: 'future', label: t('elements.subFuture', 'Futuras') },
    { key: 'nodate', label: t('elements.subNoDate', 'Sin fecha') },
  ]

  return (
    <div style={{ padding: '14px 14px 6px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, position: 'relative' }}>
        <input
          value={browser.q}
          onChange={e => elementsBrowserStore.setQ(e.target.value)}
          placeholder={t('elements.searchShort', 'Buscar')}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none' }}
        />
        <button
          title={t('elements.sortBy', 'Ordenar por')}
          onClick={() => setSortMenuOpen(v => !v)}
          style={{ flexShrink: 0, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: sortMenuOpen ? 'var(--bg-hover,#f4f4f5)' : 'var(--bg,#fff)', color: 'var(--text-secondary,#666)', cursor: 'pointer' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h10M3 12h6M3 18h3M17 4v16m0 0l4-4m-4 4l-4-4"/></svg>
        </button>
        {sortMenuOpen && (
          <>
            <div onClick={() => setSortMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 1001, minWidth: 180, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 4, fontSize: 13 }}>
              <SortItem label={t('elements.sortUpdated', 'Última modificación')} active={browser.sortBy === 'updated'} onClick={() => { elementsBrowserStore.setSortBy('updated'); setSortMenuOpen(false) }} />
              <SortItem label={t('elements.sortCreated', 'Fecha de creación')} active={browser.sortBy === 'created'} onClick={() => { elementsBrowserStore.setSortBy('created'); setSortMenuOpen(false) }} />
              <SortItem label={t('elements.sortTitle', 'Título')} active={browser.sortBy === 'title'} onClick={() => { elementsBrowserStore.setSortBy('title'); setSortMenuOpen(false) }} />
              <SortItem label={t('elements.sortKind', 'Tipo')} active={browser.sortBy === 'kind'} onClick={() => { elementsBrowserStore.setSortBy('kind'); setSortMenuOpen(false) }} />
            </div>
          </>
        )}
      </div>
      {/* Filtro por tipo — varias líneas, no scroll horizontal (Alberto, 5 ago
          2026). Los tipos SIN elementos no se pintan, salvo el activo y
          «Todos»/«Favoritos». */}
      <div className="el-filterbar">
        {CHIPS.map(c => {
          const active = browser.filter === c.key
          const n = c.key === 'all' ? rows.length : c.key === 'favorite' ? favCount : (counts[c.key as ElemKind] || 0)
          if (n === 0 && !active && c.key !== 'all' && c.key !== 'favorite') return null
          return (
            <button key={c.key} onClick={() => elementsBrowserStore.setFilter(c.key)}
              style={{
                flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px 0',
                fontSize: 12.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
                borderBottom: '2px solid ' + (active ? 'var(--accent,#6c5ce7)' : 'transparent'),
              }}>
              {c.label} <span style={{ opacity: 0.55, fontWeight: 400 }}>{n}</span>
            </button>
          )
        })}
      </div>
      {browser.filter === 'task' && (
        <div className="el-filterbar" style={{ marginTop: 4 }}>
          {SUB_CHIPS.map(c => {
            const active = browser.taskSub === c.key
            return (
              <button key={c.key} onClick={() => elementsBrowserStore.setTaskSub(c.key)}
                style={{
                  flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
                  fontSize: 11.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                  color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
                }}>
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SortItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 5, fontSize: 13, color: 'var(--text,#222)', fontFamily: 'inherit' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  )
}
