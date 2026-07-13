// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  getOrCreateContextKnowledgeDoc, nodesInContext,
  containerNotesNode, reparentContext, clearContextParent,
  firstContextOf,
} from '../../utils/cajones'
import { htmlToMarkdown } from '../../utils/htmlMarkdown'
import { isQuickCommandSession } from '../../store/aiChatStore'
import { parseExtraData, isInPapelera } from '../../utils/papeleraHelper'
import { legacyNotesOf, migrateContextNotesToDoc } from '../migrateContextNotes'
import { classifyElement } from '../elementKind'
import { V2NoteBody } from './V2DetailView'
import ContextPicker from '../../components/panels/ContextPicker'
import V2TaskList from './V2TaskList'
import V2QuickAddTask from './V2QuickAddTask'
import V2ElementRow from './V2ElementRow'
import { isAgentNode, getAgentData } from '../../utils/agentesHelper'
import { isPromptNode } from '../../utils/promptsHelper'
import type { Node } from '../../types'

interface Props {
  ctxId: string
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
  onOpenConversation?: (id: string) => void
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode, onOpenConversation }: Props) {
  const { t } = useTranslation()
  useStore()
  const node = store.getNode(ctxId)
  const parent = contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const canArchive = !!parent // solo subcontextos (las áreas no se archivan)

  // Contexto PADRE — picker inline (mismo patrón que «Cambiar contexto» de nota/tarea).
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const parentPickWrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!parentPickerOpen) return
    const onDoc = (e: MouseEvent) => { if (parentPickWrap.current && !parentPickWrap.current.contains(e.target as HTMLElement)) setParentPickerOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [parentPickerOpen])
  // Un contexto no puede colgar de sí mismo ni de uno de sus propios descendientes (ciclo).
  const isDescendantOf = (candidateId: string) => {
    let cur: Node | null | undefined = store.getNode(candidateId)
    let guard = 0
    while (cur && guard++ < 60) { if (cur.id === ctxId) return true; cur = cur.parentId ? store.getNode(cur.parentId) : null }
    return false
  }

  // «Lo que Fromly sabe» — documento unificado (memoria de la IA + notas libres del
  // usuario en un único bloque, Alberto: "debería quedarse, pero en formato nota").
  // getOrCreateContextKnowledgeDoc migra automáticamente el formato antiguo (hijos-
  // línea) la primera vez que se abre el contexto. Get-or-create UNA vez por
  // contexto (no en cada render), igual que notesNode antes.
  const knowledgeDoc = useMemo(() => {
    const doc = getOrCreateContextKnowledgeDoc(ctxId)
    // Fusión con las "Notas" antiguas (ahora eliminadas de la UI de contexto): si el
    // usuario ya había escrito algo en el bloque "📝 Notas" separado y el nuevo
    // documento de conocimiento está vacío, usamos las Notas como base (no perder lo
    // ya escrito). Si AMBOS tienen contenido, se concatenan con un separador claro
    // — decisión: preferimos no perder ningún texto ya escrito antes que decidir
    // arbitrariamente cuál "gana". Se ejecuta una sola vez (idempotente: las Notas
    // legado quedan vacías tras la fusión, así no se repite en próximas aperturas).
    const legacyNotes = containerNotesNode(ctxId)
    const legacyText = legacyNotes ? htmlToMarkdown(legacyNotes.body || '').trim() : ''
    if (legacyText) {
      const currentText = htmlToMarkdown(doc.body || '').trim()
      const mergedHtml = currentText
        ? `${doc.body || ''}<p>---</p>${legacyNotes!.body || ''}`
        : (legacyNotes!.body || '<p></p>')
      store.updateNode(doc.id, { body: mergedHtml })
      store.updateNode(legacyNotes!.id, { body: '<p></p>' })
    }
    return store.getNode(doc.id)!
  }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps

  // TAREAS del contexto (hijas directas con estado/tipo tarea), estilo Hoy.
  const tasks = useMemo(() => {
    return store.children(ctxId).filter(n => !n.deletedAt && (n.status != null || (n.types || []).includes('tarea')))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ELEMENTOS del contexto: TODO lo que cuelga de él — documentos, PDF, imágenes,
  // enlaces, audios, AGENTES y CONVERSACIONES — en una única lista, cada uno con su
  // icono, ordenada de más reciente a más antigua. Antes iban en bloques separados
  // (Elementos/Agentes/Conversaciones); Alberto pidió fusionarlos: "deberían aparecer
  // junto y organizado de más reciente más antiguo, cada elemento con su icono".
  // Las notas de texto planas se omiten (las gestiona la migración, para no volver a
  // llenar la columna) y las tareas tienen su propia lista arriba (con due/checkbox).
  const elements = useMemo(() => {
    void store.nodesVersion
    const out: { node: Node; icon: string; isConversation?: boolean }[] = []
    const seen = new Set<string>()
    const consider = (n: Node) => {
      if (seen.has(n.id) || n.deletedAt) return
      if (isAgentNode(n)) { seen.add(n.id); out.push({ node: n, icon: getAgentData(n.id)?.icon || '🤖' }); return }
      if (isPromptNode(n)) {
        seen.add(n.id)
        let icon = '⚡'
        try { icon = JSON.parse(n.extraData || '{}')._promptIcon || '⚡' } catch { /* ignore */ }
        out.push({ node: n, icon })
        return
      }
      const c = classifyElement(n)
      if (!c || c.kind === 'note') return
      seen.add(n.id)
      out.push({ node: n, icon: c.icon })
    }
    for (const n of store.children(ctxId)) consider(n)      // hijos directos (incluye agentes)
    const members = nodesInContext(ctxId)
    for (const m of members) {
      consider(m)                                            // miembros por referencia
      // Recursos dentro de una conversación-miembro (PDF/imagen subidos al chat).
      if (parseExtraData(m.extraData)._aiSession === '1') {
        for (const child of store.children(m.id)) consider(child)
      }
    }
    // Conversaciones del contexto: mismas reglas que el Historial (_aiSession='1',
    // fuera de papelera, sin sesiones de comando rápido de 1 turno), filtradas a las
    // que pertenecen a ESTE contexto (firstContextOf).
    for (const n of store.allActive()) {
      if (seen.has(n.id) || n.deletedAt) continue
      const ed = parseExtraData(n.extraData)
      if (ed._aiSession !== '1') continue
      if (isInPapelera(n.id)) continue
      if (isQuickCommandSession(n.id)) continue
      if (firstContextOf(n)?.id !== ctxId) continue
      seen.add(n.id)
      out.push({ node: n, icon: '💬', isConversation: true })
    }
    return out.sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Migración de notas antiguas → documento del contexto.
  const legacyCount = legacyNotesOf(ctxId).length
  const doMigrate = () => {
    if (!window.confirm(t('v2.context.confirmMigrate', '¿Convertir {{count}} nota(s) antigua(s) de este contexto en un documento?\n\nEs reversible: los originales van a la papelera.', { count: legacyCount }))) return
    const docId = migrateContextNotesToDoc(ctxId)
    if (docId) onOpenNode(docId)
  }

  if (!node) return <div className="v2-right-empty">{t('v2.context.notFound', 'Contexto no encontrado.')}</div>

  return (
    <div>
      {/* Contexto PADRE — chip navegable + cambiar/quitar (mismo patrón que el resto). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {parent ? (
          <span className="v2-chip" style={{ ['--chip' as string]: contextColor(parent.id), cursor: 'default' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => onSelectCtx(parent.id)}>{parent.text}</span>
          </span>
        ) : null}
        <div className="v2-ctxpick-wrap" ref={parentPickWrap}>
          <button className="v2-ctx-edit-btn" onClick={() => setParentPickerOpen(o => !o)} title={parent ? t('v2.context.changeParent', 'Cambiar contexto padre') : t('v2.context.addParent', 'Añadir contexto padre')}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2.5a1.5 1.5 0 0 1 2 2L6 15l-3 1 1-3L14.5 2.5z"/></svg>
          </button>
          {parentPickerOpen && (
            <div className="v2-ctxpick-pop">
              <ContextPicker
                currentId={parent?.id ?? null}
                exclude={c => c.id === ctxId || isDescendantOf(c.id)}
                onPick={id => {
                  if (id) reparentContext(ctxId, id)
                  else clearContextParent(ctxId)
                  setParentPickerOpen(false)
                }}
              />
            </div>
          )}
        </div>
        {!parent && <span className="v2-el-meta">{t('v2.context.noParent', 'Sin contexto padre')}</span>}
      </div>

      {/* Migración: notas antiguas del contexto → un documento colgado del contexto. */}
      {legacyCount > 0 && (
        <button className="v2-ctx-migrate-btn" onClick={doMigrate}>
          {t('v2.context.convertLegacyNotes', 'Convertir {{count}} nota(s) antigua(s) en documento', { count: legacyCount })}
        </button>
      )}

      {/* Tareas del contexto — estilo Hoy. La acción «archivar» queda discreta a la derecha. */}
      <div className="v2-section-label" style={{ padding: '2px 0 6px' }}>
        <span>{t('v2.context.tasks', 'Tareas')}</span>
        {canArchive && (
          <button className="v2-ctx-archive-link" onClick={() => setContextClosed(ctxId, !closed)}
            title={closed ? t('v2.context.restoreToTree', 'Devolver al árbol de contextos') : t('v2.context.removeFromTree', 'Sacar del árbol (sigue buscable y en el RAG)')}>
            {closed ? t('v2.context.unarchive', 'Desarchivar') : t('v2.context.archive', 'Archivar')}
          </button>
        )}
      </div>
      <V2TaskList tasks={tasks} />
      <V2QuickAddTask parentId={ctxId} />

      {/* Elementos del contexto: documentos, archivos, audios, enlaces, AGENTES y
          CONVERSACIONES — todo junto, ordenado de más reciente a más antigua, cada
          uno con su icono. */}
      {elements.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>{t('v2.context.elements', 'Elementos')} ({elements.length})</div>
          {elements.map(({ node: n, icon, isConversation }) => {
            const agentData = isAgentNode(n) ? getAgentData(n.id) : null
            return (
              <V2ElementRow
                key={n.id}
                node={n}
                icon={icon}
                onOpen={id => (isConversation && onOpenConversation ? onOpenConversation(id) : onOpenNode(id))}
                hideContext
                extraMeta={agentData ? (agentData.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')) : undefined}
              />
            )
          })}
        </>
      )}

      {/* Lo que Fromly sabe — bloque ÚNICO fusionado (memoria de la IA + notas libres
          del usuario): EL MISMO editor completo que cualquier nota (toggle Nota/Lienzo,
          favorito, exportar, cabeceras, formato…), no una versión reducida. Fromly
          añade hechos aquí automáticamente (appendContextFacts) y el usuario puede
          escribir con la misma comodidad que en cualquier documento. */}
      <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>🧠 {t('v2.context.whatFromlyKnows', 'Lo que Fromly sabe')}</div>
        <V2NoteBody node={knowledgeDoc} onSelectCtx={onSelectCtx} inlinePage hideContext />
      </div>
    </div>
  )
}
