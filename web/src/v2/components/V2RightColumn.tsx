// Columna derecha contextual de Fromly 2.0 — 3 modos.
// Contexto: qué sabe Fromly del contexto activo + sus miembros.
// Elementos: buscador global de todo lo guardado (notas, tareas, archivos…).
// Hoy: tareas y eventos del día (reusa todayDiary del motor).
import { useMemo, useState } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { readContextKnowledge, nodesInContext, contextColor } from '../../utils/cajones'
import type { Node } from '../../types'

export type RightMode = 'contexto' | 'elementos' | 'hoy'

interface Props {
  mode: RightMode
  onMode: (m: RightMode) => void
  selectedCtxId: string | null
  droppedFiles: File[]
  onOpenNode: (id: string) => void
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

export default function V2RightColumn({ mode, onMode, selectedCtxId, droppedFiles, onOpenNode }: Props) {
  useStore()
  const [query, setQuery] = useState('')

  // ── Datos Elementos (buscador global) ──
  const elements = useMemo(() => {
    const all = store.allActive()
    const q = query.trim().toLowerCase()
    const filtered = all.filter(n => {
      if (!n.text) return false
      if (n.isChat) return false
      if (q && !n.text.toLowerCase().includes(q)) return false
      return true
    })
    // Orden por recientes.
    filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return filtered.slice(0, 200)
  }, [query, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Datos Hoy ──
  const today = store.todayDiary()
  const todayItems: Node[] = useMemo(() => {
    if (!today) return []
    const kids = store.children(today.id).filter(n => !n.deletedAt)
    return kids
  }, [today?.id, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Datos Contexto ──
  const ctxKnowledge = selectedCtxId ? readContextKnowledge(selectedCtxId) : ''
  const ctxMembers = selectedCtxId ? nodesInContext(selectedCtxId).slice(0, 100) : []
  const ctxNode = selectedCtxId ? store.getNode(selectedCtxId) : null

  return (
    <aside className="v2-col v2-right">
      <div className="v2-right-tabs">
        <button className={`v2-right-tab ${mode === 'contexto' ? 'active' : ''}`} onClick={() => onMode('contexto')}>Contexto</button>
        <button className={`v2-right-tab ${mode === 'elementos' ? 'active' : ''}`} onClick={() => onMode('elementos')}>Elementos</button>
        <button className={`v2-right-tab ${mode === 'hoy' ? 'active' : ''}`} onClick={() => onMode('hoy')}>Hoy</button>
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

        {mode === 'hoy' && (
          <div>
            <div className="v2-section-label" style={{ padding: '0 0 8px' }}>
              {today ? new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Hoy'}
            </div>
            {!today && <div className="v2-right-empty">Aún no hay nota de hoy. Escribe algo en el chat y aparecerá.</div>}
            {today && todayItems.length === 0 && <div className="v2-right-empty">Nada para hoy todavía.</div>}
            {todayItems.map(n => {
              const c = classify(n)
              return (
                <div className="v2-el-row" key={n.id} onClick={() => onOpenNode(n.id)}>
                  <span className="v2-el-icon">{c.icon}</span>
                  <span className="v2-el-main"><span className="v2-el-title">{n.text}</span><span className="v2-el-meta">{c.label}{n.due ? ' · ' + n.due.slice(0, 10) : ''}</span></span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
