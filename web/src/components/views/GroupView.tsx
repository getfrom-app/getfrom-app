/**
 * GroupView — vista central de un GRUPO (varios elementos agrupados: notas,
 * imágenes, PDFs, mezcla). Listar/quitar/añadir miembros y publicar un enlace
 * público que los muestra todos de solo lectura. El título/renombrado del
 * grupo lo pone la cabecera ambiente (V2ElementView `EditableTitle`, igual que
 * cualquier otro elemento) — aquí NO se repite ese control.
 * Ver landing/web/src/utils/groups.ts para el modelo de datos.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { groupMembers, addToGroup, removeFromGroup, publishGroupPublicly, unpublishGroupPublicly } from '../../utils/groups'
import { classifyElement } from '../../v2/elementKind'
import { elementDisplayTitle } from '../../utils/docNode'
import { displayTitle } from '../../utils/displayText'
import { openNodeDetail } from '../../utils/canvasNav'
import { userStore } from '../../store/userStore'
import Icon from '../../v2/components/Icon'

export default function GroupView({ node }: { node: Node }) {
  const { t } = useTranslation()
  const s = useStore()
  void s.nodesVersion
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')

  const members = useMemo(() => groupMembers(node), [node, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members])
  const published = !!node.publicSlug

  function open(id: string) {
    openNodeDetail(id)
  }

  function remove(id: string) {
    removeFromGroup(node.id, id)
  }

  const candidates = useMemo(() => {
    if (!adding) return []
    const nq = q.trim().toLowerCase()
    const out: Node[] = []
    for (const n of store.allActive()) {
      if (n.id === node.id || n.deletedAt || memberIds.has(n.id)) continue
      const kind = classifyElement(n)
      if (!kind) continue
      const title = displayTitle(elementDisplayTitle(n), t('common.noTitle'))
      if (nq && !title.toLowerCase().includes(nq)) continue
      out.push(n)
      if (out.length >= 40) break
    }
    return out
  }, [adding, q, node.id, memberIds, t])

  async function doPublish() {
    if (!userStore.hasAccess) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'publish_limit' } }))
      return
    }
    setBusy(true)
    try {
      const url = await publishGroupPublicly(node)
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('group.publishedToast', 'Grupo publicado — enlace copiado'), type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('common.error', 'Ha ocurrido un error'), type: 'error' } }))
    } finally { setBusy(false) }
  }

  async function doUnpublish() {
    setBusy(true)
    try {
      await unpublishGroupPublicly(node)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('group.unpublishedToast', 'Grupo despublicado'), type: 'success' } }))
    } finally { setBusy(false) }
  }

  function copyLink() {
    if (!node.publicSlug) return
    navigator.clipboard.writeText(`https://fromly.app/g/${node.publicSlug}`).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-tertiary,#999)', marginBottom: 22 }}>
        <span style={{ color: 'var(--accent,#6c5ce7)', display: 'flex' }}><Icon name="folder" size={15} /></span>
        {t('group.memberCount', '{{count}} elemento(s)', { count: members.length })}
      </div>

      {/* ── Publicar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
        background: 'var(--bg-elevated,#f7f7fa)', border: '1px solid var(--border,#e2e2e2)', marginBottom: 24,
      }}>
        <span style={{ color: published ? '#22c55e' : 'var(--text-tertiary,#999)', display: 'flex' }}><Icon name="external" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {published ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text,#222)' }}>{t('group.published', 'Publicado')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary,#999)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                fromly.app/g/{node.publicSlug}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary,#666)' }}>{t('group.notPublished', 'Este grupo no tiene enlace público todavía.')}</div>
          )}
        </div>
        {published ? (
          <>
            <button onClick={copyLink} disabled={busy} style={btnSecondary}>{copied ? t('common.copied', '¡Copiado!') : t('group.copyLink', 'Copiar enlace')}</button>
            <button onClick={doPublish} disabled={busy} style={btnSecondary}>{t('group.refresh', 'Actualizar')}</button>
            <button onClick={doUnpublish} disabled={busy} style={btnDanger}>{t('group.unpublish', 'Despublicar')}</button>
          </>
        ) : (
          <button onClick={doPublish} disabled={busy || members.length === 0} style={btnPrimary}>
            {copied ? t('common.copied', '¡Copiado!') : t('group.publish', 'Crear enlace público')}
          </button>
        )}
      </div>

      {/* ── Miembros ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary,#666)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {t('group.elements', 'Elementos')}
        </div>
        <button onClick={() => setAdding(v => !v)} style={btnSecondary}>
          {adding ? t('common.close', 'Cerrar') : t('group.addElements', '+ Añadir elementos')}
        </button>
      </div>

      {adding && (
        <div style={{ border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 10, marginBottom: 16, background: 'var(--bg,#fff)' }}>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('elements.searchShort', 'Buscar')}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none', marginBottom: 8 }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {candidates.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary,#999)', padding: '6px 4px' }}>{t('elements.empty', 'Nada por aquí')}</div>
            ) : candidates.map(n => {
              const kind = classifyElement(n)
              const title = displayTitle(elementDisplayTitle(n), t('common.noTitle'))
              return (
                <div
                  key={n.id}
                  onClick={() => addToGroup(node.id, n.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 6, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: 'var(--text-tertiary)', display: 'flex' }}><Icon name={kind?.icon || 'document'} size={14} /></span>
                  <span style={{ fontSize: 13, color: 'var(--text,#222)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                  <span style={{ fontSize: 11, color: 'var(--accent,#6c5ce7)', fontWeight: 600 }}>{t('group.add', 'Añadir')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px 4px' }}>
          {t('group.empty', 'Este grupo no tiene elementos todavía. Añade alguno arriba.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {members.map(m => {
            const kind = classifyElement(m)
            const title = displayTitle(elementDisplayTitle(m), t('common.noTitle'))
            return (
              <div
                key={m.id}
                className="dc-row"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#e2e2e2)' }}
                onClick={() => open(m.id)}
              >
                <span style={{ color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}><Icon name={kind?.icon || 'document'} size={16} /></span>
                <span style={{ fontSize: 14, color: 'var(--text,#222)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary,#999)', flexShrink: 0 }}>{kind?.label}</span>
                <button
                  title={t('group.remove', 'Quitar del grupo')}
                  onClick={e => { e.stopPropagation(); remove(m.id) }}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: '2px 5px', borderRadius: 4, fontSize: 15, lineHeight: 1 }}
                >✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const btnBase: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border,#e2e2e2)', borderRadius: 6,
  cursor: 'pointer', padding: '6px 10px', fontFamily: 'inherit', flexShrink: 0,
}
const btnSecondary: React.CSSProperties = { ...btnBase, background: 'var(--bg,#fff)', color: 'var(--text-secondary,#666)' }
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--accent,#6c5ce7)', color: '#fff', border: 'none' }
const btnDanger: React.CSSProperties = { ...btnBase, background: 'none', color: '#dc2626', border: 'none' }
