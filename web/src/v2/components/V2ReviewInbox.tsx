// V2ReviewInbox — Bandeja de revisión (P4 · Ordenar de la auditoría "Fromly a
// fondo", 28 ago 2026): "Todo lo capturado sin contexto (o clasificado por la
// IA con baja confianza) cae en una Bandeja visible con contador. Revisar =
// confirmar o recolocar en un tap/clic."
//
// Fuente de la lista: getUnclassifiedIds() (utils/unclassified.ts) — ya la
// usaba la vista v1 "Sin clasificar", retirada el 29 ago 2026 junto al resto
// de v1 (UnclassifiedList.tsx/FilteredList.tsx, borrados). getSuggestedContext
// expone la sugerencia de la IA que quedó por debajo del umbral de confianza
// (antes se guardaba en extraData pero no se mostraba en ningún sitio).
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { getUnclassifiedIds, getSuggestedContext } from '../../utils/unclassified'
import { assignContext } from '../../utils/cajones'
import RowContextChip from '../../components/panels/RowContextChip'
import Icon from './Icon'
import type { Node } from '../../types'

interface Props {
  onClose: () => void
  onOpenNode: (id: string) => void
}

export default function V2ReviewInbox({ onClose, onOpenNode }: Props) {
  const { t } = useTranslation()
  useStore()

  const items = [...getUnclassifiedIds()]
    .map(id => store.getNode(id))
    .filter((n): n is Node => !!n)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="v2-templates-modal v2-review-modal" onClick={e => e.stopPropagation()}>
        <div className="v2-templates-head">
          <span className="v2-templates-title">{t('v2.review.title', 'Bandeja de revisión')}</span>
          <button className="v2-iconbtn" title={t('common.close', 'Cerrar')} onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="v2-templates-body">
          {items.length === 0 ? (
            <div className="v2-templates-empty">{t('v2.review.emptyHint', 'Nada por revisar — todo lo capturado tiene contexto.')}</div>
          ) : (
            <ul className="v2-templates-list v2-review-list">
              {items.map(n => {
                const suggestion = getSuggestedContext(n)
                const suggestedCtx = suggestion ? store.getNode(suggestion.contextId) : null
                return (
                  <li key={n.id} className="v2-review-item">
                    <button className="v2-templates-item-name v2-review-item-text" onClick={() => { onOpenNode(n.id); onClose() }}>
                      {n.text || t('common.noTitle', 'Sin título')}
                    </button>
                    {suggestedCtx ? (
                      <div className="v2-review-suggestion">
                        <span className="v2-review-suggestion-label">
                          <Icon name="sparkle" size={12} /> {t('v2.review.aiSuggests', 'IA sugiere: {{name}}', { name: suggestedCtx.text || '' })}
                        </span>
                        <button className="v2-review-confirm" onClick={() => assignContext(n.id, suggestion!.contextId)}>
                          {t('v2.review.confirm', 'Confirmar')}
                        </button>
                        <RowContextChip node={n} flat />
                      </div>
                    ) : (
                      <RowContextChip node={n} flat />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
