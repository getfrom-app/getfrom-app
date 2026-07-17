// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  isContextFollowed, setContextFollowed,
  getOrCreateContextKnowledgeDoc, nodesInContext,
  containerNotesNode, reparentContext, clearContextParent,
  firstContextOf,
} from '../../utils/cajones'
import { htmlToMarkdown } from '../../utils/htmlMarkdown'
import { parseExtraData, isInPapelera } from '../../utils/papeleraHelper'
import { isContextKnowledge } from '../../utils/knowledgeNodes'
import { legacyNotesOf, migrateContextNotesToDoc } from '../migrateContextNotes'
import { classifyElement } from '../elementKind'
import { V2NoteBody } from './V2DetailView'
import ContextPicker from '../../components/panels/ContextPicker'
import V2TaskList from './V2TaskList'
import V2QuickAddTask from './V2QuickAddTask'
import V2ElementRow from './V2ElementRow'
import { isAgentNode, getAgentData } from '../../utils/agentesHelper'
import { isPromptNode } from '../../utils/promptsHelper'
import { fmtDate, fmtRelative, fmtDateFull } from '../../utils/formatDate'
import type { Node } from '../../types'

interface Props {
  ctxId: string | null
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
  onOpenConversation?: (id: string) => void
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode, onOpenConversation }: Props) {
  const { t, i18n } = useTranslation()
  useStore()
  // General = sin contexto asignado (ctxId null). No es un nodo real: no tiene
  // padre, no se archiva, no se sigue, no tiene documento de conocimiento propio
  // — pero sí sus propias tareas/elementos (todo lo que no cuelga de ningún
  // contexto), que es lo mínimo que pidió Alberto (17 jul).
  const isGeneral = ctxId === null
  const node = isGeneral ? null : store.getNode(ctxId)
  const parent = isGeneral ? null : contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const followed = node ? isContextFollowed(node) : false
  const canArchive = !isGeneral && !!parent // solo subcontextos (las áreas no se archivan)
  // Mismo alcance que Archivar: solo subcontextos. Un contexto nace neutro (ni
  // seguido ni archivado) — «Seguir» es el opt-in explícito para que aparezca en
  // Seguimiento (tab Hoy). Sin él, es un simple contenedor de elementos (Alberto,
  // 15 jul: "Documentos personales" no necesita seguimiento; "Radio Elche" sí).
  const canFollow = !isGeneral && !!parent

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
    if (ctxId === null) return null
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
  // En General (ctxId null) no hay hijos directos que recorrer — en su lugar,
  // todas las tareas activas que no cuelgan de ningún contexto (firstContextOf null).
  const tasks = useMemo(() => {
    const isTask = (n: Node) => !n.deletedAt && (n.status != null || (n.types || []).includes('tarea'))
    if (ctxId === null) return store.allActive().filter(n => isTask(n) && !firstContextOf(n))
    return store.children(ctxId).filter(isTask)
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
    const out: { node: Node; icon: string; kind: string; isConversation?: boolean }[] = []
    const seen = new Set<string>()
    const consider = (n: Node) => {
      if (seen.has(n.id) || n.deletedAt) return
      // "Lo que Fromly sabe" ya tiene su propia sección fija más abajo (knowledgeDoc) —
      // no debe duplicarse como una fila más en Elementos. classifyElement() lo clasifica
      // como 'document' (tiene _doc:'1'), no 'note', así que sin esta exclusión explícita
      // se colaba en la lista (Alberto, 14 jul).
      if (isContextKnowledge(n.text)) return
      // Defensa extra: un nodo movido a la papelera por una vía que no reparenta (además
      // del caso normal, ya cubierto porque deja de ser hijo directo) nunca debe listarse.
      if (isInPapelera(n.id)) return
      if (isAgentNode(n)) { seen.add(n.id); out.push({ node: n, icon: getAgentData(n.id)?.icon || '🤖', kind: 'agent' }); return }
      if (isPromptNode(n)) {
        seen.add(n.id)
        let icon = '⚡'
        try { icon = JSON.parse(n.extraData || '{}')._promptIcon || '⚡' } catch { /* ignore */ }
        out.push({ node: n, icon, kind: 'prompt' })
        return
      }
      const c = classifyElement(n)
      if (!c || c.kind === 'note') return
      seen.add(n.id)
      out.push({ node: n, icon: c.icon, kind: c.kind })
    }
    if (ctxId === null) {
      // General: todo lo que no pertenece a ningún contexto real, en un único
      // barrido (no hay "hijos directos" ni "miembros por referencia" que valgan
      // aquí — el criterio es puramente firstContextOf === null).
      for (const n of store.allActive()) {
        if (seen.has(n.id) || n.deletedAt || firstContextOf(n)) continue
        const ed = parseExtraData(n.extraData)
        if (ed._aiSession === '1') {
          if (isInPapelera(n.id)) continue
          seen.add(n.id)
          out.push({ node: n, icon: '💬', kind: 'conversation', isConversation: true })
          continue
        }
        consider(n)
      }
    } else {
      for (const n of store.children(ctxId)) consider(n)      // hijos directos (incluye agentes)
      const members = nodesInContext(ctxId)
      for (const m of members) {
        consider(m)                                            // miembros por referencia
        // Recursos dentro de una conversación-miembro (PDF/imagen subidos al chat).
        if (parseExtraData(m.extraData)._aiSession === '1') {
          for (const child of store.children(m.id)) consider(child)
        }
      }
      // Conversaciones del contexto: TODOS los chats (_aiSession='1', fuera de papelera,
      // incluidas las sesiones de comando rápido — ya no se ocultan, 15 jul), filtradas a
      // las que pertenecen a ESTE contexto (firstContextOf).
      for (const n of store.allActive()) {
        if (seen.has(n.id) || n.deletedAt) continue
        const ed = parseExtraData(n.extraData)
        if (ed._aiSession !== '1') continue
        if (isInPapelera(n.id)) continue
        if (firstContextOf(n)?.id !== ctxId) continue
        seen.add(n.id)
        out.push({ node: n, icon: '💬', kind: 'conversation', isConversation: true })
      }
    }
    return out.sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtro por tipo de la lista de Elementos — mismo estilo que la tab Elementos
  // (ElementsPanel): chips en una fila con subrayado activo, solo los tipos que
  // realmente aparecen en este contexto (con su recuento).
  const [elFilter, setElFilter] = useState<string>('all')
  const ELKIND_ORDER: { key: string; label: string; icon: string }[] = [
    { key: 'document',     icon: '📝', label: t('elements.texts', 'Textos') },
    { key: 'pdf',          icon: '📄', label: t('elements.pdfs', 'PDFs') },
    { key: 'image',        icon: '🖼', label: t('elements.images', 'Imágenes') },
    { key: 'link',         icon: '🔗', label: t('elements.links', 'Enlaces') },
    { key: 'audio',        icon: '🎙', label: t('elements.audios', 'Audios') },
    { key: 'highlight',    icon: '🖍️', label: t('elements.highlights', 'Subrayados') },
    { key: 'agent',        icon: '🤖', label: t('elements.agents', 'Agentes') },
    { key: 'prompt',       icon: '⚡', label: t('elements.prompts', 'Prompts') },
    { key: 'conversation', icon: '💬', label: t('elements.conversations', 'Conversaciones') },
  ]
  const elCounts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const el of elements) acc[el.kind] = (acc[el.kind] || 0) + 1
    return acc
  }, [elements])
  const elKindChips = ELKIND_ORDER.filter(k => elCounts[k.key] > 0)
  useEffect(() => { if (elFilter !== 'all' && !elCounts[elFilter]) setElFilter('all') }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps
  const filteredElements = elFilter === 'all' ? elements : elements.filter(e => e.kind === elFilter)

  // Migración de notas antiguas → documento del contexto (no aplica a General).
  const legacyCount = ctxId === null ? 0 : legacyNotesOf(ctxId).length
  const doMigrate = () => {
    if (ctxId === null) return
    if (!window.confirm(t('v2.context.confirmMigrate', '¿Convertir {{count}} nota(s) antigua(s) de este contexto en un documento?\n\nEs reversible: los originales van a la papelera.', { count: legacyCount }))) return
    const docId = migrateContextNotesToDoc(ctxId)
    if (docId) onOpenNode(docId)
  }

  if (!isGeneral && !node) return <div className="v2-right-empty">{t('v2.context.notFound', 'Contexto no encontrado.')}</div>

  return (
    <div>
      {/* Título del contexto — antes no se mostraba en ningún sitio de esta tab (solo
          el chip del padre). Alberto: "como título en la parte superior del tab pon el
          nombre del contexto". */}
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>
        {isGeneral ? t('v2.general', 'General') : node!.text}
      </div>

      {/* Contexto PADRE — chip navegable + cambiar/quitar (mismo patrón que el resto).
          General no tiene padre ni se archiva/sigue — no es un nodo real. */}
      {!isGeneral && ctxId !== null && (
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
        {(canFollow || canArchive) && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {canFollow && (
              <button className="v2-ctx-archive-btn-inline" onClick={() => setContextFollowed(ctxId, !followed)}
                title={followed
                  ? t('v2.context.unfollowHint', 'Dejar de mostrarlo en Seguimiento (tab Hoy)')
                  : t('v2.context.followHint', 'Mostrarlo en Seguimiento (tab Hoy) para revisarlo día a día')}>
                {followed ? t('v2.context.unfollow', 'Dejar de seguir') : t('v2.context.follow', 'Seguir')}
              </button>
            )}
            {canArchive && (
              <button className="v2-ctx-archive-btn-inline" onClick={() => setContextClosed(ctxId, !closed)}
                title={closed ? t('v2.context.restoreToTree', 'Devolver al árbol de contextos') : t('v2.context.removeFromTree', 'Sacar del árbol (sigue buscable y en el RAG)')}>
                {closed ? t('v2.context.unarchive', 'Desarchivar') : t('v2.context.archive', 'Archivar')}
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Migración: notas antiguas del contexto → un documento colgado del contexto. */}
      {legacyCount > 0 && (
        <button className="v2-ctx-migrate-btn" onClick={doMigrate}>
          {t('v2.context.convertLegacyNotes', 'Convertir {{count}} nota(s) antigua(s) en documento', { count: legacyCount })}
        </button>
      )}

      {/* Lo que Fromly sabe — bloque ÚNICO fusionado (memoria de la IA + notas libres
          del usuario): EL MISMO editor completo que cualquier nota (favorito, exportar,
          cabeceras, formato…), no una versión reducida. Fromly añade hechos aquí
          automáticamente (maybeUpdateContextKnowledge) y el usuario puede escribir con
          la misma comodidad que en cualquier documento. Sin cabecera ni fila de acciones
          propia (Alberto: no hace falta título "Lo que Fromly sabe" ni sus botones) —
          es la descripción viva del contexto, va justo debajo del título y antes de
          tareas/elementos, no al final. General no tiene documento de conocimiento
          propio (no es un nodo real). */}
      {knowledgeDoc && (
        <>
          {!!knowledgeDoc.body && knowledgeDoc.body.trim() !== '<p></p>' && (
            <div
              style={{ fontSize: 11, color: 'var(--text-tertiary,#999)', marginBottom: 4 }}
              title={fmtDateFull(knowledgeDoc.updatedAt, i18n.language)}
            >
              {t('v2.context.knowledgeUpdated', 'Actualizado')} {fmtRelative(knowledgeDoc.updatedAt, i18n.language)}
            </div>
          )}
          <V2NoteBody node={knowledgeDoc} onSelectCtx={onSelectCtx} inlinePage hideContext hideToolbar />
        </>
      )}

      {/* Tareas del contexto — estilo Hoy. */}
      <div className="v2-section-label" style={{ padding: '18px 0 6px' }}>
        <span>{t('v2.context.tasks', 'Tareas')}</span>
      </div>
      <V2TaskList tasks={tasks} />
      {/* Añadir tarea rápida cuelga la tarea del contexto — en General no hay un
          nodo real del que colgarla, así que se omite (la lista sigue viéndose). */}
      {ctxId !== null && <V2QuickAddTask parentId={ctxId} />}

      {/* Elementos del contexto: documentos, archivos, audios, enlaces, AGENTES y
          CONVERSACIONES — todo junto, ordenado de más reciente a más antigua, cada
          uno con su icono. */}
      {elements.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>{t('v2.context.elements', 'Elementos')} ({elements.length})</div>
          {elKindChips.length > 1 && (
            <div className="el-filterbar" style={{ marginBottom: 4 }}>
              {[{ key: 'all', icon: '', label: t('elements.all', 'Todos') }, ...elKindChips].map(c => {
                const active = elFilter === c.key
                const n = c.key === 'all' ? elements.length : elCounts[c.key]
                return (
                  <button key={c.key} onClick={() => setElFilter(c.key)}
                    style={{
                      flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px 0',
                      fontSize: 12.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                      color: active ? 'var(--accent,#3E5C76)' : 'var(--text-tertiary,#999)',
                      borderBottom: '2px solid ' + (active ? 'var(--accent,#3E5C76)' : 'transparent'),
                    }}>
                    {c.icon ? c.icon + ' ' : ''}{c.label} <span style={{ opacity: 0.55, fontWeight: 400 }}>{n}</span>
                  </button>
                )
              })}
            </div>
          )}
          {filteredElements.map(({ node: n, icon, isConversation }) => {
            const agentData = isAgentNode(n) ? getAgentData(n.id) : null
            return (
              <V2ElementRow
                key={n.id}
                node={n}
                icon={icon}
                onOpen={id => (isConversation && onOpenConversation ? onOpenConversation(id) : onOpenNode(id))}
                hideContext
                extraMeta={agentData ? (agentData.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')) : fmtDate(n.updatedAt, i18n.language)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
