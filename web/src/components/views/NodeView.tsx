import { useParams, useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import Outliner from '../outliner/Outliner'
import InlineRenderer, { detectBlockType } from '../outliner/InlineRenderer'
import NodePropertiesPanel from '../panels/NodePropertiesPanel'
import NodeContextPanel from '../panels/NodeContextPanel'
import NodeChatPanel from '../panels/NodeChatPanel'
import { recordRecentNode } from '../CommandPalette'
import type { Node } from '../../types'
import { getPresignedUpload, getFilesForNode, deleteFile, aiInlineStream, publishNote, unpublishNote, getToken } from '../../api/client'
import EmojiPicker from '../EmojiPicker'

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

export default function NodeView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const s = useStore()
  const node = id ? s.getNode(id) : undefined

  const [bodyEditing, setBodyEditing] = useState(false)
  const [bodyValue, setBodyValue] = useState('')
  const [showProperties, setShowProperties] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
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

  // Quick actions bar state
  const [quickActionMsg, setQuickActionMsg] = useState<string | null>(null)

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Chat panel state
  const [showChat, setShowChat] = useState(false)

  // Focus mode word goal state
  const [wordGoal, setWordGoal] = useState<number | null>(null)

  // Record recent visit
  useEffect(() => {
    if (id) recordRecentNode(id)
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
        setShowProperties(v => !v)
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

  // Icono del nodo (extraData.icon)
  const nodeIcon = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').icon || null } catch { return null }
  }, [node?.extraData])

  // Color del nodo (extraData.color)
  const nodeColor = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').color || null } catch { return null }
  }, [node?.extraData])

  // Lock state
  const isLocked = useMemo(() => {
    try { return JSON.parse(node?.extraData || '{}').locked === true } catch { return false }
  }, [node?.extraData])

  if (!node || node.deletedAt) {
    return <div className="view-empty">Nodo no encontrado</div>
  }

  // Breadcrumb: walk up the parent chain
  const crumbs: { id: string; text: string }[] = []
  let cur = node
  while (cur.parentId) {
    const parent = s.getNode(cur.parentId)
    if (!parent) break
    crumbs.unshift({ id: parent.id, text: parent.text || 'Sin título' })
    cur = parent
  }

  function handleTitleInput(e: React.FormEvent<HTMLHeadingElement>) {
    const text = e.currentTarget.textContent || ''
    store.updateNode(node!.id, { text })
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setBodyValue(value)
    if (bodyDebounceRef.current) clearTimeout(bodyDebounceRef.current)
    bodyDebounceRef.current = setTimeout(() => {
      store.updateNode(node!.id, { body: value || null })
    }, 500)
  }

  function handleBodyBlur() {
    setBodyEditing(false)
    // Flush debounce
    if (bodyDebounceRef.current) {
      clearTimeout(bodyDebounceRef.current)
      bodyDebounceRef.current = null
    }
    store.updateNode(node!.id, { body: bodyValue || null })
  }

  function toggleFavorite() {
    store.updateNode(node!.id, { isFavorite: !node!.isFavorite })
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
          }
        )
      } catch (err) {
        if (err instanceof Error && err.message !== 'AI_LIMIT') {
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

  async function triggerAiInline() {
    if (isAiStreaming || store.isGuest) return
    setIsAiStreaming(true)
    const cursorPos = textareaRef.current?.selectionStart ?? bodyValue.length
    const context = bodyValue.slice(0, cursorPos)
    const contextEnriquecido = buildAiContext(context)
    let aiText = ''
    try {
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
        }
      )
    } catch (err) {
      if (err instanceof Error && err.message !== 'AI_LIMIT') {
        console.error('AI inline error', err)
      }
    } finally {
      setIsAiStreaming(false)
    }
  }

  const hasBody = (node.body && node.body.trim().length > 0) || bodyEditing
  const isLoggedIn = !store.isGuest

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
    const md = prompt('Pega el texto markdown a importar:')
    if (md === null) return
    const trimmed = md.trim()
    if (!trimmed) return
    const current = bodyValue
    const separator = current.trim() ? '\n\n' : ''
    const newVal = current + separator + trimmed
    setBodyValue(newVal)
    store.updateNode(node!.id, { body: newVal })
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

  return (
    <div className={`view node-view node-view--with-context ${showProperties ? 'node-view--with-panel' : ''} ${focusMode ? 'node-view--focus' : ''}`}>
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
          {crumbs.length > 0 && (
            <nav className="breadcrumb">
              <button className="breadcrumb-home" onClick={() => navigate('/')}>Inicio</button>
              <button
                className="breadcrumb-root-btn"
                onClick={() => navigate(`/node/${crumbs[0].id}`)}
                title="Ir al nodo raíz"
              >
                ⇑
              </button>
              {crumbs.map((c) => (
                <span key={c.id}>
                  <span className="breadcrumb-sep">/</span>
                  <button
                    className="breadcrumb-item"
                    onClick={() => navigate(`/node/${c.id}`)}
                  >
                    {c.text || 'Sin título'}
                  </button>
                </span>
              ))}
            </nav>
          )}

          <div className="node-title-row">
            {/* Icono del nodo */}
            <div className="node-icon-wrapper">
              <button
                className="node-icon-btn"
                data-has-icon={nodeIcon ? 'true' : 'false'}
                onClick={() => setShowEmojiPicker(v => !v)}
                title="Añadir icono"
              >
                {nodeIcon || '✦'}
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={emoji => {
                    setShowEmojiPicker(false)
                    const ed = JSON.parse(node.extraData || '{}')
                    if (emoji) {
                      ed.icon = emoji
                    } else {
                      delete ed.icon
                    }
                    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
            <h1
              ref={titleRef}
              className="node-title"
              contentEditable={!isLocked ? 'true' : 'false'}
              suppressContentEditableWarning
              onInput={isLocked ? undefined : handleTitleInput}
              onBlur={isLocked ? undefined : handleTitleInput}
            >
              {node.text || ''}
            </h1>
            <div className="node-title-actions">
              {isLoggedIn && (
                <button
                  className="node-fav-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar archivo"
                  aria-label="Adjuntar archivo"
                  style={{ fontSize: '15px' }}
                >
                  📎
                </button>
              )}
              <button
                className={`node-fav-btn ${node.isFavorite ? 'active' : ''}`}
                onClick={toggleFavorite}
                title={node.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                aria-label="Favorito"
              >
                {node.isFavorite ? '★' : '☆'}
              </button>
              <div className="node-share-wrapper">
                <button
                  className="node-share-btn"
                  onClick={handleShare}
                  title="Compartir enlace"
                  aria-label="Compartir"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4.5 7L10.5 4M4.5 9L10.5 12" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
                {shareCopied && (
                  <span className="node-share-tooltip">¡Enlace copiado!</span>
                )}
              </div>
              <button
                className={`node-props-btn ${showProperties ? 'active' : ''}`}
                onClick={() => setShowProperties(v => !v)}
                title="Propiedades (⌘P)"
                aria-label="Propiedades"
              >
                ⋯
              </button>
              <button
                className={`node-props-btn ${focusMode ? 'active' : ''}`}
                onClick={() => setFocusMode(v => !v)}
                title="Modo foco"
                aria-label="Modo foco"
              >
                {focusMode ? '⊠' : '⊡'}
              </button>
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

          {/* Quick actions bar — visible on hover of .node-title-row */}
          <div className="node-quick-actions">
            <button className="node-quick-action-btn" onClick={handleCopyLink} title="Copiar enlace a este nodo">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1.5v1a3.5 3.5 0 0 1-3.5 3.5H4A3.5 3.5 0 0 1 .5 12V6A3.5 3.5 0 0 1 4 2.5h1V4H4z"/>
                <path d="M7.5 1h4A2.5 2.5 0 0 1 14 3.5v4A2.5 2.5 0 0 1 11.5 10h-4A2.5 2.5 0 0 1 5 7.5v-4A2.5 2.5 0 0 1 7.5 1zm0 1.5A1 1 0 0 0 6.5 3.5v4A1 1 0 0 0 7.5 8.5h4A1 1 0 0 0 12.5 7.5v-4A1 1 0 0 0 11.5 2.5h-4z"/>
              </svg>
              Copiar enlace
            </button>
            {!node.isDiaryEntry && (
              <button className="node-quick-action-btn" onClick={handleMoveToDiary} title="Añadir al diario de hoy">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1H2zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5z"/>
                  <path d="M8 7.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V12a.5.5 0 0 1-1 0v-1.5H6a.5.5 0 0 1 0-1h1.5V8a.5.5 0 0 1 .5-.5z"/>
                </svg>
                Mover a diario
              </button>
            )}
            <button className="node-quick-action-btn" onClick={handleDuplicate} title="Duplicar esta nota">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/>
              </svg>
              Duplicar nota
            </button>
            <button className="node-quick-action-btn" onClick={handlePrint} title="Imprimir nota">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 1a2 2 0 0 0-2 2v1h10V3a2 2 0 0 0-2-2H5zm6 8H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/>
                <path d="M0 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2H2a2 2 0 0 1-2-2V7zm2.5 1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
              </svg>
              Imprimir
            </button>
            <button
              className={`node-quick-action-btn ${showChat ? 'node-quick-action-btn--active' : ''}`}
              onClick={() => setShowChat(v => !v)}
              title="Chat IA sobre esta nota (⌘J)"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9.586a1 1 0 0 0 .707-.293l2.414-2.414A1 1 0 0 0 15 10.586V4a2 2 0 0 0-2-2H2zm3 3h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h4a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
              </svg>
              Chat IA
            </button>
            {quickActionMsg && (
              <span className="node-quick-action-feedback">{quickActionMsg}</span>
            )}
          </div>

          {/* Node metadata row: status, priority, tags, due */}
          {(node.status !== null || node.priority || node.due || (node.types && node.types.filter(t => !['bucle','agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec'].includes(t)).length > 0)) && (
            <div className="node-header-meta">
              {node.status !== null && (
                <button
                  className={`node-status-badge node-status-badge--btn ${node.status}`}
                  onClick={() => store.updateNode(node!.id, { status: node!.status === 'done' ? 'pending' : 'done' })}
                  title="Cambiar estado"
                >
                  {node.status === 'pending' ? '○ Pendiente' : '✓ Completado'}
                </button>
              )}
              {node.priority && (
                <button
                  className={`node-priority-badge node-priority-badge--btn priority-badge--${node.priority}`}
                  onClick={() => {
                    const next: Node['priority'] = node!.priority === 'high' ? 'medium' : node!.priority === 'medium' ? 'low' : null
                    store.updateNode(node!.id, { priority: next })
                  }}
                  title="Cambiar prioridad"
                >
                  {node.priority === 'high' ? '↑ Alta' : node.priority === 'medium' ? '→ Media' : '↓ Baja'}
                </button>
              )}
              {node.due && (
                <span className="node-due-badge">
                  📅 {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {(node.types || [])
                .filter(t => !['bucle','agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec'].includes(t))
                .map(tag => (
                  <span
                    key={tag}
                    className="node-tag-chip"
                    style={{ backgroundColor: s.tagColor(tag) }}
                  >
                    {tag}
                  </span>
                ))
              }
            </div>
          )}

          {/* Locked badge */}
          {isLocked && (
            <div className="node-locked-badge">🔒 Nota bloqueada — solo lectura</div>
          )}

          {/* Relative timestamp */}
          <div className="node-updated-at">
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
          </div>
        </div>

        <div className="view-body">
          {/* Body editor */}
          <div className="node-body-editor">
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
                  placeholder={isAiStreaming ? '✨ IA generando...' : 'Añade una descripción o notas... (⌘Space para IA)'}
                  rows={Math.max(4, bodyValue.split('\n').length + 1)}
                />
                {isAiStreaming && (
                  <span className="ai-streaming-hint">✨ IA generando...</span>
                )}
                {isLoggedIn && !isAiStreaming && (
                  <button
                    className="ai-inline-trigger-btn"
                    onClick={triggerAiInline}
                    title="Completar con IA (⌘Space)"
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
                  setBodyValue(node.body || '')
                }}
              >
                {hasBody ? (
                  // Render body — agrupar líneas en bloques para listas, checkboxes y tablas
                  (() => {
                    const lines = (node.body || '').split('\n')
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
                ) : (
                  <span className="node-body-placeholder">Añade una descripción...</span>
                )}
              </div>
            )}
          </div>

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
              {!attachmentsAvailable ? (
                <p className="attachments-unavailable">Adjuntar archivos no disponible</p>
              ) : (
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

          <Outliner
            parentId={node.id}
            autoFocusEmpty
            placeholder="Añade contenido..."
            filterText={inDocSearch || undefined}
          />
        </div>
      </div>

      {showChat && (
        <NodeChatPanel
          node={node}
          onClose={() => setShowChat(false)}
        />
      )}

      <NodeContextPanel nodeId={node.id} />

      {showProperties && (
        <NodePropertiesPanel
          node={node}
          onClose={() => setShowProperties(false)}
        />
      )}
    </div>
  )
}
