// Cuerpo de la vista de detalle de Fromly 2.0 — enruta al visor/editor REAL de v1
// según el tipo. La cabecera (título editable + volver) y las tabs las pone
// V2RightColumn. Una nota/nodo se puede ver como TEXTO, LIENZO, TABLA, KANBAN o
// CALENDARIO (mismo nodo); el modo persiste en extraData (_v2view).
import { useEffect, useRef, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { isDocNode } from '../../utils/docNode'
import { parseExtraData } from '../../utils/papeleraHelper'
import ResourcePanel from '../../components/panels/ResourcePanel'
import AudioPanel from '../../components/panels/AudioPanel'
import Outliner from '../../components/outliner/Outliner'
import PizarraView from '../../components/views/PizarraView'
import NodeTableView from '../../components/views/NodeTableView'
import NodeKanbanView from '../../components/views/NodeKanbanView'
import NodeCalendarView from '../../components/views/NodeCalendarView'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import DocInspector from '../../components/views/DocInspector'
import PublishButton from '../../components/PublishButton'
import { exportNodeMarkdown, exportNodeHtml, exportNodePdf } from '../../utils/nodeExport'
import type { Node } from '../../types'

type V2View = 'nota' | 'lienzo' | 'tabla' | 'kanban' | 'calendario'

const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))
const actBtn = { background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', color: 'var(--text-secondary,#666)', fontSize: 11, lineHeight: 1 } as const

function readView(node: Node): V2View {
  const e = parseExtraData(node.extraData)
  if (e._v2canvas === '1' && !e._v2view) return 'lienzo' // compat con el flag anterior
  const v = e._v2view as V2View
  return (v === 'lienzo' || v === 'tabla' || v === 'kanban' || v === 'calendario') ? v : 'nota'
}

function V2NoteBody({ node }: { node: Node }) {
  const { t } = useTranslation()
  const [view, setView] = useState<V2View>(() => readView(node))
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const doc = isDocNode(node)

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as HTMLElement)) setMoreOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  const setV = (v: V2View) => {
    setView(v); setMoreOpen(false)
    const e = parseExtraData(node.extraData)
    delete e._v2canvas
    if (v === 'nota') delete e._v2view; else e._v2view = v
    store.updateNode(node.id, { extraData: JSON.stringify(e) })
  }

  const toggleFavorite = () => { const next = !node.isFavorite; store.updateNode(node.id, { isFavorite: next }); toast(next ? t('tip.addFavorite') : t('tip.removeFavorite')) }
  const deleteCard = () => { store.deleteNode(node.id); toast(t('context.toastMovedToTrash', 'Movido a la papelera')); window.dispatchEvent(new Event('from:close-detail')) }

  const isCanvas = view === 'lienzo'
  const isNota = view === 'nota'
  const moreActive = view === 'tabla' || view === 'kanban' || view === 'calendario'
  const moreLabel = view === 'tabla' ? '▦ Tabla' : view === 'kanban' ? '▤ Kanban' : view === 'calendario' ? '📅 Calendario' : '⊞ Vistas'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Fila única: selector de vista a la izquierda + acciones a la derecha */}
      <div className="v2-note-toolbar">
        <div className="v2-view-toggle">
          <button className={isNota ? 'active' : ''} onClick={() => setV('nota')}>📝 Nota</button>
          <button className={isCanvas ? 'active' : ''} onClick={() => setV('lienzo')}>🎨 Lienzo</button>
          <div style={{ position: 'relative' }} ref={moreRef}>
            <button className={moreActive ? 'active' : ''} onClick={() => setMoreOpen(o => !o)}>{moreLabel} ▾</button>
            {moreOpen && (
              <div className="v2-view-more">
                <button onClick={() => setV('tabla')}>▦ Tabla</button>
                <button onClick={() => setV('kanban')}>▤ Kanban</button>
                <button onClick={() => setV('calendario')}>📅 Calendario</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <button title={node.isFavorite ? t('tip.removeFavorite') : t('tip.addFavorite')} onClick={toggleFavorite} style={{ ...actBtn, color: node.isFavorite ? '#f59e0b' : 'var(--text-secondary,#666)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={node.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/></svg>
          </button>
          {doc && isNota && <>
            <button title={t('export.markdown')} onClick={() => { exportNodeMarkdown(node); toast(t('context.toastExportedMarkdown')) }} style={actBtn}>MD</button>
            <button title={t('export.html')} onClick={() => { exportNodeHtml(node); toast(t('context.toastExportedHtml')) }} style={actBtn}>HTML</button>
            <button title={t('export.pdf')} onClick={() => exportNodePdf(node)} style={actBtn}>PDF</button>
            <PublishButton node={node} />
          </>}
          <button title={t('tip.delete', 'Eliminar')} onClick={deleteCard} style={{ ...actBtn, color: 'var(--text-tertiary,#999)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>
      </div>

      {/* Barra de formato PLANA — solo para documentos en modo texto. */}
      {doc && isNota && (
        <div className="v2-note-formatbar"><DocInspector bar /></div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: isCanvas ? 'hidden' : 'auto' }}>
        {isCanvas
          ? <PizarraView parentId={node.id} flowUnpositioned globalCanvas={false} embedded />
          : view === 'tabla'
            ? <NodeTableView parentId={node.id} />
            : view === 'kanban'
              ? <NodeKanbanView parentId={node.id} />
              : view === 'calendario'
                ? <NodeCalendarView parentId={node.id} />
                : doc
                  ? <div style={{ padding: '18px 20px 88px' }}><DocEditorBoundary compact><DocEditor node={node} compact registerActive autofocus={false} /></DocEditorBoundary></div>
                  : <Outliner parentId={node.id} autoFocusEmpty placeholder="Escribe aquí…" />}
      </div>
    </div>
  )
}

export default function V2DetailView({ nodeId }: { nodeId: string }) {
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return <div className="v2-right-empty">Elemento no encontrado.</div>

  const hasAudio = Array.isArray(parseExtraData(node.extraData)._audios)
  const rt = (node.resourceType || '').toLowerCase()

  if (hasAudio || rt.includes('audio')) return <AudioPanel nodeId={node.id} />
  if (node.isResource || node.resourceType) return <ResourcePanel node={node} />
  return <V2NoteBody node={node} />
}
