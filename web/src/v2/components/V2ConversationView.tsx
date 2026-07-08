// Panel de la CONVERSACIÓN activa (tab Contexto cuando hay un chat abierto y no
// hay contexto seleccionado). Muestra: añadir a contexto (buscador tipo v1), bloque
// de contenido RELACIONADO por significado (RAG), TAREAS de la conversación (estilo
// v1) y los ELEMENTOS incluidos (notas, documentos, PDF, imágenes, enlaces).
import { useEffect, useMemo, useRef, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useAIChat } from '../../store/aiChatStore'
import { assignContext, nodeCtxRefs, contextColor } from '../../utils/cajones'
import ContextPicker from '../../components/panels/ContextPicker'
import { classifyElement } from '../elementKind'
import { saveExample } from '../../api/autoClassify'
import { ragRelated } from '../../api/client'
import V2TaskList from './V2TaskList'
import V2QuickAddTask from './V2QuickAddTask'
import V2ElementRow from './V2ElementRow'
import type { Node } from '../../types'

interface Props {
  sessionId: string
  onOpenNode: (id: string) => void
  onSelectCtx: (id: string) => void
}

export default function V2ConversationView({ sessionId, onOpenNode, onSelectCtx }: Props) {
  useStore()
  const chat = useAIChat()
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerWrap = useRef<HTMLDivElement>(null)

  // Cerrar el picker al hacer clic fuera.
  useEffect(() => {
    if (!pickerOpen) return
    const onDoc = (e: MouseEvent) => { if (pickerWrap.current && !pickerWrap.current.contains(e.target as HTMLElement)) setPickerOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [pickerOpen])

  // MODO PUSH: contenido RELACIONADO por significado del último mensaje del usuario.
  const lastUserMsg = useMemo(() => {
    const m = [...chat.messages].reverse().find(x => x.role === 'user')
    return (m?.content || '').trim()
  }, [chat.messages])
  const [related, setRelated] = useState<{ node: Node; icon: string }[]>([])
  useEffect(() => {
    if (lastUserMsg.length < 4) { setRelated([]); return }
    let cancelled = false
    const exclude = [sessionId, ...store.children(sessionId).map(n => n.id)]
    const t = setTimeout(() => {
      ragRelated(lastUserMsg, exclude, 6).then(hits => {
        if (cancelled) return
        const out: { node: Node; icon: string }[] = []
        for (const h of hits) {
          const n = store.getNode(h.nodeId)
          if (!n || n.deletedAt || !n.text) continue
          const c = classifyElement(n)
          out.push({ node: n, icon: c?.icon || '📄' })
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
    const out: { node: Node; icon: string }[] = []
    for (const n of store.children(sessionId)) {
      const c = classifyElement(n)
      if (c) out.push({ node: n, icon: c.icon })
    }
    return out
  }, [sessionId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const sessionNode = store.getNode(sessionId)
  const ctxRefs = sessionNode ? nodeCtxRefs(sessionNode) : []

  return (
    <div>
      {/* Añadir la conversación a un contexto (buscador con crear, como en v1). */}
      <div className="v2-section-label" style={{ padding: '0 0 6px' }}>Conversación</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {ctxRefs.map(id => {
          const c = store.getNode(id)
          if (!c) return null
          return (
            <button key={id} className="v2-chip" onClick={() => onSelectCtx(id)} style={{ ['--chip' as string]: contextColor(id) }}>
              {c.text}
            </button>
          )
        })}
        <div className="v2-ctxpick-wrap" ref={pickerWrap}>
          <button className="v2-ctx-add-btn" onClick={() => setPickerOpen(o => !o)}>＋ Añadir a contexto…</button>
          {pickerOpen && (
            <div className="v2-ctxpick-pop">
              <ContextPicker
                currentId={null}
                onPick={id => {
                  if (id) { assignContext(sessionId, id); const s = store.getNode(sessionId); if (s?.text?.trim()) saveExample(s.text.replace(/^✦\s*/, ''), id) }
                  setPickerOpen(false)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* MODO PUSH: relacionado por significado (RAG) del último mensaje. */}
      {related.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div className="v2-section-label" style={{ padding: '6px 0 4px' }}>Relacionado</div>
          {related.map(({ node: n, icon }) => (
            <V2ElementRow key={n.id} node={n} icon={icon} onOpen={onOpenNode} />
          ))}
        </div>
      )}

      {/* Bloque de tareas de la conversación — estilo Hoy */}
      <div className="v2-section-label" style={{ padding: '10px 0 4px' }}>Tareas</div>
      <V2TaskList tasks={tasks} />
      <V2QuickAddTask parentId={sessionId} />

      {/* Elementos de la conversación */}
      <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>Elementos ({elements.length})</div>
      {elements.map(({ node: n, icon }) => (
        <V2ElementRow key={n.id} node={n} icon={icon} onOpen={onOpenNode} hideContext />
      ))}
      {elements.length === 0 && <div className="v2-right-empty" style={{ padding: '8px 0' }}>Sin elementos todavía. Pídele a Fromly una nota, un documento, o sube archivos.</div>}
    </div>
  )
}
