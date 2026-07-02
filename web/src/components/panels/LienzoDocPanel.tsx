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
import { exportNodeMarkdown, exportNodeHtml, exportNodePdf } from '../../utils/nodeExport'

export default function LienzoDocPanel({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return null

  const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle,#eee)', flexShrink: 0 }}>
        <span className="rc-section-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text || t('common.noTitle')}
        </span>
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
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 88px' }}>
        <DocEditor node={node} compact />
      </div>
    </div>
  )
}
