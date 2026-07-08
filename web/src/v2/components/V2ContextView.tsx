// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  readContextKnowledge, writeContextKnowledge,
} from '../../utils/cajones'
import Outliner from '../../components/outliner/Outliner'

interface Props {
  ctxId: string
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode: _onOpenNode }: Props) {
  useStore()
  const node = store.getNode(ctxId)
  const parent = contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const canArchive = !!parent // solo subcontextos (las áreas no se archivan)

  // «Lo que Fromly sabe» — editable, se guarda al perder el foco.
  const [know, setKnow] = useState('')
  useEffect(() => { setKnow(readContextKnowledge(ctxId)) }, [ctxId])

  // La columna de contexto muestra SOLO las tareas del contexto (+ lo que Fromly
  // sabe abajo). El resto (texto de descripción antiguo, subcontextos, sesiones)
  // se OCULTA aquí — no se borra: sigue en los datos, buscable y en el RAG.
  // Snapshot al abrir el contexto (por ctxId): así lo que el usuario cree DESPUÉS
  // (tareas/notas nuevas) sí aparece; solo se oculta el volcado preexistente.
  const excludeIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of store.children(ctxId)) {
      if (n.deletedAt) continue
      const isTask = n.status != null || (n.types || []).includes('tarea')
      if (!isTask) s.add(n.id)
    }
    return s
  }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return <div className="v2-right-empty">Contexto no encontrado.</div>

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

      {/* Tareas del contexto = OUTLINER REAL de la v1 (checkbox, ghost text, magic
          verbo→tarea, chips). Se ocultan el texto antiguo/subcontextos vía excludeIds. */}
      <div className="v2-section-label" style={{ padding: '14px 0 4px' }}>Tareas</div>
      <div className="v2-ctx-outliner">
        <Outliner parentId={ctxId} excludeIds={excludeIds} autoFocusEmpty placeholder="Escribe una tarea…" />
      </div>

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
