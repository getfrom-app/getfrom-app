/**
 * PdfViewer — Visor PDF de SOLO LECTURA + selección de texto (columna derecha).
 * - PDF.js para renderizar en canvas + capa de texto seleccionable (TextLayer)
 * - Anotaciones antiguas (`_annotations`) se siguen viendo (SVG read-only) pero ya
 *   no se crean desde aquí: dibujar/marcar ahora se hace en el LIENZO (con sus
 *   propias herramientas de pluma/resaltador, que dibujan por encima de la tarjeta).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFileContent } from '../../api/client'

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

export default function PdfViewer({ url, nodeId, filename, resourceKey, annotations }: Props) {
  const { t: tr }    = useTranslation()
  const canvasRefs   = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const svgRefs      = useRef<Map<number, SVGSVGElement>>(new Map())
  const textLayerRefs= useRef<Map<number, HTMLDivElement>>(new Map())
  const pagesRootRef = useRef<HTMLDivElement>(null)
  const pdfDocRef    = useRef<any>(null)

  const [numPages,    setNumPages]    = useState(0)
  const [pageWidths,  setPageWidths]  = useState<number[]>([])
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [scale,       setScale]       = useState(1.0)  // se recalcula al cargar la primera página
  const scaleInitialized = useRef(false)
  const [loading,     setLoading]     = useState(true)
  // Selección de texto (Heptabase Fase 2): botón flotante «Enviar al lienzo»
  const [textSel,     setTextSel]     = useState<{ text: string; x: number; y: number; page: number | null } | null>(null)

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
      pdfDocRef.current = doc
      // OJO: `numPages`/`scale`/`pageWidths`/`pageHeights` se aplican TODOS JUNTOS al final
      // (un solo batch de setState). Antes `setNumPages` iba suelto aquí, con `scale` aún al
      // valor viejo — un render intermedio podía disparar el efecto de «Renderizar páginas»
      // con `numPages` ya listo pero `scale`/anchos todavía desfasados, dejando la página 1
      // (la primera en montar su ref) pintada con el tamaño equivocado.

      // Calcular scale para ajustar al ancho del contenedor (igual que el iframe del navegador)
      // Solo en el primer load — si el usuario ya ajustó el zoom, no sobreescribir
      let effectiveScale = scale
      if (!scaleInitialized.current) {
        const firstPage = await doc.getPage(1)
        const vpAt1 = firstPage.getViewport({ scale: 1 })
        // Ancho disponible: el propio contenedor (ref, no querySelector global — evita medir
        // un ancho ajeno cuando el visor vive en la columna derecha, mucho más estrecha que
        // el fallback de 780px, lo que hacía que el PDF se renderizara más ancho y se cortara).
        // SIN suelo de 0.5: en columnas muy estrechas un suelo alto forzaba un ancho mayor que
        // el hueco disponible → recorte. Mejor una escala fiel al ancho real (con un mínimo
        // ínfimo solo para evitar 0/negativo, no para imponer un tamaño "legible" a la fuerza).
        const containerW = pagesRootRef.current?.clientWidth || 780
        const fitScale = Math.max(0.15, Math.min(2.5, (containerW - 48) / vpAt1.width))
        // Redondear siempre HACIA ABAJO (nunca hacia arriba: `Math.round` a 0.25 podía
        // pasarse del hueco real por unos pocos px — recorte residual, ej. "Previas" → "Previa").
        effectiveScale = Math.floor(fitScale * 100) / 100
        scaleInitialized.current = true
      }

      const ws: number[] = []; const hs: number[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i); const vp = page.getViewport({scale: effectiveScale})
        ws.push(vp.width); hs.push(vp.height)
      }
      if (cancelled) return
      setScale(effectiveScale); setNumPages(doc.numPages)
      setPageWidths(ws); setPageHeights(hs); setLoading(false)
    }
    load().catch(console.error)
    return () => { cancelled = true }
  }, [url, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Renderizar páginas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return
    async function renderAll() {
      const pdfjsLib = await import('pdfjs-dist')
      for (let i = 1; i <= numPages; i++) {
        const canvas = canvasRefs.current.get(i); if (!canvas) continue
        const page = await pdfDocRef.current.getPage(i)
        const vp = page.getViewport({scale})
        canvas.width = vp.width; canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
        // Capa de texto invisible (seleccionable) para poder copiar/enviar fragmentos al lienzo.
        // Tamaño: SIEMPRE 100%/100% del contenedor por CSS (JSX) — NO se fuerza en px aquí, para
        // que siga fielmente el tamaño real (posiblemente reducido por `maxWidth`/`aspectRatio`
        // del `.pdf-viewer-page`) en vez de imponer el ancho "ideal" sin recortar del cálculo JS.
        const textLayerDiv = textLayerRefs.current.get(i)
        if (textLayerDiv) {
          textLayerDiv.replaceChildren()
          textLayerDiv.style.setProperty('--total-scale-factor', String(scale))
          try {
            const tl = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container: textLayerDiv, viewport: vp })
            await tl.render()
          } catch (e) { console.error('[PdfViewer] text layer error:', e) }
        }
      }
    }
    renderAll().catch(console.error)
  }, [numPages, scale])

  // ── Renderizar SVG de anotaciones YA existentes (solo lectura, sin captura de ratón) ──
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

  // ── Selección de texto (Heptabase Fase 2) ───────────────────────────────────
  // Marcar texto muestra un botón flotante para enviar la cita como tarjeta nueva
  // al lienzo (evento hacia PizarraView).
  useEffect(() => {
    function onSelChange() {
      const sel = window.getSelection()
      const root = pagesRootRef.current
      if (!sel || sel.isCollapsed || !root || !sel.anchorNode || !root.contains(sel.anchorNode)) {
        setTextSel(null); return
      }
      const text = sel.toString().trim()
      if (!text) { setTextSel(null); return }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      // Página de origen (para citar/filtrar la selección guardada): del ancestro marcado con data-page.
      const anchorEl = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement
      const pageEl = anchorEl?.closest<HTMLElement>('[data-page]')
      const page = pageEl ? Number(pageEl.dataset.page) : null
      setTextSel({ text, x: rect.left + rect.width / 2 - rootRect.left + root.scrollLeft, y: rect.top - rootRect.top + root.scrollTop, page })
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  }, [])

  // «Enviar al lienzo» coloca la tarjeta visible (con pin) y vuela la cámara a ella.
  // «Guardar» crea el mismo nodo-selección buscable pero SIN pin: no aparece en el
  // lienzo, solo queda accesible por búsqueda / el panel Elementos.
  function actOnSelection(mode: 'canvas' | 'save') {
    if (!textSel) return
    window.dispatchEvent(new CustomEvent('from:pdf-send-to-canvas', {
      detail: { text: textSel.text, sourceNodeId: nodeId, filename, page: textSel.page, mode },
    }))
    window.getSelection()?.removeAllRanges()
    setTextSel(null)
  }

  // ── Abrir/descargar ───────────────────────────────────────────────────────
  // `_resourceUrl` puede apuntar a un objeto R2 PRIVADO (el bucket no es público):
  // abrirlo/descargarlo directo con <a href> daba error (403). En su lugar, si hay
  // `resourceKey` se trae el contenido por el proxy autenticado del servidor (el
  // mismo que usa el visor para cargar el PDF) y se abre/descarga como blob local.
  const blobUrlRef = useRef<string | null>(null)
  async function openFile() {
    if (!resourceKey) { window.open(url, '_blank', 'noopener,noreferrer'); return }
    try {
      const bytes = await fetchFileContent(resourceKey)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = URL.createObjectURL(blob)
      window.open(blobUrlRef.current, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error('[PdfViewer] open error:', e)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: tr('common.error'), type: 'warning' } }))
    }
  }
  async function downloadFile() {
    if (!resourceKey) { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); return }
    try {
      const bytes = await fetchFileContent(resourceKey)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl; a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000)
    } catch (e) {
      console.error('[PdfViewer] download error:', e)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: tr('common.error'), type: 'warning' } }))
    }
  }
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pdf-viewer-root">
      <div className="pdf-viewer-toolbar">
        <div className="pdf-tb-group">
          <button className="pdf-tb-btn" onClick={()=>setScale(s=>Math.max(0.5,s-0.25))}>−</button>
          <span style={{fontSize:11,color:'var(--text-secondary)',padding:'0 4px'}}>{Math.round(scale*100)}%</span>
          <button className="pdf-tb-btn" onClick={()=>setScale(s=>Math.min(3,s+0.25))}>+</button>
        </div>
        <div style={{flex:1}}/>
        {/* Acciones del archivo */}
        <div className="pdf-tb-group" style={{borderLeft:'1px solid var(--border)',paddingLeft:8,marginLeft:4,borderRight:'none'}}>
          <button onClick={openFile} className="node-resource-pdf-open" title={tr('tip.openNewTab')} style={{background:'none',border:'none',cursor:'pointer'}}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/><path d="M10 2h4v4"/><path d="M14 2L8 8"/></svg>
            {tr('tip.open')}
          </button>
          <button onClick={downloadFile} className="node-resource-pdf-open" title={tr('tip.download')} style={{background:'none',border:'none',cursor:'pointer'}}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8m0 0-3-3m3 3 3-3"/><rect x="2" y="12" width="12" height="2" rx="1"/></svg>
          </button>
        </div>
      </div>

      {/* Páginas */}
      <div className="pdf-viewer-pages" ref={pagesRootRef} style={{ position: 'relative' }}>
        {/* Loading como overlay — no afecta al layout ni causa saltos */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#404040', borderRadius: 0,
          }}>
            <div className="pdf-viewer-loading"><div className="footer-spinner"/> {tr('pdf.loadingPdf')}</div>
          </div>
        )}
        {Array.from({length:numPages},(_,i)=>{
          const page = i+1
          const w = pageWidths[i]||0; const h = pageHeights[i]||0
          return (
            <div key={page} className="pdf-viewer-page" data-page={page} style={{width:w,height:h,maxWidth:'100%',overflow:'hidden'}}>
              {/* `maxWidth:100%` es un cinturón de seguridad (por si el cálculo de escala en JS
                  fallara); con el suelo de escala quitado, `w`/`h` YA encajan de verdad, así que
                  canvas y capa de texto se dimensionan en PÍXELES EXACTOS (no % del contenedor)
                  — % rompía el posicionamiento interno de la capa de texto y la selección dejaba
                  de funcionar. */}
              <canvas ref={el=>{if(el)canvasRefs.current.set(page,el)}}
                style={{position:'absolute',top:0,left:0}}/>
              {/* Capa de texto: SIEMPRE activa (única forma de interacción de este visor). */}
              <div ref={el=>{if(el)textLayerRefs.current.set(page,el)}}
                className="pdf-text-layer"
                style={{position:'absolute',top:0,left:0,width:w,height:h}}/>
              {/* Anotaciones YA existentes (de sesiones anteriores) — solo lectura, sin captura de ratón. */}
              <svg ref={el=>{if(el){svgRefs.current.set(page,el);renderSvg(el,page,annotations)}}}
                className="pdf-viewer-svg" style={{pointerEvents:'none'}} />
              <div className="pdf-page-num">{tr('tip.pageLabel', { page, total: numPages })}</div>
            </div>
          )
        })}
        {/* Botones flotantes sobre la selección: enviar al lienzo (con pin, visible) o
            guardar (buscable, sin colocarlo en el lienzo) — acciones independientes. */}
        {textSel && (
          <div className="pdf-selection-actions" style={{ left: textSel.x, top: textSel.y }}
            onMouseDown={e=>e.preventDefault() /* no perder la selección al hacer clic */}>
            <button className="pdf-send-to-canvas-btn" onClick={()=>actOnSelection('canvas')}>
              ⤴ {tr('tip.sendToCanvas')}
            </button>
            <button className="pdf-send-to-canvas-btn pdf-send-to-canvas-btn--save" onClick={()=>actOnSelection('save')}>
              💾 {tr('tip.saveSelection')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
