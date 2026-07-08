// Panel de la CONVERSACIÓN activa (tab Contexto cuando hay un chat abierto y no
// hay contexto seleccionado). Muestra: añadir a contexto, bloque de TAREAS de la
// conversación (Outliner real; la IA las crea como hijas de la sesión) y los
// ELEMENTOS incluidos (notas, documentos, PDF, imágenes, audios, enlaces).
import { useEffect, useMemo, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useAIChat } from '../../store/aiChatStore'
import { listMarkedContexts, isRootContext, assignContext, nodeCtxRefs, contextColor } from '../../utils/cajones'
import { classifyElement } from '../elementKind'
import { ragRelated } from '../../api/client'
import V2TaskList from './V2TaskList'
import V2QuickAddTask from './V2QuickAddTask'
import type { Node } from '../../types'

interface Props {
  sessionId: string
  onOpenNode: (id: string) => void
  onSelectCtx: (id: string) => void
}

export default function V2ConversationView({ sessionId, onOpenNode, onSelectCtx }: Props) {
  useStore()
  const chat = useAIChat()

  // MODO PUSH: contenido RELACIONADO por significado del último mensaje del usuario.
  // Se llena solo (RAG) mientras conversas; excluye lo que ya vive en la conversación.
  const lastUserMsg = useMemo(() => {
    const m = [...chat.messages].reverse().find(x => x.role === 'user')
    return (m?.content || '').trim()
  }, [chat.messages])
  const [related, setRelated] = useState<{ node: Node; icon: string; label: string }[]>([])
  useEffect(() => {
    if (lastUserMsg.length < 4) { setRelated([]); return }
    let cancelled = false
    const exclude = [sessionId, ...store.children(sessionId).map(n => n.id)]
    const t = setTimeout(() => {
      ragRelated(lastUserMsg, exclude, 6).then(hits => {
        if (cancelled) return
        const out: { node: Node; icon: string; label: string }[] = []
        for (const h of hits) {
          const n = store.getNode(h.nodeId)
          if (!n || n.deletedAt || !n.text) continue
          const c = classifyElement(n)
          out.push({ node: n, icon: c?.icon || '📄', label: c?.label || 'Nota' })
        }
        setRelated(out)
      }).catch(() => {})
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [lastUserMsg, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tareas de la conversación = hijos-tarea de la sesión (estilo Hoy).
  const tasks = useMemo(() => {
    return store.children(sessionId).filter(n => !n.deletedAt && (n.status != null || (n.types || []).includes('tarea')))
  }, [sessionId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Elementos incluidos en la conversación (documentos, notas, PDF, imágenes, audios, enlaces).
  const elements = useMemo(() => {
    const out: { node: Node; icon: string; label: string }[] = []
    for (const n of store.children(sessionId)) {
      const c = classifyElement(n)
      if (c) out.push({ node: n, icon: c.icon, label: c.label })
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

      {/* MODO PUSH: relacionado por significado (RAG) del último mensaje. */}
      {related.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div className="v2-section-label" style={{ padding: '6px 0 4px' }}>🔗 Relacionado</div>
          {related.map(({ node: n, icon, label }) => (
            <div className="v2-el-row" key={n.id} onClick={() => onOpenNode(n.id)} title="Relacionado con lo que hablas">
              <span className="v2-el-icon">{icon}</span>
              <span className="v2-el-main"><span className="v2-el-title">{n.text}</span><span className="v2-el-meta">{label}</span></span>
            </div>
          ))}
        </div>
      )}

      {/* Bloque de tareas de la conversación — estilo Hoy */}
      <div className="v2-section-label" style={{ padding: '10px 0 4px' }}>Tareas</div>
      <V2TaskList tasks={tasks} />
      <V2QuickAddTask parentId={sessionId} />

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
