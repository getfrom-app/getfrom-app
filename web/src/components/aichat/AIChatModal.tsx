// MARK: - AIChatModal
//
// Panel modal del chat From AI. Equivalente a AIChatModalView.swift (Mac).
// Historial conversacional + textarea + botón enviar + chips de acciones.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIChat, type ChatMessage } from '../../store/aiChatStore'
import { store } from '../../store/nodeStore'

interface Props {
  onClose: () => void
  currentNodeId?: string
}

export default function AIChatModal({ onClose, currentNodeId }: Props) {
  const chat = useAIChat()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Estado de Web Speech API
  const recognitionRef = useRef<unknown>(null)

  // Focus al abrir
  useEffect(() => {
    setTimeout(() => taRef.current?.focus(), 100)
  }, [])

  // Auto-scroll cuando llegan chunks
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages.length, chat.messages[chat.messages.length - 1]?.content])

  // ESC cierra. Alt+Espacio = toggle micro (paridad Mac).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.altKey && e.code === 'Space') {
        e.preventDefault()
        toggleVoice()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, isRecording])

  function toggleVoice() {
    if (isRecording) {
      try { (recognitionRef.current as { stop?: () => void } | null)?.stop?.() } catch { /* ignore */ }
      setIsRecording(false)
      return
    }
    const SR: typeof window extends { webkitSpeechRecognition: infer T } ? T : never =
      ((window as unknown) as Record<string, unknown>).webkitSpeechRecognition as never
      || ((window as unknown) as Record<string, unknown>).SpeechRecognition as never
    if (!SR) {
      alert('Tu navegador no soporta Web Speech API. Prueba Chrome o Safari.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (SR as any)()
    rec.lang = (localStorage.getItem('from_ai_language') === 'en') ? 'en-US' : 'es-ES'
    rec.continuous = true
    rec.interimResults = true
    let interim = ''
    let final = ''
    rec.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { 0: { transcript: string }; isFinal: boolean } } }) => {
      interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      setInput(prev => (prev ? prev + ' ' : '') + (final + interim).trim())
    }
    rec.onend = () => setIsRecording(false)
    rec.start()
    recognitionRef.current = rec
    setIsRecording(true)
  }

  function handleSend() {
    const text = input.trim()
    if (!text || chat.isStreaming) return
    setInput('')
    chat.send(text, currentNodeId)
  }

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.18)',
        zIndex: 1000,
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        padding: '60px 24px 80px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '100%',
          background: 'var(--bg-primary)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontSize: 14, fontWeight: 600,
          }}>✨</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {chat.messages.length === 0 ? 'From AI' : 'Conversación con From AI'}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => chat.startNewSession()}
            title="Nueva conversación"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 }}
          >＋</button>
          <button
            onClick={onClose}
            title="Cerrar (Esc)"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0' }}>
          {chat.messages.length === 0 ? (
            <EmptyState />
          ) : (
            chat.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} onOpenNode={(id) => { navigate(`/node/${id}`); onClose() }} />
            ))
          )}
          {chat.actionStatus && (
            <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ marginRight: 6 }}>⚙</span>{chat.actionStatus}
            </div>
          )}
          {chat.lastError && (
            <div style={{ padding: '8px 16px', fontSize: 12, color: '#c33' }}>{chat.lastError}</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 14px',
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onTextareaKey}
            placeholder={isRecording ? 'Grabando…' : 'Habla con From AI…'}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              maxHeight: 120,
              outline: 'none',
            }}
          />
          <button
            onClick={toggleVoice}
            title="Grabar voz (⌥-Espacio)"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: isRecording ? '#ef4444' : 'var(--text-secondary)',
              padding: '4px 6px',
            }}
          >{isRecording ? '🎙' : '🎤'}</button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || chat.isStreaming}
            style={{
              background: input.trim() && !chat.isStreaming ? 'var(--accent)' : 'var(--bg-secondary)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: 36, height: 36,
              cursor: input.trim() && !chat.isStreaming ? 'pointer' : 'not-allowed',
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↑</button>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: 28, gap: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32 }}>✨</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>From AI</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.5 }}>
        Escribe lo que necesites. Yo decido qué hacer: crear notas, tareas, eventos, modificar contenido…
        con tu perfil y tus tags como contexto.
      </div>
    </div>
  )
}

function MessageBubble({ msg, onOpenNode }: { msg: ChatMessage; onOpenNode: (id: string) => void }) {
  const isUser = msg.role === 'user'
  // Limpia bloques from-action del texto visible
  const cleaned = msg.content.replace(/```from-action[\s\S]*?```/g, '').trim()
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 16px', alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11,
        flexShrink: 0,
      }}>
        {isUser ? '👤' : '✨'}
      </div>
      <div style={{ flex: 1 }}>
        {cleaned && (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {cleaned}
          </div>
        )}
        {msg.actions.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {msg.actions.map((a, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 500,
                  padding: '3px 7px', borderRadius: 999,
                  background: a.ok ? 'rgba(34,197,94,0.12)' : 'rgba(251,146,60,0.15)',
                  color: 'var(--text-primary)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{a.ok ? '✓' : '⚠'}</span>
                  <span>{actionLabel(a.action)}</span>
                  {a.createdIds.length > 0 && (
                    <button
                      onClick={() => onOpenNode(a.createdIds[0])}
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent)',
                        fontSize: 10, fontWeight: 500, cursor: 'pointer', padding: 0,
                      }}
                    >Abrir</button>
                  )}
                </span>
              ))}
            </div>
            {(() => {
              const creating = new Set(['create_note','create_task','create_event','create_resource','add_row','add_column'])
              const ids = msg.actions.flatMap(a => creating.has(a.action) ? a.createdIds : [])
              if (ids.length === 0) return null
              return (
                <button
                  onClick={async () => {
                    for (const id of ids) {
                      const node = store.nodes.get(id)
                      if (node) store.deleteNode(id)
                    }
                  }}
                  style={{
                    marginTop: 6,
                    background: 'none',
                    border: 'none',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >↶ Deshacer</button>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

function actionLabel(id: string): string {
  switch (id) {
    case 'create_note': return 'Nota creada'
    case 'create_task': return 'Tarea creada'
    case 'create_event': return 'Evento creado'
    case 'update_node': return 'Nodo modificado'
    case 'read_node': return 'Nodo leído'
    case 'find_nodes': return 'Búsqueda'
    case 'add_column': return 'Columna añadida'
    case 'fill_column': return 'Columna rellena'
    case 'add_row': return 'Fila añadida'
    case 'change_view': return 'Vista cambiada'
    case 'create_resource': return 'Recurso creado'
    case 'run_prompt': return 'Prompt ejecutado'
    default: return id
  }
}
