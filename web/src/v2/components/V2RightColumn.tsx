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

export default function V2RightColumn({ mode, onMode, selectedCtxId, droppedFiles, onOpenNode, onStartAbout, onSelectCtx }: Props) {
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

  // Contenido del contexto para el Historial: NOTAS/DOCUMENTOS, ARCHIVOS (PDF/imagen)
  // y ENLACES. Se combinan con las conversaciones en una sola lista. (Tareas y eventos
  // NO — esos viven en Contexto/Hoy.)
  const contentItems = useMemo(() => {
    const src = selectedCtxId ? nodesInContext(selectedCtxId) : store.allActive()
    const items: { node: Node; icon: string; label: string; isChat: false }[] = []
    for (const n of src) {
      if (!n.text) continue
      const ed = parseExtraData(n.extraData)
      if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) continue
      if (ed._ctx === '1') continue // subcontextos
      if (n.status != null || (n.types || []).includes('tarea')) continue // tareas
      if ((n.types || []).includes('evento') || n.isEvent) continue // eventos
      const rt = (n.resourceType || '').toLowerCase()
      let icon = '📝', label = 'Nota'
      if (n.isResource || n.resourceType) {
        if (rt.includes('pdf')) { icon = '📄'; label = 'PDF' }
        else if (rt.includes('image') || rt.includes('img')) { icon = '🖼'; label = 'Imagen' }
        else { icon = '🔗'; label = 'Enlace' }
      } else if (ed._doc === '1') { label = 'Documento' } else if (Array.isArray(ed._audios)) { icon = '🎙'; label = 'Audio' }
      items.push({ node: n, icon, label, isChat: false })
    }
    return items
  }, [store.nodesVersion, selectedCtxId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lista COMBINADA del Historial: conversaciones + notas + archivos + enlaces, por reciente.
  const historyItems = useMemo(() => {
    const chats = sessions.map(s => ({ node: s, icon: '💬', label: 'Conversación', isChat: true as const }))
    const merged = [...chats, ...contentItems]
    merged.sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
    return merged.slice(0, 200)
  }, [sessions, contentItems])

  const tabs: { id: RightMode; label: string }[] = [
    { id: 'contexto', label: 'Contexto' },
    { id: 'elementos', label: 'Elementos' },
    { id: 'historial', label: 'Historial' },
    { id: 'hoy', label: 'Hoy' },
  ]

  return (
    <aside className="v2-col v2-right">
      <div className="v2-right-tabs">
        {tabs.map(tb => (
          <button key={tb.id} className={`v2-right-tab ${mode === tb.id ? 'active' : ''}`} onClick={() => onMode(tb.id)}>{tb.label}</button>
        ))}
      </div>

      {/* Elementos: el buscador universal REAL de la v1 (filtros por tipo, virtualizado). */}
      {mode === 'elementos' && (
        <div className="v2-right-fill">
          <ElementsPanel />
        </div>
      )}

      {mode !== 'elementos' && (
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
            : <div className="v2-right-empty">Elige un contexto en la izquierda para ver qué sabe Fromly de él y su contenido.</div>
        )}

        {mode === 'historial' && (
          <div>
            <div className="v2-el-row" onClick={() => aiChatStore.startNewSession()} style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
              <span className="v2-el-icon">＋</span>
              <span className="v2-el-main"><span className="v2-el-title">Nueva conversación{selectedCtxId ? ' en este contexto' : ''}</span></span>
            </div>

            {/* Lista combinada: conversaciones + notas + documentos + archivos + enlaces */}
            {historyItems.map(it => (
              <div
                className="v2-el-row"
                key={it.node.id}
                style={it.isChat && chat.sessionId === it.node.id ? { background: 'var(--accent-soft)' } : undefined}
                onClick={() => (it.isChat ? aiChatStore.loadSession(it.node.id) : onOpenNode(it.node.id))}
              >
                <span className="v2-el-icon">{it.icon}</span>
                <span className="v2-el-main">
                  <span className="v2-el-title">{(it.node.text || it.label).replace(/^✦\s*/, '') || it.label}</span>
                  <span className="v2-el-meta">{it.label} · {fmtDate(it.node.updatedAt)}</span>
                </span>
              </div>
            ))}

            {historyItems.length === 0 && (
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
