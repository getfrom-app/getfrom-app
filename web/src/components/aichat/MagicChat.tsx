// MARK: - MagicChat
//
// Overlay de IA con push-to-talk:
//   · Espacio (sin input activo) → abre
//   · Mantén R → graba + waveform animado
//   · Suelta R → transcripción → auto-send
//   · Enter → envía texto
//   · Esc → cierra (cancela grabación sin enviar)

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIChat, aiChatStore, type ChatMessage, type PendingAction } from '../../store/aiChatStore'
import { store } from '../../store/nodeStore'
import ContextChips, { expandSpecialPrompt } from './ContextChips'
import { interpretFilterQuery, needsInterpretation } from '../../utils/filterInterpreter'
import { ensureDayPath } from '../../utils/agendaHelper'

interface Props {
  onClose: () => void
  currentNodeId?: string
  mode?: 'modal' | 'panel'
}

export default function MagicChat({ onClose, currentNodeId, mode = 'modal' }: Props) {
  const chat = useAIChat()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  // Refs para evitar closures stale
  const inputRef        = useRef('')
  const isRecordingRef  = useRef(false)
  const isRKeyDownRef   = useRef(false)
  const shouldSendRef   = useRef(false)

  // Audio / speech
  const recognitionRef  = useRef<unknown>(null)
  const audioCtxRef     = useRef<AudioContext | null>(null)
  const analyserRef     = useRef<AnalyserNode | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const animFrameRef    = useRef<number>(0)

  // DOM
  const taRef           = useRef<HTMLTextAreaElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const bottomRef       = useRef<HTMLDivElement>(null)

  // Sincronizar refs con state
  useEffect(() => { inputRef.current = input }, [input])
  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])

  // hasExpanded: se activa con el primer mensaje y nunca se revierte
  const [hasExpanded, setHasExpanded] = useState(() => chat.messages.length > 0)
  useEffect(() => {
    if (chat.messages.length > 0) setHasExpanded(true)
  }, [chat.messages.length])

  // Focus al abrir — inmediato para que el cursor parpadee desde el inicio
  useEffect(() => {
    setTimeout(() => taRef.current?.focus(), 50)
  }, [])

  // Auto-scroll solo dentro del panel de mensajes (no redimensiona la ventana)
  useEffect(() => {
    if (hasExpanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chat.messages.length, chat.messages[chat.messages.length - 1]?.content, hasExpanded])

  // Waveform draw loop
  function drawWaveform() {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const bufLen = analyser.frequencyBinCount
    const data = new Uint8Array(bufLen)
    analyser.getByteFrequencyData(data)

    ctx.clearRect(0, 0, W, H)

    const bars = 44
    const step = W / bars
    const barW = step * 0.52

    for (let i = 0; i < bars; i++) {
      const val = data[Math.floor((i / bars) * bufLen)]
      const norm = val / 255
      // Mínimo visible para que no sea plano
      const h = Math.max(4, norm * H * 0.90)
      const x = i * step + (step - barW) / 2
      const y = (H - h) / 2
      const r = Math.min(barW / 2, h / 2)

      const g = ctx.createLinearGradient(0, y, 0, y + h)
      g.addColorStop(0, 'rgba(167,139,250,0.95)')
      g.addColorStop(1, 'rgba(109,40,217,0.80)')
      ctx.fillStyle = g

      // Rounded rect manual (compatibilidad)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + barW - r, y)
      ctx.arcTo(x + barW, y, x + barW, y + r, r)
      ctx.lineTo(x + barW, y + h - r)
      ctx.arcTo(x + barW, y + h, x + barW - r, y + h, r)
      ctx.lineTo(x + r, y + h)
      ctx.arcTo(x, y + h, x, y + h - r, r)
      ctx.lineTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
      ctx.fill()
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }

  // Iniciar waveform cuando isRecording cambia a true
  useEffect(() => {
    if (isRecording && analyserRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      drawWaveform()
    } else {
      cancelAnimationFrame(animFrameRef.current)
      // Limpiar canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording])

  // ── Teclado: Esc cierra · R manejado globalmente en MainLayout ──────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isRecordingRef.current) stopRecording(false)
        onClose()
      }
    }
    // Eventos emitidos por MainLayout cuando el usuario mantiene / suelta R
    function onRecordStart() { if (!isRecordingRef.current) startRecording() }
    function onRecordStop()  { if (isRecordingRef.current) stopRecording(true) }
    // Texto prellenado (ej. desde Grabadora → "Resumir con IA")
    function onPrefill(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text ?? ''
      if (text) {
        setInput(text)
        setTimeout(() => taRef.current?.focus(), 50)
      }
    }
    // Onboarding prefill (from:onboarding-prefill)
    function onOnboardingPrefill(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text
      if (text && taRef.current) {
        setInput(text)
        setHasExpanded(false) // keep compact so user sees the textarea
        setTimeout(() => taRef.current?.focus(), 50)
      }
    }
    // Onboarding: pulse the send button for 3s
    function onOnboardingHighlightSend() {
      const sendBtn = document.querySelector('.magic-chat-send') as HTMLElement | null
      if (!sendBtn) return
      sendBtn.classList.add('onboarding-pulse-send')
      setTimeout(() => sendBtn.classList.remove('onboarding-pulse-send'), 3000)
    }
    // Onboarding: resetear sesión de Magic para evitar respuestas de sesiones previas
    function onOnboardingResetMagic() {
      chat.startNewSession()
      setHasExpanded(false)
      setInput('')
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('magic-chat:record-start', onRecordStart)
    window.addEventListener('magic-chat:record-stop',  onRecordStop)
    window.addEventListener('magic-chat:prefill',      onPrefill)
    window.addEventListener('from:onboarding-prefill',         onOnboardingPrefill)
    window.addEventListener('from:onboarding-highlight-send',  onOnboardingHighlightSend)
    window.addEventListener('from:onboarding-reset-magic',     onOnboardingResetMagic)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('magic-chat:record-start', onRecordStart)
      window.removeEventListener('magic-chat:record-stop',  onRecordStop)
      window.removeEventListener('magic-chat:prefill',      onPrefill)
      window.removeEventListener('from:onboarding-prefill',        onOnboardingPrefill)
      window.removeEventListener('from:onboarding-highlight-send', onOnboardingHighlightSend)
      window.removeEventListener('from:onboarding-reset-magic',    onOnboardingResetMagic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  // ── Grabar ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function startRecording() {
    if (isRecordingRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SR) {
      alert('Tu navegador no soporta reconocimiento de voz. Prueba Chrome o Safari.')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR()
    rec.lang = localStorage.getItem('from_ai_language') === 'en' ? 'en-US' : 'es-ES'
    rec.continuous = true
    rec.interimResults = true

    const base = inputRef.current.trim()
    let finalText = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t + ' '
        else interim += t
      }
      const combined = [base, (finalText + interim).trim()].filter(Boolean).join(' ')
      setInput(combined.trim())
    }

    rec.onend = () => {
      setIsRecording(false)
      cleanupAudio()
      if (shouldSendRef.current) {
        shouldSendRef.current = false
        setTimeout(() => {
          if (inputRef.current.trim()) handleSend()
        }, 80)
      }
    }

    rec.start()
    recognitionRef.current = rec

    // Audio visualization
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ac = new AudioContext()
      audioCtxRef.current = ac
      const an = ac.createAnalyser()
      an.fftSize = 128
      analyserRef.current = an
      ac.createMediaStreamSource(stream).connect(an)
    } catch { /* sin waveform pero speech sigue */ }

    setIsRecording(true)
  }

  function stopRecording(send: boolean) {
    shouldSendRef.current = send
    try { (recognitionRef.current as { stop?: () => void } | null)?.stop?.() } catch { /* */ }
    recognitionRef.current = null
    cleanupAudio()
    setIsRecording(false)
    if (send) {
      // rec.onend ya llamará a handleSend; si no dispara (edge case), lo hacemos aquí
      setTimeout(() => {
        if (shouldSendRef.current && inputRef.current.trim()) {
          shouldSendRef.current = false
          handleSend()
        }
      }, 300)
    }
  }

  function cleanupAudio() {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    try { audioCtxRef.current?.close() } catch { /* */ }
    audioCtxRef.current = null
    analyserRef.current = null
  }

  // ── Enviar ────────────────────────────────────────────────────────────────
  // Palabras que indican intención de filtrar/mostrar/buscar nodos
  const FILTER_INTENT = /\b(muéstrame|enseñame|filtra|muestra|encuentra|busca|ver|show|find|filter|quiero ver|dame|lista|dime)\b/i

  // Intención de navegar al diario de hoy
  const NAV_TODAY_INTENT = /\b(ir al diario|abre el diario|abrir el diario|diario de hoy|nota de hoy|ir a hoy|ir al día de hoy|muéstrame hoy|enseñame hoy|ábreme el diario|open diary|go to today|today's note|show today)\b/i

  async function handleSend(text?: string) {
    const t = (text ?? inputRef.current).trim()
    if (!t || chat.isStreaming) return
    setInput('')
    const final = t.startsWith('__') ? expandSpecialPrompt(t) : t

    // ── Navegación directa: diario de hoy ──────────────────────────────────
    if (NAV_TODAY_INTENT.test(final)) {
      const dayNode = ensureDayPath(new Date())
      navigate(`/node/${dayNode.id}`)
      onClose()
      return
    }

    // ── Detectar intención de filtro ────────────────────────────────────────
    if (FILTER_INTENT.test(final)) {
      const cleanedForFilter = final.replace(FILTER_INTENT, '').trim()
      if (needsInterpretation(cleanedForFilter) || cleanedForFilter.length > 3) {
        const query = await interpretFilterQuery(final)
        if (query) {
          window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query } }))
          window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Filtro aplicado: ${query}`, type: 'success' } }))
          return
        }
      }
    }

    chat.send(final, currentNodeId)
  }

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const isEmpty = chat.messages.length === 0 && !chat.pendingActions
  // La ventana es compacta hasta que se envía el primer mensaje.
  // hasExpanded jamás vuelve a false → tamaño fijo, sin redimensionado por mensaje.
  const isCompact = !hasExpanded && !isRecording

  const innerChat = (
      <div
        className={`magic-chat-modal ${isCompact ? 'magic-chat-modal--compact' : 'magic-chat-modal--expanded'}`}
        onClick={mode === 'modal' ? (e => e.stopPropagation()) : undefined}
      >
        {/* ── Header mínimo: solo acciones (sin logo ni título) ── */}
        <div className="magic-chat-header" style={{ justifyContent: 'flex-end', minHeight: 36, padding: '6px 10px' }}>
          {hasExpanded && (
            <button className="magic-chat-icon-btn" onClick={() => { chat.startNewSession(); setHasExpanded(false) }} title="Nueva conversación">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          )}
          <button className="magic-chat-icon-btn" onClick={onClose} title="Cerrar (Esc)">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* ── Waveform (solo cuando graba) ── */}
        <div className={`magic-chat-waveform ${isRecording ? 'magic-chat-waveform--active' : ''}`}>
          <canvas ref={canvasRef} width={600} height={64} style={{ width: '100%', height: 64 }} />
          <div className="magic-chat-recording-label">
            <span className="magic-chat-recording-dot" />
            Grabando · suelta R para enviar
          </div>
        </div>

        {/* ── Estado vacío: burbuja de From + chips ── */}
        {isCompact && (
          <div className="magic-chat-empty">
            {/* Burbuja de From igual que las respuestas */}
            <div className="magic-chat-bubble magic-chat-bubble--assistant magic-chat-greeting-bubble">
              <div className="magic-chat-bubble-avatar">✦</div>
              <div className="magic-chat-bubble-content">¿Qué necesitas?</div>
            </div>
            <ContextChips
              nodeId={currentNodeId}
              visible={true}
              onSelect={(prompt) => {
                if (chat.isStreaming) return
                const final = prompt.startsWith('__') ? expandSpecialPrompt(prompt) : prompt
                chat.send(final, currentNodeId)
              }}
            />
          </div>
        )}

        {/* ── Mensajes ── */}
        {hasExpanded && (
          <div className="magic-chat-messages">
            {chat.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} onOpenNode={id => { navigate(`/node/${id}`); onClose() }} />
            ))}

            {/* Quick reply chips */}
            {(() => {
              const last = [...chat.messages].reverse().find(m => m.role === 'assistant')
              const chips = last?.chips ?? []
              return chips.length > 0 && !chat.isStreaming && !chat.pendingActions
                ? <QuickReplyChips chips={chips} disabled={chat.isStreaming}
                    onSelect={chip => { setInput(''); chat.send(chip, currentNodeId) }} />
                : null
            })()}

            {/* Confirmación de acciones pendientes */}
            {chat.pendingActions && chat.pendingActions.length > 0 && (
              <PendingConfirmationCard
                actions={chat.pendingActions}
                onConfirm={() => { chat.confirmActions(); onClose() }}
                onCancel={() => chat.cancelActions()}
                disabled={chat.isStreaming}
              />
            )}

            {chat.actionStatus && (
              <div className="magic-chat-status">⚙ {chat.actionStatus}</div>
            )}
            {chat.lastError && (
              <div className="magic-chat-error">{chat.lastError}</div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* ── Input minimalista estilo cursor de nodo ── */}
        <div className="magic-chat-input-wrap">
          <div className="magic-chat-node-input">
            <textarea
              ref={taRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onTextareaKey}
              placeholder={isRecording ? 'Transcribiendo…' : ''}
              className="magic-chat-textarea magic-chat-textarea--bare"
              rows={input.length > 60 ? 3 : input.length > 30 ? 2 : 1}
            />
          </div>
          <div className="magic-chat-actions">
            {/* Grabar: puntito rojo + R */}
            <button
              className={`magic-chat-action-key ${isRecording ? 'magic-chat-action-key--recording' : ''}`}
              onMouseDown={e => { e.preventDefault(); if (!isRecordingRef.current) { isRKeyDownRef.current = false; startRecording() } }}
              onMouseUp={() => { if (isRecordingRef.current) stopRecording(true) }}
              onMouseLeave={() => { if (isRecordingRef.current) stopRecording(true) }}
              title="Mantén pulsado para hablar"
            >
              <span className="magic-action-dot" />
              <span>R</span>
            </button>
            {/* Enviar: tecla ↵ */}
            <button
              className="magic-chat-action-key magic-chat-send"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || chat.isStreaming}
              title="Enviar"
            >
              ↵
            </button>
            {/* Cerrar: tecla ESC */}
            <button
              className="magic-chat-action-key"
              onClick={onClose}
              title="Cerrar"
            >
              ESC
            </button>
          </div>
        </div>
      </div>
  )

  if (mode === 'panel') {
    return (
      <div className="magic-chat-panel">
        {innerChat}
      </div>
    )
  }

  return (
    <div className="magic-chat-backdrop" onClick={onClose}>
      {innerChat}
    </div>
  )
}

// ── QuickReplyChips ──────────────────────────────────────────────────────────

function QuickReplyChips({ chips, onSelect, disabled }: {
  chips: string[]
  onSelect: (t: string) => void
  disabled: boolean
}) {
  if (!chips.length) return null
  return (
    <div className="magic-chat-quick-chips">
      {chips.map((c, i) => (
        <button key={i} disabled={disabled} onClick={() => onSelect(c)} className="magic-chat-chip">
          {c}
        </button>
      ))}
    </div>
  )
}

// ── PendingConfirmationCard ─────────────────────────────────────────────────

function PendingConfirmationCard({ actions, onConfirm, onCancel, disabled }: {
  actions: PendingAction[]
  onConfirm: () => void
  onCancel: () => void
  disabled: boolean
}) {
  const icon = (t: string) => ({ create_note: '📝', create_task: '✅', create_event: '📅', create_resource: '🔗', update_node: '✏️' }[t] ?? '⚡')
  const label = (t: string) => ({ create_note: 'Nota', create_task: 'Tarea', create_event: 'Evento', create_resource: 'Recurso', update_node: 'Modificar' }[t] ?? t)

  return (
    <div style={{ margin: '8px 16px', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, background: 'rgba(249,115,22,0.05)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        <span style={{ color: '#f97316' }}>✋</span>
        <span>Confirma antes de crear</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>{actions.length} {actions.length === 1 ? 'elemento' : 'elementos'}</span>
      </div>
      <div style={{ height: 1, background: 'var(--border)', opacity: 0.4 }} />
      {actions.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 12 }}>
          <span style={{ fontSize: 13 }}>{icon(a.actionType)}</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500, minWidth: 50 }}>{label(a.actionType)}</span>
          <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.editedTitle}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--border)', opacity: 0.4 }} />
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px' }}>
        <button onClick={onCancel} disabled={disabled}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer' }}>
          Cancelar
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => { onConfirm(); window.dispatchEvent(new CustomEvent('from:onboarding-magic-confirmed')) }} disabled={disabled}
          style={{ background: disabled ? 'var(--bg-secondary)' : 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: 'white', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          ✓ Crear todo
        </button>
      </div>
    </div>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, onOpenNode }: { msg: ChatMessage; onOpenNode: (id: string) => void }) {
  const isUser = msg.role === 'user'
  const cleaned = msg.content
    .replace(/```from-action[\s\S]*?```/g, '')
    .replace(/\{\{chips:[\s\S]*?\}\}\s*$/g, '')
    .trim()

  return (
    <div className={`magic-chat-bubble ${isUser ? 'magic-chat-bubble--user' : 'magic-chat-bubble--ai'}`}>
      <div className="magic-chat-bubble-avatar">{isUser ? '👤' : '✨'}</div>
      <div className="magic-chat-bubble-body">
        {cleaned && <div className="magic-chat-bubble-text">{cleaned}</div>}
        {msg.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {msg.actions.map((a, i) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 500, padding: '3px 7px', borderRadius: 999,
                background: a.ok ? 'rgba(34,197,94,0.12)' : 'rgba(251,146,60,0.15)',
                color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <span>{a.ok ? '✓' : '⚠'}</span>
                <span>{actionLabel(a.action)}</span>
                {a.createdIds.length > 0 && (
                  <button onClick={() => onOpenNode(a.createdIds[0])}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 10, fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                    Abrir
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {msg.undoBundle && (msg.undoBundle.createdIds.length > 0 || msg.undoBundle.restoredNodes.length > 0) && (
          <button
            className="magic-undo-btn"
            onClick={() => aiChatStore.undoAction(msg.id)}
          >
            ↩ Deshacer
          </button>
        )}
      </div>
    </div>
  )
}

function actionLabel(id: string): string {
  const map: Record<string, string> = {
    create_note: 'Nota creada', create_task: 'Tarea creada', create_event: 'Evento creado',
    update_node: 'Nodo modificado', read_node: 'Nodo leído', find_nodes: 'Búsqueda',
    add_column: 'Columna añadida', fill_column: 'Columna rellena', add_row: 'Fila añadida',
    change_view: 'Vista cambiada', create_resource: 'Recurso creado', run_prompt: 'Prompt ejecutado',
  }
  return map[id] ?? id
}
