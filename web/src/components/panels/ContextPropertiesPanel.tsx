/**
 * ContextPropertiesPanel — propiedades de un contexto en la columna derecha.
 * Patrón unificado con Prompts y Agentes: el contenido del contexto se abre en
 * la ventana central; aquí van sus propiedades (color, conocimiento) + ← Atrás.
 */
import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { isProject, isContextClosed, setContextClosed, contextParent, contextColor, listContextsForParent, reparentContext, nodesInContext, unassignContext, readContextKnowledge, writeContextKnowledge } from '../../utils/cajones'
import { TaskPropsPopover } from './DiaryPanelComponents'

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
  const navigate = useNavigate()
  const node = s.getNode(nodeId)

  // Color heredado del contexto padre (o por defecto de Ajustes). Sin selector.
  const color = useMemo(() => contextColor(nodeId), [nodeId, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  // Modal de fecha/recurrencia al tocar el chip de una tarea (sin navegar a ella).
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  // El contexto padre se muestra navegable + «Cambiar»; al pulsar Cambiar aparece el selector.
  const [changingParent, setChangingParent] = useState(false)

  if (!node) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* (Breadcrumb del panel retirado: ya existe el breadcrumb general de la página.) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 88px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Estado abierto/cerrado — subcontextos (proyectos). Las áreas raíz son la
            base y no se cierran. Un subcontexto = tiene un contexto padre. */}
        {(isProject(node) || contextParent(nodeId)) && (() => {
          const closed = isContextClosed(node)
          return (
            <div>
              <div className="rc-section-label" style={{ marginBottom: 6 }}>Estado</div>
              <button onClick={() => setContextClosed(nodeId, !closed)}
                title={closed ? 'Reabrir proyecto' : 'Cerrar proyecto'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 9px', borderRadius: 999, cursor: 'pointer', font: 'inherit', border: `1px solid ${color}40`, background: color + '12' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: closed ? 'var(--text-tertiary)' : '#16a34a', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{closed ? 'Cerrado' : 'Abierto'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color, opacity: 0.85 }}>· {closed ? 'Reabrir' : 'Cerrar'}</span>
              </button>
            </div>
          )
        })()}

        {/* Contexto padre — aplicar un contexto a este contexto lo anida */}
        {(() => {
          const parent = contextParent(nodeId)
          const isDesc = (cand: string) => { let cur: ReturnType<typeof store.getNode> | null = store.getNode(cand); let g = 0; while (cur && g++ < 60) { if (cur.id === nodeId) return true; cur = cur.parentId ? store.getNode(cur.parentId) : null } return false }
          const candidates = listContextsForParent().filter(c => c.id !== nodeId && !isDesc(c.id) && c.id !== parent?.id)
          const pColor = parent ? contextColor(parent.id) : color
          return (
            <div>
              <div className="rc-section-label" style={{ marginBottom: 6 }}>Contexto padre</div>
              {changingParent ? (
                <select value="" autoFocus
                  onChange={e => { if (e.target.value) reparentContext(nodeId, e.target.value); setChangingParent(false) }}
                  onBlur={() => setChangingParent(false)}
                  style={{ width: '100%', fontSize: 13, color, background: 'var(--bg-secondary)', border: `1px solid var(--border)`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                  <option value="">{parent ? `Mover a otro contexto…` : '+ elegir contexto padre'}</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}
                </select>
              ) : parent ? (
                // Píldora navegable (clic en el nombre → ir al padre) + «Cambiar» al estilo de Estado.
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 9px', borderRadius: 999, border: `1px solid ${pColor}40`, background: pColor + '12' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: pColor, flexShrink: 0 }} />
                  <button onClick={() => navigate(`/node/${parent.id}`)} title={`Ir a ${parent.text}`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{parent.text}</button>
                  <button onClick={() => setChangingParent(true)} title="Cambiar contexto padre"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600, color: pColor, opacity: 0.85 }}>· Cambiar</button>
                </span>
              ) : (
                <button onClick={() => setChangingParent(true)} title="Añadir contexto padre"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 500, color, border: `1px dashed ${color}55`, background: 'none' }}>
                  + Añadir contexto padre
                </button>
              )}
            </div>
          )
        })()}

        {/* Contiene — agrupado por tipo (Tareas / Eventos / Notas), con cabeceras
            al estilo de la columna derecha del día. */}
        {(() => {
          const assigned = nodesInContext(nodeId)
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
            <div key={a.id} className={`dc-row ${a.status === 'done' ? 'dc-row--done' : ''}`} onClick={() => navigate(`/node/${a.id}`)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: a.id, x: e.clientX, y: e.clientY } })) }}>
              {a.isEvent ? (
                <span className="dc-check" style={{ border: 'none', background: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.7" /></svg>
                </span>
              ) : a.status != null ? (
                <button className={`dc-check ${a.status === 'done' ? 'dc-check--done' : ''}`}
                  onClick={e => { e.stopPropagation(); store.updateNode(a.id, { status: a.status === 'done' ? 'pending' : 'done' }) }}
                  title="Marcar hecha/pendiente">{a.status === 'done' ? '✓' : ''}</button>
              ) : (
                <span className="dc-check" style={{ border: 'none', background: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0 }} />
                </span>
              )}
              <span className="dc-text">{a.text || '(sin texto)'}</span>
              <span style={{ flex: 1 }} />
              {(a.status != null || a.isEvent) && a.due && (() => {
                const d = new Date(a.due)
                const base = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
                const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
                const label = a.isEvent && hasTime ? `${base} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : base
                return (
                  <span className="dc-due" style={{ color: dueChipColor(a.due), cursor: 'pointer' }}
                    title="Fecha y recurrencia"
                    onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === a.id ? null : a.id) }}>
                    {label}
                  </span>
                )
              })()}
              {a.recurrence && (() => { const [u, nn] = a.recurrence.split(':'); const map: Record<string, string> = { daily: 'día', weekly: 'sem', monthly: 'mes', yearly: 'año' }; const c = parseInt(nn || '1') || 1; return <span className="node-recurrence-badge" style={{ fontSize: 10, cursor: 'pointer' }} title="Fecha y recurrencia" onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === a.id ? null : a.id) }}>↻ {c > 1 ? c + ' ' : ''}{map[u] || u}</span> })()}
              <button className="dc-del" onClick={e => { e.stopPropagation(); unassignContext(a.id, nodeId) }} title="Quitar del contexto">×</button>
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
              {block('Tareas', tareas)}
              {block('Eventos', eventos)}
              {block('Notas', notas)}
            </div>
          )
        })()}

        {/* Subcontextos (proyectos hijos): abiertos y cerrados, separados. */}
        {(() => {
          const kids = store.children(nodeId).filter(c => !c.deletedAt && isProject(c))
          if (kids.length === 0) return null
          const abiertos = kids.filter(c => !isContextClosed(c))
          const cerrados = kids.filter(c => isContextClosed(c))
          const ctxRow = (c: ReturnType<typeof store.getNode>, closed: boolean) => c && (
            <div key={c.id} className="dc-row" onClick={() => navigate(`/node/${c.id}`)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: c.id, x: e.clientX, y: e.clientY } })) }}>
              <span className="dc-check" style={{ border: 'none', background: 'none', color: contextColor(c.id) }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 7.4V3a1 1 0 0 1 1-1h4.4a1 1 0 0 1 .7.3l6 6a1 1 0 0 1 0 1.4l-4.4 4.4a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1-.3-.7z"/><circle cx="5.2" cy="5.2" r="1"/>
                </svg>
              </span>
              <span className="dc-text" style={{ textDecoration: closed ? 'line-through' : 'none', opacity: closed ? 0.6 : 1 }}>{c.text || 'Contexto'}</span>
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {abiertos.length > 0 && (
                <div className="dc-group">
                  <div className="rc-section-label" style={{ marginBottom: 6 }}>Subcontextos abiertos · {abiertos.length}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{abiertos.map(c => ctxRow(c, false))}</div>
                </div>
              )}
              {cerrados.length > 0 && (
                <div className="dc-group">
                  <div className="rc-section-label" style={{ marginBottom: 6 }}>Cerrados · {cerrados.length}</div>
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

/** Bloque «🧠 Lo que Fromly sabe» del contexto. Memoria de SOLO LECTURA: muestra
 *  lo que Fromly ha deducido de la nota del contexto. El usuario escribe en la
 *  NOTA, no aquí. El lápiz (✎) permite corregir a mano si hace falta. */
function KnowledgeBlock({ nodeId, color }: { nodeId: string; color: string }) {
  const s = useStore()
  const saved = useMemo(() => readContextKnowledge(nodeId), [nodeId, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState(saved)
  const [editing, setEditing] = useState(false)

  // Refrescar desde el store cuando cambia el contexto o llega una actualización
  // externa (extractor IA), salvo mientras el usuario está corrigiendo a mano.
  useEffect(() => { if (!editing) setText(saved) }, [saved, editing])
  useEffect(() => { setEditing(false) }, [nodeId])

  const commit = () => {
    setEditing(false)
    if (text.trim() === saved.trim()) return
    writeContextKnowledge(nodeId, text)
  }

  return (
    <div>
      <div className="rc-section-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🧠 Lo que Fromly sabe</span>
        <span style={{ flex: 1 }} />
        {!editing && (
          <button onClick={() => setEditing(true)} title="Corregir a mano"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, fontSize: 12, lineHeight: 1 }}>✎</button>
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={text}
          placeholder="Una línea por dato. Fromly lo irá completando solo desde tu nota."
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
      ) : saved.trim() ? (
        <div onDoubleClick={() => setEditing(true)}
          style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {saved}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Fromly aprenderá de lo que escribas en este contexto.
        </div>
      )}
    </div>
  )
}
