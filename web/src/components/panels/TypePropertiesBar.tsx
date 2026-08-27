/**
 * TypePropertiesBar — propiedades de un elemento creado a partir de un TIPO custom
 * (Persona, Libro, Película…, ver utils/typeDefsHelper.ts), pintadas arriba del
 * contenido del documento (NodeView.tsx, junto a DocEditor). El documento sigue
 * siendo el mismo editor de siempre; esto es solo la ficha de propiedades encima.
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { getTypeDef, getTypeProps, addTypePropOption } from '../../utils/typeDefsHelper'
import { RatingStars } from '../views/NodeTableView'
import Icon from '../../v2/components/Icon'

interface Props { nodeId: string; typeId: string }

const fieldStyle: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '5px 8px', borderRadius: 6,
  border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)',
  fontSize: 12.5, fontFamily: 'inherit',
}

export default function TypePropertiesBar({ nodeId, typeId }: Props) {
  const { t } = useTranslation()
  const s = useStore()
  void s.nodesVersion
  const typeDef = getTypeDef(typeId)
  if (!typeDef) return null
  const props = getTypeProps(typeId)

  function setVal(propId: string, value: unknown) { store.setPropValue(nodeId, propId, value) }

  return (
    <div style={{ margin: '4px 12px 10px', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-subtle,rgba(0,0,0,0.08))', background: 'var(--bg-secondary,#fafafa)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: props.length ? 8 : 0, fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary,#999)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        <Icon name={typeDef.icon} size={12} />
        {typeDef.name}
      </div>
      {props.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary,#999)' }}>{t('types.noProperties', 'Sin propiedades todavía.')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 7, columnGap: 10, alignItems: 'center' }}>
          {props.map(p => {
            const v = store.getPropValue(nodeId, p.id)
            return (
              <Fragment key={p.id}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary,#666)' }}>{p.name}</div>
                <div>
                  {p.type === 'rating' && (
                    <RatingStars value={v ? Number(v) : 0} onChange={n => setVal(p.id, n)} size={14} />
                  )}
                  {p.type === 'checkbox' && (
                    <input type="checkbox" checked={!!v} onChange={e => setVal(p.id, e.target.checked)} />
                  )}
                  {p.type === 'date' && (
                    <input type="date" style={fieldStyle} defaultValue={v ? String(v).slice(0, 10) : ''} onBlur={e => setVal(p.id, e.target.value)} />
                  )}
                  {p.type === 'number' && (
                    <input type="number" style={fieldStyle} defaultValue={v === undefined || v === null ? '' : String(v)} onBlur={e => setVal(p.id, e.target.value === '' ? null : Number(e.target.value))} />
                  )}
                  {p.type === 'url' && (
                    <input type="url" style={fieldStyle} defaultValue={v ? String(v) : ''} placeholder="https://…" onBlur={e => setVal(p.id, e.target.value)} />
                  )}
                  {p.type === 'select' && (
                    <select
                      style={fieldStyle}
                      value={typeof v === 'string' ? v : ''}
                      onChange={e => setVal(p.id, e.target.value || null)}
                    >
                      <option value="">—</option>
                      {(p.options || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  )}
                  {p.type === 'multi_select' && (
                    <MultiSelectField
                      value={Array.isArray(v) ? v as string[] : []}
                      options={p.options || []}
                      onChange={ids => setVal(p.id, ids)}
                      onCreateOption={label => addTypePropOption(typeId, p.id, label)}
                    />
                  )}
                  {(p.type === 'text' || !['rating', 'checkbox', 'date', 'number', 'url', 'select', 'multi_select'].includes(p.type)) && (
                    <input type="text" style={fieldStyle} defaultValue={v === undefined || v === null ? '' : String(v)} onBlur={e => setVal(p.id, e.target.value)} />
                  )}
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MultiSelectField({ value, options, onChange, onCreateOption }: {
  value: string[]
  options: Array<{ id: string; label: string; color?: string }>
  onChange: (ids: string[]) => void
  onCreateOption: (label: string) => string
}) {
  const { t } = useTranslation()
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {options.map(o => {
        const active = value.includes(o.id)
        return (
          <button key={o.id} type="button" onClick={() => toggle(o.id)}
            style={{
              fontSize: 11.5, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid ' + (active ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'),
              background: active ? 'var(--accent-soft,rgba(108,92,231,.1))' : 'var(--bg,#fff)',
              color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
            }}>
            {o.label}
          </button>
        )
      })}
      <input
        type="text"
        placeholder={t('table.create', 'Crear "{{label}}"', { label: '…' })}
        style={{ fontSize: 11.5, border: 'none', background: 'none', color: 'var(--text-tertiary,#999)', width: 90, fontFamily: 'inherit' }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const val = (e.target as HTMLInputElement).value.trim()
            if (val) { const id = onCreateOption(val); toggle(id); (e.target as HTMLInputElement).value = '' }
          }
        }}
      />
    </div>
  )
}
