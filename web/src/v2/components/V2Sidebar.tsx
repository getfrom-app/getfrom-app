// Sidebar de Fromly 2.0 — contextos (= proyectos) con navegación drill-down.
// Nivel raíz = ÁREAS (hijos directos de 🧠 Contexto) + General. Clic en un
// contexto: lo selecciona (la app reacciona) Y hace zoom-in a sus subcontextos
// en la misma columna, con botón de volver.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { useUserStore } from '../../store/userStore'
import { isRootContext, isMarkedContext, isContextClosed, contextColor, contextParent } from '../../utils/cajones'
import { useTheme } from '../../hooks/useTheme'
import { clearTokens } from '../../api/client'
import SettingsModal from '../../components/modals/SettingsModal'
import V2Trash from './V2Trash'
import type { Node } from '../../types'

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

export default function V2Sidebar({ selectedCtxId, onSelectCtx, onNewChat, onNewChatInCtx, onFilesDropped, onDragStateChange }: Props) {
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
  const [showSettings, setShowSettings] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const userWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenu) return
    const onDoc = (e: MouseEvent) => { if (userWrap.current && !userWrap.current.contains(e.target as HTMLElement)) setUserMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [userMenu])

  // ⌘, abre Ajustes desde cualquier sitio (evento global disparado por V2App).
  useEffect(() => {
    const h = () => setShowSettings(true)
    window.addEventListener('from:open-settings', h)
    return () => window.removeEventListener('from:open-settings', h)
  }, [])

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

  const initial = (user.user?.email || 'A').charAt(0).toUpperCase()

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

      {/* Cabecera de nivel: raíz = «Contextos»; dentro = volver + nombre del contexto */}
      {currentParent ? (
        <div className="v2-section-label" style={{ cursor: 'pointer' }} onClick={back}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>‹</span> {t('v2.back', 'Volver')}
          </span>
        </div>
      ) : (
        <div className="v2-section-label">{t('v2.contexts', 'Contextos')}</div>
      )}

      <div className="v2-ctx-list">
        {currentParent ? (
          // Contexto en el que hemos entrado (seleccionable, resaltado como cabecera).
          <div
            className={`v2-ctx-row ${selectedCtxId === currentParent.id ? 'active' : ''}`}
            onClick={() => onSelectCtx(currentParent.id)}
          >
            <span className="v2-ctx-dot" style={{ background: contextColor(currentParent.id) }} />
            <span className="v2-el-title" style={{ fontWeight: 600 }}>{currentParent.text || t('v2.context', 'Contexto')}</span>
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
            >
              <span className="v2-ctx-dot" style={{ background: contextColor(c.id) }} />
              <span className="v2-el-title">{c.text || t('v2.untitled', 'Sin título')}</span>
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
            {currentParent ? t('v2.noSubcontexts', 'Sin subcontextos.') : t('v2.noContextsYet', 'Aún no tienes contextos. Créalos en la v1 y aparecerán aquí.')}
          </div>
        )}
      </div>

      <div className="v2-sidebar-foot" ref={userWrap}>
        {userMenu && (
          <div className="v2-usermenu">
            <button className="v2-usermenu-item" onClick={() => { setShowSettings(true); setUserMenu(false) }}>⚙︎ {t('v2.settings', 'Ajustes')}</button>
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
            <a className="v2-usermenu-item" href="/app/v1">↩︎ {t('v2.classicFromly', 'Fromly clásico (v1)')}</a>
            <button className="v2-usermenu-item v2-usermenu-item--danger" onClick={() => { clearTokens(); window.location.href = '/login' }}>{t('v2.logOut', 'Cerrar sesión')}</button>
          </div>
        )}
        <button className="v2-userchip" onClick={() => setUserMenu(o => !o)} title={t('v2.accountAndSettings', 'Cuenta y ajustes')}>
          <span className="v2-avatar">{initial}</span>
          <span className="v2-el-main">
            <span className="v2-el-title">{user.user?.email || t('v2.guest', 'Invitado')}</span>
            <span className="v2-el-meta">{user.planLabel}</span>
          </span>
          <span className="v2-userchip-caret">⌄</span>
        </button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showTrash && <V2Trash onClose={() => setShowTrash(false)} />}
    </aside>
  )
}
