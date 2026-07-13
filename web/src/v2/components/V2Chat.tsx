// Chat central de Fromly 2.0 — el corazón de la app chat-first.
// Reutiliza el motor REAL: aiChatStore.send() + streaming SSE + acciones.
// currentNodeId = contexto seleccionado → buildPayload le inyecta ese contexto.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChat, aiChatStore } from '../../store/aiChatStore'
import type { ChatMessage } from '../../store/aiChatStore'
import { store, useStore } from '../../store/nodeStore'
import NewTaskModal from '../../components/modals/NewTaskModal'
import NewEventModal from '../../components/modals/NewEventModal'
import PlannerPanel from '../../components/panels/PlannerPanel'
import V2TemplatesModal from './V2TemplatesModal'
import { listTemplates } from '../../utils/tagsHelper'
import { renderInline } from '../../components/outliner/InlineRenderer'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'
import { aiLangBCP47 } from '../../utils/aiLang'
import { listAllPrompts, createPromptUnder, resolvePrompt } from '../../utils/promptsHelper'

interface Props {
  currentNodeId: string | null
  contextLabel: string
  onFilesDropped: (files: File[]) => void
  onNewDocument: (templateId?: string) => void
  onNewCanvas: () => void
  recorder: { recording: boolean; busy: boolean; start: () => void; stop: () => void }
}

// Oculta los bloques ```from-action``` (completos o el parcial que aún se está
// escribiendo) para que el usuario NUNCA vea el JSON de la acción en el chat.
function stripActions(s: string): string {
  return s
    .replace(/```from-action[\s\S]*?```/g, '')
    .replace(/```from-action[\s\S]*$/, '')
    // Red de seguridad: el marcador de chips de seguimiento ya se separa en el store
    // (parseChips), pero nunca debe poder colarse crudo al chat pase lo que pase.
    .replace(/\{\{chips:[\s\S]*?\}\}/g, '')
    .trim()
}

export default function V2Chat({ currentNodeId, contextLabel, onFilesDropped, onNewDocument, onNewCanvas, recorder }: Props) {
  const { t } = useTranslation()
  const SUGGESTIONS = [
    { t: t('v2.chat.suggestSummarizeDayTitle', 'Resume mi día'), d: t('v2.chat.suggestSummarizeDayDesc', 'Tareas y eventos de hoy'), p: t('v2.chat.suggestSummarizeDayPrompt', '¿Qué tengo para hoy? Resume mis tareas y eventos.') },
    { t: t('v2.chat.suggestSearchNotesTitle', 'Busca en mis notas'), d: t('v2.chat.suggestSearchNotesDesc', 'Pregunta a todo lo guardado'), p: t('v2.chat.suggestSearchNotesPrompt', 'Busca en mis notas lo que sé sobre ') },
    { t: t('v2.chat.suggestOrganizeTitle', 'Organiza esto'), d: t('v2.chat.suggestOrganizeDesc', 'Ordena y prioriza'), p: t('v2.chat.suggestOrganizePrompt', 'Ayúdame a organizar y priorizar mis tareas pendientes.') },
    { t: t('v2.chat.suggestCreateTaskTitle', 'Crea una tarea'), d: t('v2.chat.suggestCreateTaskDesc', 'Captura rápida'), p: t('v2.chat.suggestCreateTaskPrompt', 'Crea una tarea: ') },
  ]
  const chat = useAIChat()
  useStore()
  const [input, setInput] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [showEvent, setShowEvent] = useState(false)
  const [showPlanner, setShowPlanner] = useState(false)
  const [docMenu, setDocMenu] = useState(false)
  const [promptMenu, setPromptMenu] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<unknown>(null)
  const docMenuRef = useRef<HTMLDivElement>(null)
  const promptMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!docMenu) return
    const onDoc = (e: MouseEvent) => { if (docMenuRef.current && !docMenuRef.current.contains(e.target as HTMLElement)) setDocMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [docMenu])

  useEffect(() => {
    if (!promptMenu) return
    const onDoc = (e: MouseEvent) => { if (promptMenuRef.current && !promptMenuRef.current.contains(e.target as HTMLElement)) setPromptMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [promptMenu])
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

  // Atajos de texto (Ajustes → Atajos): expande el trigger en cuanto coincide,
  // igual que en el outliner de v1 (misma fuente en localStorage).
  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const expanded = tryExpand(text, getShortcuts())
    setInput(expanded ?? text)
  }

  const doSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setInput('')
    chat.send(trimmed, currentNodeId || undefined).catch(() => {})
  }

  // Prompt resuelto desde el detalle («Probar en Magic») o desde el propio desplegable:
  // se coloca y se envía directamente, sin paso intermedio.
  useEffect(() => {
    const onSendPrompt = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail
      if (detail?.text) doSend(detail.text)
    }
    window.addEventListener('from:send-prompt', onSendPrompt)
    return () => window.removeEventListener('from:send-prompt', onSendPrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, streaming])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend(input)
    }
  }

  // Dictado por voz (Web Speech API) — mismo motor que el chat de v1 (AIChatModal.tsx):
  // transcribe en vivo directamente sobre el input, sin pasar por grabación+Whisper
  // (eso es la "Nota de voz" aparte, para audios largos). Alt+Espacio activa/desactiva.
  const toggleVoice = () => {
    if (isRecording) {
      try { (recognitionRef.current as { stop?: () => void } | null)?.stop?.() } catch { /* ignore */ }
      setIsRecording(false)
      return
    }
    const SR = (window as unknown as Record<string, unknown>).webkitSpeechRecognition
      || (window as unknown as Record<string, unknown>).SpeechRecognition
    if (!SR) {
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('v2.chat.voiceUnsupported', 'Tu navegador no soporta dictado por voz. Prueba Chrome o Safari.'), type: 'warning' } }))
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (SR as any)()
    rec.lang = aiLangBCP47()
    rec.continuous = true
    rec.interimResults = true
    const capturedStart = input.trim()
    let finalTranscript = ''
    rec.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { 0: { transcript: string }; isFinal: boolean } } }) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += txt + ' '
        else interimTranscript += txt
      }
      const combined = [capturedStart, (finalTranscript + interimTranscript).trim()].filter(Boolean).join(' ')
      setInput(combined.trim())
    }
    rec.onend = () => setIsRecording(false)
    rec.start()
    recognitionRef.current = rec
    setIsRecording(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'Space') { e.preventDefault(); toggleVoice() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, input])

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
          {chat.sessionId ? (convTitle || t('v2.chat.conversation', 'Conversación')) : t('v2.chat.newConversation', 'Nueva conversación')}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Crear contenido sin pasar por el chat: nota (con plantillas), lienzo, tarea, evento o voz. */}
          <div style={{ position: 'relative' }} ref={docMenuRef}>
            <button className="v2-head-action" title={t('v2.chat.newNote', 'Nueva nota')}
              onClick={() => setDocMenu(o => !o)}>＋ {t('v2.chat.newNoteShort', 'Nota')}</button>
            {docMenu && (
              <div className="v2-doc-menu">
                <button onClick={() => { onNewDocument(); setDocMenu(false) }}>📄 {t('v2.chat.blankDocument', 'En blanco')}</button>
                {listTemplates().length > 0 && (
                  <>
                    <div className="v2-usermenu-label" style={{ padding: '4px 10px 2px' }}>{t('v2.chat.templates', 'Plantillas')}</div>
                    {listTemplates().map(tpl => (
                      <button key={tpl.id} onClick={() => { onNewDocument(tpl.id); setDocMenu(false) }}>{(tpl.text || t('v2.chat.template', 'Plantilla')).replace(/^[^\p{L}\p{N}]+/u, '')}</button>
                    ))}
                  </>
                )}
                <div className="v2-doc-menu-sep" />
                <button onClick={() => { setShowTemplatesModal(true); setDocMenu(false) }}>⚙️ {t('v2.templates.manageTitle', 'Gestionar plantillas')}</button>
              </div>
            )}
          </div>
          <button className="v2-head-action" title={t('v2.chat.newCanvas', 'Nuevo lienzo')} onClick={onNewCanvas}>＋ {t('v2.chat.newCanvasShort', 'Lienzo')}</button>
          <button className="v2-head-action" title={t('v2.chat.newTask', 'Nueva tarea')} onClick={() => setShowTask(true)}>＋ {t('v2.chat.newTaskShort', 'Tarea')}</button>
          <button className="v2-head-action" title={t('v2.chat.newEvent', 'Nuevo evento')} onClick={() => setShowEvent(true)}>＋ {t('v2.chat.newEventShort', 'Evento')}</button>
          {/* Prompts: elegir uno para enviarlo directamente al chat, o crear uno nuevo. */}
          <div style={{ position: 'relative' }} ref={promptMenuRef}>
            <button className="v2-head-action" title={t('v2.chat.promptsTitle', 'Prompts')} onClick={() => setPromptMenu(o => !o)}>⚡ {t('v2.chat.promptsShort', 'Prompt')}</button>
            {promptMenu && (
              <div className="v2-doc-menu">
                {listAllPrompts().map(p => {
                  let picon = '⚡'
                  try { picon = JSON.parse(p.extraData || '{}')._promptIcon || '⚡' } catch { /* ignore */ }
                  return (
                    <button key={p.id} onClick={() => {
                      const text = resolvePrompt(p.id, { currentNodeId: currentNodeId || undefined })
                      doSend(text)
                      setPromptMenu(false)
                    }}>{picon} {p.text || t('common.noTitle', 'Sin título')}</button>
                  )
                })}
                {listAllPrompts().length === 0 && (
                  <div className="v2-usermenu-label" style={{ padding: '4px 10px 2px' }}>{t('v2.chat.noPrompts', 'Sin prompts todavía')}</div>
                )}
                <div className="v2-doc-menu-sep" />
                <button onClick={() => {
                  const name = window.prompt(t('v2.chat.newPromptName', 'Nombre del prompt:'))
                  if (!name || !name.trim()) return
                  const created = createPromptUnder({ parentId: currentNodeId, label: name.trim(), icon: '⚡' })
                  setPromptMenu(false)
                  window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: created.id } }))
                }}>➕ {t('v2.chat.newPrompt', 'Nuevo prompt')}</button>
              </div>
            )}
          </div>
          <button className="v2-head-action" title={t('v2.plannerOpen', 'Abrir el planificador')} onClick={() => setShowPlanner(true)}>📅 {t('wftopbar.planner', 'Planificador')}</button>
          <button
            className={`v2-head-action ${recorder.recording ? 'recording' : ''}`}
            title={recorder.recording ? t('v2.chat.stopAndSave', 'Detener y guardar') : t('v2.chat.recordAudio', 'Grabar audio (reunión o nota de voz)')}
            disabled={recorder.busy}
            onClick={() => (recorder.recording ? recorder.stop() : recorder.start())}
          >
            {recorder.busy ? `⏳ ${t('v2.chat.saving', 'Guardando…')}` : recorder.recording ? `⏹ ${t('v2.chat.stop', 'Detener')}` : `🎙 ${t('v2.chat.record', 'Grabar')}`}
          </button>
          {!isEmpty && (
            <button className="v2-iconbtn" title={t('v2.chat.newConversation', 'Nueva conversación')} onClick={() => { aiChatStore.startNewSession() }}>＋</button>
          )}
        </div>
      </div>

      <div className="v2-chat-scroll" ref={scrollRef}>
        {isEmpty ? (
          <div className="v2-empty">
            <h1>{t('v2.chat.greeting', 'Hola')} 👋</h1>
            <p>{t('v2.chat.emptyHint', 'Habla con Fromly. Pregúntale a todo lo que guardas, crea notas y tareas, o sube archivos arrastrándolos aquí.')}</p>
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
                <div className="v2-msg-avatar">{m.role === 'user' ? t('v2.chat.you', 'Tú') : '✦'}</div>
                <div className="v2-msg-body">
                  {(() => {
                    const disp = stripActions(m.content)
                    if (disp) return disp.split('\n').map((line, i) => <p key={i}>{line ? renderInline(line) : ' '}</p>)
                    if (streaming && m.role === 'assistant') {
                      return <span className="v2-creating">✨ {t('v2.chat.creating', 'Creando')}<span className="v2-creating-dots" /></span>
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
            <span className="v2-el-meta" style={{ flex: 1 }}>{t('v2.chat.proposedChanges', '{{count}} cambio(s) propuesto(s)', { count: pending.length })}</span>
            <button className="v2-chip" onClick={() => aiChatStore.cancelActions()}>{t('v2.chat.discard', 'Descartar')}</button>
            <button className="v2-chip active" onClick={() => aiChatStore.confirmActions().catch(() => {})}>{t('v2.chat.apply', 'Aplicar')}</button>
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
              placeholder={isRecording ? t('v2.chat.voiceRecording', 'Escuchando…') : `${t('v2.chat.composerPlaceholder', 'Escribe a Fromly')}${contextLabel && contextLabel !== 'General' ? ` · ${contextLabel}` : ''}…`}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
            />
            <button
              className="v2-iconbtn"
              title={isRecording ? t('v2.chat.voiceStop', 'Detener dictado') : t('v2.chat.voiceStart', 'Dictar por voz (Alt+Espacio)')}
              onClick={toggleVoice}
              style={isRecording ? { color: '#ef4444' } : undefined}
            >{isRecording ? '🎙' : '🎤'}</button>
            <button className="v2-send" disabled={!input.trim() || streaming} onClick={() => doSend(input)}>↑</button>
          </div>
          <div className="v2-composer-hint">
            {streaming ? t('v2.chat.thinking', 'Fromly está pensando…') : t('v2.chat.composerHint', 'Enter para enviar · Shift+Enter salto de línea · arrastra archivos aquí')}
          </div>
        </div>
      </div>

      {dragOver && <div className="v2-drop-overlay">{chat.sessionId ? `📎 ${t('v2.chat.importToConversation', 'Importar a la conversación')}` : `📥 ${t('v2.chat.importToFromly', 'Importar a Fromly')}`}</div>}

      {/* Modales de creación rápida (mismos que la v1). Las tareas nacen en el
          contexto activo (o el diario de hoy si no hay); los eventos, en el diario. */}
      {showTask && <NewTaskModal parentId={currentNodeId ?? undefined} onClose={() => setShowTask(false)} />}
      {showEvent && (
        <NewEventModal
          onClose={() => setShowEvent(false)}
          onCreated={id => window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: id } }))}
        />
      )}

      {/* Planificador — reutiliza el PlannerPanel completo de la v1 (día/semana/mes/año,
          drag&drop, GCal sync) a pantalla completa, sin recortar funcionalidad. */}
      {showPlanner && (
        <div className="v2-planner-overlay">
          <div className="v2-planner-overlay-bar">
            <span className="v2-planner-overlay-title">📅 {t('wftopbar.planner', 'Planificador')}</span>
            <button className="v2-planner-overlay-close" title={t('common.close', 'Cerrar')} onClick={() => setShowPlanner(false)}>✕</button>
          </div>
          <PlannerPanel initialView="week" initialDays={7} onClose={() => setShowPlanner(false)} />
        </div>
      )}

      {/* Gestión de plantillas (crear/editar/eliminar) — reutiliza NodeConfigModal de v1. */}
      {showTemplatesModal && <V2TemplatesModal onClose={() => setShowTemplatesModal(false)} />}
    </main>
  )
}
