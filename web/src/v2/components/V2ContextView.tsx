// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  readContextKnowledge, writeContextKnowledge,
} from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import { isDocNode } from '../../utils/docNode'
import { legacyNotesOf, migrateContextNotesToDoc } from '../migrateContextNotes'
import Outliner from '../../components/outliner/Outliner'
import type { Node } from '../../types'

interface Props {
  ctxId: string
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
}

// ¿Es un hijo «estructural» (no tarea) que NUNCA debe salir en la lista de tareas?
function isStructural(n: Node): boolean {
  const ed = parseExtraData(n.extraData)
  return ed._ctx === '1' || ed._aiSession === '1' || ed._aiTranscript === '1' || !!ed._aiMsgRole
    || Array.isArray(ed._audios) || ed._doc === '1' || !!n.isResource || !!n.resourceType
    || (n.types || []).includes('evento') || !!n.isEvent
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode }: Props) {
  useStore()
  const node = store.getNode(ctxId)
  const parent = contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const canArchive = !!parent // solo subcontextos (las áreas no se archivan)

  // «Lo que Fromly sabe» — editable, se guarda al perder el foco.
  const [know, setKnow] = useState('')
  useEffect(() => { setKnow(readContextKnowledge(ctxId)) }, [ctxId])

  // La columna de contexto muestra SOLO las TAREAS (+ lo que Fromly sabe abajo).
  // Se ocultan: (a) reactivamente lo estructural (documentos, recursos, subcontextos,
  // sesiones, eventos…) — incluido un documento recién creado por la migración; y
  // (b) por SNAPSHOT al abrir, las notas de texto antiguas (el volcado de descripción).
  // Así lo que el usuario ESCRIBE nuevo (una tarea) sí aparece.
  const notesSnapshot = useMemo(() => {
    const s = new Set<string>()
    for (const n of store.children(ctxId)) {
      if (n.deletedAt) continue
      const isTask = n.status != null || (n.types || []).includes('tarea')
      if (!isTask && !isStructural(n) && !isDocNode(n)) s.add(n.id)
    }
    return s
  }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps

  const excludeIds = useMemo(() => {
    const s = new Set<string>(notesSnapshot)
    for (const n of store.children(ctxId)) {
      if (n.deletedAt) continue
      const isTask = n.status != null || (n.types || []).includes('tarea')
      if (!isTask && (isStructural(n) || isDocNode(n))) s.add(n.id)
    }
    return s
  }, [ctxId, store.nodesVersion, notesSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  // ELEMENTOS del contexto: documentos, archivos (PDF/imagen), enlaces, audios.
  // (Las notas de texto planas antiguas NO — esas se convierten con la migración.)
  const elements = useMemo(() => {
    const out: { node: Node; icon: string; label: string }[] = []
    for (const n of store.children(ctxId)) {
      if (n.deletedAt || !n.text) continue
      const ed = parseExtraData(n.extraData)
      if (ed._aiSession === '1' || ed._aiTranscript === '1' || ed._aiMsgRole) continue
      if (ed._ctx === '1') continue
      if (n.status != null || (n.types || []).includes('tarea')) continue
      if ((n.types || []).includes('evento') || n.isEvent) continue
      const rt = (n.resourceType || '').toLowerCase()
      if (isDocNode(n) || ed._doc === '1') out.push({ node: n, icon: '📝', label: 'Documento' })
      else if (n.isResource || n.resourceType) {
        if (rt.includes('pdf')) out.push({ node: n, icon: '📄', label: 'PDF' })
        else if (rt.includes('image') || rt.includes('img')) out.push({ node: n, icon: '🖼', label: 'Imagen' })
        else out.push({ node: n, icon: '🔗', label: 'Enlace' })
      } else if (Array.isArray(ed._audios)) out.push({ node: n, icon: '🎙', label: 'Audio' })
      // notas de texto planas → se omiten (las gestiona la migración)
    }
    return out.sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Migración de notas antiguas → documento del contexto.
  const legacyCount = legacyNotesOf(ctxId).length
  const doMigrate = () => {
    if (!window.confirm(`¿Convertir ${legacyCount} nota(s) antigua(s) de este contexto en un documento?\n\nEs reversible: los originales van a la papelera.`)) return
    const docId = migrateContextNotesToDoc(ctxId)
    if (docId) onOpenNode(docId)
  }

  if (!node) return <div className="v2-right-empty">Contexto no encontrado.</div>

  return (
    <div>
      {/* Cabecera: nombre + padre + archivar */}
      <div className="v2-ctx-head">
        <div className="v2-ctx-head-title">
          <span className="v2-ctx-dot" style={{ background: contextColor(ctxId) }} />
          <span className="v2-el-title" style={{ fontWeight: 700, fontSize: 15 }}>{node.text || 'Contexto'}</span>
        </div>
        <div className="v2-ctx-head-meta">
          {parent
            ? <button className="v2-ctx-parent" onClick={() => onSelectCtx(parent.id)}>en {parent.text}</button>
            : <span className="v2-el-meta">Área</span>}
          {closed && <span className="v2-ctx-badge-archived">Archivado</span>}
        </div>
        {canArchive && (
          <button
            className="v2-ctx-archive-btn"
            onClick={() => setContextClosed(ctxId, !closed)}
            title={closed ? 'Devolver al árbol de contextos' : 'Sacar del árbol (sigue buscable y en el RAG)'}
          >
            {closed ? '↩︎ Desarchivar' : '🗄 Archivar'}
          </button>
        )}
      </div>

      {/* Migración: notas antiguas del contexto → un documento colgado del contexto. */}
      {legacyCount > 0 && (
        <button className="v2-ctx-migrate-btn" onClick={doMigrate}>
          📄 Convertir {legacyCount} nota{legacyCount > 1 ? 's' : ''} antigua{legacyCount > 1 ? 's' : ''} en documento
        </button>
      )}

      {/* Tareas del contexto = OUTLINER REAL de la v1 (checkbox, ghost text, magic
          verbo→tarea, chips). Se ocultan el texto antiguo/subcontextos vía excludeIds. */}
      <div className="v2-section-label" style={{ padding: '14px 0 4px' }}>Tareas</div>
      <div className="v2-ctx-outliner">
        <Outliner parentId={ctxId} excludeIds={excludeIds} autoFocusEmpty placeholder="Escribe una tarea…" />
      </div>

      {/* Elementos del contexto (documentos, archivos, audios, enlaces) */}
      {elements.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>Elementos ({elements.length})</div>
          {elements.map(({ node: n, icon, label }) => (
            <div className="v2-el-row" key={n.id} onClick={() => onOpenNode(n.id)}>
              <span className="v2-el-icon">{icon}</span>
              <span className="v2-el-main"><span className="v2-el-title">{n.text}</span><span className="v2-el-meta">{label}</span></span>
            </div>
          ))}
        </>
      )}

      {/* Lo que Fromly sabe — al final del todo */}
      <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div className="v2-section-label" style={{ padding: '0 0 6px' }}>🧠 Lo que Fromly sabe</div>
        <textarea
          className="v2-know-area"
          value={know}
          placeholder="Describe este contexto para que Fromly lo entienda mejor… (Fromly también lo completa solo)"
          onChange={(e) => setKnow(e.target.value)}
          onBlur={() => writeContextKnowledge(ctxId, know)}
        />
      </div>
    </div>
  )
}
