// Columna derecha contextual de Fromly 2.0 — 4 modos.
// Contexto:  qué sabe Fromly del contexto activo + sus miembros.
// Elementos: buscador global de todo lo guardado (notas, tareas, archivos…).
// Historial: lista de conversaciones (chats) — clic retoma la conversación.
// Hoy:       columna de referencia del día REAL de la v1 (DayColumn):
//            eventos de Google Calendar, atrasadas, para hoy.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { useAIChat, isQuickCommandSession } from '../../store/aiChatStore'
import { parseExtraData, isInPapelera } from '../../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import PublishButton from '../../components/PublishButton'
import DayColumn from '../../components/panels/DayColumn'
import ElementsPanel, { type ElemKind } from '../../components/panels/ElementsPanel'
import V2ContextView from './V2ContextView'
import V2ConversationView from './V2ConversationView'
import V2DetailView from './V2DetailView'
import V2AgendaView from './V2AgendaView'
import V2ElementRow from './V2ElementRow'
import { classifyElement } from '../elementKind'
import { elementDisplayTitle } from '../../utils/docNode'
import type { Node } from '../../types'

export type RightMode = 'contexto' | 'elementos' | 'historial' | 'hoy' | 'agenda'

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
  viewingCtxFicha: boolean
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

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) } catch { return '' }
}

// Clasifica un nodo como ELEMENTO de historial (documento/nota/pdf/imagen/enlace/audio).
// Usa el clasificador compartido (alineado con la v1: detecta enlaces por isResource/
// extraData._resourceUrl/_resource, no solo por resourceType).
function classifyContent(n: Node): ReturnType<typeof classifyElement> {
  return classifyElement(n)
}

export default function V2RightColumn({ mode, onMode, selectedCtxId, importDragOver, onOpenNode, onStartAbout, onSelectCtx, detailNodeId, onCloseDetail, onResize, activeSessionId, onOpenConversation, viewingCtxFicha, elementsFilter, onOpenElementsFiltered, recorder }: Props) {
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

  // ── Historial (conversaciones) ──
  // SIEMPRE global: el Historial es el índice para saltar a cualquier sitio de Fromly,
  // no se filtra por el contexto abierto. (El contexto tiene su propia ficha en Contexto.)
  const sessions = useMemo(() => {
    const list = store.allActive().filter(n => {
      const ed = parseExtraData(n.extraData)
      if (ed._aiSession !== '1') return false
      if (isInPapelera(n.id)) return false   // borrada → no aparece en Historial (trashNode reparenta, no pone deletedAt)
      // Comando de 1 turno sin valor conversacional (p.ej. «créame una tarea…») → no
      // ensucia Historial. Sigue en la BD/buscable; al añadir un 2º mensaje aparece sola.
      if (isQuickCommandSession(n.id)) return false
      return true
    })
    list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return list.slice(0, 100)
  }, [store.nodesVersion, chat.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Elementos DENTRO de cada conversación (hijos-contenido de la sesión) → indentados.
  const bySession = useMemo(() => {
    const m = new Map<string, { node: Node; icon: string; label: string }[]>()
    for (const s of sessions) {
      const kids: { node: Node; icon: string; label: string }[] = []
      for (const n of store.children(s.id)) {
        const c = classifyContent(n)
        if (c) kids.push({ node: n, icon: c.icon, label: c.label })
      }
      if (kids.length) m.set(s.id, kids.sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || '')))
    }
    return m
  }, [sessions, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Elementos SUELTOS (subidos/creados SIN conversación): su padre NO es una sesión.
  // OJO: excluimos las «notas» de texto plano (bullets del árbol v1) — hay miles y
  // no son «elementos» del historial. En v2 el contenido suelto nace como DOCUMENTO
  // (_doc) o RECURSO (archivo/PDF/imagen/enlace/audio); las notas que crea la IA van
  // anidadas bajo su conversación (bySession), no aquí. Así el Historial global no se
  // inunda con el vault heredado.
  const standalone = useMemo(() => {
    const sessionIds = new Set(sessions.map(s => s.id))
    const out: { node: Node; icon: string; label: string }[] = []
    for (const n of store.allActive()) {                        // SIEMPRE global (no por contexto)
      const c = classifyContent(n)
      if (!c || c.kind === 'note') continue                    // fragmentos/bullets v1 → fuera
      if (n.parentId && sessionIds.has(n.parentId)) continue   // pertenece a una conversación
      if (isInPapelera(n.id)) continue                          // borrado → fuera del Historial
      out.push({ node: n, icon: c.icon, label: c.label })
    }
    return out
  }, [sessions, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nivel superior del Historial: conversaciones + elementos sueltos, por reciente.
  const topLevel = useMemo(() => {
    const chats = sessions.map(s => ({ node: s, icon: '💬', label: t('v2.chat.conversation', 'Conversación'), isChat: true as const }))
    const alone = standalone.map(it => ({ ...it, isChat: false as const }))
    return [...chats, ...alone]
      .sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
      .slice(0, 200)
  }, [sessions, standalone]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { id: RightMode; label: string }[] = [
    { id: 'contexto', label: t('v2.rightColumn.tabContext', 'Contexto') },
    { id: 'elementos', label: t('v2.rightColumn.tabElements', 'Elementos') },
    { id: 'historial', label: t('v2.rightColumn.tabHistory', 'Historial') },
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
            className={`v2-right-tab ${!detailNodeId && mode === tb.id ? 'active' : ''}`}
            onClick={() => { onCloseDetail(); onMode(tb.id) }}
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

      {/* Detalle de un elemento (documento/PDF/imagen/audio/nota) — con las tabs arriba. */}
      {!isRecordingActive && detailNodeId && (() => {
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
            <div className="v2-detail-body"><V2DetailView nodeId={detailNodeId} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} /></div>
          </div>
        )
      })()}

      {/* Elementos: el buscador universal REAL de la v1 (filtros por tipo, virtualizado). */}
      {!isRecordingActive && !detailNodeId && mode === 'elementos' && (
        <div className="v2-right-fill">
          <ElementsPanel initialFilter={elementsFilter ?? undefined} />
        </div>
      )}

      {!isRecordingActive && !detailNodeId && mode !== 'elementos' && (
      <div className="v2-right-body">
        {mode === 'contexto' && (
          // Con una conversación activa manda su PANEL (Relacionado/Tareas/Elementos);
          // la FICHA del contexto solo cuando entras a un contexto a verlo (viewingCtxFicha).
          (activeSessionId && !viewingCtxFicha)
            ? <V2ConversationView sessionId={activeSessionId} onOpenNode={onOpenNode} onSelectCtx={onSelectCtx} />
            : selectedCtxId
              ? <V2ContextView ctxId={selectedCtxId} onSelectCtx={onSelectCtx} onOpenNode={onOpenNode} onOpenConversation={onOpenConversation} />
              : activeSessionId
                ? <V2ConversationView sessionId={activeSessionId} onOpenNode={onOpenNode} onSelectCtx={onSelectCtx} />
                : <div className="v2-right-empty">{t('v2.rightColumn.chooseContextEmpty', 'Elige un contexto a la izquierda, o empieza una conversación: aquí verás sus tareas y elementos.')}</div>
        )}

        {mode === 'historial' && (
          <div>
            {/* Conversaciones (con sus elementos indentados) + elementos sueltos. */}
            {topLevel.map(it => (
              <div key={it.node.id} className={it.isChat && chat.sessionId === it.node.id ? 'v2-el-active' : undefined}>
                <V2ElementRow
                  node={it.node}
                  icon={it.icon}
                  onOpen={id => (it.isChat ? onOpenConversation(id) : onOpenNode(id))}
                  extraMeta={fmtDate(it.node.updatedAt, i18n.language)}
                />
                {/* Elementos DENTRO de la conversación, indentados. */}
                {it.isChat && bySession.get(it.node.id)?.map(child => (
                  <V2ElementRow key={child.node.id} node={child.node} icon={child.icon} onOpen={onOpenNode} child hideContext />
                ))}
              </div>
            ))}

            {topLevel.length === 0 && (
              <div className="v2-right-empty">
                {selectedCtxId ? t('v2.rightColumn.contextNoContentYet', 'Este contexto no tiene conversaciones ni contenido todavía.') : t('v2.rightColumn.nothingYet', 'Aún no hay nada. Empieza a hablar con Fromly.')}
              </div>
            )}
          </div>
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
