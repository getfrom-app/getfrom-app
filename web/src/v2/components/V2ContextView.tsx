// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  readContextKnowledge, writeContextKnowledge, nodesInContext,
  readContainerNotes, writeContainerNotes,
} from '../../utils/cajones'
import { parseExtraData } from '../../utils/papeleraHelper'
import { legacyNotesOf, migrateContextNotesToDoc } from '../migrateContextNotes'
import { classifyElement } from '../elementKind'
import V2TaskList from './V2TaskList'
import V2QuickAddTask from './V2QuickAddTask'
import V2ElementRow from './V2ElementRow'
import type { Node } from '../../types'

interface Props {
  ctxId: string
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
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

  // «Notas» — espacio de escritura LIBRE del usuario (no memoria de la IA): apuntes,
  // comentarios, lo que sea. Mismo patrón que «Lo que Fromly sabe» pero es OTRO nodo.
  const [notes, setNotes] = useState('')
  useEffect(() => { setNotes(readContainerNotes(ctxId)) }, [ctxId])

  // TAREAS del contexto (hijas directas con estado/tipo tarea), estilo Hoy.
  const tasks = useMemo(() => {
    return store.children(ctxId).filter(n => !n.deletedAt && (n.status != null || (n.types || []).includes('tarea')))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ELEMENTOS del contexto: TODOS los archivos/recursos asociados — documentos, PDF,
  // imágenes, enlaces, audios — vengan como hijos directos del contexto, como miembros
  // por referencia (_ctxRefs/tag), o DENTRO de una conversación que pertenece al contexto
  // (p.ej. un PDF subido a un chat de este contexto). Las notas de texto planas se omiten
  // (las gestiona la migración, para no volver a llenar la columna).
  const elements = useMemo(() => {
    void store.nodesVersion
    const out: { node: Node; icon: string; label: string }[] = []
    const seen = new Set<string>()
    const consider = (n: Node) => {
      if (seen.has(n.id) || n.deletedAt) return
      const c = classifyElement(n)
      if (!c || c.kind === 'note') return
      seen.add(n.id)
      out.push({ node: n, icon: c.icon, label: c.label })
    }
    for (const n of store.children(ctxId)) consider(n)      // hijos directos
    const members = nodesInContext(ctxId)
    for (const m of members) {
      consider(m)                                            // miembros por referencia
      // Recursos dentro de una conversación-miembro (PDF/imagen subidos al chat).
      if (parseExtraData(m.extraData)._aiSession === '1') {
        for (const child of store.children(m.id)) consider(child)
      }
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
      {/* Migración: notas antiguas del contexto → un documento colgado del contexto. */}
      {legacyCount > 0 && (
        <button className="v2-ctx-migrate-btn" onClick={doMigrate}>
          Convertir {legacyCount} nota{legacyCount > 1 ? 's' : ''} antigua{legacyCount > 1 ? 's' : ''} en documento
        </button>
      )}

      {/* Tareas del contexto — estilo Hoy. La acción «archivar» queda discreta a la derecha. */}
      <div className="v2-section-label" style={{ padding: '2px 0 6px' }}>
        <span>Tareas</span>
        {canArchive && (
          <button className="v2-ctx-archive-link" onClick={() => setContextClosed(ctxId, !closed)}
            title={closed ? 'Devolver al árbol de contextos' : 'Sacar del árbol (sigue buscable y en el RAG)'}>
            {closed ? 'Desarchivar' : 'Archivar'}
          </button>
        )}
      </div>
      <V2TaskList tasks={tasks} />
      <V2QuickAddTask parentId={ctxId} />

      {/* Elementos del contexto (documentos, archivos, audios, enlaces) */}
      {elements.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>Elementos ({elements.length})</div>
          {elements.map(({ node: n, icon }) => (
            <V2ElementRow key={n.id} node={n} icon={icon} onOpen={onOpenNode} hideContext />
          ))}
        </>
      )}

      {/* Notas — espacio de escritura libre del usuario para este contexto. */}
      <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div className="v2-section-label" style={{ padding: '0 0 6px' }}>📝 Notas</div>
        <textarea
          className="v2-know-area"
          value={notes}
          placeholder="Escribe aquí lo que quieras sobre este contexto…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => writeContainerNotes(ctxId, notes)}
        />
      </div>

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
