/**
 * PdfViewer — Visor PDF con anotaciones persistentes.
 * - PDF.js para renderizar en canvas
 * - SVG overlay para anotaciones (pen, highlight, text, eraser)
 * - Auto-guardado en extraData inmediato + re-subida a R2 con debounce 3s
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { store } from '../../store/nodeStore'
import { uploadFile, fetchFileContent } from '../../api/client'

type Tool = 'pen' | 'highlight' | 'text' | 'eraser'

interface PathAnnotation {
  type: 'path'; page: number; color: string; width: number; opacity: number
  points: [number, number][]
}
interface TextAnnotation {
  type: 'text'; page: number; color: string; x: number; y: number; text: string; fontSize: number
}
type Annotation = PathAnnotation | TextAnnotation

interface Props {
  url: string; nodeId: string; filename: string; resourceKey?: string
  annotations: Annotation[]
  onAnnotationsChange: (anns: Annotation[]) => void
}

export type { Annotation, PathAnnotation, TextAnnotation }

const COLORS    = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#000000']
const PEN_SIZES = [2, 4, 6, 10]

export default function PdfViewer({ url, nodeId, filename, resourceKey, annotations, onAnnotationsChange }: Props) {
  const canvasRefs   = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const svgRefs      = useRef<Map<number, SVGSVGElement>>(new Map())
  const pdfDocRef    = useRef<any>(null)
  const drawingRef   = useRef<PathAnnotation | null>(null)
  const isDrawingRef = useRef(false)
  const autoSaveTimer= useRef<ReturnType<typeof setTimeout>|null>(null)
  const isSavingRef  = useRef(false)
  const pendingSave  = useRef(false)

  const [numPages,    setNumPages]    = useState(0)
  const [pageWidths,  setPageWidths]  = useState<number[]>([])
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [scale,       setScale]       = useState(1.0)  // se recalcula al cargar la primera página
  const scaleInitialized = useRef(false)
  const [tool,        setTool]        = useState<Tool>('pen')
  const [color,       setColor]       = useState('#e53e3e')
  const [penSize,     setPenSize]     = useState(3)
  // annotations viene del padre (NodeView) — sobrevive al unmount/remount de PdfViewer
  const [loading,     setLoading]     = useState(true)
  const [saveStatus,  setSaveStatus]  = useState<'idle'|'saving'|'saved'>('idle')
  // Text tool
  const [textInput,   setTextInput]   = useState<{page:number;x:number;y:number;pxX:number;pxY:number}|null>(null)
  const [textValue,   setTextValue]   = useState('')
  const textInputRef  = useRef<HTMLInputElement>(null)

  // Las anotaciones vienen del padre (NodeView) — no se cargan aquí

  // ── Guardar anotaciones en el nodo (extraData) ─────────────────────────────
  const saveToNode = useCallback((anns: Annotation[]) => {
    const node = store.getNode(nodeId)
    if (!node) return
    let ed: Record<string,unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    ed._annotations = anns
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }, [nodeId])

  // ── Auto-guardar en PDF (debounce 3s) ──────────────────────────────────────
  const savePdfBackground = useCallback(async (anns: Annotation[]) => {
    if (isSavingRef.current) { pendingSave.current = true; return }
    if (!resourceKey) return
    isSavingRef.current = true
    setSaveStatus('saving')
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
      const pdfBytes = await fetchFileContent(resourceKey)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pages = pdfDoc.getPages()

      for (const ann of anns) {
        const pageIdx = ann.page - 1
        if (pageIdx < 0 || pageIdx >= pages.length) continue
        const page = pages[pageIdx]
        const { width: pw, height: ph } = page.getSize()
        const hexRgb = (hex: string) => {
          const r = parseInt(hex.slice(1,3),16)/255
          const g = parseInt(hex.slice(3,5),16)/255
          const b = parseInt(hex.slice(5,7),16)/255
          return rgb(r,g,b)
        }
        if (ann.type === 'path' && ann.points.length >= 2) {
          for (let i = 1; i < ann.points.length; i++) {
            const [x1,y1] = ann.points[i-1]; const [x2,y2] = ann.points[i]
            page.drawLine({ start:{x:x1*pw,y:ph-y1*ph}, end:{x:x2*pw,y:ph-y2*ph},
              thickness: ann.width/scale, color: hexRgb(ann.color), opacity: ann.opacity })
          }
        } else if (ann.type === 'text' && ann.text) {
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
          page.drawText(ann.text, { x:ann.x*pw, y:ph-ann.y*ph,
            size: ann.fontSize/scale, font, color: hexRgb(ann.color) })
        }
      }

      const newBytes = await pdfDoc.save()
      const blob = new Blob([newBytes.buffer as ArrayBuffer], { type:'application/pdf' })
      const file = new File([blob], filename+'.pdf', { type:'application/pdf' })
      const { key, publicUrl } = await uploadFile(file)
      const node = store.getNode(nodeId)
      if (node) {
        let ed: Record<string,unknown> = {}; try { ed = JSON.parse(node.extraData||'{}') } catch {}
        ed._resourceUrl = publicUrl; ed._resourceKey = key
        store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
      }
      // NO llamar onUrlUpdated — evita re-render de NodeView → re-creación de props → bucle de guardado
      // La nueva URL/key ya está en extraData y se usará la próxima vez que se abra el nodo.
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      console.error('[PdfViewer] auto-save error:', e)
      setSaveStatus('idle')
    } finally {
      isSavingRef.current = false
      if (pendingSave.current) { pendingSave.current = false; savePdfBackground(anns) }
    }
  }, [resourceKey, nodeId, filename, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleAutoSave = useCallback((anns: Annotation[]) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => savePdfBackground(anns), 3000)
  }, [savePdfBackground])

  // Guardar al desmontar
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); savePdfBackground(annotations) }
    }
  }, [annotations, savePdfBackground]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar PDF ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return
    let cancelled = false; setLoading(true)
    async function load() {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
      let pdfSource: {data:Uint8Array}|{url:string}
      if (resourceKey) {
        const bytes = await fetchFileContent(resourceKey)
        pdfSource = { data: new Uint8Array(bytes) }
      } else { pdfSource = { url } }
      const doc = await pdfjsLib.getDocument(pdfSource).promise
      if (cancelled) return
      pdfDocRef.current = doc; setNumPages(doc.numPages)

      // Calcular scale para ajustar al ancho del contenedor (igual que el iframe del navegador)
      // Solo en el primer load — si el usuario ya ajustó el zoom, no sobreescribir
      let effectiveScale = scale
      if (!scaleInitialized.current) {
        const firstPage = await doc.getPage(1)
        const vpAt1 = firstPage.getViewport({ scale: 1 })
        // Ancho disponible: ancho del visor ~800px menos padding
        const containerW = document.querySelector('.pdf-viewer-pages')?.clientWidth || 780
        const fitScale = Math.max(0.5, Math.min(2.5, (containerW - 48) / vpAt1.width))
        effectiveScale = Math.round(fitScale * 4) / 4  // snap a 0.25
        setScale(effectiveScale)
        scaleInitialized.current = true
      }

      const ws: number[] = []; const hs: number[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i); const vp = page.getViewport({scale: effectiveScale})
        ws.push(vp.width); hs.push(vp.height)
      }
      if (cancelled) return
      setPageWidths(ws); setPageHeights(hs); setLoading(false)
    }
    load().catch(console.error)
    return () => { cancelled = true }
  }, [url, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Renderizar páginas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return
    async function renderAll() {
      for (let i = 1; i <= numPages; i++) {
        const canvas = canvasRefs.current.get(i); if (!canvas) continue
        const page = await pdfDocRef.current.getPage(i)
        const vp = page.getViewport({scale})
        canvas.width = vp.width; canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
      }
    }
    renderAll().catch(console.error)
  }, [numPages, scale])

  // ── Renderizar SVG ────────────────────────────────────────────────────────
  const renderSvg = useCallback((svg: SVGSVGElement, page: number, anns: Annotation[]) => {
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    const w = pageWidths[page-1] || svg.clientWidth || 1
    const h = pageHeights[page-1] || svg.clientHeight || 1
    for (const ann of anns.filter(a => a.page === page)) {
      if (ann.type === 'path' && ann.points.length >= 2) {
        const d = ann.points.map((p,i) => `${i===0?'M':'L'} ${p[0]*w} ${p[1]*h}`).join(' ')
        const el = document.createElementNS('http://www.w3.org/2000/svg','path')
        el.setAttribute('d',d); el.setAttribute('stroke',ann.color)
        el.setAttribute('stroke-width',String(ann.width))
        el.setAttribute('stroke-opacity',String(ann.opacity))
        el.setAttribute('fill','none'); el.setAttribute('stroke-linecap','round')
        el.setAttribute('stroke-linejoin','round')
        svg.appendChild(el)
      } else if (ann.type === 'text') {
        const el = document.createElementNS('http://www.w3.org/2000/svg','text')
        el.setAttribute('x',String(ann.x*w)); el.setAttribute('y',String(ann.y*h))
        el.setAttribute('fill',ann.color); el.setAttribute('font-size',String(ann.fontSize))
        el.setAttribute('font-family','system-ui,sans-serif'); el.textContent = ann.text
        svg.appendChild(el)
      }
    }
  }, [pageWidths, pageHeights])

  // Re-dibujar anotaciones cuando cambian O cuando el PDF termina de cargar (numPages > 0).
  // Sin numPages en deps, las anotaciones se dibujan cuando los SVG refs aún están vacíos.
  useEffect(() => {
    if (numPages === 0) return
    // Pequeño delay para asegurar que el DOM de las páginas está montado
    const t = setTimeout(() => {
      for (const [page, svg] of svgRefs.current.entries()) renderSvg(svg, page, annotations)
    }, 50)
    return () => clearTimeout(t)
  }, [annotations, renderSvg, numPages])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getRelPos(e: React.MouseEvent|MouseEvent, el: Element): [number,number] {
    const r = el.getBoundingClientRect()
    return [(e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height]
  }
  function getAbsPos(e: React.MouseEvent, el: Element): [number,number] {
    const r = el.getBoundingClientRect()
    return [e.clientX-r.left, e.clientY-r.top]
  }

  // ── Eventos de dibujo ─────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>, page: number) {
    if (tool === 'text') {
      e.stopPropagation()
      const [rx, ry] = getRelPos(e, e.currentTarget)
      const [ax, ay] = getAbsPos(e, e.currentTarget)
      setTextInput({ page, x: rx, y: ry, pxX: ax, pxY: ay })
      setTextValue('')
      setTimeout(() => textInputRef.current?.focus(), 20)
      return
    }
    if (tool === 'eraser') {
      const [x,y] = getRelPos(e, e.currentTarget)
      eraseAt(page, x, y); return
    }
    isDrawingRef.current = true
    const [x,y] = getRelPos(e, e.currentTarget)
    drawingRef.current = {
      type:'path', page, color, opacity: tool==='highlight'?0.35:1,
      width: tool==='highlight'?penSize*5:penSize, points:[[x,y]]
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDrawingRef.current || !drawingRef.current) return
    const [x,y] = getRelPos(e, e.currentTarget)
    drawingRef.current.points.push([x,y])
    // Preview en SVG
    const svg = e.currentTarget
    const prev = svg.querySelector('.pdf-preview'); if (prev) svg.removeChild(prev)
    const w = svg.clientWidth; const h = svg.clientHeight
    const d = drawingRef.current.points.map((p,i)=>`${i===0?'M':'L'} ${p[0]*w} ${p[1]*h}`).join(' ')
    const el = document.createElementNS('http://www.w3.org/2000/svg','path')
    el.setAttribute('class','pdf-preview'); el.setAttribute('d',d)
    el.setAttribute('stroke',drawingRef.current.color)
    el.setAttribute('stroke-width',String(drawingRef.current.width))
    el.setAttribute('stroke-opacity',String(drawingRef.current.opacity))
    el.setAttribute('fill','none'); el.setAttribute('stroke-linecap','round')
    svg.appendChild(el)
  }

  function handleMouseUp() {
    if (!isDrawingRef.current || !drawingRef.current) return
    isDrawingRef.current = false
    const ann = drawingRef.current; drawingRef.current = null
    if (ann.points.length < 2) return
    const next = [...annotations, ann]
    onAnnotationsChange(next); saveToNode(next); scheduleAutoSave(next)
  }

  function eraseAt(page: number, x: number, y: number) {
    const T = 0.05
    const next = annotations.filter(a => {
      if (a.page !== page) return true
      if (a.type === 'path') return !a.points.some(([px,py])=>Math.abs(px-x)<T&&Math.abs(py-y)<T)
      return Math.abs(a.x-x)>T||Math.abs(a.y-y)>T
    })
    onAnnotationsChange(next); saveToNode(next); scheduleAutoSave(next)
  }

  function confirmText() {
    if (!textInput || !textValue.trim()) { setTextInput(null); setTextValue(''); return }
    const ann: TextAnnotation = {
      type:'text', page:textInput.page, color,
      x:textInput.x, y:textInput.y, text:textValue, fontSize:Math.round(16*scale)/scale
    }
    const next = [...annotations, ann]
    onAnnotationsChange(next); saveToNode(next); scheduleAutoSave(next)
    setTextInput(null); setTextValue('')
  }

  function handleUndo() {
    const next = annotations.slice(0,-1)
    onAnnotationsChange(next); saveToNode(next); scheduleAutoSave(next)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const cursorMap: Record<Tool,string> = { pen:'crosshair', highlight:'crosshair', eraser:'cell', text:'text' }

  return (
    <div className="pdf-viewer-root">
      {/* Barra de herramientas de anotación */}
      <div className="pdf-viewer-toolbar">
        <div className="pdf-tb-group">
          {(['pen','highlight','text','eraser'] as Tool[]).map(t=>(
            <button key={t} className={`pdf-tb-btn${tool===t?' pdf-tb-btn--active':''}`}
              onClick={()=>setTool(t)}
              title={t==='pen'?'Bolígrafo':t==='highlight'?'Resaltador':t==='text'?'Texto':'Borrador'}>
              {t==='pen'?'✏️':t==='highlight'?'🖍':t==='text'?'T':'⌫'}
            </button>
          ))}
        </div>
        <div className="pdf-tb-group">
          {COLORS.map(c=>(
            <button key={c} className={`pdf-tb-color${color===c?' pdf-tb-color--active':''}`}
              style={{background:c}} onClick={()=>setColor(c)} title={c} />
          ))}
        </div>
        {(tool==='pen'||tool==='highlight') && (
          <div className="pdf-tb-group">
            {PEN_SIZES.map(s=>(
              <button key={s} className={`pdf-tb-size${penSize===s?' pdf-tb-size--active':''}`}
                onClick={()=>setPenSize(s)}>
                <span style={{width:s*1.5,height:s*1.5,background:'#666',borderRadius:'50%',display:'block'}}/>
              </button>
            ))}
          </div>
        )}
        <div className="pdf-tb-group">
          <button className="pdf-tb-btn" onClick={()=>setScale(s=>Math.max(0.5,s-0.25))}>−</button>
          <span style={{fontSize:11,color:'var(--text-secondary)',padding:'0 4px'}}>{Math.round(scale*100)}%</span>
          <button className="pdf-tb-btn" onClick={()=>setScale(s=>Math.min(3,s+0.25))}>+</button>
        </div>
        <div style={{flex:1}}/>
        {annotations.length>0 && (
          <button className="pdf-tb-btn" onClick={handleUndo} title="Deshacer última anotación">↩</button>
        )}
        {annotations.length>0 && (
          <button className="pdf-tb-btn" title="Restaurar — quitar todo el marcaje (el PDF vuelve a estar limpio)"
            onClick={() => { if (confirm('¿Quitar todo el marcaje del PDF? El PDF vuelve a estar limpio.')) onAnnotationsChange([]) }}>
            ⟲ Restaurar
          </button>
        )}
        {/* Indicador de guardado automático */}
        {saveStatus==='saving' && <span style={{fontSize:11,color:'var(--text-tertiary)'}}>Guardando…</span>}
        {saveStatus==='saved'  && <span style={{fontSize:11,color:'var(--accent)'}}>✓ Guardado</span>}
        {/* Acciones del archivo */}
        <div className="pdf-tb-group" style={{borderLeft:'1px solid var(--border)',paddingLeft:8,marginLeft:4,borderRight:'none'}}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="node-resource-pdf-open" title="Abrir en nueva pestaña" style={{textDecoration:'none'}}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/><path d="M10 2h4v4"/><path d="M14 2L8 8"/></svg>
            Abrir
          </a>
          <a href={url} download={filename} className="node-resource-pdf-open" title="Descargar" style={{textDecoration:'none'}}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8m0 0-3-3m3 3 3-3"/><rect x="2" y="12" width="12" height="2" rx="1"/></svg>
          </a>
        </div>
      </div>

      {/* Páginas */}
      <div className="pdf-viewer-pages" style={{ position: 'relative' }}>
        {/* Loading como overlay — no afecta al layout ni causa saltos */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#404040', borderRadius: 0,
          }}>
            <div className="pdf-viewer-loading"><div className="footer-spinner"/> Cargando PDF…</div>
          </div>
        )}
        {Array.from({length:numPages},(_,i)=>{
          const page = i+1
          const w = pageWidths[i]||0; const h = pageHeights[i]||0
          return (
            <div key={page} className="pdf-viewer-page" style={{width:w,height:h}}>
              <canvas ref={el=>{if(el)canvasRefs.current.set(page,el)}}
                style={{position:'absolute',top:0,left:0}}/>
              <svg ref={el=>{if(el){svgRefs.current.set(page,el);renderSvg(el,page,annotations)}}}
                className="pdf-viewer-svg" style={{cursor:cursorMap[tool]}}
                onMouseDown={e=>handleMouseDown(e,page)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              {/* Input texto flotante — posicionado en píxeles dentro de la página */}
              {textInput?.page===page && (
                <input
                  ref={textInputRef}
                  className="pdf-text-input"
                  style={{left:textInput.pxX, top:textInput.pxY, color}}
                  value={textValue}
                  onChange={e=>setTextValue(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==='Enter'){e.preventDefault();confirmText()}
                    if(e.key==='Escape'){setTextInput(null);setTextValue('')}
                  }}
                  onBlur={confirmText}
                  placeholder="Escribe…"
                />
              )}
              <div className="pdf-page-num">Pág. {page} / {numPages}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
