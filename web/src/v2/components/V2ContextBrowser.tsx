// Navegador de CONTEXTOS + sus conversaciones — el patrón «Proyectos» de Claude,
// traído a Fromly (Alberto, 5 ago 2026: "igual que Claude utiliza proyectos, aquí
// serían contextos, y al hacer clic en un contexto se abriría la lista de
// conversaciones de ese contexto").
//
// UN solo componente para los DOS sitios donde aparece, porque el comportamiento
// (entrar en un contexto → ver sus conversaciones → volver) es idéntico y no debe
// divergir; solo cambia la piel, vía `variant`:
//   · `cards` — rejilla de tarjetas. Ocupa el estado vacío del chat central, en el
//     hueco que dejó el saludo "Hola 👋" + las 4 sugerencias genéricas (quitados:
//     "no se utiliza realmente, lo podemos quitar... podemos aprovechar ese
//     espacio para poner tarjetas con cada uno de los contextos").
//   · `list` — filas compactas. Es el tab «Historial» de la columna derecha, que
//     además lista las conversaciones recientes de TODOS los contextos.
//
// El drill-down es estado LOCAL (no sube a V2App): entrar a mirar las
// conversaciones de un contexto no cambia el contexto activo de la app — eso solo
// lo hace la sidebar (regla de navegación del 30 jul, ver FROM.md). Abrir una
// conversación concreta sí, vía `onOpenConversation`.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { contextColor, firstContextOf } from '../../utils/cajones'
import { fmtRelative } from '../../utils/formatDate'
import { listContextCards, listConversations, conversationTitle } from '../conversations'
import { displayTitle } from '../../utils/displayText'
import Icon from './Icon'
import type { Node } from '../../types'

interface Props {
  variant: 'cards' | 'list'
  /** Abre una conversación guardada (V2App.onOpenConversation). */
  onOpenConversation: (id: string) => void
  /** Empieza una conversación nueva dentro de un contexto (V2App.onNewChatInCtx). */
  onNewChatInCtx?: (id: string | null) => void
  /** Selecciona el contexto de verdad en toda la app (sidebar + columna derecha). */
  onSelectCtx?: (id: string) => void
  /** Cuántas conversaciones recientes listar en la raíz del variant `list`. */
  recentLimit?: number
}

export default function V2ContextBrowser({ variant, onOpenConversation, onNewChatInCtx, onSelectCtx, recentLimit = 25 }: Props) {
  const { t, i18n } = useTranslation()
  useStore()
  // `undefined` = raíz · un id = dentro de ese contexto · `null` = «General»
  // (conversaciones sin ningún contexto asignado).
  const [drill, setDrill] = useState<string | null | undefined>(undefined)
  const [q, setQ] = useState('')

  const cards = useMemo(() => listContextCards(), [store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const recents = useMemo(
    () => listConversations(undefined, recentLimit),
    [store.nodesVersion, recentLimit], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const drilled = useMemo(
    () => (drill === undefined ? [] : listConversations(drill)),
    [drill, store.nodesVersion], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const needle = q.trim().toLowerCase()
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle)

  const untitled = t('v2.history.untitledConversation', 'Conversación sin título')
  // Plural a mano, no `t(key, {count})`: las cadenas de Fromly se declaran con
  // `defaultValue` en el propio código y i18next NO pluraliza un defaultValue
  // (necesitaría claves `_one`/`_other` en los 12 JSON). Dos claves explícitas
  // son más simples y no dejan «4 conversación» a medias.
  const convLabel = (n: number) =>
    n === 0 ? t('v2.history.noConversationsShort', 'Sin conversaciones')
    : n === 1 ? t('v2.history.conversationCountOne', '1 conversación')
    : t('v2.history.conversationCountMany', '{{count}} conversaciones', { count: n })
  const drillNode = drill ? store.getNode(drill) : null
  const drillName = drill === null ? t('v2.general', 'General') : (drillNode?.text || t('v2.context', 'Contexto'))

  // ── Fila de conversación (idéntica en ambos variants) ────────────────────
  // `ctx`: el contexto al que pertenece, para el chip de la 2ª línea. Solo se pasa
  // en la lista de Recientes (mezcla contextos); dentro de un contexto sobra.
  // Mismas acciones que cualquier otra fila (tarea, elemento): borrar al hover +
  // clic derecho con renombrar/cambiar contexto/etc. (26 ago 2026, Alberto: "las
  // conversaciones de chat deben tener un botón de hover para eliminar, y un
  // botón derecho... al estilo de otros elementos"). `from:open-rowmenu` es el
  // mismo menú genérico que ya usan TaskRow/V2ElementRow/PlannerPanel.
  const convRow = (n: Node) => {
    const ctx = firstContextOf(n)
    return (
      <div
        key={n.id}
        className="v2-hist-row"
        role="button"
        tabIndex={0}
        onClick={() => onOpenConversation(n.id)}
        onKeyDown={e => { if (e.key === 'Enter') onOpenConversation(n.id) }}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: n.id, x: e.clientX, y: e.clientY } }))
        }}
      >
        <Icon name="conversation" size={15} className="v2-hist-row-icon" />
        <span className="v2-hist-row-main">
          <span className="v2-hist-row-title">{conversationTitle(n, untitled)}</span>
          <span className="v2-hist-row-meta">
            {ctx && drill === undefined && (
              <span className="v2-el-ctxchip" style={{ ['--chip' as string]: contextColor(ctx.id) }}>{displayTitle(ctx.text)}</span>
            )}
            {fmtRelative(n.updatedAt, i18n.language)}
          </span>
        </span>
        <button
          className="v2-el-del"
          title={t('tip.delete', 'Eliminar')}
          onClick={e => {
            e.stopPropagation(); e.preventDefault()
            const deletedIds = store.deleteNode(n.id)
            if (deletedIds.length === 0) return
            window.dispatchEvent(new CustomEvent('from:toast', {
              detail: {
                message: t('v2.elementRow.movedToTrash', 'Movido a la papelera'),
                type: 'success',
                action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(deletedIds) },
              },
            }))
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    )
  }

  // ── Dentro de un contexto: sus conversaciones ────────────────────────────
  if (drill !== undefined) {
    const visible = drilled.filter(n => matches(conversationTitle(n, untitled)))
    return (
      <div className={`v2-hist v2-hist--${variant}`}>
        <div className="v2-hist-head">
          <button className="v2-hist-back" onClick={() => setDrill(undefined)}>
            <Icon name="chevron-left" size={15} />
            {t('v2.back', 'Volver')}
          </button>
          {drill !== null && onSelectCtx && (
            <button className="v2-hist-headaction" onClick={() => onSelectCtx(drill)}>
              {t('v2.history.openContext', 'Abrir contexto')}
            </button>
          )}
        </div>

        <div className="v2-hist-title-row">
          <span className="v2-hist-ctxdot" style={{ background: drill === null ? 'var(--text-tertiary)' : contextColor(drill) }} />
          <h2 className="v2-hist-title">{displayTitle(drillName)}</h2>
        </div>

        {onNewChatInCtx && (
          <button className="v2-hist-newchat" onClick={() => onNewChatInCtx(drill)}>
            <Icon name="plus" size={14} />
            {t('v2.newConversation', 'Nueva conversación')}
          </button>
        )}

        {visible.length === 0 ? (
          <div className="v2-hist-empty">{t('v2.history.noConversationsInContext', 'Todavía no hay conversaciones aquí.')}</div>
        ) : (
          <div className="v2-hist-list">
            {visible.map(convRow)}
          </div>
        )}
      </div>
    )
  }

  // ── Raíz: contextos + (en `list`) conversaciones recientes ───────────────
  const visibleCards = cards.filter(c => matches(c.node.text || ''))
  const visibleRecents = recents.filter(n => matches(conversationTitle(n, untitled)))

  return (
    <div className={`v2-hist v2-hist--${variant}`}>
      {variant === 'list' && (
        <div className="v2-hist-search">
          <Icon name="search" size={14} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('v2.history.searchPlaceholder', 'Buscar en el historial')}
          />
        </div>
      )}

      <div className="v2-hist-section">{t('v2.contexts', 'Contextos')}</div>

      {visibleCards.length === 0 ? (
        <div className="v2-hist-empty">{t('v2.noContextsYet', 'Aún no tienes contextos.')}</div>
      ) : variant === 'cards' ? (
        <div className="v2-ctxcards">
          {visibleCards.map(({ node, conversations }) => (
            <button key={node.id} className="v2-ctxcard" onClick={() => setDrill(node.id)}>
              <span className="v2-ctxcard-dot" style={{ background: contextColor(node.id) }} />
              <span className="v2-ctxcard-name">{displayTitle(node.text, t('v2.untitled', 'Sin título'))}</span>
              <span className="v2-ctxcard-meta">
                {convLabel(conversations)}
              </span>
            </button>
          ))}
          {/* «General» = todo lo que no cuelga de ningún contexto. Es una tarjeta más
              (misma rejilla), en gris — no es un contexto real y no debe parecerlo. */}
          <button className="v2-ctxcard v2-ctxcard--general" onClick={() => setDrill(null)}>
            <span className="v2-ctxcard-dot" style={{ background: 'var(--text-tertiary)' }} />
            <span className="v2-ctxcard-name">{t('v2.general', 'General')}</span>
            <span className="v2-ctxcard-meta">{t('v2.history.noContextShort', 'Sin contexto')}</span>
          </button>
        </div>
      ) : (
        <div className="v2-hist-list">
          {visibleCards.map(({ node, conversations }) => (
            <button key={node.id} className="v2-hist-row" onClick={() => setDrill(node.id)}>
              <span className="v2-hist-ctxdot" style={{ background: contextColor(node.id) }} />
              <span className="v2-hist-row-main">
                <span className="v2-hist-row-title">{displayTitle(node.text, t('v2.untitled', 'Sin título'))}</span>
                <span className="v2-hist-row-meta">
                  {convLabel(conversations)}
                </span>
              </span>
              <Icon name="chevron-right" size={14} className="v2-hist-row-caret" />
            </button>
          ))}
          <button className="v2-hist-row" onClick={() => setDrill(null)}>
            <span className="v2-hist-ctxdot" style={{ background: 'var(--text-tertiary)' }} />
            <span className="v2-hist-row-main">
              <span className="v2-hist-row-title">{t('v2.general', 'General')}</span>
              <span className="v2-hist-row-meta">{t('v2.history.noContextShort', 'Sin contexto')}</span>
            </span>
            <Icon name="chevron-right" size={14} className="v2-hist-row-caret" />
          </button>
        </div>
      )}

      {variant === 'list' && (
        <>
          <div className="v2-hist-section">{t('v2.history.recent', 'Recientes')}</div>
          {visibleRecents.length === 0 ? (
            <div className="v2-hist-empty">{t('v2.history.noConversations', 'Aún no hay conversaciones.')}</div>
          ) : (
            <div className="v2-hist-list">
              {visibleRecents.map(convRow)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
