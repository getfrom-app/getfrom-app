// V2KnowledgePills — columna derecha del Perfil: lo que Fromly ha aprendido
// del usuario, como píldoras (rediseño 1 sept 2026, ver
// server/src/services/assistantMemory.ts). Más recientes primero; clic en la
// flechita despliega la fuente y la fecha, mismo patrón que V2ThreadHistory.tsx
// (columna derecha del Historial de chats) — se comparte el mismo lenguaje
// visual a propósito, son la misma idea (una lista de "cosas que pasaron",
// con detalle al expandir) aplicada a otro contenido.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { listActiveKnowledgePills } from '../../api/userKnowledge'
import { fmtRelative } from '../../utils/formatDate'
import Icon from './Icon'

const SOURCE_LABELS: Record<string, string> = {
  chat: 'v2.knowledge.sourceChat',
  teach: 'v2.knowledge.sourceTeach',
  evening: 'v2.knowledge.sourceEvening',
  migracion: 'v2.knowledge.sourceMigration',
}

/** Texto de la ficha editable al desplegarla (Alberto, 16 sep 2026: "poder
 *  editar y anotar más cosas o corregir"). Guarda al salir del campo — la
 *  píldora es un nodo normal, así que el cambio sincroniza como cualquier
 *  edición y el chat lo ve en su siguiente turno. */
function PillEditor({ id, text }: { id: string; text: string }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(text)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { setValue(text) }, [text])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  const save = () => {
    const next = value.trim()
    if (!next) { setValue(text); return }
    if (next !== text) store.updateNode(id, { text: next })
  }
  return (
    <textarea
      ref={ref}
      className="v2-pill-edit"
      value={value}
      rows={2}
      onChange={e => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
        if (e.key === 'Escape') { setValue(text); (e.target as HTMLTextAreaElement).blur() }
      }}
      aria-label={t('v2.knowledge.edit', 'Editar lo que sabe de ti')}
    />
  )
}

/** Borra una ficha que el usuario ve incorrecta o inútil. Se marca `rejected`
 *  antes de borrarla para que el servidor no la vuelva a aprender tal cual
 *  (`rememberFacts` descarta hechos idénticos a uno rechazado). */
function rejectPill(id: string) {
  const node = store.getNode(id)
  if (!node) return
  let extra: Record<string, unknown> = {}
  try { extra = JSON.parse(node.extraData || '{}') } catch { /* */ }
  store.updateNode(id, { extraData: JSON.stringify({ ...extra, rejected: '1' }) })
  store.deleteNode(id)
}

export default function V2KnowledgePills() {
  const { t, i18n } = useTranslation()
  useStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState('')
  // Primer clic en la papelera arma el borrado, el segundo lo confirma.
  const [armed, setArmed] = useState<string | null>(null)

  // Sin useMemo: `useStore()` ya provoca un re-render en cada cambio del
  // store, y recalcular esta lista (filtrar hijos de un nodo) es barato —
  // mismo criterio que `rows` en V2ThreadHistory.tsx.
  const pills = listActiveKnowledgePills()
  const needle = q.trim().toLowerCase()
  const rows = needle ? pills.filter(p => p.text.toLowerCase().includes(needle)) : pills

  const sourceLabel = (source: string): string => {
    if (source.startsWith('note:')) return t('v2.knowledge.sourceNote', 'Nota o documento')
    const key = SOURCE_LABELS[source]
    return key ? t(key, source) : source
  }

  return (
    <div className="v2-hist v2-hist--list">
      <div className="v2-hist-search">
        <Icon name="search" size={14} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('v2.knowledge.searchPlaceholder', 'Buscar en lo que sabe de ti')}
        />
      </div>

      {rows.length === 0 ? (
        <div className="v2-hist-empty">
          {needle
            ? t('v2.history.noResults', 'Sin resultados.')
            : t('v2.knowledge.empty', 'Fromly todavía no ha aprendido nada por su cuenta — lo que escribas en el documento de arriba también cuenta, sin necesidad de esto.')}
        </div>
      ) : (
        <div className="v2-hist-list">
          {rows.map(p => {
            const isExpanded = !!expanded[p.id]
            return (
              <div key={p.id} className="v2-hist-item">
                <div
                  className="v2-hist-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  onKeyDown={e => { if (e.key === 'Enter') setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] })) }}
                >
                  <Icon name="sparkle" size={15} className="v2-hist-row-icon" />
                  <span className="v2-hist-row-main">
                    <span className="v2-hist-row-title">{p.text}</span>
                    <span className="v2-hist-row-meta">
                      {p.createdAt ? fmtRelative(p.createdAt, i18n.language) : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`v2-pill-delete${armed === p.id ? ' armed' : ''}`}
                    onClick={e => {
                      e.stopPropagation()
                      if (armed === p.id) { rejectPill(p.id); setArmed(null) } else setArmed(p.id)
                    }}
                    onMouseLeave={() => { if (armed === p.id) setArmed(null) }}
                    title={armed === p.id ? t('v2.knowledge.confirmDelete', 'Pulsa otra vez para eliminar') : t('v2.knowledge.delete', 'Eliminar')}
                    aria-label={t('v2.knowledge.delete', 'Eliminar')}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                  <button
                    type="button"
                    className="v2-hist-row-expand"
                    onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] })) }}
                    aria-label={isExpanded ? t('v2.history.collapse', 'Colapsar') : t('v2.history.expand', 'Leer completo')}
                    style={{ transform: isExpanded ? 'rotate(90deg)' : undefined }}
                  >
                    <Icon name="chevron-right" size={13} />
                  </button>
                </div>
                {isExpanded && (
                  <div className="v2-hist-expand">
                    <PillEditor id={p.id} text={p.text} />
                    <span className="v2-hist-expand-error">
                      {t('v2.knowledge.source', 'Origen')}: {sourceLabel(p.source)}
                      {p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString(i18n.language)}` : ''}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
