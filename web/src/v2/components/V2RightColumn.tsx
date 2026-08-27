// Columna derecha de Fromly 2.0 — 1 o 2 tabs, NUNCA 5 fijas (rediseño 5 ago 2026,
// Alberto: "Elementos/Agenda/Día son generales, no de un contexto — mezclarlas con
// Contexto/Chat en la misma fila confunde qué es cada cosa"). Agenda/Elementos
// (y el nuevo destino Chat general) pasaron a ser filas de la SIDEBAR (V2Sidebar,
// bloque sobre Contextos) — esta columna ya no decide "qué estoy viendo", solo
// pinta lo que V2App decidió vía `mode` (el destino activo) + `elementId` (si hay
// algo abierto en el centro).
//
// Tab 1 (SIEMPRE, `effectiveSubTab==='primary'`): el contenido del destino activo —
//   Contexto → Ficha (V2ContextView) · Chat (destino general) → composer de V2Chat
//   embebido · Elementos → su vista de siempre, sin cambios.
// Tab 2 "Chat" (SOLO si `elementId`, `effectiveSubTab==='chat'`): el chat del
//   elemento abierto en el centro — SIEMPRE la misma conversación (V2ElementChat →
//   aiChatStore.getOrCreateElementSession), nunca un «artifact» aparte. Aparece
//   automáticamente al abrir cualquier cosa desde CUALQUIER destino (así no hace
//   falta que Elementos tenga su propia tab Chat — la tiene cuando de verdad hay
//   algo concreto de qué hablar) y desaparece sola al cerrarlo.
//
// `effectiveSubTab` se calcula de forma DEFENSIVA (no solo confiando en que cada
// sitio que limpia `centerElementId` recuerde resetear `rightSubTab`): si
// `rightSubTab==='chat'` pero ya no hay `elementId`, cae a `'primary'` sola.
//
// ⚠️ REDISEÑO 24 ago 2026 — Día se fusiona en Agenda de forma definitiva (no
// duraba: ver el historial arriba de idas y venidas del 5 ago). El timeline de
// un día ya vive en el CENTRO de Agenda (PlannerPanel semana, ahora 3 columnas
// con la elegida siempre en el centro — V2App.tsx), así que un destino «Día»
// aparte con su propia rejilla horaria de una sola columna era la MISMA vista
// duplicada. La nota diaria (antes el centro exclusivo de «Día») pasa a vivir
// al pie de esta misma columna derecha, debajo de DailyCockpit:
//   · `mode='agenda'` → Tab 1 = atrasadas/sin fecha/futuro + nota diaria (al
//     pie) · centro = planner.
// La nota diaria nunca tiene Tab 2 "Chat" (`centerIsDiary`, ver V2ElementView.tsx)
// — aquí no aplica porque no vive en `elementId`/centro, sino embebida abajo.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import ElementsPanel, { type ElemKind } from '../../components/panels/ElementsPanel'
import ElementsFilters from './ElementsFilters'
import DailyCockpit from '../../components/views/DailyCockpit'
import V2ContextView from './V2ContextView'
import V2Chat from './V2Chat'
import V2ElementChat from './V2ElementChat'
import V2ElementView from './V2ElementView'
import V2ContextBrowser from './V2ContextBrowser'
import Icon from './Icon'
import { ensureDayPath } from '../../utils/agendaHelper'
import { containerNotesNode } from '../../utils/cajones'
import { markAgentResultSeen } from '../../store/aiChatStore'
import { displayTitle } from '../../utils/displayText'

export type RightMode = 'contexto' | 'chat' | 'elementos' | 'agenda'

/** Sub-tab activa de la columna derecha.
 *  · `primary`   — el contenido del destino activo (Tab 1).
 *  · `chat`      — la conversación del elemento abierto en el centro (Tab 2).
 *  · `historial` — SOLO en el destino Chat: contextos + últimas conversaciones,
 *    el patrón «historial» de cualquier IA (Alberto, 5 ago 2026: "la vista de
 *    chat tiene que tener además el historial con los últimos chats... una tab
 *    sería la de chat y otra la de historial"). */
export type RightSubTab = 'primary' | 'chat' | 'historial'

interface Props {
  /** Destino activo (elegido en la sidebar) — decide el contenido de la Tab 1. */
  mode: RightMode
  selectedCtxId: string | null
  importDragOver?: boolean
  onOpenNode: (id: string) => void
  onSelectCtx: (id: string) => void
  /** El elemento abierto en el CENTRO (`V2App.centerElementId`) — si lo hay, existe
   *  la Tab 2 "Chat" (su conversación). Si no, solo hay Tab 1. */
  elementId: string | null
  onResize: (w: number) => void
  /** Cuál de las 1-2 tabs visibles está activa — 'chat' solo tiene efecto si
   *  `elementId` existe (ver `effectiveSubTab` más abajo, calculado en este
   *  componente para no depender de que V2App lo resetee en cada sitio que
   *  limpia `centerElementId`). */
  rightSubTab: RightSubTab
  onSubTabChange: (t: RightSubTab) => void
  onOpenConversation: (id: string) => void
  /** Empezar una conversación nueva dentro de un contexto, desde el Historial. */
  onNewChatInCtx: (id: string | null) => void
  /** Filtro inicial pedido para la tab Elementos (p.ej. «← Agentes» → 'agent'). */
  elementsFilter?: ElemKind | 'all' | 'favorite' | null
  /** Cierra el detalle y abre la tab Elementos filtrada por ese tipo. */
  onOpenElementsFiltered?: (kind: ElemKind) => void
  /** Grabadora activa (useV2Recorder) — mientras graba/procesa, toma la columna
   *  derecha entera (prioridad sobre detalle/tabs): es un estado transitorio que el
   *  usuario necesita ver, no algo que competir por espacio con el resto. */
  recorder?: { recording: boolean; busy: boolean; elapsedSec: number; liveTranscript: string; stop: () => void }
  onFilesDropped: (files: File[]) => void
  /** Día centrado en el Planner del destino Agenda (`V2App.agendaCenterDate`,
   *  alimentado por `PlannerPanel.onCenterDateChange`) — decide qué nota diaria
   *  se embebe al pie de esta columna (antes fija a la de HOY; Alberto, 24 ago
   *  2026: "al hacer clic en otro día en el planificador, debería abrir la
   *  nota de ese otro día"). Opcional por si algún consumidor viejo no lo pasa
   *  — cae a hoy. */
  agendaDayNoteDate?: Date
}

function fmtTimer(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function V2RightColumn({ mode, selectedCtxId, importDragOver, onOpenNode, onSelectCtx, elementId, onResize, rightSubTab, onSubTabChange, onOpenConversation, onNewChatInCtx, elementsFilter, onOpenElementsFiltered, recorder, onFilesDropped, agendaDayNoteDate }: Props) {
  useStore()
  const { t } = useTranslation()

  // Defensivo (ver comentario del prop `rightSubTab` en la interfaz): si
  // `centerElementId` volvió a null desde CUALQUIER sitio sin que ese sitio se
  // acordara de resetear `rightSubTab`, esto lo corrige solo en vez de dejar la
  // Tab 2 "fantasma" (activa pero sin contenido que mostrar).
  //  · 'chat' sin nada centrado → no hay conversación que enseñar, SALVO en
  //    el destino Contexto, donde la Tab 2 "Chat" es el HISTORIAL de
  //    conversaciones del contexto (26 ago 2026, ver más abajo) — ahí sigue
  //    teniendo contenido aunque no haya ningún elemento abierto en el centro.
  //  · 'historial' fuera del destino Chat → esa tab ni siquiera existe ahí.
  const effectiveSubTab: RightSubTab =
    rightSubTab === 'chat' ? ((elementId || mode === 'contexto') ? 'chat' : 'primary')
    : rightSubTab === 'historial' ? (mode === 'chat' ? 'historial' : 'primary')
    : 'primary'

  // La nota diaria no tiene chat propio (ver V2ElementView.tsx) — si es lo que hay
  // centrado, el 3er tab "Chat" de Agenda no debe aparecer aunque `elementId`
  // exista (defensivo: en la práctica `rightSubTab` nunca llega a 'chat' para una
  // nota diaria, porque ya no tiene el icono que lo dispara).
  const centerIsDiary = !!elementId && !!store.getNode(elementId)?.isDiaryEntry

  // ¿El centro es la nota LIBRE del propio contexto (`getOrCreateContainerNotes`,
  // la que `V2App.onSelectCtx` abre SOLA al entrar en un contexto) y no algo que
  // el usuario haya abierto explícitamente (una tarea, un documento suyo)? En
  // ese caso el centro no cuenta como "hay un elemento abierto" para decidir
  // qué muestra la Tab 2 "Chat" — si contara, esa tab NUNCA podría enseñar el
  // historial del contexto (26 ago 2026, ver `showCtxHistorial` más abajo):
  // entrar en cualquier contexto real deja siempre esa nota centrada.
  const ctxDefaultNoteId = mode === 'contexto' && selectedCtxId ? containerNotesNode(selectedCtxId)?.id : null
  // Tab 2 "Chat" del destino Contexto → historial de conversaciones (26 ago
  // 2026) en vez del chat propio de un elemento, salvo que el usuario haya
  // abierto de verdad un elemento concreto (una tarea, un documento) — ahí sí
  // gana su chat propio (V2ElementChat), como siempre.
  const showCtxHistorial = mode === 'contexto' && (!elementId || centerIsDiary || elementId === ctxDefaultNoteId)

  // Nota diaria al pie del destino Agenda (fusión de «Día», 24 ago 2026) — del
  // día CENTRADO en el Planner (`agendaDayNoteDate`), no siempre hoy (Alberto,
  // 24 ago 2026: "al hacer clic en otro día en el planificador, debería abrir
  // la nota de ese otro día"). `ensureDayPath` es el mismo resolutor de «nota
  // diaria de fecha X» que usa el resto de la app (crea con id determinista si
  // no existe, la encuentra si ya existe) — sin él, cae a hoy.
  let dayNoteId: string | null = null
  try { dayNoteId = ensureDayPath(agendaDayNoteDate ?? new Date()).id } catch { /* store aún no listo */ }
  useEffect(() => {
    if (mode === 'agenda' && dayNoteId) markAgentResultSeen(dayNoteId)
  }, [mode, dayNoteId])

  const TAB1_LABEL: Record<RightMode, string> = {
    contexto: t('v2.rightColumn.tabContext', 'Contexto'),
    chat: t('v2.rightColumn.tabChat', 'Chat'),
    elementos: t('v2.rightColumn.tabElements', 'Elementos'),
    agenda: t('v2.rightColumn.tabAgenda', 'Agenda'),
  }

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
      {importDragOver && <div className="v2-import-banner"><Icon name="import" size={15} /> {t('v2.chat.importToFromly', 'Importar a Fromly')}</div>}
      {/* Destino Chat: SIN cabecera de tabs propia (27 ago 2026 — se retiró la
          tab «Historial»: navegar aquí ya arranca en vacío, ver `onSelectGeneral`
          en V2App.tsx, y el propio `V2Chat` enseña su historial + "Nueva
          conversación" en ese estado vacío, el mismo componente que los
          contextos — una única columna, sin doble tab que la parta). */}
      {mode === 'chat' ? null : (
        /* Sin cabecera de tabs cuando solo hay una — no aporta nada seleccionar
           entre 1 opción (Alberto, 5 ago 2026). Reaparece en cuanto hay algo
           abierto en el centro y la Tab 2 "Chat" es una alternativa real. La nota
           diaria no cuenta: no tiene chat propio (`centerIsDiary`), así que el
           destino Día se queda con una sola tab, sin cabecera. El destino
           Contexto es la EXCEPCIÓN: su Tab 2 "Chat" siempre tiene sentido (el
           historial de conversaciones del contexto, ver más abajo), así que
           sus 2 tabs se muestran siempre, aunque no haya nada centrado. */
        (mode === 'contexto' || (elementId && !centerIsDiary)) && (
          <div className="v2-right-tabs">
            <button
              className={`v2-right-tab ${effectiveSubTab === 'primary' ? 'active' : ''}`}
              onClick={() => onSubTabChange('primary')}
            >{TAB1_LABEL[mode]}</button>
            <button
              className={`v2-right-tab ${effectiveSubTab === 'chat' ? 'active' : ''}`}
              onClick={() => onSubTabChange('chat')}
            >{t('v2.rightColumn.tabChat', 'Chat')}</button>
          </div>
        )
      )}

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
              <button className="v2-recording-stop" onClick={recorder.stop}><Icon name="stop" size={14} /> {t('v2.chat.stopAndSave', 'Detener y guardar')}</button>
            )}
          </div>
        </div>
      )}

      {/* Tab 2 "Chat" — SIEMPRE la conversación real del elemento abierto en el
          centro (nunca un «artifact» aparte, ver V2ElementChat). Solo se monta
          mientras está activa: nunca en paralelo con la Tab 1 (V2ElementChat
          cambia la sesión GLOBAL activa en un efecto de layout — montarla oculta
          por CSS le robaría la sesión al chat general de la Tab 1 sin avisar).
          YA NO se activa sola con `mode === 'chat'` — antes, abrir CUALQUIER
          elemento (p.ej. un agente recién creado, autoOpen) mientras se estaba
          chateando sustituía la conversación general por el hilo propio (vacío)
          del elemento, sin ninguna pestaña visible para volver (el destino Chat
          no las muestra) — la conversación en curso "desaparecía" (27 ago
          2026, Alberto: "no debe perder el chat de la derecha, debe mantenerse
          el chat todo el tiempo"). El destino Chat general ahora SIEMPRE
          enseña el mismo hilo general, abra lo que abra el centro. */}
      {!isRecordingActive && effectiveSubTab === 'chat' && elementId && !centerIsDiary && !showCtxHistorial && (
        // key={elementId}: mismo motivo que el visor central en V2App.tsx —
        // sin desmontar entre nodos distintos, el chat de uno se solapa con
        // el del otro durante la ventana de un render.
        <V2ElementChat key={elementId} nodeId={elementId} onFilesDropped={onFilesDropped} />
      )}

      {/* Destino Contexto · Tab 2 "Chat": UN hilo propio y persistente de este
          contexto (26 ago 2026, Alberto: "nueva conversación abre el chat
          histórico de fromly, debería abrir un chat propio de ese contexto,
          uno vacío de cero... cada contexto debe poder abrir chats propios").
          Mismo motor que el chat de cualquier elemento (`assistantStore`,
          aislado por `threadKey` — ver V2Chat/V2ElementChat): al ser un
          nodeId nunca visto antes, `setThread` carga un hilo vacío, y el
          botón papelera del composer ("Nueva conversación", ya existente)
          lo reinicia sin tocar el hilo general ni el de ningún otro contexto.
          "Sin contexto" (`selectedCtxId===null`) usa una clave estable propia
          para no compartir hilo con el destino Chat general (que si usara
          `null` aquí, sería la MISMA clave 'general' — justo lo que no
          queremos). */}
      {!isRecordingActive && effectiveSubTab === 'chat' && showCtxHistorial && (
        <V2Chat
          key={selectedCtxId ?? '__ctx_sin_contexto__'}
          embedded
          currentNodeId={selectedCtxId ?? '__ctx_sin_contexto__'}
          contextLabel={selectedCtxId ? displayTitle(store.getNode(selectedCtxId)?.text || '') : t('v2.general', 'General')}
          onFilesDropped={onFilesDropped}
        />
      )}

      {/* Tab 1 — destino «Chat» general: el composer completo, embebido en la
          derecha (Alberto, 5 ago 2026: "debe haber algún chat en algún lugar
          fuera de contextos... que se abra en columna derecha"). Se mantiene
          SIEMPRE visible en este destino, abra lo que abra el centro — ya no
          exige `!elementId` (27 ago 2026, ver comentario de la Tab 2 arriba). */}
      {!isRecordingActive && effectiveSubTab === 'primary' && mode === 'chat' && (
        <V2Chat
          embedded
          elementScoped={false}
          currentNodeId={null}
          contextLabel={t('v2.general', 'General')}
          onFilesDropped={onFilesDropped}
          onOpenConversation={onOpenConversation}
          onNewChatInCtx={onNewChatInCtx}
          onSelectCtx={onSelectCtx}
        />
      )}

      {/* Destino Chat · tab «Historial»: contextos (tarjeta → sus conversaciones)
          + las últimas conversaciones de todos ellos. Mismo componente que las
          tarjetas del estado vacío del chat, en su variante de lista. */}
      {!isRecordingActive && effectiveSubTab === 'historial' && mode === 'chat' && (
        <div className="v2-right-body">
          <V2ContextBrowser
            variant="list"
            onOpenConversation={onOpenConversation}
            onNewChatInCtx={onNewChatInCtx}
            onSelectCtx={onSelectCtx}
          />
        </div>
      )}

      {/* Elementos: los RESULTADOS (virtualizados, tabla/lista) viven en el CENTRO —
          mucho más ancho (27 ago 2026). El buscador+filtros+orden viven AQUÍ, en la
          columna derecha (28 ago 2026, Alberto: "dijimos que harías la columna derecha
          para filtros y buscador. hazlo") — ambos leen/escriben el mismo
          `elementsBrowserStore`, así que filtrar aquí actualiza el centro al instante.
          Mientras hay algo abierto, esta tab además enseña sus propios resultados
          (ElementsPanel, compacto) para poder seguir explorando sin perder de vista
          el elemento centrado. */}
      {!isRecordingActive && effectiveSubTab === 'primary' && mode === 'elementos' && (
        <div className="v2-right-fill">
          <ElementsFilters />
          {elementId && <ElementsPanel initialFilter={elementsFilter ?? undefined} />}
        </div>
      )}

      {/* Destino Agenda: el centro ya muestra el calendario completo (V2App.tsx)
          — aquí, arriba, lo que NO cubre ese calendario (atrasadas, sin fecha,
          futuro — hoy/futuras ya están en el planner central, Alberto 5 ago
          2026) y, al PIE, la nota diaria del día CENTRADO en el planner (no
          siempre hoy — sigue a `agendaDayNoteDate`, fusión de la tab «Día»,
          retirada el 24 ago 2026 — su timeline quedó duplicado con el planner
          central en 3 columnas; la nota es lo único que «Día» aportaba de más).
          `key={dayNoteId}`: mismo motivo que el visor central — sin
          desmontar al cambiar de día no hay ventana de solape entre notas. */}
      {!isRecordingActive && effectiveSubTab === 'primary' && mode === 'agenda' && (
        <div className="v2-right-fill v2-agenda-col">
          <div className="v2-agenda-cockpit-scroll">
            <DailyCockpit bare disablePlanner hideToday hideFuture />
          </div>
          {dayNoteId && (
            <div className="v2-agenda-daynote">
              <V2ElementView key={dayNoteId} nodeId={dayNoteId} onClose={() => {}} onSelectCtx={onSelectCtx} compact />
            </div>
          )}
        </div>
      )}

      {!isRecordingActive && effectiveSubTab === 'primary' && mode === 'contexto' && (
      <div className="v2-right-body">
        {/* SIEMPRE la ficha del contexto — selectedCtxId===null es «General» (sin
            contexto asignado), no «nada que mostrar» — también tiene ficha, con sus
            propias tareas y elementos sin contexto (Alberto, 17 jul). */}
        <V2ContextView ctxId={selectedCtxId} onSelectCtx={onSelectCtx} onOpenNode={onOpenNode} />
      </div>
      )}
    </aside>
  )
}
