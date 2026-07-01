/**
 * PdfContainer — aísla todos los hooks de PDF fuera de NodeView.
 * NodeView renderiza este componente condicionalmente (solo para nodos PDF).
 * Al ser un componente propio, sus hooks no interfieren con los de NodeView.
 */
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import type { Annotation } from './PdfViewer'

const PdfViewer = lazy(() => import('./PdfViewer'))

// Cache de sesión: persiste toda la sesión aunque se navegue entre nodos
const cache = new Map<string, Annotation[]>()

interface Props {
  url: string
  nodeId: string
  filename: string
  resourceKey?: string
}

export default function PdfContainer({ url, nodeId, filename, resourceKey }: Props) {
  const { t } = useTranslation()
  const [annotations, setAnnotations] = useState<Annotation[]>(() =>
    cache.get(nodeId) || []
  )

  // Cargar desde extraData si no está en cache
  useEffect(() => {
    if (cache.has(nodeId)) {
      setAnnotations(cache.get(nodeId)!)
      return
    }
    try {
      const ed = JSON.parse(store.getNode(nodeId)?.extraData || '{}')
      const anns = Array.isArray(ed._annotations) ? ed._annotations : []
      cache.set(nodeId, anns)
      setAnnotations(anns)
    } catch { /* nada */ }
  }, [nodeId])

  const handleChange = useCallback((anns: Annotation[]) => {
    cache.set(nodeId, anns)
    setAnnotations(anns)
    const n = store.getNode(nodeId)
    if (!n) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(n.extraData || '{}') } catch {}
    ed._annotations = anns
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  }, [nodeId])

  return (
    <Suspense fallback={
      <div style={{ background: '#404040', minHeight: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13 }}>
        <span>{t('pdf.loadingViewer')}</span>
      </div>
    }>
      <PdfViewer
        url={url}
        nodeId={nodeId}
        filename={filename}
        resourceKey={resourceKey}
        annotations={annotations}
        onAnnotationsChange={handleChange}
      />
    </Suspense>
  )
}
