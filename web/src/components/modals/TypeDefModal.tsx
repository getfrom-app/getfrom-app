/**
 * TypeDefModal — crear/editar un TIPO de elemento personalizado (Persona, Libro,
 * Película, Receta…) desde la columna derecha de Elementos («Tipos» → «+»).
 * Pide nombre, icono (misma librería que el resto de Fromly, v2/components/Icon.tsx)
 * y propiedades (nombre + tipo de dato, estilo Notion). Las opciones de una
 * propiedad `select`/`multi_select` se crean sobre la marcha al rellenar un
 * elemento (mismo comportamiento que las columnas de una tabla, no hace falta
 * pedirlas aquí).
 */
import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Icon, { type IconName } from '../../v2/components/Icon'
import { store } from '../../store/nodeStore'
import { createTypeDef, updateTypeDef, deleteTypeDef, getTypeProps, type TypeDef } from '../../utils/typeDefsHelper'

const ICON_CHOICES: IconName[] = [
  'template', 'document', 'note', 'user', 'star', 'task', 'calendar', 'image',
  'audio', 'link', 'quote', 'report', 'layers', 'folder', 'attachment', 'pin', 'sparkle', 'general',
]

type PropType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'rating'
const PROP_TYPE_LABELS: Record<PropType, string> = {
  text: 'colType.text', number: 'colType.number', select: 'colType.select',
  multi_select: 'colType.multiSelect', date: 'colType.date', checkbox: 'colType.checkbox',
  url: 'colType.url', rating: 'colType.rating',
}
interface DraftProp { id: string; name: string; type: PropType }

interface Props {
  onClose: () => void
  /** Presente = editar ese tipo existente; ausente = crear uno nuevo. */
  editingId?: string
  onSaved?: (typeId: string) => void
  /** Se llama al eliminar el tipo — el llamador debe limpiar cualquier filtro
   *  activo sobre él (antes la lista quedaba "vacía" en un filtro colgado). */
  onDeleted?: (typeId: string) => void
}

export default function TypeDefModal({ onClose, editingId, onSaved, onDeleted }: Props) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = editingId ? store.getNode(editingId) : undefined
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<IconName>('template')
  const [props, setProps] = useState<DraftProp[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (!editingId) return
    const n = store.getNode(editingId)
    if (!n) return
    setName(n.text || '')
    try {
      const e = JSON.parse(n.extraData || '{}')
      if (typeof e._typeIcon === 'string') setIcon(e._typeIcon as IconName)
    } catch { /* ignore */ }
    const schema = getTypeProps(editingId)
    setProps(schema.map(c => ({ id: c.id, name: c.name, type: (c.type as PropType) || 'text' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  function addProp() {
    setProps(p => [...p, { id: 'draft_' + Math.random().toString(36).slice(2, 8), name: '', type: 'text' }])
  }
  function updateProp(id: string, patch: Partial<DraftProp>) {
    setProps(p => p.map(x => x.id === id ? { ...x, ...patch } : x))
  }
  function removeProp(id: string) {
    setProps(p => p.filter(x => x.id !== id))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const cleanProps = props.filter(p => p.name.trim())
    if (editingId) {
      updateTypeDef(editingId, { name: trimmed, icon })
      store.setPropSchema(editingId, cleanProps.map(p => ({ id: p.id.startsWith('draft_') ? 'col_' + Math.random().toString(36).slice(2, 10) : p.id, name: p.name.trim(), type: p.type })))
      onSaved?.(editingId)
    } else {
      const created = createTypeDef(trimmed, icon)
      for (const p of cleanProps) store.addPropColumn(created.id, p.name.trim(), p.type)
      onSaved?.(created.id)
    }
    onClose()
  }

  function handleDelete() {
    if (!editingId) return
    deleteTypeDef(editingId)
    onDeleted?.(editingId)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name={icon} size={18} /></span>
          <h2>{editingId ? t('types.editTitle', 'Editar tipo') : t('types.newTitle', 'Nuevo tipo')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('common.close')}><Icon name="close" size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder={t('types.namePlaceholder', 'Nombre del tipo (Libro, Persona…)')}
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#666)', marginBottom: 6 }}>
              {t('types.icon', 'Icono')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICON_CHOICES.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  title={ic}
                  style={{
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, cursor: 'pointer',
                    border: '1px solid ' + (icon === ic ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'),
                    background: icon === ic ? 'var(--accent-soft,rgba(108,92,231,.1))' : 'var(--bg,#fff)',
                    color: icon === ic ? 'var(--accent,#6c5ce7)' : 'var(--text-secondary,#666)',
                  }}
                >
                  <Icon name={ic} size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="modal-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#666)' }}>
                {t('types.properties', 'Propiedades')}
              </div>
              <button type="button" onClick={addProp} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent,#6c5ce7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                + {t('types.addProperty', 'Añadir propiedad')}
              </button>
            </div>
            {props.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary,#999)' }}>{t('types.noProperties', 'Sin propiedades todavía.')}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {props.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updateProp(p.id, { name: e.target.value })}
                    placeholder={t('types.propertyName', 'Nombre')}
                    style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 12.5, fontFamily: 'inherit' }}
                  />
                  <select
                    value={p.type}
                    onChange={e => updateProp(p.id, { type: e.target.value as PropType })}
                    style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 12.5, fontFamily: 'inherit' }}
                  >
                    {(Object.entries(PROP_TYPE_LABELS) as [PropType, string][]).map(([k, labelKey]) => (
                      <option key={k} value={k}>{t(labelKey)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeProp(p.id)} title={t('common.remove', 'Quitar')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: 4, display: 'flex' }}>
                    <Icon name="close" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: editingId ? 'space-between' : 'flex-end' }}>
            {editingId && (
              confirmDelete ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary,#999)' }}>{t('types.confirmDelete', '¿Eliminar tipo?')}</span>
                  <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</button>
                  <button type="button" onClick={handleDelete} style={{ color: '#fff', background: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}>
                    {t('tip.delete', 'Eliminar')}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 0', fontFamily: 'inherit', fontSize: 13 }}>
                  {t('tip.delete', 'Eliminar')}
                </button>
              )
            )}
            {!confirmDelete && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={!name.trim()}>{editingId ? t('common.save', 'Guardar') : t('types.newTitle', 'Nuevo tipo')}</button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
