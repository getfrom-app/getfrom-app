// Cuerpo de la vista de detalle de Fromly 2.0 — enruta al visor/editor REAL de v1
// según el tipo. La cabecera (título editable + volver) y las tabs las pone
// V2RightColumn, para que las tabs sigan visibles con un elemento abierto.
import { useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { isDocNode } from '../../utils/docNode'
import { parseExtraData } from '../../utils/papeleraHelper'
import ResourcePanel from '../../components/panels/ResourcePanel'
import AudioPanel from '../../components/panels/AudioPanel'
import Outliner from '../../components/outliner/Outliner'
import PizarraView from '../../components/views/PizarraView'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import DocInspector from '../../components/views/DocInspector'
import PublishButton from '../../components/PublishButton'
import { exportNodeMarkdown, exportNodeHtml, exportNodePdf } from '../../utils/nodeExport'
import type { Node } from '../../types'

const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))
const actBtn = { background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', color: 'var(--text-secondary,#666)', fontSize: 11, lineHeight: 1 } as const

// Nota o documento: se puede ver como TEXTO o como LIENZO (mismo nodo). El toggle
// persiste en extraData (_v2canvas). Cabecera de una sola fila: [Nota | Lienzo] a la
// izquierda, acciones (favorito, exportar, publicar, eliminar) a la derecha. Debajo,
// la barra de formato (plana) y el editor.
function V2NoteBody({ node }: { node: Node }) {
  const { t } = useTranslation()
  const [canvas, setCanvas] = useState(parseExtraData(node.extraData)._v2canvas === '1')
  const doc = isDocNode(node)

  const setView = (c: boolean) => {
    setCanvas(c)
    const e = parseExtraData(node.extraData)
    if (c) e._v2canvas = '1'; else delete e._v2canvas
    store.updateNode(node.id, { extraData: JSON.stringify(e) })
  }

  const toggleFavorite = () => { const next = !node.isFavorite; store.updateNode(node.id, { isFavorite: next }); toast(next ? t('tip.addFavorite') : t('tip.removeFavorite')) }
  const deleteCard = () => { store.deleteNode(node.id); toast(t('context.toastMovedToTrash', 'Movido a la papelera')); window.dispatchEvent(new Event('from:close-detail')) }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Fila única: toggle a la izquierda + acciones a la derecha */}
      <div className="v2-note-toolbar">
        <div className="v2-view-toggle">
          <button className={!canvas ? 'active' : ''} onClick={() => setView(false)}>📝 Nota</button>
          <button className={canvas ? 'active' : ''} onClick={() => setView(true)}>🎨 Lienzo</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <button title={node.isFavorite ? t('tip.removeFavorite') : t('tip.addFavorite')} onClick={toggleFavorite} style={{ ...actBtn, color: node.isFavorite ? '#f59e0b' : 'var(--text-secondary,#666)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={node.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/></svg>
          </button>
          {doc && !canvas && <>
            <button title={t('export.markdown')} onClick={() => { exportNodeMarkdown(node); toast(t('context.toastExportedMarkdown')) }} style={actBtn}>MD</button>
            <button title={t('export.html')} onClick={() => { exportNodeHtml(node); toast(t('context.toastExportedHtml')) }} style={actBtn}>HTML</button>
            <button title={t('export.pdf')} onClick={() => exportNodePdf(node)} style={actBtn}>PDF</button>
            <PublishButton node={node} />
          </>}
          <button title={t('tip.delete', 'Eliminar')} onClick={deleteCard} style={{ ...actBtn, color: 'var(--text-tertiary,#999)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>
      </div>

      {/* Barra de formato PLANA (iconos normales) — solo para documentos en modo texto. */}
      {doc && !canvas && (
        <div className="v2-note-formatbar"><DocInspector bar /></div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: canvas ? 'hidden' : 'auto' }}>
        {canvas
          ? <PizarraView parentId={node.id} flowUnpositioned globalCanvas={false} embedded />
          : doc
            ? <div style={{ padding: '18px 20px 88px' }}><DocEditorBoundary compact><DocEditor node={node} compact registerActive autofocus={false} /></DocEditorBoundary></div>
            : <Outliner parentId={node.id} autoFocusEmpty placeholder="Escribe aquí…" />}
      </div>
    </div>
  )
}

export default function V2DetailView({ nodeId }: { nodeId: string }) {
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return <div className="v2-right-empty">Elemento no encontrado.</div>

  const hasAudio = Array.isArray(parseExtraData(node.extraData)._audios)
  const rt = (node.resourceType || '').toLowerCase()

  if (hasAudio || rt.includes('audio')) return <AudioPanel nodeId={node.id} />
  if (node.isResource || node.resourceType) return <ResourcePanel node={node} />
  // Nota / documento → cuerpo editable con toggle Nota ⇄ Lienzo.
  return <V2NoteBody node={node} />
}
