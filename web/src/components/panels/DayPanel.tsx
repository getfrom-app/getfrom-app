// DayPanel — pestaña del panel derecho «Día» (modo pizarra). Muestra la columna
// unificada del día (eventos → atrasadas → hoy → bucles → nodos) vía DayColumn.
// En pizarra el outliner inline del centro está desmontado, así que esta es la
// ÚNICA instancia del outliner del día (sin duplicar).

import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import DayColumn from './DayColumn'
import NoteColumn from './NoteColumn'
import { getOrCreateAgendaRoot } from '../../utils/agendaHelper'
import { setTemporalFocus } from '../../utils/pizarraNav'

export default function DayPanel({ nodeId }: { nodeId?: string }) {
  useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const node = nodeId ? store.getNode(nodeId) : undefined
  // ¿Estamos en el LIENZO DE CONTEXTOS (ruta raíz) o dentro de un día concreto?
  const onContextsCanvas = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '') === ''

  if (!node) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary, #999)', fontSize: 14 }}>
        Abre una nota para ver su panel.
      </div>
    )
  }

  // Nota normal (no diaria) → columna «Movidos».
  if (!node.isDiaryEntry) {
    let isPizarra = false
    try { isPizarra = JSON.parse(node.extraData || '{}').viewBlock === 'pizarra' } catch { /* ignore */ }
    const onClick = (e: React.MouseEvent) => {
      if (!isPizarra) return
      const row = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
      const id = row?.getAttribute('data-node-id')
      if (id) window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
    }
    return (
      <div className="day-panel" style={{ height: '100%', overflowY: 'auto', padding: '6px 8px 88px' }} onClick={onClick}>
        <NoteColumn node={node} />
      </div>
    )
  }

  // El día abre como LIENZO salvo que su viewBlock lo fije a lista explícitamente.
  // (default: sin viewBlock → pizarra, ver NodeView.viewKind.)
  let vb = ''
  try { vb = JSON.parse(node.extraData || '{}').viewBlock || '' } catch { /* ignore */ }
  const isPizarra = vb !== 'lista' && vb !== 'tabla' && vb !== 'kanban' && vb !== 'calendario'

  // Clic en un nodo del panel → si está colocado en el lienzo, la pizarra vuela a
  // él (estilo iPad). No bloquea la edición; PizarraView filtra a hijos-del-día.
  const onPanelClick = (e: React.MouseEvent) => {
    if (!isPizarra) return
    const row = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
    const id = row?.getAttribute('data-node-id')
    if (id) window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  // ── Navegación de día: ‹ ayer · mañana › (crea el día si no existe, mismo zoom fijo). ──
  const dayDate = node.diaryDate ? new Date(node.diaryDate) : new Date()
  const stepDay = (delta: number) => {
    const d = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + delta)
    window.dispatchEvent(new CustomEvent('from:set-day', { detail: { date: d.toISOString() } }))
  }
  const isToday = (() => {
    const n = new Date()
    return dayDate.getFullYear() === n.getFullYear() && dayDate.getMonth() === n.getMonth() && dayDate.getDate() === n.getDate()
  })()

  // ── Abrir el CALENDARIO mes/año (superficie discreta, TemporalCanvasView) en el mes del día. ──
  const openCalendar = () => {
    const agenda = getOrCreateAgendaRoot()
    setTemporalFocus({ date: dayDate.getTime(), level: 'days' })
    navigate(`/node/${agenda.id}`)
  }

  // ── Alternar LISTA ↔ LIENZO para este día (persistido en su viewBlock). ──
  const toggleView = () => {
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
    ed.viewBlock = isPizarra ? 'lista' : 'pizarra'
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
  }

  return (
    <div className="day-panel" style={{ height: '100%', overflowY: 'auto', padding: '6px 8px 88px' }} onClick={onPanelClick}>
      {/* Cabecera: navegación ‹ hoy › (solo dentro de un día) + conmutador de SUPERFICIES
          [🌍 Lienzo de contextos · 📅 Calendario · 📆 Día · lista/lienzo]. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!onContextsCanvas && <>
            <button onClick={() => stepDay(-1)} title={t('dayNav.prev', 'Día anterior')} aria-label={t('dayNav.prev', 'Día anterior')} style={dayNavBtn}>‹</button>
            {!isToday && (
              <button onClick={() => window.dispatchEvent(new CustomEvent('from:set-day'))} title={t('dayNav.today', 'Hoy')} style={{ ...dayNavBtn, width: 'auto', padding: '0 8px', fontSize: 12 }}>{t('dayNav.today', 'Hoy')}</button>
            )}
            <button onClick={() => stepDay(1)} title={t('dayNav.next', 'Día siguiente')} aria-label={t('dayNav.next', 'Día siguiente')} style={dayNavBtn}>›</button>
          </>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* 🌍 Lienzo de contextos (plano infinito). Activo si ya estás en él. */}
          <button onClick={() => navigate('/')} title={t('dayNav.canvas', 'Lienzo de contextos')} aria-label={t('dayNav.canvas', 'Lienzo de contextos')} style={onContextsCanvas ? dayIconBtnActive : dayIconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 9.5a2.5 2.5 0 100 5c1.5 0 2.4-1.3 3-2.5.6-1.2 1.5-2.5 3-2.5a2.5 2.5 0 110 5c-1.5 0-2.4-1.3-3-2.5-.6-1.2-1.5-2.5-3-2.5z" />
            </svg>
          </button>
          {/* 📅 Calendario mes/año (superficie discreta). */}
          <button onClick={openCalendar} title={t('dayNav.calendar', 'Calendario')} aria-label={t('dayNav.calendar', 'Calendario')} style={dayIconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
            </svg>
          </button>
          {/* 📆 Día (hoy): entra en el lienzo del día de hoy. */}
          <button onClick={() => window.dispatchEvent(new CustomEvent('from:set-day'))} title={t('dayNav.today', 'Hoy')} aria-label={t('dayNav.today', 'Hoy')} style={(!onContextsCanvas && isToday) ? dayIconBtnActive : dayIconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><rect x="7" y="13" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {/* Lista ↔ lienzo (solo dentro de un día). */}
          {!onContextsCanvas && (
            <button onClick={toggleView} title={isPizarra ? t('dayNav.asList', 'Ver como lista') : t('dayNav.asCanvas', 'Ver como lienzo')} aria-label={isPizarra ? t('dayNav.asList', 'Ver como lista') : t('dayNav.asCanvas', 'Ver como lienzo')} style={dayIconBtn}>
              {isPizarra ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      {/* La columna derecha persiste en pizarra Y en lista: eventos + atrasadas/hoy/
          bucles + capturas. Los NODOS del día NO van aquí (includeNodes=false):
          viven en el lienzo (pizarra) o inline en el centro (lista). */}
      <DayColumn node={node} includeNodes={false} />
    </div>
  )
}

const dayNavBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer',
  fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dayIconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dayIconBtnActive: React.CSSProperties = {
  ...dayIconBtn,
  background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)',
}
