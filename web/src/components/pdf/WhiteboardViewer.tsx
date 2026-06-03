/**
 * WhiteboardViewer — Pizarra digital SVG.
 *
 * Misma arquitectura que PdfViewer: barra de herramientas + capa SVG.
 * Sin PDF debajo: el canvas es blanco (o del color de fondo del tema).
 * Las anotaciones se guardan en extraData._annotations (mismo formato).
 *
 * Coordenadas normalizadas [0-1] respecto a las dimensiones del SVG.
 * Solo hay 1 "página" (page = 1 siempre).
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { store } from '../../store/nodeStore'

// ── Re-export de tipos para reutilización ─────────────────────────────────
export interface PathAnnotation {
  type: 'path'; page: 1; color: string; width: number; opacity: number
  points: [number, number][]
}
export interface TextAnnotation {
  type: 'text'; page: 1; color: string; x: number; y: number; text: string; fontSize: number
}
export type Annotation = PathAnnotation | TextAnnotation
type Tool = 'pen' | 'highlight' | 'text' | 'eraser'

const COLORS    = ['#1a1a1a','#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#ffffff']
const PEN_SIZES = [2, 4, 8, 14]
const WB_W      = 2400   // px ancho interno del canvas (alta res)
const WB_H      = 1600   // px alto interno del canvas

interface Props {
  nodeId: string
  annotations: Annotation[]
  onAnnotationsChange: (anns: Annotation[]) => void
}

export default function WhiteboardViewer({ nodeId, annotations, onAnnotationsChange }: Props) {
  const svgRef       = useRef<SVGSVGElement>(null)
  const drawingRef   = useRef<PathAnnotation | null>(null)
  const isDrawingRef = useRef(false)

  const [tool,      setTool]      = useState<Tool>('pen')
  const [color,     setColor]     = useState('#1a1a1a')
  const [penSize,   setPenSize]   = useState(4)
  const [textInput, setTextInput] = useState<{ x: number; y: number; svgX: number; svgY: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const textRef = useRef<HTMLInputElement>(null)

  // ── Guardar en extraData ───────────────────────────────────────────────
  const saveToNode = useCallback((anns: Annotation[]) => {
    const n = store.getNode(nodeId)
    if (!n) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(n.extraData || '{}') } catch {}
    ed._annotations = anns
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }, [nodeId])

  const commit = useCallback((anns: Annotation[]) => {
    onAnnotationsChange(anns)
    saveToNode(anns)
  }, [onAnnotationsChange, saveToNode])

  // ── Renderizar anotaciones en SVG ──────────────────────────────────────
  const renderAnnotations = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    // Limpia todo excepto el fondo
    const children = Array.from(svg.children)
    children.forEach(c => { if (c.tagName !== 'rect') svg.removeChild(c) })

    annotations.forEach(ann => {
      if (ann.type === 'path' && ann.points.length >= 2) {
        const d = ann.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0] * WB_W} ${p[1] * WB_H}`).join(' ')
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        el.setAttribute('d', d)
        el.setAttribute('stroke', ann.color)
        el.setAttribute('stroke-width', String(ann.width))
        el.setAttribute('stroke-opacity', String(ann.opacity))
        el.setAttribute('fill', 'none')
        el.setAttribute('stroke-linecap', 'round')
        el.setAttribute('stroke-linejoin', 'round')
        svg.appendChild(el)
      } else if (ann.type === 'text' && ann.text) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        el.setAttribute('x', String(ann.x * WB_W))
        el.setAttribute('y', String(ann.y * WB_H))
        el.setAttribute('fill', ann.color)
        el.setAttribute('font-size', String(ann.fontSize))
        el.setAttribute('font-family', 'system-ui, sans-serif')
        el.textContent = ann.text
        svg.appendChild(el)
      }
    })
  }, [annotations])

  useEffect(() => { renderAnnotations() }, [renderAnnotations])

  // ── Helpers de coordenadas ─────────────────────────────────────────────
  function getSvgPos(e: React.MouseEvent<SVGSVGElement>): [number, number] {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    // Escalar de coordenadas de pantalla a coordenadas SVG (viewBox)
    const scaleX = WB_W / rect.width
    const scaleY = WB_H / rect.height
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
  }
  function getNormPos(e: React.MouseEvent<SVGSVGElement>): [number, number] {
    const [sx, sy] = getSvgPos(e)
    return [sx / WB_W, sy / WB_H]
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (tool === 'text') {
      const [sx, sy] = getSvgPos(e)
      const [nx, ny] = getNormPos(e)
      setTextInput({ x: e.clientX, y: e.clientY, svgX: nx, svgY: ny })
      setTextValue('')
      setTimeout(() => textRef.current?.focus(), 20)
      return
    }
    if (tool === 'eraser') {
      const [nx, ny] = getNormPos(e)
      eraseAt(nx, ny)
      return
    }
    isDrawingRef.current = true
    const [nx, ny] = getNormPos(e)
    drawingRef.current = {
      type: 'path', page: 1, color,
      opacity: tool === 'highlight' ? 0.35 : 1,
      width: tool === 'highlight' ? penSize * 5 : penSize,
      points: [[nx, ny]]
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDrawingRef.current || !drawingRef.current) return
    const [nx, ny] = getNormPos(e)
    drawingRef.current.points.push([nx, ny])
    // Preview
    const svg = e.currentTarget
    const prev = svg.querySelector('.wb-preview')
    if (prev) svg.removeChild(prev)
    const d = drawingRef.current.points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p[0] * WB_W} ${p[1] * WB_H}`
    ).join(' ')
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('class', 'wb-preview')
    el.setAttribute('d', d)
    el.setAttribute('stroke', drawingRef.current.color)
    el.setAttribute('stroke-width', String(drawingRef.current.width))
    el.setAttribute('stroke-opacity', String(drawingRef.current.opacity))
    el.setAttribute('fill', 'none')
    el.setAttribute('stroke-linecap', 'round')
    svg.appendChild(el)
  }

  function handleMouseUp() {
    if (!isDrawingRef.current || !drawingRef.current) return
    isDrawingRef.current = false
    const ann = drawingRef.current; drawingRef.current = null
    if (ann.points.length < 2) return
    commit([...annotations, ann])
  }

  function eraseAt(nx: number, ny: number) {
    const T = 0.03
    const next = annotations.filter(a => {
      if (a.type === 'path') return !a.points.some(([px, py]) => Math.abs(px - nx) < T && Math.abs(py - ny) < T)
      return Math.abs(a.x - nx) > T || Math.abs(a.y - ny) > T
    })
    commit(next)
  }

  function confirmText() {
    if (!textInput || !textValue.trim()) { setTextInput(null); setTextValue(''); return }
    const ann: TextAnnotation = {
      type: 'text', page: 1, color,
      x: textInput.svgX, y: textInput.svgY, text: textValue, fontSize: 24
    }
    commit([...annotations, ann])
    setTextInput(null); setTextValue('')
  }

  const cursorMap: Record<Tool, string> = { pen: 'crosshair', highlight: 'crosshair', eraser: 'cell', text: 'text' }

  return (
    <div className="wb-root">
      {/* Toolbar — idéntico al de PdfViewer */}
      <div className="pdf-viewer-toolbar wb-toolbar">
        <div className="pdf-tb-group">
          {(['pen', 'highlight', 'text', 'eraser'] as Tool[]).map(t => (
            <button key={t} className={`pdf-tb-btn${tool === t ? ' pdf-tb-btn--active' : ''}`}
              onClick={() => setTool(t)}
              title={t === 'pen' ? 'Bolígrafo' : t === 'highlight' ? 'Resaltador' : t === 'text' ? 'Texto' : 'Borrador'}>
              {t === 'pen' ? '✏️' : t === 'highlight' ? '🖍' : t === 'text' ? 'T' : '⌫'}
            </button>
          ))}
        </div>
        <div className="pdf-tb-group">
          {COLORS.map(c => (
            <button key={c} className={`pdf-tb-color${color === c ? ' pdf-tb-color--active' : ''}`}
              style={{ background: c, border: c === '#ffffff' ? '1px solid #ccc' : undefined }}
              onClick={() => setColor(c)} title={c} />
          ))}
        </div>
        {(tool === 'pen' || tool === 'highlight') && (
          <div className="pdf-tb-group">
            {PEN_SIZES.map(s => (
              <button key={s} className={`pdf-tb-size${penSize === s ? ' pdf-tb-size--active' : ''}`}
                onClick={() => setPenSize(s)}>
                <span style={{ width: s * 1.5, height: s * 1.5, background: '#666', borderRadius: '50%', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {annotations.length > 0 && (
          <button className="pdf-tb-btn" onClick={() => commit(annotations.slice(0, -1))} title="Deshacer">↩</button>
        )}
        {annotations.length > 0 && (
          <button className="pdf-tb-btn" onClick={() => commit([])} title="Limpiar pizarra"
            style={{ color: 'var(--red)' }}>🗑</button>
        )}
      </div>

      {/* Canvas SVG */}
      <div className="wb-canvas-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WB_W} ${WB_H}`}
          className="wb-svg"
          style={{ cursor: cursorMap[tool] }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Fondo blanco */}
          <rect x="0" y="0" width={WB_W} height={WB_H} fill="white" />
        </svg>

        {/* Input texto flotante */}
        {textInput && (
          <input
            ref={textRef}
            className="pdf-text-input wb-text-input"
            style={{ left: textInput.x, top: textInput.y, color, position: 'fixed' }}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmText() }
              if (e.key === 'Escape') { setTextInput(null); setTextValue('') }
            }}
            onBlur={confirmText}
            placeholder="Escribe…"
          />
        )}
      </div>
    </div>
  )
}
