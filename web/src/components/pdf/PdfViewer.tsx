/**
 * PdfViewer — Visor PDF con anotaciones persistentes.
 *
 * - Renderiza el PDF con PDF.js (canvas por página)
 * - Capa SVG para dibujar encima (pen, highlight, text)
 * - Anotaciones guardadas en el nodo (extraData._annotations)
 * - Botón "Guardar en PDF" incrusta anotaciones en el archivo con pdf-lib y sube a R2
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { store } from '../../store/nodeStore'
import { uploadFile } from '../../api/client'

// ── Tipos ────────────────────────────────────────────────────────────────────
type Tool = 'pen' | 'highlight' | 'text' | 'eraser'
type Color = string

interface PathAnnotation {
  type: 'path'
  page: number
  color: Color
  width: number
  opacity: number
  points: [number, number][]  // coordenadas normalizadas [0-1] respecto a la página
}
interface TextAnnotation {
  type: 'text'
  page: number
  color: Color
  x: number; y: number      // normalizados
  text: string
  fontSize: number
}
type Annotation = PathAnnotation | TextAnnotation

interface Props {
  url: string
  nodeId: string
  filename: string
  resourceKey?: string
  onUrlUpdated?: (newUrl: string) => void
}

// ── Colores y tamaños ────────────────────────────────────────────────────────
const COLORS = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#000000','#ffffff']
const PEN_SIZES = [2, 4, 6, 10]

export default function PdfViewer({ url, nodeId, filename, resourceKey, onUrlUpdated }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRefs    = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const svgRefs       = useRef<Map<number, SVGSVGElement>>(new Map())

  const [numPages,    setNumPages]    = useState(0)
  const [pageWidths,  setPageWidths]  = useState<number[]>([])
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [scale,       setScale]       = useState(1.5)
  const [tool,        setTool]        = useState<Tool>('pen')
  const [color,       setColor]       = useState('#e53e3e')
  const [penSize,     setPenSize]     = useState(3)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [textInput,   setTextInput]   = useState<{page:number;x:number;y:number}|null>(null)
  const [textValue,   setTextValue]   = useState('')

  const pdfDocRef    = useRef<any>(null)
  const drawingRef   = useRef<PathAnnotation | null>(null)
  const isDrawingRef = useRef(false)

  // ── Cargar anotaciones guardadas ─────────────────────────────────────────
  useEffect(() => {
    try {
      const ed = JSON.parse(store.getNode(nodeId)?.extraData || '{}')
      if (Array.isArray(ed._annotations)) setAnnotations(ed._annotations)
    } catch {}
  }, [nodeId])

  // ── Guardar anotaciones en el nodo ───────────────────────────────────────
  const saveAnnotationsToNode = useCallback((anns: Annotation[]) => {
    const node = store.getNode(nodeId)
    if (!node) return
    let ed: Record<string,unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    ed._annotations = anns
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }, [nodeId])

  // ── Cargar PDF con PDF.js ────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return
    let cancelled = false
    setLoading(true)

    async function load() {
      const pdfjsLib = await import('pdfjs-dist')
      // Worker necesario para PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const doc = await pdfjsLib.getDocument({ url }).promise
      if (cancelled) return
      pdfDocRef.current = doc
      setNumPages(doc.numPages)

      const ws: number[] = []; const hs: number[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale })
        ws.push(vp.width); hs.push(vp.height)
      }
      if (cancelled) return
      setPageWidths(ws); setPageHeights(hs)
      setLoading(false)
    }
    load().catch(console.error)
    return () => { cancelled = true }
  }, [url, scale])

  // ── Renderizar páginas ───────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return
    async function renderAll() {
      const pdfjsLib = await import('pdfjs-dist')
      for (let i = 1; i <= numPages; i++) {
        const canvas = canvasRefs.current.get(i)
        if (!canvas) continue
        const page = await pdfDocRef.current.getPage(i)
        const vp = page.getViewport({ scale })
        canvas.width = vp.width; canvas.height = vp.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport: vp }).promise
      }
    }
    renderAll().catch(console.error)
  }, [numPages, pageWidths, scale])

  // ── Dibujar anotaciones SVG ──────────────────────────────────────────────
  useEffect(() => {
    for (const [page, svg] of svgRefs.current.entries()) {
      renderSvgAnnotations(svg, page)
    }
  }, [annotations])

  function renderSvgAnnotations(svg: SVGSVGElement, page: number) {
    // Limpiar anotaciones (preservar el grupo de dibujo activo)
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const w = pageWidths[page-1] || svg.clientWidth
    const h = pageHeights[page-1] || svg.clientHeight

    for (const ann of annotations.filter(a => a.page === page)) {
      if (ann.type === 'path') {
        if (ann.points.length < 2) continue
        const d = ann.points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'} ${p[0]*w} ${p[1]*h}`
        ).join(' ')
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', d)
        path.setAttribute('stroke', ann.color)
        path.setAttribute('stroke-width', String(ann.width))
        path.setAttribute('stroke-opacity', String(ann.opacity))
        path.setAttribute('fill', 'none')
        path.setAttribute('stroke-linecap', 'round')
        path.setAttribute('stroke-linejoin', 'round')
        svg.appendChild(path)
      } else if (ann.type === 'text') {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', String(ann.x * w))
        text.setAttribute('y', String(ann.y * h))
        text.setAttribute('fill', ann.color)
        text.setAttribute('font-size', String(ann.fontSize))
        text.setAttribute('font-family', 'system-ui, sans-serif')
        text.textContent = ann.text
        svg.appendChild(text)
      }
    }
  }

  // ── Dibujo con ratón ─────────────────────────────────────────────────────
  function getRelativePos(e: React.MouseEvent | MouseEvent, el: Element): [number, number] {
    const rect = el.getBoundingClientRect()
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>, page: number) {
    if (tool === 'text') {
      const [x, y] = getRelativePos(e, e.currentTarget)
      setTextInput({ page, x, y })
      setTextValue('')
      return
    }
    if (tool === 'eraser') {
      // Borrar anotaciones cercanas
      const [x, y] = getRelativePos(e, e.currentTarget)
      eraseAt(page, x, y)
      return
    }
    isDrawingRef.current = true
    const [x, y] = getRelativePos(e, e.currentTarget)
    const isHighlight = tool === 'highlight'
    drawingRef.current = {
      type: 'path', page,
      color: isHighlight ? (color === '#000000' ? '#fbbf24' : color) : color,
      width: isHighlight ? penSize * 6 : penSize,
      opacity: isHighlight ? 0.35 : 1,
      points: [[x, y]],
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDrawingRef.current || !drawingRef.current) return
    const [x, y] = getRelativePos(e, e.currentTarget)
    drawingRef.current.points.push([x, y])
    // Preview inline: renderizar solo el path activo
    const svg = e.currentTarget
    const last = svg.querySelector('.drawing-preview')
    if (last) svg.removeChild(last)
    const w = svg.clientWidth; const h = svg.clientHeight
    const d = drawingRef.current.points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p[0]*w} ${p[1]*h}`
    ).join(' ')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'drawing-preview')
    path.setAttribute('d', d)
    path.setAttribute('stroke', drawingRef.current.color)
    path.setAttribute('stroke-width', String(drawingRef.current.width))
    path.setAttribute('stroke-opacity', String(drawingRef.current.opacity))
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
  }

  function handleMouseUp() {
    if (!isDrawingRef.current || !drawingRef.current) return
    isDrawingRef.current = false
    const ann = drawingRef.current
    drawingRef.current = null
    if (ann.points.length < 2) return
    const next = [...annotations, ann]
    setAnnotations(next)
    saveAnnotationsToNode(next)
  }

  function eraseAt(page: number, x: number, y: number) {
    const THRESHOLD = 0.04
    const next = annotations.filter(ann => {
      if (ann.page !== page) return true
      if (ann.type === 'path') {
        return !ann.points.some(([px, py]) =>
          Math.abs(px - x) < THRESHOLD && Math.abs(py - y) < THRESHOLD
        )
      }
      if (ann.type === 'text') {
        return Math.abs(ann.x - x) > THRESHOLD || Math.abs(ann.y - y) > THRESHOLD
      }
      return true
    })
    setAnnotations(next)
    saveAnnotationsToNode(next)
  }

  function confirmTextInput() {
    if (!textInput || !textValue.trim()) { setTextInput(null); return }
    const ann: TextAnnotation = {
      type: 'text', page: textInput.page,
      color, x: textInput.x, y: textInput.y,
      text: textValue, fontSize: 16,
    }
    const next = [...annotations, ann]
    setAnnotations(next)
    saveAnnotationsToNode(next)
    setTextInput(null)
    setTextValue('')
  }

  function handleUndo() {
    const next = annotations.slice(0, -1)
    setAnnotations(next)
    saveAnnotationsToNode(next)
  }

  function handleClearPage(page: number) {
    const next = annotations.filter(a => a.page !== page)
    setAnnotations(next)
    saveAnnotationsToNode(next)
  }

  // ── Guardar en PDF (pdf-lib incrusta anotaciones) ────────────────────────
  async function handleSavePdf() {
    if (!url) return
    setSaving(true)
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')

      // Descargar PDF original
      const pdfBytes = await fetch(url).then(r => r.arrayBuffer())
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pages = pdfDoc.getPages()

      // Para cada anotación tipo path: dibujar con pdf-lib
      for (const ann of annotations) {
        const pageIdx = ann.page - 1
        if (pageIdx < 0 || pageIdx >= pages.length) continue
        const page = pages[pageIdx]
        const { width, height } = page.getSize()

        if (ann.type === 'path' && ann.points.length >= 2) {
          const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1,3),16)/255
            const g = parseInt(hex.slice(3,5),16)/255
            const b = parseInt(hex.slice(5,7),16)/255
            return rgb(r,g,b)
          }
          const c = hexToRgb(ann.color === '#ffffff' ? '#cccccc' : ann.color)
          // Dibujar segmentos de línea
          for (let i = 1; i < ann.points.length; i++) {
            const [x1,y1] = ann.points[i-1]
            const [x2,y2] = ann.points[i]
            page.drawLine({
              start: { x: x1*width, y: height - y1*height },
              end:   { x: x2*width, y: height - y2*height },
              thickness: ann.width / scale,
              color: c,
              opacity: ann.opacity,
            })
          }
        } else if (ann.type === 'text') {
          const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1,3),16)/255
            const g = parseInt(hex.slice(3,5),16)/255
            const b = parseInt(hex.slice(5,7),16)/255
            return rgb(r,g,b)
          }
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
          page.drawText(ann.text, {
            x: ann.x * width,
            y: height - ann.y * height,
            size: ann.fontSize / scale,
            font,
            color: hexToRgb(ann.color),
          })
        }
      }

      // Serializar y subir a R2
      const newBytes = await pdfDoc.save()
      const blob = new Blob([newBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const file = new File([blob], filename + '.pdf', { type: 'application/pdf' })
      const { key, publicUrl } = await uploadFile(file)

      // Actualizar nodo con nueva URL y key
      const node = store.getNode(nodeId)
      if (node) {
        let ed: Record<string,unknown> = {}
        try { ed = JSON.parse(node.extraData || '{}') } catch {}
        ed._resourceUrl = publicUrl
        ed._resourceKey = key
        store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
      }
      onUrlUpdated?.(publicUrl)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: '✓ PDF guardado con anotaciones', type: 'success' } }))
    } catch (e) {
      console.error('[PdfViewer] save error:', e)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: '✗ Error guardando PDF', type: 'error' } }))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const cursorMap: Record<Tool, string> = {
    pen: 'crosshair', highlight: 'crosshair', eraser: 'cell', text: 'text'
  }

  return (
    <div className="pdf-viewer-root">
      {/* Toolbar */}
      <div className="pdf-viewer-toolbar">
        {/* Herramientas */}
        <div className="pdf-tb-group">
          {(['pen','highlight','text','eraser'] as Tool[]).map(t => (
            <button key={t} className={`pdf-tb-btn ${tool===t?'pdf-tb-btn--active':''}`}
              onClick={() => setTool(t)} title={t}>
              {t==='pen'?'✏️':t==='highlight'?'🖍':t==='text'?'T':'⌫'}
            </button>
          ))}
        </div>

        {/* Colores */}
        <div className="pdf-tb-group">
          {COLORS.map(c => (
            <button key={c} className={`pdf-tb-color ${color===c?'pdf-tb-color--active':''}`}
              style={{ background: c, border: c==='#ffffff'?'1px solid #ccc':undefined }}
              onClick={() => setColor(c)} title={c} />
          ))}
        </div>

        {/* Tamaño del trazo */}
        {(tool === 'pen' || tool === 'highlight') && (
          <div className="pdf-tb-group">
            {PEN_SIZES.map(s => (
              <button key={s} className={`pdf-tb-size ${penSize===s?'pdf-tb-size--active':''}`}
                onClick={() => setPenSize(s)}>
                <span style={{ width: s*1.5, height: s*1.5, background: '#666', borderRadius: '50%', display:'block' }} />
              </button>
            ))}
          </div>
        )}

        {/* Zoom */}
        <div className="pdf-tb-group">
          <button className="pdf-tb-btn" onClick={() => setScale(s => Math.max(0.5, s-0.25))} title="Alejar">−</button>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '0 4px' }}>{Math.round(scale*100)}%</span>
          <button className="pdf-tb-btn" onClick={() => setScale(s => Math.min(3, s+0.25))} title="Acercar">+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Deshacer */}
        {annotations.length > 0 && (
          <button className="pdf-tb-btn" onClick={handleUndo} title="Deshacer">↩</button>
        )}

        {/* Guardar en PDF */}
        {annotations.length > 0 && (
          <button className="pdf-tb-save" onClick={handleSavePdf} disabled={saving}>
            {saving ? '⏳ Guardando…' : '💾 Guardar en PDF'}
          </button>
        )}
      </div>

      {/* Páginas */}
      <div className="pdf-viewer-pages" ref={containerRef}>
        {loading && (
          <div className="pdf-viewer-loading">
            <div className="footer-spinner" /> Cargando PDF…
          </div>
        )}
        {Array.from({ length: numPages }, (_, i) => {
          const page = i + 1
          const w = pageWidths[i] || 0
          const h = pageHeights[i] || 0
          return (
            <div key={page} className="pdf-viewer-page" style={{ width: w, height: h }}>
              <canvas
                ref={el => { if (el) canvasRefs.current.set(page, el) }}
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
              <svg
                ref={el => { if (el) { svgRefs.current.set(page, el); renderSvgAnnotations(el, page) } }}
                className="pdf-viewer-svg"
                style={{ cursor: cursorMap[tool] }}
                onMouseDown={e => handleMouseDown(e, page)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              {/* Input texto flotante */}
              {textInput?.page === page && (
                <input
                  autoFocus
                  className="pdf-text-input"
                  style={{
                    left: textInput.x * w,
                    top: textInput.y * h,
                    color,
                  }}
                  value={textValue}
                  onChange={e => setTextValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmTextInput() }
                    if (e.key === 'Escape') { setTextInput(null); setTextValue('') }
                  }}
                  onBlur={confirmTextInput}
                  placeholder="Escribe…"
                />
              )}
              {/* Número de página */}
              <div className="pdf-page-num">Pág. {page} / {numPages}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
