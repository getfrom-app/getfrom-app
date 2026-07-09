// Panel de la CONVERSACIÓN activa (tab Contexto cuando hay un chat abierto y no
// hay contexto seleccionado). Muestra: añadir a contexto (buscador tipo v1), bloque
// de contenido RELACIONADO por significado (RAG), TAREAS de la conversación (estilo
// v1) y los ELEMENTOS incluidos (notas, documentos, PDF, imágenes, enlaces).
import { useEffect, useMemo, useRef, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useAIChat } from '../../store/aiChatStore'
import { assignContext, nodeCtxRefs, contextColor, getOrCreateContainerNotes } from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import PdfCanvasPreview from '../../components/views/PdfCanvasPreview'
import ContextPicker from '../../components/panels/ContextPicker'
import { V2NoteBody } from './V2DetailView'
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
    const out: { node: Node; icon: string; kind: string }[] = []
    for (const n of store.children(sessionId)) {
      const c = classifyElement(n)
      if (c) out.push({ node: n, icon: c.icon, kind: c.kind })
    }
    return out
  }, [sessionId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Los adjuntos (PDF / imagen) se ven como MINIATURA (tarjeta); el resto como línea.
  const thumbs = elements.filter(e => e.kind === 'pdf' || e.kind === 'image')
  const lineEls = elements.filter(e => e.kind !== 'pdf' && e.kind !== 'image')

  const sessionNode = store.getNode(sessionId)
  const ctxRefs = sessionNode ? nodeCtxRefs(sessionNode) : []

  // «Notas» — editor real (DocEditor) para ESTA conversación. Get-or-create una vez.
  const notesNode = useMemo(() => getOrCreateContainerNotes(sessionId), [sessionId])

  // Quitar un elemento de ESTA conversación (no lo borra): lo saca de sus hijos y lo
  // reparenta a su contexto (si la conversación tiene uno) o, si no, al padre de la
  // propia sesión — sigue existiendo en Fromly y buscable, solo deja de estar «dentro».
  const detachFromConversation = (nodeId: string) => {
    const newParent = ctxRefs[0] ?? sessionNode?.parentId ?? null
    store.updateNode(nodeId, { parentId: newParent })
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Quitado de la conversación (sigue en Fromly)', type: 'success' } }))
  }

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

      {/* Adjuntos (PDF / imagen) como miniaturas. */}
      {thumbs.length > 0 && (
        <div className="v2-thumb-grid">
          {thumbs.map(({ node: n, kind }) => {
            const e = parseExtraData(n.extraData)
            const url = (e._resourceUrl as string) || ''
            const key = (e._resourceKey as string) || undefined
            return (
              <div className="v2-thumb" key={n.id} title={n.text || ''} role="button" tabIndex={0}
                onClick={() => onOpenNode(n.id)}
                onKeyDown={e => { if (e.key === 'Enter') onOpenNode(n.id) }}>
                <button className="v2-thumb-detach" title="Quitar de esta conversación"
                  onClick={e => { e.stopPropagation(); detachFromConversation(n.id) }}>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l8 8M14 6l-8 8"/><rect x="2" y="14" width="16" height="4" rx="1"/></svg>
                </button>
                {kind === 'image' && url
                  ? <img className="v2-thumb-img" src={url} alt={n.text || ''} />
                  : (url || key)
                    ? <div className="v2-thumb-pdf"><PdfCanvasPreview url={url} resourceKey={key} width={220} /></div>
                    : <div className="v2-thumb-icon">📄</div>}
                <div className="v2-thumb-name">{n.text || 'Archivo'}</div>
              </div>
            )
          })}
        </div>
      )}

      {lineEls.map(({ node: n, icon }) => (
        <V2ElementRow key={n.id} node={n} icon={icon} onOpen={onOpenNode} hideContext onDetach={detachFromConversation} />
      ))}
      {elements.length === 0 && <div className="v2-right-empty" style={{ padding: '8px 0' }}>Sin elementos todavía. Pídele a Fromly una nota, un documento, o sube archivos.</div>}

      {/* Notas — EL MISMO editor completo que cualquier nota (toggle Nota/Lienzo, favorito,
          exportar, publicar…) para esta conversación, al final de todo. */}
      <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📝 Notas</div>
        <V2NoteBody node={notesNode} onSelectCtx={onSelectCtx} inlinePage />
      </div>
    </div>
  )
}
