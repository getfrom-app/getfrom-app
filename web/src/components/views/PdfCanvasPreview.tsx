// Render del PDF en el lienzo: UNA página a la vez (como Apple Notes/Heptabase), con
// paginador ‹ N/total › sobre la propia tarjeta. Se ve pequeño por defecto y NÍTIDO
// al ampliar: re-renderiza a más resolución cuando la escala en pantalla sube (con
// debounce). Las herramientas del lienzo marcan por encima (strokes en el body,
// autoguardados); el dot abre el editor completo.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFileContent } from '../../api/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any

export default function PdfCanvasPreview({ url, width, scale = 1, title, allPages = false, resourceKey }: { url: string; width: number; scale?: number; title?: string; allPages?: boolean; resourceKey?: string }) {
  const { t } = useTranslation()
  const docRef = useRef<PdfDoc | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const allCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderedTargetRef = useRef(0)
  const renderedPageRef = useRef(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  // Cargar el documento una vez. `_resourceUrl` suele apuntar a un objeto R2 PRIVADO
  // (el bucket no es público): cargarlo directo con `pdfjs.getDocument({url})` daba 403
  // silencioso → siempre caía a `state==='fail'` (icono genérico, nunca se veía el PDF real).
  // Si hay `resourceKey`, se trae el contenido por el proxy autenticado del servidor (el
  // mismo que ya usa el visor de la columna derecha).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
        const source = resourceKey ? { data: new Uint8Array(await fetchFileContent(resourceKey)) } : { url }
        const doc = await pdfjs.getDocument(source).promise
        if (cancelled) return
        docRef.current = doc
        renderedTargetRef.current = 0
        renderedPageRef.current = 0
        setPages(doc.numPages)
        setPage(1)
        setState('ok')
      } catch (e) {
        console.error('[PdfCanvasPreview] load error:', e)
        if (!cancelled) setState('fail')
      }
    })()
    return () => { cancelled = true; docRef.current = null }
  }, [url, resourceKey])

  // Renderizar / re-renderizar la página actual a la resolución que toca para la escala en pantalla.
  useEffect(() => {
    if (!docRef.current || pages === 0 || allPages) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const target = Math.min(2800, Math.max(width, Math.round(width * Math.max(1, scale) * dpr)))
    // Re-renderiza si cambia de página, o al SUBIR la resolución de forma notable (zoom-in).
    const samePage = renderedPageRef.current === page
    if (samePage && renderedTargetRef.current && target <= renderedTargetRef.current * 1.3) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const doc = docRef.current
      const canvas = canvasRef.current
      if (!doc || !canvas || cancelled) return
      renderedTargetRef.current = target
      renderedPageRef.current = page
      try {
        const pdfPage = await doc.getPage(page)
        const base = pdfPage.getViewport({ scale: 1 })
        const vp = pdfPage.getViewport({ scale: target / base.width })
        canvas.width = Math.round(vp.width)
        canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise
      } catch { /* página fallida */ }
    }, samePage ? 220 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [pages, page, width, scale, allPages])

  // Modo «PDF de fondo» (legacy, `pdfBackground`): TODAS las páginas apiladas, para
  // dibujar/anotar encima con las herramientas del lienzo.
  useEffect(() => {
    if (!docRef.current || pages === 0 || !allPages) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const target = Math.min(2800, Math.max(width, Math.round(width * Math.max(1, scale) * dpr)))
    if (renderedTargetRef.current && target <= renderedTargetRef.current * 1.3) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const doc = docRef.current
      if (!doc || cancelled) return
      renderedTargetRef.current = target
      for (let i = 1; i <= pages; i++) {
        if (cancelled) return
        const canvas = allCanvasRefs.current.get(i)
        if (!canvas) continue
        try {
          const pdfPage = await doc.getPage(i)
          const base = pdfPage.getViewport({ scale: 1 })
          const vp = pdfPage.getViewport({ scale: target / base.width })
          canvas.width = Math.round(vp.width)
          canvas.height = Math.round(vp.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise
        } catch { /* página fallida, sigue */ }
      }
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [pages, width, scale, allPages])

  if (state === 'fail') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>📄</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word' }}>{title || t('pdf.document')}</span>
      </div>
    )
  }
  if (allPages) {
    return (
      <div style={{ position: 'relative', minHeight: state === 'loading' ? 90 : undefined, background: '#fff' }}>
        {Array.from({ length: pages }, (_, idx) => (
          <canvas key={idx + 1} ref={el => { if (el) allCanvasRefs.current.set(idx + 1, el) }}
            style={{ display: 'block', width: '100%', height: 'auto', borderBottom: idx < pages - 1 ? '1px solid #eaeaea' : undefined }} />
        ))}
        {state === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary,#aaa)', fontSize: 13 }}>{t('pdf.loadingPdf')}</div>
        )}
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', minHeight: state === 'loading' ? 90 : undefined, background: '#fff' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
      {state === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary,#aaa)', fontSize: 13 }}>{t('pdf.loadingPdf')}</div>
      )}
      {pages > 1 && (
        <div
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 20, padding: '3px 6px 3px 10px', fontSize: 11.5, userSelect: 'none' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ background: 'none', border: 'none', color: '#fff', opacity: page <= 1 ? .35 : .9, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>‹</button>
          <span>{page}/{pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            style={{ background: 'none', border: 'none', color: '#fff', opacity: page >= pages ? .35 : .9, cursor: page >= pages ? 'default' : 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>›</button>
        </div>
      )}
    </div>
  )
}
