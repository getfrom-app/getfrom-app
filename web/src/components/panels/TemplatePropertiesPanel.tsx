/**
 * TemplatePropertiesPanel — propiedades de una plantilla en la columna derecha.
 * El contenido de la plantilla se edita en la ventana central (sus nodos hijos).
 * Aquí: auto-aplicar a la nota diaria y recurrencia (cada X días/semanas/meses).
 */
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/nodeStore'
import {
  getDailyTemplate, setDailyTemplate,
  getTemplateRecurrence, setTemplateRecurrence, type TemplateRecurrence,
} from '../../utils/tagsHelper'

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const FREQ_NOUN = { day: 'días', week: 'semanas', month: 'meses' } as const

function recurrenceSummary(r: TemplateRecurrence): string {
  const every = r.interval > 1 ? `Cada ${r.interval} ${FREQ_NOUN[r.freq]}` : { day: 'Cada día', week: 'Cada semana', month: 'Cada mes' }[r.freq]
  if (r.freq === 'week' && typeof r.weekday === 'number') return `${every}, ${WEEKDAYS[r.weekday]}`
  if (r.freq === 'month' && typeof r.monthday === 'number') return `${every}, día ${r.monthday}`
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
          ← Plantillas
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
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-aplicar en nota diaria</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {isDaily ? 'Cada día nuevo arranca con esta plantilla.' : 'Aplicar esta plantilla al crear la nota del día.'}
            </span>
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{isDaily ? 'Activa' : 'clic'}</span>
        </button>

        {/* Nota recurrente → abre modal de configuración */}
        <button onClick={() => setModalOpen(true)} style={toggleBtn(!!recur)}>
          <span style={dot(!!recur)} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Nota recurrente</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {recur ? recurrenceSummary(recur) : 'Insertar como sección en días concretos (cada semana, mes…).'}
            </span>
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{recur ? 'editar' : 'clic'}</span>
        </button>

        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          El contenido se edita en la ventana central, en bullets, como cualquier nota. Lo que pongas dentro es lo que se copia al aplicarla.
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
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>🔁 Nota recurrente</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cada</span>
          <input
            type="number" min={1} max={99} value={interval}
            onChange={e => setInterval(parseInt(e.target.value) || 1)}
            style={{ ...selectStyle, width: 64, textAlign: 'center' }}
          />
          <select value={freq} onChange={e => setFreq(e.target.value as 'day' | 'week' | 'month')} style={{ ...selectStyle, width: 'auto', flex: 1 }}>
            <option value="day">{interval > 1 ? 'días' : 'día'}</option>
            <option value="week">{interval > 1 ? 'semanas' : 'semana'}</option>
            <option value="month">{interval > 1 ? 'meses' : 'mes'}</option>
          </select>
        </div>

        {freq === 'week' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>El día</label>
            <select value={weekday} onChange={e => setWeekday(parseInt(e.target.value))} style={selectStyle}>
              {[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
            </select>
          </div>
        )}
        {freq === 'month' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>El día del mes</label>
            <select value={monthday} onChange={e => setMonthday(parseInt(e.target.value))} style={selectStyle}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Día {n}</option>)}
            </select>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          From insertará esta plantilla como una sección dentro de la nota de ese día (no reemplaza el día).
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          {initial && (
            <button className="btn-secondary btn-danger-outline" onClick={() => onSave(null)} style={{ marginRight: 'auto' }}>Quitar recurrencia</button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
