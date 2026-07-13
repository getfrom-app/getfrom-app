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
import { isMarkedContext, listMarkedContexts, contextColor, assignContext } from '../../utils/cajones'
import { openNodeDetail } from '../../utils/canvasNav'
import { renderInline } from '../outliner/InlineRenderer'
import RowContextChip from './RowContextChip'
import TaskHoverActions from './TaskHoverActions'
import TaskRow from './TaskRow'
import { TaskPropsPopover } from './DiaryPanelComponents'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { isInPapelera } from '../../utils/papeleraHelper'
import { isQuickCommandSession } from '../../store/aiChatStore'
import { FilterViewSwitcher, TableView, KanbanView, CalendarView } from '../views/FilterResultsView'
import type { FilterView } from '../views/FilterResultsView'
import PizarraThumbnail from '../views/PizarraThumbnail'

type ElemKind = 'text' | 'canvas' | 'task' | 'event' | 'link' | 'pdf' | 'image' | 'context' | 'memory' | 'highlight' | 'agent' | 'conversation' | 'prompt'
type TaskSub = 'all' | 'today' | 'open' | 'done' | 'future' | 'nodate'

interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string; due?: string | null; status?: string | null }

const ed = (n: Node): Record<string, unknown> => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } }

function classify(n: Node): ElemKind | null {
  if (n.deletedAt) return null
  const e = ed(n)
  if (e._absorbedBy != null) return null       // oculto dentro de un bloque → no es elemento suelto
  // Mensajes/transcripciones DENTRO de una conversación no son elementos sueltos (solo
  // la sesión en sí lo es, como tipo 'conversation' — ver más abajo).
  if (e._aiTranscript != null || e._aiMsgRole != null) return null
  // La conversación (sesión ✦) SÍ es un elemento — Alberto: "la conversación en sí también
  // debería ser un elemento". Las sesiones de comando rápido (1 turno, sin continuidad) no cuentan.
  if (e._aiSession === '1') return isQuickCommandSession(n.id) ? null : 'conversation'
  if (e._containerNotes === '1') return null   // espacio de notas libres (estructural, no un elemento)
  if (e._pdfSelection != null) return 'highlight'   // subrayado guardado de un PDF (cita)
  if (e._agentDef === '1') return 'agent'           // agente (v2: puede colgar de cualquier contexto)
  if (e._promptDef === '1') return 'prompt'         // prompt (v2: puede colgar de cualquier contexto)
  if (isMarkedContext(n)) return 'context'
  if (n.status != null) return 'task'
  if (n.isEvent) return 'event'
  const rt = e._resourceType as string | undefined
  if (rt === 'image' || e._imageUrl) return 'image'
  if (rt === 'pdf') return 'pdf'
  if (n.isResource || e._resourceUrl || e._resource) return 'link'
  if (e._v2canvas === '1') return 'canvas'          // nodo-documento en modo Lienzo (pizarra)
  if (isDocNode(n) || store.isNote(n)) return 'text'
  // Memoria IA ANTIGUA (oculta del lienzo pero BUSCABLE aquí): línea de conocimiento con texto.
  if (e._tagDefinition != null && (n.text || '').trim()) return 'memory'
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

const KIND_ICON: Record<ElemKind, string> = { text: '📝', canvas: '🎨', task: '☑️', event: '📅', link: '🔗', pdf: '📄', image: '🖼', context: '📁', memory: '🧠', highlight: '🖍️', agent: '🤖', conversation: '💬', prompt: '⚡' }
const ROW_H = 46
const ELEMENTS_VIEW_KEY = 'from_v2_elements_view'

export default function ElementsPanel() {
  const { t } = useTranslation()
  const s = useStore()
  const [filter, setFilter] = useState<ElemKind | 'all' | 'favorite'>('all')
  const [taskSub, setTaskSub] = useState<TaskSub>('all')
  const [q, setQ] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  // Vista: lista (por defecto, virtualizada) o tabla/kanban/calendario (reutilizadas de la v1).
  const [view, setView] = useState<FilterView>(
    () => (localStorage.getItem(ELEMENTS_VIEW_KEY) as FilterView) || 'lista'
  )
  function changeView(v: FilterView) {
    setView(v)
    localStorage.setItem(ELEMENTS_VIEW_KEY, v)
  }

  // TODOS los elementos del lienzo (globalmente), más recientes primero.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (isInPapelera(n.id)) continue   // en Papelera (borrado) → no es un elemento vivo
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      // Quita el prefijo decorativo (✦ sesión / 💬 transcripción) para no duplicar
      // icono: la fila ya muestra el icono de tipo (KIND_ICON) a la izquierda.
      const title = (n.text || firstLineTitle(n.body) || snippet.slice(0, 60) || t('common.noTitle')).replace(/^(?:✦|💬)\s*/u, '')
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '', due: n.due, status: n.status })
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion, t])

  const nq = q.trim().toLowerCase()
  const showTaskSub = filter === 'task' || filter === 'event'
  const filtered = useMemo(() => rows.filter(r => {
    if (filter === 'favorite') { if (!store.getNode(r.id)?.isFavorite) return false }
    else if (filter === 'all') { if (r.kind === 'memory') return false } // memoria IA solo con su propio chip
    else if (r.kind !== filter) return false
    if (showTaskSub && !matchesTaskSub(r, taskSub)) return false
    if (!nq) return true
    return r.title.toLowerCase().includes(nq) || r.snippet.toLowerCase().includes(nq)
  }), [rows, filter, taskSub, showTaskSub, nq])

  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>), [rows])
  const favCount = useMemo(() => { void s.nodesVersion; return rows.filter(r => store.getNode(r.id)?.isFavorite).length }, [rows, s.nodesVersion])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  })

  const CHIPS: { key: ElemKind | 'all' | 'favorite'; label: string }[] = [
    { key: 'all',      label: t('elements.all') },
    { key: 'favorite', label: '★ ' + t('elements.favorites', 'Favoritos') },
    { key: 'text',    label: t('elements.texts') },
    { key: 'canvas',  label: '🎨 ' + t('elements.canvases', 'Lienzos') },
    { key: 'task',    label: t('elements.tasks') },
    { key: 'event',   label: t('elements.events') },
    { key: 'link',    label: t('elements.links') },
    { key: 'pdf',     label: t('elements.pdfs') },
    { key: 'highlight', label: '🖍️ ' + t('elements.highlights', 'Subrayados') },
    { key: 'image',   label: t('elements.images') },
    { key: 'context', label: t('elements.contexts') },
    { key: 'agent',   label: '🤖 ' + t('elements.agents', 'Agentes') },
    { key: 'prompt',  label: '⚡ ' + t('elements.prompts', 'Prompts') },
    { key: 'conversation', label: '💬 ' + t('elements.conversations', 'Conversaciones') },
    { key: 'memory',  label: t('elements.memory', 'Memoria') },
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

  // ── Acciones de organización por fila (clic-derecho + botón ···) ──────────────
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; ctx: boolean } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  function openMenu(id: string, x: number, y: number) {
    // Encima abajo si no cabe; el menú mide ~aprox, lo clampeamos.
    setMenu({ id, x: Math.min(x, window.innerWidth - 230), y: Math.min(y, window.innerHeight - 320), ctx: false })
  }
  function startRename(id: string) {
    const n = store.getNode(id); setRenaming(id); setRenameVal(n?.text || ''); setMenu(null)
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select() }, 20)
  }
  function commitRename() {
    if (renaming && renameVal.trim()) store.updateNode(renaming, { text: renameVal.trim() })
    setRenaming(null); setRenameVal('')
  }
  function toggleFav(id: string) { const n = store.getNode(id); if (n) store.updateNode(id, { isFavorite: !n.isFavorite }); setMenu(null) }
  function del(id: string) { store.deleteNode(id); setMenu(null) }
  function moveToContext(id: string, ctxId: string) {
    // Mover a otro contexto: asignación lógica (_ctxRefs) + si NO está fijado con pin, lo
    // reparentamos para que fluya dentro de la caja del contexto en el lienzo.
    assignContext(id, ctxId)
    const n = store.getNode(id)
    let pinned = false; try { const e = JSON.parse(n?.extraData || '{}'); pinned = e._pinX != null || e._gx != null } catch { /* ignore */ }
    if (n && !pinned && !isMarkedContext(n)) store.updateNode(id, { parentId: ctxId })
    setMenu(null)
  }
  const contexts = useMemo(() => { void s.nodesVersion; return listMarkedContexts().filter(c => (c.text || '').trim()) }, [s.nodesVersion])

  // IDs filtrados (búsqueda + tipo + sub-filtro) para las vistas tabla/kanban/calendario —
  // reutilizan TableView/KanbanView/CalendarView de la v1 tal cual (mismo Set<string>).
  const filteredIds = useMemo(() => new Set(filtered.map(r => r.id)), [filtered])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '14px 14px 6px', flexShrink: 0 }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={t('elements.searchShort', 'Buscar')}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', marginBottom: 10, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none' }}
        />
        {/* Filtro por tipo — texto limpio en una fila, con scroll horizontal, subrayado activo. */}
        <div className="el-filterbar">
          {CHIPS.map(c => {
            const active = filter === c.key
            const n = c.key === 'all' ? (rows.length - (counts.memory || 0)) : c.key === 'favorite' ? favCount : (counts[c.key as ElemKind] || 0)
            return (
              <button key={c.key} onClick={() => { setFilter(c.key); if (c.key !== 'task' && c.key !== 'event') setTaskSub('all') }}
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
        {showTaskSub && (
          <div className="el-filterbar" style={{ marginTop: 4 }}>
            {SUB_CHIPS.map(c => {
              const active = taskSub === c.key
              return (
                <button key={c.key} onClick={() => setTaskSub(c.key)}
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
        {/* Selector de vista — lista (por defecto) / tabla / kanban / calendario. Reutiliza
            los componentes de la v1 (FilterResultsView) tal cual, sobre los ids ya filtrados. */}
        <FilterViewSwitcher
          view={view}
          onChange={changeView}
          count={filtered.length}
          onClear={() => setQ('')}
        />
      </div>

      {view !== 'lista' ? (
        filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
        ) : view === 'tabla' ? (
          <TableView matchIds={filteredIds} />
        ) : view === 'kanban' ? (
          <KanbanView matchIds={filteredIds} />
        ) : (
          <CalendarView matchIds={filteredIds} />
        )
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
      ) : filter === 'canvas' ? (
        // Lienzos: NO tiene sentido listarlos como filas de texto — se ven como
        // miniaturas visuales de su contenido (trazos/dibujos), en rejilla.
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filtered.map(r => (
              <div
                key={r.id}
                onClick={() => open(r.id)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                style={{ cursor: 'pointer' }}
              >
                <PizarraThumbnail body={store.getNode(r.id)?.body} />
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text,#222)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 80px' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vi => {
              const r = filtered[vi.index]
              const isRenaming = renaming === r.id
              // Tarea → TaskRow ÚNICO compartido con toda la app (Hoy, Contexto, otros
              // días): mismo checkbox, texto, chips de hora/día/repetición, contexto y
              // acciones de hover en TODAS partes, no una copia distinta por pestaña.
              if (r.kind === 'task' && !isRenaming) {
                const n = store.getNode(r.id)
                if (n) return (
                  <TaskRow
                    key={r.id}
                    node={n}
                    onOpenDate={(nn) => setPropsNodeId(id => id === nn.id ? null : nn.id)}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_H, transform: `translateY(${vi.start}px)`, boxSizing: 'border-box' }}
                  />
                )
              }
              // Evento: pieza propia (sin checkbox de tarea real / chips de repetición).
              if (r.kind === 'event' && !isRenaming) {
                const n = store.getNode(r.id)
                if (n) return (
                  <div
                    key={r.id}
                    className={`dc-row ${n.status === 'done' ? 'dc-row--done' : ''}`}
                    data-node-id={n.id}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_H, transform: `translateY(${vi.start}px)`, boxSizing: 'border-box' }}
                  >
                    <button
                      className={`dc-check ${n.status === 'done' ? 'dc-check--done' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleTaskDone(n) }}
                    >{n.status === 'done' ? '✓' : ''}</button>
                    <span className="dc-text" onClick={() => openNodeDetail(n.id)}>{n.text ? renderInline(n.text) : t('tip.task', 'Tarea')}</span>
                    <RowContextChip node={n} />
                    <TaskHoverActions node={n} onOpenDate={(nn) => setPropsNodeId(id => id === nn.id ? null : nn.id)} />
                  </div>
                )
              }
              return (
                <div
                  key={r.id}
                  className="dc-row el-row"
                  onClick={() => { if (!isRenaming) open(r.id) }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_H, transform: `translateY(${vi.start}px)`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 0 6px', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {isRenaming ? (
                      <input
                        ref={renameRef}
                        value={renameVal}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename() } if (e.key === 'Escape') { setRenaming(null) } }}
                        onBlur={commitRename}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--accent,#6c5ce7)', borderRadius: 5, padding: '2px 6px', fontSize: 13, background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontFamily: 'inherit' }}
                      />
                    ) : (<>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text,#222)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                      {r.snippet && r.snippet !== r.title && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</div>
                      )}
                    </>)}
                  </div>
                  {!isRenaming && (
                    <>
                      {/* Eliminar directo al hover — mismo patrón que el resto de listas de la app. */}
                      <button
                        className="el-row-del"
                        title={t('tip.delete', 'Eliminar')}
                        onClick={(e) => { e.stopPropagation(); del(r.id) }}
                        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: '4px 5px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                      <button
                        className="el-more"
                        title={t('elements.actions', 'Acciones')}
                        onClick={(e) => { e.stopPropagation(); const rc = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(r.id, rc.right - 200, rc.bottom + 2) }}
                        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                      >⋯</button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Menú de acciones (clic-derecho / ···) — organizar cualquier elemento */}
      {menu && (() => {
        const n = store.getNode(menu.id)
        return (
          <>
            <div onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
            <div style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 1001, minWidth: 200, maxHeight: 300, overflowY: 'auto', background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 4, fontSize: 13 }}>
              {!menu.ctx ? (
                <>
                  <ElMenuItem label={t('elements.open', 'Abrir')} onClick={() => { open(menu.id); setMenu(null) }} />
                  <ElMenuItem label={t('common.rename', 'Renombrar')} onClick={() => startRename(menu.id)} />
                  <ElMenuItem label={n?.isFavorite ? t('tip.removeFavorite', 'Quitar favorito') : t('tip.addFavorite', 'Favorito')} onClick={() => toggleFav(menu.id)} />
                  <ElMenuItem label={t('elements.moveToContext', 'Mover a contexto') + ' ▸'} onClick={() => setMenu(m => m && { ...m, ctx: true })} />
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  <ElMenuItem label={t('tip.delete', 'Eliminar')} danger onClick={() => del(menu.id)} />
                </>
              ) : (
                <>
                  <ElMenuItem label={'‹ ' + t('common.back', 'Atrás')} onClick={() => setMenu(m => m && { ...m, ctx: false })} />
                  {contexts.length === 0 && <div style={{ padding: '6px 10px', color: 'var(--text-tertiary,#999)' }}>{t('elements.noContexts', 'Sin contextos')}</div>}
                  {contexts.map(c => (
                    <ElMenuItem key={c.id} label={c.text} dot={contextColor(c.id)} onClick={() => moveToContext(menu.id, c.id)} />
                  ))}
                </>
              )}
            </div>
          </>
        )
      })()}

      {/* Popover de propiedades de tarea (fecha/hora) — al hover en una tarea/evento */}
      {propsNodeId && (() => {
        const pn = store.getNode(propsNodeId)
        return pn ? <TaskPropsPopover node={pn} allowRename allowDelete onClose={() => setPropsNodeId(null)} /> : null
      })()}
    </div>
  )
}

function ElMenuItem({ label, onClick, danger, dot }: { label: string; onClick: () => void; danger?: boolean; dot?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 5, fontSize: 13, color: danger ? 'var(--color-error,#e53e3e)' : 'var(--text,#222)', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  )
}
