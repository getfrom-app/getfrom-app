// V2ThreadHistory — historial REAL del destino Chat (30 ago 2026), columna
// derecha. Sustituye a `V2ContextBrowser variant="list"` (navegador de
// contextos + conversaciones sueltas `_aiSession`, motor viejo desconectado
// del chat de verdad desde la migración a `assistantStore` — ver FROM.md
// "assistantStore es el ÚNICO motor de chat real; aiChatStore quedó a
// medias"). Alberto, mismo día: "prefiero que sea un historial de chats, que
// cada uno tenga un titular y debajo el contexto... y la fecha. no una lista
// de contextos" + "que se listen por modificación, las más recientes
// primero" — un hilo real por contexto/elemento (`GET /assistant/threads`),
// sin agrupar ni hacer drill-down: una fila plana por hilo.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { assistantListThreads, type AssistantThreadSummary } from '../../api/assistant'
import { contextColor } from '../../utils/cajones'
import { displayTitle } from '../../utils/displayText'
import { fmtRelative } from '../../utils/formatDate'
import { AGENDA_THREAD_KEY } from '../../store/assistantStore'
import Icon from './Icon'

interface Props {
  /** Hilo activo en el centro — `null` = general. Para resaltar su fila. */
  activeThreadKey: string | null
  /** Abre ESE hilo en el centro, sin tocar `selectedCtxId`/`rightMode`. */
  onOpenThread: (threadKey: string | null) => void
}

export default function V2ThreadHistory({ activeThreadKey, onOpenThread }: Props) {
  const { t, i18n } = useTranslation()
  useStore()
  const [threads, setThreads] = useState<AssistantThreadSummary[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    assistantListThreads().then(list => { if (!cancelled) setThreads(list) }).catch(() => { if (!cancelled) setThreads([]) })
    return () => { cancelled = true }
  }, [])

  const needle = q.trim().toLowerCase()

  const rows = (threads ?? [])
    // El hilo de Agenda (`AGENDA_THREAD_KEY`, V2AgendaAssistant.tsx) vive en OTRO
    // destino — mismo motivo que "General" nunca lista aquí las conversaciones
    // de un contexto real: cada destino enseña la suya, no un totum revolutum.
    .filter(th => th.threadKey !== AGENDA_THREAD_KEY)
    .map(th => ({
      ...th,
      ctx: th.threadKey === 'general' || th.threadKey === '__ctx_sin_contexto__' ? null : store.getNode(th.threadKey),
    }))
    .filter(r => !needle || r.preview.toLowerCase().includes(needle) || (r.ctx?.text || '').toLowerCase().includes(needle))

  return (
    <div className="v2-hist v2-hist--list">
      <div className="v2-hist-search">
        <Icon name="search" size={14} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('v2.history.searchPlaceholder', 'Buscar en el historial')}
        />
      </div>

      {threads === null ? null : rows.length === 0 ? (
        <div className="v2-hist-empty">
          {needle
            ? t('v2.history.noResults', 'Sin resultados.')
            : t('v2.history.noConversations', 'Aún no hay conversaciones.')}
        </div>
      ) : (
        <div className="v2-hist-list">
          {rows.map(r => (
            <button
              key={r.threadKey}
              className={`v2-hist-row ${(activeThreadKey ?? 'general') === r.threadKey ? 'active' : ''}`}
              onClick={() => onOpenThread(r.ctx ? r.ctx.id : null)}
            >
              <Icon name="conversation" size={15} className="v2-hist-row-icon" />
              <span className="v2-hist-row-main">
                <span className="v2-hist-row-title">{r.preview}</span>
                <span className="v2-hist-row-meta">
                  <span className="v2-el-ctxchip" style={{ ['--chip' as string]: r.ctx ? contextColor(r.ctx.id) : 'var(--text-tertiary)' }}>
                    {r.ctx ? displayTitle(r.ctx.text) : t('v2.general', 'General')}
                  </span>
                  {fmtRelative(r.updatedAt, i18n.language)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
