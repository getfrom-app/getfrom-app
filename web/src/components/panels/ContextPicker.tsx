// ContextPicker — selector de contexto por TAG ANIDADO: se escribe y se lee
// siempre igual, `#tag`, `#tag/subtag`, `#tag/subtag/subtag`. Cada tramo de la
// ruta es un contexto (los subtags son contextos hijos, los de siempre); lo que
// se asigna al elemento es el ÚLTIMO tramo.
//
// Antes había que elegir un contexto de una lista plana y, aparte, abrirlo para
// darle un contexto padre. Ahora la jerarquía se escribe en la misma línea
// (Alberto, 20 ago 2026: "va a ser más sencillo").
//
// Lo usan RowContextChip (chip «?») y RightColMenu (clic derecho). Renderiza el
// input + la lista; el contenedor (chrome/posición) lo pone el llamante.
import { useState, useRef, useEffect, useMemo } from 'react'
import {
  listContextTags, contextColor, normalizeContextPath, findContextByPath,
  ensureContextPath, type ContextTag,
} from '../../utils/cajones'
import type { Node } from '../../types'
import { useTranslation } from 'react-i18next'
import Icon from '../../v2/components/Icon'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ContextPicker({ currentId, onPick, autoFocus = true, exclude }: {
  currentId: string | null
  /** id del contexto elegido/creado, o null para QUITAR (al pulsar el actual). */
  onPick: (id: string | null) => void
  autoFocus?: boolean
  /** opcional: oculta de la lista los contextos para los que devuelve true (p.ej. self/descendientes al reparentar). */
  exclude?: (c: Node) => boolean
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const tags = listContextTags().filter(tg => !exclude?.(tg.node))

  useEffect(() => { if (autoFocus) setTimeout(() => inputRef.current?.focus(), 20) }, [autoFocus])

  // El `#` inicial es decorativo: se acepta escrito o no.
  const raw = q.replace(/^#/, '')
  const nq = norm(raw.trim())

  // Filtra por la ruta COMPLETA: escribir «marketing» encuentra
  // `#la-isla/marketing` igual que escribir «isla/mar».
  const filtered = useMemo<ContextTag[]>(() => {
    if (!nq) return tags
    return tags.filter(tg => norm(tg.path).includes(nq) || norm(tg.label).includes(nq))
  }, [nq, tags])

  // Solo se ofrece crear si la ruta escrita no existe TAL CUAL.
  const typedPath = normalizeContextPath(raw)
  const canCreate = !!typedPath && !findContextByPath(typedPath)

  const total = filtered.length + (canCreate ? 1 : 0)
  useEffect(() => { setActiveIdx(0) }, [nq])

  function pick(tg: ContextTag) { onPick(currentId === tg.node.id ? null : tg.node.id) }
  function createAndPick() {
    const leaf = ensureContextPath(raw)
    if (leaf) onPick(leaf.id)
  }
  function confirmActive() {
    if (activeIdx < filtered.length) pick(filtered[activeIdx])
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
        placeholder={t('contextPicker.searchOrCreate')}
      />
      <div className="ctx-pick-list">
        {filtered.map((tg, idx) => (
          <button key={tg.node.id} className={`ctx-pick-item${idx === activeIdx ? ' active' : ''}`}
            style={{ paddingLeft: 8 + (tg.depth - 1) * 12 }}
            onMouseEnter={() => setActiveIdx(idx)} onClick={() => pick(tg)}>
            <span className="ctx-pick-dot" style={{ background: contextColor(tg.node.id) }} />
            <span className="ctx-pick-name" title={`#${tg.path}`}>
              {/* Los tramos padre en gris, el tramo propio en el color del texto:
                  se lee la jerarquía de un vistazo sin repetir toda la ruta. */}
              <span className="ctx-pick-path">#{tg.path.split('/').slice(0, -1).map(p => p + '/').join('')}</span>
              <span className="ctx-pick-leaf">{tg.path.split('/').slice(-1)[0]}</span>
            </span>
            {currentId === tg.node.id && <span className="ctx-pick-check"><Icon name="check" size={12} strokeWidth={2.4} /></span>}
          </button>
        ))}
        {canCreate && (
          <button className={`ctx-pick-item ctx-pick-create${filtered.length === activeIdx ? ' active' : ''}`}
            onMouseEnter={() => setActiveIdx(filtered.length)} onClick={createAndPick}>
            <span className="ctx-pick-dot ctx-pick-dot--new">+</span>
            <span className="ctx-pick-name">{t('contextPicker.create', { path: `#${typedPath}` })}</span>
          </button>
        )}
        {filtered.length === 0 && !canCreate && <div className="ctx-pick-empty">{t('contextPicker.empty')}</div>}
      </div>
    </>
  )
}
