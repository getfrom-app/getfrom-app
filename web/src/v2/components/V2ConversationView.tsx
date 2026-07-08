// Panel de la CONVERSACIÓN activa (tab Contexto cuando hay un chat abierto y no
// hay contexto seleccionado). Muestra: añadir a contexto, bloque de TAREAS de la
// conversación (Outliner real; la IA las crea como hijas de la sesión) y los
// ELEMENTOS incluidos (notas, documentos, PDF, imágenes, audios, enlaces).
import { useMemo } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { listMarkedContexts, isRootContext, assignContext, nodeCtxRefs, contextColor } from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import Outliner from '../../components/outliner/Outliner'
import type { Node } from '../../types'

interface Props {
  sessionId: string
  onOpenNode: (id: string) => void
  onSelectCtx: (id: string) => void
}

export default function V2ConversationView({ sessionId, onOpenNode, onSelectCtx }: Props) {
  useStore()

  // Tareas de la conversación = hijos-tarea de la sesión. Ocultamos lo NO-tarea
  // (transcripción, documentos, mensajes) con un snapshot al abrir la sesión.
  const excludeIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of store.children(sessionId)) {
      if (n.deletedAt) continue
      const isTask = n.status != null || (n.types || []).includes('tarea')
      if (!isTask) s.add(n.id)
    }
    return s
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Elementos incluidos en la conversación (contenido, no tareas ni transcripción).
  const elements = useMemo(() => {
    const out: { node: Node; icon: string; label: string }[] = []
    for (const n of store.children(sessionId)) {
      if (n.deletedAt || !n.text) continue
      const ed = parseExtraData(n.extraData)
      if (ed._aiTranscript === '1' || ed._aiMsgRole) continue
      if (n.status != null || (n.types || []).includes('tarea')) continue
      if ((n.types || []).includes('evento') || n.isEvent) continue
      const rt = (n.resourceType || '').toLowerCase()
      let icon = '📝', label = 'Nota'
      if (n.isResource || n.resourceType) {
        if (rt.includes('pdf')) { icon = '📄'; label = 'PDF' }
        else if (rt.includes('image') || rt.includes('img')) { icon = '🖼'; label = 'Imagen' }
        else { icon = '🔗'; label = 'Enlace' }
      } else if (ed._doc === '1') { label = 'Documento' } else if (Array.isArray(ed._audios)) { icon = '🎙'; label = 'Audio' }
      out.push({ node: n, icon, label })
    }
    return out
  }, [sessionId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const sessionNode = store.getNode(sessionId)
  const ctxRefs = sessionNode ? nodeCtxRefs(sessionNode) : []
  const contexts = [
    ...store.allActive().filter(n => isRootContext(n.id) && !(n.text || '').startsWith('🧠')),
    ...listMarkedContexts(),
  ]

  return (
    <div>
      {/* Añadir la conversación a un contexto */}
      <div className="v2-section-label" style={{ padding: '0 0 6px' }}>Conversación</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {ctxRefs.map(id => {
          const c = store.getNode(id)
          if (!c) return null
          return (
            <button key={id} className="v2-chip active" onClick={() => onSelectCtx(id)} style={{ background: contextColor(id), borderColor: contextColor(id) }}>
              {c.text}
            </button>
          )
        })}
        <select
          className="v2-ctx-add-select"
          value=""
          onChange={e => { if (e.target.value) assignContext(sessionId, e.target.value) }}
        >
          <option value="">＋ Añadir a contexto…</option>
          {contexts.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}
        </select>
      </div>

      {/* Bloque de tareas de la conversación */}
      <div className="v2-section-label" style={{ padding: '10px 0 4px' }}>Tareas</div>
      <div className="v2-ctx-outliner">
        <Outliner parentId={sessionId} excludeIds={excludeIds} autoFocusEmpty placeholder="Escribe una tarea…" />
      </div>

      {/* Elementos de la conversación */}
      <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>Elementos ({elements.length})</div>
      {elements.map(({ node: n, icon, label }) => (
        <div className="v2-el-row" key={n.id} onClick={() => onOpenNode(n.id)}>
          <span className="v2-el-icon">{icon}</span>
          <span className="v2-el-main"><span className="v2-el-title">{n.text}</span><span className="v2-el-meta">{label}</span></span>
        </div>
      ))}
      {elements.length === 0 && <div className="v2-right-empty" style={{ padding: '8px 0' }}>Sin elementos todavía. Pídele a Fromly una nota, un documento, o sube archivos.</div>}
    </div>
  )
}
