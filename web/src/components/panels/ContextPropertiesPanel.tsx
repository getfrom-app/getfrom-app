/**
 * ContextPropertiesPanel — propiedades de un contexto en la columna derecha.
 * Patrón unificado con Prompts y Agentes: el contenido del contexto se abre en
 * la ventana central; aquí van sus propiedades (color, conocimiento) + ← Atrás.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { isProject, isContextClosed, setContextClosed, contextParent, contextColor, listContextsForParent, reparentContext, nodesInContext, unassignContext } from '../../utils/cajones'


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
          return (
            <div>
              <div className="rc-section-label" style={{ marginBottom: 6 }}>Contexto padre</div>
              <select value="" onChange={e => { if (e.target.value) reparentContext(nodeId, e.target.value) }}
                style={{ width: '100%', fontSize: 13, color, background: 'var(--bg-secondary)', border: `1px solid var(--border)`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                <option value="">{parent ? `en ${parent.text} — cambiar…` : '+ añadir contexto padre'}</option>
                {candidates.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}
              </select>
            </div>
          )
        })()}

        {/* Contiene — agrupado por tipo (Tareas / Eventos / Notas), con cabeceras
            al estilo de la columna derecha del día. */}
        {(() => {
          const assigned = nodesInContext(nodeId)
          if (assigned.length === 0) return null
          const eventos = assigned.filter(a => a.isEvent)
          const tareas = assigned.filter(a => !a.isEvent && a.status != null)
          const notas = assigned.filter(a => !a.isEvent && a.status == null)
          const row = (a: typeof assigned[number]) => (
            <div key={a.id} className={`dc-row ${a.status === 'done' ? 'dc-row--done' : ''}`} onClick={() => navigate(`/node/${a.id}`)}>
              {a.isEvent ? (
                <span className="dc-check" style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)' }}>◷</span>
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
              {a.status != null && a.due && <span className="dc-due">{new Date(a.due).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</span>}
              {a.recurrence && (() => { const [u, nn] = a.recurrence.split(':'); const map: Record<string, string> = { daily: 'día', weekly: 'sem', monthly: 'mes', yearly: 'año' }; const c = parseInt(nn || '1') || 1; return <span className="node-recurrence-badge" style={{ fontSize: 10 }}>↻ {c > 1 ? c + ' ' : ''}{map[u] || u}</span> })()}
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
            <div key={c.id} className="dc-row" onClick={() => navigate(`/node/${c.id}`)}>
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

        {/* (Conocimiento del contexto: Fromly lo actualiza automáticamente al
            clasificar nodos; ya no hay botón manual.) */}
      </div>
    </div>
  )
}
