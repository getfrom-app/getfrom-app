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
import { TaskPropsPopover } from './DiaryPanelComponents'
import { toggleTaskDone } from '../../utils/dailyCockpit'

type ElemKind = 'text' | 'task' | 'event' | 'link' | 'pdf' | 'image' | 'context' | 'memory'
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

const KIND_ICON: Record<ElemKind, string> = { text: '📝', task: '☑️', event: '📅', link: '🔗', pdf: '📄', image: '🖼', context: '📁', memory: '🧠' }
const ROW_H = 46

export default function ElementsPanel() {
  const { t } = useTranslation()
  const s = useStore()
  const [filter, setFilter] = useState<ElemKind | 'all' | 'favorite'>('all')
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
    { key: 'task',    label: t('elements.tasks') },
    { key: 'event',   label: t('elements.events') },
    { key: 'link',    label: t('elements.links') },
    { key: 'pdf',     label: t('elements.pdfs') },
    { key: 'image',   label: t('elements.images') },
    { key: 'context', label: t('elements.contexts') },
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
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 80px' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vi => {
              const r = filtered[vi.index]
              const isRenaming = renaming === r.id
              // Tareas y eventos → pieza COMPLETA, idéntica a la columna «Hoy»:
              // checkbox real (toggleTaskDone), texto con chips (renderInline),
              // chip de contexto (RowContextChip) y acciones al hover (TaskHoverActions).
              if ((r.kind === 'task' || r.kind === 'event') && !isRenaming) {
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
                    <button
                      className="el-more"
                      title={t('elements.actions', 'Acciones')}
                      onClick={(e) => { e.stopPropagation(); const rc = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(r.id, rc.right - 200, rc.bottom + 2) }}
                      style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                    >⋯</button>
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
