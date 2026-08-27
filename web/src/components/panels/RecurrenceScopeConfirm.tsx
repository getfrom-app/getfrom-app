// RecurrenceScopeConfirm — «¿Solo esta instancia o esta y las siguientes?»,
// mismo patrón que Apple Calendar/Google Calendar al tocar/editar/borrar un
// evento recurrente (27 ago 2026, Alberto: "cuando se edita o mueve o borra
// un evento recurrente o timeblock o tarea recurrente, debe preguntar igual
// que Apple Calendar"). Reutilizado desde TaskHoverActions (Hoy/Mañana/
// papelera) y TaskPropsPopover (editar fecha/recurrencia/eliminar) — un solo
// sitio para el texto y el estilo de la pregunta.
import { useTranslation } from 'react-i18next'
import CenteredModal from '../shared/CenteredModal'

export type RecurrenceScope = 'this' | 'all'

interface Props {
  /** Verbo de la acción para el título — "mover", "editar", "eliminar". */
  verb: string
  onChoose: (scope: RecurrenceScope) => void
  onCancel: () => void
}

export default function RecurrenceScopeConfirm({ verb, onChoose, onCancel }: Props) {
  const { t } = useTranslation()
  return (
    <CenteredModal onClose={onCancel} className="rec-scope-confirm">
      <div className="rec-scope-title">
        {t('recurrence.scopeTitle', 'Esta tarea se repite. ¿Qué quieres {{verb}}?', { verb })}
      </div>
      <button className="rec-scope-btn" onClick={() => onChoose('this')}>
        {t('recurrence.scopeThis', 'Solo esta instancia')}
      </button>
      <button className="rec-scope-btn" onClick={() => onChoose('all')}>
        {t('recurrence.scopeAll', 'Esta y las siguientes')}
      </button>
      <button className="rec-scope-cancel" onClick={onCancel}>
        {t('common.cancel', 'Cancelar')}
      </button>
    </CenteredModal>
  )
}
