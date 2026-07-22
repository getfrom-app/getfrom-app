// Chat central de Fromly 2.0 — el corazón de la app chat-first.
// Reutiliza el motor REAL: aiChatStore.send() + streaming SSE + acciones.
// currentNodeId = contexto seleccionado → buildPayload le inyecta ese contexto.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChat, aiChatStore } from '../../store/aiChatStore'
import type { ChatMessage } from '../../store/aiChatStore'
import { store, useStore } from '../../store/nodeStore'
import PlannerPanel from '../../components/panels/PlannerPanel'
import { renderChatContent } from '../../components/outliner/InlineRenderer'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'
import { aiLangBCP47 } from '../../utils/aiLang'
import { listAllPrompts, resolvePrompt } from '../../utils/promptsHelper'
import { listAllAgents } from '../../utils/agentesHelper'
import { isMentionable } from '../elementKind'

interface Props {
  currentNodeId: string | null
  contextLabel: string
  onFilesDropped: (files: File[]) => void
  /** El Planificador ya no tiene botón propio ni X para cerrarlo (Alberto, 21 jul:
   *  "yo quitaría el botón... cuando se abre cualquier otra cosa en su lugar el
   *  planificador se quita") — se muestra solo/siempre que la columna derecha está
   *  en la tab Agenda (`rightMode === 'hoy'`, ver V2App.tsx) y desaparece solo al
   *  cambiar a cualquier otra tab o abrir otra cosa. */
  showPlanner: boolean
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

export default function V2Chat({ currentNodeId, contextLabel, onFilesDropped, showPlanner }: Props) {
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
  const [promptMenu, setPromptMenu] = useState(false)
  const [agentMenu, setAgentMenu] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<unknown>(null)
  const promptMenuRef = useRef<HTMLDivElement>(null)
  const agentMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!promptMenu) return
    const onDoc = (e: MouseEvent) => { if (promptMenuRef.current && !promptMenuRef.current.contains(e.target as HTMLElement)) setPromptMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [promptMenu])

  useEffect(() => {
    if (!agentMenu) return
    const onDoc = (e: MouseEvent) => { if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as HTMLElement)) setAgentMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [agentMenu])
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
    updateMentionQuery(e.target)
  }

  // @mención — referenciar CUALQUIER elemento de Fromly en el chat, mismo formato
  // [[Título]] que ya reconoce/renderiza renderInline (wiki-link del outliner).
  // Al enviar, aiChatStore resuelve estas menciones y le da a Fromly el contenido
  // completo del elemento (Alberto, 15 jul: "usando @ se debe poder mencionar
  // cualquier elemento de fromly y el chat tendrá acceso y lo leerá").
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const mentionStartRef = useRef<number>(0)
  function updateMentionQuery(ta: HTMLTextAreaElement) {
    const pos = ta.selectionStart ?? ta.value.length
    const before = ta.value.slice(0, pos)
    const m = before.match(/(?:^|\s)@([^\s@[\]]*)$/)
    if (m) { mentionStartRef.current = pos - m[1].length - 1; setMentionQuery(m[1]) }
    else setMentionQuery(null)
  }
  const mentionResults = useMemo(() => {
    if (mentionQuery == null) return []
    const q = mentionQuery.trim().toLowerCase()
    return store.allActive()
      .filter(n => isMentionable(n) && (!q || (n.text || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 8)
  }, [mentionQuery]) // eslint-disable-line react-hooks/exhaustive-deps
  function pickMention(title: string) {
    const ta = taRef.current
    if (!ta) return
    const start = mentionStartRef.current
    const end = ta.selectionStart ?? input.length
    const next = input.slice(0, start) + `[[${title}]] ` + input.slice(end)
    setInput(next)
    setMentionQuery(null)
    requestAnimationFrame(() => { ta.focus(); const p = start + title.length + 5; ta.setSelectionRange(p, p) })
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
    if (mentionQuery != null && mentionResults.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pickMention(mentionResults[0].text || '')
      return
    }
    if (e.key === 'Escape' && mentionQuery != null) { e.preventDefault(); setMentionQuery(null); return }
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
                    if (disp) return renderChatContent(disp)
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
                  {/* Referencia clicable al agente/prompt recién creado, en el propio mensaje
                      del chat — antes solo quedaba descrito en el texto, sin nada a lo que
                      hacer clic aquí mismo (Alberto, 15 jul: "debe aparecer allí mismo en el
                      chat que se ha creado y se debe abrir a la derecha"). */}
                  {m.actions
                    .filter(a => a.ok && (a.action === 'create_agent' || a.action === 'create_prompt') && a.createdIds.length === 1)
                    .map(a => {
                      const node = store.getNode(a.createdIds[0])
                      if (!node) return null
                      return (
                        <button
                          key={a.createdIds[0]}
                          className="v2-chip"
                          style={{ marginTop: 8, display: 'block' }}
                          onClick={() => window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: node.id } }))}
                        >
                          {node.text || t('common.noTitle', 'Sin título')}
                        </button>
                      )
                    })}
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
          <div className="v2-composer-box" style={{ position: 'relative' }}>
            {mentionQuery != null && mentionResults.length > 0 && (
              <div className="v2-doc-menu v2-doc-menu-up" style={{ left: 0, right: 'auto' }}>
                {mentionResults.map(n => (
                  <button key={n.id} onClick={() => pickMention(n.text || '')}>{n.text || t('common.noTitle', 'Sin título')}</button>
                ))}
              </div>
            )}
            {/* Prompts: elegir uno para enviarlo directamente al chat, o crear uno nuevo.
                Vive en el composer (no en la cabecera) — es aquí donde tiene sentido
                elegir qué se va a enviar. Desplegable hacia ARRIBA (v2-doc-menu-up):
                el composer está pegado abajo del todo. */}
            <div style={{ position: 'relative' }} ref={promptMenuRef}>
              <button className="v2-iconbtn" title={t('v2.chat.promptsTitle', 'Prompts')} onClick={() => setPromptMenu(o => !o)}>⚡</button>
              {promptMenu && (
                <div className="v2-doc-menu v2-doc-menu-up">
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
                    // Chat-first: en vez de un window.prompt() del navegador (Alberto,
                    // 15 jul: "esta ventana feísima de Chrome... debería preguntar qué
                    // prompt quieres crear... y confirmarlo por chat"), Fromly pregunta
                    // en el propio chat; la respuesta del usuario dispara la IA con
                    // acceso a create_prompt (aiChatExecutor.ts) — redacta el contenido,
                    // crea el nodo y lo abre solo en la columna derecha (mismo mecanismo
                    // que cualquier creación por chat, ver aiChatStore.ts).
                    setPromptMenu(false)
                    aiChatStore.addNotice(t('v2.chat.askNewPrompt', '¿Qué prompt quieres crear? Cuéntame para qué lo vas a usar y qué debe decir, y te preparo un borrador.'))
                    taRef.current?.focus()
                  }}>➕ {t('v2.chat.newPrompt', 'Nuevo prompt')}</button>
                </div>
              )}
            </div>
            {/* Agentes: mismo patrón que Prompts — ver los existentes (clic abre su
                ficha) o crear uno nuevo. Antes solo se podía crear desde la tab
                Elementos, tras seleccionar el filtro «Agentes» — poco descubrible
                (Alberto, 15 jul: "sigo sin saber cómo crear... un agente"). */}
            <div style={{ position: 'relative' }} ref={agentMenuRef}>
              <button className="v2-iconbtn" title={t('v2.chat.agentsTitle', 'Agentes')} onClick={() => setAgentMenu(o => !o)}>🤖</button>
              {agentMenu && (
                <div className="v2-doc-menu v2-doc-menu-up">
                  {listAllAgents().map(a => (
                    // El icono ya viene incluido como prefijo de `a.text` (createAgentUnder
                    // lo escribe así al crear el agente) — no volver a anteponerlo aparte,
                    // o se ve duplicado (p.ej. "📈📈 Informe de mercado").
                    <button key={a.id} onClick={() => {
                      setAgentMenu(false)
                      window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: a.id } }))
                    }}>{a.text || t('common.noTitle', 'Sin título')}</button>
                  ))}
                  {listAllAgents().length === 0 && (
                    <div className="v2-usermenu-label" style={{ padding: '4px 10px 2px' }}>{t('v2.chat.noAgents', 'Sin agentes todavía')}</div>
                  )}
                  <div className="v2-doc-menu-sep" />
                  <button onClick={() => {
                    // Chat-first, mismo motivo que «Nuevo prompt» arriba: Fromly pregunta
                    // en el chat en vez de un window.prompt() del navegador. La IA ya sabe
                    // usar create_agent (system prompt del servidor) y tiene la regla de
                    // preguntar 1-2 cosas concretas antes de crear si hay ambigüedad — el
                    // agente nace SIEMPRE desactivado (revisar y activar a mano).
                    setAgentMenu(false)
                    aiChatStore.addNotice(t('v2.chat.askNewAgent', '¿Qué quieres automatizar? Cuéntame qué debe hacer el agente y con qué frecuencia, y te preparo un borrador.'))
                    taRef.current?.focus()
                  }}>➕ {t('v2.chat.newAgent', 'Nuevo agente')}</button>
                </div>
              )}
            </div>
            <textarea
              ref={taRef}
              value={input}
              rows={1}
              placeholder={isRecording ? t('v2.chat.voiceRecording', 'Escuchando…') : `${t('v2.chat.composerPlaceholder', 'Escribe a Fromly')}${contextLabel && contextLabel !== 'General' ? ` · ${contextLabel}` : ''}…`}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
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

      {/* Planificador — reutiliza el PlannerPanel completo de la v1 (semana/mes/año —
          Día vive ahora en su propio tab de la columna derecha, ver V2RightColumn),
          a pantalla completa, sin recortar funcionalidad. Sin botón propio ni X: se
          muestra en cuanto la columna derecha está en la tab Agenda y desaparece
          solo al cambiar a otra tab o abrir cualquier otra cosa (Alberto, 21 jul). */}
      {showPlanner && (
        <div className="v2-planner-overlay">
          <div className="v2-planner-overlay-bar">
            <span className="v2-planner-overlay-title">📅 {t('wftopbar.planner', 'Planificador')}</span>
          </div>
          <PlannerPanel initialView="week" initialDays={7} viewTabs={['week', 'month', 'year']} onClose={() => {}} />
        </div>
      )}
    </main>
  )
}
