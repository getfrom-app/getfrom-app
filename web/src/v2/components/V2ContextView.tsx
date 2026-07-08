// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import {
  nodesInContext, contextColor, contextParent, isContextClosed, setContextClosed,
  readContextKnowledge, writeContextKnowledge,
} from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import type { Node } from '../../types'

interface Props {
  ctxId: string
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
}

type Group = { key: string; label: string; icon: string; nodes: Node[] }

function groupContent(ctxId: string): Group[] {
  const tareas: Node[] = [], eventos: Node[] = [], notas: Node[] = [], archivos: Node[] = [], subs: Node[] = []
  for (const n of nodesInContext(ctxId)) {
    const ed = parseExtraData(n.extraData)
    if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) continue
    if (ed._ctx === '1') { subs.push(n); continue }
    const types = n.types || []
    if (n.isResource || n.resourceType) archivos.push(n)
    else if (types.includes('evento') || n.isEvent) eventos.push(n)
    else if (types.includes('tarea') || n.status === 'pending' || n.status === 'done') tareas.push(n)
    else notas.push(n)
  }
  const byRecent = (a: Node, b: Node) => (b.updatedAt || '').localeCompare(a.updatedAt || '')
  return [
    { key: 'tareas', label: 'Tareas', icon: '☑️', nodes: tareas.sort(byRecent) },
    { key: 'notas', label: 'Notas', icon: '📝', nodes: notas.sort(byRecent) },
    { key: 'eventos', label: 'Eventos', icon: '📅', nodes: eventos.sort(byRecent) },
    { key: 'archivos', label: 'Archivos', icon: '📎', nodes: archivos.sort(byRecent) },
    { key: 'subs', label: 'Subcontextos', icon: '📂', nodes: subs.sort(byRecent) },
  ].filter(g => g.nodes.length > 0)
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode }: Props) {
  useStore()
  const node = store.getNode(ctxId)
  const parent = contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const canArchive = !!parent // solo subcontextos (las áreas no se archivan)

  // «Lo que Fromly sabe» — editable, se guarda al perder el foco.
  const [know, setKnow] = useState('')
  useEffect(() => { setKnow(readContextKnowledge(ctxId)) }, [ctxId])

  if (!node) return <div className="v2-right-empty">Contexto no encontrado.</div>

  const groups = groupContent(ctxId)

  const toggleTask = (n: Node) => {
    store.updateNode(n.id, { status: n.status === 'done' ? 'pending' : 'done' })
  }

  return (
    <div>
      {/* Cabecera: nombre + padre + archivar */}
      <div className="v2-ctx-head">
        <div className="v2-ctx-head-title">
          <span className="v2-ctx-dot" style={{ background: contextColor(ctxId) }} />
          <span className="v2-el-title" style={{ fontWeight: 700, fontSize: 15 }}>{node.text || 'Contexto'}</span>
        </div>
        <div className="v2-ctx-head-meta">
          {parent
            ? <button className="v2-ctx-parent" onClick={() => onSelectCtx(parent.id)}>en {parent.text}</button>
            : <span className="v2-el-meta">Área</span>}
          {closed && <span className="v2-ctx-badge-archived">Archivado</span>}
        </div>
        {canArchive && (
          <button
            className="v2-ctx-archive-btn"
            onClick={() => setContextClosed(ctxId, !closed)}
            title={closed ? 'Devolver al árbol de contextos' : 'Sacar del árbol (sigue buscable y en el RAG)'}
          >
            {closed ? '↩︎ Desarchivar' : '🗄 Archivar'}
          </button>
        )}
      </div>

      {/* Contenido agrupado por tipo */}
      {groups.map(g => (
        <div key={g.key} style={{ marginTop: 14 }}>
          <div className="v2-section-label" style={{ padding: '0 0 4px' }}>{g.label} ({g.nodes.length})</div>
          {g.nodes.map(n => (
            <div className="v2-el-row" key={n.id} onClick={() => (g.key === 'subs' ? onSelectCtx(n.id) : onOpenNode(n.id))}>
              {g.key === 'tareas' ? (
                <span
                  className="v2-el-check"
                  onClick={(e) => { e.stopPropagation(); toggleTask(n) }}
                >{n.status === 'done' ? '☑' : '☐'}</span>
              ) : (
                <span className="v2-el-icon">{g.icon}</span>
              )}
              <span className="v2-el-main">
                <span className="v2-el-title" style={n.status === 'done' ? { textDecoration: 'line-through', color: 'var(--text-tertiary)' } : undefined}>{n.text}</span>
              </span>
            </div>
          ))}
        </div>
      ))}

      {groups.length === 0 && <div className="v2-right-empty" style={{ padding: '14px 0' }}>Este contexto no tiene contenido todavía.</div>}

      {/* Lo que Fromly sabe — al final del todo */}
      <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div className="v2-section-label" style={{ padding: '0 0 6px' }}>🧠 Lo que Fromly sabe</div>
        <textarea
          className="v2-know-area"
          value={know}
          placeholder="Describe este contexto para que Fromly lo entienda mejor… (Fromly también lo completa solo)"
          onChange={(e) => setKnow(e.target.value)}
          onBlur={() => writeContextKnowledge(ctxId, know)}
        />
      </div>
    </div>
  )
}
