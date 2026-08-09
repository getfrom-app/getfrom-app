// Sidebar de Fromly 2.0 — contextos (= proyectos) con navegación drill-down.
// Nivel raíz = ÁREAS (hijos directos de 🧠 Contexto) + General. Clic en un
// contexto: lo selecciona (la app reacciona) Y hace zoom-in a sus subcontextos
// en la misma columna, con botón de volver.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { isRootContext, isMarkedContext, isContextClosed, contextColor, contextParent, reparentContext, listContextsForParent, getOrCreateContextKnowledgeDoc } from '../../utils/cajones'
import { listPendingAgentConversations, listUnseenAgentResults } from '../../store/aiChatStore'
import { useTheme } from '../../hooks/useTheme'
import { clearTokens } from '../../api/client'
import V2Trash from './V2Trash'
import NewContextModal from '../../components/modals/NewContextModal'
import NewTaskModal from '../../components/modals/NewTaskModal'
import Icon from './Icon'
import { displayTitle } from '../../utils/displayText'
import { isProfileChatSession } from '../profileChat'
import type { Node } from '../../types'

// Misma paleta que el menú de clic derecho de un contexto en la Pizarra (v1) —
// escribe extraData._tagColor, que contextColor() ya lee con prioridad sobre
// el heredado/acento por defecto.
// Industriales primero (misma paleta que Ajustes → Apariencia), variedad después.
// Sin morado/violeta/lila en ningún tono — ver feedback "quitar el morado de todos los sitios".
const ACCENT_SWATCHES = ['#3E5C76', '#B8491F', '#37474F', '#2F5233', '#4A3B5C', '#A67C27', '#722F37', '#1B4B5A', '#e03131', '#f76707', '#2f9e44', '#1971c2', '#e64980', '#495057']

function setContextAccentColor(id: string, color: string) {
  const n = store.getNode(id); if (!n) return
  let eo: Record<string, unknown> = {}; try { eo = JSON.parse(n.extraData || '{}') } catch { /* noop */ }
  eo._tagColor = color
  store.updateNode(id, { extraData: JSON.stringify(eo) })
}

interface Props {
  selectedCtxId: string | null
  onSelectCtx: (id: string | null) => void
  // Destinos globales (rediseño 5 ago 2026): Chat/Agenda/Elementos/Día viven al
  // mismo nivel que un contexto en vez de tabs de la columna derecha — no
  // describen "lo seleccionado", son vistas de toda la app. `activeGeneralDest`
  // resalta la fila activa (null = ninguno, p.ej. hay un contexto real elegido).
  onSelectGeneral: (dest: 'dia' | 'agenda' | 'chat' | 'elementos') => void
  activeGeneralDest: 'dia' | 'agenda' | 'chat' | 'elementos' | null
  // id=null desde el menú GLOBAL (bajo "Nueva conversación") crea sin contexto
  // (General) — Alberto, 22 jul: "todos ellos se deben poder crear desde aquí".
  onNewChatInCtx: (id: string | null) => void
  // Botones de creación por contexto — nota/lienzo (Alberto, 22 jul: "botones de
  // creación de elementos en el sidebar"). Tarea/evento se crean aquí mismo con
  // NewTaskModal (ya acepta parentId), sin necesidad de subir a V2App.
  onNewNoteInCtx: (id: string | null) => void
  onNewCanvasInCtx: (id: string | null) => void
  // «Adjuntar» EN UN CONTEXTO CONCRETO — abre V2AttachModal (archivo / enlace /
  // Drive). Sustituye al antiguo `onDriveInCtx`, que solo cubría Drive.
  onOpenAttach: (id: string | null) => void
  onRecordInCtx: (id: string | null) => void
  // Mismo handler que el chat (V2App.onFilesDropped): con conversación activa se
  // adjunta ahí, si no se importa al contexto/día activo. Soltar en la sidebar ya
  // NO tiene una ruta propia por-contexto (daba error al subir; una sola ruta).
  onFilesDropped: (files: File[]) => void
  onDragStateChange?: (active: boolean) => void
  // Ajustes ahora es un modo de V2App (pantalla completa: nav a la izquierda,
  // contenido al centro), no un modal — el estado vive arriba.
  onOpenSettings: () => void
  // Abre una conversación existente (chat al centro + sus elementos a la
  // derecha) — lo usa el aviso de conversaciones pendientes de un agente.
  onOpenConversation?: (id: string) => void
  // Abre cualquier nodo (usado por el aviso de informes de agentes autónomos
  // terminados — marca el resultado como visto y lo abre, ver markAgentResultSeen).
  onOpenNode?: (id: string) => void
  // Perfil — la nota personal que Fromly tiene siempre en cuenta (metas, contexto
  // vital…). Se abre en lugar del chat (Alberto, 15 jul).
  onOpenProfile: () => void
}

// Ordena por nombre (ignorando emoji/espacios iniciales), estable.
function byName(a: Node, b: Node) {
  const clean = (s: string) => (s || '').replace(/^[^\p{L}\p{N}]+/u, '').toLocaleLowerCase('es')
  return clean(a.text).localeCompare(clean(b.text), 'es')
}

// Subcontextos (proyectos marcados) directos de un contexto.
function subContextsOf(id: string): Node[] {
  // Excluye archivados (_closed): salen del árbol pero siguen buscables + en el RAG.
  return store.children(id).filter(n => !n.deletedAt && isMarkedContext(n) && !isContextClosed(n)).sort(byName)
}

export default function V2Sidebar({ selectedCtxId, onSelectCtx, onSelectGeneral, activeGeneralDest, onNewChatInCtx, onNewNoteInCtx, onNewCanvasInCtx, onOpenAttach, onRecordInCtx, onFilesDropped, onDragStateChange, onOpenSettings, onOpenConversation, onOpenNode, onOpenProfile }: Props) {
  useStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useUserStore()
  const [dragOver, setDragOver] = useState(false) // resaltado visual mientras se arrastra (ya no por-contexto)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes('Files')
  const dropFiles = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault(); e.stopPropagation()
    setDragOver(false); onDragStateChange?.(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFilesDropped(files)
  }
  const { theme, setTheme } = useTheme()
  const [stack, setStack] = useState<Node[]>([]) // ruta de drill-down (padres)
  const [userMenu, setUserMenu] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  // La v1 (donde antes había que crear contextos para que "aparecieran aquí") ya no
  // existe — el sidebar de v2 necesita su propio botón para crear contextos, con
  // nombre + padre en un modal (Alberto, 21 jul).
  const [showNewContext, setShowNewContext] = useState(false)
  const userWrap = useRef<HTMLDivElement>(null)

  // Menú «＋» por contexto: nota / tarea / evento / lienzo / conversación (antes
  // el «＋» solo creaba una conversación — Alberto, 22 jul: "botones de creación
  // de elementos en el sidebar").
  // `isGlobal` = se abrió desde el botón «＋ Nuevo elemento» (barra izquierda),
  // no desde el «＋» de una fila concreta — distingue cuándo ofrecer «Contexto»
  // (raíz, Alberto 22 jul: "en el botón de nuevo elemento añade nuevo
  // contexto, que se añadirá a la raíz de contextos") además de «Subcontexto».
  const [addMenu, setAddMenu] = useState<{ id: string | null; x: number; y: number; isGlobal?: boolean } | null>(null)
  const [newTaskCtx, setNewTaskCtx] = useState<{ id: string | null } | null>(null)
  // «＋ Subcontexto»/«＋ Contexto» desde el menú «＋» (Alberto, 22 jul: "el + de
  // los chips de contexto debe añadir además nuevo subcontexto... crea un
  // subcontexto bajo el contexto seleccionado, y se abre"). Distinto del botón
  // de cabecera («Nuevo contexto», que usa `currentParent`, el nivel en el que
  // se ha entrado): «Subcontexto» usa SIEMPRE el contexto concreto del que
  // salió el menú «＋» como padre; «Contexto» (solo en el menú global) fuerza
  // `id: null` = raíz, sea cual sea el contexto activo.
  const [newSubCtxParent, setNewSubCtxParent] = useState<{ id: string | null } | null>(null)
  const openAddMenu = (e: React.MouseEvent, id: string | null, isGlobal?: boolean) => {
    e.preventDefault(); e.stopPropagation()
    setAddMenu({ id, x: e.clientX, y: e.clientY, isGlobal })
  }

  // Menú de clic derecho de un contexto: renombrar / color / mover / eliminar.
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [moveSubmenu, setMoveSubmenu] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const openCtxMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    setMoveSubmenu(false)
    setCtxMenu({ id, x: e.clientX, y: e.clientY })
  }
  const startRename = (id: string) => {
    const n = store.getNode(id)
    setRenameVal(n?.text || '')
    setRenaming(id)
    setCtxMenu(null)
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select() }, 20)
  }
  const commitRename = () => {
    if (renaming && renameVal.trim()) store.updateNode(renaming, { text: renameVal.trim() })
    setRenaming(null); setRenameVal('')
  }
  const deleteContext = (id: string) => {
    const deletedIds = store.deleteNode(id)
    setCtxMenu(null)
    if (selectedCtxId === id) onSelectCtx(null)
    if (deletedIds.length === 0) return
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: {
        message: t('v2.ctxDeletedToast', 'Contexto movido a la papelera'),
        type: 'success',
        action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(deletedIds) },
      },
    }))
  }
  // Destinos válidos para «Mover a…»: cualquier contexto que no sea el propio ni
  // uno de sus descendientes (evita ciclos; reparentContext también los bloquea).
  const moveTargets = (id: string): Node[] => {
    const isDescendant = (candidateId: string): boolean => {
      let cur = store.getNode(candidateId)
      let guard = 0
      while (cur?.parentId && guard++ < 60) { if (cur.parentId === id) return true; cur = store.getNode(cur.parentId) }
      return false
    }
    return listContextsForParent().filter(n => n.id !== id && !isDescendant(n.id))
  }

  useEffect(() => {
    if (!userMenu) return
    const onDoc = (e: MouseEvent) => { if (userWrap.current && !userWrap.current.contains(e.target as HTMLElement)) setUserMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [userMenu])

  // ⌘, abre Ajustes desde cualquier sitio (evento global disparado por V2App).
  useEffect(() => {
    window.addEventListener('from:open-settings', onOpenSettings)
    return () => window.removeEventListener('from:open-settings', onOpenSettings)
  }, [onOpenSettings])

  // La izquierda sigue a `selectedCtxId` venga de donde venga (clic aquí, abrir una
  // nota con contexto, un chip de contexto…): recompone el «pasillo» de drill-down
  // hasta hacerlo visible. Si tiene subcontextos entra en él (se vuelve cabecera,
  // igual que un clic manual); si es hoja, queda resaltado en la lista de su padre.
  useEffect(() => {
    if (!selectedCtxId) { setStack([]); return }
    const n = store.getNode(selectedCtxId)
    if (!n) return
    const chain: Node[] = []
    let cur = contextParent(selectedCtxId)
    let guard = 0
    while (cur && guard++ < 40) { chain.unshift(cur); cur = contextParent(cur.id) }
    if (subContextsOf(selectedCtxId).length > 0) chain.push(n)
    setStack(chain)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCtxId])

  const currentParent = stack.length ? stack[stack.length - 1] : null

  // Nivel raíz = ÁREAS (hijos directos de 🧠 Contexto, sin el Perfil 🧠…).
  const areas: Node[] = store.allActive()
    .filter(n => isRootContext(n.id) && !(n.text || '').startsWith('🧠'))
    .sort(byName)

  const items: Node[] = currentParent ? subContextsOf(currentParent.id) : areas

  const displayName = user.user?.name || user.user?.email || t('v2.guest', 'Invitado')
  const initial = (user.user?.name || user.user?.email || 'A').charAt(0).toUpperCase()

  const enter = (c: Node) => {
    onSelectCtx(c.id)
    if (subContextsOf(c.id).length > 0) setStack(prev => [...prev, c]) // zoom-in solo si tiene subcontextos
  }
  // Volver un nivel. Si el nivel al que se vuelve es la RAÍZ, no es solo "subir":
  // es SALIR de los contextos (Alberto, 5 ago 2026: "cuando vuelve a la raíz debería
  // poner otra vez los colores por defecto en la web y abrir la nota diaria, ese es
  // el inicio de todo"). Los "colores por defecto" salen solos al deseleccionar el
  // contexto: el tinte de acento de toda la app depende de `selectedCtxId`
  // (efecto `ownAccent` en V2App.tsx), no de la sidebar.
  const back = () => {
    if (stack.length <= 1) { setStack([]); goHome(); return }
    setStack(prev => prev.slice(0, -1))
  }

  /** Inicio de la app: día de hoy, su nota en el centro y su columna derecha. Es
   *  exactamente el reset duro del destino Día — no se duplica aquí. */
  const goHome = () => onSelectGeneral('dia')

  return (
    <aside
      className={`v2-col v2-sidebar ${dragOver ? 'v2-sidebar--drag' : ''}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); if (!dragOver) { setDragOver(true); onDragStateChange?.(true) } } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as HTMLElement)) { setDragOver(false); onDragStateChange?.(false) } }}
      onDrop={dropFiles}
    >
      {/* La marca es el BOTÓN DE INICIO (Alberto, 5 ago 2026: "pon el nombre de
          Fromly de arriba a la izquierda clicable para que vaya a la vista de día
          con la nota diaria y su columna derecha") — mismo destino que la fila
          «Día», que ya hace ese reset duro (`onSelectGeneral` en V2App). */}
      <div className="v2-sidebar-head">
        <button className="v2-brand" onClick={goHome} title={t('v2.goHome', 'Ir al día de hoy')}>
          Fromly <span className="v2-brand-badge">2.0</span>
        </button>
      </div>

      {/* Barra de creación — sustituye a los botones «Nueva conversación» y «Nuevo
          elemento» (Alberto, 5 ago 2026: "vamos a quitarlos y a poner una línea en
          su lugar con iconos para crear elementos nuevos: chat, nota, lienzo,
          tarea, grabar y adjuntar"). Todo se crea en el CONTEXTO ACTIVO
          (`selectedCtxId`; null = General / día de hoy), igual que hacía el menú
          «＋ Nuevo elemento» global que había antes.
          · No hay botón de EVENTO a propósito: `NewTaskModal` usa un input
            `datetime-local`, así que una tarea con hora YA es un evento a todos
            los efectos (aparece en el timeline del día y se sincroniza con Google
            Calendar). Un segundo botón sería el mismo formulario con otro nombre.
          · «Adjuntar» abre `V2AttachModal` (archivo / enlace / Drive) — antes era
            un botón «Drive» que solo cubría una de las tres vías. */}
      <div className="v2-createbar">
        {([
          { key: 'chat',   icon: 'chat',       label: t('v2.create.chat', 'Chat'),       run: () => onNewChatInCtx(selectedCtxId) },
          { key: 'note',   icon: 'note',       label: t('v2.chat.newNote', 'Nota'),      run: () => onNewNoteInCtx(selectedCtxId) },
          { key: 'canvas', icon: 'canvas',     label: t('v2.chat.newCanvasShort', 'Lienzo'), run: () => onNewCanvasInCtx(selectedCtxId) },
          { key: 'task',   icon: 'task',       label: t('v2.chat.newTaskShort', 'Tarea'), run: () => setNewTaskCtx({ id: selectedCtxId }) },
          { key: 'rec',    icon: 'mic',        label: t('v2.chat.record', 'Grabar'),     run: () => onRecordInCtx(selectedCtxId) },
          { key: 'attach', icon: 'attachment', label: t('v2.attach.title', 'Adjuntar'),  run: () => onOpenAttach(selectedCtxId) },
        ] as const).map(b => (
          <button key={b.key} className="v2-createbtn" title={b.label} aria-label={b.label} onClick={b.run}>
            <Icon name={b.icon} size={17} />
          </button>
        ))}
      </div>

      {/* Destinos globales (rediseño 5 ago 2026, fusión Agenda+Día el mismo día) —
          Día/Agenda/Chat/Elementos, al mismo nivel que un contexto, sin etiqueta de
          sección propia (la palabra "General" ya la usa la fila pseudo-contexto de
          más abajo; repetirla aquí confundiría cuál es cuál). Mismo estilo visual
          que una fila de contexto.
          ⚠️ Día y Agenda vuelven a ser DOS filas (Alberto, 5 ago 2026, 5ª parte:
          "es mucho más simple hacer clic en agenda y que aparezca la columna
          derecha de planner y en el centro planificador, y hacer clic en día y que
          aparezca la columna derecha con el timeline diario y la nota diaria en el
          centro"). Antes, ese mismo día, se habían fusionado en un destino con 2
          tabs internas — un clic de más para la misma decisión. Día va PRIMERA y es
          el destino por defecto al abrir la app. */}
      {/* `flex: 'none'`: sin esto hereda `flex:1` de `.v2-ctx-list` (misma clase que
          la lista de Contextos, de abajo) y se estira ocupando todo el espacio
          libre — con solo 3 filas cortas, eso dejaba un hueco en blanco enorme
          entre "Elementos" y "Contextos" (Alberto, 5 ago 2026). */}
      <div className="v2-ctx-list" style={{ marginBottom: 8, flex: 'none' }}>
        <div className={`v2-ctx-row ${activeGeneralDest === 'dia' ? 'active' : ''}`} onClick={() => onSelectGeneral('dia')}>
          <Icon name="sun" size={16} className="v2-ctx-glyph" />
          <span className="v2-el-title">{t('v2.rightColumn.tabDay', 'Día')}</span>
        </div>
        <div className={`v2-ctx-row ${activeGeneralDest === 'agenda' ? 'active' : ''}`} onClick={() => onSelectGeneral('agenda')}>
          <Icon name="calendar" size={16} className="v2-ctx-glyph" />
          <span className="v2-el-title">{t('v2.rightColumn.tabAgenda', 'Agenda')}</span>
        </div>
        <div className={`v2-ctx-row ${activeGeneralDest === 'chat' ? 'active' : ''}`} onClick={() => onSelectGeneral('chat')}>
          <Icon name="chat" size={16} className="v2-ctx-glyph" />
          <span className="v2-el-title">{t('v2.rightColumn.tabChat', 'Chat')}</span>
        </div>
        <div className={`v2-ctx-row ${activeGeneralDest === 'elementos' ? 'active' : ''}`} onClick={() => onSelectGeneral('elementos')}>
          <Icon name="layers" size={16} className="v2-ctx-glyph" />
          <span className="v2-el-title">{t('v2.rightColumn.tabElements', 'Elementos')}</span>
        </div>
      </div>

      {/* Avisos (conversación de agente pendiente / informe de agente nuevo) — texto
          destacado, NO un botón como "Nueva conversación" (Alberto, 5 ago 2026: "en
          lugar de como botones, ponlos como de texto... pero destacado que se vea
          que es una notificación"). Franja de acento a la izquierda + fondo sutil
          solo al hover, mismo patrón que una notificación de lista, no una acción
          primaria — y bastante más compactos, así dejan de comerse el hueco entre
          Elementos y Contextos con o sin avisos activos. */}
      {(() => {
        const pending = listPendingAgentConversations()
        if (pending.length === 0 || !onOpenConversation) return null
        // Las conversaciones que Fromly inicia para ampliar el PERFIL llevan su
        // propio texto: «1 conversación esperando» no dice de qué va, y esta no
        // viene de ningún agente que el usuario haya configurado (v2/profileChat.ts).
        const profileOne = pending.length === 1 && isProfileChatSession(pending[0])
        return (
          <button className="v2-sidebar-notice"
            onClick={() => onOpenConversation(pending[0].id)}
            title={pending.length > 1 ? t('v2.pendingConversationsHint', 'Hay más de una esperando respuesta') : undefined}>
            <Icon name={profileOne ? 'profile' : 'conversation'} size={14} /> {profileOne
              ? t('v2.profileChatPending', 'Fromly quiere saber más de ti')
              : pending.length === 1
                ? t('v2.pendingConversationOne', '1 conversación esperando')
                : t('v2.pendingConversationsMany', '{{count}} conversaciones esperando', { count: pending.length })}
          </button>
        )
      })()}

      {(() => {
        const unseen = listUnseenAgentResults()
        if (unseen.length === 0 || !onOpenNode) return null
        const mostRecent = [...unseen].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0]
        return (
          <button className="v2-sidebar-notice"
            onClick={() => onOpenNode(mostRecent.id)}
            title={unseen.length > 1 ? t('v2.unseenAgentResultsHint', 'Hay más informes nuevos en sus contextos') : undefined}>
            <Icon name="report" size={14} /> {unseen.length === 1
              ? t('v2.unseenAgentResultOne', '1 informe de agente nuevo')
              : t('v2.unseenAgentResultsMany', '{{count}} informes de agente nuevos', { count: unseen.length })}
          </button>
        )
      })()}

      {/* Cabecera de nivel: raíz = «Contextos»; dentro = volver + nombre del contexto.
          El «+» crea un contexto con el padre correcto ya preseleccionado (ninguno en
          raíz, el contexto actual si hemos entrado en uno) — editable en el modal. */}
      {currentParent ? (
        <div className="v2-section-label v2-section-label--hoverable" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={back}>
            <Icon name="chevron-left" size={13} /> {t('v2.back', 'Volver')}
          </span>
          <button className="v2-ctx-add" title={t('v2.newContext', 'Nuevo contexto')} onClick={() => setShowNewContext(true)}><Icon name="plus" size={14} /></button>
        </div>
      ) : (
        /* El «+» aparece al pasar el ratón, igual que el de cada fila de contexto
           (Alberto, 5 ago 2026) — en reposo la cabecera es solo una etiqueta. */
        <div className="v2-section-label v2-section-label--hoverable" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {t('v2.contexts', 'Contextos')}
          <button className="v2-ctx-add" title={t('v2.newContext', 'Nuevo contexto')} onClick={() => setShowNewContext(true)}><Icon name="plus" size={14} /></button>
        </div>
      )}

      <div className="v2-ctx-list">
        {currentParent ? (
          // Contexto en el que hemos entrado (seleccionable, resaltado como cabecera).
          <div
            className={`v2-ctx-row ${selectedCtxId === currentParent.id ? 'active' : ''}`}
            onClick={() => onSelectCtx(currentParent.id)}
            onContextMenu={(e) => openCtxMenu(e, currentParent.id)}
          >
            <span className="v2-ctx-dot" style={{ background: contextColor(currentParent.id) }} />
            {renaming === currentParent.id ? (
              <input
                ref={renameRef}
                className="v2-ctx-rename-input"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') { setRenaming(null); setRenameVal('') } }}
              />
            ) : (
              <span className="v2-el-title" style={{ fontWeight: 600 }}>{displayTitle(currentParent.text, t('v2.context', 'Contexto'))}</span>
            )}
            <button
              className="v2-ctx-add"
              title={t('v2.newElementInThisContext', 'Crear elemento en este contexto')}
              onClick={(e) => openAddMenu(e, currentParent.id)}
            ><Icon name="plus" size={14} /></button>
          </div>
        ) : (
          <div
            className={`v2-ctx-row ${selectedCtxId === null ? 'active' : ''}`}
            onClick={() => onSelectCtx(null)}
          >
            <span className="v2-ctx-dot" style={{ background: 'var(--text-tertiary)' }} />
            <span className="v2-el-title">{t('v2.general', 'General')}</span>
          </div>
        )}

        {currentParent && <div className="v2-section-label" style={{ padding: '10px 16px 4px' }}>{t('v2.subcontexts', 'Subcontextos')}</div>}

        {items.map(c => {
          const hasSubs = subContextsOf(c.id).length > 0
          return (
            <div
              key={c.id}
              className={`v2-ctx-row ${currentParent ? 'child' : ''} ${selectedCtxId === c.id ? 'active' : ''}`}
              onClick={() => enter(c)}
              onContextMenu={(e) => openCtxMenu(e, c.id)}
            >
              <span className="v2-ctx-dot" style={{ background: contextColor(c.id) }} />
              {renaming === c.id ? (
                <input
                  ref={renameRef}
                  className="v2-ctx-rename-input"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') { setRenaming(null); setRenameVal('') } }}
                />
              ) : (
                <span className="v2-el-title">{displayTitle(c.text, t('v2.untitled', 'Sin título'))}</span>
              )}
              <button
                className="v2-ctx-add"
                title={t('v2.newElementInThisContext', 'Crear elemento en este contexto')}
                onClick={(e) => openAddMenu(e, c.id)}
              ><Icon name="plus" size={14} /></button>
              {hasSubs && <Icon name="chevron-right" size={13} className="v2-ctx-count" />}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="v2-right-empty" style={{ padding: '16px 14px' }}>
            {currentParent ? t('v2.noSubcontexts', 'Sin subcontextos.') : t('v2.noContextsYet', 'Aún no tienes contextos.')}
          </div>
        )}
      </div>

      {/* Menú «＋» de un contexto: nota / tarea / evento / lienzo / conversación. */}
      {addMenu && (
        <>
          <div onPointerDown={() => setAddMenu(null)} onContextMenu={(e) => { e.preventDefault(); setAddMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div className="v2-ctx-menu" style={{ position: 'fixed', top: addMenu.y, left: addMenu.x, zIndex: 2000 }}>
            <button className="v2-ctx-menu-item" onClick={() => { onNewNoteInCtx(addMenu.id); setAddMenu(null) }}><Icon name="note" size={14} /> {t('v2.chat.newNote', 'Nota')}</button>
            {/* Sin entrada «Evento»: `NewTaskModal` usa un input `datetime-local`, así
                que una tarea con hora YA es un evento (timeline + Google Calendar). Era
                el mismo formulario con otro nombre — mismo motivo por el que la barra de
                creación de arriba nunca lo tuvo (Alberto, 5 ago 2026: "los eventos son
                tareas que tienen día y hora... hay que unificarlo en todo Fromly"). */}
            <button className="v2-ctx-menu-item" onClick={() => { setNewTaskCtx({ id: addMenu.id }); setAddMenu(null) }}><Icon name="task" size={14} /> {t('v2.chat.newTaskShort', 'Tarea')}</button>
            <button className="v2-ctx-menu-item" onClick={() => { onNewCanvasInCtx(addMenu.id); setAddMenu(null) }}><Icon name="canvas" size={14} /> {t('v2.chat.newCanvasShort', 'Lienzo')}</button>
            <button className="v2-ctx-menu-item" onClick={() => { onOpenAttach(addMenu.id); setAddMenu(null) }}><Icon name="attachment" size={14} /> {t('v2.attach.title', 'Adjuntar')}</button>
            <button className="v2-ctx-menu-item" onClick={() => { onRecordInCtx(addMenu.id); setAddMenu(null) }}><Icon name="mic" size={14} /> {t('v2.chat.record', 'Grabar')}</button>
            <div className="v2-ctx-menu-sep" />
            <button className="v2-ctx-menu-item" onClick={() => { onNewChatInCtx(addMenu.id); setAddMenu(null) }}><Icon name="conversation" size={14} /> {t('v2.newConversationInThisContext', 'Nueva conversación')}</button>
            <button className="v2-ctx-menu-item" onClick={() => { setNewSubCtxParent({ id: addMenu.id }); setAddMenu(null) }}><Icon name="context" size={14} /> {t('v2.newSubcontext', 'Subcontexto')}</button>
            {/* Solo en el menú GLOBAL: raíz sin importar el contexto activo — el
                «Subcontexto» de arriba ya cubre crear bajo el contexto seleccionado. */}
            {addMenu.isGlobal && (
              <button className="v2-ctx-menu-item" onClick={() => { setNewSubCtxParent({ id: null }); setAddMenu(null) }}><Icon name="folder" size={14} /> {t('v2.newContext', 'Nuevo contexto')}</button>
            )}
          </div>
        </>
      )}
      {newTaskCtx && <NewTaskModal parentId={newTaskCtx.id} onClose={() => setNewTaskCtx(null)} />}

      {/* Menú de clic derecho de un contexto: renombrar / color / mover / eliminar. */}
      {ctxMenu && store.getNode(ctxMenu.id) && (
        <>
          <div onPointerDown={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div className="v2-ctx-menu" style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 2000 }}>
            {!moveSubmenu ? (
              <>
                <button className="v2-ctx-menu-item" onClick={() => startRename(ctxMenu.id)}>{t('v2.ctxMenu.rename', 'Renombrar')}</button>
                <div className="v2-ctx-menu-label">{t('v2.ctxMenu.accentColor', 'Color de acento')}</div>
                <div className="v2-ctx-menu-swatches">
                  {ACCENT_SWATCHES.map(c => (
                    <button key={c} title={c} className="v2-ctx-swatch" style={{ background: c }}
                      onClick={() => { setContextAccentColor(ctxMenu.id, c); setCtxMenu(null) }} />
                  ))}
                </div>
                <button className="v2-ctx-menu-item" onClick={() => setMoveSubmenu(true)}>{t('v2.ctxMenu.moveTo', 'Mover a…')}</button>
                {/* La MEMORIA del contexto es interna: no se lista como elemento y ya no
                    ocupa el centro al abrir el contexto (Alberto, 6 ago 2026). Pero se
                    inyecta en cada turno de chat de este contexto, así que tiene que
                    poder leerse y corregirse desde algún sitio — este. Se abre como el
                    documento que es. */}
                <button className="v2-ctx-menu-item" onClick={() => { onOpenNode?.(getOrCreateContextKnowledgeDoc(ctxMenu.id).id); setCtxMenu(null) }}>
                  {t('v2.ctxMenu.memory', 'Lo que Fromly sabe')}
                </button>
                <div className="v2-ctx-menu-sep" />
                <button className="v2-ctx-menu-item v2-ctx-menu-item--danger" onClick={() => deleteContext(ctxMenu.id)}>{t('v2.ctxMenu.delete', 'Eliminar')}</button>
              </>
            ) : (
              <>
                <button className="v2-ctx-menu-item" onClick={() => setMoveSubmenu(false)}><Icon name="chevron-left" size={13} /> {t('v2.back', 'Volver')}</button>
                <div className="v2-ctx-menu-sep" />
                {moveTargets(ctxMenu.id).length === 0 ? (
                  <div className="v2-ctx-menu-label">{t('v2.ctxMenu.noTargets', 'No hay otro contexto disponible')}</div>
                ) : moveTargets(ctxMenu.id).map(target => (
                  <button key={target.id} className="v2-ctx-menu-item" onClick={() => { reparentContext(ctxMenu.id, target.id); setCtxMenu(null) }}>
                    {displayTitle(target.text, t('v2.untitled', 'Sin título'))}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      <div className="v2-sidebar-foot" ref={userWrap}>
        {userMenu && (
          <div className="v2-usermenu">
            <button className="v2-usermenu-item" onClick={() => { onOpenProfile(); setUserMenu(false) }}><Icon name="profile" size={15} /> {t('v2.profile.title', 'Perfil')}</button>
            <button className="v2-usermenu-item" onClick={() => { onOpenSettings(); setUserMenu(false) }}><Icon name="settings" size={15} /> {t('v2.settings', 'Ajustes')}</button>
            <button className="v2-usermenu-item" onClick={() => { setShowTrash(true); setUserMenu(false) }}><Icon name="trash" size={15} /> {t('v2.trash', 'Papelera')}</button>
            <div className="v2-usermenu-sep" />
            <div className="v2-usermenu-label">{t('v2.theme', 'Tema')}</div>
            <div className="v2-theme-seg">
              {(['light', 'dark', 'system'] as const).map(tk => (
                <button
                  key={tk}
                  className={`v2-theme-opt ${theme === tk ? 'active' : ''}`}
                  onClick={() => setTheme(tk)}
                ><Icon name={tk === 'light' ? 'sun' : tk === 'dark' ? 'moon' : 'auto'} size={13} />
                  {tk === 'light' ? t('v2.themeLight', 'Claro') : tk === 'dark' ? t('v2.themeDark', 'Oscuro') : t('v2.themeAuto', 'Auto')}</button>
              ))}
            </div>
            <div className="v2-usermenu-sep" />
            <button className="v2-usermenu-item v2-usermenu-item--danger" onClick={() => { clearTokens(); window.location.href = '/login' }}>{t('v2.logOut', 'Cerrar sesión')}</button>
          </div>
        )}
        <button className="v2-userchip" onClick={() => setUserMenu(o => !o)} title={t('v2.accountAndSettings', 'Cuenta y ajustes')}>
          <span className="v2-avatar">{initial}</span>
          <span className="v2-el-main">
            <span className="v2-el-title">{displayName}</span>
            <span className="v2-el-meta">
              {user.planLabel}
              {/* Enlace siempre visible en plan gratis (Alberto, 29 jul: "que ponga
                  después con enlace Pasar a Pro") — antes solo se veía el paywall
                  al chocar con un límite concreto; esto da una salida directa sin
                  esperar a toparse con uno. */}
              {!user.isPremium && (
                <>
                  {' · '}
                  <span
                    className="v2-userchip-upgrade"
                    onClick={e => { e.stopPropagation(); navigate('/pricing') }}
                  >
                    {t('v2.upgradeToPro', 'Pasar a Pro')}
                  </span>
                </>
              )}
            </span>
          </span>
          <Icon name="chevron-down" size={13} className="v2-userchip-caret" />
        </button>
      </div>
      {showTrash && <V2Trash onClose={() => setShowTrash(false)} />}
      {showNewContext && (
        <NewContextModal
          defaultParentId={currentParent?.id ?? null}
          onClose={() => setShowNewContext(false)}
          onCreated={id => onSelectCtx(id)}
        />
      )}
      {newSubCtxParent && (
        <NewContextModal
          defaultParentId={newSubCtxParent.id}
          onClose={() => setNewSubCtxParent(null)}
          onCreated={id => onSelectCtx(id)}
        />
      )}
    </aside>
  )
}
