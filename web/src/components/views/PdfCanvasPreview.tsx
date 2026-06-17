// Preview de la 1ª página de un PDF para mostrarlo EN EL LIENZO (no solo el icono).
// Render con pdf.js a 2× para nitidez razonable; el dot abre el editor completo.
import { useEffect, useRef, useState } from 'react'

export default function PdfCanvasPreview({ url, width, title }: { url: string; width: number; title?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
        const doc = await pdfjs.getDocument(url).promise
        const page = await doc.getPage(1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = Math.max(0.3, (width * 2) / base.width) // 2× del ancho de tarjeta → nitidez
        const vp = page.getViewport({ scale })
        const canvas = ref.current; if (!canvas) return
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext('2d'); if (!ctx) return
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('fail')
      }
    })()
    return () => { cancelled = true }
  }, [url, width])

  if (state === 'fail') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>📄</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word' }}>{title || 'Documento PDF'}</span>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', minHeight: state === 'loading' ? 80 : undefined, background: '#fff' }}>
      <canvas ref={ref} style={{ display: 'block', width: '100%', height: 'auto' }} />
      {state === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary,#aaa)', fontSize: 13 }}>📄 Cargando PDF…</div>
      )}
    </div>
  )
}
