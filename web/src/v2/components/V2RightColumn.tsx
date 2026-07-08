// Columna derecha contextual de Fromly 2.0 — 4 modos.
// Contexto:  qué sabe Fromly del contexto activo + sus miembros.
// Elementos: buscador global de todo lo guardado (notas, tareas, archivos…).
// Historial: lista de conversaciones (chats) — clic retoma la conversación.
// Hoy:       columna de referencia del día REAL de la v1 (DayColumn):
//            eventos de Google Calendar, atrasadas, para hoy, bucles abiertos.
import { useEffect, useMemo, useState } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { useAIChat, aiChatStore } from '../../store/aiChatStore'
import { readContextKnowledge, nodesInContext, contextColor } from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import DayColumn from '../../components/panels/DayColumn'
import type { Node } from '../../types'

export type RightMode = 'contexto' | 'elementos' | 'historial' | 'hoy'

interface Props {
  mode: RightMode
  onMode: (m: RightMode) => void
  selectedCtxId: string | null
  droppedFiles: File[]
  onOpenNode: (id: string) => void
  onStartAbout: (id: string) => void
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

export default function V2RightColumn({ mode, onMode, selectedCtxId, droppedFiles, onOpenNode, onStartAbout }: Props) {
  useStore()
  const chat = useAIChat()
  const [query, setQuery] = useState('')
  const [today, setToday] = useState<Node | null>(() => store.todayDiary())

  // La nota de hoy se garantiza SOLO al abrir «Hoy» (no al arrancar el shell).
  useEffect(() => {
    if (mode === 'hoy' && !today) {
      try { setToday(getTodayDiaryUnderAgenda()) } catch { /* noop */ }
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Elementos (buscador global) ──
  const elements = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = store.allActive().filter(n => {
      if (!n.text || n.isChat) return false
      const ed = parseExtraData(n.extraData)
      if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) return false
      if (q && !n.text.toLowerCase().includes(q)) return false
      return true
    })
    filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return filtered.slice(0, 200)
  }, [query, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Contenido existente del contexto presentado COMO conversaciones (semilla para empezar).
  // No son chats reales; clic → inicia una conversación centrada en ese contenido.
  const ctxSeeds = useMemo(() => {
    if (!selectedCtxId) return [] as Node[]
    return nodesInContext(selectedCtxId)
      .filter(n => {
        const ed = parseExtraData(n.extraData)
        if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) return false
        if (ed._ctx === '1') return false // no los subcontextos
        return !!n.text
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 100)
  }, [store.nodesVersion, selectedCtxId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Contexto ──
  const ctxKnowledge = selectedCtxId ? readContextKnowledge(selectedCtxId) : ''
  const ctxMembers = selectedCtxId ? nodesInContext(selectedCtxId).slice(0, 100) : []
  const ctxNode = selectedCtxId ? store.getNode(selectedCtxId) : null

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

      <div className="v2-right-body">
        {/* Archivos recién arrastrados al chat (todos los modos). */}
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
          selectedCtxId ? (
            <div>
              <div className="v2-section-label" style={{ padding: '0 0 6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="v2-ctx-dot" style={{ background: contextColor(selectedCtxId) }} />
                  {ctxNode?.text || 'Contexto'}
                </span>
              </div>
              <div className="v2-section-label" style={{ padding: '10px 0 4px' }}>🧠 Lo que Fromly sabe</div>
              {ctxKnowledge
                ? <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{ctxKnowledge}</div>
                : <div className="v2-right-empty" style={{ padding: '8px 0' }}>Fromly aún no ha aprendido nada de este contexto.</div>}
              <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>Contenido ({ctxMembers.length})</div>
              {ctxMembers.map(n => {
                const c = classify(n)
                return (
                  <div className="v2-el-row" key={n.id} onClick={() => onOpenNode(n.id)}>
                    <span className="v2-el-icon">{c.icon}</span>
                    <span className="v2-el-main"><span className="v2-el-title">{n.text}</span><span className="v2-el-meta">{c.label}</span></span>
                  </div>
                )
              })}
              {ctxMembers.length === 0 && <div className="v2-right-empty" style={{ padding: '8px 0' }}>Sin contenido todavía.</div>}
            </div>
          ) : (
            <div className="v2-right-empty">Elige un contexto en la izquierda para ver qué sabe Fromly de él y su contenido.</div>
          )
        )}

        {mode === 'elementos' && (
          <div>
            <input
              className="v2-search-input"
              placeholder="Buscar en todo lo guardado…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="v2-el-meta" style={{ marginBottom: 8 }}>{elements.length} elemento(s)</div>
            {elements.map(n => {
              const c = classify(n)
              return (
                <div className="v2-el-row" key={n.id} onClick={() => onOpenNode(n.id)}>
                  <span className="v2-el-icon">{c.icon}</span>
                  <span className="v2-el-main"><span className="v2-el-title">{n.text}</span><span className="v2-el-meta">{c.label}</span></span>
                </div>
              )
            })}
            {elements.length === 0 && <div className="v2-right-empty">Nada encontrado.</div>}
          </div>
        )}

        {mode === 'historial' && (
          <div>
            <div className="v2-el-row" onClick={() => aiChatStore.startNewSession()} style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
              <span className="v2-el-icon">＋</span>
              <span className="v2-el-main"><span className="v2-el-title">Nueva conversación{selectedCtxId ? ' en este contexto' : ''}</span></span>
            </div>

            {/* Conversaciones reales */}
            {sessions.length > 0 && (
              <div className="v2-section-label" style={{ padding: '12px 0 4px' }}>Conversaciones</div>
            )}
            {sessions.map(s => (
              <div
                className="v2-el-row"
                key={s.id}
                style={chat.sessionId === s.id ? { background: 'var(--accent-soft)' } : undefined}
                onClick={() => aiChatStore.loadSession(s.id)}
              >
                <span className="v2-el-icon">✦</span>
                <span className="v2-el-main">
                  <span className="v2-el-title">{s.text || 'Conversación'}</span>
                  <span className="v2-el-meta">{fmtDate(s.updatedAt)}</span>
                </span>
              </div>
            ))}

            {/* Contenido existente como conversaciones (semilla para empezar) */}
            {selectedCtxId && ctxSeeds.length > 0 && (
              <>
                <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>Empezar desde tu contenido</div>
                {ctxSeeds.map(n => {
                  const c = classify(n)
                  return (
                    <div className="v2-el-row" key={n.id} onClick={() => onStartAbout(n.id)} title="Empezar una conversación sobre esto">
                      <span className="v2-el-icon">{c.icon}</span>
                      <span className="v2-el-main">
                        <span className="v2-el-title">{n.text}</span>
                        <span className="v2-el-meta">{c.label} · abrir como conversación</span>
                      </span>
                    </div>
                  )
                })}
              </>
            )}

            {sessions.length === 0 && ctxSeeds.length === 0 && (
              <div className="v2-right-empty">
                {selectedCtxId ? 'Este contexto no tiene conversaciones ni contenido todavía.' : 'Aún no hay conversaciones. Empieza a hablar con Fromly.'}
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
    </aside>
  )
}
