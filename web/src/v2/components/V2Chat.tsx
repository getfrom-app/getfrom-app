// Chat central de Fromly 2.0 — el corazón de la app chat-first.
// Reutiliza el motor REAL: aiChatStore.send() + streaming SSE + acciones.
// currentNodeId = contexto seleccionado → buildPayload le inyecta ese contexto.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChat, aiChatStore } from '../../store/aiChatStore'
import type { ChatMessage } from '../../store/aiChatStore'
import { store, useStore } from '../../store/nodeStore'
import { renderChatContent } from '../../components/outliner/InlineRenderer'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'
import { aiLangBCP47 } from '../../utils/aiLang'
import { listAllPrompts, resolvePrompt } from '../../utils/promptsHelper'
import { listAllAgents } from '../../utils/agentesHelper'
import { displayTitle } from '../../utils/displayText'
import { isMentionable } from '../elementKind'
import Icon from './Icon'
import V2ContextBrowser from './V2ContextBrowser'

interface Props {
  currentNodeId: string | null
  contextLabel: string
  onFilesDropped: (files: File[]) => void
  /** Mismo chat, montado dentro de la columna derecha en vez del espacio central
   *  — SIEMPRE que hay un elemento abierto en el centro, es su chat asociado
   *  (V2ElementChat/V2RightColumn.tsx). `.v2-col.v2-center` fija `height:100vh`,
   *  correcto solo como columna raíz del grid — en `embedded` se usa
   *  `.v2-right-fill` (mismo flex:1/min-height:0 que el resto de contenido de
   *  la columna derecha). También cambia el saludo/sugerencias del estado
   *  vacío: sobre EL DOCUMENTO, no genéricos de "resume mi día" (Alberto, 30
   *  jul: "no debería aparecer, debería ser un chat dedicado al tema del que
   *  se está hablando"). */
  embedded?: boolean
  /** `embedded` mezclaba dos cosas — maquetación (columna derecha vs centro) Y si el
   *  copy/sugerencias son "sobre este documento" vs genéricos. El destino "Chat"
   *  general (Alberto, 5 ago 2026) necesita la maquetación de `embedded` pero el
   *  copy GENÉRICO (no hay documento del que hablar) — este prop desacopla lo
   *  segundo. Por defecto cae en `embedded` (`scoped = elementScoped ?? embedded`),
   *  así que los sitios existentes (centro, `V2ElementChat`) no cambian de
   *  comportamiento al no pasarlo nunca. */
  elementScoped?: boolean
  /** Estado vacío = tarjetas de contexto (ver más abajo). Estos tres handlers
   *  son los mismos que usa el tab «Historial» — se pasan tal cual desde V2App. */
  onOpenConversation?: (id: string) => void
  onNewChatInCtx?: (id: string | null) => void
  onSelectCtx?: (id: string) => void
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
    // Red de seguridad: pese a la instrucción del prompt, el modelo a veces suelta
    // <function_calls> justo antes del bloque de acción (hábito de otros formatos
    // de function-calling) — nunca debe verse como texto suelto en el chat.
    .replace(/<\/?function_calls?>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function V2Chat({ currentNodeId, contextLabel, onFilesDropped, embedded, elementScoped, onOpenConversation, onNewChatInCtx, onSelectCtx }: Props) {
  const { t } = useTranslation()
  // Ver comentario del prop `elementScoped` — decide copy (sugerencias/saludo/título),
  // NO maquetación (esa se queda en `embedded` puro más abajo).
  const scoped = elementScoped ?? embedded
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

  const Wrapper = embedded ? 'div' : 'main'
  return (
    <Wrapper
      className={embedded ? 'v2-right-fill' : 'v2-col v2-center'}
      onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      style={{ position: 'relative' }}
    >
      <div className="v2-center-head">
        {/* Embedded: sin título dinámico — el documento YA muestra su título en el
            centro, repetirlo aquí es ruido; una etiqueta fija basta para decir qué
            es este panel. */}
        <span className="v2-center-title">
          {scoped
            ? <><Icon name="chat" size={15} className="v2-title-icon" />{t('v2.rightColumn.tabChat', 'Chat')}</>
            : <>
                {hasCtx && <span className="v2-center-ctx">{contextLabel} › </span>}
                {chat.sessionId ? (convTitle || t('v2.chat.conversation', 'Conversación')) : t('v2.chat.newConversation', 'Nueva conversación')}
              </>}
        </span>
      </div>

      <div className="v2-chat-scroll" ref={scrollRef}>
        {isEmpty ? (
          /* Estado vacío del chat. Ya NO es un saludo ("Hola 👋") con 4 sugerencias
             genéricas — Alberto, 5 ago 2026: "no se utiliza realmente, lo podemos
             quitar... podemos aprovechar ese espacio para poner tarjetas con cada
             uno de los contextos, según se han ido utilizando, igual que hace
             Claude. Al hacer clic en cada tarjeta se abre la lista de
             conversaciones de ese contexto".
             · Chat de un ELEMENTO (`scoped`): una línea de contexto y nada más —
               ahí las tarjetas sobran (ya sabes de qué estás hablando).
             · Chat general/de contexto: las tarjetas, si hay con qué navegar.
               `onOpenConversation` es lo que decide: sin él (usos que aún no lo
               pasan) el estado vacío se queda simplemente en blanco, sin romperse. */
          <div className="v2-chat-empty">
            {scoped ? (
              <div className="v2-chat-empty-hint">
                {t('v2.chat.elementEmptyHint', 'Pregunta por este documento, pídele que lo resuma, lo convierta en tareas, o lo mejore. Ya sabe de qué se trata.')}
              </div>
            ) : onOpenConversation ? (
              <V2ContextBrowser
                variant="cards"
                onOpenConversation={onOpenConversation}
                onNewChatInCtx={onNewChatInCtx}
                onSelectCtx={onSelectCtx}
              />
            ) : null}
          </div>
        ) : (
          <div className="v2-chat-inner">
            {messages.map((m: ChatMessage) => (
              <div key={m.id} className={`v2-msg ${m.role}`}>
                <div className="v2-msg-avatar">{m.role === 'user' ? t('v2.chat.you', 'Tú') : <Icon name="sparkle" size={15} />}</div>
                <div className="v2-msg-body">
                  {(() => {
                    const disp = stripActions(m.content)
                    if (disp) return renderChatContent(disp)
                    if (streaming && m.role === 'assistant') {
                      return <span className="v2-creating"><Icon name="sparkle" size={14} /> {t('v2.chat.creating', 'Creando')}<span className="v2-creating-dots" /></span>
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
                  {/* Referencia clicable al elemento recién creado, en el propio mensaje del
                      chat — antes solo quedaba descrito en el texto, sin nada a lo que hacer
                      clic aquí mismo (Alberto, 15 jul, sobre agentes/prompts: "debe aparecer
                      allí mismo en el chat que se ha creado y se debe abrir a la derecha").
                      Extendido a documentos/notas (Alberto, 30 jul): cuando el chat está
                      centrado en un elemento (V2ElementChat) y la IA crea un documento nuevo,
                      V2App.tsx YA NO lo abre solo en el centro (eso apartaría la nota que se
                      estaba trabajando) — este chip es la única forma de llegar a él desde
                      aquí, a un clic, sin perder de vista lo que había abierto. */}
                  {m.actions
                    .filter(a => a.ok && ['create_agent', 'create_prompt', 'create_document', 'create_note', 'create_resource'].includes(a.action) && a.createdIds.length === 1)
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
              <button className="v2-iconbtn" title={t('v2.chat.promptsTitle', 'Prompts')} onClick={() => setPromptMenu(o => !o)}><Icon name="prompt" /></button>
              {promptMenu && (
                <div className="v2-doc-menu v2-doc-menu-up">
                  {listAllPrompts().map(p => (
                    <button key={p.id} onClick={() => {
                      const text = resolvePrompt(p.id, { currentNodeId: currentNodeId || undefined })
                      doSend(text)
                      setPromptMenu(false)
                    }}><Icon name="prompt" size={14} /> {p.text || t('common.noTitle', 'Sin título')}</button>
                  ))}
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
                  }}><Icon name="plus" size={14} /> {t('v2.chat.newPrompt', 'Nuevo prompt')}</button>
                </div>
              )}
            </div>
            {/* Agentes: mismo patrón que Prompts — ver los existentes (clic abre su
                ficha) o crear uno nuevo. Antes solo se podía crear desde la tab
                Elementos, tras seleccionar el filtro «Agentes» — poco descubrible
                (Alberto, 15 jul: "sigo sin saber cómo crear... un agente"). */}
            <div style={{ position: 'relative' }} ref={agentMenuRef}>
              <button className="v2-iconbtn" title={t('v2.chat.agentsTitle', 'Agentes')} onClick={() => setAgentMenu(o => !o)}><Icon name="agent" /></button>
              {agentMenu && (
                <div className="v2-doc-menu v2-doc-menu-up">
                  {listAllAgents().map(a => (
                    // `displayTitle` quita el emoji que createAgentUnder dejó escrito
                    // como prefijo EN EL DATO — el icono lo pone la UI, siempre el mismo.
                    <button key={a.id} onClick={() => {
                      setAgentMenu(false)
                      window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: a.id } }))
                    }}><Icon name="agent" size={14} /> {displayTitle(a.text, t('common.noTitle', 'Sin título'))}</button>
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
                  }}><Icon name="plus" size={14} /> {t('v2.chat.newAgent', 'Nuevo agente')}</button>
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
            ><Icon name={isRecording ? 'stop' : 'mic'} /></button>
            <button className="v2-send" disabled={!input.trim() || streaming} onClick={() => doSend(input)} title={t('v2.chat.send', 'Enviar')}><Icon name="arrow-up" size={16} strokeWidth={2} /></button>
          </div>
          <div className="v2-composer-hint">
            {streaming ? t('v2.chat.thinking', 'Fromly está pensando…') : t('v2.chat.composerHint', 'Enter para enviar · Shift+Enter salto de línea · arrastra archivos aquí')}
          </div>
        </div>
      </div>

      {dragOver && (
        <div className="v2-drop-overlay">
          <Icon name={chat.sessionId ? 'attachment' : 'import'} size={18} />
          {chat.sessionId ? t('v2.chat.importToConversation', 'Importar a la conversación') : t('v2.chat.importToFromly', 'Importar a Fromly')}
        </div>
      )}
    </Wrapper>
  )
}
