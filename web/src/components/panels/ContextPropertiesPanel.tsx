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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 40, flexShrink: 0, borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('ctxProps.back', '← Contextos')}
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Estado abierto/cerrado — subcontextos (proyectos). Las áreas raíz son la
            base y no se cierran. Un subcontexto = tiene un contexto padre. */}
        {(isProject(node) || contextParent(nodeId)) && (() => {
          const closed = isContextClosed(node)
          return (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Estado</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: closed ? 'var(--text-tertiary)' : '#16a34a', fontWeight: 500 }}>{closed ? 'Cerrado' : 'Abierto'}</span>
                <button onClick={() => setContextClosed(nodeId, !closed)}
                  style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${color}55`, background: closed ? color : 'transparent', color: closed ? '#fff' : color }}>
                  {closed ? 'Reabrir' : 'Cerrar'}
                </button>
              </div>
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
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Contexto padre</div>
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
                <span className="dc-check" style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)' }}>·</span>
              )}
              <span className="dc-text">{a.text || '(sin texto)'}</span>
              <span style={{ flex: 1 }} />
              <button className="dc-del" onClick={e => { e.stopPropagation(); unassignContext(a.id, nodeId) }} title="Quitar del contexto">×</button>
            </div>
          )
          const block = (label: string, items: typeof assigned, cls = '') => items.length === 0 ? null : (
            <div className="dc-group">
              <div className={`dc-group-label ${cls}`} style={{ marginBottom: 6 }}>{label} · {items.length}</div>
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

        {/* (Selector de color retirado: el contexto hereda el color de su padre, o
            el color por defecto de Ajustes.) */}

        {/* (Conocimiento del contexto: Fromly lo actualiza automáticamente al
            clasificar nodos; ya no hay botón manual.) */}
      </div>
    </div>
  )
}
