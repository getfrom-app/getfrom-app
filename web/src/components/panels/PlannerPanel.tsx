/**
 * PlannerPanel — Panel lateral derecho de planificación temporal.
 *
 * Modelo de datos (v2 — sin time blocks separados):
 *   - Nodos con `due` + hora → aparecen en el timeline. El nodo NO se mueve.
 *   - Nodos con `due` sin hora NO aparecen aquí (viven en la sección «Tu día»
 *     de la nota diaria). GCal: solo eventos con hora (allDay tampoco se pinta).
 *   - Vistas: Día (solo hoy, 1 columna) · Semana (2–7 columnas) · Año.
 *
 * Drag desde el árbol: asigna due+hora al nodo original. No crea duplicados.
 * GCal sync: si el usuario tiene GCal conectado, crear/actualizar evento al programar.
 *
 * Backward compat: nodos legacy _timeBlock:"1" se siguen mostrando en timeline.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { ensureDayPath, diaryDayTitle } from '../../utils/agendaHelper'
import { bumpReschedule, toggleTaskDone, detachFromRecurrence } from '../../utils/dailyCockpit'
import { isInPapelera } from '../../utils/papeleraHelper'
import { gcalEventNodeId } from '../../utils/deterministicId'
import {
  firstContextOf, contextColor, listContextTags, setNodeContext, normalizeContextPath,
  findContextByPath, ensureContextPath, containerNotesNode, type ContextTag,
} from '../../utils/cajones'
import {
  getCalendarEventsRange,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from '../../api/googleCalendar'
import { getGcalEventId, gcalIdCore, linkedGcalIdCores } from '../../utils/gcalNodesSync'
import { isTimeBlockNode, taskCheckState } from '../../utils/taskNode'
import { recurrenceFromString, nextRecurrence } from '../../utils/naturalDate'
import { GCalEventEditor } from './DiaryRightPanel'
import { TaskPropsPopover } from './DiaryPanelComponents'
import RecurrenceScopeConfirm from './RecurrenceScopeConfirm'
import { useUserStore } from '../../store/userStore'
import { useToast } from '../Toast'
import Icon from '../../v2/components/Icon'
import { usePlannerHours } from '../../utils/plannerHours'
import NewEventModal from '../modals/NewEventModal'

// ── Geometría fija ────────────────────────────────────────────────────────
// La franja del día YA NO es fija: se ajusta en Ajustes y se comparte con la
// app (ver utils/plannerHours.ts). Antes estaba clavada en 6→24, así que quien
// empieza a las 9 se comía tres horas vacías (Alberto, 22 ago 2026).
const AXIS_W          = 40
const DEFAULT_SLOT_H  = 40   // px por 30 min
const DEFAULT_DAY_CNT = 5
const MIN_SLOT_H      = 14
const MAX_SLOT_H      = 110
const MIN_DAY_CNT     = 2
const MAX_DAY_CNT     = 7
const PRE_DAYS        = 10
const MIN_BLOCK_H_FOR_TIME = 28 // px — por debajo de esto, la hora se oculta y solo queda el título

// ── Helpers ────────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r }
// ¿La "Notas" (containerNotesNode) de este nodo tiene contenido real, no solo
// HTML vacío (`<p></p>`)? — icono discreto en la tarjeta del planner para
// saber que hay algo dentro sin tener que abrirla (2 sep 2026, Alberto: "me
// gustaría... un pequeño icono en su tarjeta del planner, para saber que ese
// elemento tiene contenido dentro").
function hasNoteContent(nodeId: string): boolean {
  const notes = containerNotesNode(nodeId)
  if (!notes?.body) return false
  return notes.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length > 0
}
function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
function fmtHH(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }


/** Devuelve true si el ISO tiene hora local distinta de medianoche (= tiene hora asignada). */
function hasTime(isoStr: string): boolean {
  const d = new Date(isoStr)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/** ISO a medianoche local del día dado. */
function toMidnight(day: Date): string {
  const d = new Date(day); d.setHours(0,0,0,0); return d.toISOString()
}

// YYYY-MM-DD en hora LOCAL (toMidnight().slice(0,10) da la fecha en UTC, que
// se desplaza un día en husos horarios adelantados a UTC).
function localDateStr(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

// Nombres de día/mes según el idioma activo de la interfaz (antes fijos en español).
function dayLabel(d: Date, locale: string) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d)
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d)
  return `${weekday} ${d.getDate()} ${month}`
}
function monthLabel(d: Date, locale: string) { return new Intl.DateTimeFormat(locale, { month: 'long' }).format(d) }

// 'day' = solo hoy (1 col) · 'week' = multi-día · 'month' = rejilla mensual · 'year' = anual
type ViewMode = 'day' | 'week' | 'month' | 'year'

// Bloque con hora en el timeline
interface Block {
  kind: 'task' | 'standalone' | 'gcal' | 'timeblock'
  id: string          // nodeId para task/standalone; gcalId para gcal
  text: string
  start: Date
  end: Date
  color: string
  nodeId?: string     // id del nodo original (para task)
  gcalEvent?: CalendarEvent
  /** Proyección visual de una recurrencia (Alberto, 27 ago 2026: "solo veo la
   *  instancia de hoy, debería ver todas igual que en Apple Calendar o Google
   *  Calendar") — NO es un nodo propio, es la instancia real (`nodeId`)
   *  proyectada en un día futuro que le toca por su patrón. Al completarse
   *  siempre se sigue creando un nodo nuevo (`spawnRecurrence`, sin cambios);
   *  esto es solo la vista previa de "dónde tocará" antes de que exista. */
  virtual?: boolean
}

/** Cuántos días por delante se proyectan las recurrencias en el timeline —
 *  tope de seguridad para series raras (nunca hace falta ver más allá del
 *  horizonte que el propio Planificador puede mostrar). */
const MAX_RECURRENCE_LOOKAHEAD_DAYS = 120

/** ¿El patrón de recurrencia de `origin` cae en `day`? Devuelve la fecha exacta
 *  de esa ocurrencia (con hora heredada del nodo origen) o null si no aplica.
 *  `nextRecurrence` avanza monótonamente desde `from`, así que basta con
 *  recorrerlo hasta pasar `day` — sin necesidad de precalcular todo el rango. */
function recurrenceOccursOn(origin: Node, day: Date): Date | null {
  if (!origin.due || !origin.recurrence) return null
  const rec = recurrenceFromString(origin.recurrence)
  if (!rec) return null
  const originDue = new Date(origin.due)
  const dayStart = startOfDay(day)
  if (dayStart.getTime() <= startOfDay(originDue).getTime()) return null // solo hacia el futuro — el propio origen ya es el bloque real de su día
  const horizon = addDays(startOfDay(new Date()), MAX_RECURRENCE_LOOKAHEAD_DAYS)
  if (dayStart.getTime() > horizon.getTime()) return null
  let cursor = startOfDay(originDue)
  // Nº de pasos, no de días: una recurrencia DIARIA nunca completada se queda
  // con `due` clavado en el día que se creó — si eso fue hace más de
  // MAX_RECURRENCE_LOOKAHEAD_DAYS, el bucle se agotaba antes de alcanzar
  // siquiera "hoy" (un paso = un día) y la proyección desaparecía del
  // Planificador para siempre, aunque `day` sí cayera dentro del horizonte
  // visible (3 sep 2026). El tope real depende de la distancia real hasta el
  // horizonte, no de una constante pensada solo como límite de seguridad.
  const daysToHorizon = Math.ceil((horizon.getTime() - cursor.getTime()) / 86400000)
  const maxIterations = Math.min(Math.max(MAX_RECURRENCE_LOOKAHEAD_DAYS, daysToHorizon + 1), 5000)
  for (let i = 0; i < maxIterations; i++) {
    cursor = nextRecurrence(cursor, rec)
    if (cursor.getTime() > horizon.getTime()) return null
    if (sameDay(cursor, day)) {
      return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), originDue.getHours(), originDue.getMinutes())
    }
    if (cursor.getTime() > dayStart.getTime()) return null // ya nos pasamos de `day` sin coincidir
  }
  return null
}

// ── Leer bloques con hora (timeline) ─────────────────────────────────────
function getTimedBlocks(day: Date, gcalEvents: CalendarEvent[]): Block[] {
  const blocks: Block[] = []

  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt || isInPapelera(n.id)) continue
    const start = new Date(n.due)
    if (!sameDay(start, day)) continue

    try {
      const ed = JSON.parse(n.extraData || '{}')

      // Legacy: nodo _timeBlock separado (backward compat)
      if (ed._timeBlock === '1') {
        const linked = ed._linkedTaskId ? store.getNode(ed._linkedTaskId) : null
        const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
        blocks.push({
          kind: ed._linkedTaskId ? 'task' : 'standalone',
          id: n.id,
          text: linked ? linked.text : n.text,
          start, end,
          color: n.color || 'var(--accent)',
          nodeId: ed._linkedTaskId || n.id,
        })
        continue
      }
    } catch {}

    // Nuevo modelo: nodo con due + hora asignada
    if (!hasTime(n.due)) continue
    const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
    blocks.push({
      kind: isTimeBlockNode(n) ? 'timeblock' : 'task',
      id: n.id,
      text: n.text,
      start, end,
      color: n.color || 'var(--accent)',
      nodeId: n.id,
    })
  }

  // Proyección de recurrencias hacia el futuro (27 ago 2026, ver comentario de
  // `Block.virtual`). Solo desde instancias PENDIENTES: una vez completada,
  // `spawnRecurrence` ya crea la instancia real siguiente con el mismo
  // `recurrence` — proyectar TAMBIÉN desde instancias antiguas ya hechas
  // duplicaría la proyección con la de esa instancia nueva. Se salta un día
  // si ya hay un bloque real con el mismo texto (alguien la materializó a
  // mano, p.ej. moviendo su fecha) para no pintarla dos veces.
  const realTexts = new Set(blocks.map(b => b.text.trim().toLowerCase()))
  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt || isInPapelera(n.id) || !n.recurrence || n.status === 'done') continue
    if (sameDay(new Date(n.due), day)) continue // ya es el bloque real de su propio día
    const occursAt = recurrenceOccursOn(n, day)
    if (!occursAt) continue
    if (realTexts.has(n.text.trim().toLowerCase())) continue
    const durationMs = n.dueEnd ? (new Date(n.dueEnd).getTime() - new Date(n.due).getTime()) : 3600000
    blocks.push({
      kind: isTimeBlockNode(n) ? 'timeblock' : 'task',
      id: `${n.id}::virtual::${occursAt.toISOString()}`,
      text: n.text,
      start: occursAt,
      end: new Date(occursAt.getTime() + durationMs),
      color: n.color || 'var(--accent)',
      nodeId: n.id,
      virtual: true,
    })
  }

  // GCal timed — excluir eventos creados por Fromly (ya aparecen como bloque 'task').
  // Comparación por NÚCLEO del id (`gcalIdCore`): el listado devuelve
  // `<calendarId>::<eventId>` y el nodo guarda el id crudo, así que en crudo esta
  // comparación no acertaba nunca. Ver el comentario de `gcalIdCore`.
  const fromGcalIds = linkedGcalIdCores()
  for (const ev of gcalEvents) {
    if (ev.allDay) continue
    if (fromGcalIds.has(gcalIdCore(ev.id))) continue // ya hay un nodo local enlazado a este evento
    const start = new Date(ev.start)
    if (!sameDay(start, day)) continue
    blocks.push({
      kind: 'gcal',
      id: ev.id,
      text: ev.title,
      start, end: new Date(ev.end),
      color: ev.backgroundColor || '#4a90d9',
      gcalEvent: ev,
    })
  }

  // Dedup defensivo: un evento recurrente de Google puede llegar con un id de
  // INSTANCIA que no coincide con el gcalEventId maestro guardado en el nodo
  // local, así que fromGcalIds no lo detecta y el mismo evento se pinta dos
  // veces (nodo local 'task' + crudo 'gcal'). Nos quedamos con la versión
  // editable (nodo local) cuando coinciden título+hora de inicio. SOLO entre
  // un bloque 'gcal' y uno que no lo es — antes la clave (texto+hora) también
  // colapsaba dos bloques LOCALES distintos que coincidían en título y hora
  // (dos "Llamada" a las 09:00, por ejemplo): el segundo desaparecía sin más
  // del timeline (3 sep 2026).
  const nonGcalBlocks = blocks.filter(b => b.kind !== 'gcal')
  const nonGcalKeys = new Set(nonGcalBlocks.map(b => `${b.text.trim().toLowerCase()}|${b.start.getTime()}`))
  const gcalBlocks = blocks.filter(b => b.kind === 'gcal' && !nonGcalKeys.has(`${b.text.trim().toLowerCase()}|${b.start.getTime()}`))

  return [...nonGcalBlocks, ...gcalBlocks].sort((a, b) => a.start.getTime() - b.start.getTime())
}

// ── Bloques solapados → columnas lado a lado ─────────────────────────────
// Antes cada bloque ocupaba SIEMPRE el ancho completo de la columna del día
// (left:2, right:2), así que dos eventos a la misma hora (p.ej. un evento de
// Google Calendar y uno de Fromly) se pintaban uno encima del otro — el de
// abajo quedaba invisible salvo por un borde asomando (Alberto, 26 ago 2026).
// Algoritmo estándar de calendario: recorre los bloques ordenados por inicio,
// agrupa los que se solapan transitivamente («racimo») y dentro de cada
// racimo asigna cada bloque a la primera columna libre (greedy). El ancho de
// TODOS los bloques del racimo es 1/nº-columnas-del-racimo, aunque un bloque
// concreto no se solape con todos los demás — más simple que calcular
// expansión por huecos y correcto para el caso real (2-3 solapes).
function layoutBlocks(blocks: Block[]): Array<Block & { col: number; cols: number }> {
  const out: Array<Block & { col: number; cols: number }> = []
  let cluster: Block[] = []
  let clusterCols: Block[][] = []
  let clusterEnd = 0

  function flush() {
    if (!cluster.length) return
    const numCols = clusterCols.length
    for (const b of cluster) {
      const col = clusterCols.findIndex(c => c.includes(b))
      out.push({ ...b, col, cols: numCols })
    }
    cluster = []; clusterCols = []; clusterEnd = 0
  }

  for (const b of blocks) {
    if (cluster.length && b.start.getTime() >= clusterEnd) flush()
    cluster.push(b)
    let placed = false
    for (const col of clusterCols) {
      const last = col[col.length - 1]
      if (last.end.getTime() <= b.start.getTime()) { col.push(b); placed = true; break }
    }
    if (!placed) clusterCols.push([b])
    clusterEnd = Math.max(clusterEnd, b.end.getTime())
  }
  flush()
  return out
}

// ══════════════════════════════════════════════════════════════════════════
// PlannerPanel
// ══════════════════════════════════════════════════════════════════════════

interface Props {
  onClose: () => void
  initialView?: ViewMode
  initialDays?: number
  /** Qué pestañas día/semana/mes/año se muestran en el selector. Por defecto, las 4
      (solo relevante para v1, código muerto sin ruta que lo monte). El destino
      Agenda de v2 (único consumidor vivo) pasa ['week','month','year'] — el tab
      «Día» (rejilla de una sola columna) se retiró del todo el 24 ago 2026: su
      timeline quedó duplicado en cuanto la vista semana pasó a 3 columnas con
      la elegida siempre en el centro (ver V2App.tsx). `dayOnlyHeader`/viewMode
      'day' siguen existiendo aquí por si v1 se reactivara, pero nada en v2 los usa ya. */
  viewTabs?: ViewMode[]
  /** Cabecera simplificada de la (ya retirada) tab «Día» de v2 — código muerto
   *  desde el 24 ago 2026, se deja intacto por si hiciera falta reintroducirla. */
  dayOnlyHeader?: boolean
  /** Centra la columna de HOY en el scroll horizontal en vez de pegarla al
   *  borde derecho (comportamiento por defecto, ver `todayScrollPos()` — v1
   *  la quiere pegada a la derecha para arrastrar tareas sin buscarla, no
   *  tocar ese caso). Lo usa el tab «Planner» de Agenda en v2 (Alberto, 5 ago
   *  2026: quiere el planificador centrado, no desplazado). */
  centerToday?: boolean
  /** Avisa de cada cambio del día centrado (clic en semana/mes/año, navegación
   *  ‹/›/Hoy) — lo usa el destino Agenda de v2 (`V2App.tsx`) para que la nota
   *  diaria embebida al pie de la columna derecha (`V2RightColumn.tsx`) siga al
   *  día elegido aquí en vez de quedarse fija en la de hoy (Alberto, 24 ago
   *  2026: "al hacer clic en otro día en el planificador, debería abrir la
   *  nota de ese otro día"). Solo notifica — no dispara `from:open-detail` como
   *  hace la vista Día de más abajo, que sí abre la nota en el CENTRO. */
  onCenterDateChange?: (d: Date) => void
}

const ALL_VIEW_TABS: ViewMode[] = ['day', 'week', 'month', 'year']

export default function PlannerPanel({ onClose, initialView, initialDays, viewTabs = ALL_VIEW_TABS, dayOnlyHeader, centerToday, onCenterDateChange }: Props) {
  const { start: HOUR_START, end: HOUR_END } = usePlannerHours()
  const TOTAL_HOURS = HOUR_END - HOUR_START
  const s        = useStore()
  const us       = useUserStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()

  const today = startOfDay(new Date())
  // A7 de la auditoría (28 ago 2026): la vista elegida (Semana/Mes/Año) se
  // perdía en cuanto el componente se remontaba (abrir y cerrar un elemento,
  // navegar y volver a Agenda...) — siempre caía a `initialView` ('week' en
  // la única llamada real, V2App.tsx). Persistida en localStorage, validada
  // contra `viewTabs` (esta instancia concreta puede no admitir 'day').
  const [viewMode,      setViewMode]      = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('from_agenda_view_mode') as ViewMode | null
      if (saved && viewTabs.includes(saved)) return saved
    } catch { /* localStorage no disponible */ }
    return initialView ?? viewTabs[0] ?? 'day'
  })

  useEffect(() => {
    try { localStorage.setItem('from_agenda_view_mode', viewMode) } catch { /* localStorage no disponible */ }
  }, [viewMode])

  // Vista Mes: al abrirla, la fila de HOY a la vista — sin esto el mes abría
  // anclado al día 1 y la semana actual (con sus tareas) quedaba bajo el fold,
  // pareciendo "el mes está vacío" (auditoría 28 ago 2026, visto en vivo).
  useEffect(() => {
    if (viewMode !== 'month') return
    const id = window.setTimeout(() => {
      document.querySelector('.pp-month-daynum--today')?.scrollIntoView({ block: 'center' })
    }, 30)
    return () => window.clearTimeout(id)
  }, [viewMode])
  const [centerDate,    setCenterDate]    = useState(today)
  // Bug real (28 ago 2026): si ya estabas en el día de hoy (centerDate === hoy)
  // pero habías desplazado el scroll horizontal a mano hacia otros días, el
  // botón «Hoy» no hacía NADA — `setCenterDate(today)` no cambia el estado
  // (mismo valor), así que el efecto de scroll de abajo, atado a
  // `centerDate.toDateString()`, nunca se re-disparaba. Este contador se
  // incrementa SIEMPRE al pulsar «Hoy», forzando el reset de scroll aunque la
  // fecha centrada no haya cambiado.
  const [recenterTick,  setRecenterTick]   = useState(0)
  // Línea de "ahora" en el timeline: sin esto se calculaba una sola vez al
  // montar y quedaba congelada hasta refrescar la página (31 ago 2026, Alberto:
  // "la linea roja no se mueve cada minuto"). Se sincroniza con el cambio de
  // minuto real en vez de un setInterval a ciegas.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    const msToNextMinute = 60000 - (Date.now() % 60000)
    const timeout = setTimeout(() => {
      setNow(new Date())
      interval = setInterval(() => setNow(new Date()), 60000)
    }, msToNextMinute)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [])
  const [slotH,         setSlotH]         = useState(DEFAULT_SLOT_H)
  const [visibleDayCnt, setVisibleDayCnt] = useState(initialDays ?? DEFAULT_DAY_CNT)
  // Auto-fit: el día completo (HOUR_START–HOUR_END) cuadra en el alto del timeline,
  // sin scroll. Se desactiva al hacer zoom manual (rueda/arrastre) y vuelve con «reset».
  const [autoFit, setAutoFit] = useState(true)
  const autoFitRef = useRef(true)
  useEffect(() => { autoFitRef.current = autoFit }, [autoFit])

  const hourH    = slotH * 2
  const pxPerMin = slotH / 30
  const snapPx   = (y: number) => Math.round(y / (slotH / 2)) * (slotH / 2)
  const topPx    = (d: Date)   => Math.max(0, (d.getHours()*60 + d.getMinutes() - HOUR_START*60) * pxPerMin)
  const heightPx = (s: number, e: number) => Math.max(slotH/2, (e-s)/60000 * pxPerMin)
  const pxToTime = (px: number, day: Date) => {
    const mins = snapPx(Math.max(0, px)) / pxPerMin + HOUR_START * 60
    const d = new Date(day); d.setHours(Math.floor(mins/60), Math.min(59, mins%60), 0, 0); return d
  }

  const [gcalEvents,  setGcalEvents]  = useState<CalendarEvent[]>([])
  const [editingGcal, setEditingGcal] = useState<CalendarEvent | null>(null)
  // «+» por bloque → ventana de fecha/recurrencia SIN salir del planificador
  // (27 ago 2026, Alberto: "un '+' en cada casilla... si le da al '+' se abre
  // la ventana de edición, y si se le da a la ficha completa se abre la
  // página del evento, tarea o timeblock" — antes el bloque entero solo sabía
  // abrir la nota, sin atajo para tocar solo la fecha/repetición).
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  // «¿Solo esta instancia o todas las siguientes?» al arrastrar/redimensionar
  // un bloque recurrente (27 ago 2026, Alberto: "cuando se... mueve... un
  // evento recurrente o timeblock o tarea recurrente, debe preguntar igual
  // que Apple Calendar"). `guardRecurrence` corta la operación si el nodo es
  // recurrente y la retoma tras la respuesta; si no lo es, se ejecuta al
  // instante como siempre.
  const [pendingRecAction, setPendingRecAction] = useState<{ verb: string; run: (scope: 'this' | 'all') => void } | null>(null)
  function guardRecurrence(nodeId: string, verb: string, run: (scope: 'this' | 'all') => void) {
    const n = store.getNode(nodeId)
    if (!n?.recurrence) { run('all'); return }
    setPendingRecAction({ verb, run })
  }
  const [ctxMenu, setCtxMenu]         = useState<{x:number;y:number;b:Block}|null>(null)
  const [newBlock, setNewBlock]       = useState<{day:Date;start:Date;top:number;text:string;isTimeBlock?: boolean}|null>(null)
  const newBlockRef                   = useRef<HTMLInputElement>(null)
  const [newAllDay, setNewAllDay]     = useState<{day:Date;text:string}|null>(null)
  const newAllDayRef                  = useRef<HTMLInputElement>(null)
  // Mismo motivo que `newBlockCommittedRef` (ver más abajo) — Enter desmonta
  // el input, el desmontaje dispara un blur nativo que volvería a llamar a
  // commitNewAllDay con el cierre de ANTES del `setNewAllDay(null)`, creando
  // la tarea dos veces. También se marca en Escape (no solo tras commitir),
  // para que un blur tardío tras cancelar no la cree igualmente.
  const newAllDayCommittedRef         = useRef(false)
  // Contexto elegido con el predictivo «#» dentro de la tarea del planner
  // (Alberto, 31 ago 2026: "me gustaría poder poner contextos con # también
  // en las tareas del planner, con un predictivo igual que en cualquier
  // texto") — mismo mecanismo que `DocContextMention.tsx`, adaptado a un
  // `<input>` plano en vez del editor TipTap.
  const [allDayCtxMention, setAllDayCtxMention] = useState<{ query: string; start: number } | null>(null)
  const [allDayCtxSel, setAllDayCtxSel]         = useState(0)
  const [allDayPickedCtxId, setAllDayPickedCtxId] = useState<string | null>(null)
  // Dónde quedó insertado el «#label » al elegir contexto — a diferencia de
  // `DocContextMention.tsx` (que SÍ deja el `#texto` visible, como enlace
  // estilado, dentro de un documento rico), aquí el título es texto plano de
  // la tarea: se ve tal cual en cualquier lista (Alberto, 3 sep 2026, con
  // captura real: "debería eliminarse el texto del #mediasector... que se
  // quede el contexto pero que no se vea el #"). Se recorta este tramo exacto
  // al guardar — el contexto ya quedó asignado aparte (`setNodeContext`), el
  // texto no lo necesita.
  const [allDayPickedCtxSpan, setAllDayPickedCtxSpan] = useState<{ start: number; text: string } | null>(null)
  const [snapLine, setSnapLine]       = useState<{dayKey:string;top:number}|null>(null)
  // Clic en el hueco vacío de una celda del mes → elegir tarea o evento
  // (Alberto, 27 ago 2026: el número del día abre el día; el resto de la
  // celda debe permitir crear directamente).
  const [monthAddMenu, setMonthAddMenu] = useState<{day: Date; x: number; y: number} | null>(null)
  const [monthNewEventDay, setMonthNewEventDay] = useState<Date | null>(null)

  // ── GCal ──────────────────────────────────────────────────────────────────
  // Instantánea local, NO reactiva al store: borrar/mover una tarea enlazada a
  // Google desde fuera (p.ej. el botón de eliminar de "Eventos de hoy" en
  // DayColumn) actualiza el nodo local al instante, pero el bloque 'gcal' crudo
  // — deduplicado por título+hora contra ese nodo — se queda huérfano aquí
  // hasta que esta instantánea se refresque, así que el bloque parece no
  // borrarse/moverse hasta hacer refresh (Alberto, 22 jul). `pushEventToGcal`/
  // `deleteGcalEventForNode` disparan `from:gcal-events-changed` al escribir en
  // Google — la escuchamos aquí para refrescar sin esperar al date-change.
  const [gcalError, setGcalError] = useState('')
  const fetchGcalEvents = () => {
    if (!us.googleConnected) return
    setGcalError('')
    getCalendarEventsRange(addDays(centerDate,-14), addDays(centerDate,14))
      .then(evs => { setGcalEvents(evs); setGcalError('') })
      .catch(e => {
        console.error('[PlannerPanel] GCal error:', e)
        setGcalError(t('tip.gcalLoadError'))
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('token') || msg.includes('401') || msg.includes('refresh')) {
          us.markGoogleDisconnected()
        }
      })
  }
  useEffect(fetchGcalEvents, [us.googleConnected, centerDate.toDateString()]) // eslint-disable-line
  useEffect(() => {
    window.addEventListener('from:gcal-events-changed', fetchGcalEvents)
    return () => window.removeEventListener('from:gcal-events-changed', fetchGcalEvents)
  }) // eslint-disable-line

  // Vista Día (tab «Día» de la columna derecha, viewTabs=['day']): cada día tiene
  // su propia nota diaria — al entrar en la vista o navegar a otro día (‹/›/Hoy),
  // se abre esa nota en el espacio central, igual que ya hacían los clics en la
  // rejilla de mes/año (Alberto, 22 jul: "cada vez que se abre un día, se abre su
  // nota diaria"). El planner Semana/Mes/Año del tab «Planner» de Agenda (V2App.tsx)
  // nunca pasa por aquí — no incluye 'day' en sus viewTabs.
  useEffect(() => {
    if (viewMode !== 'day') return
    const dayNode = ensureDayPath(centerDate)
    window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: dayNode.id } }))
  }, [viewMode, centerDate.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notifica el día centrado al contenedor (destino Agenda v2 → nota diaria
  // embebida al pie de la columna derecha). Independiente del efecto de arriba:
  // ese solo corre en viewMode 'day' (código muerto en v2, ver comentario del
  // prop `viewTabs`); este corre siempre que haya alguien escuchando.
  useEffect(() => {
    onCenterDateChange?.(centerDate)
  }, [centerDate.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    us.refreshGoogleStatus?.()
  }, []) // eslint-disable-line

  // ── GCal sync helper ──────────────────────────────────────────────────────
  // `gcalSyncInFlight`: sin esto, dos llamadas casi simultáneas para el MISMO
  // nodo (p.ej. Enter+blur al crear un bloque nuevo) leen `node.gcalEventId`
  // como null EN LAS DOS antes de que la primera termine de guardar el link,
  // así que las dos CREAN un evento en Google y la segunda pisa el link de la
  // primera — el evento sobrante queda huérfano, visible como tarjeta
  // duplicada y superpuesta en el planner (Alberto, 22 jul: "no se tiene que
  // duplicar la tarea por mucho que se haya sincronizado con Google Calendar").
  const gcalSyncInFlight = useRef<Set<string>>(new Set())
  async function syncNodeToGcal(nodeId: string, start: Date, end: Date) {
    if (!us.googleConnected) return
    if (gcalSyncInFlight.current.has(nodeId)) return
    const node = store.getNode(nodeId)
    if (!node) return
    gcalSyncInFlight.current.add(nodeId)
    try {
      // `getGcalEventId` y no `node.gcalEventId`: el link puede vivir en
      // extraData (así lo escriben NodeView/OutlinerNode/DayColumn). Leyendo
      // solo la columna, arrastrar un nodo ya enlazado CREABA un segundo evento
      // en Google y dejaba el anterior huérfano en su hora vieja.
      const linkedGcalId = getGcalEventId(node)
      if (linkedGcalId) {
        const updated = await updateCalendarEvent(linkedGcalId, {
          title: node.text,
          start: start.toISOString(),
          end: end.toISOString(),
        })
        setGcalEvents(p => p.map(x => gcalIdCore(x.id) === gcalIdCore(updated.id) ? { ...updated, id: x.id } : x))
      } else {
        const created = await createCalendarEvent({
          title: node.text,
          start: start.toISOString(),
          end: end.toISOString(),
        })
        store.updateNode(nodeId, { gcalEventId: created.id })
        setGcalEvents(p => [...p, created])
      }
    } catch (e) {
      console.error('[PlannerPanel] GCal sync error:', e)
    } finally {
      gcalSyncInFlight.current.delete(nodeId)
    }
  }

  async function removeNodeFromGcal(nodeId: string) {
    if (!us.googleConnected) return
    const node = store.getNode(nodeId)
    const linkedGcalId = node ? getGcalEventId(node) : null
    if (!linkedGcalId) return
    try {
      await deleteCalendarEvent(linkedGcalId)
      setGcalEvents(p => p.filter(x => gcalIdCore(x.id) !== gcalIdCore(linkedGcalId)))
      store.updateNode(nodeId, { gcalEventId: null })
    } catch (e) {
      console.error('[PlannerPanel] GCal delete error:', e)
    }
  }

  // ── colW dinámico ─────────────────────────────────────────────────────────
  const [colW, setColW] = useState(120)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function update() {
      const el = timelineRef.current
      if (!el) return
      const avail = el.clientWidth - AXIS_W - 2
      const cnt = viewMode === 'day' ? 1 : visibleDayCnt
      setColW(Math.max(60, Math.floor(avail / cnt)))
      // Auto-fit del alto: que el día entero quepa sin scroll. Resta lo que ocupan
      // la cabecera de días + la franja «todo el día» (viven dentro del scroll, así
      // que el grid solo dispone de clientHeight − offset de la rejilla).
      if (autoFitRef.current && (viewMode === 'day' || viewMode === 'week') && el.clientHeight > 0) {
        const gridEl = el.querySelector('.pp-grid') as HTMLElement | null
        const offset = gridEl ? gridEl.offsetTop : 64
        setSlotH(Math.max(6, Math.floor((el.clientHeight - offset - 2) / (TOTAL_HOURS * 2))))
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (timelineRef.current) ro.observe(timelineRef.current)
    return () => ro.disconnect()
  }, [visibleDayCnt, viewMode, autoFit])

  // ── Zoom Y (eje vertical) ────────────────────────────────────────────────
  function handleAxisDrag(e: React.MouseEvent) {
    e.preventDefault()
    setAutoFit(false)
    const startY     = e.clientY
    const startSlotH = slotH
    const scrollEl   = scrollVRef.current
    const scrollFrac = scrollEl ? scrollEl.scrollTop / (TOTAL_HOURS * startSlotH * 2) : 0
    function onMove(ev: MouseEvent) {
      const delta   = startY - ev.clientY
      const minSlot = scrollEl ? Math.max(8, Math.floor(scrollEl.clientHeight / (TOTAL_HOURS * 2))) : 8
      const newSlot = Math.max(minSlot, Math.min(MAX_SLOT_H, startSlotH + delta * 0.5))
      setSlotH(newSlot)
      if (scrollEl) scrollEl.scrollTop = scrollFrac * TOTAL_HOURS * newSlot * 2
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Zoom X (cabecera días) ────────────────────────────────────────────────
  function handleHeadersDrag(e: React.MouseEvent) {
    if (viewMode === 'day') return // vista día: una sola columna, sin zoom X
    if ((e.target as HTMLElement).closest('.pp-col-head')) return
    e.preventDefault()
    const startX   = e.clientX
    const startCnt = visibleDayCnt
    function onMove(ev: MouseEvent) {
      const steps = Math.round((ev.clientX - startX) / 40)
      setVisibleDayCnt(Math.max(MIN_DAY_CNT, Math.min(MAX_DAY_CNT, startCnt + steps)))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function resetZoom() {
    setVisibleDayCnt(initialDays ?? DEFAULT_DAY_CNT)
    setAutoFit(true)
    const el = timelineRef.current
    if (el && el.clientHeight > 0) {
      const gridEl = el.querySelector('.pp-grid') as HTMLElement | null
      const offset = gridEl ? gridEl.offsetTop : 64
      setSlotH(Math.max(6, Math.floor((el.clientHeight - offset - 2) / (TOTAL_HOURS * 2))))
    } else setSlotH(DEFAULT_SLOT_H)
    if (scrollVRef.current) scrollVRef.current.scrollTop = 0
  }

  // ── Días visibles ─────────────────────────────────────────────────────────
  const visibleDays = useMemo(() =>
    viewMode === 'day'
      ? [centerDate]
      : Array.from({ length: PRE_DAYS*2+1 }, (_, i) => addDays(centerDate, i - PRE_DAYS))
  , [centerDate.toDateString(), viewMode]) // eslint-disable-line

  // Días de pre-carga a la izquierda del centro (0 en vista día: única columna)
  const preDays = viewMode === 'day' ? 0 : PRE_DAYS

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollHRef = useRef<HTMLDivElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const scrollVRef = useRef<HTMLDivElement>(null)

  // Posición de scroll para la columna de HOY (centerDate). Por defecto pegada al
  // borde DERECHO del viewport — no centrada. Alberto: quiere poder arrastrar
  // tareas a «hoy» sin tener que buscarlo, siempre en el mismo sitio predecible
  // (la derecha). Los días anteriores quedan visibles a la izquierda como
  // contexto reciente. Con `centerToday` (tab Planner de Agenda en v2, Alberto
  // 5 ago 2026) la misma columna queda centrada en su lugar — un único punto de
  // bifurcación del que cuelgan sus 3 consumidores (montaje, `centerNow`,
  // `isAlreadyCentered`), sin tocarlos uno a uno.
  function todayScrollPos(): number {
    if (!scrollHRef.current) return 0
    const viewportW = scrollHRef.current.clientWidth - AXIS_W
    if (centerToday) return Math.max(0, (preDays + 0.5) * colW - viewportW / 2)
    return Math.max(0, (preDays + 1) * colW - viewportW)
  }

  useLayoutEffect(() => {
    if (viewMode === 'year' || !scrollHRef.current) return
    scrollHRef.current.scrollLeft = todayScrollPos()
  }, [viewMode, centerDate.toDateString(), colW, recenterTick]) // eslint-disable-line

  useLayoutEffect(() => {
    if (!scrollVRef.current) return
    // Con auto-fit el día entero cabe → sin scroll. Si hay zoom manual, centra en ahora.
    scrollVRef.current.scrollTop = autoFit ? 0 : Math.max(0, topPx(new Date()) - 100)
  }, [viewMode, autoFit])

  function centerNow() {
    if (!scrollHRef.current) return
    scrollHRef.current.scrollTo({ left: todayScrollPos(), behavior: 'smooth' })
    if (scrollVRef.current) scrollVRef.current.scrollTo({ top: Math.max(0, topPx(new Date()) - 120), behavior: 'smooth' })
  }

  function isAlreadyCentered(): boolean {
    if (!scrollHRef.current) return true
    return Math.abs(scrollHRef.current.scrollLeft - todayScrollPos()) < colW * 0.4
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || viewMode === 'year') return
      // Prioridad 1: cerrar input de nuevo bloque
      if (newBlock) {
        e.stopPropagation()
        e.preventDefault()
        setNewBlock(null)
        return
      }
      // Prioridad 2: centrar el scroll si no está centrado
      if (!isAlreadyCentered()) { e.stopPropagation(); centerNow() }
      // Si ya está centrado, dejar propagar → comportamiento normal de Escape
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [viewMode, colW, slotH, newBlock]) // eslint-disable-line

  // ── Refs drag/resize ──────────────────────────────────────────────────────
  const justResized  = useRef(false)
  const justDragged  = useRef(false)
  const resizeRef    = useRef<{id:string; startMs:number; gcalEvent?:CalendarEvent}|null>(null)
  // Offset del cursor respecto al top del bloque al iniciar el drag (px).
  // Se usa en dragOver para posicionar la snap line en el inicio real del bloque.
  const dragOffsetY  = useRef(0)

  // ── Drop en columna timeline ──────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, day: Date, colEl: HTMLElement) {
    e.preventDefault()
    const nodeId  = e.dataTransfer.getData('plannerTaskId')
                 || e.dataTransfer.getData('nodeId')
                 || e.dataTransfer.getData('text/plain')
    const blockId = e.dataTransfer.getData('plannerBlockId')
    const rect    = colEl.getBoundingClientRect()

    if (nodeId) {
      const node = store.getNode(nodeId)
      if (!node) return
      const hadDate = !!node.due // ya tenía fecha → es un REAGENDADO (cuenta para el badge)
      const rawY = e.clientY - rect.top
      const rawStart = pxToTime(rawY, day)
      const clampedHour = Math.max(HOUR_START, Math.min(HOUR_END - 1, rawStart.getHours()))
      const start = new Date(rawStart)
      if (rawStart.getHours() < HOUR_START || rawStart.getHours() >= HOUR_END) {
        start.setHours(clampedHour, 0, 0, 0)
      }
      const end = new Date(start.getTime() + 3600000)

      guardRecurrence(nodeId, t('planner.moveVerb', 'mover'), scope => {
        if (scope === 'this') detachFromRecurrence(node)
        // Nuevo modelo: solo actualizar due+dueEnd en el nodo original. Sin mover, sin duplicar.
        store.updateNode(nodeId, {
          due:    start.toISOString(),
          dueEnd: end.toISOString(),
          // Asegurar que tiene status para que aparezca como tarea
          status: node.status ?? 'pending',
        })
        if (hadDate) bumpReschedule(nodeId)
        // GCal sync
        syncNodeToGcal(nodeId, start, end)
      })

    } else if (blockId) {
      // Mover bloque legacy (_timeBlock) o bloque nuevo
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const start   = pxToTime(e.clientY - rect.top - offsetY, day)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
      const n = store.getNode(blockId)
      if (!n?.due) return
      const dur = n.dueEnd ? new Date(n.dueEnd).getTime() - new Date(n.due).getTime() : 3600000
      const end = new Date(start.getTime() + dur)

      guardRecurrence(blockId, t('planner.moveVerb', 'mover'), scope => {
        if (scope === 'this') detachFromRecurrence(n)
        try {
          const ed = JSON.parse(n.extraData || '{}')
          if (ed._timeBlock === '1') {
            // Legacy: mover el time block + mover el nodo vinculado al nuevo día diary
            store.updateNode(blockId, { due: start.toISOString(), dueEnd: end.toISOString(), parentId: ensureDayPath(day).id })
            return
          }
        } catch {}

        // Nuevo modelo: actualizar due en el nodo original
        store.updateNode(blockId, { due: start.toISOString(), dueEnd: end.toISOString() })
        syncNodeToGcal(blockId, start, end)
      })

    } else {
      // GCal event arrastrado
      const gcalId = e.dataTransfer.getData('plannerGcalId')
      if (!gcalId) return
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const newStart = pxToTime(e.clientY - rect.top - offsetY, day)
      if (newStart.getHours() < HOUR_START || newStart.getHours() >= HOUR_END) return
      const ev = gcalEvents.find(x => x.id === gcalId)
      if (!ev) return
      const dur = new Date(ev.end).getTime() - new Date(ev.start).getTime()
      const newEnd = new Date(newStart.getTime() + dur)
      const optimistic: CalendarEvent = { ...ev, start: newStart.toISOString(), end: newEnd.toISOString() }
      setGcalEvents(p => p.map(x => x.id === gcalId ? optimistic : x))
      updateCalendarEvent(gcalId, { start: newStart.toISOString(), end: newEnd.toISOString() })
        .then(updated => setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x)))
        .catch(() => setGcalEvents(p => p.map(x => x.id === gcalId ? ev : x)))
    }
  }

  // ── Slot clic → nuevo bloque standalone ──────────────────────────────────
  // `newBlockCommittedRef`: el input dispara commitNewBlock tanto en Enter
  // como en blur — al pulsar Enter, el input se desmonta (newBlock pasa a
  // null) y ese desmontaje dispara un blur nativo que vuelve a llamar a
  // commitNewBlock ANTES de que el cierre sobre `newBlock` refleje el null,
  // así que el segundo disparo también crea el nodo — y su propio push a
  // Google, duplicado (Alberto, 22 jul: "se crean dos tarjetas... no se tiene
  // que duplicar la tarea").
  const newBlockCommittedRef = useRef(false)
  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if (justResized.current || justDragged.current) return
    if ((e.target as HTMLElement).closest('.pp-block') || (e.target as HTMLElement).closest('.pp-new-block')) return
    const rawY  = e.clientY - colEl.getBoundingClientRect().top
    const start = pxToTime(rawY, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    newBlockCommittedRef.current = false
    setNewBlock({ day, start, top: snapPx(rawY), text: '' })
    setTimeout(() => newBlockRef.current?.focus(), 20)
  }

  // Botón derecho sobre el hueco vacío → crear un TimeBlock en vez de una tarea
  // con hora (26 ago 2026, Alberto: "cuando estoy en el planificador y hago
  // clic, crea por defecto un evento [tarea con hora]... si le doy botón
  // derecho me da opción de timeblock"). Mismo composer inline que el clic
  // normal — solo cambia el flag que lee `commitNewBlock` al guardar.
  function handleSlotContextMenu(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if ((e.target as HTMLElement).closest('.pp-block')) return
    e.preventDefault()
    const rawY  = e.clientY - colEl.getBoundingClientRect().top
    const start = pxToTime(rawY, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    newBlockCommittedRef.current = false
    setNewBlock({ day, start, top: snapPx(rawY), text: '', isTimeBlock: true })
    setTimeout(() => newBlockRef.current?.focus(), 20)
  }

  function commitNewBlock() {
    if (!newBlock || newBlockCommittedRef.current) return
    newBlockCommittedRef.current = true
    if (newBlock.text.trim()) {
      const start = newBlock.start
      const end   = new Date(start.getTime() + 3600000)
      if (newBlock.isTimeBlock) {
        // TimeBlock: SIN `isTask` (no es una tarea, no lleva checkbox ni
        // aparece en ninguna lista de tareas/agenda) — solo due+hora y la
        // marca `_timeblock`. Se sincroniza con Google Calendar igual que
        // cualquier bloque del planificador (`syncNodeToGcal`, no depende de
        // `isEvent`). Ver `utils/taskNode.ts::isTimeBlockNode`.
        const newNode = store.createNode({
          text:     newBlock.text.trim(),
          parentId: ensureDayPath(newBlock.day).id,
          due:      start.toISOString(),
        })
        store.updateNode(newNode.id, { dueEnd: end.toISOString(), extraData: JSON.stringify({ _timeblock: '1' }) })
        syncNodeToGcal(newNode.id, start, end)
        showToast(t('planner.timeBlockCreated', 'Bloque de tiempo creado'))
      } else {
        // Crear nodo standalone con due+hora (sin _timeBlock)
        const newNode = store.createNode({
          text:     newBlock.text.trim(),
          parentId: ensureDayPath(newBlock.day).id,
          due:      start.toISOString(),
          isTask:   true,
        })
        store.updateNode(newNode.id, { dueEnd: end.toISOString() })
        syncNodeToGcal(newNode.id, start, end)
        showToast(t('ai.actionTaskCreated', 'Tarea creada'))
      }
    }
    setNewBlock(null)
  }

  // ── Nueva tarea «todo el día» (fecha sin hora) ───────────────────────────
  // `keepOpen` retirado (31 ago 2026, Alberto: "al escribir una tarea y dar
  // enter se crea otro placeholder para otra tarea, y no debería, simplemente
  // se debe confirmar la tarea que se está escribiendo") — Enter ya no
  // encadena un input en blanco, solo confirma y cierra, igual que el bloque
  // con hora (`commitNewBlock`).
  function commitNewAllDay() {
    if (!newAllDay || newAllDayCommittedRef.current) return
    newAllDayCommittedRef.current = true
    // Quita el «#label » insertado al elegir contexto — el contexto ya se
    // asigna aparte (`setNodeContext`), el título no debe repetirlo. Solo si
    // el tramo sigue intacto donde se insertó (el usuario no lo tocó a mano).
    let rawText = newAllDay.text
    if (allDayPickedCtxSpan) {
      const { start, text: mentionText } = allDayPickedCtxSpan
      if (rawText.slice(start, start + mentionText.length) === mentionText) {
        rawText = rawText.slice(0, start) + rawText.slice(start + mentionText.length)
      }
    }
    if (rawText.trim()) {
      const newNode = store.createNode({
        text:     rawText.trim(),
        parentId: ensureDayPath(newAllDay.day).id,
        due:      toMidnight(newAllDay.day),   // medianoche = todo el día (sin hora)
        isTask:   true,
      })
      if (allDayPickedCtxId) setNodeContext(newNode.id, allDayPickedCtxId)
      showToast(t('ai.actionTaskCreated', 'Tarea creada'))
    }
    setNewAllDay(null)
    setAllDayCtxMention(null)
    setAllDayPickedCtxId(null)
    setAllDayPickedCtxSpan(null)
  }

  // ── Predictivo «#contexto» dentro de la tarea del planner ────────────────
  const normCtx = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // Posición del popup — anclado al input (no a la posición del caret dentro
  // del texto, más simple y de sobra para un campo de una sola línea corta).
  function allDayMentionPos(el: HTMLInputElement | null): { top: number; left: number } {
    if (!el) return { top: 0, left: 0 }
    const r = el.getBoundingClientRect()
    return { top: Math.min(r.bottom + 4, window.innerHeight - 220), left: Math.min(r.left, window.innerWidth - 280) }
  }

  function detectAllDayCtxMention(value: string, caret: number) {
    const before = value.slice(0, caret)
    const match = /(^|\s)#([^\s#]{0,60})$/.exec(before)
    if (!match) { setAllDayCtxMention(null); return }
    setAllDayCtxMention({ query: match[2], start: caret - match[2].length - 1 })
    setAllDayCtxSel(0)
  }

  const allDayCtxMatches = useMemo((): (ContextTag | { create: string })[] => {
    if (!allDayCtxMention) return []
    const q = normCtx(allDayCtxMention.query.trim())
    const tags = listContextTags().filter(tg => !q || normCtx(tg.path).includes(q) || normCtx(tg.label).includes(q)).slice(0, 8)
    const typed = normalizeContextPath(allDayCtxMention.query)
    const out: (ContextTag | { create: string })[] = [...tags]
    if (typed && !findContextByPath(typed)) out.push({ create: allDayCtxMention.query.trim() })
    return out
  }, [allDayCtxMention])

  function pickAllDayCtx(item: ContextTag | { create: string }) {
    if (!allDayCtxMention || !newAllDay) return
    let ctxId: string | null
    let label: string
    if ('create' in item) {
      const created = ensureContextPath(item.create)
      if (!created) { setAllDayCtxMention(null); return }
      ctxId = created.id
      label = item.create
    } else {
      ctxId = item.node.id
      label = item.path
    }
    const { start, query } = allDayCtxMention
    const value = newAllDay.text
    const mentionText = `#${label} `
    const next = `${value.slice(0, start)}${mentionText}${value.slice(start + 1 + query.length)}`
    setNewAllDay(s => s ? { ...s, text: next } : s)
    setAllDayPickedCtxId(ctxId)
    setAllDayPickedCtxSpan({ start, text: mentionText })
    setAllDayCtxMention(null)
    setTimeout(() => newAllDayRef.current?.focus(), 0)
  }

  // ── Drag bloque en timeline ───────────────────────────────────────────────
  function handleBlockDragStart(e: React.DragEvent, b: Block) {
    const el = e.currentTarget as HTMLElement
    const offsetY = String(Math.round(e.clientY - el.getBoundingClientRect().top))
    if (b.kind === 'gcal') {
      e.dataTransfer.setData('plannerGcalId', b.id)
    } else {
      // Usar el nodeId real del nodo (no el id del legacy time block)
      const realId = b.nodeId || b.id
      e.dataTransfer.setData('plannerBlockId', realId)
    }
    e.dataTransfer.setData('plannerBlockOffsetY', offsetY)
    e.dataTransfer.effectAllowed = 'move'
    dragOffsetY.current = parseFloat(offsetY)  // para corregir snap line en dragOver
    justDragged.current = false
    const onEnd = () => {
      justDragged.current = true
      dragOffsetY.current = 0  // reset tras soltar
      setTimeout(()=>{justDragged.current=false},200)
      el.removeEventListener('dragend',onEnd)
    }
    el.addEventListener('dragend', onEnd)
  }

  // ── Resize bloque ─────────────────────────────────────────────────────────
  function handleBlockResize(e: React.MouseEvent, b: Block) {
    e.stopPropagation(); e.preventDefault()
    const startMs = b.start.getTime()
    resizeRef.current = { id: b.nodeId || b.id, startMs, gcalEvent: b.kind === 'gcal' ? b.gcalEvent : undefined }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const realId = resizeRef.current.id
      const el = document.querySelector(`[data-pp-block="${b.id}"]`) as HTMLElement
      const col = el?.closest('.pp-col') as HTMLElement
      if (!el || !col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(resizeRef.current.startMs)))
      el.style.height = h + 'px'
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const { id, startMs: sMs, gcalEvent } = resizeRef.current; resizeRef.current = null
      const col = document.querySelector(`[data-pp-block="${b.id}"]`)?.closest('.pp-col') as HTMLElement
      if (!col) return
      const h = Math.max(slotH/2, snapPx(ev.clientY - col.getBoundingClientRect().top) - topPx(new Date(sMs)))
      const newEnd = new Date(sMs + h / pxPerMin * 60000)
      if (gcalEvent) {
        const optimistic = { ...gcalEvent, end: newEnd.toISOString() }
        setGcalEvents(p => p.map(x => x.id === gcalEvent.id ? optimistic : x))
        updateCalendarEvent(gcalEvent.id, { end: newEnd.toISOString() })
          .then(updated => setGcalEvents(p => p.map(x => x.id === updated.id ? updated : x)))
          .catch(() => setGcalEvents(p => p.map(x => x.id === gcalEvent.id ? gcalEvent : x)))
      } else {
        guardRecurrence(id, t('planner.resizeVerb', 'cambiar la duración de'), scope => {
          const n0 = store.getNode(id)
          if (scope === 'this' && n0) detachFromRecurrence(n0)
          store.updateNode(id, { dueEnd: newEnd.toISOString() })
          const n = store.getNode(id)
          if (n?.due) syncNodeToGcal(id, new Date(n.due), newEnd)
        })
      }
      justResized.current = true; setTimeout(()=>{justResized.current=false}, 200)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // Color base del planner: el de Ajustes (`from_planner_color`) o el acento del
  // tema. Sirve de acento por defecto cuando el bloque no tiene contexto propio.
  const plannerBase = (typeof document !== 'undefined'
    ? (localStorage.getItem('from_planner_color') || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
    : '') || '#3E5C76'

  // ── Render bloque ─────────────────────────────────────────────────────────
  function renderBlock(b: Block & { col?: number; cols?: number }) {
    // Barra de acento del bloque: si el nodo tiene contexto asignado, su color
    // manda sobre el acento genérico del Planificador (Alberto, 22 jul: "si el
    // evento tiene contexto, se colorea del color del contexto").
    const blockNode = b.nodeId ? store.getNode(b.nodeId) : null
    const blockCtx = blockNode ? firstContextOf(blockNode) : null
    const accentColor = blockCtx ? contextColor(blockCtx.id) : plannerBase
    // Eventos (evento crudo de Google o nodo marcado `isEvent`) llevan un
    // sombreado muy débil del color de su contexto — así se distinguen de un
    // vistazo de las tareas, que se quedan sin fondo (borde + barra de acento,
    // sin cambios; Alberto, 31 ago 2026: "los eventos... las tareas las
    // dejamos como están, así se diferencian").
    const isGcal = b.kind === 'gcal'
    const isEvent = isGcal || blockNode?.isEvent === true
    const bg = isEvent ? `color-mix(in srgb, ${accentColor} 14%, transparent)` : 'transparent'
    // Clampar al día: un bloque NUNCA se sale del rango 06–24 (evita que un evento
    // multi-día o con duración errónea infle el scroll con espacio vacío).
    const gridH = TOTAL_HOURS * hourH
    const blockTop = Math.max(0, Math.min(topPx(b.start), gridH - slotH / 2))
    const blockH = Math.max(slotH / 2, Math.min(heightPx(b.start.getTime(), b.end.getTime()), gridH - blockTop))
    // Checkbox SOLO en tareas puras (con `status`, sin hora de evento). Los
    // eventos (`isEvent`) NO llevan checkbox en el planificador — visualmente
    // se distinguen de una tarea con hora (Alberto, 26 ago 2026: "el evento de
    // la reunión con Alfredo... no debe llevar checkbox porque es un evento").
    // Reemplaza la regla anterior (5 ago 2026) que SÍ los mostraba por ser
    // "una tarea con día y hora" — decisión visual explícita, no toca el
    // modelo de datos (un evento sigue teniendo `status` y se puede completar
    // desde otros sitios). Lo que sigue distinguiéndose aparte es lo que NO es
    // un nodo: el evento crudo de Google (`isGcal`), que no se puede completar
    // en Fromly. Reutiliza toggleTaskDone (mismo que DayColumn) para no romper
    // el paso a «Atrasadas» al día siguiente.
    // Una proyección virtual no es un nodo propio de ese día — no se puede
    // completar ni arrastrar como si lo fuera (eso seguiría creando/tocando
    // el nodo ORIGEN, con fecha distinta). El clic sigue abriendo el origen.
    const checkable = !isGcal && !b.virtual && !!blockNode && blockNode.status != null && !blockNode.isEvent && !isTimeBlockNode(blockNode)
    const done = checkable && blockNode!.status === 'done'
    const hasNotes = !!blockNode && hasNoteContent(blockNode.id)
    // Solapes → columnas lado a lado (ver `layoutBlocks`). Sin solape, ocupa
    // el ancho completo de la columna como siempre.
    const cols = b.cols ?? 1
    const col  = b.col ?? 0
    const gap  = 2
    const slotW = cols > 1 ? `calc((100% - ${gap}px) / ${cols})` : undefined
    const leftPos  = cols > 1 ? `calc(${slotW} * ${col} + ${gap / 2}px)` : 2
    const widthPos = cols > 1 ? `calc(${slotW} - ${gap}px)` : undefined
    return (
      <div key={b.id} data-pp-block={b.id}
        className={`pp-block pp-block--${b.kind}${done ? ' pp-block--done' : ''}${b.virtual ? ' pp-block--virtual' : ''}`}
        style={{ top: blockTop, height: blockH,
          background: bg, left: leftPos, ...(widthPos ? { width: widthPos } : { right: 2 }),
          border: '1px solid var(--border)', borderLeft: `3px solid ${accentColor}` }}
        draggable={!b.virtual}
        onDragStart={e => { if (!b.virtual) handleBlockDragStart(e, b) }}
        onClick={e => {
          e.stopPropagation()
          if (justResized.current || justDragged.current) return
          // Un bloque con `nodeId` es una TAREA de Fromly (con o sin hora — un
          // evento no es más que una tarea con día y hora, ver FROM.md "Tarea y
          // evento son lo mismo") — abre SIEMPRE su propio modal de tarea, con
          // recurrencia y el resto de opciones, nunca el editor de Google
          // Calendar (revertido 31 ago 2026, Alberto, con captura real: "esto es
          // una tarea pero al hacer clic se abre el modal diciendo editar evento
          // en Google Calendar... debería ser el modal normal de una tarea").
          // La sincronización con Google sigue pasando igual en segundo plano
          // (`syncNodeToGcal`/`pushEventToGcal`) — solo cambia qué modal se ve.
          // Únicamente el evento CRUDO de Google (sin nodo propio en Fromly,
          // `b.kind==='gcal'` sin `nodeId`) sigue abriendo `GCalEventEditor`: no
          // hay ninguna tarea que mostrar en su lugar.
          if (b.nodeId) {
            // `navigate('/node/:id')` es una ruta que solo existe en el router de
            // v1 — el Planificador se reutiliza dentro del overlay del shell v2
            // (V2Chat.tsx), así que navegar por URL rompía el overlay en vez de
            // abrir nada (Alberto, 21 jul: "no se abre el modal"). Mismo patrón
            // que ya usa ElementsPanel para abrir nodos sin salir de v2.
            window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: b.nodeId } }))
            return
          }
          if (b.kind === 'gcal' && b.gcalEvent) { setEditingGcal(b.gcalEvent); return }
        }}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          // Mismo menú que la columna del día para bloques con nodo (tarea/materializado);
          // el evento crudo de GCal (sin nodo) mantiene su menú propio.
          if (b.nodeId) window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: b.nodeId, x: e.clientX, y: e.clientY } }))
          else setCtxMenu({x:e.clientX,y:e.clientY,b})
        }}
        title={`${b.text}\n${fmtHH(b.start)} – ${fmtHH(b.end)}`}
      >
        {/* Bloques muy cortos (reuniones de 15-30min entre otras) no tienen alto para
            mostrar hora + título sin cortarse — se prioriza el título (Alberto, 21 jul). */}
        {blockH >= MIN_BLOCK_H_FOR_TIME && <div className="pp-block-time">{fmtHH(b.start)}</div>}
        {/* Checkbox EN LÍNEA delante del título (27 ago 2026, Alberto: "delante del
            texto de la tarea"), no flotando encima de la hora — de ahí que viva en
            su propia fila, debajo de `.pp-block-time`. */}
        <div className="pp-block-titlerow">
          {checkable && (
            <button className={`pp-block-check pp-block-check--${taskCheckState(blockNode!)}`}
              onClick={e => { e.stopPropagation(); toggleTaskDone(blockNode!) }}
              title={t('daily.markDone')} aria-label={t('daily.markDone')}>{done ? <Icon name="check" size={11} strokeWidth={2.6} /> : null}</button>
          )}
          <div className="pp-block-text">{b.text || t('common.noTitle')}</div>
          {hasNotes && <Icon name="note" size={10} className="pp-block-notes-icon" />}
        </div>
        {/* «+» — abre solo la ventana de fecha/recurrencia, sin navegar a la
            nota. Solo para bloques con nodo real (tarea/timeblock/evento ya
            materializado); un evento crudo de Google no tiene fecha propia
            que editar aquí, ya la abre el clic normal (`setEditingGcal`). */}
        {b.nodeId && (
          <button className="pp-block-props" title={t('dailyCockpit.editDateRecurrence')}
            onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === b.nodeId ? null : b.nodeId!) }}>
            <Icon name="plus" size={11} />
          </button>
        )}
        {!b.virtual && <div className="pp-block-resize" onMouseDown={e=>handleBlockResize(e,b)} />}
      </div>
    )
  }

  // ── Render columna ────────────────────────────────────────────────────────
  function renderCol(day: Date) {
    const isToday  = sameDay(day, today)
    const nowTop   = topPx(now)
    return (
      <div key={day.toISOString()} className="pp-col-wrap" style={{ width: colW, flexShrink: 0 }}>
        <div className={`pp-col${isToday ? ' pp-col--today' : ''}`} style={{ height: TOTAL_HOURS * hourH }}
          onDragOver={e=>{ e.preventDefault(); e.currentTarget.classList.add('pp-col--drag-over')
            const rawY = e.clientY - e.currentTarget.getBoundingClientRect().top
            // Restar el offset del cursor dentro del bloque para que la línea marque el inicio real
            const topY = rawY - dragOffsetY.current
            setSnapLine({ dayKey: day.toISOString(), top: snapPx(Math.max(0, topY)) })
          }}
          onDragLeave={e=>{ e.currentTarget.classList.remove('pp-col--drag-over'); setSnapLine(null) }}
          onDrop={e=>{ e.currentTarget.classList.remove('pp-col--drag-over'); setSnapLine(null); handleDrop(e, day, e.currentTarget) }}
          onClick={e=>handleSlotClick(e, day, e.currentTarget)}
          onContextMenu={e=>handleSlotContextMenu(e, day, e.currentTarget)}
        >
          {Array.from({length: TOTAL_HOURS*4}, (_,i) => (
            <div key={i} className={`pp-slot ${i%4===0?'pp-slot--hr':i%2===0?'pp-slot--half':'pp-slot--qtr'}`} style={{top: i*(slotH/2)}} />
          ))}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS*hourH && <div className="pp-now" style={{top:nowTop}} />}
          {snapLine?.dayKey === day.toISOString() && (
            <div className="pp-snap-line" style={{ top: snapLine.top }} />
          )}
          {layoutBlocks(getTimedBlocks(day, gcalEvents)).map(renderBlock)}

          {newBlock && sameDay(newBlock.day, day) && (
            <div className={`pp-new-block${newBlock.isTimeBlock ? ' pp-new-block--timeblock' : ''}`} style={{ top: newBlock.top, left: 2, right: 2 }}>
              <div className="pp-block-time">{fmtHH(newBlock.start)}</div>
              <input
                ref={newBlockRef}
                className="pp-new-block-input"
                value={newBlock.text}
                placeholder={newBlock.isTimeBlock ? t('planner.timeBlockPlaceholder', 'Bloque de tiempo…') : t('ph.nameEllipsis')}
                onChange={e => setNewBlock(b => b ? {...b, text: e.target.value} : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewBlock() }
                  if (e.key === 'Escape') setNewBlock(null)
                }}
                onBlur={commitNewBlock}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Vista año ─────────────────────────────────────────────────────────────
  function renderYear() {
    const year = centerDate.getFullYear()
    return (
      <div className="pp-year-grid">
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const firstOfMonth = new Date(year, monthIdx, 1)
          const totalDays    = daysInMonth(firstOfMonth)
          const firstDow     = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
          const cells: (number | null)[] = []
          for (let i = 0; i < firstDow; i++) cells.push(null)
          for (let d = 1; d <= totalDays; d++) cells.push(d)
          return (
            <div key={monthIdx} className="pp-year-month">
              <div className="pp-year-month-name">{monthLabel(firstOfMonth, i18n.language)}</div>
              <div className="pp-year-dow-row">
                {['L','M','X','J','V','S','D'].map(d => <div key={d} className="pp-year-dow">{d}</div>)}
              </div>
              <div className="pp-year-days">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="pp-year-day pp-year-day--empty" />
                  const date  = new Date(year, monthIdx, d)
                  const isTod = sameDay(date, today)
                  const hasGcal = gcalEvents.some(ev => !ev.allDay && sameDay(new Date(ev.start), date))
                  const hasTasks = [...store.allActive()].some(n => n.due && !isInPapelera(n.id) && sameDay(new Date(n.due), date) && n.status !== null)
                  return (
                    <div key={d}
                      className={`pp-year-day ${isTod?'pp-year-day--today':''}`}
                      onClick={() => { const dayNode = ensureDayPath(date); window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: dayNode.id } })); setCenterDate(date); setViewMode('day') }}
                      title={date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })}
                    >
                      {d}
                      {(hasGcal || hasTasks) && <div className="pp-year-day-dot" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Vista MES (rejilla mensual) ────────────────────────────────────────────
  function monthDayItems(date: Date): { id: string; text: string; color: string; done: boolean }[] {
    const out: { id: string; text: string; color: string; done: boolean; t: number }[] = []
    for (const n of store.allActive()) {
      if (!n.due || n.deletedAt || isInPapelera(n.id) || n.status == null) continue
      if (!sameDay(new Date(n.due), date)) continue
      const overdue = new Date(n.due) < startOfDay(today) && n.status !== 'done'
      out.push({ id: n.id, text: n.text || t('common.noTitle'), color: overdue ? '#e03131' : 'var(--accent,#6c5ce7)', done: n.status === 'done', t: new Date(n.due).getTime() })
    }
    // Mismo dedup que getTimedBlocks/getAllDayTasks más arriba: sin esto, un
    // evento creado en Fromly y sincronizado con Google salía DOS veces en la
    // celda del mes (nodo local + evento crudo del pull de Google).
    const fromGcalIds = linkedGcalIdCores()
    for (const ev of gcalEvents) {
      if (ev.allDay || !sameDay(new Date(ev.start), date)) continue
      if (fromGcalIds.has(gcalIdCore(ev.id))) continue // ya hay un nodo local enlazado a este evento
      out.push({ id: ev.id, text: ev.title || t('search.chipEvent'), color: '#16a34a', done: false, t: new Date(ev.start).getTime() })
    }
    return out.sort((a, b) => a.t - b.t)
  }

  function handleMonthDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('nodeId') || e.dataTransfer.getData('plannerTaskId') || e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    const n = store.getNode(nodeId); if (!n) return
    const had = !!n.due
    // `guardRecurrence` — mismo criterio que soltar en el timeline
    // (`handleDrop`), sin esto arrastrar una tarea/evento RECURRENTE a una
    // celda del mes reescribía en silencio la fecha del nodo origen, sin
    // preguntar "¿solo esta o todas las siguientes?" como en el resto del
    // Planificador (3 sep 2026).
    guardRecurrence(nodeId, t('planner.moveVerb', 'mover'), scope => {
      if (scope === 'this') detachFromRecurrence(n)
      store.updateNode(nodeId, { due: toMidnight(date), dueEnd: null, status: n.status ?? 'pending' })
      if (had) bumpReschedule(nodeId)
    })
  }

  // ── Franja «todo el día»: tareas con fecha ese día pero SIN hora ────────────
  type AllDayItem = { kind: 'node'; node: Node } | { kind: 'gcal'; ev: CalendarEvent }
  function getAllDayTasks(day: Date): AllDayItem[] {
    // Eventos de todo el día Y tareas sin hora, unificados aquí — mismo
    // criterio que el bloque «Todo el día» de DayColumn (Alberto, 22 jul:
    // "agrupar ambas cosas... y que aparezcan siempre en el planner en el
    // espacio de todo el día"). Antes `!n.isEvent` excluía siempre los
    // eventos de esta fila, así que arrastrar uno aquí lo hacía desaparecer
    // del Planificador en vez de convertirlo — Alberto, 21 jul: "arrastrar
    // eventos a todo el día debería convertirlos".
    const nodes = store.allActive().filter(n =>
      n.due && !n.deletedAt && !isInPapelera(n.id) && (n.isEvent || !!n.gcalEventId || n.status != null) &&
      sameDay(new Date(n.due), day) && !hasTime(n.due))

    // Eventos de todo el día que solo viven en Google (sin nodo local aún) —
    // antes esta franja solo escaneaba `store.allActive()`, así que un
    // festivo o evento creado directamente en Google Calendar no aparecía
    // (Alberto, 22 jul: "asegúrate que en todo el día aparecerán... también
    // los eventos, que no tengan hora"). Mismo criterio de dedup que
    // getTimedBlocks: si ya hay un nodo local enlazado a ese id, se omite.
    const fromGcalIds = linkedGcalIdCores()
    const gcalAllDay = gcalEvents.filter(ev =>
      ev.allDay && !fromGcalIds.has(gcalIdCore(ev.id)) && sameDay(new Date(ev.start), day))

    const items: AllDayItem[] = [
      ...nodes.map(node => ({ kind: 'node' as const, node })),
      ...gcalAllDay.map(ev => ({ kind: 'gcal' as const, ev })),
    ]
    // Dedup por título: un nodo local siempre gana sobre su crudo de Google.
    // SOLO entre nodo y gcal — antes la clave (solo el título) también
    // colapsaba dos tareas LOCALES sin hora que coincidían en título ese
    // mismo día (dos "Revisar contrato", por ejemplo): la segunda
    // desaparecía sin más de la franja «todo el día» (3 sep 2026).
    const nodeItems = items.filter((it): it is AllDayItem & { kind: 'node' } => it.kind === 'node')
    const nodeKeys = new Set(nodeItems.map(it => it.node.text.trim().toLowerCase()))
    const gcalItems = items.filter((it): it is AllDayItem & { kind: 'gcal' } =>
      it.kind === 'gcal' && !nodeKeys.has((it.ev.title || '').trim().toLowerCase()))
    return [...nodeItems, ...gcalItems]
  }
  function handleAllDayDrop(e: React.DragEvent, day: Date) {
    e.preventDefault(); e.stopPropagation()
    // `plannerBlockId`: arrastre desde un bloque con hora del propio timeline
    // (`handleBlockDragStart`, línea ~577) — sin leer esta clave, arrastrar un
    // evento/tarea DESDE su hueco horario hasta esta fila no encontraba nodeId
    // y el drop no hacía nada.
    const nodeId = e.dataTransfer.getData('nodeId') || e.dataTransfer.getData('plannerTaskId')
      || e.dataTransfer.getData('plannerBlockId') || e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    const n = store.getNode(nodeId); if (!n) return
    const had = !!n.due
    // `guardRecurrence` — mismo criterio que el resto de drops del
    // Planificador (ver `handleMonthDrop`): sin esto, soltar una tarea/evento
    // RECURRENTE en la franja «todo el día» quitaba la hora del nodo origen
    // sin preguntar "¿solo esta o todas las siguientes?" (3 sep 2026).
    guardRecurrence(nodeId, t('planner.moveVerb', 'mover'), scope => {
      if (scope === 'this') detachFromRecurrence(n)
      // Evento o tarea, da igual: los dos llevan `status` desde el 5 ago 2026 (un
      // evento es una tarea con día y hora — utils/taskNode.ts). Soltar en «todo el
      // día» quita la hora, no el hecho de ser tarea.
      store.updateNode(nodeId, { due: toMidnight(day), dueEnd: null, status: n.status ?? 'pending' })
      if (had) bumpReschedule(nodeId)
    })
  }

  function renderMonth() {
    const y = centerDate.getFullYear(), mo = centerDate.getMonth()
    const first = new Date(y, mo, 1)
    const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1 // lunes = 0
    const total = daysInMonth(first)
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(new Date(y, mo, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return (
      <div className="pp-month">
        <div className="pp-month-dow">
          {[t('tip.dowMon'),t('tip.dowTue'),t('tip.dowWed'),t('tip.dowThu'),t('tip.dowFri'),t('tip.dowSat'),t('tip.dowSun')].map(d => <div key={d} className="pp-month-dow-cell">{d}</div>)}
        </div>
        <div className="pp-month-grid">
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} className="pp-month-cell pp-month-cell--empty" />
            const isTod = sameDay(date, today)
            const items = monthDayItems(date)
            return (
              <div key={date.toISOString()} className={`pp-month-cell ${isTod ? 'pp-month-cell--today' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleMonthDrop(e, date)}
                // Hueco en blanco de la celda (fuera del número y de los chips) → cambia
                // la nota diaria de la columna derecha a ESE día (mismo criterio que la
                // cabecera de vista semana) y además ofrece elegir tarea o evento para
                // ese día. El número del día tiene su propio onClick para abrir el día
                // (más abajo).
                onClick={e => { if (e.target === e.currentTarget) { setCenterDate(date); setMonthAddMenu({ day: date, x: e.clientX, y: e.clientY }) } }}
                title={date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}>
                <div className={`pp-month-daynum ${isTod ? 'pp-month-daynum--today' : ''}`}
                  onClick={e => { e.stopPropagation(); const dn = ensureDayPath(date); window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: dn.id } })) }}>
                  {date.getDate()}
                </div>
                <div className="pp-month-items" onClick={e => { if (e.target === e.currentTarget) { setCenterDate(date); setMonthAddMenu({ day: date, x: e.clientX, y: e.clientY }) } }}>
                  {items.map(it => (
                    <div key={it.id} className="pp-month-chip" style={{ borderLeft: `2px solid ${it.color}`, opacity: it.done ? 0.45 : 1, textDecoration: it.done ? 'line-through' : 'none' }}
                      onClick={e => {
                        e.stopPropagation() // no navegar al día: ir a la tarea
                        const node = store.getNode(it.id)
                        if (node) { window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: it.id } })); return }
                        const ev = gcalEvents.find(x => x.id === it.id)
                        if (ev) setEditingGcal(ev)
                      }}
                      onContextMenu={e => {
                        if (!store.getNode(it.id)) return // evento GCal crudo: sin menú de fila
                        e.preventDefault(); e.stopPropagation()
                        window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: it.id, x: e.clientX, y: e.clientY } }))
                      }}
                      title={it.text}>
                      {it.text}
                      {/* «+» en hover — abre edición (fecha/recurrencia/contexto) sin
                          navegar a la nota, mismo patrón que `.pp-block-props` en las
                          vistas semana/día. Solo para nodos reales (no eventos GCal
                          crudos, que no tienen props que editar aquí). */}
                      {store.getNode(it.id) && (
                        <button className="pp-month-chip-props" title={t('dailyCockpit.editDateRecurrence')}
                          onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === it.id ? null : it.id) }}>
                          <Icon name="plus" size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {monthAddMenu && (
          <>
            <div style={{position:'fixed',inset:0,zIndex:998}} onClick={()=>setMonthAddMenu(null)} />
            <div className="pp-ctx" style={{left:monthAddMenu.x,top:monthAddMenu.y}}>
              <button onClick={()=>{
                // Tarea nueva desde el mes → misma edición completa (recurrencia +
                // contexto) que el resto de la app, no el modal simple: se crea el
                // nodo ya con la fecha del día clicado y se abre TaskPropsPopover
                // (allowRename edita el título ahí mismo).
                const diaryNode = store.todayDiary()
                const node = store.createNode({
                  text: '',
                  parentId: diaryNode?.id || null,
                  isTask: true,
                  due: toMidnight(monthAddMenu.day),
                })
                setPropsNodeId(node.id)
                setMonthAddMenu(null)
              }}>
                {t('modal.newTask')}
              </button>
              <button onClick={()=>{ setMonthNewEventDay(monthAddMenu.day); setMonthAddMenu(null) }}>
                {t('modal.newEvent')}
              </button>
            </div>
          </>
        )}
        {monthNewEventDay && (
          <NewEventModal
            defaultDateStr={localDateStr(monthNewEventDay)}
            onClose={() => setMonthNewEventDay(null)}
          />
        )}
      </div>
    )
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navTitle = viewMode === 'year'
    ? `${centerDate.getFullYear()}`
    : viewMode === 'month'
      ? `${monthLabel(centerDate, i18n.language)} ${centerDate.getFullYear()}`
      : centerDate.toLocaleDateString(i18n.language, { weekday:'short', day:'numeric', month:'short' })

  function navDelta(d: number) {
    setCenterDate(prev =>
      viewMode === 'year'  ? new Date(prev.getFullYear() + d, prev.getMonth(), 1)
      : viewMode === 'month' ? new Date(prev.getFullYear(), prev.getMonth() + d, 1)
      : addDays(prev, d))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`pp-root${viewMode === 'day' ? ' pp-root--single' : ''}`} style={{ width: '100%' }}>

      {/* Header — la tab «Día» (dayOnlyHeader) replica la cabecera de Agenda: título
          grande del día + HOY/CAL, en vez de ‹/›+Hoy+resetZoom (que además duplicaba
          el título del día con `pp-col-head`, justo debajo — Alberto, 22 jul). CAL
          reutiliza la vista Año que el planificador ya trae (renderYear). */}
      <div className={`pp-header${dayOnlyHeader ? ' pp-header--day' : ''}`}>
        {dayOnlyHeader ? (
          viewMode === 'year' ? (
            <>
              <button className="v2-head-action" onClick={()=>setViewMode('day')}>‹ {t('v2.rightColumn.back', 'Volver')}</button>
              <button className="pp-nav-btn" onClick={()=>navDelta(-1)}>‹</button>
              <span className="pp-nav-title">{navTitle}</span>
              <button className="pp-nav-btn" onClick={()=>navDelta(1)}>›</button>
            </>
          ) : (
            // Misma estructura que la cabecera de Agenda (retirada el 5 ago 2026,
            // fusionada en este mismo destino): título + HOY/CAL en UNA sola fila,
            // botones al extremo derecho — antes CAL vivía
            // en su propia fila encima del título (Alberto, 22 jul, tres veces: primero
            // la estructura, luego "iguala los márgenes a los de la tab Agenda", luego
            // "pon el botón de cal en la misma línea que el título del día... así
            // ganamos un poco de espacio y puede subir el día un poquito más arriba").
            <div className="v2-agenda-day-header" style={{ width: '100%' }}>
              <h2 className="v2-agenda-day-title">{diaryDayTitle(centerDate)}</h2>
              <div className="v2-agenda-toolbar">
                {!sameDay(centerDate, today) && (
                  <button className="v2-head-action" onClick={()=>{ setCenterDate(today); setRecenterTick(x=>x+1); setViewMode('day') }}>{t('v2.agenda.today', 'HOY')}</button>
                )}
                <button className="v2-head-action" onClick={()=>setViewMode('year')} title={t('v2.agenda.openYear', 'Calendario anual')}>{t('v2.agenda.year', 'CAL')}</button>
              </div>
            </div>
          )
        ) : (
          <>
            {viewTabs.length > 1 && (
              <div className="pp-view-tabs">
                {viewTabs.map(m => (
                  <button key={m} className={`pp-tab ${viewMode===m?'pp-tab--active':''}`} onClick={()=>setViewMode(m)}>
                    {m==='day'?t('timeline.dayMode'):m==='week'?t('timeline.weekMode'):m==='month'?t('timeline.monthMode'):t('tip.year')}
                  </button>
                ))}
              </div>
            )}
            <button className="pp-nav-btn" onClick={()=>navDelta(-1)}>‹</button>
            <span className="pp-nav-title">{navTitle}</span>
            <button className="pp-nav-btn" onClick={()=>navDelta(1)}>›</button>
            <button className="pp-today-btn" onClick={()=>{ setCenterDate(today); setRecenterTick(x=>x+1) }}>{t('common.today')}</button>
            <button className="pp-today-btn pp-reset-btn" onClick={resetZoom}
              title={t('tip.resetZoom', { count: visibleDayCnt })}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {gcalError && (
        <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--warning)', background: 'rgba(239,68,68,0.06)', flexShrink: 0 }}>
          {gcalError} — <button onClick={() => navigate('/settings?tab=google')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11 }}>{t('tip.reconnect')}</button>
        </div>
      )}

      {/* Timeline */}
      <div className="pp-timeline" ref={el => {
        (scrollVRef as any).current = el
        ;(scrollHRef as any).current = el
        ;(timelineRef as any).current = el
        if (el && !(el as any)._wheelBound) {
          (el as any)._wheelBound = true
          el.addEventListener('wheel', (ev: WheelEvent) => {
            if (!ev.shiftKey || viewMode === 'year' || viewMode === 'month') return
            ev.preventDefault()
            setAutoFit(false)
            const dir = ev.deltaY > 0 ? 1 : -1
            setSlotH(prev => {
              const minSlot = Math.max(8, Math.floor(el.clientHeight / (TOTAL_HOURS * 2)))
              const frac    = el.scrollTop / (TOTAL_HOURS * prev * 2)
              const next    = Math.max(minSlot, Math.min(MAX_SLOT_H, prev - dir * 4))
              setTimeout(() => { el.scrollTop = frac * TOTAL_HOURS * next * 2 }, 0)
              return next
            })
          }, { passive: false })
        }
      }}>
        {viewMode === 'year' ? renderYear() : viewMode === 'month' ? renderMonth() : (
          <>
            {/* Cabeceras — ocultas en la tab «Día» (dayOnlyHeader): el título grande de
                arriba ya dice qué día es, esta fila solo duplicaba (Alberto, 22 jul). */}
            {!dayOnlyHeader && (
              <div className="pp-heads" ref={headRef} onMouseDown={handleHeadersDrag}
                title={t('tip.dragDaysHint')}>
                <div style={{width: AXIS_W, flexShrink:0, position:'sticky', left:0, background:'var(--bg-primary)', zIndex:10}} />
                {visibleDays.map(d => (
                  <div key={d.toISOString()} className={`pp-col-head ${sameDay(d,today)?'pp-col-head--today':''} ${sameDay(d,centerDate)?'pp-col-head--center':''}`}
                    style={{width:colW, flexShrink:0, cursor:'pointer'}}
                    title={t('tip.openDayNote', 'Abrir la nota de este día')}
                    onClick={() => setCenterDate(d)}>
                    {dayLabel(d, i18n.language)}
                  </div>
                ))}
              </div>
            )}

            {/* Franja «todo el día»: tareas con fecha pero sin hora, Y eventos de todo
                el día (locales o crudos de Google). Arrastrables. */}
            <div className="pp-allday">
              {/* Sin el texto «todo el día» en la tab Día (Alberto, 22 jul: "no
                  pongas nada... solo mantén los elementos") — la fila ya se
                  distingue visualmente de la rejilla horaria de debajo; en la
                  vista semana/mes (varias columnas) sí ayuda como leyenda. */}
              <div className="pp-allday-axis" style={{width:AXIS_W, flexShrink:0, position:'sticky', left:0, zIndex:10}}>{!dayOnlyHeader && t('tip.allDayLower')}</div>
              {visibleDays.map(d => {
                const items = getAllDayTasks(d)
                const editing = !!newAllDay && sameDay(newAllDay.day, d)
                return (
                  <div key={d.toISOString()} className="pp-allday-col" style={{width:colW, flexShrink:0}}
                    onDragOver={e=>e.preventDefault()} onDrop={e=>handleAllDayDrop(e,d)}
                    title={t('tip.clickAddUntimed')}
                    onClick={e=>{ if ((e.target as HTMLElement).closest('.pp-allday-chip, input')) return; newAllDayCommittedRef.current = false; setAllDayPickedCtxId(null); setAllDayPickedCtxSpan(null); setNewAllDay({ day: d, text: '' }); setTimeout(()=>newAllDayRef.current?.focus(), 20) }}>
                    {/* SIEMPRE todos los items — antes se cortaba en 5 con un "+N" que
                        obligaba a adivinar qué faltaba (Alberto, 26 ago 2026: "deben
                        caber todas por mucha que sean, es importante que se vean todas"). */}
                    {items.map(it => {
                      if (it.kind === 'gcal') {
                        const ev = it.ev
                        return (
                          <div key={`gcal:${ev.id}`} className="pp-allday-chip"
                            style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderLeft: `3px solid ${ev.backgroundColor || '#4a90d9'}` }}
                            onClick={e=>{ e.stopPropagation(); setEditingGcal(ev) }}
                            title={ev.title}>
                            {ev.title || t('search.chipEvent')}
                          </div>
                        )
                      }
                      const n = it.node
                      const chipCtx = firstContextOf(n)
                      const chipAccent = chipCtx ? contextColor(chipCtx.id) : plannerBase
                      // Checkbox SOLO en tareas puras — los eventos de todo el día NO
                      // llevan checkbox, mismo criterio visual que `checkable` en
                      // renderBlock (Alberto, 26 ago 2026).
                      const chipCheckable = n.status != null && !n.isEvent
                      const chipDone = chipCheckable && n.status === 'done'
                      return (
                      <div key={n.id} className={`pp-allday-chip ${chipDone?'pp-allday-chip--done':''}`}
                        style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderLeft: `3px solid ${chipAccent}` }}
                        draggable
                        onDragStart={e=>{ e.dataTransfer.setData('nodeId', n.id); e.dataTransfer.effectAllowed='move' }}
                        onClick={e=>{ e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: n.id } })) }}
                        onContextMenu={e=>{ e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: n.id, x: e.clientX, y: e.clientY } })) }}
                        title={n.text}>
                        {chipCheckable && (
                          <button className={`pp-allday-check pp-allday-check--${taskCheckState(n)}`}
                            onClick={e=>{ e.stopPropagation(); toggleTaskDone(n) }}
                            title={t('daily.markDone')} aria-label={t('daily.markDone')}>{chipDone ? <Icon name="check" size={10} strokeWidth={2.6} /> : null}</button>
                        )}
                        {n.text || t('common.noTitle')}
                        {hasNoteContent(n.id) && <Icon name="note" size={9} className="pp-block-notes-icon" />}
                        {/* «+» en hover — mismo patrón que `.pp-block-props` en los
                            bloques con hora: abre solo fecha/recurrencia/contexto,
                            sin navegar a la nota (Alberto, 3 sep 2026). */}
                        <button className="pp-allday-props" title={t('dailyCockpit.editDateRecurrence')}
                          onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === n.id ? null : n.id) }}>
                          <Icon name="plus" size={10} />
                        </button>
                      </div>
                      )
                    })}
                    {editing ? (
                      <>
                        <input ref={newAllDayRef} className="pp-allday-new" value={newAllDay!.text}
                          placeholder={t('ph.newTaskEllipsis')}
                          onClick={e=>e.stopPropagation()}
                          onChange={e=>{
                            const v = e.target.value
                            setNewAllDay(s=>s?{...s,text:v}:s)
                            detectAllDayCtxMention(v, e.target.selectionStart ?? v.length)
                          }}
                          onKeyDown={e=>{
                            if (allDayCtxMention && allDayCtxMatches.length > 0) {
                              if (e.key === 'ArrowDown') { e.preventDefault(); setAllDayCtxSel(s => Math.min(s + 1, allDayCtxMatches.length - 1)); return }
                              if (e.key === 'ArrowUp') { e.preventDefault(); setAllDayCtxSel(s => Math.max(s - 1, 0)); return }
                              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickAllDayCtx(allDayCtxMatches[allDayCtxSel]); return }
                              if (e.key === 'Escape') { e.preventDefault(); setAllDayCtxMention(null); return }
                            }
                            // ESC cancela la tarea (Alberto, 31 ago 2026: "para cancelar un
                            // placeholder o una tarea que se está escribiendo, se debe usar
                            // la tecla ESC") — se marca "ya resuelto" antes de desmontar, para
                            // que un blur nativo tardío no la cree de todos modos.
                            if (e.key === 'Enter') { e.preventDefault(); commitNewAllDay() }
                            if (e.key === 'Escape') { e.preventDefault(); newAllDayCommittedRef.current = true; setNewAllDay(null); setAllDayCtxMention(null); setAllDayPickedCtxId(null); setAllDayPickedCtxSpan(null) }
                          }}
                          onBlur={()=>commitNewAllDay()} />
                        {allDayCtxMention && allDayCtxMatches.length > 0 && createPortal((
                          <div className="doc-mention-pop" onMouseDown={e=>e.preventDefault()}
                            style={{ position: 'fixed', ...allDayMentionPos(newAllDayRef.current) }}>
                            {allDayCtxMatches.map((item, i) => (
                              <button key={'create' in item ? '__create__' : item.node.id}
                                className={`doc-mention-item${i === allDayCtxSel ? ' active' : ''}`}
                                onMouseEnter={()=>setAllDayCtxSel(i)}
                                onMouseDown={e=>{ e.preventDefault(); pickAllDayCtx(item) }}>
                                <span className="doc-mention-icon"><Icon name={'create' in item ? 'plus' : 'folder'} size={13} /></span>
                                <span className="doc-mention-title">{'create' in item ? `Crear "${item.create}"` : item.path}</span>
                              </button>
                            ))}
                          </div>
                        ), document.body)}
                      </>
                    ) : (
                      <div className="pp-allday-add" aria-hidden>+</div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Grid de horas */}
            <div className="pp-grid">
              <div className="pp-axis" style={{width:AXIS_W, height: TOTAL_HOURS*hourH}}
                onMouseDown={handleAxisDrag} title={t('tip.dragZoom')}>
                {Array.from({length:TOTAL_HOURS+1},(_,i) => (
                  <div key={i} className="pp-axis-label" style={{top: i*hourH-8}}>
                    {String(HOUR_START+i).padStart(2,'0')}:00
                  </div>
                ))}
              </div>
              <div style={{display:'flex'}}>
                {visibleDays.map(d => renderCol(d))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:998}} onClick={()=>setCtxMenu(null)} />
          <div className="pp-ctx" style={{left:ctxMenu.x,top:ctxMenu.y}}>
            {ctxMenu.b.kind === 'gcal' && (
              <button onClick={()=>{
                // DOCUMENTO enlazado al evento (mismo materializado que el botón del
                // modal) — antes creaba un nodo suelto, sin due/gcalEventId, que no
                // se enlazaba con el evento (Alberto, 22 jul: "se enlaza con el
                // propio evento").
                const ev = ctxMenu.b.gcalEvent
                const d = ensureDayPath(ctxMenu.b.start)
                const newNode = store.createNode({ text: ctxMenu.b.text, parentId: d.id, predefinedId: ev ? (gcalEventNodeId(ev.id) ?? undefined) : undefined })
                if (ev) {
                  store.updateNode(newNode.id, {
                    isEvent: true, due: ev.start, dueEnd: ev.end, gcalEventId: ev.id,
                    extraData: JSON.stringify({ _doc: '1', _gcalEventId: ev.id, _gcalColor: ev.backgroundColor || '' }),
                  })
                } else {
                  store.updateNode(newNode.id, { extraData: JSON.stringify({ _doc: '1' }) })
                }
                window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: newNode.id } }))
                setCtxMenu(null)
              }}><Icon name="document" size={13} /> {t('tip.createDocument', 'Crear documento')}</button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{ window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: ctxMenu.b.nodeId! } })); setCtxMenu(null) }}>
                → {t('tip.goToNode')}
              </button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{
                const nodeId = ctxMenu.b.nodeId!
                const day = ctxMenu.b.start
                // `guardRecurrence` — mismo criterio que arrastrar/redimensionar:
                // sin esto, quitar la hora de un bloque RECURRENTE desde el menú
                // contextual reescribía en silencio el nodo origen de la serie,
                // sin preguntar "¿solo esta o todas las siguientes?" (3 sep 2026).
                guardRecurrence(nodeId, t('tip.removeTime'), scope => {
                  const n = store.getNode(nodeId)
                  if (scope === 'this' && n) detachFromRecurrence(n)
                  store.updateNode(nodeId, { due: toMidnight(day), dueEnd: null })
                  removeNodeFromGcal(nodeId)
                })
                setCtxMenu(null)
              }}>
                ⊘ {t('tip.removeTime')}
              </button>
            )}
            {/* Color picker */}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <div style={{padding:'6px 8px 2px', borderTop:'1px solid var(--border)', marginTop:4}}>
                <div style={{fontSize:10,color:'var(--text-secondary)',marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{t('tip.color')}</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {[
                    {c:'#3b82f6',n:t('tip.colorBlue')},{c:'#10b981',n:t('tip.colorGreen')},{c:'#f59e0b',n:t('tip.colorOrange')},
                    {c:'#ef4444',n:t('tip.colorRed')},{c:'#8b5cf6',n:t('tip.colorPurple')},{c:'#ec4899',n:t('tip.colorPink')},
                    {c:'#06b6d4',n:t('tip.colorCyan')},{c:'#64748b',n:t('tip.colorGrey')}
                  ].map(({c,n})=>(
                    <div key={c} title={n}
                      style={{width:20,height:20,borderRadius:'50%',background:c,cursor:'pointer',
                        border: ctxMenu.b.color===c ? '2px solid var(--text)' : '2px solid transparent', boxSizing:'border-box'}}
                      onClick={()=>{ if (ctxMenu.b.nodeId) store.updateNode(ctxMenu.b.nodeId, {color:c}); setCtxMenu(null) }}
                    />
                  ))}
                </div>
              </div>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button onClick={()=>{
                const nodeId = ctxMenu.b.nodeId!
                // Mismo motivo que «Quitar hora» arriba.
                guardRecurrence(nodeId, t('tip.removeFromPlanner'), scope => {
                  const n = store.getNode(nodeId)
                  if (scope === 'this' && n) detachFromRecurrence(n)
                  store.updateNode(nodeId, { due: null, dueEnd: null })
                  removeNodeFromGcal(nodeId)
                })
                setCtxMenu(null)
              }}>
                {t('tip.removeFromPlanner')}
              </button>
            )}
            {ctxMenu.b.kind !== 'gcal' && ctxMenu.b.nodeId && (
              <button className="pp-ctx-danger" style={{marginTop:4}} onClick={()=>{
                const nodeId = ctxMenu.b.nodeId!
                removeNodeFromGcal(nodeId)
                store.deleteNode(nodeId)
                setCtxMenu(null)
              }}>
                {t('tip.deleteEvent')}
              </button>
            )}
            {ctxMenu.b.kind === 'gcal' && (
              <button className="pp-ctx-danger" onClick={async ()=>{
                const evId = ctxMenu.b.id
                const evTitle = ctxMenu.b.text
                setCtxMenu(null)
                // A5 de la auditoría: mismo confirm que GCalEventEditor.remove()
                // — antes borraba sin preguntar mientras el editor sí lo hacía.
                if (!window.confirm(t('gcal.deleteConfirm', { title: evTitle }))) return
                // Solo se quita de la UI si Google CONFIRMÓ el borrado — antes el
                // error se tragaba y el evento desaparecía de Fromly pero seguía
                // vivo en el calendario (auditoría 28 ago 2026).
                try {
                  await deleteCalendarEvent(evId)
                  setGcalEvents(p => p.filter(x => x.id !== evId))
                } catch {
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('gcal.deleteFailed', 'No se pudo borrar el evento en Google Calendar'), type: 'error' } }))
                }
              }}>
                {t('tip.deleteEvent')}
              </button>
            )}
          </div>
        </>
      )}

      {editingGcal && (
        <GCalEventEditor event={editingGcal} modal onClose={()=>setEditingGcal(null)}
          linkedNodeId={store.allActive().find(n=>gcalIdCore(getGcalEventId(n))===gcalIdCore(editingGcal.id))?.id}
          onCreateNode={()=>{
            // Crear bajo demanda un DOCUMENTO local vinculado al evento (no se crea
            // por defecto). `_doc:'1'` — es un documento, no un nodo genérico.
            const ev = editingGcal
            const dayNode = ensureDayPath(new Date(ev.start))
            const node = store.createNode({ text: ev.title || t('search.chipEvent'), parentId: dayNode.id, predefinedId: gcalEventNodeId(ev.id) ?? undefined })
            store.updateNode(node.id, {
              isEvent: true, due: ev.start, dueEnd: ev.end,
              gcalEventId: ev.id, // columna: la usa el dedup del planner (n.gcalEventId)
              extraData: JSON.stringify({ _doc: '1', _gcalEventId: ev.id, _gcalColor: ev.backgroundColor || '' }),
            })
            window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: node.id } }))
            return node.id
          }}
          onUpdated={ev=>{setGcalEvents(p=>p.map(x=>x.id===ev.id?ev:x));setEditingGcal(null)}}
          onDeleted={id=>{setGcalEvents(p=>p.filter(x=>x.id!==id));setEditingGcal(null)}} />
      )}
      {propsNodeId && (() => {
        const pn = store.getNode(propsNodeId)
        return pn ? <TaskPropsPopover node={pn} allowRename allowDelete onClose={() => setPropsNodeId(null)} /> : null
      })()}
      {pendingRecAction && (
        <RecurrenceScopeConfirm
          verb={pendingRecAction.verb}
          onChoose={scope => { pendingRecAction.run(scope); setPendingRecAction(null) }}
          onCancel={() => setPendingRecAction(null)}
        />
      )}
    </div>
  )
}
