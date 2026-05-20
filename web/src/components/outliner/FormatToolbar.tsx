import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface FormatToolbarProps {
  onFormat: (type: 'bold' | 'italic' | 'code' | 'strikethrough' | 'link') => void
}

// Detecta si hay selección de texto en un contentEditable
function getSelectionInfo(): { text: string; rect: DOMRect | null } {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return { text: '', rect: null }
  const range = sel.getRangeAt(0)
  const text = sel.toString()
  if (!text.trim()) return { text: '', rect: null }
  const rect = range.getBoundingClientRect()
  return { text, rect }
}

export default function FormatToolbar({ onFormat }: FormatToolbarProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleSelectionChange() {
      // Pequeño delay para que la selección se estabilice
      setTimeout(() => {
        const { text, rect } = getSelectionInfo()
        if (!text || !rect) {
          setPos(null)
          return
        }
        // Solo mostrar si el elemento activo es contentEditable
        const active = document.activeElement as HTMLElement
        if (!active?.isContentEditable) { setPos(null); return }

        const toolbarW = 240
        const toolbarH = 36
        let left = rect.left + rect.width / 2 - toolbarW / 2
        let top = rect.top - toolbarH - 8

        // Ajustar si sale de la pantalla
        left = Math.max(8, Math.min(left, window.innerWidth - toolbarW - 8))
        if (top < 8) top = rect.bottom + 8

        setPos({ top, left })
      }, 10)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  // Cerrar al perder selección
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as globalThis.Node)) return
      // Si hace click fuera del toolbar, ocultarlo después de un tick
      setTimeout(() => {
        const { text } = getSelectionInfo()
        if (!text) setPos(null)
      }, 50)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  if (!pos) return null

  const buttons: { icon: string; type: 'bold' | 'italic' | 'code' | 'strikethrough' | 'link'; title: string }[] = [
    { icon: 'B', type: 'bold', title: 'Negrita (⌘B)' },
    { icon: 'I', type: 'italic', title: 'Cursiva (⌘I)' },
    { icon: '<>', type: 'code', title: 'Código (⌘E)' },
    { icon: 'S̶', type: 'strikethrough', title: 'Tachado' },
    { icon: '🔗', type: 'link', title: 'Enlace (⌘K)' },
  ]

  return createPortal(
    <div
      ref={toolbarRef}
      className="format-toolbar"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1500 }}
      onMouseDown={e => e.preventDefault()} // No perder selección
    >
      {buttons.map(btn => (
        <button
          key={btn.type}
          className="format-toolbar-btn"
          title={btn.title}
          onMouseDown={e => {
            e.preventDefault()
            onFormat(btn.type)
          }}
        >
          {btn.icon === 'B' ? <strong>B</strong>
            : btn.icon === 'I' ? <em>I</em>
            : btn.icon === 'S̶' ? <s>S</s>
            : btn.icon}
        </button>
      ))}
    </div>,
    document.body
  )
}
