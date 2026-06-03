/**
 * WhiteboardContainer — igual que PdfContainer pero para pizarra.
 * Gestiona el estado de anotaciones con cache de sesión.
 */
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { store } from '../../store/nodeStore'
import type { Annotation } from './WhiteboardViewer'

const WhiteboardViewer = lazy(() => import('./WhiteboardViewer'))

const cache = new Map<string, Annotation[]>()

interface Props { nodeId: string }

export default function WhiteboardContainer({ nodeId }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>(() =>
    cache.get(nodeId) || []
  )

  useEffect(() => {
    if (cache.has(nodeId)) { setAnnotations(cache.get(nodeId)!); return }
    try {
      const ed = JSON.parse(store.getNode(nodeId)?.extraData || '{}')
      const anns = Array.isArray(ed._annotations) ? (ed._annotations as Annotation[]) : []
      cache.set(nodeId, anns); setAnnotations(anns)
    } catch { /* nada */ }
  }, [nodeId])

  const handleChange = useCallback((anns: Annotation[]) => {
    cache.set(nodeId, anns); setAnnotations(anns)
    const n = store.getNode(nodeId); if (!n) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(n.extraData || '{}') } catch {}
    ed._annotations = anns
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }, [nodeId])

  return (
    <Suspense fallback={
      <div style={{ background: '#f0f0f0', minHeight: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, borderRadius: 8 }}>
        Cargando pizarra…
      </div>
    }>
      <WhiteboardViewer nodeId={nodeId} annotations={annotations} onAnnotationsChange={handleChange} />
    </Suspense>
  )
}
