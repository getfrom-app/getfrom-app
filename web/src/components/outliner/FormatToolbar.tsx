/**
 * FormatToolbar — Barra flotante de formato estilo Workflowy
 *
 * Aparece SOLO cuando hay texto seleccionado dentro del nodo.
 * Sin selección → completamente invisible, no existe en el DOM.
 *
 * Secciones:
 *   Barra principal: H1 H2 H3 | B I S | <> 🔗 | A (color)
 *   Panel de color (al hacer clic en A):
 *     Texto:     ✕ + 10 colores
 *     Resaltado: ✕ + 10 colores
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type FormatType =
  | 'h1' | 'h2' | 'h3'
  | 'bold' | 'italic' | 'strikethrough' | 'code' | 'underline'
  | 'link'
  | 'text-color' | 'highlight'
  | 'copy'

interface Props {
  onFormat: (type: FormatType, extra?: string) => void
  nodeRef: React.RefObject<HTMLElement>
}

// ── Paleta de colores ─────────────────────────────────────────────────────────
const COLORS = [
  '#ef4444', // Rojo
  '#f97316', // Naranja
  '#eab308', // Amarillo
  '#22c55e', // Verde
  '#14b8a6', // Verde azulado
  '#3b82f6', // Azul
  '#8b5cf6', // Morado
  '#ec4899', // Rosa
  '#a16207', // Marrón
  '#6b7280', // Gris
]

const HIGHLIGHTS = [
  '#fca5a5', // Rojo suave
  '#fdba74', // Naranja suave
  '#fde047', // Amarillo suave
  '#86efac', // Verde suave
  '#5eead4', // Verde azulado suave
  '#93c5fd', // Azul suave
  '#c4b5fd', // Morado suave
  '#f9a8d4', // Rosa suave
  '#d97706', // Ámbar
  '#d1d5db', // Gris suave
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSelectionRectInNode(el: HTMLElement | null): DOMRect | null {
  if (!el) return null
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  if (!sel.toString().trim()) return null
  if (!el.contains(sel.anchorNode)) return null
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FormatToolbar({ onFormat, nodeRef }: Props) {
  const [selRect, setSelRect] = useState<DOMRect | null>(null)
  const [showColors, setShowColors] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Detectar selección dentro del nodo
  useEffect(() => {
    function onSelectionChange() {
      // Pequeño delay para que la selección se estabilice
      setTimeout(() => {
        const rect = getSelectionRectInNode(nodeRef.current ?? null)
        if (!rect) {
          setSelRect(null)
          setShowColors(false)
        } else {
          setSelRect(rect)
        }
      }, 10)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [nodeRef])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return
      setTimeout(() => {
        const rect = getSelectionRectInNode(nodeRef.current ?? null)
        if (!rect) { setSelRect(null); setShowColors(false) }
      }, 50)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [nodeRef])

  // No mostrar nada si no hay selección
  if (!selRect) return null

  // ── Posición ──────────────────────────────────────────────────────────────
  const MAIN_W   = 260
  const COLOR_W  = 236
  const W = showColors ? COLOR_W : MAIN_W
  const H = showColors ? 100 : 36

  let left = selRect.left + selRect.width / 2 - W / 2
  let top  = selRect.top - H - 10
  left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
  if (top < 8) top = selRect.bottom + 8

  // ── Helpers de botón ──────────────────────────────────────────────────────
  const Btn = ({
    children, type, extra, title, style
  }: {
    children: React.ReactNode
    type: FormatType
    extra?: string
    title: string
    style?: React.CSSProperties
  }) => (
    <button
      className="ft-btn"
      title={title}
      style={style}
      onMouseDown={e => {
        e.preventDefault()
        onFormat(type, extra)
        setShowColors(false)
      }}
    >
      {children}
    </button>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return createPortal(
    <div
      ref={toolbarRef}
      className="wf-format-toolbar"
      style={{ top, left, width: W }}
      onMouseDown={e => e.preventDefault()}
    >
      {!showColors ? (
        // ── Barra principal ───────────────────────────────────────────────
        <>
          <Btn type="h1" title="Título 1">
            <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '-0.5px' }}>H1</span>
          </Btn>
          <Btn type="h2" title="Título 2">
            <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '-0.5px' }}>H2</span>
          </Btn>
          <Btn type="h3" title="Título 3">
            <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '-0.5px' }}>H3</span>
          </Btn>

          <div className="ft-sep" />

          <Btn type="bold" title="Negrita (⌘B)">
            <strong style={{ fontSize: 13 }}>B</strong>
          </Btn>
          <Btn type="italic" title="Cursiva (⌘I)">
            <em style={{ fontSize: 13 }}>I</em>
          </Btn>
          <Btn type="strikethrough" title="Tachado">
            <s style={{ fontSize: 13 }}>S</s>
          </Btn>

          <div className="ft-sep" />

          <Btn type="code" title="Código (⌘E)">
            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{'<>'}</span>
          </Btn>
          <Btn type="link" title="Enlace (⌘K)">
            <span style={{ fontSize: 12 }}>🔗</span>
          </Btn>

          <div className="ft-sep" />

          {/* Botón de color — abre el panel */}
          <button
            className="ft-btn"
            title="Color de texto / resaltado"
            onMouseDown={e => { e.preventDefault(); setShowColors(true) }}
          >
            <span style={{
              fontWeight: 700, fontSize: 13,
              borderBottom: '2.5px solid #ef4444',
              paddingBottom: 0, lineHeight: 1,
            }}>A</span>
          </button>
        </>
      ) : (
        // ── Panel de color estilo Workflowy ───────────────────────────────
        <div className="ft-color-panel">
          {/* Texto */}
          <div className="ft-color-row">
            <span className="ft-color-label">Texto</span>
            {/* Borrador de color de texto */}
            <button
              className="ft-btn ft-erase-btn"
              title="Quitar color"
              onMouseDown={e => { e.preventDefault(); onFormat('text-color', '') }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {COLORS.map(c => (
              <button
                key={c}
                className="ft-color-swatch"
                title={c}
                onMouseDown={e => { e.preventDefault(); onFormat('text-color', c) }}
              >
                <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>A</span>
              </button>
            ))}
          </div>

          {/* Resaltado */}
          <div className="ft-color-row">
            <span className="ft-color-label">Resaltado</span>
            {/* Borrador de resaltado */}
            <button
              className="ft-btn ft-erase-btn"
              title="Quitar resaltado"
              onMouseDown={e => { e.preventDefault(); onFormat('highlight', '') }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {HIGHLIGHTS.map(c => (
              <button
                key={c}
                className="ft-color-swatch"
                title={c}
                onMouseDown={e => { e.preventDefault(); onFormat('highlight', c) }}
              >
                <span style={{
                  fontWeight: 700, fontSize: 12,
                  background: c, borderRadius: 2, padding: '0 2px',
                  color: '#222',
                }}>A</span>
              </button>
            ))}
          </div>

          {/* Pie */}
          <div className="ft-color-footer">
            <button
              className="ft-back-btn"
              onMouseDown={e => { e.preventDefault(); setShowColors(false) }}
            >‹ volver</button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>⌘⇧H</span>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
