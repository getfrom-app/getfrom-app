// PizarraThumbnail — miniatura VISUAL de un lienzo (nodo-pizarra) para la rejilla del
// buscador de Elementos. Reutiliza el mismo parseo (`parsePizarra`) que la Pizarra real:
// dibuja los trazos y textos a escala reducida dentro de un SVG con viewBox ajustado al
// bounding box del contenido. No es interactivo — solo una vista previa.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { parsePizarra } from './PizarraView'

interface Props {
  body: string | null | undefined
  width?: number
  height?: number
}

const MARGIN = 24

export default function PizarraThumbnail({ body, width = 140, height = 100 }: Props) {
  const { t } = useTranslation()
  const data = useMemo(() => parsePizarra(body), [body])

  const { strokes, texts } = data
  const hasContent = (strokes && strokes.length > 0) || (texts && texts.length > 0)

  const viewBox = useMemo(() => {
    if (!hasContent) return null
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const s of strokes || []) {
      for (let i = 0; i + 1 < s.pts.length; i += 2) {
        x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i])
        y0 = Math.min(y0, s.pts[i + 1]); y1 = Math.max(y1, s.pts[i + 1])
      }
    }
    for (const tx of texts || []) {
      x0 = Math.min(x0, tx.x); x1 = Math.max(x1, tx.x + (tx.w || 100))
      y0 = Math.min(y0, tx.y); y1 = Math.max(y1, tx.y + (tx.size || 16) * 1.4)
    }
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return null
    // Evita bounding box degenerado (un único punto o trazo plano en un eje).
    const w = Math.max(x1 - x0, 1)
    const h = Math.max(y1 - y0, 1)
    return { x: x0 - MARGIN, y: y0 - MARGIN, w: w + MARGIN * 2, h: h + MARGIN * 2 }
  }, [strokes, texts, hasContent])

  return (
    <div
      style={{
        width: '100%',
        height,
        overflow: 'hidden',
        background: 'var(--bg-secondary,#f5f5f5)',
        border: '1px solid var(--border,#e2e2e2)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {viewBox ? (
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {(strokes || []).map(s => (
            <polyline
              key={s.id}
              points={pointsAttr(s.pts)}
              fill="none"
              stroke={s.e ? 'var(--bg-secondary,#f5f5f5)' : (s.c || '#333')}
              strokeWidth={Math.max(s.w, viewBox.w / width)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.a ?? 1}
            />
          ))}
          {(texts || []).map(tx => (
            <text
              key={tx.id}
              x={tx.x}
              y={tx.y + (tx.size || 16)}
              fontSize={tx.size || 16}
              fill={tx.c || 'currentColor'}
            >
              {truncateMd(tx.md)}
            </text>
          ))}
        </svg>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-tertiary,#999)' }}>
          <span style={{ fontSize: 22 }}>🎨</span>
          <span style={{ fontSize: 10.5 }}>{t('elements.emptyCanvas', 'Lienzo vacío')}</span>
        </div>
      )}
    </div>
  )
}

function pointsAttr(pts: number[]): string {
  let out = ''
  for (let i = 0; i + 1 < pts.length; i += 2) out += pts[i] + ',' + pts[i + 1] + ' '
  return out.trim()
}

function truncateMd(md: string): string {
  const clean = (md || '').replace(/[*_`#>[\]]/g, '').trim()
  return clean.length > 20 ? clean.slice(0, 20) + '…' : clean
}
