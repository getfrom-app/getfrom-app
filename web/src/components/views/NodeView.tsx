import { useParams, useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { useRef, useState, useCallback, useEffect } from 'react'
import Outliner from '../outliner/Outliner'
import InlineRenderer from '../outliner/InlineRenderer'
import NodePropertiesPanel from '../panels/NodePropertiesPanel'
import NodeContextPanel from '../panels/NodeContextPanel'
import { recordRecentNode } from '../CommandPalette'
import type { Node } from '../../types'
import { getPresignedUpload, getFilesForNode, deleteFile, aiInlineStream, publishNote, getToken } from '../../api/client'

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
      if (e.key === 'Escape') {
        setShowInDocSearch(false)
        setInDocSearch('')
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

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
    // Para usuarios logueados: publicar en servidor y obtener URL pública real
    if (getToken() && node) {
      if (shareUrl) {
        // Ya publicada: copiar URL existente
        navigator.clipboard.writeText(shareUrl).catch(() => {})
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
        return
      }
      setIsPublishing(true)
      try {
        const content = node.body || node.text || ''
        const result = await publishNote(node.text || 'Nota', content)
        const url = `https://from-server-production.up.railway.app/p/${result.slug}`
        setShareUrl(url)
        navigator.clipboard.writeText(url).catch(() => {})
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } catch {
        // Fallback: URL de la app
        const url = `https://getfrom.app/app/node/${node!.id}`
        navigator.clipboard.writeText(url).catch(() => {})
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } finally {
        setIsPublishing(false)
      }
    } else {
      // Guest: copiar URL de la app
      const url = `https://getfrom.app/app/node/${node!.id}`
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }).catch(() => { prompt('Copia este enlace:', url) })
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
        <div className="view-header">
          {crumbs.length > 0 && (
            <nav className="breadcrumb">
              <button className="breadcrumb-home" onClick={() => navigate('/')}>Inicio</button>
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
            <h1
              ref={titleRef}
              className="node-title"
              contentEditable
              suppressContentEditableWarning
              onInput={handleTitleInput}
              onBlur={handleTitleInput}
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
        </div>

        <div className="view-body">
          {/* Body editor */}
          <div className="node-body-editor">
            {bodyEditing ? (
              <>
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
                onClick={() => {
                  setBodyEditing(true)
                  setBodyValue(node.body || '')
                }}
              >
                {hasBody ? (
                  // Render body lines
                  (node.body || '').split('\n').map((line, i) => (
                    <p key={i} className="node-body-line">
                      {line ? <InlineRenderer text={line} /> : <br />}
                    </p>
                  ))
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

          <Outliner
            parentId={node.id}
            autoFocusEmpty
            placeholder="Añade contenido..."
            filterText={inDocSearch || undefined}
          />
        </div>
      </div>

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
