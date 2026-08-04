// Columna derecha contextual de Fromly 2.0 — 5 modos.
// Contexto:  qué sabe Fromly del contexto activo + sus miembros. SIEMPRE la
//            ficha del contexto — nunca cambia a otra cosa (antes competía con
//            el panel de conversación/detalle y se perdía sin forma de volver,
//            Alberto 15 jul: "debe haber una forma de volver a la columna de
//            contexto y no la hay"). Separado del contenido específico:
// Chat:      la conversación asociada a lo que hay abierto — id interno
//            'detalles' (histórico, no se renombra por bajo impacto/alto
//            riesgo de tocar todas sus referencias), pero la ETIQUETA que ve
//            el usuario es «Chat» desde el 30 jul (Alberto: "¿para qué se usa
//            la pestaña Detalles, además de para el chat, si no se usa para
//            nada más? Debería llamarse Chat"). Regla ÚNICA: si hay un
//            elemento en el CENTRO (`elementId`), esto es SIEMPRE su chat real
//            — la misma conversación cada vez (V2ElementChat →
//            aiChatStore.getOrCreateElementSession), nunca un «artifact»
//            aparte que compitiera por su propio hueco. Si no hay elemento
//            (chat general en el centro), es el panel de la conversación
//            activa (tareas/elementos/notas). Contexto y Chat son
//            independientes: cambiar de tab entre ellos NUNCA pierde lo que
//            había en el otro.
// Elementos: buscador global de todo lo guardado (notas, tareas, archivos,
//            conversaciones…) — Historial se retiró (10 jul 26): era el mismo
//            buscador con el filtro "conversación" implícito y sus elementos
//            anidados, y esos elementos ya se ven al abrir la conversación.
// Agenda:    columna del día real (DayColumn: eventos, atrasadas, para hoy) +
//            calendario anual (botón CAL) — antes «Hoy»/«Agenda» eran dos tabs
//            (Alberto, 21 jul: "eliminar el tab de Agenda actual, y
//            simplificar").
// Día:       timeline horario del Planificador — tab propia (antes botón
//            TIMELINE embebido en Agenda, Alberto 22 jul: "así se puede ver
//            rápidamente el día de un vistazo en modo timeline").
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import ElementsPanel, { type ElemKind } from '../../components/panels/ElementsPanel'
import V2ContextView from './V2ContextView'
import V2ConversationView from './V2ConversationView'
import V2ElementChat from './V2ElementChat'
import V2AgendaView from './V2AgendaView'
import PlannerPanel from '../../components/panels/PlannerPanel'
import type { Node } from '../../types'

export type RightMode = 'contexto' | 'detalles' | 'elementos' | 'hoy' | 'dia'

interface Props {
  mode: RightMode
  onMode: (m: RightMode) => void
  selectedCtxId: string | null
  importDragOver?: boolean
  onOpenNode: (id: string) => void
  onSelectCtx: (id: string) => void
  /** El elemento abierto en el CENTRO (`V2App.centerElementId`) — si lo hay, la
   *  tab Detalles es su chat. */
  elementId: string | null
  onResize: (w: number) => void
  activeSessionId: string | null
  onOpenConversation: (id: string) => void
  /** Filtro inicial pedido para la tab Elementos (p.ej. «← Agentes» → 'agent'). */
  elementsFilter?: ElemKind | 'all' | 'favorite' | null
  /** Cierra el detalle y abre la tab Elementos filtrada por ese tipo. */
  onOpenElementsFiltered?: (kind: ElemKind) => void
  /** Grabadora activa (useV2Recorder) — mientras graba/procesa, toma la columna
   *  derecha entera (prioridad sobre detalle/tabs): es un estado transitorio que el
   *  usuario necesita ver, no algo que competir por espacio con el resto. */
  recorder?: { recording: boolean; busy: boolean; elapsedSec: number; liveTranscript: string; stop: () => void }
  onFilesDropped: (files: File[]) => void
}

function fmtTimer(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Clasificación ligera de un nodo → icono + etiqueta de tipo.
function classify(n: Node): { icon: string; label: string } {
  const types = n.types || []
  if (n.isResource || n.resourceType) {
    const rt = (n.resourceType || '').toLowerCase()
    if (rt.includes('pdf')) return { icon: '📄', label: 'PDF' }
    if (rt.includes('image') || rt.includes('img')) return { icon: '🖼️', label: 'Imagen' }
    return { icon: '📎', label: 'Archivo' }
  }
  if (types.includes('evento') || n.isEvent) return { icon: '📅', label: 'Evento' }
  if (types.includes('tarea') || n.status === 'pending' || n.status === 'done') return { icon: '☑️', label: 'Tarea' }
  if (n.isDiaryEntry) return { icon: '🗓️', label: 'Diario' }
  return { icon: '📝', label: 'Nota' }
}

export default function V2RightColumn({ mode, onMode, selectedCtxId, importDragOver, onOpenNode, onSelectCtx, elementId, onResize, activeSessionId, onOpenConversation, elementsFilter, onOpenElementsFiltered, recorder, onFilesDropped }: Props) {
  useStore()
  const { t, i18n } = useTranslation()
  const [today, setToday] = useState<Node | null>(() => store.todayDiary())
  // Bumped en cada clic en la tab «Agenda» para forzar el remount de V2AgendaView y
  // que vuelva siempre al planner de hoy — un clic en la tab ya activa (mode no
  // cambia de valor) no re-renderiza por sí solo y dejaba «pegado» el día/sub-vista
  // que el usuario hubiera abierto antes (Alberto, 4 ago).
  const [agendaResetKey, setAgendaResetKey] = useState(0)
  // Mismo mecanismo para la tab «Día» — se olvidó al arreglar Agenda (auditoría, 4
  // ago): sin esto, navegar a otro día/año dentro del timeline y volver a pulsar
  // Día dejaba el timeline de la derecha desincronizado del centro (que sí vuelve
  // a la nota de hoy vía `handleRightMode` en V2App.tsx).
  const [diaResetKey, setDiaResetKey] = useState(0)

  // La nota de hoy se garantiza SOLO al abrir «Hoy» (no al arrancar el shell).
  useEffect(() => {
    if (mode === 'hoy' && !today) {
      try { setToday(getTodayDiaryUnderAgenda()) } catch { /* noop */ }
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // «Hoy» y «Agenda» eran dos tabs separadas (columna del día real + calendario
  // anual); se fusionan en una — la tab ahora se llama «Agenda» y el calendario
  // anual vive DENTRO de ella, vía un botón (ver V2AgendaView) — Alberto, 21 jul.
  const tabs: { id: RightMode; label: string }[] = [
    { id: 'contexto', label: t('v2.rightColumn.tabContext', 'Contexto') },
    { id: 'detalles', label: t('v2.rightColumn.tabChat', 'Chat') },
    { id: 'elementos', label: t('v2.rightColumn.tabElements', 'Elementos') },
    { id: 'hoy', label: t('v2.rightColumn.tabAgenda', 'Agenda') },
    { id: 'dia', label: t('v2.rightColumn.tabDay', 'Día') },
  ]

  // Arrastrar el borde izquierdo para ensanchar/estrechar la columna derecha.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(900, Math.max(320, window.innerWidth - ev.clientX))
      onResize(w)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const isRecordingActive = !!recorder && (recorder.recording || recorder.busy)

  return (
    <aside className="v2-col v2-right">
      <div className="v2-resize-handle" onPointerDown={startResize} title={t('v2.rightColumn.dragToWiden', 'Arrastra para ensanchar')} />
      {importDragOver && <div className="v2-import-banner">📥 {t('v2.chat.importToFromly', 'Importar a Fromly')}</div>}
      <div className="v2-right-tabs">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`v2-right-tab ${mode === tb.id ? 'active' : ''}`}
            onClick={() => { if (tb.id === 'hoy') setAgendaResetKey(k => k + 1); if (tb.id === 'dia') setDiaResetKey(k => k + 1); onMode(tb.id) }}
          >{tb.label}</button>
        ))}
      </div>

      {/* Grabadora activa — prioridad sobre todo lo demás mientras graba/procesa (Alberto:
          "al darle a grabar se debería mostrar la columna derecha de grabación"). Timer +
          icono pulsante siempre; transcripción en vivo si el navegador la soporta (mejor
          esfuerzo, Web Speech API); estado «Procesando…» mientras sube+transcribe con
          Whisper. Al terminar, `onAudioSaved` (V2App) abre la nota de voz resultante aquí
          mismo — esta vista desaparece sola (recording y busy vuelven a false). */}
      {isRecordingActive && recorder && (
        <div className="v2-right-fill">
          <div className="v2-recording-view">
            <div className={`v2-recording-dot ${recorder.busy ? 'processing' : ''}`} />
            <div className="v2-recording-status">
              {recorder.busy ? t('v2.chat.processingAudio', 'Procesando…') : t('v2.chat.recordAudio', 'Grabando')}
            </div>
            {recorder.recording && <div className="v2-recording-timer">{fmtTimer(recorder.elapsedSec)}</div>}
            {recorder.recording && (
              <div className="v2-recording-transcript">
                {recorder.liveTranscript || t('v2.chat.recordingListening', 'Escuchando…')}
              </div>
            )}
            {recorder.recording && (
              <button className="v2-recording-stop" onClick={recorder.stop}>⏹ {t('v2.chat.stopAndSave', 'Detener y guardar')}</button>
            )}
          </div>
        </div>
      )}

      {/* Detalles — SIEMPRE la conversación de lo que hay en el centro. Con
          elemento abierto (`elementId`): su chat real de siempre (nunca uno
          nuevo y aislado, ver V2ElementChat). Sin elemento (chat general en
          el centro): el panel de la conversación activa (tareas/elementos/
          notas) o vacío. */}
      {!isRecordingActive && mode === 'detalles' && elementId && (
        // key={elementId}: mismo motivo que el visor central en V2App.tsx —
        // sin desmontar entre nodos distintos, el chat de uno se solapa con
        // el del otro durante la ventana de un render.
        <V2ElementChat key={elementId} nodeId={elementId} onFilesDropped={onFilesDropped} />
      )}

      {!isRecordingActive && mode === 'detalles' && !elementId && (
        <div className="v2-right-body">
          {activeSessionId
            ? <V2ConversationView sessionId={activeSessionId} onOpenNode={onOpenNode} onSelectCtx={onSelectCtx} />
            : <div className="v2-right-empty">{t('v2.rightColumn.noDetailEmpty', 'Nada abierto todavía. Abre una nota, un archivo, o empieza una conversación.')}</div>}
        </div>
      )}

      {/* Elementos: el buscador universal REAL de la v1 (filtros por tipo, virtualizado). */}
      {!isRecordingActive && mode === 'elementos' && (
        <div className="v2-right-fill">
          <ElementsPanel initialFilter={elementsFilter ?? undefined} />
        </div>
      )}

      {/* Día: timeline horario del Planificador — tab propia (antes botón TIMELINE
          dentro de Agenda, Alberto 22 jul: "así se puede ver rápidamente el día
          de un vistazo en modo timeline"). Mismo patrón de fuga de padding que
          Elementos, para que la rejilla llene todo el alto disponible. */}
      {!isRecordingActive && mode === 'dia' && (
        <div className="v2-right-fill v2-agenda-timeline">
          <PlannerPanel key={diaResetKey} initialView="day" initialDays={1} viewTabs={['day']} dayOnlyHeader onClose={() => {}} />
        </div>
      )}

      {!isRecordingActive && mode !== 'elementos' && mode !== 'detalles' && mode !== 'dia' && (
      <div className="v2-right-body">
        {mode === 'contexto' && (
          // SIEMPRE la ficha del contexto — nunca el panel de conversación (eso vive
          // en la tab Detalles, independiente). selectedCtxId===null es «General»
          // (sin contexto asignado), no «nada que mostrar» — también tiene ficha,
          // con sus propias tareas y elementos sin contexto (Alberto, 17 jul).
          <V2ContextView ctxId={selectedCtxId} onSelectCtx={onSelectCtx} onOpenNode={onOpenNode} onOpenConversation={onOpenConversation} />
        )}

        {mode === 'hoy' && <V2AgendaView key={agendaResetKey} todayNode={today} />}
      </div>
      )}
    </aside>
  )
}
