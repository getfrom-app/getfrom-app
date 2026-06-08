import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { aiInlineStream, getToken } from '../../api/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Eres el asistente de IA personal de Fromly, una app de gestión de conocimiento personal.
Ayudas al usuario con: organización personal, escritura, análisis, resúmenes y cualquier pregunta que tenga.
Responde siempre en español de forma clara y concisa.
Puedes usar markdown en tus respuestas.`

const SUGGESTIONS = [
  'Resume mis objetivos del día',
  '¿Cómo mejorar mi productividad?',
  'Ayúdame a estructurar una idea',
  '¿Qué debería hacer primero hoy?',
]

function StreamingDots() {
  return (
    <span className="chat-streaming-indicator">
      <span />
      <span />
      <span />
    </span>
  )
}

export default function ChatView() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isLoggedIn = !!getToken()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!streaming) {
      inputRef.current?.focus()
    }
  }, [streaming])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    }

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    try {
      // Build context from history
      const history = messages
        .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
        .join('\n')

      const context = history
        ? `${SYSTEM_PROMPT}\n\nHistorial de conversación:\n${history}`
        : SYSTEM_PROMPT

      await aiInlineStream(text.trim(), context, (chunk) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + chunk }
              : m
          )
        )
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${errMsg}` }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleClearHistory() {
    setMessages([])
    setInput('')
  }

  function handleCopyLast() {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (lastAssistant?.content) {
      navigator.clipboard.writeText(lastAssistant.content)
    }
  }

  const hasMessages = messages.length > 0
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')

  if (!isLoggedIn) {
    return (
      <div className="chat-view">
        <div className="chat-view-header">
          <div className="chat-view-title">
            <span>✦</span>
            <span>Chat IA</span>
            <span className="chat-view-model">claude-3-5-haiku</span>
          </div>
        </div>
        <div className="chat-messages">
          <div className="chat-welcome">
            <div className="chat-welcome-icon">✦</div>
            <div className="chat-welcome-title">{t('ai.loginForChat')}</div>
            <div className="chat-welcome-subtitle">{t('ai.chatLoginHint')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view">
      {/* Header */}
      <div className="chat-view-header">
        <div className="chat-view-title">
          <span>✦</span>
          <span>Chat IA</span>
          <span className="chat-view-model">claude-3-5-haiku</span>
        </div>
        <div className="chat-view-actions">
          {lastAssistant?.content && (
            <button className="chat-view-action-btn" onClick={handleCopyLast} title={t('ai.copyLastResponse')}>
              {t('common.copy')}
            </button>
          )}
          {hasMessages && (
            <button className="chat-view-action-btn" onClick={handleClearHistory} title="Limpiar historial">
              {t('ai.newConversation')}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {!hasMessages ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">✦</div>
            <div className="chat-welcome-title">¿En qué puedo ayudarte?</div>
            <div className="chat-welcome-subtitle">Tu asistente personal de Fromly. Pregunta lo que necesites.</div>
            <div className="chat-welcome-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="chat-suggestion-btn"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message chat-message--${msg.role}`}
            >
              <div className="chat-message-bubble">
                {msg.content === '' && msg.role === 'assistant' && streaming ? (
                  <StreamingDots />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            title={t('ai.sendButton')}
          >
            ↑
          </button>
        </div>
        <div className="chat-input-hint">
          Enter para enviar · Shift+Enter para nueva línea
        </div>
      </div>
    </div>
  )
}
