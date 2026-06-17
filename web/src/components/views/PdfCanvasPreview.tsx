// Render del PDF COMPLETO en el lienzo (todas las páginas apiladas). Se ve pequeño
// por defecto y NÍTIDO al ampliar: re-renderiza a más resolución cuando la escala en
// pantalla sube (con debounce). Las herramientas del lienzo marcan por encima
// (strokes en el body, autoguardados); el dot abre el editor completo.
import { useEffect, useRef, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any

export default function PdfCanvasPreview({ url, width, scale = 1, title }: { url: string; width: number; scale?: number; title?: string }) {
  const docRef = useRef<PdfDoc | null>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderedTargetRef = useRef(0)
  const [pages, setPages] = useState(0)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  // Cargar el documento una vez.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
        const doc = await pdfjs.getDocument({ url }).promise
        if (cancelled) return
        docRef.current = doc
        renderedTargetRef.current = 0
        setPages(doc.numPages)
        setState('ok')
      } catch {
        if (!cancelled) setState('fail')
      }
    })()
    return () => { cancelled = true; docRef.current = null }
  }, [url])

  // Renderizar / re-renderizar a la resolución que toca para la escala en pantalla.
  useEffect(() => {
    if (!docRef.current || pages === 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Resolución objetivo (px) del ancho de cada página = ancho de tarjeta × escala
    // en pantalla × dpr, con tope para no reventar memoria.
    const target = Math.min(2800, Math.max(width, Math.round(width * Math.max(1, scale) * dpr)))
    // Solo re-renderiza al SUBIR la resolución de forma notable (zoom-in). Al alejar
    // se conserva la alta resolución y se ve igual de bien escalada hacia abajo.
    if (renderedTargetRef.current && target <= renderedTargetRef.current * 1.3) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const doc = docRef.current
      if (!doc || cancelled) return
      renderedTargetRef.current = target
      for (let i = 1; i <= pages; i++) {
        if (cancelled) return
        const canvas = canvasRefs.current.get(i)
        if (!canvas) continue
        try {
          const page = await doc.getPage(i)
          const base = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: target / base.width })
          canvas.width = Math.round(vp.width)
          canvas.height = Math.round(vp.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport: vp }).promise
        } catch { /* página fallida, sigue */ }
      }
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [pages, width, scale])

  if (state === 'fail') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>📄</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word' }}>{title || 'Documento PDF'}</span>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', minHeight: state === 'loading' ? 90 : undefined, background: '#fff' }}>
      {Array.from({ length: pages }, (_, idx) => (
        <canvas key={idx + 1} ref={el => { if (el) canvasRefs.current.set(idx + 1, el) }}
          style={{ display: 'block', width: '100%', height: 'auto', borderBottom: idx < pages - 1 ? '1px solid #eaeaea' : undefined }} />
      ))}
      {state === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary,#aaa)', fontSize: 13 }}>📄 Cargando PDF…</div>
      )}
    </div>
  )
}
