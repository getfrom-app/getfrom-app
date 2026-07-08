// Chat central de Fromly 2.0 — el corazón de la app chat-first.
// Reutiliza el motor REAL: aiChatStore.send() + streaming SSE + acciones.
// currentNodeId = contexto seleccionado → buildPayload le inyecta ese contexto.
import { useEffect, useRef, useState } from 'react'
import { useAIChat, aiChatStore } from '../../store/aiChatStore'
import type { ChatMessage } from '../../store/aiChatStore'
import { store, useStore } from '../../store/nodeStore'
import NewTaskModal from '../../components/modals/NewTaskModal'
import NewEventModal from '../../components/modals/NewEventModal'

interface Props {
  currentNodeId: string | null
  contextLabel: string
  onFilesDropped: (files: File[]) => void
  onNewDocument: () => void
  recorder: { recording: boolean; busy: boolean; start: () => void; stop: () => void }
}

// Oculta los bloques ```from-action``` (completos o el parcial que aún se está
// escribiendo) para que el usuario NUNCA vea el JSON de la acción en el chat.
function stripActions(s: string): string {
  return s
    .replace(/```from-action[\s\S]*?```/g, '')
    .replace(/```from-action[\s\S]*$/, '')
    .trim()
}

const SUGGESTIONS = [
  { t: 'Resume mi día', d: 'Tareas y eventos de hoy', p: '¿Qué tengo para hoy? Resume mis tareas y eventos.' },
  { t: 'Busca en mis notas', d: 'Pregunta a todo lo guardado', p: 'Busca en mis notas lo que sé sobre ' },
  { t: 'Organiza esto', d: 'Ordena y prioriza', p: 'Ayúdame a organizar y priorizar mis tareas pendientes.' },
  { t: 'Crea una tarea', d: 'Captura rápida', p: 'Crea una tarea: ' },
]

export default function V2Chat({ currentNodeId, contextLabel, onFilesDropped, onNewDocument, recorder }: Props) {
  const chat = useAIChat()
  useStore()
  const [input, setInput] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [showEvent, setShowEvent] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const messages = chat.messages
  const streaming = chat.isStreaming
  const pending = chat.pendingActions

  // Auto-scroll al fondo en cada mensaje/stream.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  // Auto-resize del textarea.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  const doSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setInput('')
    chat.send(trimmed, currentNodeId || undefined).catch(() => {})
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend(input)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFilesDropped(files)
  }

  const isEmpty = messages.length === 0

  // Título de la CABECERA: cuando hay conversación, su título (el mismo que el Historial:
  // ✦ + primer mensaje → luego auto-título IA). Sin conversación: «Nueva conversación»
  // (+ contexto si hay uno seleccionado). El contexto va como prefijo tenue.
  const hasCtx = !!contextLabel && contextLabel !== 'General'
  const sessionNode = chat.sessionId ? store.getNode(chat.sessionId) : null
  const convTitle = sessionNode ? (sessionNode.text || '').replace(/^✦\s*/, '').trim() : ''

  return (
    <main
      className="v2-col v2-center"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      style={{ position: 'relative' }}
    >
      <div className="v2-center-head">
        <span className="v2-center-title">
          {hasCtx && <span className="v2-center-ctx">{contextLabel} › </span>}
          {chat.sessionId ? (convTitle || 'Conversación') : 'Nueva conversación'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Crear contenido sin pasar por el chat: documento, tarea, evento o nota de voz. */}
          <button className="v2-head-action" title="Nuevo documento" onClick={onNewDocument}>＋ Documento</button>
          <button className="v2-head-action" title="Nueva tarea" onClick={() => setShowTask(true)}>＋ Tarea</button>
          <button className="v2-head-action" title="Nuevo evento" onClick={() => setShowEvent(true)}>＋ Evento</button>
          <button
            className={`v2-head-action ${recorder.recording ? 'recording' : ''}`}
            title={recorder.recording ? 'Detener y guardar' : 'Grabar audio (reunión o nota de voz)'}
            disabled={recorder.busy}
            onClick={() => (recorder.recording ? recorder.stop() : recorder.start())}
          >
            {recorder.busy ? '⏳ Guardando…' : recorder.recording ? '⏹ Detener' : '🎙 Grabar'}
          </button>
          {!isEmpty && (
            <button className="v2-iconbtn" title="Nueva conversación" onClick={() => { aiChatStore.startNewSession() }}>＋</button>
          )}
        </div>
      </div>

      <div className="v2-chat-scroll" ref={scrollRef}>
        {isEmpty ? (
          <div className="v2-empty">
            <h1>Hola 👋</h1>
            <p>Habla con Fromly. Pregúntale a todo lo que guardas, crea notas y tareas, o sube archivos arrastrándolos aquí.</p>
            <div className="v2-suggest-grid">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="v2-suggest" onClick={() => { setInput(s.p); taRef.current?.focus() }}>
                  <div className="v2-suggest-t">{s.t}</div>
                  <div className="v2-suggest-d">{s.d}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="v2-chat-inner">
            {messages.map((m: ChatMessage) => (
              <div key={m.id} className={`v2-msg ${m.role}`}>
                <div className="v2-msg-avatar">{m.role === 'user' ? 'Tú' : '✦'}</div>
                <div className="v2-msg-body">
                  {(() => {
                    const disp = stripActions(m.content)
                    if (disp) return disp.split('\n').map((line, i) => <p key={i}>{line || ' '}</p>)
                    if (streaming && m.role === 'assistant') {
                      return <span className="v2-creating">✨ Creando<span className="v2-creating-dots" /></span>
                    }
                    return null
                  })()}
                  {m.chips && m.chips.length > 0 && (
                    <div className="v2-el-filter" style={{ marginTop: 8 }}>
                      {m.chips.map((c, i) => (
                        <button key={i} className="v2-chip" onClick={() => doSend(c)}>{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra de acciones pendientes (confirmación de escrituras). */}
      {pending && pending.length > 0 && (
        <div className="v2-composer">
          <div className="v2-composer-inner" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="v2-el-meta" style={{ flex: 1 }}>{pending.length} cambio(s) propuesto(s)</span>
            <button className="v2-chip" onClick={() => aiChatStore.cancelActions()}>Descartar</button>
            <button className="v2-chip active" onClick={() => aiChatStore.confirmActions().catch(() => {})}>Aplicar</button>
          </div>
        </div>
      )}

      <div className="v2-composer">
        <div className="v2-composer-inner">
          <div className="v2-composer-box">
            <textarea
              ref={taRef}
              value={input}
              rows={1}
              placeholder={`Escribe a Fromly${contextLabel && contextLabel !== 'General' ? ` · ${contextLabel}` : ''}…`}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="v2-send" disabled={!input.trim() || streaming} onClick={() => doSend(input)}>↑</button>
          </div>
          <div className="v2-composer-hint">
            {streaming ? 'Fromly está pensando…' : 'Enter para enviar · Shift+Enter salto de línea · arrastra archivos aquí'}
          </div>
        </div>
      </div>

      {dragOver && <div className="v2-drop-overlay">Suelta para adjuntar al chat</div>}

      {/* Modales de creación rápida (mismos que la v1). Las tareas nacen en el
          contexto activo (o el diario de hoy si no hay); los eventos, en el diario. */}
      {showTask && <NewTaskModal parentId={currentNodeId ?? undefined} onClose={() => setShowTask(false)} />}
      {showEvent && <NewEventModal onClose={() => setShowEvent(false)} />}
    </main>
  )
}
