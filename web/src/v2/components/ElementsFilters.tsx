// ElementsFilters — buscador + filtro por tipo + orden de Elementos, en la
// COLUMNA DERECHA (28 ago 2026, Alberto: "dijimos que harías la columna
// derecha para filtros y buscador. hazlo"). Escribe en `elementsBrowserStore`
// — el centro (ElementsPanel) lee de ahí y filtra en tiempo real, sin que
// este componente conozca la lista de resultados ni el centro conozca este
// panel: el store es el único punto de contacto.
//
// Rediseñado el mismo día (Alberto, en vivo: "queda apretada arriba y vacía
// el resto... buscador más grande... dale sentido a todo y que quede
// bonito") — buscador grande con icono, "Ordenar por" como su propia fila
// con etiqueta (no un icono suelto pegado al buscador), chips de tipo como
// píldoras con fondo (no texto subrayado), y una nota final para no dejar el
// resto de la columna en blanco sin más.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { classify, type ElemKind, type ElemRow } from '../../components/panels/ElementsPanel'
import { isInPapelera } from '../../utils/papeleraHelper'
import { elementsBrowserStore, useElementsBrowserStore, type ElementsTaskSub, type ElementsSortBy } from '../../store/elementsBrowserStore'
import { listTypeDefs, elementTypeId } from '../../utils/typeDefsHelper'
import TypeDefModal from '../../components/modals/TypeDefModal'
import Icon from './Icon'

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const SORT_LABELS: Record<ElementsSortBy, string> = {
  updated: 'elements.sortUpdated', created: 'elements.sortCreated', title: 'elements.sortTitle', kind: 'elements.sortKind',
}
const SORT_DEFAULTS: Record<ElementsSortBy, string> = {
  updated: 'Última modificación', created: 'Fecha de creación', title: 'Título', kind: 'Tipo',
}

export default function ElementsFilters() {
  const { t } = useTranslation()
  const s = useStore()
  const browser = useElementsBrowserStore()
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [typeModal, setTypeModal] = useState<'new' | string | null>(null)

  // Mismo barrido que ElementsPanel (utils/panels/ElementsPanel.classify) —
  // solo para los RECUENTOS de cada chip, no se reutiliza la lista de filas.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (isInPapelera(n.id)) continue
      out.push({ id: n.id, kind, title: '', snippet: stripHtml(n.body), updatedAt: n.updatedAt || '', createdAt: n.createdAt || '', due: n.due, status: n.status, typeId: elementTypeId(n) })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion])
  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>), [rows])
  const favCount = useMemo(() => { void s.nodesVersion; return rows.filter(r => store.getNode(r.id)?.isFavorite).length }, [rows, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const typeDefs = useMemo(() => { void s.nodesVersion; return listTypeDefs() }, [s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const typeCounts = useMemo(() => rows.reduce((acc, r) => { if (r.typeId) acc[r.typeId] = (acc[r.typeId] || 0) + 1; return acc }, {} as Record<string, number>), [rows])

  const CHIPS: { key: ElemKind | 'all' | 'favorite'; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
    { key: 'all',      label: t('elements.all'), icon: 'layers' },
    { key: 'favorite', label: t('elements.favorites', 'Favoritos'), icon: 'star' },
    { key: 'text',    label: t('elements.texts'), icon: 'document' },
    { key: 'group',   label: t('elements.groups', 'Grupos'), icon: 'folder' },
    { key: 'canvas',  label: t('elements.canvases', 'Lienzos'), icon: 'canvas' },
    { key: 'task',    label: t('elements.tasks'), icon: 'task' },
    { key: 'link',    label: t('elements.links'), icon: 'link' },
    { key: 'pdf',     label: t('elements.pdfs'), icon: 'pdf' },
    { key: 'highlight', label: t('elements.highlights', 'Subrayados'), icon: 'highlight' },
    { key: 'cita',    label: t('elements.citas', 'Citas'), icon: 'quote' },
    { key: 'image',   label: t('elements.images'), icon: 'image' },
    { key: 'agent',   label: t('elements.agents', 'Agentes'), icon: 'agent' },
    { key: 'prompt',  label: t('elements.prompts', 'Prompts'), icon: 'prompt' },
    { key: 'conversation', label: t('elements.conversations', 'Conversaciones'), icon: 'conversation' },
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
    <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Buscador grande, con icono — antes compartía fila con el botón de orden,
          apretado y desproporcionado para el ancho real de la columna. */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary,#999)', display: 'flex', pointerEvents: 'none' }}>
          <Icon name="search" size={16} />
        </span>
        <input
          value={browser.q}
          onChange={e => elementsBrowserStore.setQ(e.target.value)}
          placeholder={t('elements.searchShort', 'Buscar')}
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 14.5, outline: 'none' }}
        />
        {browser.q && (
          <button
            onClick={() => elementsBrowserStore.setQ('')}
            title={t('common.clear', 'Limpiar')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', borderRadius: 6 }}
          >
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      {/* Vista (Tabla/Lista) + seleccionar varios — antes vivían en el centro,
          «apretados» junto al resto de controles (28 ago 2026, Alberto: "el
          boton de seleccionar y la vista tabla o lista podrian estar en la
          columna derecha tambien, hay espacio... ponlos bonitos"). El estado
          real de selección vive en ElementsPanel (useGroupSelection); aquí
          solo se lee/alterna vía el puente en elementsBrowserStore. */}
      <div>
        <div className="v2-section-label" style={{ padding: '0 0 6px' }}>{t('elements.view', 'Vista')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border,#e2e2e2)', borderRadius: 9, padding: 2, gap: 2, flex: 1 }}>
            {(['tabla', 'lista'] as const).map(v => {
              const active = browser.view === v
              return (
                <button key={v} onClick={() => elementsBrowserStore.setView(v)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: 'none', borderRadius: 7, cursor: 'pointer', padding: '7px 8px',
                    background: active ? 'var(--accent,#6c5ce7)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary,#666)',
                    fontSize: 12.5, fontWeight: active ? 650 : 500, fontFamily: 'inherit',
                  }}>
                  {v === 'tabla'
                    ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><line x1="1" y1="13" x2="15" y2="13"/><line x1="5" y1="5" x2="5" y2="15"/><line x1="10" y1="5" x2="10" y2="15"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>}
                  {v === 'tabla' ? t('elements.viewTable', 'Tabla') : t('elements.viewList', 'Lista')}
                </button>
              )
            })}
          </div>
          <button
            title={browser.selectMode ? t('elements.exitSelect', 'Salir de selección') : t('elements.selectMultiple', 'Seleccionar varios')}
            onClick={() => elementsBrowserStore.onToggleSelectMode?.()}
            disabled={!elementsBrowserStore.onToggleSelectMode}
            style={{
              flexShrink: 0, width: 36, borderRadius: 9, border: '1px solid ' + (browser.selectMode ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'),
              background: browser.selectMode ? 'var(--accent,#6c5ce7)' : 'var(--bg,#fff)',
              color: browser.selectMode ? '#fff' : 'var(--text-secondary,#666)',
              cursor: elementsBrowserStore.onToggleSelectMode ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l2.5 2.5L16 9"/></svg>
          </button>
        </div>
        {browser.selectMode && browser.selectedCount > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', marginTop: 6 }}>
            {t('elements.selectedCount', '{{count}} seleccionados', { count: browser.selectedCount })}
          </div>
        )}
      </div>

      {/* Orden — su propia fila con etiqueta, no un icono suelto sin contexto. */}
      <div>
        <div className="v2-section-label" style={{ padding: '0 0 6px' }}>{t('elements.sortBy', 'Ordenar por')}</div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setSortMenuOpen(v => !v)}
            style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border,#e2e2e2)', background: sortMenuOpen ? 'var(--bg-hover,#f4f4f5)' : 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="arrow-up" size={13} style={{ opacity: 0.6 }} />
              {t(SORT_LABELS[browser.sortBy], SORT_DEFAULTS[browser.sortBy])}
            </span>
            <Icon name="chevron-down" size={13} style={{ opacity: 0.5 }} />
          </button>
          {sortMenuOpen && (
            <>
              <div onClick={() => setSortMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 1001, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 9, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', padding: 4, fontSize: 13.5 }}>
                {(['updated', 'created', 'title', 'kind'] as ElementsSortBy[]).map(key => (
                  <SortItem key={key} label={t(SORT_LABELS[key], SORT_DEFAULTS[key])} active={browser.sortBy === key} onClick={() => { elementsBrowserStore.setSortBy(key); setSortMenuOpen(false) }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tipos — píldoras con fondo, no texto subrayado (más presencia ahora que
          la columna tiene el ancho real para respirar). Los tipos SIN elementos
          no se pintan, salvo el activo y «Todos»/«Favoritos». Junto al título,
          «+» para crear un TIPO CUSTOM (Persona, Libro, Película…) — 27 ago 2026. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 6px' }}>
          <div className="v2-section-label" style={{ padding: 0 }}>{t('elements.filterByType', 'Tipos')}</div>
          <button
            onClick={() => setTypeModal('new')}
            title={t('types.newTitle', 'Nuevo tipo')}
            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Icon name="plus" size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHIPS.map(c => {
            const active = browser.filter === c.key
            const n = c.key === 'all' ? rows.length : c.key === 'favorite' ? favCount : (counts[c.key as ElemKind] || 0)
            if (n === 0 && !active && c.key !== 'all' && c.key !== 'favorite') return null
            return (
              <button key={c.key} onClick={() => elementsBrowserStore.setFilter(c.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (active ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'),
                  background: active ? 'var(--accent-soft,rgba(108,92,231,.1))' : 'var(--bg,#fff)', borderRadius: 999, cursor: 'pointer', padding: '6px 11px 6px 9px',
                  fontSize: 12.5, fontWeight: active ? 650 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                  color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-secondary,#666)',
                }}>
                <Icon name={c.icon} size={12.5} />
                {c.label} <span style={{ opacity: 0.55, fontWeight: 400 }}>{n}</span>
              </button>
            )
          })}
          {typeDefs.map(td => {
            const active = browser.customTypeId === td.id
            const n = typeCounts[td.id] || 0
            return (
              <button key={td.id} onClick={() => elementsBrowserStore.setCustomType(active ? null : td.id)}
                onDoubleClick={() => setTypeModal(td.id)}
                onContextMenu={e => { e.preventDefault(); setTypeModal(td.id) }}
                title={t('types.doubleClickToEdit', 'Doble clic o clic derecho para editar')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (active ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'),
                  background: active ? 'var(--accent-soft,rgba(108,92,231,.1))' : 'var(--bg,#fff)', borderRadius: 999, cursor: 'pointer', padding: '6px 11px 6px 9px',
                  fontSize: 12.5, fontWeight: active ? 650 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                  color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-secondary,#666)',
                }}>
                <Icon name={td.icon} size={12.5} />
                {td.name} <span style={{ opacity: 0.55, fontWeight: 400 }}>{n}</span>
              </button>
            )
          })}
        </div>
        {browser.filter === 'task' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {SUB_CHIPS.map(c => {
              const active = browser.taskSub === c.key
              return (
                <button key={c.key} onClick={() => elementsBrowserStore.setTaskSub(c.key)}
                  style={{
                    border: '1px solid ' + (active ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'), background: active ? 'var(--accent-soft,rgba(108,92,231,.1))' : 'transparent',
                    borderRadius: 999, cursor: 'pointer', padding: '4px 10px', fontSize: 11.5, fontWeight: active ? 650 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                    color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
                  }}>
                  {c.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {typeModal && (
        <TypeDefModal
          onClose={() => setTypeModal(null)}
          editingId={typeModal === 'new' ? undefined : typeModal}
          onSaved={id => elementsBrowserStore.setCustomType(id)}
          onDeleted={() => elementsBrowserStore.setCustomType(null)}
        />
      )}
    </div>
  )
}

function SortItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 10px', borderRadius: 6, fontSize: 13.5, color: 'var(--text,#222)', fontFamily: 'inherit' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center' }}>{active ? <Icon name="check" size={12} /> : null}</span>
      {label}
    </button>
  )
}
