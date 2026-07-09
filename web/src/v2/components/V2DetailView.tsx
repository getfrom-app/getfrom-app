// Cuerpo de la vista de detalle de Fromly 2.0 — enruta al visor/editor REAL de v1
// según el tipo. La cabecera (título editable + volver) y las tabs las pone
// V2RightColumn. Una nota se puede ver como TEXTO o como LIENZO (mismo nodo); el modo
// persiste en extraData (_v2canvas). Las vistas Tabla/Kanban/Calendario NO son un modo
// de la nota: son BLOQUES que se insertan dentro del contenido con «/» (slash) en el
// editor — cada uno muestra sus propios hijos, sin tapar el resto de la nota.
import { useMemo, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { isDocNode } from '../../utils/docNode'
import { parseExtraData } from '../../utils/papeleraHelper'
import { isPdfResource } from '../elementKind'
import ResourcePanel from '../../components/panels/ResourcePanel'
import AudioPanel from '../../components/panels/AudioPanel'
import PdfContainer from '../../components/pdf/PdfContainer'
import Outliner from '../../components/outliner/Outliner'
import PizarraView from '../../components/views/PizarraView'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import DocInspector from '../../components/views/DocInspector'
import PublishButton from '../../components/PublishButton'
import { exportNodeMarkdown, exportNodeHtml, exportNodePdf } from '../../utils/nodeExport'
import { convertNoteToBlock } from '../../utils/noteBlocks'
import { firstContextOf, setNodeContext, contextColor } from '../../utils/cajones'
import { saveExample } from '../../api/autoClassify'
import ContextPicker from '../../components/panels/ContextPicker'
import V2TaskDetailView from './V2TaskDetailView'
import { useRef, useEffect } from 'react'
import type { Node } from '../../types'

const toast = (message: string, type: 'success' | 'warning' = 'success') => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type } }))
const actBtn = { background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', color: 'var(--text-secondary,#666)', fontSize: 11, lineHeight: 1 } as const

// Nota o documento: se puede ver como TEXTO o como LIENZO (mismo nodo). El toggle
// persiste en extraData (_v2canvas). Cabecera de una sola fila: [Nota | Lienzo] a la
// izquierda, acciones (favorito, exportar, publicar, eliminar) a la derecha.
// Retroenlaces: elementos cuyo cuerpo enlaza a este nodo (/node/<id>). Enlace bidireccional.
function V2Backlinks({ nodeId }: { nodeId: string }) {
  useStore()
  const links = useMemo(() => {
    const needle = `/node/${nodeId}`
    return store.allActive().filter(n => n.id !== nodeId && !n.deletedAt && (n.body || '').includes(needle))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, store.nodesVersion])
  if (!links.length) return null
  return (
    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 20px 40px', paddingTop: 14 }}>
      <div className="v2-section-label" style={{ padding: '0 0 6px' }}>Enlazado desde ({links.length})</div>
      {links.map(n => (
        <div className="v2-el-row" key={n.id} onClick={() => window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: n.id } }))}>
          <span className="v2-el-icon">📝</span>
          <span className="v2-el-main"><span className="v2-el-title">{(n.text || '').replace(/^[✦💬]\s*/u, '') || 'Sin título'}</span></span>
        </div>
      ))}
    </div>
  )
}

// Contexto de una nota: chips de los contextos asignados + «Añadir a contexto» (opcional).
// Si no se añade ninguno, la nota queda sin contexto (no pasa nada) — pero SIEMPRE se
// puede añadir desde aquí, así que una nota nueva ya no queda sin forma de asignarla.
function V2NoteContext({ node, onSelectCtx }: { node: Node; onSelectCtx?: (id: string) => void }) {
  useStore()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as HTMLElement)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  // Mismo criterio que el chip del Historial/columnas (RowContextChip): firstContextOf.
  const current = firstContextOf(node)
  return (
    <div className="v2-notectx-row">
      {current && (
        <button className="v2-chip" onClick={() => onSelectCtx?.(current.id)} style={{ ['--chip' as string]: contextColor(current.id) }}>{current.text}</button>
      )}
      <div className="v2-ctxpick-wrap" ref={wrap}>
        <button className="v2-ctx-edit-btn" onClick={() => setOpen(o => !o)} title={current ? 'Cambiar contexto' : 'Añadir a contexto'}>
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2.5a1.5 1.5 0 0 1 2 2L6 15l-3 1 1-3L14.5 2.5z"/></svg>
        </button>
        {open && (
          <div className="v2-ctxpick-pop">
            <ContextPicker currentId={current?.id ?? null} onPick={id => {
              setNodeContext(node.id, id)
              if (id && node.text?.trim()) saveExample(node.text.replace(/^✦\s*/, ''), id)
              setOpen(false)
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

function V2NoteBody({ node, onSelectCtx }: { node: Node; onSelectCtx: (id: string) => void }) {
  const { t } = useTranslation()
  const [canvas, setCanvas] = useState(parseExtraData(node.extraData)._v2canvas === '1' || parseExtraData(node.extraData)._v2view === 'lienzo')
  const doc = isDocNode(node)
  // Editor UNIFICADO: todo se edita como DOCUMENTO (texto enriquecido). Las notas
  // «clásicas» (outliner con hijos, formato viejo) se abren en el outliner pero con un
  // botón «Convertir a documento» (convertNoteToBlock, reversible). Una nota sin hijos
  // se edita directamente como documento.
  const hasKids = store.children(node.id).some(n => !n.deletedAt && (n.text || '').trim())
  const asDoc = doc || !hasKids
  // `force`: es una acción EXPLÍCITA sobre ESTA nota (no una migración masiva) — se
  // convierte aunque cuelgue de un contenedor plano no-contexto. Antes fallaba en
  // SILENCIO (el botón no hacía nada) cuando `isTopConvertible` decidía que el padre
  // debía absorberla; con feedback si de verdad no se puede (bloqueante real dentro).
  const convertToDoc = () => {
    if (convertNoteToBlock(node.id, true)) toast('Convertido a documento')
    else toast('No se pudo convertir: contiene algo que no se puede migrar (revisa su contenido).', 'warning')
  }

  const setView = (c: boolean) => {
    setCanvas(c)
    const e = parseExtraData(node.extraData)
    delete e._v2view
    if (c) e._v2canvas = '1'; else delete e._v2canvas
    store.updateNode(node.id, { extraData: JSON.stringify(e) })
  }

  const toggleFavorite = () => { const next = !node.isFavorite; store.updateNode(node.id, { isFavorite: next }); toast(next ? t('tip.addFavorite') : t('tip.removeFavorite')) }
  const deleteCard = () => { store.deleteNode(node.id); toast(t('context.toastMovedToTrash', 'Movido a la papelera')); window.dispatchEvent(new Event('from:close-detail')) }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Fila única: toggle a la izquierda + acciones a la derecha */}
      <div className="v2-note-toolbar">
        <div className="v2-view-toggle">
          <button className={!canvas ? 'active' : ''} onClick={() => setView(false)}>📝 Nota</button>
          <button className={canvas ? 'active' : ''} onClick={() => setView(true)}>🎨 Lienzo</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <button title={node.isFavorite ? t('tip.removeFavorite') : t('tip.addFavorite')} onClick={toggleFavorite} style={{ ...actBtn, color: node.isFavorite ? '#f59e0b' : 'var(--text-secondary,#666)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={node.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/></svg>
          </button>
          {asDoc && !canvas && <>
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

      {/* Contexto de la nota (chips + añadir) — opcional pero siempre disponible. */}
      {!canvas && <V2NoteContext node={node} onSelectCtx={onSelectCtx} />}

      {/* Barra de formato PLANA (iconos normales) — cuando se edita como documento. */}
      {asDoc && !canvas && (
        <div className="v2-note-formatbar"><DocInspector bar /></div>
      )}

      {/* Nota clásica (outliner): aviso para migrarla al editor de documento unificado. */}
      {!asDoc && !canvas && (
        <div className="v2-convert-banner">
          <span>Esta nota usa el formato clásico (listas).</span>
          <button onClick={convertToDoc}>Convertir a documento</button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: canvas ? 'hidden' : 'auto' }}>
        {canvas
          ? <PizarraView parentId={node.id} flowUnpositioned globalCanvas={false} embedded />
          : asDoc
            ? <>
                <div style={{ padding: '18px 20px 12px' }}><DocEditorBoundary compact><DocEditor node={node} compact registerActive autofocus={false} /></DocEditorBoundary></div>
                <V2Backlinks nodeId={node.id} />
              </>
            : <Outliner parentId={node.id} autoFocusEmpty placeholder="Escribe aquí… (usa «/» para insertar tabla, kanban, calendario…)" />}
      </div>
    </div>
  )
}

// Visor de RECURSO archivo: PDF (con selección/subrayado, como v1) o imagen se
// renderizan de verdad; el resto (enlaces, libros, podcasts…) usa el ResourcePanel.
// Siempre con su contexto arriba (chip + cambiar), igual que nota/tarea.
function V2ResourceView({ node, onSelectCtx }: { node: Node; onSelectCtx: (id: string) => void }) {
  const ed = parseExtraData(node.extraData)
  const url = (ed._resourceUrl as string) || node.resourceUrl || ''
  const rawType = ((ed._resourceType as string) || node.resourceType || '').toLowerCase()
  // PDFs antiguos sin `_resourceType` → detectados por URL/nombre (mismo helper que el clasificador).
  const type = isPdfResource(node, ed) ? 'pdf' : rawType
  const key = (ed._resourceKey as string) || undefined

  if ((type !== 'pdf' && type !== 'image') || (!url && !key)) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <V2NoteContext node={node} onSelectCtx={onSelectCtx} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><ResourcePanel node={node} /></div>
      </div>
    )
  }

  // Publicar/eliminar viven en la cabecera exterior (junto al título editable, V2RightColumn)
  // — no hace falta repetir aquí el título solo para colgar esos 2 botones.
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <V2NoteContext node={node} onSelectCtx={onSelectCtx} />
      <div style={{ flex: 1, minHeight: 0, overflow: type === 'pdf' ? 'hidden' : 'auto', padding: type === 'image' ? 16 : 0 }}>
        {type === 'pdf'
          ? <PdfContainer url={url} nodeId={node.id} filename={node.text || 'PDF'} resourceKey={key} hideCanvasAction />
          : <img src={url} alt={node.text || ''} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />}
      </div>
    </div>
  )
}

export default function V2DetailView({ nodeId, onSelectCtx }: { nodeId: string; onSelectCtx: (id: string) => void }) {
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return <div className="v2-right-empty">Elemento no encontrado.</div>

  const ed = parseExtraData(node.extraData)
  const hasAudio = Array.isArray(ed._audios)
  const rt = ((node.resourceType || ed._resourceType || '') as string).toLowerCase()

  // Cualquier tipo de RECURSO (audio, PDF/imagen, o el resto — enlaces, podcasts,
  // libros…) muestra su contexto arriba (chip + cambiar), igual que nota/tarea.
  // Antes ningún recurso mostraba ni navegaba a su contexto.
  if (hasAudio || rt.includes('audio')) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <V2NoteContext node={node} onSelectCtx={onSelectCtx} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><AudioPanel nodeId={node.id} /></div>
    </div>
  )
  // PDF / imagen → visor real (con subrayado en PDF). Otros recursos → ResourcePanel.
  // `isPdfResource` cubre los PDFs antiguos sin `_resourceType:'pdf'` (detecta por URL/nombre).
  if (isPdfResource(node, ed) || rt === 'image') return <V2ResourceView node={node} onSelectCtx={onSelectCtx} />
  if (node.isResource || node.resourceType) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <V2NoteContext node={node} onSelectCtx={onSelectCtx} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><ResourcePanel node={node} /></div>
    </div>
  )
  // TAREA/EVENTO: NUNCA como documento genérico — antes caía aquí abajo (V2NoteBody)
  // con body vacío y el DocEditor le pisaba el título con «Documento» al guardar.
  if (node.status != null || node.isEvent) return <V2TaskDetailView node={node} onSelectCtx={onSelectCtx} />
  return <V2NoteBody node={node} onSelectCtx={onSelectCtx} />
}
