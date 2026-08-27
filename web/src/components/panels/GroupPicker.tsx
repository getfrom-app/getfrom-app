// GroupPicker — añadir UN elemento a un grupo existente, o crear uno nuevo al
// vuelo si no existe todavía (Alberto, 27 ago 2026: "en todos los elementos
// añadimos... un botón de carpeta para añadir a un grupo. si no existe el
// grupo también se podrá crear en ese momento"). Mismo patrón que
// ContextPicker.tsx (input + lista filtrada + opción «crear»), pero contra
// grupos (utils/groups.ts) en vez de contextos.
import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { allGroups, addToGroup, createGroup, groupsContaining } from '../../utils/groups'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function GroupPicker({ nodeId, onDone, autoFocus = true }: {
  nodeId: string
  /** Se llama tras añadir a un grupo (existente o recién creado). */
  onDone: (groupId: string) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const memberOf = useMemo(() => new Set(groupsContaining(nodeId).map(g => g.id)), [nodeId])
  const groups = useMemo(() => allGroups().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [])

  useEffect(() => { if (autoFocus) setTimeout(() => inputRef.current?.focus(), 20) }, [autoFocus])

  const nq = norm(q.trim())
  const filtered = useMemo(() => {
    if (!nq) return groups
    return groups.filter(g => norm(g.text || '').includes(nq))
  }, [nq, groups])

  const canCreate = !!q.trim() && !groups.some(g => norm(g.text || '') === nq)
  const total = filtered.length + (canCreate ? 1 : 0)
  useEffect(() => { setActiveIdx(0) }, [nq])

  function pick(groupId: string) { addToGroup(groupId, nodeId); onDone(groupId) }
  function createAndPick() {
    const created = createGroup(q.trim(), [nodeId])
    onDone(created.id)
  }
  function confirmActive() {
    if (activeIdx < filtered.length) pick(filtered[activeIdx].id)
    else if (canCreate) createAndPick()
  }

  return (
    <>
      <input
        ref={inputRef}
        className="ctx-pick-search"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, Math.max(0, total - 1))) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); confirmActive() }
        }}
        placeholder={t('groupPicker.searchOrCreate', 'Buscar o crear grupo…')}
      />
      <div className="ctx-pick-list">
        {filtered.map((g, idx) => (
          <button key={g.id} className={`ctx-pick-item${idx === activeIdx ? ' active' : ''}`}
            onMouseEnter={() => setActiveIdx(idx)} onClick={() => pick(g.id)}>
            <span className="ctx-pick-name">{g.text}</span>
            {memberOf.has(g.id) && <span className="ctx-pick-check">✓</span>}
          </button>
        ))}
        {canCreate && (
          <button className={`ctx-pick-item ctx-pick-create${filtered.length === activeIdx ? ' active' : ''}`}
            onMouseEnter={() => setActiveIdx(filtered.length)} onClick={createAndPick}>
            <span className="ctx-pick-dot ctx-pick-dot--new">+</span>
            <span className="ctx-pick-name">{t('groupPicker.create', 'Crear grupo «{{name}}»', { name: q.trim() })}</span>
          </button>
        )}
        {filtered.length === 0 && !canCreate && <div className="ctx-pick-empty">{t('groupPicker.empty', 'Sin grupos todavía')}</div>}
      </div>
    </>
  )
}
