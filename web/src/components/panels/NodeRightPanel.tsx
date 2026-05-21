import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  node: Node
}

export default function NodeRightPanel({ node }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const [newType, setNewType] = useState('')
  const [areaInput, setAreaInput] = useState('')
  const nodeArea = store.getNodeArea(node.id)

  // ── Fecha helpers ────────────────────────────────────────────────────────
  const dueDate = node.due ? node.due.slice(0, 10) : ''
  const dueTime = node.due ? node.due.slice(11, 16) : ''
  const dueEndDate = node.dueEnd ? node.dueEnd.slice(0, 10) : ''
  const dueEndTime = node.dueEnd ? node.dueEnd.slice(11, 16) : ''

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T00:00:00`).toISOString()
    store.updateNode(node.id, { due: iso })
  }
  function setDueEnd(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { dueEnd: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T23:59:00`).toISOString()
    store.updateNode(node.id, { dueEnd: iso })
  }
  function setStatus(status: Node['status']) { store.updateNode(node.id, { status }) }
  function setPriority(priority: Node['priority']) { store.updateNode(node.id, { priority }) }
  function toggleFavorite() { store.updateNode(node.id, { isFavorite: !node.isFavorite }) }
  function toggleSeguimiento() {
    const newVal = !node.isSeguimiento
    const updates: Record<string, unknown> = { isSeguimiento: newVal }
    if (newVal && node.status !== null) updates.status = null
    store.updateNode(node.id, updates as Parameters<typeof store.updateNode>[1])
  }
  function toggleEvent() { store.updateNode(node.id, { isEvent: !node.isEvent }) }
  const isLocked = (() => {
    try { return JSON.parse(node.extraData || '{}').locked === true } catch { return false }
  })()
  function toggleLocked() {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      ed.locked = !isLocked
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch {
      store.updateNode(node.id, { extraData: JSON.stringify({ locked: !isLocked }) })
    }
  }
  function addType(type: string) {
    const t = type.trim().toLowerCase()
    if (!t || (node.types || []).includes(t)) return
    store.updateNode(node.id, { types: [...(node.types || []), t] })
    setNewType('')
  }
  function removeType(type: string) {
    store.updateNode(node.id, { types: (node.types || []).filter(t => t !== type) })
  }

  const usedTags = s.allUsedTags()

  // Tag definition nodes → "Ver área completa"
  const tags = node.types || []
  const tagNodes = s.tagDefinitions().filter(td => tags.includes(s.tagName(td) || ''))

  const statusOptions: { value: Node['status']; label: string }[] = [
    { value: null, label: '○ Sin estado' },
    { value: 'pending', label: '● Pendiente' },
    { value: 'done', label: '✓ Hecho' },
  ]
  const priorityOptions: { value: Node['priority']; label: string; style?: React.CSSProperties }[] = [
    { value: null, label: '— Ninguna' },
    { value: 'low', label: '▽ Baja' },
    { value: 'medium', label: '△ Media', style: { color: '#f59e0b' } },
    { value: 'high', label: '▲ Alta', style: { color: '#ef4444' } },
  ]
  const recurrenceOptions = [
    { value: '', label: 'Sin repetición' },
    { value: 'daily', label: '🔁 Cada día' },
    { value: 'daily:2', label: '🔁 Cada 2 días' },
    { value: 'weekly', label: '🔁 Cada semana' },
    { value: 'weekly:2', label: '🔁 Cada 2 semanas' },
    { value: 'monthly', label: '🔁 Cada mes' },
    { value: 'monthly:3', label: '🔁 Cada trimestre' },
    { value: 'yearly', label: '🔁 Cada año' },
  ]
  const nodeColor = (() => { try { return JSON.parse(node.extraData || '{}').color || null } catch { return null } })()
  const colors = [null, '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
  function setColor(color: string | null) {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (color) ed.color = color; else delete ed.color
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch {
      if (color) store.updateNode(node.id, { extraData: JSON.stringify({ color }) })
    }
  }

  return (
    <div className="node-right-panel">

      {/* Ver área completa — solo cuando hay tag definitions */}
      {tagNodes.map(td => (
        <div key={td.id} className="prop-section">
          <button className="prop-area-link" onClick={() => navigate(`/node/${td.id}`)}>
            <span className="prop-area-link-icon">◈</span>
            <span>{s.tagName(td)}</span>
            <span className="prop-area-link-arrow">→</span>
          </button>
        </div>
      ))}

      {/* ── Acciones rápidas ─────────────────────────────────────────────── */}
      <div className="prop-row">
        <button className={`prop-icon-btn ${node.isFavorite ? 'active' : ''}`} onClick={toggleFavorite} title="Fijar">
          📌 Fijado
        </button>
        <button
          className={`prop-icon-btn ${node.status !== null ? 'active' : ''}`}
          onClick={() => {
            if (node.status !== null) {
              store.updateNode(node.id, { status: null })
            } else {
              store.updateNode(node.id, { status: 'pending', isSeguimiento: false })
            }
          }}
          title="Tarea"
        >
          ○ Tarea
        </button>
        <button className={`prop-icon-btn ${node.isEvent ? 'active event' : ''}`} onClick={toggleEvent} title="Evento">
          📅 Evento
        </button>
        <button className={`prop-icon-btn ${isLocked ? 'active' : ''}`} onClick={toggleLocked} title={isLocked ? 'Desbloquear' : 'Bloquear'}>
          {isLocked ? '🔒' : '🔓'} {isLocked ? 'Bloqueado' : 'Bloquear'}
        </button>
      </div>

      {/* ── Estado ──────────────────────────────────────────────────────────── */}
      {(node.status !== null || node.isSeguimiento) && (
        <div className="prop-section">
          <div className="prop-section-label">Estado</div>
          {node.isSeguimiento && node.status !== 'done' ? (
            // Seguimiento activo
            <div className="prop-pills">
              <button className="prop-pill active" onClick={() => store.updateNode(node.id, { status: null })}>
                ● Activo
              </button>
              <button className="prop-pill" onClick={() => store.updateNode(node.id, { status: 'done' })}>
                ✓ Completado
              </button>
            </div>
          ) : node.isSeguimiento ? (
            // Seguimiento completado
            <div className="prop-pills">
              <button className="prop-pill" onClick={() => store.updateNode(node.id, { status: null })}>
                ● Activo
              </button>
              <button className="prop-pill active" onClick={() => store.updateNode(node.id, { status: 'done' })}>
                ✓ Completado
              </button>
            </div>
          ) : (
            // Tarea: Sin estado / Pendiente / Hecho
            <div className="prop-pills">
              {statusOptions.map(opt => (
                <button key={String(opt.value)} className={`prop-pill ${node.status === opt.value ? 'active' : ''}`} onClick={() => setStatus(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Prioridad ───────────────────────────────────────────────────────── */}
      {node.status !== null && (
        <div className="prop-section">
          <div className="prop-section-label">Prioridad</div>
          <div className="prop-pills">
            {priorityOptions.map(opt => (
              <button key={String(opt.value)} className={`prop-pill ${node.priority === opt.value ? 'active' : ''}`} onClick={() => setPriority(opt.value)} style={opt.style}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Fecha ───────────────────────────────────────────────────────────── */}
      {node.status !== null && (
        <div className="prop-section">
          <div className="prop-section-label">Fecha</div>
          <div className="prop-quick-dates">
            {[
              { label: 'Hoy', days: 0 },
              { label: 'Mañana', days: 1 },
              { label: 'Prx. lunes', days: (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })() },
              { label: 'Prx. semana', days: 7 },
            ].map(({ label, days }) => {
              const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0)
              const iso = d.toISOString().slice(0, 10)
              return (
                <button key={label} className={`prop-quick-date-btn ${dueDate === iso ? 'active' : ''}`} onClick={() => setDue(iso, dueTime || '09:00')}>
                  {label}
                </button>
              )
            })}
            {dueDate && <button className="prop-quick-date-btn" onClick={() => setDue('', '')}>✕</button>}
          </div>
          <div className="prop-datetime" style={{ marginTop: 6 }}>
            <input type="date" className="prop-date-input" value={dueDate} onChange={e => setDue(e.target.value, dueTime)} />
            <input type="time" className="prop-time-input" value={dueTime} onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} />
          </div>
        </div>
      )}

      {/* ── Fecha fin (evento) ────────────────────────────────────────────── */}
      {(node.isEvent || node.dueEnd) && (
        <div className="prop-section">
          <div className="prop-section-label">Fecha fin</div>
          <div className="prop-datetime">
            <input type="date" className="prop-date-input" value={dueEndDate} onChange={e => setDueEnd(e.target.value, dueEndTime)} />
            <input type="time" className="prop-time-input" value={dueEndTime} onChange={e => setDueEnd(dueEndDate, e.target.value)} disabled={!dueEndDate} />
          </div>
        </div>
      )}

      {/* ── Repetición ──────────────────────────────────────────────────────── */}
      {node.status !== null && (
        <div className="prop-section">
          <div className="prop-section-label">Repetición</div>
          <div className="prop-recurrence-chips">
            {recurrenceOptions.map(opt => (
              <button key={opt.value} className={`prop-recurrence-chip ${(node.recurrence || '') === opt.value ? 'active' : ''}`} onClick={() => store.updateNode(node.id, { recurrence: opt.value || null })} title={opt.label}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Color ───────────────────────────────────────────────────────────── */}
      <div className="prop-section">
        <div className="prop-section-label">Color</div>
        <div className="prop-color-chips">
          {colors.map(c => (
            <button key={c || 'none'} className={`prop-color-chip ${(nodeColor || null) === c ? 'active' : ''}`} style={{ background: c || 'transparent', border: c ? 'none' : '1px solid var(--border)' }} onClick={() => setColor(c)} title={c || 'Sin color'}>
              {!c && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>✕</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Área ─────────────────────────────────────────────────────────────── */}
      <div className="prop-section">
        <div className="prop-section-label">Área</div>
        <div className="prop-tags">
          {nodeArea && (
            <span className="prop-tag-chip" style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--text-accent)' }}>
              📁 {nodeArea}
              <button className="prop-tag-remove" onClick={() => store.setNodeArea(node.id, null)}>×</button>
            </span>
          )}
          {!nodeArea && (
            <>
              <input type="text" className="prop-type-input" value={areaInput}
                onChange={e => { setAreaInput(e.target.value); if (s.allAreas().includes(e.target.value)) { store.setNodeArea(node.id, e.target.value); setAreaInput('') } }}
                onKeyDown={e => { if (e.key === 'Enter' && areaInput.trim()) { store.setNodeArea(node.id, areaInput.trim()); setAreaInput('') } }}
                placeholder="+ área" list="nrp-areas-datalist"
              />
              <datalist id="nrp-areas-datalist">{s.allAreas().map(a => <option key={a} value={a} />)}</datalist>
            </>
          )}
        </div>
      </div>

      {/* ── Tags ─────────────────────────────────────────────────────────────── */}
      <div className="prop-section">
        <div className="prop-section-label">Tags</div>
        <div className="prop-tags">
          {(node.types || []).map(t => (
            <span key={t} className="prop-tag-chip" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>
              #{t}
              <button className="prop-tag-remove" onClick={() => removeType(t)}>×</button>
            </span>
          ))}
          <input type="text" className="prop-type-input" value={newType}
            onChange={e => setNewType(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addType(newType) } }}
            placeholder="+ tag" list="nrp-tags-datalist"
          />
          <datalist id="nrp-tags-datalist">
            {usedTags.filter(t => !node.types?.includes(t)).map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>

    </div>
  )
}
