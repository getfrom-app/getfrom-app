/**
 * NodeContextMenu — Menú contextual rediseñado para experiment/workflowy
 *
 * Estructura:
 *  - Duplicar
 *  - Mover a...
 *  - Convertir en → (inline expandible)
 *  - Añadir a atajos / Quitar de atajos
 *  - Propiedades de tarea (solo si es tarea)
 *  - Copiar texto
 *  - Copiar enlace interno / Copiar enlace público / Despublicar
 *  - Aplicar plantilla → (hijos del nodo "Plantillas")
 *  - Eliminar (no para diarios/temporales)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { store, nodeMeta } from '../../store/nodeStore'
import type { Node } from '../../types'
import MoveNodeModal from '../modals/MoveNodeModal'
import { addNodeShortcut, removeNodeShortcut, isNodeShortcut } from '../../store/shortcutsStore'
import { getNodeTagSlug } from '../../utils/tagsHelper'
import { publishNote, unpublishNote } from '../../api/client'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function isTemporalNode(node: Node): boolean {
  const t = node.text || ''
  return /^\d{4}$/.test(t) ||
    MONTHS_ES.some(m => m.toLowerCase() === t.toLowerCase()) ||
    /^Semana \d+$/i.test(t)
}

function setNodeBlock(node: Node, block: string | null) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch {}
  if (block) ed._block = block
  else delete ed._block
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

interface Props {
  node: Node
  x: number
  y: number
  onClose: () => void
  onNavigate: (id: string) => void
  onSelect: (id: string) => void
}

export default function NodeContextMenu({ node, x, y, onClose, onNavigate, onSelect }: Props) {
  const [showMove, setShowMove] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isTask = node.status !== null && node.status !== undefined
  const isEvent = !!node.isEvent
  const isFav = isNodeShortcut(node.id) || node.isFavorite
  const meta = nodeMeta(node)
  const currentBlock = meta.block ?? null
  const isDiary = node.isDiaryEntry
  const isTemporal = isTemporalNode(node)
  const publicSlug = node.publicSlug

  // Color — detectar si es un nodo de tag para usar setTagColor
  const tagSlug = getNodeTagSlug(node.id)  // null si no está bajo 🏷 Tags
  const currentColor = tagSlug
    ? store.tagColor(tagSlug)   // color del tag (sin ser el determinístico por hash)
    : (meta.color ?? null)      // color del nodo genérico

  const [showColorPicker, setShowColorPicker] = useState(false)

  const COLOR_SWATCHES = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#64748b',
  ]

  function applyColor(color: string | null) {
    if (tagSlug) {
      // Nodo de tag → colorear el chip en todos los lugares
      store.setTagColor(tagSlug, color)
    } else {
      // Nodo genérico → color en extraData
      try {
        const ed = JSON.parse(node.extraData || '{}')
        if (color) ed.color = color; else delete ed.color
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
    }
    setShowColorPicker(false)
  }

  // Plantillas: hijos del nodo "Plantillas"
  const templateParent = store.allActive().find(n =>
    !n.deletedAt && n.text?.toLowerCase() === 'plantillas' && !n.parentId
  )
  const templates = templateParent
    ? store.children(templateParent.id).filter(n => !n.deletedAt)
    : []

  // Ajustar posición
  const menuW = 220, menuH = 420
  const adjustedX = Math.min(x, window.innerWidth - menuW - 8)
  const adjustedY = Math.min(y, window.innerHeight - menuH - 8)

  // Cerrar al click fuera (solo si no hay submodal)
  useEffect(() => {
    if (showMove) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, showMove])

  // ── Acciones ──────────────────────────────────────────────────────────────
  function run(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      fn(); onClose()
    }
  }

  function duplicate() {
    const dup = store.createNode({
      text: node.text,
      parentId: node.parentId,
      siblingOrder: node.siblingOrder + 0.25,
      isTask: node.status !== null,
      types: node.types,
    })
    store.updateNode(dup.id, { priority: node.priority, status: node.status })
    onSelect(dup.id)
  }

  function createMirror() {
    const mirror = store.createNode({
      text: node.text,
      parentId: null,
      extraData: { _mirrorOf: node.id },
    })
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: { message: `Espejo creado: "${(node.text || 'Nodo').slice(0, 30)}"`, type: 'success' }
    }))
    onSelect(mirror.id)
  }

  function toggleTask() {
    if (!isTask) {
      const today = new Date(); today.setHours(23,59,59,0)
      store.updateNode(node.id, { status: 'pending', due: today.toISOString() })
    } else {
      store.updateNode(node.id, { status: null, due: null })
    }
  }

  function toggleEvent() {
    store.updateNode(node.id, { isEvent: !isEvent })
  }

  function toggleShortcut() {
    if (isFav) {
      removeNodeShortcut(node.id)
      store.updateNode(node.id, { isFavorite: false })
    } else {
      addNodeShortcut(node.id, node.text || 'Sin título')
      store.updateNode(node.id, { isFavorite: true })
    }
    window.dispatchEvent(new Event('wf:shortcuts-changed'))
  }

  function openTaskProps() {
    // Dispatch event — OutlinerNode escucha y abre el panel de propiedades
    window.dispatchEvent(new CustomEvent('from:open-task-props', { detail: { nodeId: node.id } }))
  }

  function copyText() {
    navigator.clipboard.writeText(node.text || '')
  }

  function copyInternalLink() {
    const url = `${window.location.origin}/app/node/${node.id}`
    navigator.clipboard.writeText(url)
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Enlace interno copiado', type: 'success' } }))
  }

  async function handlePublicLink() {
    setPublishing(true)
    try {
      if (publicSlug) {
        // Ya publicado → copiar URL
        const url = `https://getfrom.app/p/${publicSlug}`
        await navigator.clipboard.writeText(url)
        window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Enlace público copiado', type: 'success' } }))
      } else {
        // Publicar y copiar — title = node.text, content = node.body o vacío
        const result = await publishNote(node.text || 'Sin título', node.body || '')
        if (result?.slug) {
          // Guardar el slug en el nodo
          store.updateNode(node.id, { publicSlug: result.slug } as any)
          const url = `https://getfrom.app/p/${result.slug}`
          await navigator.clipboard.writeText(url)
          window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Publicado y enlace copiado', type: 'success' } }))
        }
      }
    } catch {
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Error al publicar', type: 'error' } }))
    }
    setPublishing(false)
  }

  async function handleUnpublish() {
    if (!publicSlug) return
    try {
      await unpublishNote(publicSlug)
      store.updateNode(node.id, { publicSlug: null } as any)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Nota despublicada', type: 'info' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Error al despublicar', type: 'error' } }))
    }
  }

  function applyTemplate(template: Node) {
    store.updateNode(node.id, { body: template.body || '' })
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: { message: `Plantilla "${template.text}" aplicada`, type: 'success' }
    }))
  }

  function deleteNode() {
    const now = new Date().toISOString()
    // Borrar moved-refs que apuntan a este nodo
    store.allActive().forEach(n => {
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._movedRef && ed._refTarget === node.id) store.updateNode(n.id, { deletedAt: now })
      } catch {}
    })
    // Si está bajo un ctx-ref, borrarlo si queda vacío
    if (node.parentId) {
      const parent = store.getNode(node.parentId)
      if (parent) {
        try {
          const ed = JSON.parse(parent.extraData || '{}')
          if (ed._ctxRef) {
            const remaining = store.children(parent.id).filter(c => !c.deletedAt && c.id !== node.id)
            if (remaining.length === 0) store.updateNode(parent.id, { deletedAt: now })
          }
        } catch {}
      }
    }
    store.updateNode(node.id, { deletedAt: now })
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: { message: `"${(node.text || 'Nodo').slice(0, 30)}" enviado a la papelera`, type: 'info' }
    }))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const menu = !showMove ? createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 2000, minWidth: 220 }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Duplicar + Mover + Espejo */}
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={run(duplicate)}>
          <span className="context-menu-icon">⧉</span> Duplicar
          <span className="context-menu-shortcut">⌘D</span>
        </button>
        <button className="context-menu-item" onClick={run(createMirror)}>
          <span className="context-menu-icon">⬡</span> Crear espejo
        </button>
        <button className="context-menu-item" onClick={e => {
          e.preventDefault(); e.stopPropagation()
          setShowMove(true)
        }}>
          <span className="context-menu-icon">→</span> Mover a...
        </button>
      </div>

      <div className="context-menu-separator" />

      {/* Convertir en → inline expandible */}
      <div className="context-menu-section">
        <button
          className={`context-menu-item${showConvert ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowConvert(v => !v) }}
        >
          <span className="context-menu-icon">⇄</span> Convertir en
          <span className="context-menu-shortcut">{showConvert ? '▾' : '›'}</span>
        </button>
        {showConvert && (
          <div className="context-menu-submenu-inline">
            <button className="context-menu-item context-menu-item--sub" onClick={run(toggleTask)}>
              <span className="context-menu-icon">{isTask ? '○' : '☑'}</span>
              {isTask ? 'Quitar tarea' : 'Tarea'}
            </button>
            <button className="context-menu-item context-menu-item--sub" onClick={run(toggleEvent)}>
              <span className="context-menu-icon">📅</span>
              {isEvent ? 'Quitar evento' : 'Evento'}
            </button>
            <div className="context-menu-separator" style={{ margin: '3px 8px' }} />
            {(['h1','h2','h3'] as const).map(level => (
              <button key={level} className="context-menu-item context-menu-item--sub"
                onClick={run(() => setNodeBlock(node, currentBlock === level ? null : level))}
              >
                <span className="context-menu-icon" style={{ fontWeight: 700, fontSize: 11 }}>
                  {level.toUpperCase()}
                </span>
                {level === 'h1' ? 'Título 1' : level === 'h2' ? 'Título 2' : 'Título 3'}
                {currentBlock === level && <span style={{ marginLeft: 'auto', opacity: 0.5 }}>✓</span>}
              </button>
            ))}
            <button className="context-menu-item context-menu-item--sub"
              onClick={run(() => setNodeBlock(node, currentBlock === 'bullet' ? null : 'bullet'))}>
              <span className="context-menu-icon">•</span> Lista
              {currentBlock === 'bullet' && <span style={{ marginLeft: 'auto', opacity: 0.5 }}>✓</span>}
            </button>
            <button className="context-menu-item context-menu-item--sub"
              onClick={run(() => setNodeBlock(node, null))}>
              <span className="context-menu-icon">¶</span> Párrafo normal
              {!currentBlock && <span style={{ marginLeft: 'auto', opacity: 0.5 }}>✓</span>}
            </button>
            <button className="context-menu-item context-menu-item--sub"
              onClick={run(() => {
                const t = (node.text || '').trimEnd()
                if (t === '---') return
                store.updateNode(node.id, { text: '---' })
              })}>
              <span className="context-menu-icon">—</span> Separador
            </button>
          </div>
        )}
      </div>

      <div className="context-menu-separator" />

      {/* Atajos */}
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={run(toggleShortcut)}>
          <span className="context-menu-icon">{isFav ? '★' : '☆'}</span>
          {isFav ? 'Quitar de atajos' : 'Añadir a atajos'}
        </button>
      </div>

      <div className="context-menu-separator" />

      {/* Color */}
      <div className="context-menu-section">
        <button
          className={`context-menu-item${showColorPicker ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowColorPicker(v => !v) }}
        >
          <span
            className="context-menu-icon"
            style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: currentColor || 'var(--text-tertiary)', border: '1.5px solid var(--border)', verticalAlign: 'middle' }}
          />
          {tagSlug ? 'Color del tag' : 'Color del nodo'}
          <span className="context-menu-shortcut">{showColorPicker ? '▾' : '›'}</span>
        </button>
        {showColorPicker && (
          <div className="context-menu-submenu-inline" style={{ padding: '6px 10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); applyColor(c) }}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c,
                    border: currentColor === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                  title={c}
                />
              ))}
              {/* Sin color */}
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); applyColor(null) }}
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'transparent',
                  border: !currentColor ? '2px solid var(--text-primary)' : '2px solid var(--border)',
                  cursor: 'pointer', flexShrink: 0, fontSize: 10, lineHeight: 1,
                }}
                title="Sin color"
              >✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Propiedades de tarea (solo si es tarea) */}
      {isTask && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-section">
            <button className="context-menu-item" onClick={run(openTaskProps)}>
              <span className="context-menu-icon">⚙</span> Propiedades de tarea
            </button>
            {node.status !== 'done' ? (
              <button className="context-menu-item" onClick={run(() =>
                store.updateNode(node.id, { status: 'done' })
              )}>
                <span className="context-menu-icon">✓</span> Marcar como hecha
              </button>
            ) : (
              <button className="context-menu-item" onClick={run(() =>
                store.updateNode(node.id, { status: 'pending' })
              )}>
                <span className="context-menu-icon">↺</span> Marcar pendiente
              </button>
            )}
          </div>
        </>
      )}

      <div className="context-menu-separator" />

      {/* Copiar */}
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={run(copyText)}>
          <span className="context-menu-icon">⎘</span> Copiar texto
        </button>
        <button className="context-menu-item" onClick={run(copyInternalLink)}>
          <span className="context-menu-icon">🔗</span> Copiar enlace interno
        </button>
        <button className="context-menu-item" onClick={run(handlePublicLink)} disabled={publishing}>
          <span className="context-menu-icon">👁</span>
          {publishing ? 'Publicando…' : publicSlug ? 'Copiar enlace público' : 'Publicar y copiar enlace'}
        </button>
        {publicSlug && (
          <button className="context-menu-item" onClick={run(handleUnpublish)}>
            <span className="context-menu-icon">🔒</span> Despublicar
          </button>
        )}
      </div>

      {/* Plantillas */}
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button
          className={`context-menu-item${showTemplates ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowTemplates(v => !v) }}
        >
          <span className="context-menu-icon">📋</span> Aplicar plantilla
          <span className="context-menu-shortcut">{showTemplates ? '▾' : '›'}</span>
        </button>
        {showTemplates && (
          <div className="context-menu-submenu-inline">
            {templates.length === 0 ? (
              <div style={{ padding: '6px 28px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Crea un nodo raíz llamado<br />
                <strong>"Plantillas"</strong> con hijos dentro
              </div>
            ) : templates.map(t => (
              <button key={t.id} className="context-menu-item context-menu-item--sub" onClick={run(() => applyTemplate(t))}>
                <span className="context-menu-icon">📄</span> {t.text || 'Sin título'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Eliminar — siempre disponible, va a la papelera */}
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button className="context-menu-item context-menu-item--danger" onClick={run(deleteNode)}>
          <span className="context-menu-icon">🗑</span> Eliminar
        </button>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {menu}
      {showMove && (
        <MoveNodeModal
          node={node}
          onClose={() => { setShowMove(false); onClose() }}
        />
      )}
    </>
  )
}
