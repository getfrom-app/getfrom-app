// Sidebar de Fromly 2.0 — contextos (= proyectos) con navegación drill-down.
// Nivel raíz = ÁREAS (hijos directos de 🧠 Contexto) + General. Clic en un
// contexto: lo selecciona (la app reacciona) Y hace zoom-in a sus subcontextos
// en la misma columna, con botón de volver.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { isRootContext, isMarkedContext, isContextClosed, contextColor, contextParent, reparentContext, listContextsForParent } from '../../utils/cajones'
import { listPendingAgentConversations } from '../../store/aiChatStore'
import { useTheme } from '../../hooks/useTheme'
import { clearTokens } from '../../api/client'
import V2Trash from './V2Trash'
import NewContextModal from '../../components/modals/NewContextModal'
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
  onNewChat: () => void
  onNewChatInCtx: (id: string) => void
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

export default function V2Sidebar({ selectedCtxId, onSelectCtx, onNewChat, onNewChatInCtx, onFilesDropped, onDragStateChange, onOpenSettings, onOpenConversation, onOpenProfile }: Props) {
  useStore()
  const { t } = useTranslation()
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
  const back = () => setStack(prev => prev.slice(0, -1))

  return (
    <aside
      className={`v2-col v2-sidebar ${dragOver ? 'v2-sidebar--drag' : ''}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); if (!dragOver) { setDragOver(true); onDragStateChange?.(true) } } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as HTMLElement)) { setDragOver(false); onDragStateChange?.(false) } }}
      onDrop={dropFiles}
    >
      <div className="v2-sidebar-head">
        <span className="v2-brand">Fromly <span className="v2-brand-badge">2.0</span></span>
      </div>
      <button className="v2-newchat" onClick={onNewChat}>＋ {t('v2.newConversation', 'Nueva conversación')}</button>

      {/* Aviso de conversaciones abiertas por un agente proactivo (Alberto, 15 jul:
          "quiero un agente que cada día me pregunte..."). Fase 0 sin push real: sin
          canal para avisar con la app cerrada, así que se destaca aquí en cuanto se
          abre la app — mejor que perderse silenciosamente como una nota más. */}
      {(() => {
        const pending = listPendingAgentConversations()
        if (pending.length === 0 || !onOpenConversation) return null
        return (
          <button className="v2-newchat" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)', marginTop: -2 }}
            onClick={() => onOpenConversation(pending[0].id)}
            title={pending.length > 1 ? t('v2.pendingConversationsHint', 'Hay más de una esperando respuesta') : undefined}>
            💬 {pending.length === 1
              ? t('v2.pendingConversationOne', '1 conversación esperando')
              : t('v2.pendingConversationsMany', '{{count}} conversaciones esperando', { count: pending.length })}
          </button>
        )
      })()}

      {/* Cabecera de nivel: raíz = «Contextos»; dentro = volver + nombre del contexto.
          El «+» crea un contexto con el padre correcto ya preseleccionado (ninguno en
          raíz, el contexto actual si hemos entrado en uno) — editable en el modal. */}
      {currentParent ? (
        <div className="v2-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={back}>
            <span style={{ fontSize: 14 }}>‹</span> {t('v2.back', 'Volver')}
          </span>
          <button className="v2-ctx-add" title={t('v2.newContext', 'Nuevo contexto')} onClick={() => setShowNewContext(true)}>＋</button>
        </div>
      ) : (
        <div className="v2-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {t('v2.contexts', 'Contextos')}
          <button className="v2-ctx-add" title={t('v2.newContext', 'Nuevo contexto')} onClick={() => setShowNewContext(true)}>＋</button>
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
              <span className="v2-el-title" style={{ fontWeight: 600 }}>{currentParent.text || t('v2.context', 'Contexto')}</span>
            )}
            <button
              className="v2-ctx-add"
              title={t('v2.newConversationInThisContext', 'Nueva conversación en este contexto')}
              onClick={(e) => { e.stopPropagation(); onNewChatInCtx(currentParent.id) }}
            >＋</button>
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
                <span className="v2-el-title">{c.text || t('v2.untitled', 'Sin título')}</span>
              )}
              <button
                className="v2-ctx-add"
                title={t('v2.newConversationInThisContext', 'Nueva conversación en este contexto')}
                onClick={(e) => { e.stopPropagation(); onNewChatInCtx(c.id) }}
              >＋</button>
              {hasSubs && <span className="v2-ctx-count">›</span>}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="v2-right-empty" style={{ padding: '16px 14px' }}>
            {currentParent ? t('v2.noSubcontexts', 'Sin subcontextos.') : t('v2.noContextsYet', 'Aún no tienes contextos.')}
          </div>
        )}
      </div>

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
                <div className="v2-ctx-menu-sep" />
                <button className="v2-ctx-menu-item v2-ctx-menu-item--danger" onClick={() => deleteContext(ctxMenu.id)}>{t('v2.ctxMenu.delete', 'Eliminar')}</button>
              </>
            ) : (
              <>
                <button className="v2-ctx-menu-item" onClick={() => setMoveSubmenu(false)}>‹ {t('v2.back', 'Volver')}</button>
                <div className="v2-ctx-menu-sep" />
                {moveTargets(ctxMenu.id).length === 0 ? (
                  <div className="v2-ctx-menu-label">{t('v2.ctxMenu.noTargets', 'No hay otro contexto disponible')}</div>
                ) : moveTargets(ctxMenu.id).map(target => (
                  <button key={target.id} className="v2-ctx-menu-item" onClick={() => { reparentContext(ctxMenu.id, target.id); setCtxMenu(null) }}>
                    {target.text || t('v2.untitled', 'Sin título')}
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
            <button className="v2-usermenu-item" onClick={() => { onOpenProfile(); setUserMenu(false) }}>🧠 {t('v2.profile.title', 'Perfil')}</button>
            <button className="v2-usermenu-item" onClick={() => { onOpenSettings(); setUserMenu(false) }}>⚙︎ {t('v2.settings', 'Ajustes')}</button>
            <button className="v2-usermenu-item" onClick={() => { setShowTrash(true); setUserMenu(false) }}>🗑 {t('v2.trash', 'Papelera')}</button>
            <div className="v2-usermenu-sep" />
            <div className="v2-usermenu-label">{t('v2.theme', 'Tema')}</div>
            <div className="v2-theme-seg">
              {(['light', 'dark', 'system'] as const).map(tk => (
                <button
                  key={tk}
                  className={`v2-theme-opt ${theme === tk ? 'active' : ''}`}
                  onClick={() => setTheme(tk)}
                >{tk === 'light' ? `☀︎ ${t('v2.themeLight', 'Claro')}` : tk === 'dark' ? `☾ ${t('v2.themeDark', 'Oscuro')}` : `⚙ ${t('v2.themeAuto', 'Auto')}`}</button>
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
            <span className="v2-el-meta">{user.planLabel}</span>
          </span>
          <span className="v2-userchip-caret">⌄</span>
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
    </aside>
  )
}
