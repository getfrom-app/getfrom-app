// Columna derecha de Fromly 2.0 — 1 o 2 tabs, NUNCA 5 fijas (rediseño 5 ago 2026,
// Alberto: "Elementos/Agenda/Día son generales, no de un contexto — mezclarlas con
// Contexto/Chat en la misma fila confunde qué es cada cosa"). Agenda/Elementos
// (y el nuevo destino Chat general) pasaron a ser filas de la SIDEBAR (V2Sidebar,
// bloque sobre Contextos) — esta columna ya no decide "qué estoy viendo", solo
// pinta lo que V2App decidió vía `mode` (el destino activo) + `elementId` (si hay
// algo abierto en el centro).
//
// Tab 1 (SIEMPRE, `effectiveSubTab==='primary'`): el contenido del destino activo —
//   Contexto → Ficha (V2ContextView) · Chat (destino general) → historial de
//   conversaciones por contexto, incondicional (C14, 29 ago 2026 — el composer
//   se mudó al centro, ver V2App.tsx) · Elementos → su vista de siempre, sin
//   cambios · Agenda → nota diaria a panel completo (A3, 29 ago 2026 — el
//   cockpit subió al centro, junto a la rejilla).
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
// duplicada. La nota diaria (antes el centro exclusivo de «Día») pasó a vivir
// al pie de esta columna derecha, debajo de DailyCockpit — y desde A3 (29 ago
// 2026) el cockpit subió al centro (junto a la rejilla, ver V2App.tsx) y la
// nota se quedó sola aquí, a panel completo:
//   · `mode='agenda'` → Tab 1 = nota diaria, panel completo · centro =
//     cockpit (atrasadas/sin fecha) + planner.
// La nota diaria nunca tiene Tab 2 "Chat" (`centerIsDiary`, ver V2ElementView.tsx)
// — aquí no aplica porque no vive en `elementId`/centro, sino embebida abajo.
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import ElementsPanel, { type ElemKind } from '../../components/panels/ElementsPanel'
import ElementsFilters from './ElementsFilters'
import V2ContextView from './V2ContextView'
import V2Chat from './V2Chat'
import V2ElementChat from './V2ElementChat'
import V2ElementView from './V2ElementView'
import V2ThreadHistory from './V2ThreadHistory'
import Icon from './Icon'
import { ensureDayPath } from '../../utils/agendaHelper'
import { containerNotesNode } from '../../utils/cajones'
import { markAgentResultSeen } from '../../store/aiChatStore'
import { displayTitle } from '../../utils/displayText'
import DailyCockpit from '../../components/views/DailyCockpit'
import V2AgendaAssistant from './V2AgendaAssistant'
import { TaskPropsBody } from '../../components/modals/TaskPropsModal'
import { V2NoteContext, V2Backlinks } from './V2DetailView'
import { elementDisplayTitle } from '../../utils/docNode'

export type RightMode = 'contexto' | 'chat' | 'elementos' | 'agenda'

/** Sub-tab activa de la columna derecha.
 *  · `primary` — el contenido del destino activo (Tab 1).
 *  · `chat`    — la conversación del elemento abierto en el centro (Tab 2).
 *  (Hubo una tercera, `historial`, para una tab de la columna derecha del
 *  destino Chat — desapareció con la cabecera de tabs de ese destino el 27
 *  ago 2026 y quedó inalcanzable; el destino Chat enseña su historial de
 *  forma incondicional desde C14, 29 ago 2026, sin necesitar sub-tab.) */
export type RightSubTab = 'primary' | 'chat'

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
  /** Hilo abierto en el centro del destino Chat (`V2App.chatThreadId`) — para
   *  resaltar su fila en `V2ThreadHistory`. `null` = general. */
  chatThreadId: string | null
  /** Abre ESE hilo en el centro del destino Chat, desde el historial. */
  onOpenChatThread: (threadKey: string | null) => void
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

// Enlaces (internos /node/… o externos) que aparecen DENTRO de las «Notas» del
// elemento — se extraen del HTML de su nota-hija `_containerNotes` (mismo sitio
// que la ficha central, ver `containerNotesNode`). Solo lectura: clic navega o
// abre en pestaña nueva, no hay edición aquí.
function useElementLinks(nodeId: string): { href: string; label: string; internal: boolean }[] {
  const notes = containerNotesNode(nodeId)
  const html = notes?.body || ''
  return useMemo(() => {
    if (!html) return []
    const out: { href: string; label: string; internal: boolean }[] = []
    const seen = new Set<string>()
    const re = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const href = m[1]
      if (seen.has(href)) continue
      seen.add(href)
      const label = m[2].replace(/<[^>]+>/g, '').trim() || href
      out.push({ href, label, internal: href.startsWith('/node/') })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])
}

// Panel que ACOMPAÑA, en la columna derecha, el evento/tarea/timeblock abierto
// en el centro desde el planificador — antes la derecha seguía enseñando el
// brief+cockpit+nota diaria de un día cualquiera, sin relación con lo abierto
// (30 ago 2026, Alberto: "la columna derecha tiene que acompañar el evento,
// tarea o timeblock que haya abierto en el centro"). Reutiliza piezas ya
// existentes (TaskPropsBody, V2NoteContext, V2Backlinks) en vez de duplicar
// lógica — nada de esto es nuevo, solo estaba repartido y no llegaba aquí.
function V2AgendaElementSide({ nodeId, onSelectCtx, onOpenNode }: { nodeId: string; onSelectCtx: (id: string) => void; onOpenNode: (id: string) => void }) {
  useStore()
  const { t } = useTranslation()
  const node = store.getNode(nodeId)
  const links = useElementLinks(nodeId)
  if (!node) return null
  const isTaskLike = node.status != null || node.isEvent
  return (
    <div className="v2-right-body v2-agenda-elside">
      <div className="v2-detail-dates" style={{ padding: '14px 20px 0' }}>{elementDisplayTitle(node)}</div>
      {isTaskLike && (
        <div style={{ padding: '0 20px' }}>
          <TaskPropsBody nodeId={nodeId} />
        </div>
      )}
      <div style={{ padding: '10px 20px 0' }}>
        <V2NoteContext node={node} onSelectCtx={onSelectCtx} />
      </div>
      {links.length > 0 && (
        <div style={{ padding: '14px 20px 0' }}>
          <div className="v2-section-label" style={{ padding: '0 0 6px' }}>{t('v2.linksInNote', 'Enlaces en la nota')}</div>
          {links.map(l => (
            <a key={l.href} className="v2-el-row" href={l.internal ? undefined : l.href}
              target={l.internal ? undefined : '_blank'} rel={l.internal ? undefined : 'noopener noreferrer'}
              onClick={l.internal ? (e => { e.preventDefault(); const id = l.href.slice('/node/'.length); onOpenNode(id) }) : undefined}>
              <span className="v2-el-icon"><Icon name={l.internal ? 'note' : 'link'} size={16} /></span>
              <span className="v2-el-main"><span className="v2-el-title">{l.label}</span></span>
            </a>
          ))}
        </div>
      )}
      <V2Backlinks nodeId={nodeId} />
    </div>
  )
}

export default function V2RightColumn({ mode, selectedCtxId, importDragOver, onOpenNode, onSelectCtx, elementId, onResize, rightSubTab, onSubTabChange, chatThreadId, onOpenChatThread, elementsFilter, onOpenElementsFiltered, recorder, onFilesDropped, agendaDayNoteDate }: Props) {
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
  const effectiveSubTab: RightSubTab =
    rightSubTab === 'chat' ? ((elementId || mode === 'contexto') ? 'chat' : 'primary') : 'primary'

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

      {/* Destino Chat general: el composer se mudó al CENTRO (C14 de la
          auditoría, 29 ago 2026 — ver V2App.tsx). Esta columna ya no tiene Tab
          1 "primary" propia aquí: lo único que enseña es el historial REAL de
          hilos (30 ago 2026 — antes `V2ContextBrowser`, conversaciones sueltas
          `_aiSession` desconectadas del chat de verdad, ver V2ThreadHistory.tsx),
          siempre visible, sin tabs (por eso arriba, línea ~190, `mode === 'chat'`
          sigue sin cabecera de tabs). */}
      {!isRecordingActive && mode === 'chat' && (
        <div className="v2-right-body">
          <V2ThreadHistory activeThreadKey={chatThreadId} onOpenThread={onOpenChatThread} />
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
          {elementId && <ElementsPanel initialFilter={elementsFilter ?? undefined} compact />}
        </div>
      )}

      {/* Destino Agenda: el centro ya muestra el calendario completo, limpio
          (V2App.tsx) — aquí, arriba: el brief del día + lo que NO cubre ese
          calendario (atrasadas, sin fecha — hoy/futuras ya están en el
          planner central, Alberto 5 ago 2026), y al PIE la nota diaria del
          día CENTRADO en el planner (no siempre hoy — sigue a
          `agendaDayNoteDate`, fusión de la tab «Día», retirada el 24 ago
          2026 — su timeline quedó duplicado con el planner central en 3
          columnas; la nota es lo único que «Día» aportaba de más).
          Brief+cockpit vivieron un tiempo arriba del planner central (A3,
          29 ago 2026) — vuelven aquí (30 ago 2026, Alberto: "lo que debe ir
          en el chat se ha metido en la parte superior del planner... no me
          gusta" — el planner limpio, esto en la columna derecha donde
          también se puede arrastrar la tarea al planner central).
          `key={dayNoteId}`: mismo motivo que el visor central — sin
          desmontar al cambiar de día no hay ventana de solape entre notas. */}
      {!isRecordingActive && effectiveSubTab === 'primary' && mode === 'agenda' && elementId && !centerIsDiary && (
        <V2AgendaElementSide nodeId={elementId} onSelectCtx={onSelectCtx} onOpenNode={onOpenNode} />
      )}
      {!isRecordingActive && effectiveSubTab === 'primary' && mode === 'agenda' && (!elementId || centerIsDiary) && (
        <div className="v2-right-fill v2-agenda-col">
          {/* Nota del día — siempre abierta arriba, panel fijo (30 ago 2026,
              Alberto: revertido desde el botón plegable de la misma tarde —
              "ponla arriba siempre abierta... quita el botón de nota del
              día"). Altura propia + scroll interno, no se lleva todo el
              alto de la columna. */}
          {dayNoteId && (
            <div className="v2-agenda-note-panel">
              <V2ElementView key={dayNoteId} nodeId={dayNoteId} onClose={() => {}} onSelectCtx={onSelectCtx} compact />
            </div>
          )}

          <div className="v2-agenda-cockpit-strip">
            <DailyCockpit bare disablePlanner hideToday hideFuture />
          </div>

          {/* El chat real de Agenda — sustituye al brief estático (V2AgendaAssistant.tsx). */}
          <V2AgendaAssistant onFilesDropped={onFilesDropped} />
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
