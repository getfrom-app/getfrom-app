/**
 * NodeContextMenu — Menú contextual rediseñado para experiment/workflowy
 *
 * Estructura:
 *  - Duplicar
 *  - Mover a...
 *  - Convertir en → (inline expandible)
 *  - Añadir a paneles / Quitar de paneles
 *  - Propiedades de tarea (solo si es tarea)
 *  - Copiar texto
 *  - Copiar enlace interno / Copiar enlace público / Despublicar
 *  - Aplicar plantilla → (hijos del nodo "Plantillas")
 *  - Eliminar (no para diarios/temporales)
 */
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store, nodeMeta } from '../../store/nodeStore'
import type { Node } from '../../types'
import MoveNodeModal from '../modals/MoveNodeModal'
import { trashNode, isInPapelera, restoreNode } from '../../utils/papeleraHelper'
import { isProtectedSystemRoot } from '../../utils/rootLookup'
import { addPredictionWord, guessWordType } from '../../store/predictionStore'
import { getNodeTagSlug } from '../../utils/tagsHelper'
import { learningsStore, buildLearningText } from '../../store/learningsStore'
import { isDocNode } from '../../utils/docNode'
import { htmlToMarkdown, docStandaloneHtml } from '../../utils/htmlMarkdown'

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
  // Si se convierte a heading y el nodo tiene hijos, subirlos al mismo nivel
  // que el heading (hermanos inmediatamente después). Estilo documento.
  if (block === 'h1' || block === 'h2' || block === 'h3') {
    liftChildrenAfterHeading(node)
  }
}

/**
 * Cuando un nodo con hijos se convierte en heading, sus hijos "suben" al mismo
 * nivel que el heading: dejan de ser hijos del heading y pasan a ser hermanos
 * inmediatamente después de él.
 */
function liftChildrenAfterHeading(headingNode: Node) {
  const children = store.children(headingNode.id).filter(c => !c.deletedAt)
  if (children.length === 0) return

  const grandParentId = headingNode.parentId
  const siblings = store.children(grandParentId).filter(c => !c.deletedAt).sort((a, b) => a.siblingOrder - b.siblingOrder)
  const headingIdx = siblings.findIndex(s => s.id === headingNode.id)
  const nextSibling = headingIdx >= 0 ? siblings[headingIdx + 1] : undefined

  const baseOrder = headingNode.siblingOrder
  const endOrder = nextSibling ? nextSibling.siblingOrder : baseOrder + children.length * 1000 + 1000
  const step = (endOrder - baseOrder) / (children.length + 1)

  children.forEach((child, i) => {
    store.updateNode(child.id, {
      parentId: grandParentId,
      siblingOrder: baseOrder + step * (i + 1),
    })
  })
}

interface Props {
  node: Node
  x: number
  y: number
  onClose: () => void
  onNavigate: (id: string) => void
  onSelect: (id: string) => void
  selectedIds?: Set<string>  // cuando hay múltiples nodos seleccionados
}

export default function NodeContextMenu({ node, x, y, onClose, onNavigate, onSelect, selectedIds }: Props) {
  // IDs efectivos: si hay selección múltiple y el nodo actual está incluido, operar en todos
  const effectiveIds = (selectedIds && selectedIds.size > 1 && selectedIds.has(node.id))
    ? [...selectedIds]
    : [node.id]
  const isMulti = effectiveIds.length > 1
  const { t } = useTranslation()
  const [showMove, setShowMove] = useState(false)
  // nodeIds capturados al abrir el modal — inmunes a re-renders posteriores
  const [moveNodeIds, setMoveNodeIds] = useState<string[] | undefined>(undefined)
  const [showConvert, setShowConvert] = useState(false)
  const [showCopySub, setShowCopySub] = useState(false)
  const [showExportSub, setShowExportSub] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showPrediction, setShowPrediction] = useState(false)
  // Texto seleccionado en el momento de abrir el menú
  const selectedText = window.getSelection()?.toString().trim() || ''
  const menuRef = useRef<HTMLDivElement>(null)

  const isTask = node.status !== null && node.status !== undefined
  const isEvent = !!node.isEvent
  const isFav = !!node.isFavorite
  const isBucle = (node.types || []).includes('bucle')
  const meta = nodeMeta(node)
  const currentBlock = meta.block ?? null
  const isDiary = node.isDiaryEntry
  const isTemporal = isTemporalNode(node)

  // Color — detectar si es un nodo de tag para usar setTagColor
  const tagSlug = getNodeTagSlug(node.id)  // null si no está bajo 🏷 Tags
  const currentColor = tagSlug
    ? store.tagColor(tagSlug)   // color del tag (sin ser el determinístico por hash)
    : (meta.color ?? null)      // color del nodo genérico

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showTeach, setShowTeach] = useState(false)

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

  // Ajustar posición tras render para usar tamaño real (incluye submenús abiertos)
  useLayoutEffect(() => {
    if (!menuRef.current) return
    // Medir la altura REAL usando scrollHeight (no getBoundingClientRect, que puede estar
    // recortado si el menú ya está fuera del viewport en el primer render)
    const h = menuRef.current.scrollHeight || menuRef.current.offsetHeight
    const w = menuRef.current.scrollWidth || menuRef.current.offsetWidth
    const marginH = 20 // margen inferior cómodo (evita pegar al borde + barra de estado)
    const marginW = 8
    const adjustedY = Math.max(marginH, Math.min(y, window.innerHeight - h - marginH))
    const adjustedX = Math.max(marginW, Math.min(x, window.innerWidth - w - marginW))
    menuRef.current.style.top = `${adjustedY}px`
    menuRef.current.style.left = `${adjustedX}px`
  }, [x, y, showConvert, showColorPicker, showTemplates, showCopySub, showExportSub])

  // Cerrar al click fuera (solo si no hay submodal)
  // Excepción: clic en un handle ⋮⋮ → añade/quita de la selección sin cerrar el menú
  useEffect(() => {
    if (showMove) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('.node-drag-handle')) return  // handle → no cerrar
      if (menuRef.current && !menuRef.current.contains(target)) {
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
    store.updateNode(node.id, { isFavorite: !isFav })
  }

  function openTaskProps() {
    // Dispatch event — OutlinerNode escucha y abre el panel de propiedades
    window.dispatchEvent(new CustomEvent('from:open-task-props', { detail: { nodeId: node.id } }))
  }

  // ── Copiar / Exportar (contenido = jerarquía de hijos, recursivo) ──────────
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  function buildMd(parentId: string, depth: number): string {
    return store.children(parentId).filter(n => !n.deletedAt).map(n => {
      const prefix = n.status === 'done' ? '- [x] ' : n.status === 'pending' ? '- [ ] ' : '- '
      return '  '.repeat(depth) + prefix + n.text + '\n' + buildMd(n.id, depth + 1)
    }).join('')
  }
  // Documento: el contenido es HTML en el body (no hijos). Markdown = conversión.
  const isDoc = isDocNode(node)
  function fullMd(): string {
    if (isDoc) return htmlToMarkdown(node.body || '')
    return `# ${node.text || 'Nota'}\n\n${node.body ? node.body + '\n\n' : ''}${buildMd(node.id, 0)}`.trim()
  }
  function buildHtml(parentId: string): string {
    const kids = store.children(parentId).filter(n => !n.deletedAt)
    if (!kids.length) return ''
    return '<ul>' + kids.map(n => `<li>${escapeHtml(n.text || '')}${buildHtml(n.id)}</li>`).join('') + '</ul>'
  }
  const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))

  function copyMarkdown() {
    navigator.clipboard.writeText(fullMd()).then(() => toast('Markdown copiado')).catch(() => {})
  }
  function copyRich() {
    const html = isDoc
      ? (node.body || '')
      : `<h1>${escapeHtml(node.text || '')}</h1>${node.body ? `<p>${escapeHtml(node.body)}</p>` : ''}${buildHtml(node.id)}`
    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([fullMd()], { type: 'text/plain' }),
      })]).then(() => toast('Copiado con formato')).catch(() => navigator.clipboard.writeText(fullMd()))
    } catch { navigator.clipboard.writeText(fullMd()) }
  }
  function exportMarkdown() {
    const blob = new Blob([fullMd()], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (node.text || 'nota').slice(0, 40).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').trim() + '.md'
    a.click()
    URL.revokeObjectURL(url)
    toast('Exportado a Markdown')
  }
  // Documento HTML autónomo (para exportar HTML y para el PDF limpio).
  function standaloneHtml(): string {
    if (isDoc) return docStandaloneHtml(node.text || 'Documento', node.body || '')
    const safeTitle = escapeHtml(node.text || 'Nota')
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeTitle}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:720px;margin:40px auto;padding:0 24px;}
  h1{font-size:1.9rem;margin:0 0 1rem;color:#111;}
  ul{padding-left:1.3em;} li{margin:.25em 0;}
  p{margin:.7em 0;} footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:.8rem;color:#aaa;}
</style></head>
<body><h1>${safeTitle}</h1>${node.body ? `<p>${escapeHtml(node.body)}</p>` : ''}${buildHtml(node.id)}
<footer>Generado con Fromly</footer></body></html>`
  }
  function exportHtml() {
    const blob = new Blob([standaloneHtml()], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (node.text || 'nota').slice(0, 40).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').trim() + '.html'
    a.click()
    URL.revokeObjectURL(url)
    toast('Exportado a HTML')
  }
  function exportPdf() {
    // PDF limpio: ventana nueva con SOLO la nota → imprimir (sin el chrome de la app).
    const w = window.open('', '_blank')
    if (!w) { window.print(); return }
    w.document.write(standaloneHtml())
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  function copyInternalLink() {
    const url = `${window.location.origin}/app/node/${node.id}`
    navigator.clipboard.writeText(url)
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Enlace interno copiado', type: 'success' } }))
  }

  // Publicar / despublicar / enlace público viven en el icono 🌐 de la cabecera
  // (NodeView), no en este menú. Aquí solo queda el enlace INTERNO.

  function applyTemplate(template: Node) {
    store.updateNode(node.id, { body: template.body || '' })
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: { message: `Plantilla "${template.text}" aplicada`, type: 'success' }
    }))
  }

  function deleteNode() {
    // Raíces de sistema: no se pueden eliminar.
    if (!isMulti && isProtectedSystemRoot(node.id)) {
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Este nodo del sistema no se puede eliminar', type: 'info' } }))
      onClose()
      return
    }
    if (isMulti) {
      // Bulk: mover todos a papelera
      if (!confirm(`¿Mover ${effectiveIds.length} nodos a la Papelera?`)) return
      effectiveIds.forEach(id => trashNode(id))
      window.dispatchEvent(new CustomEvent('from:toast', {
        detail: { message: `${effectiveIds.length} nodos movidos a Papelera`, type: 'info' }
      }))
      onClose()
      return
    }
    const inPapelera = isInPapelera(node.id)
    if (inPapelera) {
      // Ya está en Papelera → eliminar permanentemente
      if (!confirm(`¿Eliminar permanentemente "${(node.text || 'Nodo').slice(0, 30)}"? Esta acción no se puede deshacer.`)) return
      store.updateNode(node.id, { deletedAt: new Date().toISOString() })
      window.dispatchEvent(new CustomEvent('from:toast', {
        detail: { message: `"${(node.text || 'Nodo').slice(0, 30)}" eliminado permanentemente`, type: 'info' }
      }))
    } else {
      // Mover a Papelera (jerarquía preservada)
      trashNode(node.id)
      window.dispatchEvent(new CustomEvent('from:toast', {
        detail: { message: `"${(node.text || 'Nodo').slice(0, 30)}" movido a Papelera`, type: 'info' }
      }))
    }
  }

  function restoreNodeFromTrash() {
    restoreNode(node.id)
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: { message: `"${(node.text || 'Nodo').slice(0, 30)}" restaurado`, type: 'success' }
    }))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const menu = !showMove ? createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: 'fixed', top: y, left: x, zIndex: 2000, minWidth: 220 }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Cabecera multi-nodo */}
      {isMulti && (
        <div style={{ padding: '6px 14px 4px', fontSize: 11, color: 'var(--accent)', fontWeight: 600, opacity: 0.9 }}>
          {effectiveIds.length} nodos seleccionados
        </div>
      )}
      {/* Duplicar + Mover */}
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={run(duplicate)}>
          <span className="context-menu-icon">⧉</span> {t('context.duplicate')}
          <span className="context-menu-shortcut">⌘D</span>
        </button>
        <button className="context-menu-item" onClick={e => {
          e.preventDefault(); e.stopPropagation()
          // Capturar los IDs AHORA antes de que la selección pueda cambiar
          setMoveNodeIds(isMulti ? [...effectiveIds] : undefined)
          setShowMove(true)
        }}>
          <span className="context-menu-icon">→</span> {t('context.moveTo')}
        </button>
      </div>

      <div className="context-menu-separator" />

      {/* Quitar tarea (directo) → la convierte en nodo normal. */}
      {isTask && (
        <button className="context-menu-item" onClick={run(toggleTask)}>
          <span className="context-menu-icon">○</span> Quitar tarea
        </button>
      )}

      {/* Convertir en → inline expandible */}
      <div className="context-menu-section">
        <button
          className={`context-menu-item${showConvert ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowConvert(v => !v) }}
        >
          <span className="context-menu-icon">⇄</span> {t('context.convertTo')}
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
            {/* (Bucle eliminado del «Convertir en»: ahora seguimiento = tarea sin fecha.) */}
            <div className="context-menu-separator" style={{ margin: '3px 8px' }} />
            {(['h1','h2','h3'] as const).map(level => (
              <button key={level} className="context-menu-item context-menu-item--sub"
                onClick={run(() => setNodeBlock(node, currentBlock === level ? null : level))}
              >
                <span className="context-menu-icon" style={{ fontWeight: 700, fontSize: 11 }}>
                  {level.toUpperCase()}
                </span>
                {level === 'h1' ? t('format.heading1') : level === 'h2' ? t('format.heading2') : t('format.heading3')}
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

      {/* Paneles */}
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={run(toggleShortcut)}>
          <span className="context-menu-icon">{isFav ? '★' : '☆'}</span>
          {isFav ? t('context.removeFavorite') : t('context.addFavorite')}
        </button>
        {/* (Bucle eliminado: el seguimiento es ahora una tarea sin fecha.) */}
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
          {tagSlug ? t('panel.color') : t('panel.color')}
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
              <span className="context-menu-icon">⚙</span> {t('panel.taskProperties')}
            </button>
          </div>
        </>
      )}

      <div className="context-menu-separator" />

      {/* Copiar */}
      <div className="context-menu-section">
        {/* Copiar → Markdown / Texto rico */}
        <button
          className={`context-menu-item${showCopySub ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowCopySub(v => !v); setShowExportSub(false) }}
        >
          <span className="context-menu-icon">⎘</span> Copiar
          <span className="context-menu-shortcut">{showCopySub ? '▾' : '›'}</span>
        </button>
        {showCopySub && (
          <div className="context-menu-submenu-inline">
            <button className="context-menu-item context-menu-item--sub" onClick={run(copyMarkdown)}>
              <span className="context-menu-icon">⌨</span> Markdown
            </button>
            <button className="context-menu-item context-menu-item--sub" onClick={run(copyRich)}>
              <span className="context-menu-icon">¶</span> Texto rico
            </button>
          </div>
        )}
        {/* Exportar → Markdown / PDF */}
        <button
          className={`context-menu-item${showExportSub ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowExportSub(v => !v); setShowCopySub(false) }}
        >
          <span className="context-menu-icon">↧</span> Exportar
          <span className="context-menu-shortcut">{showExportSub ? '▾' : '›'}</span>
        </button>
        {showExportSub && (
          <div className="context-menu-submenu-inline">
            <button className="context-menu-item context-menu-item--sub" onClick={run(exportMarkdown)}>
              <span className="context-menu-icon">⌨</span> Markdown
            </button>
            <button className="context-menu-item context-menu-item--sub" onClick={run(exportHtml)}>
              <span className="context-menu-icon">◇</span> HTML
            </button>
            <button className="context-menu-item context-menu-item--sub" onClick={run(exportPdf)}>
              <span className="context-menu-icon">📄</span> PDF
            </button>
          </div>
        )}
        <button className="context-menu-item" onClick={run(copyInternalLink)}>
          <span className="context-menu-icon">🔗</span> Copiar enlace interno
        </button>
        {/* Publicar / despublicar / copiar enlace público viven en el icono 🌐 de la
            cabecera (NodeView), no duplicados aquí. */}
        <button className="context-menu-item" onClick={(e) => {
          e.preventDefault(); e.stopPropagation()
          const currentSlug = node.publicSlug || ''
          const suggested = (node.text || '')
            .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 50)
          // Disparar evento global para que el modal se renderice fuera del ciclo de vida del menú
          window.dispatchEvent(new CustomEvent('from:open-slug-modal', {
            detail: { nodeId: node.id, currentSlug: currentSlug || suggested }
          }))
          onClose()
        }}>
          <span className="context-menu-icon">✂️</span>
          {node.publicSlug ? `URL: /node/${node.publicSlug}` : 'Establecer URL corta'}
        </button>
      </div>

      {/* Plantillas */}
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button
          className={`context-menu-item${showTemplates ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowTemplates(v => !v) }}
        >
          <span className="context-menu-icon">📋</span> {t('templates.myTemplates')}
          <span className="context-menu-shortcut">{showTemplates ? '▾' : '›'}</span>
        </button>
        {showTemplates && (
          <div className="context-menu-submenu-inline">
            {templates.length === 0 ? (
              <div style={{ padding: '6px 28px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Crea un nodo raíz llamado<br />
                <strong>"Plantillas"</strong> con hijos dentro
              </div>
            ) : templates.map(tmpl => (
              <button key={tmpl.id} className="context-menu-item context-menu-item--sub" onClick={run(() => applyTemplate(tmpl))}>
                <span className="context-menu-icon">📄</span> {tmpl.text || t('common.noTitle')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Enseñar a Fromly — visible si hay texto seleccionado */}
      {selectedText.length >= 2 && selectedText.length <= 30 && (() => {
        const guess = guessWordType(selectedText)
        const isTask = guess.type === 'task'
        const primaryLabel = isTask ? 'verbo de tarea' : 'palabra de evento'
        const primaryIcon = isTask ? '☐' : '📅'
        const primaryType: 'task' | 'event' = isTask ? 'task' : 'event'
        const altType: 'task' | 'event' = isTask ? 'event' : 'task'
        const altLabel = isTask ? 'evento' : 'tarea'
        const altIcon = isTask ? '📅' : '☐'

        const doAdd = (type: 'task' | 'event') => {
          const added = addPredictionWord(type, selectedText)
          const typeLabel = type === 'task' ? 'tarea' : 'evento'
          window.dispatchEvent(new CustomEvent('from:toast', { detail: {
            message: added ? `✦ "${selectedText}" → ${typeLabel}` : `"${selectedText}" ya está en la lista`,
            type: added ? 'success' : 'info'
          }}))
          onClose()
        }

        return (
          <>
            <div className="context-menu-separator" />
            <div className="context-menu-section">
              {/* Propuesta principal (alta confianza) — acción directa */}
              <button className="context-menu-item context-menu-item--prediction" onClick={() => doAdd(primaryType)}>
                <span className="context-menu-icon">✦</span>
                <span>
                  <span style={{ color: 'var(--text-primary)' }}>"{selectedText}"</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>→ {primaryIcon} {primaryLabel}</span>
                </span>
              </button>
              {/* Opción alternativa — más pequeña */}
              <button
                className="context-menu-item context-menu-item--prediction-alt"
                onClick={() => doAdd(altType)}
              >
                <span className="context-menu-icon" style={{ opacity: 0.5 }}>{altIcon}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No, es {altLabel}</span>
              </button>
            </div>
          </>
        )
      })()}

      {/* ── Enseñar a Magic ─────────────────────────────────────────────── */}
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button
          className={`context-menu-item${showTeach ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowTeach(v => !v) }}
          title="Corrige la interpretación de Magic para que aprenda"
        >
          <span className="context-menu-icon">✦</span>
          Enseñar a Magic
          <span className="context-menu-shortcut">{showTeach ? '▾' : '›'}</span>
        </button>

        {showTeach && (
          <div className="context-menu-submenu-inline">
            {/* Opciones según el estado del nodo */}
            {isTask && (
              <button className="context-menu-item context-menu-item--sub"
                onClick={run(() => {
                  const text = buildLearningText('not_task', node)
                  const added = learningsStore.add({ text, category: 'type', nodeText: node.text || undefined, source: 'manual' })
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: {
                    message: added ? '✦ Magic ha aprendido' : 'Ya lo sabía', type: added ? 'success' : 'info'
                  }}))
                })}>
                <span className="context-menu-icon">✕</span> Esto no es una tarea
              </button>
            )}
            {isEvent && (
              <button className="context-menu-item context-menu-item--sub"
                onClick={run(() => {
                  const text = buildLearningText('not_event', node)
                  const added = learningsStore.add({ text, category: 'type', nodeText: node.text || undefined, source: 'manual' })
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: {
                    message: added ? '✦ Magic ha aprendido' : 'Ya lo sabía', type: added ? 'success' : 'info'
                  }}))
                })}>
                <span className="context-menu-icon">✕</span> Esto no es un evento
              </button>
            )}
            {!isTask && (
              <button className="context-menu-item context-menu-item--sub"
                onClick={run(() => {
                  const text = buildLearningText('should_be_task', node)
                  const added = learningsStore.add({ text, category: 'type', nodeText: node.text || undefined, source: 'manual' })
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: {
                    message: added ? '✦ Magic ha aprendido' : 'Ya lo sabía', type: added ? 'success' : 'info'
                  }}))
                })}>
                <span className="context-menu-icon">○</span> Debería ser una tarea
              </button>
            )}
            {!isEvent && (
              <button className="context-menu-item context-menu-item--sub"
                onClick={run(() => {
                  const text = buildLearningText('should_be_event', node)
                  const added = learningsStore.add({ text, category: 'type', nodeText: node.text || undefined, source: 'manual' })
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: {
                    message: added ? '✦ Magic ha aprendido' : 'Ya lo sabía', type: added ? 'success' : 'info'
                  }}))
                })}>
                <span className="context-menu-icon">📅</span> Debería ser un evento
              </button>
            )}
            {(node.types || []).length > 0 && (
              <button className="context-menu-item context-menu-item--sub"
                onClick={run(() => {
                  const text = buildLearningText('wrong_context', node)
                  const added = learningsStore.add({ text, category: 'context', nodeText: node.text || undefined, source: 'manual' })
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: {
                    message: added ? '✦ Magic ha aprendido' : 'Ya lo sabía', type: added ? 'success' : 'info'
                  }}))
                })}>
                <span className="context-menu-icon">⚡</span> El contexto no es correcto
              </button>
            )}

            <div className="context-menu-separator" style={{ margin: '3px 8px' }} />

            {/* Refuerzo positivo */}
            <button className="context-menu-item context-menu-item--sub"
              onClick={run(() => {
                const text = buildLearningText('correct', node)
                const added = learningsStore.add({ text, category: 'positive', nodeText: node.text || undefined, source: 'manual' })
                window.dispatchEvent(new CustomEvent('from:toast', { detail: {
                  message: added ? '✦ Magic lo recordará' : 'Ya lo sabía', type: added ? 'success' : 'info'
                }}))
              })}>
              <span className="context-menu-icon">✓</span> Esta interpretación es correcta
            </button>

            <div className="context-menu-separator" style={{ margin: '3px 8px' }} />

            {/* Escribir o grabar corrección en lenguaje natural → abre modal */}
            <button className="context-menu-item context-menu-item--sub"
              onClick={run(() => {
                window.dispatchEvent(new CustomEvent('from:teach-magic', { detail: { nodeId: node.id } }))
              })}>
              <span className="context-menu-icon">✎</span> Escribir o grabar corrección…
            </button>
          </div>
        )}
      </div>

      {/* Eliminar / Restaurar */}
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        {isInPapelera(node.id) ? (
          <>
            <button className="context-menu-item" onClick={run(restoreNodeFromTrash)}>
              <span className="context-menu-icon">↩</span> Restaurar
            </button>
            <button className="context-menu-item context-menu-item--danger" onClick={run(deleteNode)}>
              <span className="context-menu-icon">✕</span> {t('context.delete')}
            </button>
          </>
        ) : (
          <button className="context-menu-item context-menu-item--danger" onClick={run(deleteNode)}>
            <span className="context-menu-icon">🗑</span> {t('sidebar.trash')}
          </button>
        )}
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
          nodeIds={moveNodeIds}
          onClose={() => { setShowMove(false); onClose() }}
        />
      )}

      {/* ── Modal URL corta — movido a MainLayout para sobrevivir al desmontaje del menú ── */}
    </>
  )
}
