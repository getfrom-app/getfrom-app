/**
 * TemplatePropertiesPanel — propiedades de una plantilla en la columna derecha.
 * El contenido de la plantilla se edita en la ventana central (sus nodos hijos).
 * Aquí: auto-aplicar a la nota diaria y recurrencia (cada X días/semanas/meses).
 */
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n/config'
import { useStore } from '../../store/nodeStore'
import {
  getDailyTemplate, setDailyTemplate,
  getTemplateRecurrence, setTemplateRecurrence, type TemplateRecurrence,
} from '../../utils/tagsHelper'

const weekdayKeys = ['template.sunday', 'template.monday', 'template.tuesday', 'template.wednesday', 'template.thursday', 'template.friday', 'template.saturday'] as const
const weekdays = () => weekdayKeys.map(k => i18n.t(k))
const freqNoun = () => ({ day: i18n.t('template.days'), week: i18n.t('template.weeks'), month: i18n.t('template.months') } as const)

function recurrenceSummary(r: TemplateRecurrence): string {
  const nouns = freqNoun()
  const every = r.interval > 1 ? `${i18n.t('template.every')} ${r.interval} ${nouns[r.freq]}` : { day: i18n.t('template.everyDay'), week: i18n.t('template.everyWeek'), month: i18n.t('template.everyMonth') }[r.freq]
  if (r.freq === 'week' && typeof r.weekday === 'number') return `${every}, ${weekdays()[r.weekday]}`
  if (r.freq === 'month' && typeof r.monthday === 'number') return `${every}, ${i18n.t('template.day')} ${r.monthday}`
  return every
}

const toggleBtn = (on: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  background: on ? 'rgba(34,197,94,0.10)' : 'var(--bg-secondary)',
  border: '1px solid', borderColor: on ? 'rgba(34,197,94,0.4)' : 'var(--border)',
  borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
})
const dot = (on: boolean): CSSProperties => ({ width: 9, height: 9, borderRadius: '50%', background: on ? '#22c55e' : 'var(--text-tertiary)', flexShrink: 0 })
const selectStyle: CSSProperties = { fontSize: 13, padding: '8px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', width: '100%' }

interface Props {
  nodeId: string
  onBack: () => void
}

export default function TemplatePropertiesPanel({ nodeId, onBack }: Props) {
  const { t } = useTranslation()
  const s = useStore()
  void s.nodesVersion
  const node = s.getNode(nodeId)
  const [modalOpen, setModalOpen] = useState(false)
  if (!node) return null

  const daily = getDailyTemplate()
  const isDaily = daily?.id === nodeId
  const recur = getTemplateRecurrence(nodeId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 40, flexShrink: 0, borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('template.backTemplates')}
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Auto-aplicar en nota diaria */}
        <button onClick={() => setDailyTemplate(nodeId, !isDaily)} style={toggleBtn(isDaily)}>
          <span style={dot(isDaily)} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('template.autoApplyTitle')}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {isDaily ? t('template.autoApplyOn') : t('template.autoApplyOff')}
            </span>
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{isDaily ? t('template.active') : t('template.click')}</span>
        </button>

        {/* Nota recurrente → abre modal de configuración */}
        <button onClick={() => setModalOpen(true)} style={toggleBtn(!!recur)}>
          <span style={dot(!!recur)} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('template.recurringTitle')}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {recur ? recurrenceSummary(recur) : t('template.recurringDesc')}
            </span>
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{recur ? t('template.edit') : t('template.click')}</span>
        </button>

        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          {t('template.contentHint')}
        </div>
      </div>

      {modalOpen && createPortal(
        <RecurrenceModal
          initial={recur}
          onClose={() => setModalOpen(false)}
          onSave={r => { setTemplateRecurrence(nodeId, r); setModalOpen(false) }}
        />,
        document.body,
      )}
    </div>
  )
}

// ── Modal de recurrencia ──────────────────────────────────────────────────────

function RecurrenceModal({ initial, onClose, onSave }: {
  initial: TemplateRecurrence | null
  onClose: () => void
  onSave: (r: TemplateRecurrence | null) => void
}) {
  const { t } = useTranslation()
  const [freq, setFreq] = useState<'day' | 'week' | 'month'>(initial?.freq ?? 'week')
  const [interval, setInterval] = useState<number>(initial?.interval ?? 1)
  const [weekday, setWeekday] = useState<number>(initial?.weekday ?? 1)
  const [monthday, setMonthday] = useState<number>(initial?.monthday ?? 1)

  function save() {
    const today = new Date()
    const r: TemplateRecurrence = {
      freq,
      interval: Math.max(1, interval),
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
    }
    if (freq === 'week') r.weekday = weekday
    if (freq === 'month') r.monthday = monthday
    onSave(r)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseDown={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '24px 24px 20px', width: 420, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 16 }} onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>🔁 {t('template.recurringTitle')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('template.every')}</span>
          <input
            type="number" min={1} max={99} value={interval}
            onChange={e => setInterval(parseInt(e.target.value) || 1)}
            style={{ ...selectStyle, width: 64, textAlign: 'center' }}
          />
          <select value={freq} onChange={e => setFreq(e.target.value as 'day' | 'week' | 'month')} style={{ ...selectStyle, width: 'auto', flex: 1 }}>
            <option value="day">{interval > 1 ? t('template.days') : t('template.day')}</option>
            <option value="week">{interval > 1 ? t('template.weeks') : t('template.week')}</option>
            <option value="month">{interval > 1 ? t('template.months') : t('template.month')}</option>
          </select>
        </div>

        {freq === 'week' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>{t('template.theDay')}</label>
            <select value={weekday} onChange={e => setWeekday(parseInt(e.target.value))} style={selectStyle}>
              {[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={d}>{t(weekdayKeys[d])}</option>)}
            </select>
          </div>
        )}
        {freq === 'month' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>{t('template.theDayOfMonth')}</label>
            <select value={monthday} onChange={e => setMonthday(parseInt(e.target.value))} style={selectStyle}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{t('template.day')} {n}</option>)}
            </select>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {t('template.modalHint')}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          {initial && (
            <button className="btn-secondary btn-danger-outline" onClick={() => onSave(null)} style={{ marginRight: 'auto' }}>{t('template.removeRecurrence')}</button>
          )}
          <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={save}>{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}
