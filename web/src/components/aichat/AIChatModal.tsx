// MARK: - AIChatModal
//
// Panel modal del chat From AI. Equivalente a AIChatModalView.swift (Mac).
// Historial conversacional + textarea + botón enviar + chips de acciones.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIChat, type ChatMessage, type PendingAction } from '../../store/aiChatStore'
import { store } from '../../store/nodeStore'
import ContextChips, { expandSpecialPrompt } from './ContextChips'

/** Chips de seguimiento que aparecen debajo del último mensaje del assistant */
function QuickReplyChips({ chips, onSelect, disabled }: {
  chips: string[]
  onSelect: (text: string) => void
  disabled: boolean
}) {
  if (!chips.length) return null
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: '4px 16px 8px',
    }}>
      {chips.map((chip, i) => (
        <button
          key={i}
          disabled={disabled}
          onClick={() => onSelect(chip)}
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.12s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (!disabled) (e.target as HTMLElement).style.background = 'var(--accent)'; (e.target as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--bg-primary)'; (e.target as HTMLElement).style.color = 'var(--accent)' }}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

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

    // Capturamos el texto ANTES de grabar (para no duplicarlo)
    const capturedStart = input.trim()
    // Ref mutable para el transcript final acumulado (evita closures stale)
    let finalTranscript = ''

    rec.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { 0: { transcript: string }; isFinal: boolean } } }) => {
      let interimTranscript = ''
      // Loop desde resultIndex: solo procesamos los NUEVOS resultados
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += t + ' '  // acumula solo finals
        } else {
          interimTranscript += t      // interim se reconstruye cada evento
        }
      }
      // Combina: texto previo + finals acumulados + interim actual
      const combined = [capturedStart, (finalTranscript + interimTranscript).trim()]
        .filter(Boolean).join(' ')
      setInput(combined.trim())
    }
    rec.onend = () => setIsRecording(false)
    rec.start()
    recognitionRef.current = rec
    setIsRecording(true)
  }

  function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || chat.isStreaming) return
    setInput('')
    // Expandir prompts especiales de los context chips
    const finalText = text.startsWith('__') ? expandSpecialPrompt(text) : text
    chat.send(finalText, currentNodeId)
  }

  /** Cuando el usuario selecciona un context chip */
  function handleChipSelect(prompt: string) {
    if (chat.isStreaming) return
    handleSend(prompt)
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
          {chat.messages.length === 0 && !chat.pendingActions ? (
            <>
              <EmptyState />
              {/* Context chips — solo cuando no hay mensajes y el usuario no ha escrito */}
              <ContextChips
                nodeId={currentNodeId}
                visible={chat.messages.length === 0 && !input.trim()}
                onSelect={handleChipSelect}
              />
            </>
          ) : (
            chat.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} onOpenNode={(id) => { navigate(`/node/${id}`); onClose() }} />
            ))
          )}
          {/* Card de confirmación: aparece cuando la IA propone escrituras */}
          {chat.pendingActions && chat.pendingActions.length > 0 && (
            <PendingConfirmationCard
              actions={chat.pendingActions}
              onConfirm={() => chat.confirmActions()}
              onCancel={() => chat.cancelActions()}
              disabled={chat.isStreaming}
            />
          )}
          {/* Quick reply chips — del último mensaje assistant */}
          {(() => {
            const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant')
            const chips = lastAssistant?.chips ?? []
            return chips.length > 0 && !chat.isStreaming && !chat.pendingActions ? (
              <QuickReplyChips
                chips={chips}
                disabled={chat.isStreaming}
                onSelect={(chip) => {
                  setInput('')
                  chat.send(chip, currentNodeId)
                }}
              />
            ) : null
          })()}
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
            placeholder={isRecording ? 'Grabando…' : 'Escribe aquí… (⇧↵ para nueva línea, ↵ para enviar)'}
            rows={4}
            style={{
              flex: 1,
              resize: 'none',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              minHeight: 100,
              maxHeight: 200,
              outline: 'none',
              lineHeight: 1.5,
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
            onClick={() => handleSend()}
            disabled={!input.trim() || chat.isStreaming}
            style={{
              background: input.trim() && !chat.isStreaming ? 'var(--accent)' : 'var(--bg-hover)',
              color: input.trim() && !chat.isStreaming ? 'white' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: '50%',
              width: 36, height: 36,
              cursor: input.trim() && !chat.isStreaming ? 'pointer' : 'default',
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↑</button>
        </div>
      </div>
    </div>
  )
}

// MARK: - PendingConfirmationCard

function PendingConfirmationCard({
  actions, onConfirm, onCancel, disabled
}: {
  actions: PendingAction[]
  onConfirm: () => void
  onCancel: () => void
  disabled: boolean
}) {
  const iconFor = (type: string) => {
    switch (type) {
      case 'create_note':     return '📝'
      case 'create_task':     return '✅'
      case 'create_event':    return '📅'
      case 'create_resource': return '🔗'
      case 'update_node':     return '✏️'
      default: return '⚡'
    }
  }
  const labelFor = (type: string) => {
    switch (type) {
      case 'create_note':     return 'Nota'
      case 'create_task':     return 'Tarea'
      case 'create_event':    return 'Evento'
      case 'create_resource': return 'Recurso'
      case 'update_node':     return 'Modificar'
      default: return type
    }
  }

  return (
    <div style={{
      margin: '8px 16px',
      border: '1px solid rgba(249,115,22,0.25)',
      borderRadius: 10,
      background: 'rgba(249,115,22,0.05)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px 6px',
        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
      }}>
        <span style={{ color: '#f97316' }}>✋</span>
        <span>Confirma antes de crear</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>
          {actions.length} {actions.length === 1 ? 'elemento' : 'elementos'}
        </span>
      </div>

      <div style={{ height: 1, background: 'var(--border)', opacity: 0.4 }} />

      {/* Filas de acción */}
      {actions.map(action => (
        <div key={action.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', fontSize: 12,
        }}>
          <span style={{ fontSize: 13 }}>{iconFor(action.actionType)}</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500, minWidth: 50 }}>
            {labelFor(action.actionType)}
          </span>
          <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {action.editedTitle}
          </span>
          {action.editedTags.length > 0 && (
            <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {action.editedTags.slice(0, 3).map(tag => (
                <span key={tag} style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.85 }}>
                  #{tag}
                </span>
              ))}
            </span>
          )}
        </div>
      ))}

      <div style={{ height: 1, background: 'var(--border)', opacity: 0.4 }} />

      {/* Botones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button
          onClick={onCancel}
          disabled={disabled}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 10px', fontSize: 12,
            color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >Cancelar</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onConfirm}
          disabled={disabled}
          style={{
            background: disabled ? 'var(--bg-secondary)' : 'var(--accent)',
            border: 'none', borderRadius: 6,
            padding: '5px 14px', fontSize: 12, fontWeight: 600,
            color: 'white', cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span>✓</span><span>Crear todo</span>
        </button>
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
        con tu perfil y tus contextos como referencia.
      </div>
    </div>
  )
}

function MessageBubble({ msg, onOpenNode }: { msg: ChatMessage; onOpenNode: (id: string) => void }) {
  const isUser = msg.role === 'user'
  // Limpia bloques from-action y chips del texto visible
  const cleaned = msg.content
    .replace(/```from-action[\s\S]*?```/g, '')
    .replace(/\{\{chips:[\s\S]*?\}\}\s*$/g, '')
    .trim()
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
