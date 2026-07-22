// Columna derecha contextual de Fromly 2.0 — 5 modos.
// Contexto:  qué sabe Fromly del contexto activo + sus miembros. SIEMPRE la
//            ficha del contexto — nunca cambia a otra cosa (antes competía con
//            el panel de conversación/detalle y se perdía sin forma de volver,
//            Alberto 15 jul: "debe haber una forma de volver a la columna de
//            contexto y no la hay"). Separado del contenido específico:
// Detalles:  el panel de la conversación activa, o el ARTIFACT que esa
//            conversación está creando/usando en este momento (Alberto, 22 jul:
//            "la excepción es cuando el chat trabaja con un elemento y ese
//            elemento está en la columna derecha" — el resto de elementos se
//            abren en el espacio CENTRAL, ver V2App.tsx `centerElementId`).
//            Contexto y Detalles son independientes: cambiar de tab entre
//            ellos NUNCA pierde lo que había en el otro.
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
import { useAIChat } from '../../store/aiChatStore'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import ElementsPanel, { type ElemKind } from '../../components/panels/ElementsPanel'
import V2ContextView from './V2ContextView'
import V2ConversationView from './V2ConversationView'
import V2ElementView from './V2ElementView'
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
  onStartAbout: (id: string) => void
  onSelectCtx: (id: string) => void
  detailNodeId: string | null
  onCloseDetail: () => void
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

export default function V2RightColumn({ mode, onMode, selectedCtxId, importDragOver, onOpenNode, onStartAbout, onSelectCtx, detailNodeId, onCloseDetail, onResize, activeSessionId, onOpenConversation, elementsFilter, onOpenElementsFiltered, recorder }: Props) {
  useStore()
  const { t, i18n } = useTranslation()
  const chat = useAIChat()
  const [today, setToday] = useState<Node | null>(() => store.todayDiary())

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
    { id: 'detalles', label: t('v2.rightColumn.tabDetails', 'Detalles') },
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
            onClick={() => {
              // Contexto ⟷ Detalles son independientes — cambiar entre ellos NUNCA
              // pierde lo que había en el otro (Alberto, 15 jul: "debe haber una
              // forma de volver a la columna de contexto"). Solo se cierra el
              // detalle al salir a Elementos/Hoy/Agenda.
              if (tb.id !== 'contexto' && tb.id !== 'detalles') onCloseDetail()
              onMode(tb.id)
            }}
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

      {/* Detalle de un elemento — SOLO en la tab Detalles, y SOLO para el artifact
          que la conversación activa está creando/usando en este momento (el
          resto de elementos se abren en el espacio central — Alberto, 22 jul:
          "la excepción es cuando el chat trabaja con un elemento y ese elemento
          está en la columna derecha... la columna derecha mantendría todo
          igual"). Componente compartido con el visor central (V2ElementView). */}
      {!isRecordingActive && mode === 'detalles' && detailNodeId && (
        <V2ElementView nodeId={detailNodeId} onClose={onCloseDetail} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} />
      )}

      {/* Tab Detalles sin nodo abierto: el panel de la conversación activa, o vacío. */}
      {!isRecordingActive && mode === 'detalles' && !detailNodeId && (
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
          <PlannerPanel initialView="day" initialDays={1} viewTabs={['day']} dayOnlyHeader onClose={() => {}} />
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

        {mode === 'hoy' && <V2AgendaView todayNode={today} />}
      </div>
      )}
    </aside>
  )
}
