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
import V2AgentDetailView from './V2AgentDetailView'
import V2PromptDetailView from './V2PromptDetailView'
import { isAgentNode } from '../../utils/agentesHelper'
import { isPromptNode } from '../../utils/promptsHelper'
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
  const { t } = useTranslation()
  const links = useMemo(() => {
    const needle = `/node/${nodeId}`
    return store.allActive().filter(n => n.id !== nodeId && !n.deletedAt && (n.body || '').includes(needle))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, store.nodesVersion])
  if (!links.length) return null
  return (
    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 20px 40px', paddingTop: 14 }}>
      <div className="v2-section-label" style={{ padding: '0 0 6px' }}>{t('v2.linkedFromCount', 'Enlazado desde ({{count}})', { count: links.length })}</div>
      {links.map(n => (
        <div className="v2-el-row" key={n.id} onClick={() => window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: n.id } }))}>
          <span className="v2-el-icon">📝</span>
          <span className="v2-el-main"><span className="v2-el-title">{(n.text || '').replace(/^[✦💬]\s*/u, '') || t('v2.untitled', 'Sin título')}</span></span>
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
  const { t } = useTranslation()
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
        <button className="v2-ctx-edit-btn" onClick={() => setOpen(o => !o)} title={current ? t('v2.changeContext', 'Cambiar contexto') : t('v2.addToContext', 'Añadir a contexto')}>
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

// Exportado: V2ContextView/V2ConversationView/V2TaskDetailView lo reutilizan TAL
// CUAL para su editor de «Notas» (Alberto: «quiero un editor de nota como este,
// como el de cualquier nota» — no una versión reducida aparte). `inlinePage`: vive
// DENTRO de una página más larga que ya scrollea (sin `height:100%`, que solo
// tiene sentido cuando ES el contenido único de la columna derecha) — el modo
// Lienzo pasa a tener una altura fija (necesita un viewport acotado). `hideContext`:
// oculta el chip de contexto propio del editor — cuando la nota es las «Notas» DE
// un contexto/conversación/tarea concretos, ese contexto ya se muestra arriba en
// esa misma vista (mostrarlo también aquí es redundante, o incluso otra cosa: el
// contexto de la nota-hija no tiene por qué coincidir con el de su contenedor).
export function V2NoteBody({ node, onSelectCtx, inlinePage, hideContext }: { node: Node; onSelectCtx: (id: string) => void; inlinePage?: boolean; hideContext?: boolean }) {
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
    if (convertNoteToBlock(node.id, true)) toast(t('v2.convertedToDocument', 'Convertido a documento'))
    else toast(t('v2.convertFailed', 'No se pudo convertir: contiene algo que no se puede migrar (revisa su contenido).'), 'warning')
  }

  // Nota y Lienzo comparten el mismo `body` en el nodo (el lienzo lo usa como bloque
  // ```from-pizarra```, el documento como HTML) — sin guardarlos aparte, cambiar de
  // modo pisaba uno con el otro (p.ej. abrir Lienzo y volver a Nota dejaba el JSON del
  // lienzo como texto plano, y hasta como título). Al cambiar de modo, guardamos el
  // `body` que dejamos atrás en extraData y restauramos el de la última vez en ese modo.
  const setView = (c: boolean) => {
    const e = parseExtraData(node.extraData)
    delete e._v2view
    const leftBehind = node.body || ''
    if (c) {
      e._v2docBody = leftBehind
      e._v2canvas = '1'
      const restored = typeof e._v2canvasBody === 'string' ? e._v2canvasBody : ''
      delete e._v2canvasBody
      store.updateNode(node.id, { extraData: JSON.stringify(e), body: restored })
    } else {
      e._v2canvasBody = leftBehind
      delete e._v2canvas
      const restored = typeof e._v2docBody === 'string' ? e._v2docBody : ''
      delete e._v2docBody
      store.updateNode(node.id, { extraData: JSON.stringify(e), body: restored })
    }
    setCanvas(c)
  }

  const toggleFavorite = () => { const next = !node.isFavorite; store.updateNode(node.id, { isFavorite: next }); toast(next ? t('tip.addFavorite') : t('tip.removeFavorite')) }
  const deleteCard = () => { store.deleteNode(node.id); toast(t('context.toastMovedToTrash', 'Movido a la papelera')); window.dispatchEvent(new Event('from:close-detail')) }

  return (
    <div style={inlinePage ? undefined : { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Fila única: toggle a la izquierda + acciones a la derecha */}
      <div className="v2-note-toolbar">
        <div className="v2-view-toggle">
          <button title={t('tip.viewAsNote')} className={!canvas ? 'active' : ''} onClick={() => setView(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          </button>
          <button title={t('tip.viewAsCanvas')} className={canvas ? 'active' : ''} onClick={() => setView(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </button>
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
      {!canvas && !hideContext && <V2NoteContext node={node} onSelectCtx={onSelectCtx} />}

      {/* Barra de formato PLANA (iconos normales) — cuando se edita como documento. */}
      {asDoc && !canvas && (
        <div className="v2-note-formatbar"><DocInspector bar /></div>
      )}

      {/* Nota clásica (outliner): aviso para migrarla al editor de documento unificado. */}
      {!asDoc && !canvas && (
        <div className="v2-convert-banner">
          <span>{t('v2.classicNoteFormat', 'Esta nota usa el formato clásico (listas).')}</span>
          <button onClick={convertToDoc}>{t('v2.convertToDocument', 'Convertir a documento')}</button>
        </div>
      )}

      <div style={inlinePage
        ? { position: 'relative', overflow: canvas ? 'hidden' : 'visible', height: canvas ? 480 : undefined, minHeight: canvas ? 480 : undefined }
        : { flex: 1, minHeight: 0, position: 'relative', overflow: canvas ? 'hidden' : 'auto' }}>
        {canvas
          ? <PizarraView parentId={node.id} flowUnpositioned globalCanvas={false} embedded />
          : asDoc
            ? <>
                <div style={{ padding: '18px 20px 12px' }}><DocEditorBoundary compact><DocEditor node={node} compact registerActive autofocus={false} /></DocEditorBoundary></div>
                <V2Backlinks nodeId={node.id} />
              </>
            : <Outliner parentId={node.id} autoFocusEmpty placeholder={t('v2.outlinerPlaceholder', 'Escribe aquí… (usa «/» para insertar tabla, kanban, calendario…)')} />}
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
  const { t } = useTranslation()
  const node = store.getNode(nodeId)
  if (!node) return <div className="v2-right-empty">{t('v2.elementNotFound', 'Elemento no encontrado.')}</div>

  const ed = parseExtraData(node.extraData)
  const hasAudio = Array.isArray(ed._audios)
  const rt = ((node.resourceType || ed._resourceType || '') as string).toLowerCase()

  // AGENTE: nunca como nota genérica ni como tarea — vista propia (prompt editable +
  // propiedades reales de AgentPropertiesPanel de v1). Se comprueba ANTES que el resto
  // de ramas porque un agente no es tarea/evento/recurso.
  if (isAgentNode(node)) return <V2AgentDetailView node={node} onSelectCtx={onSelectCtx} />

  // PROMPT: nunca como nota genérica — vista propia (contenido outliner editable +
  // propiedades reales de PromptPropertiesPanel de v1). Se comprueba junto al agente,
  // antes que el resto de ramas.
  if (isPromptNode(node)) return <V2PromptDetailView node={node} onSelectCtx={onSelectCtx} />

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
