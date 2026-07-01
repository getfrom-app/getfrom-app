/**
 * ContextPropertiesPanel — propiedades de un contexto en la columna derecha.
 * Patrón unificado con Prompts y Agentes: el contenido del contexto se abre en
 * la ventana central; aquí van sus propiedades (color, conocimiento) + ← Atrás.
 */
import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { openNodeDetail } from '../../utils/canvasNav'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { isMarkedContext, contextState, setContextState, contextParent, contextColor, reparentContext, nodesInContext, unassignContext, readContextKnowledge, writeContextKnowledge } from '../../utils/cajones'
import { TaskPropsPopover } from './DiaryPanelComponents'
import ContextPicker from './ContextPicker'
import TaskHoverActions from './TaskHoverActions'

/** Color del chip de fecha por estado: atrasada=rojo, hoy=ámbar, futura=azul. */
function dueChipColor(dueISO: string): string {
  const d = new Date(dueISO)
  const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (dd < t0) return '#e03131'   // atrasada
  if (dd === t0) return '#f59e0b' // hoy
  return '#3b82f6'                // futura
}


interface Props {
  nodeId: string
  onBack: () => void
}

export default function ContextPropertiesPanel({ nodeId, onBack }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const node = s.getNode(nodeId)

  // Color heredado del contexto padre (o por defecto de Ajustes). Sin selector.
  const color = useMemo(() => contextColor(nodeId), [nodeId, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  // Modal de fecha/recurrencia al tocar el chip de una tarea (sin navegar a ella).
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  // El contexto padre se muestra navegable + «Cambiar»; al pulsar Cambiar se abre
  // un popover con buscador + lista de contextos (ContextPicker) para elegir directo.
  const [parentPicker, setParentPicker] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const openParentPicker = (e: React.MouseEvent) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const up = window.innerHeight - r.bottom < 320
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 250))
    setParentPicker(up ? { x, y: window.innerHeight - r.top + 4, up: true } : { x, y: r.bottom + 4, up: false })
  }

  if (!node) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* (Breadcrumb del panel retirado: ya existe el breadcrumb general de la página.) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 88px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Estado abierto / cerrado — SOLO subcontextos (con contexto padre).
            Los contextos RAÍZ son entidad superior: sin estado. */}
        {contextParent(nodeId) && (() => {
          const st = contextState(node)
          const seg = (label: string, value: 'open' | 'closed', dot: string) => (
            <button key={value} onClick={() => setContextState(nodeId, value)} title={label}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px 8px', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: st === value ? 600 : 500,
                color: st === value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: st === value ? color + '20' : 'transparent', border: 'none',
                borderLeft: value !== 'open' ? `1px solid ${color}33` : 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
              {label}
            </button>
          )
          return (
            <div>
              <div className="rc-section-label" style={{ marginBottom: 6 }}>{t('ctxPanel.state')}</div>
              <div style={{ display: 'flex', borderRadius: 999, border: `1px solid ${color}40`, overflow: 'hidden', background: color + '0a' }}>
                {seg(t('ctxPanel.open'), 'open', '#16a34a')}
                {seg(t('ctxPanel.closed'), 'closed', 'var(--text-tertiary)')}
              </div>
            </div>
          )
        })()}

        {/* Contexto padre — navegable (clic en el nombre) + «Cambiar» (abre el picker). */}
        {(() => {
          const parent = contextParent(nodeId)
          const isDesc = (cand: string) => { let cur: ReturnType<typeof store.getNode> | null = store.getNode(cand); let g = 0; while (cur && g++ < 60) { if (cur.id === nodeId) return true; cur = cur.parentId ? store.getNode(cur.parentId) : null } return false }
          const pColor = parent ? contextColor(parent.id) : color
          return (
            <div>
              <div className="rc-section-label" style={{ marginBottom: 6 }}>{t('ctxPanel.parentContext')}</div>
              {parent ? (
                // Píldora navegable (clic en el nombre → ir al padre) + «Cambiar» al estilo de Estado.
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 9px', borderRadius: 999, border: `1px solid ${pColor}40`, background: pColor + '12' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: pColor, flexShrink: 0 }} />
                  <button onClick={() => openNodeDetail(parent.id)} title={t('ctxPanel.goTo', { name: parent.text })}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{parent.text}</button>
                  <button onClick={openParentPicker} title={t('ctxPanel.changeParent')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600, color: pColor, opacity: 0.85 }}>· {t('common.change')}</button>
                </span>
              ) : (
                <button onClick={openParentPicker} title={t('ctxPanel.addParent')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 500, color, border: `1px dashed ${color}55`, background: 'none' }}>
                  + {t('ctxPanel.addParent')}
                </button>
              )}
              {parentPicker && createPortal((
                <>
                  <div onClick={() => setParentPicker(null)} onContextMenu={e => { e.preventDefault(); setParentPicker(null) }}
                    style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
                  <div className="ctx-pick" onClick={e => e.stopPropagation()}
                    style={{ position: 'fixed', ...(parentPicker.up ? { bottom: parentPicker.y } : { top: parentPicker.y }), left: parentPicker.x, zIndex: 3000 }}>
                    <ContextPicker
                      currentId={parent?.id ?? null}
                      exclude={c => c.id === nodeId || isDesc(c.id)}
                      onPick={id => { if (id && id !== parent?.id) reparentContext(nodeId, id); setParentPicker(null) }}
                    />
                  </div>
                </>
              ), document.body)}
            </div>
          )
        })()}

        {/* Contiene — agrupado por tipo (Tareas / Eventos / Notas), con cabeceras
            al estilo de la columna derecha del día. */}
        {(() => {
          // Columna del contexto = miembros que NO están físicamente en el lienzo.
          // Lo que tiene posición (pin `_pinX`/`_gx`) ya se ve colocado en el plano →
          // aquí se muestran solo los "sueltos" (quick-capture, etiquetados sin colocar).
          const hasCanvasPos = (n: { extraData?: string | null }): boolean => {
            try { const ed = JSON.parse(n.extraData || '{}'); return ed._pinX != null || ed._gx != null }
            catch { return false }
          }
          const assigned = nodesInContext(nodeId).filter(a => !hasCanvasPos(a))
          if (assigned.length === 0) return null
          const eventos = assigned.filter(a => a.isEvent)
          // Tareas ordenadas: atrasadas → hoy → futuras → sin fecha; completadas al final.
          const now = new Date()
          const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
          const dueRank = (a: typeof assigned[number]): number => {
            if (a.status === 'done') return 4
            if (!a.due) return 3
            const d = new Date(a.due); const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
            return dd < t0 ? 0 : dd === t0 ? 1 : 2
          }
          const tareas = assigned.filter(a => !a.isEvent && a.status != null)
            .sort((a, b) => dueRank(a) - dueRank(b) || (a.due || '').localeCompare(b.due || ''))
          const notas = assigned.filter(a => !a.isEvent && a.status == null)
          const row = (a: typeof assigned[number]) => (
            <div key={a.id} className={`dc-row ${a.status === 'done' ? 'dc-row--done' : ''}`} onClick={() => openNodeDetail(a.id)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: a.id, x: e.clientX, y: e.clientY } })) }}>
              {a.isEvent ? (
                <span className="dc-check" style={{ border: 'none', background: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.7" /></svg>
                </span>
              ) : a.status != null ? (
                <button className={`dc-check ${a.status === 'done' ? 'dc-check--done' : ''}`}
                  onClick={e => { e.stopPropagation(); store.updateNode(a.id, { status: a.status === 'done' ? 'pending' : 'done' }) }}
                  title={t('ctxPanel.toggleDone')}>{a.status === 'done' ? '✓' : ''}</button>
              ) : (
                <span className="dc-check" style={{ border: 'none', background: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0 }} />
                </span>
              )}
              <span className="dc-text">{a.text || t('ctxPanel.noText')}</span>
              <span style={{ flex: 1 }} />
              {(a.status != null || a.isEvent) && a.due && (() => {
                const d = new Date(a.due)
                const base = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
                const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
                const label = a.isEvent && hasTime ? `${base} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : base
                return (
                  <span className="dc-due" style={{ color: dueChipColor(a.due), cursor: 'pointer' }}
                    title={t('ctxPanel.dateRecurrence')}
                    onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === a.id ? null : a.id) }}>
                    {label}
                  </span>
                )
              })()}
              {a.recurrence && (() => { const [u, nn] = a.recurrence.split(':'); const map: Record<string, string> = { daily: t('ctxPanel.recDay'), weekly: t('ctxPanel.recWeek'), monthly: t('ctxPanel.recMonth'), yearly: t('ctxPanel.recYear') }; const c = parseInt(nn || '1') || 1; return <span className="node-recurrence-badge" style={{ fontSize: 10, cursor: 'pointer' }} title={t('ctxPanel.dateRecurrence')} onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === a.id ? null : a.id) }}>↻ {c > 1 ? c + ' ' : ''}{map[u] || u}</span> })()}
              {a.status != null && !a.isEvent ? (
                // Tarea: mismo set de hover que la columna del día (foco · fecha · borrar).
                <TaskHoverActions node={a} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
              ) : (
                // Evento/Nota: quitar del contexto.
                <button className="dc-del" onClick={e => { e.stopPropagation(); unassignContext(a.id, nodeId) }} title={t('ctxPanel.removeFromContext')}>×</button>
              )}
            </div>
          )
          const block = (label: string, items: typeof assigned, cls = '') => items.length === 0 ? null : (
            <div className="dc-group">
              <div className={`rc-section-label ${cls}`} style={{ marginBottom: 6 }}>{label} · {items.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{items.map(row)}</div>
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {block(t('sidebar.groupTasks'), tareas)}
              {block(t('sidebar.groupEvents'), eventos)}
              {block(t('sidebar.groupNotes'), notas)}
            </div>
          )
        })()}

        {/* Subcontextos (contextos hijos): abiertos y cerrados, separados. */}
        {(() => {
          const kids = store.children(nodeId).filter(c => !c.deletedAt && isMarkedContext(c))
          if (kids.length === 0) return null
          const abiertos = kids.filter(c => contextState(c) === 'open')
          const cerrados = kids.filter(c => contextState(c) === 'closed')
          const ctxRow = (c: ReturnType<typeof store.getNode>, closed: boolean) => c && (
            <div key={c.id} className="dc-row" onClick={() => openNodeDetail(c.id)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: c.id, x: e.clientX, y: e.clientY } })) }}>
              {/* DOT con el color del contexto (heredado del padre), como en la columna diaria. */}
              <span className="dc-event-dot" style={{ background: contextColor(c.id) }} aria-label={t('ctxPanel.context')} />
              <span className="dc-text" style={{ textDecoration: closed ? 'line-through' : 'none', opacity: closed ? 0.6 : 1 }}>{c.text || t('ctxPanel.context')}</span>
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {abiertos.length > 0 && (
                <div className="dc-group">
                  <div className="rc-section-label" style={{ marginBottom: 6 }}>{t('ctxPanel.subcontextsOpen')} · {abiertos.length}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{abiertos.map(c => ctxRow(c, false))}</div>
                </div>
              )}
              {cerrados.length > 0 && (
                <div className="dc-group">
                  <div className="rc-section-label" style={{ marginBottom: 6 }}>{t('ctxPanel.closedPlural')} · {cerrados.length}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{cerrados.map(c => ctxRow(c, true))}</div>
                </div>
              )}
            </div>
          )
        })()}

        {/* (Selector de color retirado: el contexto hereda el color de su padre, o
            el color por defecto de Ajustes.) */}

        {/* Lo que Fromly sabe — memoria del contexto, EDITABLE aquí (no es un nodo
            del lienzo). Fromly la actualiza sola al clasificar; el usuario puede
            corregirla a mano. */}
        <KnowledgeBlock nodeId={nodeId} color={color} />
      </div>
      {propsNodeId && (() => {
        const pn = store.getNode(propsNodeId)
        return pn ? <TaskPropsPopover node={pn} allowRename allowDelete onClose={() => setPropsNodeId(null)} /> : null
      })()}
    </div>
  )
}

/** Bloque «🧠 Lo que Fromly sabe» del contexto. Memoria EDITABLE directamente: el
 *  usuario escribe aquí mismo (sin botón de lápiz) y Magic lo lee. El extractor IA
 *  también puede rellenarlo; los cambios externos se reflejan cuando el campo no está
 *  enfocado (para no pisar lo que el usuario escribe). */
function KnowledgeBlock({ nodeId, color }: { nodeId: string; color: string }) {
  const s = useStore()
  const { t } = useTranslation()
  const saved = useMemo(() => readContextKnowledge(nodeId), [nodeId, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState(saved)
  const [focused, setFocused] = useState(false)

  // Refrescar desde el store al cambiar de contexto o si llega una actualización
  // externa (extractor IA), salvo mientras el usuario está escribiendo (enfocado).
  useEffect(() => { if (!focused) setText(saved) }, [saved, focused])
  useEffect(() => { setFocused(false); setText(saved) }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    setFocused(false)
    if (text.trim() === saved.trim()) return
    writeContextKnowledge(nodeId, text)
  }

  return (
    <div>
      <div className="rc-section-label" style={{ marginBottom: 6 }}>🧠 {t('ctxPanel.whatFromlyKnows')}</div>
      <textarea
        value={text}
        placeholder={t('ctxPanel.knowledgePlaceholder')}
        onFocus={() => setFocused(true)}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        rows={Math.max(3, Math.min(14, text.split('\n').length + 1))}
        style={{
          width: '100%', minWidth: 0, maxWidth: '100%', resize: 'none',
          fontSize: 13, lineHeight: 1.5,
          color: 'var(--text-primary)', background: 'var(--bg-secondary)',
          border: `1px solid ${color}55`, borderRadius: 8, padding: '8px 10px',
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
