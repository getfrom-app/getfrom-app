// Chat central de Fromly 2.0 — el corazón de la app chat-first.
// Habla con /assistant/chat, el mismo "cerebro" que ya usan iOS y Telegram
// (Alberto, 13 ago: "la misma inteligencia y magia del chat de iOS"). Antes
// usaba un motor propio (/ai/chat, streaming, bloques from-action) sin
// acciones dictadas sobre tareas existentes ni agentes a demanda.
//
// Estilo del mensaje: texto plano, sin globos — igual que el chat de iOS
// (Alberto, 13 ago, sobre iOS: "hazlo como Claude Code, simplemente texto").
// El equivalente al "deslizar" de iOS son las acciones que YA existen en la
// web: clic derecho (from:open-rowmenu → RightColMenu) y los botones de hover
// de TaskRow — se reutilizan tal cual, no se reinventa nada.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAssistantStore, assistantStore } from '../../store/assistantStore'
import type { AssistantMsg } from '../../store/assistantStore'
import type { AssistantListedTask, AssistantListedAgent } from '../../api/assistant'
import { store, useStore } from '../../store/nodeStore'
import { renderChatContent } from '../../components/outliner/InlineRenderer'
import { getShortcuts, tryExpand } from '../../hooks/useTextExpansion'
import { aiLangBCP47 } from '../../utils/aiLang'
import { listAllPrompts, resolvePrompt } from '../../utils/promptsHelper'
import { listAllAgents } from '../../utils/agentesHelper'
import { displayTitle } from '../../utils/displayText'
import { isMentionable } from '../elementKind'
import TaskRow from '../../components/panels/TaskRow'
import { TaskPropsPopover } from '../../components/panels/DiaryPanelComponents'
import Icon from './Icon'
import V2ContextBrowser from './V2ContextBrowser'

interface Props {
  currentNodeId: string | null
  contextLabel: string
  onFilesDropped: (files: File[]) => void
  embedded?: boolean
  elementScoped?: boolean
  onOpenConversation?: (id: string) => void
  onNewChatInCtx?: (id: string | null) => void
  onSelectCtx?: (id: string) => void
}

function openNode(id: string) {
  window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: id } }))
}

/** Las tareas nombradas en la respuesta ("refs"/"list") — fila tocable, no
 *  texto muerto. Reusa TaskRow cuando el nodo ya está sincronizado
 *  localmente (normal: los cambios server-side llegan en ~15-20s por el
 *  poll de ops); si aún no ha llegado, una fila simple hace de puente. */
function AssistantTaskList({ items }: { items: AssistantListedTask[] }) {
  useStore()
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const propsNode = propsNodeId ? store.getNode(propsNodeId) : null
  return (
    <div className="v2-assistant-list">
      {items.map(it => {
        const node = store.getNode(it.id)
        if (node) {
          return <TaskRow key={it.id} node={node} onOpenDate={n => setPropsNodeId(id => id === n.id ? null : n.id)} />
        }
        return (
          <button key={it.id} className="v2-assistant-row" onClick={() => openNode(it.id)}>
            <span className={`v2-assistant-row-dot ${it.overdue ? 'overdue' : ''}`} />
            <span className="v2-assistant-row-text">{it.text}</span>
          </button>
        )
      })}
      {propsNode && <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />}
    </div>
  )
}

/** Los agentes nombrados en la respuesta — clic abre su ficha, clic derecho
 *  ejecuta ahora o activa/desactiva (equivalente al swipe de iOS). */
function AssistantAgentList({ items }: { items: AssistantListedAgent[] }) {
  const { t } = useTranslation()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  return (
    <div className="v2-assistant-list">
      {items.map(a => (
        <div key={a.id} className="v2-assistant-row" style={{ position: 'relative' }}>
          <button className="v2-assistant-row-main" onClick={() => openNode(a.id)}>
            <Icon name="agent" size={14} />
            <span className="v2-assistant-row-text">{a.title}</span>
            {!a.enabled && <span className="v2-assistant-row-meta">{t('v2.chat.agentPaused', 'pausado')}</span>}
          </button>
          <button className="v2-iconbtn" title={t('v2.chat.agentMore', 'Más')} onClick={() => setMenuFor(m => m === a.id ? null : a.id)}>
            <Icon name="more" size={14} />
          </button>
          {menuFor === a.id && (
            <div className="v2-doc-menu" style={{ right: 0, left: 'auto', top: '100%' }}>
              <button onClick={() => { setMenuFor(null); assistantStore.runAgent(a.id, a.title) }}>
                {t('v2.chat.runNow', 'Ejecutar ahora')}
              </button>
              <button onClick={() => { setMenuFor(null); assistantStore.toggleAgentEnabled(a.id, !a.enabled) }}>
                {a.enabled ? t('v2.chat.pause', 'Pausar') : t('v2.chat.activate', 'Activar')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AssistantBubble({ m, isLast, onOption }: { m: AssistantMsg; isLast: boolean; onOption: (t: string) => void }) {
  const { t } = useTranslation()
  const visibleCreated = m.created.filter(c => !assistantStore.isTrashed(c.id))
  return (
    <div className={`v2-assistant-msg ${m.role}`}>
      {m.role === 'user' ? (
        <div className="v2-assistant-user-line">
          <span className="v2-assistant-prompt">›</span> {m.text}
        </div>
      ) : (
        <div className="v2-assistant-reply v2-msg-body">{renderChatContent(m.text)}</div>
      )}

      {visibleCreated.length > 0 && (
        <div className="v2-assistant-list" style={{ marginTop: 6 }}>
          {visibleCreated.map(c => {
            const node = store.getNode(c.id)
            if (node && c.isTask) return <TaskRow key={c.id} node={node} onOpenDate={() => openNode(c.id)} />
            return (
              <button key={c.id} className="v2-assistant-row" onClick={() => openNode(c.id)}>
                <Icon name={c.isTask ? 'task' : 'document'} size={14} />
                <span className="v2-assistant-row-text">{c.text}</span>
              </button>
            )
          })}
        </div>
      )}

      {m.list && m.list.length > 0 && <AssistantTaskList items={m.list} />}
      {m.agents && m.agents.length > 0 && <AssistantAgentList items={m.agents} />}

      {m.linkedNodeId && (
        <button className="v2-chip" style={{ marginTop: 6 }} onClick={() => openNode(m.linkedNodeId!)}>
          › {t('v2.chat.open', 'Abrir')}
        </button>
      )}

      {isLast && m.options && m.options.length > 0 && (
        <div className="v2-el-filter" style={{ marginTop: 8 }}>
          {m.options.map((o, i) => (
            <button key={i} className="v2-chip" onClick={() => onOption(o)}>{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function V2Chat({ currentNodeId, contextLabel, onFilesDropped, embedded, elementScoped, onOpenConversation, onNewChatInCtx, onSelectCtx }: Props) {
  const { t } = useTranslation()
  const scoped = elementScoped ?? embedded
  const chat = useAssistantStore()
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
  const thinking = chat.isThinking

  // Trae el brief/avisos que hayan llegado mientras la pestaña no estaba
  // delante, igual que hace iOS al abrir — el hilo web es también el
  // registro completo de lo que el asistente ha dicho por su cuenta.
  useEffect(() => {
    assistantStore.fetchInbox().catch(() => {})
  }, [])

  // Al abrir, directo al final del hilo — sin depender de que cambie el
  // recuento (que también crece al pedir histórico hacia arriba).
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(() => {
    const el = scrollRef.current
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages[messages.length - 1]?.id, thinking])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const expanded = tryExpand(text, getShortcuts())
    setInput(expanded ?? text)
    updateMentionQuery(e.target)
  }

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
    if (!trimmed || thinking) return
    setInput('')
    assistantStore.send(trimmed).catch(() => {})
  }

  useEffect(() => {
    const onSendPrompt = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail
      if (detail?.text) doSend(detail.text)
    }
    window.addEventListener('from:send-prompt', onSendPrompt)
    return () => window.removeEventListener('from:send-prompt', onSendPrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking])

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
  const hasCtx = !!contextLabel && contextLabel !== 'General'

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
        <span className="v2-center-title">
          {scoped
            ? <><Icon name="chat" size={15} className="v2-title-icon" />{t('v2.rightColumn.tabChat', 'Chat')}</>
            : <>{hasCtx && <span className="v2-center-ctx">{contextLabel} › </span>}{t('v2.chat.title', 'Fromly')}</>}
        </span>
      </div>

      <div className="v2-chat-scroll" ref={scrollRef}>
        {isEmpty ? (
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
          <div className="v2-chat-inner v2-assistant-inner">
            {chat.hasMoreHistory && (
              <button className="v2-done-toggle" onClick={() => assistantStore.loadMoreHistory()}>
                {t('v2.chat.loadMore', 'Cargar más antiguos')}
              </button>
            )}
            {messages.map((m, i) => (
              <AssistantBubble key={m.id} m={m} isLast={i === messages.length - 1} onOption={doSend} />
            ))}
            {thinking && (
              <div className="v2-assistant-msg assistant">
                <span className="v2-creating"><Icon name="sparkle" size={14} /> {t('v2.chat.thinking', 'Fromly está pensando…')}<span className="v2-creating-dots" /></span>
              </div>
            )}
          </div>
        )}
      </div>

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
                    setPromptMenu(false)
                    assistantStore.addNotice(t('v2.chat.askNewPrompt', '¿Qué prompt quieres crear? Cuéntame para qué lo vas a usar y qué debe decir, y te preparo un borrador.'))
                    taRef.current?.focus()
                  }}><Icon name="plus" size={14} /> {t('v2.chat.newPrompt', 'Nuevo prompt')}</button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} ref={agentMenuRef}>
              <button className="v2-iconbtn" title={t('v2.chat.agentsTitle', 'Agentes')} onClick={() => setAgentMenu(o => !o)}><Icon name="agent" /></button>
              {agentMenu && (
                <div className="v2-doc-menu v2-doc-menu-up">
                  {listAllAgents().map(a => (
                    <button key={a.id} onClick={() => {
                      setAgentMenu(false)
                      openNode(a.id)
                    }}><Icon name="agent" size={14} /> {displayTitle(a.text, t('common.noTitle', 'Sin título'))}</button>
                  ))}
                  {listAllAgents().length === 0 && (
                    <div className="v2-usermenu-label" style={{ padding: '4px 10px 2px' }}>{t('v2.chat.noAgents', 'Sin agentes todavía')}</div>
                  )}
                  <div className="v2-doc-menu-sep" />
                  <button onClick={() => {
                    setAgentMenu(false)
                    assistantStore.addNotice(t('v2.chat.askNewAgent', '¿Qué quieres automatizar? Cuéntame qué debe hacer el agente y con qué frecuencia, y te preparo un borrador.'))
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
            <button className="v2-send" disabled={!input.trim() || thinking} onClick={() => doSend(input)} title={t('v2.chat.send', 'Enviar')}><Icon name="arrow-up" size={16} strokeWidth={2} /></button>
          </div>
          <div className="v2-composer-hint">
            {thinking ? t('v2.chat.thinking', 'Fromly está pensando…') : t('v2.chat.composerHint', 'Enter para enviar · Shift+Enter salto de línea · arrastra archivos aquí')}
          </div>
        </div>
      </div>

      {dragOver && (
        <div className="v2-drop-overlay">
          <Icon name="import" size={18} />
          {t('v2.chat.importToFromly', 'Importar a Fromly')}
        </div>
      )}
    </Wrapper>
  )
}
