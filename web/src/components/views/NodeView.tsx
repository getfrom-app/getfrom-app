import { useParams, useNavigate } from 'react-router-dom'
import { useFilterStore } from '../../store/filterStore'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'
import { normalizeSynonyms } from '../../utils/filterInterpreter'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { unfurlUrl, isUrl } from '../../api/unfurl'
import { createPortal } from 'react-dom'
import Outliner from '../outliner/Outliner'
import InlineRenderer, { detectBlockType, renderInlineToHtml } from '../outliner/InlineRenderer'
import NodeTableView from './NodeTableView'
import NodeKanbanView from './NodeKanbanView'
import NodeCalendarView from './NodeCalendarView'
import WFTemporalView from './WFTemporalView'
import NodeViewTabs from './NodeViewTabs'
import TemporalChildrenBlock from './TemporalChildrenBlock'
import NodeSpecialControls from './NodeSpecialControls'
import NodeChatPanel from '../panels/NodeChatPanel'
import { GCalEventEditor } from '../panels/DiaryRightPanel'
import { recordRecentNode } from '../CommandPalette'
import NodeContextMenu from '../outliner/NodeContextMenu'
import type { Node } from '../../types'
import { isoToLocalTime, hasLocalTime } from '../../utils/dates'
import { createCalendarEvent, updateCalendarEvent, fromRecToRRule, type CalendarEvent } from '../../api/googleCalendar'
import { getGcalColor } from '../../utils/gcalNodesSync'
import { useUserStore } from '../../store/userStore'
import { nodeMeta } from '../../store/nodeStore'
import { getPresignedUpload, getFilesForNode, deleteFile, aiInlineStream, withTokenGuard, TokensError, publishNote, unpublishNote, getToken } from '../../api/client'
import EmojiPicker from '../EmojiPicker'
import MoveNodeModal from '../modals/MoveNodeModal'
import SlashMenu from '../outliner/SlashMenu'
import { createNodeShortcut, getAtajosNode } from '../../utils/atajosHelper'

function formatBytes(b: number): string {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

function isImage(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
}

interface Attachment {
  key: string
  filename: string
  size: number
  url: string
}

// UUID regex — si el id es un UUID, es directo; si no, puede ser un slug
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function NodeView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const s = useStore()
  const [globalFilter] = useFilterStore()

  // ── Resolución de slug → UUID ──────────────────────────────────────────────
  // Si el :id no es un UUID, lo tratamos como slug y lo resolvemos via API
  const [resolvedId, setResolvedId] = useState<string | null>(id && UUID_RE.test(id) ? id : null)
  useEffect(() => {
    if (!id) return
    if (UUID_RE.test(id)) { setResolvedId(id); return }
    // Buscar primero en el store local por publicSlug
    const local = [...s.nodes.values()].find(n => !n.deletedAt && n.publicSlug === id)
    if (local) { setResolvedId(local.id); return }
    // Llamar al servidor
    import('../../api/client').then(({ apiRequest }) =>
      apiRequest<{ id: string }>(`/sync/resolve-slug/${encodeURIComponent(id)}`)
        .then(r => navigate(`/node/${r.id}`, { replace: true }))
        .catch(() => setResolvedId(null))
    )
  }, [id]) // eslint-disable-line

  const effectiveId = resolvedId ?? id
  const node = effectiveId ? s.getNode(effectiveId) : undefined

  // ── Nodos atajo: al cargar, aplicar filtro y volver al árbol ─────────────
  // Un atajo no tiene contenido propio — es un filtro guardado.
  // Al "entrar" en él, se activa el filtro en lugar de mostrar el nodo.
  useEffect(() => {
    if (!node) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._shortcutNodeId) {
        // Atajo a nodo específico → navegar al nodo destino
        navigate(`/node/${ed._shortcutNodeId}`, { replace: true })
        return
      }
      if (ed._shortcutQuery !== undefined) {
        // Atajo de filtro:
        // 1. Navegar primero a raíz para que WFHomeView esté montado
        // 2. Disparar el filtro en el siguiente tick (handleSetFilter en MainLayout lo recoge)
        navigate('/', { replace: true })
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: ed._shortcutQuery || '' } }))
        }, 30)
        return
      }
    } catch { /* nodo normal, continuar */ }
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [bodyEditing, setBodyEditing] = useState(false)
  const [bodyValue, setBodyValue] = useState('')
  const [_showProperties, _setShowProperties] = useState(false) // unused — panel siempre visible
  const [focusMode, setFocusMode] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [titleContextMenu, setTitleContextMenu] = useState<{ x: number; y: number } | null>(null)
  const bodyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // File attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachmentsAvailable, setAttachmentsAvailable] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI streaming state
  const [isAiStreaming, setIsAiStreaming] = useState(false)

  // Share state
  const [shareCopied, setShareCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  // Quick actions bar state
  const [quickActionMsg, setQuickActionMsg] = useState<string | null>(null)

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Chat panel state
  const [showChat, setShowChat] = useState(false)

  // GCal events state (para notas diarias)
  const us = useUserStore()
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([])
  const [editingGCalEvent, setEditingGCalEvent] = useState<CalendarEvent | null>(null)

  // Focus mode word goal state
  const [wordGoal, setWordGoal] = useState<number | null>(null)

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Layout del contenido (wide / small / normal)
  const nodeLayout = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').layout || '' } catch { return '' }
  }, [node?.extraData])

  function setLayout(value: string) {
    if (!node) return
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (value) ed.layout = value; else delete ed.layout
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch { store.updateNode(node.id, { extraData: JSON.stringify({ layout: value }) }) }
  }

  // Legacy: viewBlock single-view (retrocompatible). Si existe sin _views
  // moderno, se sintetiza una vista única.
  const viewBlock = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').viewBlock || 'lista' } catch { return 'lista' }
  }, [node?.extraData])

  function setViewBlock(mode: string) {
    if (!node) return
    // Siempre leer extraData existente para no perder _props, _views, etc.
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* extraData corrupto — empezar vacío */ }
    if (mode === 'lista') delete ed.viewBlock
    else ed.viewBlock = mode
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
  }

  // ── Vistas múltiples (Notion-style) ─────────────────────────────────────
  // activeViewId = id de la vista activa entre las del padre
  // viewKind = kind resuelto (list/table/kanban/calendar)
  const activeViewId = useMemo(() => {
    if (!node) return 'default'
    const saved = store.getActiveViewId(node.id)
    if (saved) return saved
    const views = store.getViews(node.id)
    if (views.length > 0) return views[0].id
    // Bridge a legacy viewBlock: si hay viewBlock guardado, usar 'default' que mapea a list
    return 'default'
  }, [node?.id, node?.extraData])

  const viewKind = useMemo(() => {
    if (!node) return 'list'
    // Si hay _views modernas, usa el kind de la activa
    const views = store.getViews(node.id)
    if (views.length > 0) {
      const v = views.find(x => x.id === activeViewId)
      return v?.kind || 'list'
    }
    // Si no hay _views, mapea desde viewBlock legacy
    if (viewBlock === 'tabla') return 'table'
    if (viewBlock === 'kanban') return 'kanban'
    if (viewBlock === 'calendario') return 'calendar'
    return 'list'
  }, [node?.id, node?.extraData, activeViewId, viewBlock])

  function handleSelectView(id: string) {
    if (!node) return
    store.setActiveViewId(node.id, id)
  }

  const [titleEditing, setTitleEditing] = useState(false)
  const [showTitleSlash, setShowTitleSlash] = useState(false)
  const [titleSlashQuery, setTitleSlashQuery] = useState('')
  // Tag picker en el título (#tag autocompletado)
  const [titleTagPicker, setTitleTagPicker] = useState<{ query: string; items: string[]; activeIdx: number } | null>(null)
  const [titleTagPickerPos, setTitleTagPickerPos] = useState<{ top: number; left: number } | null>(null)

  // Record recent visit
  useEffect(() => {
    if (id) recordRecentNode(id)
  }, [id])

  // Al entrar a un nodo concreto, limpiar el filtro global — igual que Workflowy
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('wf:clear-filter'))
  }, [id])

  // Sync bodyValue when node changes (e.g. external update)
  useEffect(() => {
    if (node && !bodyEditing) {
      setBodyValue(node.body || '')
    }
  }, [node?.id, node?.body]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus textarea when body editing starts
  useEffect(() => {
    if (bodyEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
    }
  }, [bodyEditing])

  // Auto-focus title when node is new and has no text
  useEffect(() => {
    if (node && !node.text && titleRef.current) {
      titleRef.current.focus()
    }
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync title DOM when not focused — renderiza con tags coloreados
  // Para notas de diario, siempre muestra la fecha completa con año derivada de diaryDate
  useEffect(() => {
    if (!titleEditing && titleRef.current) {
      let displayText = node?.text || ''
      // Si el icono es de extraData, añadirlo al inicio del título para consistencia visual
      if (nodeIcon && iconSource === 'extra' && !displayText.startsWith(nodeIcon)) {
        displayText = `${nodeIcon} ${displayText}`
      }
      // En WF mode mostramos node.text directamente (sin reformatear)
      // para que display y edición sean consistentes.
      // En modo normal, los diarios muestran la fecha completa formateada.
      const isWFMode = !!document.querySelector('.wf-layout')
      if (!isWFMode && node?.isDiaryEntry && node?.diaryDate) {
        const d = new Date(node.diaryDate)
        displayText = d.toLocaleDateString('es-ES', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }).replace(/^\w/, c => c.toUpperCase())
      }
      // Si el texto completo ES una URL, no auto-enlazar — se muestra como recurso
      const rendered = isUrl(displayText.trim())
        ? displayText
        : renderInlineToHtml(displayText)
      if (titleRef.current.innerHTML !== rendered) {
        titleRef.current.innerHTML = rendered
      }
    }
  }, [node?.text, node?.diaryDate, node?.isDiaryEntry, titleEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar eventos de Google Calendar como nodos hijos de la nota diaria
  useEffect(() => {
    if (!node?.isDiaryEntry || !node.diaryDate) { setGcalEvents([]); return }
    // GCal events ahora solo se muestran en el DiaryTimeline (vista Calendario)
    // No se crean nodos en el outliner
    setGcalEvents([])
  }, [node?.id, node?.isDiaryEntry, node?.diaryDate, us.googleConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detectar cuando un nodo GCal se mueve a otra nota → actualizar fecha en GCal
  // GCal node-move sync eliminado: los eventos GCal ya no son nodos en el outliner.
  // Ahora viven solo como time blocks en DiaryTimeline (vista Calendario).

  // Auto-sync From eventos → GCal cuando el nodo es isEvent y tiene fecha
  useEffect(() => {
    if (!node?.isEvent || !node.due) return
    if (!us.googleConnected) return
    const gcalId = nodeMeta(node).gcalEventId ?? null
    const timer = setTimeout(async () => {
      const end = node.dueEnd || new Date(new Date(node.due!).getTime() + 3600000).toISOString()
      let loc = ''
      try { loc = JSON.parse(node.extraData || '{}').location || '' } catch {}
      try {
        const rrule = fromRecToRRule(node.recurrence)
        if (gcalId) {
          await updateCalendarEvent(gcalId, {
            title: node.text || 'Evento',
            start: node.due!,
            end,
            description: node.body || undefined,
            location: loc || undefined,
            recurrence: rrule,
          })
        } else {
          const result = await createCalendarEvent({
            title: node.text || 'Evento',
            start: node.due!,
            end,
            description: node.body || undefined,
            location: loc || undefined,
            recurrence: rrule,
          })
          let ed: Record<string, unknown> = {}
          try { ed = JSON.parse(node.extraData || '{}') } catch {}
          ed.gcalEventId = result.id
          store.updateNode(node.id, { extraData: JSON.stringify(ed) })
        }
      } catch { /* sin conexión GCal — silencioso */ }
    }, 1200)
    return () => clearTimeout(timer)
  }, [node?.isEvent, node?.text, node?.due, node?.dueEnd, node?.body, node?.extraData, node?.recurrence, us.googleConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load attachments on mount / node change
  useEffect(() => {
    if (!node || store.isGuest) return
    getFilesForNode(node.id)
      .then(setAttachments)
      .catch(() => {
        setAttachmentsAvailable(false)
      })
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+P → toggle properties panel
  // Cmd+F → toggle in-doc search
  const [inDocSearch, setInDocSearch] = useState('')
  const [showInDocSearch, setShowInDocSearch] = useState(false)
  const inDocSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        // setShowProperties(v => !v) // panel siempre visible
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowInDocSearch(v => {
          if (!v) setTimeout(() => inDocSearchRef.current?.focus(), 50)
          return !v
        })
      }
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const url = window.location.href
        navigator.clipboard.writeText(url).then(() => {
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        }).catch(() => {})
      }
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowChat(v => !v)
      }
      if (e.key === 'Escape') {
        setShowInDocSearch(false)
        setInDocSearch('')
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Filtro inteligente: cuando el filtro activo (global o in-doc) es una smart query
  // (pendiente, hoy, tarea…), computar matchIds para el Outliner en lugar de text search.
  const activeFilterQuery = inDocSearch || globalFilter || ''
  const smartFilterResult = useMemo(() => {
    if (!activeFilterQuery.trim()) return null
    const effective = normalizeSynonyms(activeFilterQuery) ?? activeFilterQuery
    if (!isSmartQuery(effective)) return null
    return applyWFFilter(s.nodes, effective)
  }, [activeFilterQuery, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar title tag picker al hacer click fuera
  useEffect(() => {
    if (!titleTagPicker) return
    function handler() { setTitleTagPicker(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [titleTagPicker])

  // Icono del nodo (extraData.icon)
  // ── Icono unificado: extraData.icon || primer emoji del texto ─────────────
  const { nodeIcon, iconSource } = useMemo(() => {
    try {
      const extraIcon = JSON.parse(node?.extraData || '{}').icon || null
      if (extraIcon) return { nodeIcon: extraIcon, iconSource: 'extra' as const }
    } catch {}
    const m = (node?.text || '').match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u)
    if (m) return { nodeIcon: m[0], iconSource: 'text' as const }
    return { nodeIcon: null, iconSource: null }
  }, [node?.extraData, node?.text])
  // iconSource: 'extra' | 'text' | null — indica de dónde viene el icono

  // Color del nodo (extraData.color)
  const nodeColor = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').color || null } catch { return null }
  }, [node?.extraData])

  // Lock state
  const isLocked = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').locked === true } catch { return false }
  }, [node?.extraData])

  // Area del nodo (extraData.area)
  const nodeArea = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').area || null } catch { return null }
  }, [node?.extraData])

  // ── Auto-detect URL en título → marcar como recurso + unfurl ─────────────
  useEffect(() => {
    if (!node || node.deletedAt) return
    const text = (node.text || '').trim()
    if (!isUrl(text)) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    // Solo auto-detectar si no está ya marcado como recurso
    if (ed._resource) return
    // Marcar como recurso y hacer unfurl
    ed._resource = true
    ed._resourceUrl = text
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    unfurlUrl(text)
      .then(meta => {
        let ed2: Record<string, unknown> = {}
        try { ed2 = JSON.parse(store.getNode(node.id)?.extraData || '{}') } catch {}
        ed2._resourceMeta = meta
        ed2._resourceType = meta.type
        store.updateNode(node.id, { text: meta.title || text, extraData: JSON.stringify(ed2) })
      })
      .catch(() => {})
  }, [node?.id, node?.text]) // eslint-disable-line

  // [hooks order fix] handleBodyKeyDown movido arriba para llamarlo antes del early-return
  const handleBodyKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ── Cmd+Space → AI inline ──────────────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
      e.preventDefault()
      if (isAiStreaming || store.isGuest) return
      setIsAiStreaming(true)
      const cursorPos = textareaRef.current?.selectionStart ?? bodyValue.length
      const context = bodyValue.slice(0, cursorPos)
      const contextEnriquecido = buildAiContext(context)
      let aiText = ''
      try {
        const resource = node ? store.findAncestorResource(node.id) : null
        await aiInlineStream(
          contextEnriquecido,
          undefined,
          (chunk) => {
            aiText += chunk
            setBodyValue(prev => {
              const before = prev.slice(0, cursorPos)
              const after = prev.slice(cursorPos)
              return before + aiText + after
            })
          },
          resource ? { resourceUrl: resource.url, resourceKind: resource.kind } : undefined
        )
      } catch (err) {
        if (err instanceof TokensError) { window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } })) } else if (err instanceof Error && err.message !== 'AI_LIMIT') {
          console.error('AI inline error', err)
        }
      } finally {
        setIsAiStreaming(false)
      }
      return
    }

    // ── Cmd+B → negrita ───────────────────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      applyBodyFormat('**')
      return
    }

    // ── Cmd+I → cursiva ───────────────────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault()
      applyBodyFormat('*')
      return
    }

    // ── Cmd+E → código inline ─────────────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
      e.preventDefault()
      applyBodyFormat('`')
      return
    }

    // ── Cmd+Shift+K → link template ───────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = ta.value.slice(start, end)
      const linkText = selected || 'texto'
      const insertion = `[${linkText}](url)`
      ta.setRangeText(insertion, start, end, 'end')
      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
      return
    }

    // ── Cmd+] → indentar línea (añadir 2 espacios) ───────────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === ']') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
      ta.setRangeText('  ', lineStart, lineStart, 'end')
      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
      return
    }

    // ── Cmd+[ → des-indentar línea (quitar 2 espacios) ───────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === '[') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
      const lineContent = ta.value.slice(lineStart)
      const spacesToRemove = lineContent.startsWith('    ') ? 4 : lineContent.startsWith('  ') ? 2 : lineContent.startsWith(' ') ? 1 : 0
      if (spacesToRemove > 0) {
        ta.setRangeText('', lineStart, lineStart + spacesToRemove, 'end')
        handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
      }
      return
    }

    // ── Tab → insertar 4 espacios ─────────────────────────────────────────
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      ta.setRangeText('    ', start, start, 'end')
      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
      return
    }

    // ── Shift+Tab → quitar 4 espacios al inicio de línea ─────────────────
    if (e.key === 'Tab' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
      const lineContent = ta.value.slice(lineStart)
      const spacesToRemove = lineContent.startsWith('    ') ? 4 : lineContent.startsWith('  ') ? 2 : lineContent.startsWith(' ') ? 1 : 0
      if (spacesToRemove > 0) {
        ta.setRangeText('', lineStart, lineStart + spacesToRemove, 'end')
        handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
      }
      return
    }

    // ── Enter → auto-continuación de listas ──────────────────────────────
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      const ta = textareaRef.current
      if (!ta) return
      const pos = ta.selectionStart
      const lines = bodyValue.slice(0, pos).split('\n')
      const currentLine = lines[lines.length - 1]

      const bulletMatch = currentLine.match(/^(\s*)([-*])\s(.*)/)
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)/)

      if (bulletMatch) {
        if (bulletMatch[3].trim() !== '') {
          // Continuar lista de viñetas
          e.preventDefault()
          const indent = bulletMatch[1]
          const bullet = bulletMatch[2]
          const insertion = `\n${indent}${bullet} `
          const newValue = bodyValue.slice(0, pos) + insertion + bodyValue.slice(pos)
          setBodyValue(newValue)
          if (bodyDebounceRef.current) clearTimeout(bodyDebounceRef.current)
          bodyDebounceRef.current = setTimeout(() => {
            store.updateNode(node!.id, { body: newValue || null })
          }, 500)
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = pos + insertion.length
              textareaRef.current.selectionEnd = pos + insertion.length
            }
          }, 0)
        } else {
          // Viñeta vacía → salir de la lista
          e.preventDefault()
          const indent = bulletMatch[1]
          const lineStart = bodyValue.lastIndexOf('\n', pos - 1) + 1
          const newValue = bodyValue.slice(0, lineStart) + indent + '\n' + bodyValue.slice(pos)
          setBodyValue(newValue)
          if (bodyDebounceRef.current) clearTimeout(bodyDebounceRef.current)
          bodyDebounceRef.current = setTimeout(() => {
            store.updateNode(node!.id, { body: newValue || null })
          }, 500)
          setTimeout(() => {
            if (textareaRef.current) {
              const newPos = lineStart + indent.length + 1
              textareaRef.current.selectionStart = newPos
              textareaRef.current.selectionEnd = newPos
            }
          }, 0)
        }
        return
      }

      if (numberedMatch) {
        if (numberedMatch[3].trim() !== '') {
          // Continuar lista numerada
          e.preventDefault()
          const indent = numberedMatch[1]
          const nextNum = parseInt(numberedMatch[2]) + 1
          const insertion = `\n${indent}${nextNum}. `
          const newValue = bodyValue.slice(0, pos) + insertion + bodyValue.slice(pos)
          setBodyValue(newValue)
          if (bodyDebounceRef.current) clearTimeout(bodyDebounceRef.current)
          bodyDebounceRef.current = setTimeout(() => {
            store.updateNode(node!.id, { body: newValue || null })
          }, 500)
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = pos + insertion.length
              textareaRef.current.selectionEnd = pos + insertion.length
            }
          }, 0)
        } else {
          // Numerada vacía → salir de la lista
          e.preventDefault()
          const indent = numberedMatch[1]
          const lineStart = bodyValue.lastIndexOf('\n', pos - 1) + 1
          const newValue = bodyValue.slice(0, lineStart) + indent + '\n' + bodyValue.slice(pos)
          setBodyValue(newValue)
          if (bodyDebounceRef.current) clearTimeout(bodyDebounceRef.current)
          bodyDebounceRef.current = setTimeout(() => {
            store.updateNode(node!.id, { body: newValue || null })
          }, 500)
          setTimeout(() => {
            if (textareaRef.current) {
              const newPos = lineStart + indent.length + 1
              textareaRef.current.selectionStart = newPos
              textareaRef.current.selectionEnd = newPos
            }
          }, 0)
        }
        return
      }
    }
  }, [isAiStreaming, bodyValue, node?.text]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node || node.deletedAt) {
    // Si el store aún no ha cargado, mostrar loading en lugar del error
    if (!store.isLoaded) {
      return <div className="view-loading">Cargando…</div>
    }
    return (
      <div className="view-empty" style={{ flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>🔍</div>
        <div>Nodo no encontrado</div>
        <button
          className="btn-primary"
          style={{ marginTop: 8, fontSize: 13, padding: '6px 16px' }}
          onClick={() => navigate('/')}
        >
          Volver al inicio
        </button>
      </div>
    )
  }

  // ── Breadcrumb: buscar ancestro diario (incluyendo el nodo actual) ──────
  const diaryAncestor = node.isDiaryEntry ? node : (() => {
    let c = node
    while (c.parentId) {
      const p = s.getNode(c.parentId)
      if (!p) break
      if (p.isDiaryEntry) return p
      c = p
    }
    return null
  })()

  // Detect temporal node type (when viewing a year/month/week node directly)
  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const temporalNodeType: 'year' | 'month' | 'week' | null = (() => {
    const t = node.text || ''
    if (/^\d{4}$/.test(t)) return 'year'
    if (MONTHS_ES.some(m => m.toLowerCase() === t.toLowerCase())) return 'month'
    if (/^Semana \d+$/i.test(t)) return 'week'
    return null
  })()

  // Crumbs temporales: Año / Mes / Semana (a partir del ancestro diario)
  const diaryTemporalCrumbs: { label: string; type: 'year' | 'month' | 'week' }[] = []
  let diaryDateRef: Date | null = null
  if (diaryAncestor?.diaryDate) {
    diaryDateRef = new Date(diaryAncestor.diaryDate)
    const diaryDate = diaryDateRef
    const yearLabel = diaryDate.getFullYear().toString()
    const monthLabel = diaryDate.toLocaleDateString('es-ES', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())
    const weekNumber = (() => {
      const d = new Date(diaryDate); d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
      const week1 = new Date(d.getFullYear(), 0, 4)
      return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    })()
    diaryTemporalCrumbs.push(
      { label: yearLabel, type: 'year' },
      { label: monthLabel, type: 'month' },
      { label: `Semana ${weekNumber}`, type: 'week' },
    )
  }

  // Crumbs de nodos: cadena de padres, deteniéndose en el ancestro diario
  // Si el nodo actual NO es diario y tiene un ancestro diario, lo incluimos como crumb
  // Regex para detectar nodos temporales (año/mes/semana) que ya aparecen en diaryTemporalCrumbs
  const MONTHS_ES_SET = new Set(['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])
  function isTemporalText(text: string): boolean {
    const t = (text || '').trim()
    if (/^\d{4}$/.test(t)) return true
    // "Mayo" o "Mayo 2026"
    const words = t.toLowerCase().split(/\s+/)
    if (MONTHS_ES_SET.has(words[0]) && (words.length === 1 || /^\d{4}$/.test(words[1] || ''))) return true
    if (/^semana \d+$/i.test(t)) return true
    return false
  }

  const crumbs: { id: string; text: string }[] = []
  let cur = node
  while (cur.parentId) {
    const parent = s.getNode(cur.parentId)
    if (!parent) break
    if (parent.isDiaryEntry) {
      // Añadir el diario como crumb (navegable al día) solo si no estamos ya en él
      if (!node.isDiaryEntry) {
        crumbs.unshift({ id: parent.id, text: parent.text || 'Diario' })
      }
      break
    }
    // Si ya tenemos crumbs temporales del diaryDate, saltar nodos temporales en el walker
    // para evitar duplicar "2026 / Mayo / Semana 21" dos veces
    if (diaryTemporalCrumbs.length > 0 && isTemporalText(parent.text || '')) {
      cur = parent
      continue
    }
    crumbs.unshift({ id: parent.id, text: parent.text || 'Sin título' })
    cur = parent
  }

  // Helper: find week number from date
  function weekNumberFromDate(d: Date): number {
    const date = new Date(d); date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
    const week1 = new Date(date.getFullYear(), 0, 4)
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  }

  // Navigate to a temporal node (year/month/week), creating proper hierarchy.
  // SAFE: solo busca en la jerarquía correcta (sin fallbacks por texto suelto)
  // para no reparentar accidentalmente notas del usuario llamadas "2026",
  // "Mayo" o "Semana 22".
  function navigateToTemporalNode(type: 'year' | 'month' | 'week', fromDate: Date): void {
    const allNodes = [...store.nodes.values()].filter(n => !n.deletedAt && !n.isDiaryEntry)

    const yearStr = fromDate.getFullYear().toString()
    const monthStr = fromDate.toLocaleDateString('es-ES', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())
    const weekStr = `Semana ${weekNumberFromDate(fromDate)}`

    // Year node — solo top-level. Si no existe, crearlo.
    let yearNode = allNodes.find(n => n.text === yearStr && !n.parentId)
    if (!yearNode) yearNode = store.createNode({ text: yearStr, parentId: null })

    if (type === 'year') { navigate(`/node/${yearNode.id}`); return }

    // Month node — hijo directo de yearNode. Sin fallback de texto suelto.
    let monthNode = allNodes.find(n => n.text === monthStr && n.parentId === yearNode!.id)
    if (!monthNode) monthNode = store.createNode({ text: monthStr, parentId: yearNode.id })

    if (type === 'month') { navigate(`/node/${monthNode.id}`); return }

    // Week node — hijo directo de monthNode.
    let weekNode = allNodes.find(n => n.text === weekStr && n.parentId === monthNode!.id)
    if (!weekNode) weekNode = store.createNode({ text: weekStr, parentId: monthNode.id })

    navigate(`/node/${weekNode.id}`)
  }

  function handleTitleInput(e: React.FormEvent<HTMLHeadingElement>) {
    // Si el h1 tiene un único <a> (URL auto-enlazada), recuperar el href completo
    const el = e.currentTarget
    const anchors = el.querySelectorAll('a')
    const rawText = el.textContent || ''
    const text = anchors.length === 1 && !rawText.startsWith('http')
      ? (anchors[0].getAttribute('href') || rawText)
      : rawText
    // Auto-sync bidireccional: types[] refleja los #tags del título.
    const BUILTIN_TYPES = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])
    const hashTags = new Set([...(text.match(/#([\wÀ-ɏ\/\-]+)/g) || [])].map(t => t.slice(1)))
    const currentTypes = node!.types || []
    const newTypes = [
      ...currentTypes.filter(t => BUILTIN_TYPES.has(t) || hashTags.has(t)),
      ...[...hashTags].filter(t => !currentTypes.includes(t)),
    ]
    const typesChanged = newTypes.length !== currentTypes.length ||
      newTypes.some((t, i) => t !== currentTypes[i])
    if (typesChanged) {
      store.updateNode(node!.id, { text, types: newTypes })
    } else {
      store.updateNode(node!.id, { text })
    }

    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const pos = range.endOffset
      const before = text.slice(0, pos)

      // Detect '/' for slash menu
      const slashMatch = before.match(/(^|[\s])\/([^\s]*)$/)
      if (slashMatch) {
        setShowTitleSlash(true)
        setTitleSlashQuery(slashMatch[2])
        setTitleTagPicker(null)
      } else {
        setShowTitleSlash(false)
        setTitleSlashQuery('')
      }

      // Detect '#' for tag picker
      const hashMatch = before.match(/#([^\s#]*)$/)
      if (hashMatch && !slashMatch) {
        const query = hashMatch[1].toLowerCase()
        const allTags = store.allUsedTags()
        const COMMON = ['tarea', 'proyecto', 'nota', 'referencia', 'evento', 'bucle']
        const combined = Array.from(new Set([...allTags, ...COMMON]))
        const items = combined.filter(t => !query || t.toLowerCase().includes(query)).slice(0, 10)
        if (items.length > 0) {
          const cursorRect = range.getBoundingClientRect()
          setTitleTagPicker({ query, items, activeIdx: 0 })
          setTitleTagPickerPos({
            top: cursorRect.bottom + 4,
            left: Math.max(8, Math.min(cursorRect.left, window.innerWidth - 220)),
          })
        } else {
          setTitleTagPicker(null)
        }
      } else if (!hashMatch) {
        setTitleTagPicker(null)
      }
    }
  }

  function applyTitleTag(tag: string) {
    if (!titleTagPicker || !titleRef.current) return
    const text = titleRef.current.textContent || ''
    const hashIdx = text.lastIndexOf('#' + titleTagPicker.query)
    if (hashIdx < 0) { setTitleTagPicker(null); return }
    const newText = text.slice(0, hashIdx) + '#' + tag + text.slice(hashIdx + 1 + titleTagPicker.query.length)
    const newTypes = (node!.types || []).includes(tag) ? node!.types : [...(node!.types || []), tag]
    store.updateNode(node!.id, { text: newText.trim(), types: newTypes })
    if (titleRef.current) titleRef.current.textContent = newText.trim()
    setTitleTagPicker(null)
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // body desactivado — en From todo va en nodos hijos
    setBodyValue(e.target.value)
  }

  function handleBodyBlur() {
    setBodyEditing(false)
    if (bodyDebounceRef.current) {
      clearTimeout(bodyDebounceRef.current)
      bodyDebounceRef.current = null
    }
    // body desactivado — no guardar
  }

  function toggleFavorite() {
    if (!node) return
    const atajosNode = getAtajosNode()
    // Comprobar si ya existe como atajo (hijo de 📌 Atajos con _shortcutNodeId)
    const existingShortcut = atajosNode
      ? store.children(atajosNode.id).find(n => {
          try { return JSON.parse(n.extraData || '{}')._shortcutNodeId === node.id } catch { return false }
        })
      : null

    if (existingShortcut) {
      // Quitar de atajos
      store.updateNode(existingShortcut.id, { deletedAt: new Date().toISOString() })
      store.updateNode(node.id, { isFavorite: false })
      window.dispatchEvent(new Event('wf:shortcuts-changed'))
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Quitado de atajos', type: 'info' } }))
    } else {
      // Añadir a atajos
      createNodeShortcut(node.id, node.text || 'Sin título')
      store.updateNode(node.id, { isFavorite: true })
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Añadido a atajos: "${(node.text || '').slice(0, 30)}"`, type: 'success' } }))
    }
  }

  async function handleShare() {
    if (!node) return
    // Si ya está publicada, copiar URL
    const existingSlug = node.publicSlug || shareUrl?.split('/p/')[1]
    if (existingSlug) {
      const url = `https://getfrom.app/p/${existingSlug}`
      navigator.clipboard.writeText(url).catch(() => {})
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
      return
    }
    if (getToken()) {
      setIsPublishing(true)
      try {
        const content = node.body || node.text || ''
        const result = await publishNote(node.text || 'Nota', content)
        const url = `https://getfrom.app/p/${result.slug}`
        // Guardar slug en el nodo
        store.updateNode(node.id, { publicSlug: result.slug })
        setShareUrl(url)
        navigator.clipboard.writeText(url).catch(() => {})
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } catch {
        const url = `https://getfrom.app/app/node/${node!.id}`
        navigator.clipboard.writeText(url).catch(() => {})
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } finally {
        setIsPublishing(false)
      }
    } else {
      const url = `https://getfrom.app/app/node/${node!.id}`
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }).catch(() => { prompt('Copia este enlace:', url) })
    }
  }

  async function handleUnpublish() {
    if (!node?.publicSlug) return
    try {
      await unpublishNote(node.publicSlug)
      store.updateNode(node.id, { publicSlug: null })
      setShareUrl('')
    } catch (e) {
      console.error('Unpublish failed', e)
    }
  }

  // ── File upload ────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !node) return
    setUploading(true)
    try {
      const { uploadUrl, key, publicUrl } = await getPresignedUpload(
        file.name,
        file.type || 'application/octet-stream'
      )
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      setAttachments(prev => [...prev, { key, filename: file.name, size: file.size, url: publicUrl }])

      // Guardar URL del archivo como contenido principal del nodo
      // (imagen, PDF o cualquier archivo — el texto del nodo es el nombre)
      const resourceType = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf'
        : 'file'
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(node.extraData || '{}') } catch {}
      ed._resource = true
      ed._resourceUrl = publicUrl
      ed._resourceType = resourceType
      ed._resourceKey = key
      store.updateNode(node.id, { extraData: JSON.stringify(ed), isResource: true })
    } catch (err) {
      console.error('Upload failed', err)
      setAttachmentsAvailable(false)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAttachment(key: string) {
    try {
      await deleteFile(key)
      setAttachments(prev => prev.filter(a => a.key !== key))
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  // ── AI Inline ──────────────────────────────────────────────────────────

  function buildAiContext(context: string): string {
    const hijos = node ? store.children(node.id).slice(0, 3) : []
    return [
      `Nota: "${node?.text || ''}"`,
      `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
      hijos.length > 0 ? `Bullets relacionados:\n${hijos.map(h => '- ' + h.text).join('\n')}` : '',
      '---',
      context,
    ].filter(Boolean).join('\n')
  }


  async function triggerAiInline() {
    if (isAiStreaming || store.isGuest) return
    setIsAiStreaming(true)
    const cursorPos = textareaRef.current?.selectionStart ?? bodyValue.length
    const context = bodyValue.slice(0, cursorPos)
    const contextEnriquecido = buildAiContext(context)
    let aiText = ''
    try {
      const resource = node ? store.findAncestorResource(node.id) : null
      await aiInlineStream(
        contextEnriquecido,
        undefined,
        (chunk) => {
          aiText += chunk
          setBodyValue(prev => {
            const before = prev.slice(0, cursorPos)
            const after = prev.slice(cursorPos)
            return before + aiText + after
          })
        },
        resource ? { resourceUrl: resource.url, resourceKind: resource.kind } : undefined
      )
    } catch (err) {
      if (err instanceof TokensError) { window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } })) } else if (err instanceof Error && err.message !== 'AI_LIMIT') {
        console.error('AI inline error', err)
      }
    } finally {
      setIsAiStreaming(false)
    }
  }

  const hasBody = (node.body && node.body.trim().length > 0) || bodyEditing
  const isLoggedIn = !store.isGuest

  // Recurso principal del nodo (imagen, PDF, URL)
  const nodeResourceMeta = (() => {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (!ed._resource && !ed._resourceUrl) return null
      return {
        url: (ed._resourceUrl || node.resourceUrl) as string | undefined,
        type: (ed._resourceType || node.resourceType) as string | undefined,
      }
    } catch { return null }
  })()

  // Word count for focus mode
  const wordCount = bodyValue.trim() ? bodyValue.trim().split(/\s+/).length : 0
  const progress = wordGoal ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : null

  // ── Body format helpers ────────────────────────────────────────────────

  function applyBodyFormat(prefix: string, suffix?: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = ta.value.slice(start, end)
    const newText = prefix + selected + (suffix || prefix)
    ta.setRangeText(newText, start, end, 'select')
    handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
  }

  function applyLinePrefix(linePrefix: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
    ta.setRangeText(linePrefix, lineStart, lineStart, 'end')
    handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
  }

  function handleImportMarkdown() {
    // body desactivado — importar como nodos hijos
    const md = prompt('Pega el texto markdown a importar:')
    if (md === null) return
    const lines = md.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const siblings = store.children(node!.id)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.siblingOrder)) : 0
    lines.forEach((line, i) => {
      store.createNode({ text: line, parentId: node!.id, siblingOrder: maxOrder + i + 1 })
    })
  }

  // Table of contents: children that are headings
  const headings = s.children(node.id)
    .filter(n => ['h1', 'h2', 'h3'].includes(detectBlockType(n.text)))
    .slice(0, 10)

  // ── Quick actions ──────────────────────────────────────────────────────

  function handleCopyLink() {
    const url = `${window.location.origin}/app/node/${node!.id}`
    navigator.clipboard.writeText(url).then(() => {
      setQuickActionMsg('Enlace copiado')
      setTimeout(() => setQuickActionMsg(null), 2000)
    }).catch(() => {
      prompt('Copia este enlace:', url)
    })
  }

  function handleMoveToDiary() {
    const todayDiary = store.todayDiary()
    if (!todayDiary) {
      setQuickActionMsg('No hay diario hoy')
      setTimeout(() => setQuickActionMsg(null), 2000)
      return
    }
    if (node!.isDiaryEntry) {
      setQuickActionMsg('Ya es una entrada de diario')
      setTimeout(() => setQuickActionMsg(null), 2000)
      return
    }
    const children = store.children(todayDiary.id)
    const maxOrder = children.reduce((max: number, n: Node) => Math.max(max, n.siblingOrder), 0)
    store.createNode({
      text: node!.text || 'Sin título',
      parentId: todayDiary.id,
      siblingOrder: maxOrder + 1000,
    })
    setQuickActionMsg('Añadido al diario de hoy')
    setTimeout(() => setQuickActionMsg(null), 2000)
  }

  function handleDuplicate() {
    const newNode = store.createNode({
      text: (node!.text || 'Sin título') + ' (copia)',
      parentId: node!.parentId || null,
      siblingOrder: node!.siblingOrder + 1,
    })
    if (node!.body) store.updateNode(newNode.id, { body: node!.body })
    if (newNode?.id) {
      navigate(`/node/${newNode.id}`)
    }
    setQuickActionMsg('Nota duplicada')
    setTimeout(() => setQuickActionMsg(null), 2000)
  }

  function handleExportMarkdown() {
    const title = node!.text || 'nota'
    const body = node!.body || ''
    const children = store.children(node!.id)
    const bulletsMd = children.map(c => `- ${c.text}${c.body ? '\n\n  ' + c.body.replace(/\n/g, '\n  ') : ''}`).join('\n')
    const content = `# ${title}\n\n${body}${bulletsMd ? '\n\n## Bullets\n\n' + bulletsMd : ''}\n`
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.slice(0, 40).replace(/[^a-zA-Z0-9áéíóú\s]/g, '').trim()}.md`
    a.click()
    URL.revokeObjectURL(url)
    setQuickActionMsg('✓ Exportado')
    setTimeout(() => setQuickActionMsg(null), 2000)
  }

  // toggleSeguimiento eliminado: ahora vive sólo en NodeRightPanel como botón "Bucle".

  function handleExportPdf() {
    window.print()
  }

  function handleCopyToClipboard() {
    const title = node!.text || 'Sin título'
    const body = node!.body || ''
    const children = store.children(node!.id)
    const bullets = children.map(c => `• ${c.text}`).join('\n')
    const text = [title, body, bullets].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setQuickActionMsg('Copiado al portapapeles')
      setTimeout(() => setQuickActionMsg(null), 2000)
    }).catch(() => {})
  }

  function copyMarkdown() {
    if (!node) return
    function buildMd(parentId: string, depth: number): string {
      return store.children(parentId).filter(n => !n.deletedAt).map(n => {
        const prefix = n.status === 'done' ? '- [x] ' : n.status === 'pending' ? '- [ ] ' : '- '
        const indent = '  '.repeat(depth)
        return indent + prefix + n.text + '\n' + buildMd(n.id, depth + 1)
      }).join('')
    }
    const md = `# ${node.text}\n\n${node.body ? node.body + '\n\n' : ''}${buildMd(node.id, 0)}`
    navigator.clipboard.writeText(md).catch(() => {})
    setQuickActionMsg('✓ Markdown copiado')
    setTimeout(() => setQuickActionMsg(null), 1500)
  }

  function handleDelete() {
    if (!node) return
    const childCount = (() => {
      let count = 0
      const q = [node.id]
      while (q.length) { const id = q.shift()!; count++; store.children(id).forEach(c => q.push(c.id)) }
      return count - 1 // excluir el propio nodo
    })()
    const msg = childCount > 0
      ? `¿Eliminar "${node.text || 'esta nota'}" y sus ${childCount} nota${childCount === 1 ? '' : 's'} hijas? Se moverán a la papelera.`
      : `¿Eliminar "${node.text || 'esta nota'}"? Se moverá a la papelera.`
    if (!window.confirm(msg)) return

    // Navegar primero para evitar re-render sobre nodo borrado
    const today = store.todayDiary()
    if (today) navigate(`/node/${today.id}`, { replace: true })
    else navigate('/', { replace: true })

    // Borrar nodo + todos sus descendientes
    const toDelete: string[] = []
    const q = [node.id]
    while (q.length) {
      const id = q.shift()!
      toDelete.push(id)
      store.children(id).forEach(c => q.push(c.id))
    }
    toDelete.forEach(id => store.deleteNode(id))
  }

  function handlePrint() {
    const title = node!.text || 'Sin título'
    const body = node!.body || ''
    const children = store.children(node!.id)
    const bullets = children.map(c => `• ${c.text}`).join('\n')
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
        .body { white-space: pre-wrap; font-size: 14px; margin-bottom: 24px; }
        .bullets { font-size: 14px; }
        .bullet { margin: 4px 0; }
        @media print { body { margin: 20px; } }
      </style>
      </head><body>
      <h1>${title}</h1>
      <div class="meta">From · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      ${body ? `<div class="body">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
      ${bullets ? `<div class="bullets">${bullets.split('\n').map(b => `<div class="bullet">${b}</div>`).join('')}</div>` : ''}
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Drag & drop de archivos sobre toda la nota
  function handleViewDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  function handleViewDrop(e: React.DragEvent) {
    if (!isLoggedIn) return
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileUpload(fakeEvent)
    })
  }

  return (
    <div
      className={`view node-view node-view--with-context ${focusMode ? 'node-view--focus' : ''} ${nodeLayout === 'wide' ? 'node-view--wide' : ''} ${nodeLayout === 'small' ? 'node-view--small' : ''}`}
      onDragOver={handleViewDragOver}
      onDrop={handleViewDrop}
    >
      <div className="node-view-main">
        {/* In-doc search bar (⌘F) */}
        {showInDocSearch && (
          <div className="in-doc-search-bar">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.5, flexShrink: 0 }}>
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              ref={inDocSearchRef}
              type="text"
              className="in-doc-search-input"
              placeholder="Buscar en esta nota..."
              value={inDocSearch}
              onChange={e => setInDocSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setShowInDocSearch(false); setInDocSearch('') } }}
            />
            {inDocSearch && <span className="in-doc-search-hint">⌘F para cerrar</span>}
            <button className="in-doc-search-close" onClick={() => { setShowInDocSearch(false); setInDocSearch('') }}>×</button>
          </div>
        )}
        {node.publicSlug && (
          <div className="node-published-bar">
            <span className="node-published-icon">👁</span>
            <span className="node-published-label">Pública:</span>
            <a
              href={`https://getfrom.app/p/${node.publicSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="node-published-link"
            >
              getfrom.app/p/{node.publicSlug}
            </a>
            <button
              className="node-published-copy"
              onClick={() => navigator.clipboard.writeText(`https://getfrom.app/p/${node.publicSlug!}`)}
              title="Copiar enlace"
            >
              📋
            </button>
            <button
              className="node-published-copy"
              onClick={() => window.open(`https://getfrom.app/p/${node.publicSlug!}`, '_blank')}
              title="Abrir en nueva pestaña"
            >
              ↗
            </button>
            <button
              className="node-published-unpublish"
              onClick={handleUnpublish}
              title="Despublicar nota"
            >
              Despublicar
            </button>
          </div>
        )}
        {nodeColor && (
          <div className="node-color-band" style={{ background: nodeColor + '20', borderBottom: `2px solid ${nodeColor}` }} />
        )}
        <div className="view-header">
          <div className="breadcrumb-row">
            {(crumbs.length > 0 || diaryTemporalCrumbs.length > 0) && (
              <nav className="breadcrumb">
                {/* Temporal crumbs: Año / Mes / Semana */}
                {diaryTemporalCrumbs.map((c, i) => (
                  <span key={c.label}>
                    {i > 0 && <span className="breadcrumb-sep">/</span>}
                    <button
                      className="breadcrumb-item"
                      onClick={() => diaryDateRef && navigateToTemporalNode(c.type, diaryDateRef)}
                    >
                      {c.label}
                    </button>
                  </span>
                ))}
                {/* Nodos padres: incluye el día diario si la nota es hija de él */}
                {crumbs.map((c, i) => (
                  <span key={c.id}>
                    {(diaryTemporalCrumbs.length > 0 || i > 0) && <span className="breadcrumb-sep">/</span>}
                    <button
                      className="breadcrumb-item"
                      onClick={() => navigate(`/node/${c.id}`)}
                    >
                      {c.text || 'Sin título'}
                    </button>
                  </span>
                ))}
                {/* Self-breadcrumb for temporal nodes: show current node in its own path */}
                {temporalNodeType && (
                  <span>
                    {(crumbs.length > 0 || diaryTemporalCrumbs.length > 0) && <span className="breadcrumb-sep">/</span>}
                    <span className="breadcrumb-item breadcrumb-item--current">{node.text}</span>
                  </span>
                )}
              </nav>
            )}
            {/* Timestamp — extremo derecho de la fila del breadcrumb */}
            <span className="node-updated-at-inline">
              {(() => {
                const d = new Date(node.updatedAt)
                const now = new Date()
                const diff = Math.round((now.getTime() - d.getTime()) / 60000)
                if (diff < 1) return 'Ahora mismo'
                if (diff < 60) return `Hace ${diff} min`
                if (diff < 1440) return `Hace ${Math.round(diff / 60)}h`
                if (diff < 10080) return `Hace ${Math.round(diff / 1440)} días`
                return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
              })()}
            </span>
          </div>

          {/* Node header badges: area, locked (evento ya va inline junto al título) */}
          {(nodeArea || isLocked) && (
            <div className="node-header-badges">
              {nodeArea && <span className="node-badge node-badge--area">📁 {nodeArea}</span>}
              {isLocked && <span className="node-badge node-badge--locked">🔒 Solo lectura</span>}
            </div>
          )}

          <div className="node-title-row">
            {/* Icono del nodo — seguimiento=checkbox, evento=calendario, normal=emoji */}
            {node.isSeguimiento ? (
              // Checkbox cuadrado morado para seguimiento
              <button
                className={`node-seguimiento-title-btn ${node.status === 'done' ? 'done' : ''}`}
                onClick={() => {
                  store.updateNode(node!.id, {
                    status: node.status === 'done' ? null : 'done'
                  })
                }}
                title={node.status === 'done' ? 'Completado — clic para reactivar' : 'Bucle abierto — clic para cerrar'}
              >
                {node.status === 'done' ? (
                  <svg width="28" height="28" viewBox="0 0 28 28">
                    <rect x="2" y="2" width="24" height="24" rx="6" stroke="#22c55e" strokeWidth="2" fill="#22c55e" fillOpacity="0.18"/>
                    <path d="M8 14l4 4 8-8" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 28 28">
                    <rect x="2" y="2" width="24" height="24" rx="6" stroke="var(--accent)" strokeWidth="2" fill="var(--accent)" fillOpacity="0.14"/>
                  </svg>
                )}
              </button>
            ) : node.isEvent ? (
              // Icono calendario para eventos
              <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 4 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <path d="M3 9h18M8 2v4M16 2v4"/>
                  <circle cx="8" cy="14" r="0.8" fill="#3b82f6"/>
                  <circle cx="12" cy="14" r="0.8" fill="#3b82f6"/>
                  <circle cx="16" cy="14" r="0.8" fill="#3b82f6"/>
                </svg>
              </div>
            ) : (() => {
              // Recurso pendiente (sin tarea ni evento): checkbox cian
              try {
                const ed = JSON.parse(node.extraData || '{}')
                if (ed._resource && (ed._resourceStatus || 'pending') === 'pending' && node.status === null && !node.isEvent && !node.isSeguimiento) {
                  return (
                    <button
                      className="bullet-btn task task-sq--resource"
                      onClick={() => {
                        let ed2: Record<string, unknown> = {}
                        try { ed2 = JSON.parse(node.extraData || '{}') } catch {}
                        ed2._resourceStatus = 'done'
                        store.updateNode(node.id, { extraData: JSON.stringify(ed2) })
                      }}
                      title="Marcar recurso como procesado"
                      style={{ flexShrink: 0, marginRight: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 14 14">
                        <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
                      </svg>
                    </button>
                  )
                }
              } catch {}
              return null
            })() ||
            (node.status !== null ? (
              // Checkbox cuadrado para tareas — mismos colores que el outliner
              (() => {
                const isOverdue = !!node.due && node.status !== 'done' && (() => {
                  const now = new Date()
                  return new Date(node.due!) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
                })()
                const sqClass = node.status === 'done' ? 'task-sq--done'
                  : node.status === 'future' ? 'task-sq--future'
                  : isOverdue ? 'task-sq--overdue'
                  : 'task-sq--pending'
                return (
                  <button
                    className={`bullet-btn task ${sqClass}`}
                    onClick={() => store.updateNode(node!.id, { status: node.status === 'done' ? 'pending' : 'done' })}
                    title={node.status === 'done' ? 'Completada — clic para reabrir' : 'Marcar como hecha'}
                    style={{ flexShrink: 0, marginRight: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {node.status === 'done' ? (
                      <svg width="20" height="20" viewBox="0 0 14 14">
                        <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
                        <path d="M3.5 7l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 14 14">
                        <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
                      </svg>
                    )}
                  </button>
                )
              })()
            ) : null) || (() => {
              // ¿Nodo de definición de tag? → mostrar # en color del tag
              try {
                const ed = JSON.parse(node.extraData || '{}')
                if (ed._tagDefinition) {
                  const tagColor = s.tagColor(ed._tagDefinition)
                  return (
                    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 4 }}>
                      <span style={{ fontSize: 26, fontWeight: 800, color: tagColor, lineHeight: 1 }}>#</span>
                    </div>
                  )
                }
              } catch {}
              if (node.isDiaryEntry) return null
              // Si el icono viene del texto (iconSource === 'text'), no mostrar botón de icono
              // porque el emoji ya aparece en el h1 y duplicaría la visualización.
              // Solo mostrar el botón cuando el icono es de extraData o no hay ninguno.
              if (iconSource === 'text') return null
              return (
                <div className="node-icon-wrapper">
                  <button
                    className="node-icon-btn"
                    onClick={() => setShowEmojiPicker(v => !v)}
                    title="Cambiar icono"
                  >
                    {/* Mostrar icono de extraData, o 📄 si no hay ninguno */}
                    {iconSource === 'extra' ? nodeIcon : '📄'}
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={emoji => {
                        setShowEmojiPicker(false)
                        const ed = JSON.parse(node.extraData || '{}')
                        if (emoji) { ed.icon = emoji } else { delete ed.icon }
                        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
              )
            })()}
            <h1
              ref={titleRef}
              className="node-title"
              contentEditable={!isLocked ? 'true' : 'false'}
              suppressContentEditableWarning
              onFocus={() => {
                setTitleEditing(true)
                // Mostrar texto raw para editar (sin HTML de tags)
                if (titleRef.current) {
                  const raw = node?.text || ''
                  titleRef.current.textContent = raw
                  // Cursor al final
                  const range = document.createRange()
                  const sel = window.getSelection()
                  range.selectNodeContents(titleRef.current)
                  range.collapse(false)
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }
              }}
              onInput={isLocked ? undefined : handleTitleInput}
              onBlur={isLocked ? undefined : (e => {
                setTitleEditing(false)
                setShowTitleSlash(false)
                handleTitleInput(e)
              })}
              onKeyDown={isLocked ? undefined : (e => {
                // Tag picker navigation
                if (titleTagPicker) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setTitleTagPicker(p => p ? { ...p, activeIdx: Math.min(p.activeIdx + 1, p.items.length - 1) } : p)
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setTitleTagPicker(p => p ? { ...p, activeIdx: Math.max(p.activeIdx - 1, 0) } : p)
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    applyTitleTag(titleTagPicker.items[titleTagPicker.activeIdx])
                    return
                  }
                  if (e.key === 'Escape') {
                    setTitleTagPicker(null)
                    return
                  }
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const firstNodeText = document.querySelector('.outliner-container .node-text') as HTMLElement | null
                  if (firstNodeText) {
                    firstNodeText.focus()
                  } else {
                    // Crear primer hijo y enfocarlo — nunca abrir el body editor
                    if (id) {
                      const newChild = store.createNode({ text: '', parentId: id, siblingOrder: 1 })
                      setTimeout(() => {
                        const el = document.querySelector(`[data-node-id="${newChild.id}"] [contenteditable]`) as HTMLElement | null
                        el?.focus()
                      }, 50)
                    }
                  }
                }
                if (e.key === 'Escape') {
                  setShowTitleSlash(false)
                  setTitleSlashQuery('')
                  setTitleTagPicker(null)
                }
              })}
              onContextMenu={e => {
                e.preventDefault()
                setTitleContextMenu({ x: e.clientX, y: e.clientY })
              }}
            >
              {/* content managed via useEffect — no React children to avoid cursor reset */}
            </h1>

            {/* Badge inline del evento — a la derecha del título */}
            {node.isEvent && node.due && (() => {
              const due = node.due
              const dueEnd = node.dueEnd
              const dateStr = new Date(due).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
              const timeStr = hasLocalTime(due) ? isoToLocalTime(due) : ''
              const endTimeStr = dueEnd && hasLocalTime(dueEnd) ? '–' + isoToLocalTime(dueEnd) : ''
              let loc = ''
              try { loc = JSON.parse(node.extraData || '{}').location || '' } catch {}
              return (
                <span className="node-event-inline-badge">
                  {dateStr}{timeStr ? ' · ' + timeStr : ''}{endTimeStr}{loc ? ' · 📍 ' + loc : ''}
                </span>
              )
            })()}

            {showTitleSlash && (
              <SlashMenu
                anchorEl={titleRef.current}
                query={titleSlashQuery}
                onSelect={({ prefix, action }) => {
                  setShowTitleSlash(false)
                  setTitleSlashQuery('')
                  if (!titleRef.current) return
                  const currentText = titleRef.current.textContent || ''
                  // Remove the slash+query from the text
                  const sel = window.getSelection()
                  const pos = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).endOffset : currentText.length
                  const before = currentText.slice(0, pos)
                  const slashIdx = before.lastIndexOf('/')
                  const cleanContent = (slashIdx >= 0 ? currentText.slice(0, slashIdx) : currentText).trimEnd()
                  const newText = prefix + cleanContent.trimStart()
                  store.updateNode(node!.id, { text: newText, ...(action === 'task' ? { status: 'pending' } : {}) })
                  titleRef.current.textContent = newText
                  setTitleEditing(false)
                }}
                onClose={() => { setShowTitleSlash(false); setTitleSlashQuery('') }}
              />
            )}
            {/* Tag picker del título — mismo estilo que el inline-picker del outliner */}
            {titleTagPicker && titleTagPickerPos && createPortal(
              <div
                className="inline-picker"
                style={{ position: 'fixed', top: titleTagPickerPos.top, left: titleTagPickerPos.left, zIndex: 1000 }}
                onMouseDown={e => e.preventDefault()}
              >
                {titleTagPicker.items.map((tag, idx) => (
                  <button
                    key={tag}
                    className={`inline-picker-item ${idx === titleTagPicker.activeIdx ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyTitleTag(tag) }}
                  >
                    <span className="inline-picker-icon">#</span>
                    <span className="inline-picker-content">
                      <span className="inline-picker-label">{tag}</span>
                    </span>
                  </button>
                ))}
              </div>,
              document.body
            )}
            <div className="node-title-actions">
              {/* View mode switcher — visible en todos los nodos incluidas notas diarias y mensuales */}
              {(() => {
                const hasMultiViews = store.getViews(node.id).length > 0
                if (hasMultiViews) return null  // los tabs abajo se encargan
                const modes = [
                  { id: 'lista', title: 'Lista', svg: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg> },
                  { id: 'tabla', title: 'Tabla', svg: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><line x1="1" y1="13" x2="15" y2="13"/><line x1="5" y1="5" x2="5" y2="15"/><line x1="10" y1="5" x2="10" y2="15"/></svg> },
                  { id: 'kanban', title: 'Kanban', svg: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4" height="14" rx="1"/><rect x="6" y="1" width="4" height="10" rx="1"/><rect x="11" y="1" width="4" height="12" rx="1"/></svg> },
                  { id: 'calendario', title: 'Calendario', svg: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="13" rx="1"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/></svg> },
                ]
                return (
                  <>
                    <div className="node-view-modes">
                      {modes.map(m => (
                        <button
                          key={m.id}
                          className={`node-view-mode-btn ${viewBlock === m.id ? 'active' : ''}`}
                          onClick={() => setViewBlock(m.id)}
                          title={m.title}
                        >
                          {m.svg}
                        </button>
                      ))}
                    </div>
                    <div className="node-toolbar-sep" />
                  </>
                )
              })()}
              {/* ── Pin (Atajo) — añade/quita de 📌 Atajos ── */}
              {(() => {
                const atajosNode = getAtajosNode()
                const isPinned = node.isFavorite || !!(atajosNode && store.children(atajosNode.id).find(n => {
                  try { return JSON.parse(n.extraData || '{}')._shortcutNodeId === node.id } catch { return false }
                }))
                return (
              <button
                className={`node-action-icon-btn ${isPinned ? 'active' : ''}`}
                onClick={toggleFavorite}
                title={isPinned ? 'Quitar de atajos' : 'Añadir a atajos'}
                style={{ color: isPinned ? 'var(--accent)' : undefined }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={node.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                </svg>
              </button>
                )
              })()}

              {/* ── Publicar (Globe) — igual que Mac ── */}
              <div style={{ position: 'relative' }}>
                <button
                  className={`node-action-icon-btn ${node.publicSlug || shareUrl ? 'active' : ''}`}
                  onClick={() => (node.publicSlug || shareUrl) ? handleShare() : setShowShareMenu(v => !v)}
                  title={(node.publicSlug || shareUrl) ? 'Publicada — copiar enlace' : 'Publicar nota'}
                  style={{ color: (node.publicSlug || shareUrl) ? '#22c55e' : undefined }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </button>
                {shareCopied && <span className="node-share-tooltip">¡Enlace copiado!</span>}
                {showShareMenu && (
                  <div className="node-share-menu">
                    <button onClick={() => { handleShare(); setShowShareMenu(false) }}>🌐 Publicar y copiar enlace</button>
                    <button onClick={() => { handleCopyLink(); setShowShareMenu(false) }}>🔗 Copiar enlace interno</button>
                  </div>
                )}
              </div>

              {/* (Antes había un ● para abrir/cerrar bucle aquí. Movido al
                  panel derecho como botón "Bucle" para evitar confusión con
                  tareas y para que no se pueda agendar). */}

              {/* ── ··· Más opciones ── */}
              <div style={{ position: 'relative' }}>
                <button
                  className={`node-action-icon-btn ${(showMoreMenu || titleContextMenu) ? 'active' : ''}`}
                  onClick={e => {
                    if (document.querySelector('.wf-layout')) {
                      // En WF mode: abrir NodeContextMenu igual que cualquier nodo
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTitleContextMenu({ x: rect.left, y: rect.bottom + 4 })
                    } else {
                      setShowMoreMenu(v => !v)
                    }
                  }}
                  title="Más opciones"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/>
                  </svg>
                </button>
                {showMoreMenu && (
                  <div className="node-more-menu" onClick={() => setShowMoreMenu(false)}>
                    {/* Mover a… */}
                    <button className="node-more-item" onClick={() => setShowMoveModal(true)}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 10h10M10 5l5 5-5 5"/></svg>
                      Mover a…
                    </button>
                    <div className="node-more-sep"/>
                    {/* Copiar */}
                    <span className="node-more-section">Copiar</span>
                    <button className="node-more-item" onClick={copyMarkdown}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3M8 4h7a1 1 0 011 1v7"/></svg>
                      Copiar Markdown
                    </button>
                    <button className="node-more-item" onClick={handleCopyToClipboard}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3M8 4h7a1 1 0 011 1v7"/></svg>
                      Copiar texto plano
                    </button>
                    <div className="node-more-sep"/>
                    {/* Exportar */}
                    <span className="node-more-section">Exportar</span>
                    <button className="node-more-item" onClick={handleExportMarkdown}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16h12M10 3v10M6 9l4 4 4-4"/></svg>
                      Exportar Markdown
                    </button>
                    <button className="node-more-item" onClick={handleExportPdf}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16h12M10 3v10M6 9l4 4 4-4"/></svg>
                      Exportar PDF
                    </button>
                    <div className="node-more-sep"/>
                    <button className="node-more-item" onClick={handleDuplicate}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="6" width="11" height="11" rx="2"/><path d="M4 14H3a1 1 0 01-1-1V3a1 1 0 011-1h10a1 1 0 011 1v1"/></svg>
                      Duplicar
                    </button>
                    <button className="node-more-item" onClick={handlePrint}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 7V3h10v4M5 15H3a1 1 0 01-1-1V9a1 1 0 011-1h14a1 1 0 011 1v5a1 1 0 01-1 1h-2M5 12h10v5H5z"/></svg>
                      Imprimir
                    </button>
                    {/* Notas temporales (año/mes/semana) y diarios NO se pueden eliminar */}
                    {!node.isDiaryEntry && !temporalNodeType && (
                      <>
                        <div className="node-more-sep"/>
                        <button className="node-more-item node-more-item--danger" onClick={handleDelete}>
                          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h14M8 6V4h4v2M19 6l-1 12a2 2 0 01-2 2H4a2 2 0 01-2-2L1 6"/></svg>
                          Eliminar nota
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Focus mode word counter */}
          {focusMode && (
            <div className="focus-word-counter">
              <span className={`focus-word-count ${wordGoal && wordCount >= wordGoal ? 'focus-word-count--goal-met' : ''}`}>
                {wordCount} palabras
              </span>
              {wordGoal ? (
                <>
                  <div className="focus-progress-bar">
                    <div className="focus-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="focus-goal-label">/{wordGoal} ({progress}%)</span>
                  <button className="focus-goal-clear" onClick={() => setWordGoal(null)}>×</button>
                </>
              ) : (
                <button className="focus-goal-btn" onClick={() => {
                  const g = parseInt(prompt('Meta de palabras (ej: 500):', '') || '0')
                  if (g > 0) setWordGoal(g)
                }}>
                  + Meta
                </button>
              )}
            </div>
          )}



          {/* Locked badge */}
          {isLocked && (
            <div className="node-locked-badge">🔒 Nota bloqueada — solo lectura</div>
          )}

        </div>

        <div className="view-body">
          {/* ── Recurso principal (imagen / PDF / URL) ── */}
          {nodeResourceMeta?.url && (
            <div className="node-resource-preview">
              {nodeResourceMeta.type === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(nodeResourceMeta.url) ? (
                <img
                  src={nodeResourceMeta.url}
                  alt={node.text || ''}
                  className="node-resource-image"
                  onClick={() => window.open(nodeResourceMeta.url, '_blank')}
                />
              ) : nodeResourceMeta.type === 'pdf' || /\.pdf$/i.test(nodeResourceMeta.url) ? (
                <iframe
                  src={nodeResourceMeta.url}
                  className="node-resource-pdf"
                  title={node.text || 'PDF'}
                />
              ) : (
                /* URL / enlace genérico */
                <a
                  href={nodeResourceMeta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="node-resource-link"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/>
                    <path d="M10 2h4v4"/><path d="M14 2L8 8"/>
                  </svg>
                  {nodeResourceMeta.url}
                </a>
              )}
            </div>
          )}

          {/* Body editor — desactivado, en From todo va en nodos hijos */}
          {false && <div className="node-body-editor">
            {bodyEditing && !isLocked ? (
              <>
                <div className="node-body-toolbar">
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyBodyFormat('**') }}
                    title="Negrita"
                  ><strong>B</strong></button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyBodyFormat('*') }}
                    title="Cursiva"
                  ><em>I</em></button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyBodyFormat('`') }}
                    title="Código"
                  >&lt;&gt;</button>
                  <span className="node-body-toolbar-sep" />
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyLinePrefix('- ') }}
                    title="Lista con viñeta"
                  >•</button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyLinePrefix('1. ') }}
                    title="Lista numerada"
                  >1.</button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyLinePrefix('> ') }}
                    title="Cita"
                  >&gt;</button>
                  <span className="node-body-toolbar-sep" />
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyLinePrefix('# ') }}
                    title="Encabezado H1"
                  >H1</button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => { e.preventDefault(); applyLinePrefix('## ') }}
                    title="Encabezado H2"
                  >H2</button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => {
                      e.preventDefault()
                      const ta = textareaRef.current
                      if (!ta) return
                      const pos = ta.selectionStart
                      const insertion = '\n---\n'
                      ta.setRangeText(insertion, pos, pos, 'end')
                      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
                    }}
                    title="Línea divisoria"
                  >---</button>
                  <button
                    className="node-body-toolbar-btn"
                    onMouseDown={e => {
                      e.preventDefault()
                      const ta = textareaRef.current
                      if (!ta) return
                      const pos = ta.selectionStart
                      const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1
                      ta.setRangeText('- [ ] ', lineStart, lineStart, 'end')
                      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
                    }}
                    title="Checkbox"
                  >[ ]</button>
                  <button
                    className="node-body-toolbar-btn"
                    title="Insertar tabla"
                    onMouseDown={e => {
                      e.preventDefault()
                      const tableTemplate = '\n| Columna 1 | Columna 2 | Columna 3 |\n|-----------|-----------|----------|\n| Dato      | Dato      | Dato      |\n| Dato      | Dato      | Dato      |\n'
                      const ta = textareaRef.current
                      if (!ta) return
                      const pos = ta.selectionStart
                      ta.setRangeText(tableTemplate, pos, pos, 'end')
                      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
                    }}
                  >⊞</button>
                  <button
                    className="node-body-toolbar-btn"
                    title="Importar markdown"
                    onMouseDown={e => { e.preventDefault(); handleImportMarkdown() }}
                  >📥</button>
                  <button className="node-body-toolbar-btn" title="Bloque de código (```)"
                    onMouseDown={e => {
                      e.preventDefault()
                      const ta = textareaRef.current
                      if (!ta) return
                      const pos = ta.selectionStart
                      const codeBlock = '\n```js\n\n```\n'
                      ta.setRangeText(codeBlock, pos, pos, 'end')
                      const newPos = pos + 6
                      setTimeout(() => {
                        if (ta) { ta.selectionStart = newPos; ta.selectionEnd = newPos }
                      }, 0)
                      handleBodyChange({ target: ta } as React.ChangeEvent<HTMLTextAreaElement>)
                    }}
                  >&lt;/&gt;</button>
                </div>
                <textarea
                  ref={textareaRef}
                  className={`node-body-textarea ${isAiStreaming ? 'ai-streaming' : ''}`}
                  value={bodyValue}
                  onChange={handleBodyChange}
                  onBlur={handleBodyBlur}
                  onKeyDown={handleBodyKeyDown}
                  placeholder={isAiStreaming ? '✨ IA generando...' : 'Añade una descripción o notas... (IA en el outliner: Espacio al inicio)'}
                  rows={Math.max(4, bodyValue.split('\n').length + 1)}
                />
                {isAiStreaming && (
                  <span className="ai-streaming-hint">✨ IA generando...</span>
                )}
                {isLoggedIn && !isAiStreaming && (
                  <button
                    className="ai-inline-trigger-btn"
                    onClick={triggerAiInline}
                    title="Completar con IA"
                    tabIndex={-1}
                  >
                    ✨
                  </button>
                )}
                <span className="node-body-wordcount">
                  {bodyValue.trim() ? `${bodyValue.trim().split(/\s+/).length} palabras · ${bodyValue.length} chars` : ''}
                </span>
              </>
            ) : (
              <div
                className={`node-body-rendered ${!hasBody ? 'node-body-empty' : ''}`}
                onDoubleClick={isLocked ? undefined : () => {
                  setBodyEditing(true)
                  setBodyValue(node?.body || '')
                }}
              >
                {hasBody ? (
                  // Render body — agrupar líneas en bloques para listas, checkboxes y tablas
                  (() => {
                    const lines = (node?.body || '').split('\n')
                    const blocks: React.ReactNode[] = []
                    let i = 0
                    while (i < lines.length) {
                      const line = lines[i]

                      // Code block: ```
                      if (line.startsWith('```')) {
                        const lang = line.slice(3).trim()
                        const codeLines: string[] = []
                        i++
                        while (i < lines.length && !lines[i].startsWith('```')) {
                          codeLines.push(lines[i])
                          i++
                        }
                        i++ // skip closing ```
                        blocks.push(
                          <pre key={`code-${i}`} className="body-block-code">
                            {lang && <span className="body-code-lang">{lang}</span>}
                            <code>{codeLines.join('\n')}</code>
                          </pre>
                        )
                        continue
                      }

                      // Table: line starts with | and next line is separator (---|)
                      if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
                        const tableLines: string[] = [line]
                        i++
                        while (i < lines.length && lines[i].trim().startsWith('|')) {
                          tableLines.push(lines[i])
                          i++
                        }
                        const headerLine = tableLines[0]
                        const bodyLines = tableLines.slice(2) // skip separator line
                        const headers = headerLine.split('|').filter(c => c.trim()).map(c => c.trim())
                        blocks.push(
                          <div key={`table-${i}`} className="body-block-table-wrapper">
                            <table className="body-block-table">
                              <thead>
                                <tr>{headers.map((h, j) => <th key={j} className="body-table-th"><InlineRenderer text={h} /></th>)}</tr>
                              </thead>
                              <tbody>
                                {bodyLines.map((row, ri) => {
                                  const cells = row.split('|').filter(c => c.trim() !== '' && !c.trim().match(/^-+$/)).map(c => c.trim())
                                  return (
                                    <tr key={ri}>
                                      {cells.map((cell, ci) => <td key={ci} className="body-table-td"><InlineRenderer text={cell} /></td>)}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                        continue
                      }

                      // Checkbox
                      if (/^- \[[ xX]\] /.test(line)) {
                        const checked = line[3] === 'x' || line[3] === 'X'
                        const text = line.slice(6)
                        blocks.push(
                          <div key={i} className="body-block-checkbox">
                            <input
                              type="checkbox"
                              checked={checked}
                              readOnly
                              className="body-block-checkbox-input"
                            />
                            <span className={checked ? 'body-block-checkbox-text--done' : ''}>
                              <InlineRenderer text={text} />
                            </span>
                          </div>
                        )
                        i++
                        continue
                      }

                      // Bullet list group
                      if (/^(\s*)([-*])\s/.test(line) && !/^- \[[ xX]\] /.test(line)) {
                        const items: React.ReactNode[] = []
                        while (i < lines.length && /^(\s*)([-*])\s/.test(lines[i]) && !/^- \[[ xX]\] /.test(lines[i])) {
                          items.push(<li key={i} className="body-block-li"><InlineRenderer text={lines[i].replace(/^(\s*)([-*])\s/, '')} /></li>)
                          i++
                        }
                        blocks.push(<ul key={`ul-${i}`} className="body-block-ul">{items}</ul>)
                        continue
                      }

                      // Numbered list group
                      if (/^\d+\.\s/.test(line)) {
                        const items: React.ReactNode[] = []
                        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                          items.push(<li key={i} className="body-block-li body-block-li--num"><InlineRenderer text={lines[i].replace(/^\d+\.\s/, '')} /></li>)
                          i++
                        }
                        blocks.push(<ol key={`ol-${i}`} className="body-block-ol">{items}</ol>)
                        continue
                      }

                      // Other block types
                      if (!line.trim()) { blocks.push(<br key={i} />); i++; continue }
                      if (line === '---') { blocks.push(<hr key={i} className="block-divider" />); i++; continue }
                      if (line.startsWith('# ')) { blocks.push(<h1 key={i} className="body-block-h1"><InlineRenderer text={line.slice(2)} /></h1>); i++; continue }
                      if (line.startsWith('## ')) { blocks.push(<h2 key={i} className="body-block-h2"><InlineRenderer text={line.slice(3)} /></h2>); i++; continue }
                      if (line.startsWith('### ')) { blocks.push(<h3 key={i} className="body-block-h3"><InlineRenderer text={line.slice(4)} /></h3>); i++; continue }
                      if (line.startsWith('> ')) { blocks.push(<blockquote key={i} className="body-block-quote"><InlineRenderer text={line.slice(2)} /></blockquote>); i++; continue }
                      blocks.push(<p key={i} className="node-body-line"><InlineRenderer text={line} /></p>)
                      i++
                    }
                    return blocks
                  })()
                ) : null}
              </div>
            )}
          </div>}

          {/* Hidden file input */}
          {isLoggedIn && (
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          )}

          {/* File attachments — only for logged-in users */}
          {isLoggedIn && (
            <div className="node-attachments">
              {!attachmentsAvailable ? null : (
                <>
                  {(attachments.length > 0 || uploading) && (
                    <div className="node-attachments-header">
                      <span>📎 Archivos adjuntos</span>
                      <button
                        className="node-attachments-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Subiendo...' : '+ Adjuntar'}
                      </button>
                    </div>
                  )}
                  {attachments.map(att => (
                    <div key={att.key} className={`attachment-item${isImage(att.filename) ? ' attachment-item--image' : ''}`}>
                      {isImage(att.filename) ? (
                        <img
                          src={att.url}
                          alt={att.filename}
                          className="attachment-image-preview"
                          onClick={() => window.open(att.url, '_blank')}
                        />
                      ) : (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-name"
                          title={att.filename}
                        >
                          {att.filename}
                        </a>
                      )}
                      <span className="attachment-size">{formatBytes(att.size)}</span>
                      <button
                        className="attachment-delete-btn"
                        onClick={() => handleDeleteAttachment(att.key)}
                        title="Eliminar"
                        aria-label="Eliminar adjunto"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {headings.length >= 3 && (
            <div className="node-toc">
              <div className="node-toc-title">Tabla de contenidos</div>
              {headings.map(h => {
                const type = detectBlockType(h.text)
                const text = h.text.replace(/^#{1,3}\s/, '')
                return (
                  <button
                    key={h.id}
                    className={`node-toc-item node-toc-item--${type}`}
                    onClick={() => document.querySelector(`[data-node-id="${h.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  >
                    {text}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Controles de nodos especiales (agentes, atajos, plantillas…) ── */}
          {/* Se muestran entre el título y los hijos, mismo estilo que Agenda */}
          <NodeSpecialControls node={node} />

          {/* En WF mode, nodos temporales usan WFTemporalView + outliner libre.
              En modo normal, usan los bloques originales de From. */}
          {(() => {
            const isWFMode = !!document.querySelector('.wf-layout')
            const isWFTemporal = isWFMode && (temporalNodeType === 'year' || temporalNodeType === 'month')

            return (
              <>
                {/* ── Modo WF: temporal nodes ── */}
                {isWFTemporal && (
                  <WFTemporalView node={node} temporalType={temporalNodeType as 'year' | 'month'} />
                )}
                {/* Diary entry en WF mode: temporal view por defecto, DiaryTimeline en vista calendario */}
                {isWFMode && node.isDiaryEntry && viewKind !== 'calendar' && (
                  <WFTemporalView node={node} temporalType="diary" />
                )}
                {isWFMode && node.isDiaryEntry && viewKind === 'calendar' && (
                  <NodeCalendarView parentId={node.id} />
                )}

                {/* ── Modo normal (no WF): bloques originales ── */}
                {!isWFMode && (
                  <>
                    {!node.isDiaryEntry && store.getViews(node.id).length > 0 && (
                      <NodeViewTabs
                        parentId={node.id}
                        activeViewId={activeViewId}
                        onSelect={handleSelectView}
                      />
                    )}
                    {temporalNodeType && (
                      <TemporalChildrenBlock
                        node={node}
                        type={temporalNodeType}
                        onNavigate={(id) => navigate(`/node/${id}`)}
                      />
                    )}
                    {viewKind === 'table' && !node.isDiaryEntry && <NodeTableView parentId={node.id} />}
                    {viewKind === 'kanban' && !node.isDiaryEntry && <NodeKanbanView parentId={node.id} />}
                    {viewKind === 'calendar' && !node.isDiaryEntry && <NodeCalendarView parentId={node.id} />}
                  </>
                )}

                {/* ── Vistas no-temporales en WF (tabla, kanban, cal) — se mantienen ── */}
                {isWFMode && !isWFTemporal && !node.isDiaryEntry && (
                  <>
                    {!node.isDiaryEntry && store.getViews(node.id).length > 0 && (
                      <NodeViewTabs parentId={node.id} activeViewId={activeViewId} onSelect={handleSelectView} />
                    )}
                    {viewKind === 'table' && <NodeTableView parentId={node.id} />}
                    {viewKind === 'kanban' && <NodeKanbanView parentId={node.id} />}
                    {viewKind === 'calendar' && <NodeCalendarView parentId={node.id} />}
                  </>
                )}

                {/* ── Eventos de Google Calendar (solo en notas diarias con GCal conectado) ── */}
                {/* GCal events son ahora nodos normales del outliner — no hay bloque especial */}

                {/* ── Outliner: visible en lista/temporal; oculto en tabla/kanban/calendario ── */}
                {/* También oculto cuando el diary muestra DiaryTimeline (vista calendario) */}
                <div className={`outliner-section${
                  (viewKind !== 'list' && !node.isDiaryEntry && !(isWFMode && isWFTemporal))
                  || (node.isDiaryEntry && viewKind === 'calendar')
                    ? ' outliner-section--hidden'
                    : ''
                }`}>
                  <Outliner
                    parentId={node.id}
                    autoFocusEmpty
                    placeholder="Añade contenido…"
                    filterText={smartFilterResult ? undefined : (activeFilterQuery || undefined)}
                    filterMatchIds={smartFilterResult?.matchIds}
                    filterAncestorIds={smartFilterResult?.ancestorIds}
                    temporalSort={isWFTemporal ? temporalNodeType as 'year' | 'month' : undefined}
                    disableLocalFilter
                  />
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {showChat && (
        <NodeChatPanel
          node={node}
          onClose={() => setShowChat(false)}
        />
      )}


      {/* Modal: editar evento de Google Calendar */}
      {editingGCalEvent && (
        <GCalEventEditor
          event={editingGCalEvent}
          modal
          onClose={() => setEditingGCalEvent(null)}
          onUpdated={updated => {
            setGcalEvents(prev => prev.map(x => x.id === updated.id ? updated : x))
            setEditingGCalEvent(null)
          }}
          onDeleted={id => {
            setGcalEvents(prev => prev.filter(x => x.id !== id))
            setEditingGCalEvent(null)
          }}
        />
      )}

      {/* Modal: Mover a… */}
      {showMoveModal && (
        <MoveNodeModal
          node={node}
          onClose={() => setShowMoveModal(false)}
        />
      )}

      {/* NodeContextMenu del título — WF mode */}
      {titleContextMenu && (
        <NodeContextMenu
          node={node}
          x={titleContextMenu.x}
          y={titleContextMenu.y}
          onClose={() => setTitleContextMenu(null)}
          onNavigate={navId => { navigate(`/node/${navId}`); setTitleContextMenu(null) }}
          onSelect={() => setTitleContextMenu(null)}
        />
      )}
    </div>
  )
}
