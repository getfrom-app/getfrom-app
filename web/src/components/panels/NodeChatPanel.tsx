import { useState, useRef, useEffect, useCallback } from 'react'
import { store } from '../../store/nodeStore'
import { aiInlineStream } from '../../api/client'
import type { Node } from '../../types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Props {
  node: Node
  onClose: () => void
}

export default function NodeChatPanel({ node, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function buildSystemContext(): string {
    const children = store.children(node.id).slice(0, 10)

    // Get area context if the node has an area
    let areaContext = ''
    try {
      const nodeArea = JSON.parse(node.extraData || '{}').area
      if (nodeArea) {
        // Find the area context node (extraData._areaCtx = "1")
        const areaCtxNode = store.allActive().find(n => {
          try {
            const ed = JSON.parse(n.extraData || '{}')
            return ed.area === nodeArea && ed._areaCtx === '1'
          } catch { return false }
        })
        if (areaCtxNode?.body) {
          areaContext = `\n**Contexto del área "${nodeArea}":**\n${areaCtxNode.body.slice(0, 300)}`
        }
      }
    } catch { /* ignore */ }

    return [
      `Estás asistiendo al usuario con una nota de su gestor personal "From".`,
      areaContext,
      ``,
      `**Nota actual:**`,
      `Título: "${node.text || 'Sin título'}"`,
      node.body ? `Cuerpo:\n${node.body.slice(0, 500)}` : '',
      children.length > 0 ? `Bullets:\n${children.map(c => `- ${c.text}`).join('\n')}` : '',
      ``,
      `Responde siempre en español, de forma concisa y útil. Si el usuario pide editar el contenido, proporciona el texto editado.`,
    ].filter(Boolean).join('\n')
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }])

    // Build conversation prompt
    const systemCtx = buildSystemContext()
    const history = [...messages, userMessage]
    const conversationText = history.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n\n')
    const fullPrompt = `${systemCtx}\n\n---\n\nConversación:\n${conversationText}\n\nAsistente:`

    try {
      await aiInlineStream(fullPrompt, undefined, (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content + chunk }
            : m
        ))
      })
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Error al generar respuesta. Inténtalo de nuevo.' }
          : m
      ))
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }, [input, streaming, messages, node]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') onClose()
  }

  function copyLastResponse() {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (last) navigator.clipboard.writeText(last.content).catch(() => {})
  }

  function insertIntoBody() {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (!last) return
    const current = node.body || ''
    const separator = current.trim() ? '\n\n' : ''
    store.updateNode(node.id, { body: current + separator + last.content })
  }

  const hasAssistantMessages = messages.some(m => m.role === 'assistant')

  return (
    <div className="node-chat-panel">
      <div className="node-chat-header">
        <span className="node-chat-title">✦ Chat IA</span>
        <div className="node-chat-header-actions">
          {hasAssistantMessages && (
            <>
              <button className="node-chat-action-btn" onClick={copyLastResponse} title="Copiar última respuesta">📋</button>
              <button className="node-chat-action-btn" onClick={insertIntoBody} title="Insertar en nota">↓ Insertar</button>
            </>
          )}
          <button className="node-chat-close" onClick={onClose} title="Cerrar (Esc)">×</button>
        </div>
      </div>

      <div className="node-chat-messages">
        {messages.length === 0 && (
          <div className="node-chat-empty">
            <div className="node-chat-empty-icon">✦</div>
            <div className="node-chat-empty-text">Pregunta algo sobre esta nota o pide ayuda para editarla.</div>
            <div className="node-chat-suggestions">
              {[
                'Resume esta nota en 3 puntos',
                'Sugiere siguientes pasos',
                'Mejora el estilo del texto',
                '¿Qué falta en esta nota?',
              ].map(s => (
                <button key={s} className="node-chat-suggestion" onClick={() => { setInput(s); inputRef.current?.focus() }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`node-chat-message node-chat-message--${m.role}`}>
            <div className="node-chat-message-content">
              {m.content || (m.role === 'assistant' && streaming ? <span className="node-chat-cursor">▋</span> : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="node-chat-input-area">
        <textarea
          ref={inputRef}
          className="node-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregunta algo... (Enter para enviar, Shift+Enter para nueva línea)"
          rows={3}
          disabled={streaming}
        />
        <button
          className="node-chat-send"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
        >
          {streaming ? '◼ Stop' : '↑ Enviar'}
        </button>
      </div>
    </div>
  )
}
