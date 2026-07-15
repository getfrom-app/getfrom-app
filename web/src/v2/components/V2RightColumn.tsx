// Columna derecha contextual de Fromly 2.0 — 5 modos.
// Contexto:  qué sabe Fromly del contexto activo + sus miembros. SIEMPRE la
//            ficha del contexto — nunca cambia a otra cosa (antes competía con
//            el panel de conversación/detalle y se perdía sin forma de volver,
//            Alberto 15 jul: "debe haber una forma de volver a la columna de
//            contexto y no la hay"). Separado del contenido específico:
// Detalles:  lo que esté abierto en concreto — el panel de la conversación
//            activa (tareas/elementos/notas propias) o el detalle de una nota/
//            tarea/PDF/lienzo. Contexto y Detalles son independientes: cambiar
//            de tab entre ellos NUNCA pierde lo que había en el otro.
// Elementos: buscador global de todo lo guardado (notas, tareas, archivos,
//            conversaciones…) — Historial se retiró (10 jul 26): era el mismo
//            buscador con el filtro "conversación" implícito y sus elementos
//            anidados, y esos elementos ya se ven al abrir la conversación.
// Hoy:       columna de referencia del día REAL de la v1 (DayColumn):
//            eventos de Google Calendar, atrasadas, para hoy.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { useAIChat } from '../../store/aiChatStore'
import { parseExtraData } from '../../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import PublishButton from '../../components/PublishButton'
import DayColumn from '../../components/panels/DayColumn'
import ElementsPanel, { type ElemKind } from '../../components/panels/ElementsPanel'
import V2ContextView from './V2ContextView'
import V2ConversationView from './V2ConversationView'
import V2DetailView from './V2DetailView'
import V2AgendaView from './V2AgendaView'
import { elementDisplayTitle } from '../../utils/docNode'
import { fmtDate, fmtDateFull } from '../../utils/formatDate'
import type { Node } from '../../types'

export type RightMode = 'contexto' | 'detalles' | 'elementos' | 'hoy' | 'agenda'

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

// Título de la cabecera de detalle — clic para renombrar el nodo (fila 1).
function EditableDetailTitle({ nodeId }: { nodeId: string }) {
  useStore()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const node = store.getNode(nodeId)
  // Deriva el título: texto del nodo (sin ✦), o la 1ª línea del cuerpo si el texto está
  // vacío/solo-espacios (documentos con el título dentro del body) — SALVO un lienzo
  // recién creado, cuyo body es código de dibujo, no prosa (elementDisplayTitle lo
  // excluye) — o «Elemento».
  const title = elementDisplayTitle(node).replace(/^✦\s*/, '').trim().slice(0, 80) || t('v2.rightColumn.element', 'Elemento')
  if (editing) {
    return (
      <input
        autoFocus
        className="v2-detail-title-input"
        defaultValue={title}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) store.updateNode(nodeId, { text: v }); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== title) store.updateNode(nodeId, { text: v }); setEditing(false) }}
      />
    )
  }
  return (
    <span className="v2-center-title v2-detail-title" title={t('v2.rightColumn.clickToRename', 'Clic para renombrar')} onClick={() => setEditing(true)}
      style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }}>
      {title}
    </span>
  )
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

  const tabs: { id: RightMode; label: string }[] = [
    { id: 'contexto', label: t('v2.rightColumn.tabContext', 'Contexto') },
    { id: 'detalles', label: t('v2.rightColumn.tabDetails', 'Detalles') },
    { id: 'elementos', label: t('v2.rightColumn.tabElements', 'Elementos') },
    { id: 'hoy', label: t('v2.rightColumn.tabToday', 'Hoy') },
    { id: 'agenda', label: t('v2.rightColumn.tabAgenda', 'Agenda') },
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

      {/* Detalle de un elemento (documento/PDF/imagen/audio/nota) — SOLO en la tab
          Detalles (antes se mostraba sin importar la tab activa, tapando Contexto/
          Elementos/Hoy en cuanto había algo abierto). */}
      {!isRecordingActive && mode === 'detalles' && detailNodeId && (() => {
        const detailNode = store.getNode(detailNodeId)
        // Recursos (PDF/imagen/audio/enlace/podcast…) llevan publicar+eliminar AQUÍ, en la
        // cabecera, junto al título — antes cada visor de recurso repetía el título en su
        // propia fila solo para poder colgar estos 2 botones (redundante: el título ya
        // está arriba). Nota/tarea NO: ya tienen su propia barra con más acciones propias.
        const ed = detailNode ? parseExtraData(detailNode.extraData) : {}
        const isResourceLike = !!detailNode && (detailNode.isResource || !!detailNode.resourceType || Array.isArray(ed._audios))
        return (
          <div className="v2-right-fill">
            <div className="v2-detail-head">
              <div className="v2-detail-head-top">
                <button className="v2-iconbtn" onClick={onCloseDetail} title={t('v2.rightColumn.back', 'Volver')}>‹</button>
                <EditableDetailTitle nodeId={detailNodeId} />
                {isResourceLike && detailNode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <PublishButton node={detailNode} />
                    <button
                      title={t('tip.delete', 'Eliminar')}
                      onClick={() => { store.deleteNode(detailNode.id); onCloseDetail() }}
                      className="v2-iconbtn"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                )}
              </div>
              {detailNode && (
                <div className="v2-detail-dates" title={`${t('v2.rightColumn.created', 'Creado')}: ${fmtDateFull(detailNode.createdAt, i18n.language)}\n${t('v2.rightColumn.updated', 'Modificado')}: ${fmtDateFull(detailNode.updatedAt, i18n.language)}`}>
                  {t('v2.rightColumn.created', 'Creado')} {fmtDate(detailNode.createdAt, i18n.language)}
                  {detailNode.updatedAt && detailNode.updatedAt !== detailNode.createdAt && (
                    <> · {t('v2.rightColumn.updated', 'Modificado')} {fmtDate(detailNode.updatedAt, i18n.language)}</>
                  )}
                </div>
              )}
            </div>
            <div className="v2-detail-body"><V2DetailView nodeId={detailNodeId} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} /></div>
          </div>
        )
      })()}

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

      {!isRecordingActive && mode !== 'elementos' && mode !== 'detalles' && (
      <div className="v2-right-body">
        {mode === 'contexto' && (
          // SIEMPRE la ficha del contexto — nunca el panel de conversación (eso vive
          // en la tab Detalles, independiente).
          selectedCtxId
            ? <V2ContextView ctxId={selectedCtxId} onSelectCtx={onSelectCtx} onOpenNode={onOpenNode} onOpenConversation={onOpenConversation} />
            : <div className="v2-right-empty">{t('v2.rightColumn.chooseContextEmpty', 'Elige un contexto a la izquierda para ver su ficha.')}</div>
        )}

        {mode === 'hoy' && (
          today
            ? <DayColumn node={today} includeNodes={false} />
            : <div className="v2-right-empty">{t('v2.rightColumn.preparingToday', 'Preparando la columna de hoy…')}</div>
        )}

        {mode === 'agenda' && <V2AgendaView />}
      </div>
      )}
    </aside>
  )
}
