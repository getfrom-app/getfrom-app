/**
 * FormatToolbar — Barra flotante estilo Workflowy
 * Aparece encima del texto seleccionado dentro de cualquier contentEditable del outliner.
 * Fondo oscuro, botones: H1 H2 H3 | B I S | ~~ code | 🔗 | color
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type FormatType =
  | 'h1' | 'h2' | 'h3'
  | 'bold' | 'italic' | 'strikethrough'
  | 'code' | 'underline'
  | 'link'
  | 'color'
  | 'copy'

interface FormatToolbarProps {
  onFormat: (type: FormatType, extra?: string) => void
  nodeRef: React.RefObject<HTMLElement>  // solo muestra si la selección está en este nodo
}

const TEXT_COLORS = [
  { label: 'Rojo',     value: '#ef4444' },
  { label: 'Naranja',  value: '#f97316' },
  { label: 'Amarillo', value: '#eab308' },
  { label: 'Verde',    value: '#22c55e' },
  { label: 'Azul',     value: '#3b82f6' },
  { label: 'Morado',   value: '#8b5cf6' },
  { label: 'Rosa',     value: '#ec4899' },
  { label: 'Por defecto', value: '' },
]

function getSelectionRectInNode(nodeEl: HTMLElement | null): DOMRect | null {
  if (!nodeEl) return null
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  if (!sel.toString().trim()) return null
  // Solo si la selección está dentro de ESTE nodo
  if (!nodeEl.contains(sel.anchorNode)) return null
  return sel.getRangeAt(0).getBoundingClientRect()
}

export default function FormatToolbar({ onFormat, nodeRef }: FormatToolbarProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [showColors, setShowColors] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleSelectionChange() {
      setTimeout(() => {
        const rect = getSelectionRectInNode(nodeRef.current)
        if (!rect || rect.width === 0) {
          setPos(null)
          setShowColors(false)
          return
        }
        const TOOLBAR_W = showColors ? 192 : 292
        const TOOLBAR_H = 36
        let left = rect.left + rect.width / 2 - TOOLBAR_W / 2
        let top  = rect.top - TOOLBAR_H - 8
        left = Math.max(8, Math.min(left, window.innerWidth - TOOLBAR_W - 8))
        if (top < 8) top = rect.bottom + 8
        setPos({ top, left })
      }, 10)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [showColors])

  // Ocultar si el click es fuera del toolbar
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as globalThis.Node)) return
      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) { setPos(null); setShowColors(false) }
      }, 50)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  if (!pos) return null

  const btn = (label: React.ReactNode, type: FormatType, title: string, extra?: string) => (
    <button
      key={String(label) + type}
      className="ft-btn"
      title={title}
      onMouseDown={e => {
        e.preventDefault()
        onFormat(type, extra)
        if (type !== 'color') setShowColors(false)
      }}
    >
      {label}
    </button>
  )

  return createPortal(
    <div
      ref={toolbarRef}
      className="wf-format-toolbar"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.preventDefault()}
    >
      {!showColors ? (
        <>
          {/* Headings */}
          {btn(<span style={{ fontWeight: 700, fontSize: 11 }}>H1</span>, 'h1', 'Título 1')}
          {btn(<span style={{ fontWeight: 700, fontSize: 11 }}>H2</span>, 'h2', 'Título 2')}
          {btn(<span style={{ fontWeight: 700, fontSize: 11 }}>H3</span>, 'h3', 'Título 3')}
          <div className="ft-sep" />
          {/* Formato de texto */}
          {btn(<strong style={{ fontSize: 13 }}>B</strong>, 'bold', 'Negrita (⌘B)')}
          {btn(<em style={{ fontSize: 13 }}>I</em>, 'italic', 'Cursiva (⌘I)')}
          {btn(<s style={{ fontSize: 13 }}>S</s>, 'strikethrough', 'Tachado')}
          <div className="ft-sep" />
          {/* Code y enlace */}
          {btn(<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{'<>'}</span>, 'code', 'Código (⌘E)')}
          {btn(<span style={{ fontSize: 13 }}>🔗</span>, 'link', 'Enlace (⌘K)')}
          <div className="ft-sep" />
          {/* Color */}
          <button
            className="ft-btn ft-color-btn"
            title="Color de texto"
            onMouseDown={e => { e.preventDefault(); setShowColors(v => !v) }}
          >
            <span style={{
              fontWeight: 700, fontSize: 12,
              borderBottom: '2px solid #ef4444',
              lineHeight: 1,
              paddingBottom: 1,
            }}>A</span>
          </button>
        </>
      ) : (
        /* Panel de colores */
        <>
          <button className="ft-btn" title="Volver" onMouseDown={e => { e.preventDefault(); setShowColors(false) }}>
            ‹
          </button>
          <div className="ft-sep" />
          {TEXT_COLORS.map(c => (
            <button
              key={c.value || 'default'}
              className="ft-btn"
              title={c.label}
              onMouseDown={e => {
                e.preventDefault()
                onFormat('color', c.value)
                setShowColors(false)
              }}
            >
              {c.value ? (
                <span style={{
                  display: 'inline-block', width: 14, height: 14,
                  borderRadius: '50%', background: c.value,
                  border: '1.5px solid rgba(255,255,255,0.3)',
                }} />
              ) : (
                <span style={{ fontSize: 11, opacity: 0.6 }}>✕</span>
              )}
            </button>
          ))}
        </>
      )}
    </div>,
    document.body
  )
}
