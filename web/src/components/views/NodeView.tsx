import { useParams, useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import { useRef, useState, useCallback, useEffect } from 'react'
import Outliner from '../outliner/Outliner'
import InlineRenderer from '../outliner/InlineRenderer'

export default function NodeView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const s = useStore()
  const node = id ? s.getNode(id) : undefined

  const [bodyEditing, setBodyEditing] = useState(false)
  const [bodyValue, setBodyValue] = useState('')
  const bodyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const hasBody = (node.body && node.body.trim().length > 0) || bodyEditing

  return (
    <div className="view node-view">
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

        <h1
          className="node-title"
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          onBlur={handleTitleInput}
        >
          {node.text || 'Sin título'}
        </h1>

        {node.status !== null && (
          <div className={`node-status-badge ${node.status}`}>
            {node.status === 'pending' ? 'Pendiente' : 'Completado'}
          </div>
        )}
      </div>

      <div className="view-body">
        {/* Body editor */}
        <div className="node-body-editor">
          {bodyEditing ? (
            <textarea
              ref={textareaRef}
              className="node-body-textarea"
              value={bodyValue}
              onChange={handleBodyChange}
              onBlur={handleBodyBlur}
              placeholder="Añade una descripción o notas..."
              rows={Math.max(4, bodyValue.split('\n').length + 1)}
            />
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

        <Outliner
          parentId={node.id}
          autoFocusEmpty
          placeholder="Añade contenido..."
        />
      </div>
    </div>
  )
}
