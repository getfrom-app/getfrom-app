// Columna derecha contextual de Fromly 2.0 — 4 modos.
// Contexto:  qué sabe Fromly del contexto activo + sus miembros.
// Elementos: buscador global de todo lo guardado (notas, tareas, archivos…).
// Historial: lista de conversaciones (chats) — clic retoma la conversación.
// Hoy:       columna de referencia del día REAL de la v1 (DayColumn):
//            eventos de Google Calendar, atrasadas, para hoy, bucles abiertos.
import { useEffect, useMemo, useState } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { useAIChat, aiChatStore } from '../../store/aiChatStore'
import { nodesInContext } from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import DayColumn from '../../components/panels/DayColumn'
import ElementsPanel from '../../components/panels/ElementsPanel'
import V2ContextView from './V2ContextView'
import V2ConversationView from './V2ConversationView'
import V2DetailView from './V2DetailView'
import { classifyElement } from '../elementKind'
import type { Node } from '../../types'

export type RightMode = 'contexto' | 'elementos' | 'historial' | 'hoy'

interface Props {
  mode: RightMode
  onMode: (m: RightMode) => void
  selectedCtxId: string | null
  droppedFiles: File[]
  onOpenNode: (id: string) => void
  onStartAbout: (id: string) => void
  onSelectCtx: (id: string) => void
  detailNodeId: string | null
  onCloseDetail: () => void
  onResize: (w: number) => void
  activeSessionId: string | null
  onOpenConversation: (id: string) => void
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

function fileIcon(f: File): string {
  const t = f.type
  if (t.startsWith('image/')) return '🖼️'
  if (t.includes('pdf')) return '📄'
  return '📎'
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }) } catch { return '' }
}

// Clasifica un nodo como ELEMENTO de historial (documento/nota/pdf/imagen/enlace/audio).
// Usa el clasificador compartido (alineado con la v1: detecta enlaces por isResource/
// extraData._resourceUrl/_resource, no solo por resourceType).
function classifyContent(n: Node): ReturnType<typeof classifyElement> {
  return classifyElement(n)
}

export default function V2RightColumn({ mode, onMode, selectedCtxId, droppedFiles, onOpenNode, onStartAbout, onSelectCtx, detailNodeId, onCloseDetail, onResize, activeSessionId, onOpenConversation }: Props) {
  useStore()
  const chat = useAIChat()
  const [today, setToday] = useState<Node | null>(() => store.todayDiary())

  // La nota de hoy se garantiza SOLO al abrir «Hoy» (no al arrancar el shell).
  useEffect(() => {
    if (mode === 'hoy' && !today) {
      try { setToday(getTodayDiaryUnderAgenda()) } catch { /* noop */ }
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Historial (conversaciones) ──
  // Conversaciones reales (nodos de sesión), globales o filtradas por contexto (_ctxRefs).
  const sessions = useMemo(() => {
    const list = store.allActive().filter(n => {
      const ed = parseExtraData(n.extraData)
      if (ed._aiSession !== '1') return false
      if (selectedCtxId) {
        const refs = Array.isArray(ed._ctxRefs) ? ed._ctxRefs : []
        if (!refs.includes(selectedCtxId)) return false
      }
      return true
    })
    list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return list.slice(0, 100)
  }, [store.nodesVersion, chat.sessionId, selectedCtxId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const src = selectedCtxId ? nodesInContext(selectedCtxId) : store.allActive()
    const out: { node: Node; icon: string; label: string }[] = []
    for (const n of src) {
      const c = classifyContent(n)
      if (!c || c.kind === 'note') continue                    // fragmentos/bullets v1 → fuera
      if (n.parentId && sessionIds.has(n.parentId)) continue   // pertenece a una conversación
      out.push({ node: n, icon: c.icon, label: c.label })
    }
    return out
  }, [sessions, selectedCtxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nivel superior del Historial: conversaciones + elementos sueltos, por reciente.
  const topLevel = useMemo(() => {
    const chats = sessions.map(s => ({ node: s, icon: '💬', label: 'Conversación', isChat: true as const }))
    const alone = standalone.map(it => ({ ...it, isChat: false as const }))
    return [...chats, ...alone]
      .sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
      .slice(0, 200)
  }, [sessions, standalone])

  const tabs: { id: RightMode; label: string }[] = [
    { id: 'contexto', label: 'Contexto' },
    { id: 'elementos', label: 'Elementos' },
    { id: 'historial', label: 'Historial' },
    { id: 'hoy', label: 'Hoy' },
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

  return (
    <aside className="v2-col v2-right">
      <div className="v2-resize-handle" onPointerDown={startResize} title="Arrastra para ensanchar" />
      <div className="v2-right-tabs">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`v2-right-tab ${!detailNodeId && mode === tb.id ? 'active' : ''}`}
            onClick={() => { onCloseDetail(); onMode(tb.id) }}
          >{tb.label}</button>
        ))}
      </div>

      {/* Detalle de un elemento (documento/PDF/imagen/audio/nota) — con las tabs arriba. */}
      {detailNodeId && (
        <div className="v2-right-fill">
          <div className="v2-detail-head">
            <button className="v2-iconbtn" onClick={onCloseDetail} title="Volver">‹</button>
            <span className="v2-center-title" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(store.getNode(detailNodeId)?.text || 'Elemento').replace(/^✦\s*/, '') || 'Elemento'}
            </span>
          </div>
          <div className="v2-detail-body"><V2DetailView nodeId={detailNodeId} /></div>
        </div>
      )}

      {/* Elementos: el buscador universal REAL de la v1 (filtros por tipo, virtualizado). */}
      {!detailNodeId && mode === 'elementos' && (
        <div className="v2-right-fill">
          <ElementsPanel />
        </div>
      )}

      {!detailNodeId && mode !== 'elementos' && (
      <div className="v2-right-body">
        {/* Archivos recién arrastrados al chat. */}
        {droppedFiles.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="v2-section-label" style={{ padding: '0 0 8px' }}>Adjuntos ({droppedFiles.length})</div>
            <div className="v2-thumb-grid">
              {droppedFiles.map((f, i) => (
                <div className="v2-thumb" key={i} title={f.name}>
                  <div className="v2-thumb-icon">{fileIcon(f)}</div>
                  <div className="v2-thumb-name">{f.name}</div>
                </div>
              ))}
            </div>
            <div className="v2-el-meta" style={{ marginTop: 6 }}>Ingesta al RAG en la siguiente fase.</div>
          </div>
        )}

        {mode === 'contexto' && (
          selectedCtxId
            ? <V2ContextView ctxId={selectedCtxId} onSelectCtx={onSelectCtx} onOpenNode={onOpenNode} />
            : activeSessionId
              ? <V2ConversationView sessionId={activeSessionId} onOpenNode={onOpenNode} onSelectCtx={onSelectCtx} />
              : <div className="v2-right-empty">Elige un contexto a la izquierda, o empieza una conversación: aquí verás sus tareas y elementos.</div>
        )}

        {mode === 'historial' && (
          <div>
            <div className="v2-el-row" onClick={() => aiChatStore.startNewSession()} style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
              <span className="v2-el-icon">＋</span>
              <span className="v2-el-main"><span className="v2-el-title">Nueva conversación{selectedCtxId ? ' en este contexto' : ''}</span></span>
            </div>

            {/* Conversaciones (con sus elementos indentados) + elementos sueltos. */}
            {topLevel.map(it => (
              <div key={it.node.id}>
                <div
                  className="v2-el-row"
                  style={it.isChat && chat.sessionId === it.node.id ? { background: 'var(--accent-soft)' } : undefined}
                  onClick={() => (it.isChat ? onOpenConversation(it.node.id) : onOpenNode(it.node.id))}
                >
                  <span className="v2-el-icon">{it.icon}</span>
                  <span className="v2-el-main">
                    <span className="v2-el-title">{(it.node.text || it.label).replace(/^✦\s*/, '') || it.label}</span>
                    <span className="v2-el-meta">{it.label} · {fmtDate(it.node.updatedAt)}</span>
                  </span>
                </div>
                {/* Elementos DENTRO de la conversación, indentados. */}
                {it.isChat && bySession.get(it.node.id)?.map(child => (
                  <div className="v2-el-row v2-el-child" key={child.node.id} onClick={() => onOpenNode(child.node.id)}>
                    <span className="v2-el-icon">{child.icon}</span>
                    <span className="v2-el-main">
                      <span className="v2-el-title">{child.node.text || child.label}</span>
                      <span className="v2-el-meta">{child.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {topLevel.length === 0 && (
              <div className="v2-right-empty">
                {selectedCtxId ? 'Este contexto no tiene conversaciones ni contenido todavía.' : 'Aún no hay nada. Empieza a hablar con Fromly.'}
              </div>
            )}
          </div>
        )}

        {mode === 'hoy' && (
          today
            ? <DayColumn node={today} includeNodes={false} />
            : <div className="v2-right-empty">Preparando la columna de hoy…</div>
        )}
      </div>
      )}
    </aside>
  )
}
