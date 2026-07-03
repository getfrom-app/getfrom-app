/**
 * LienzoDocPanel — leer/editar un texto del lienzo CÓMODO en la columna derecha
 * (estilo Heptabase: la tarjeta del lienzo es una ventana ligera al MISMO documento;
 * aquí se edita con más espacio) + exportar a Markdown/HTML/PDF (reaprovecha
 * utils/nodeExport.ts, la misma lógica que ya existía en el menú del outliner).
 * Decisión de Alberto: se abre SIEMPRE al seleccionar un texto, no solo si es largo
 * (una nota corta puede crecer más adelante).
 */
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import DocEditor from '../views/DocEditor'
import DocEditorBoundary from '../DocEditorBoundary'
import DocInspector from '../views/DocInspector'
import PublishButton from '../PublishButton'
import { exportNodeMarkdown, exportNodeHtml, exportNodePdf } from '../../utils/nodeExport'

export default function LienzoDocPanel({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return null

  const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))

  const iconBtn = { background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', color: 'var(--text-secondary,#666)' } as const

  const toggleFavorite = () => {
    const next = !node.isFavorite
    store.updateNode(node.id, { isFavorite: next })
    toast(next ? t('tip.addFavorite') : t('tip.removeFavorite'))
  }
  const deleteCard = () => {
    // Borrado SUAVE (va a la Papelera, reversible) — coherente con el resto de From.
    store.deleteNode(node.id)
    toast(t('context.toastMovedToTrash', 'Movido a la papelera'))
    // Cerrar el panel: el nodo ya no existe en el lienzo.
    window.dispatchEvent(new Event('from:close-detail'))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle,#eee)', flexShrink: 0 }}>
        <span className="rc-section-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text || t('common.noTitle')}
        </span>
        {/* ⭐ Favorito */}
        <button title={node.isFavorite ? t('tip.removeFavorite') : t('tip.addFavorite')} onClick={toggleFavorite}
          style={{ ...iconBtn, color: node.isFavorite ? '#f59e0b' : 'var(--text-secondary,#666)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={node.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/>
          </svg>
        </button>
        <button title={t('export.markdown')} onClick={() => { exportNodeMarkdown(node); toast(t('context.toastExportedMarkdown')) }}
          style={{ background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 7px', color: 'var(--text-secondary,#666)' }}>
          MD
        </button>
        <button title={t('export.html')} onClick={() => { exportNodeHtml(node); toast(t('context.toastExportedHtml')) }}
          style={{ background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 7px', color: 'var(--text-secondary,#666)' }}>
          HTML
        </button>
        <button title={t('export.pdf')} onClick={() => exportNodePdf(node)}
          style={{ background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 7px', color: 'var(--text-secondary,#666)' }}>
          PDF
        </button>
        <PublishButton node={node} />
        {/* 🗑 Eliminar (a la papelera, reversible) */}
        <button title={t('tip.delete', 'Eliminar')} onClick={deleteCard}
          style={{ ...iconBtn, color: 'var(--text-tertiary,#999)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          </svg>
        </button>
      </div>
      {/* Barra de formato PERSISTENTE, COMPACTA (una sola fila, mismo estilo que la barra
          flotante del lienzo) — la rejilla completa de `DocInspector` ocupaba media columna;
          Alberto pidió algo del tamaño de la barra flotante, fijo arriba. */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle,#eee)', flexShrink: 0, display: 'flex', flexWrap: 'wrap' }}>
        <DocInspector compact />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 88px' }}>
        {/* `autofocus={false}`: la tarjeta del lienzo TAMBIÉN edita este mismo nodo (decisión
            de Alberto — escribir en el propio lienzo, con su barra flotante, sigue siendo el
            camino principal). Si el panel también autoenfocara al abrirse, se robarían el foco
            entre sí y el teclado saltaría de un sitio a otro a media palabra. El panel es la
            vista cómoda complementaria; para escribir en él, un clic. */}
        <DocEditorBoundary compact>
          <DocEditor node={node} compact registerActive autofocus={false} />
        </DocEditorBoundary>
      </div>
    </div>
  )
}
