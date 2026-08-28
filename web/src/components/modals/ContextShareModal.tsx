// ContextShareModal — publicar un CONTEXTO entero (su nota + sus elementos)
// con URL propia, desde el botón 🌐 de la nota del contexto (28 ago 2026,
// Alberto: "se abrirá la página de compartir igual que ocurre en un grupo").
// Mismos campos que GroupView.tsx (nombre del enlace, descripción,
// contraseña), pero los elementos son de solo lectura (se resuelven por
// `_ctxRefs`, no se curan a mano como en un grupo).
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { nodesInContext } from '../../utils/cajones'
import { publishContextPublicly, unpublishContextPublicly } from '../../utils/contextPublish'
import { classifyElement } from '../../v2/elementKind'
import { elementDisplayTitle } from '../../utils/docNode'
import { displayTitle } from '../../utils/displayText'
import { userStore } from '../../store/userStore'
import { parseExtraData } from '../../utils/papeleraHelper'
import Icon from '../../v2/components/Icon'

export default function ContextShareModal({ contextNode, onClose }: { contextNode: Node; onClose: () => void }) {
  const { t } = useTranslation()
  const s = useStore()
  void s.nodesVersion
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [descInput, setDescInput] = useState(() => (parseExtraData(contextNode.extraData)._pubDescription as string) || '')
  const protectedNow = parseExtraData(contextNode.extraData)._pubProtected === '1'
  const published = !!contextNode.publicSlug

  const elements = useMemo(() => nodesInContext(contextNode.id), [contextNode.id, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentCustomSlug = useMemo(() => {
    if (!contextNode.publicSlug) return ''
    const parts = contextNode.publicSlug.split('/')
    return parts[parts.length - 1] || ''
  }, [contextNode.publicSlug])
  const [slugInput, setSlugInput] = useState(currentCustomSlug)
  useEffect(() => { setSlugInput(currentCustomSlug) }, [contextNode.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const userSlug = userStore.user?.userSlug || t('group.yourUsername', 'tu-usuario')

  function normalizePreview(v: string): string {
    return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }
  const previewSlug = normalizePreview(slugInput) || normalizePreview(contextNode.text || '') || 'contexto'

  async function doPublish(explicitPassword?: string | null) {
    if (!userStore.hasAccess) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'publish_limit' } }))
      return
    }
    const password = explicitPassword !== undefined ? explicitPassword : (pwInput.trim() || undefined)
    const description = descInput.trim() || undefined
    setSlugError(null)
    setBusy(true)
    try {
      const url = await publishContextPublicly(contextNode, slugInput.trim() || undefined, password, description)
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      setPwInput('')
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: explicitPassword === null ? t('node.passwordRemoved', 'Contraseña quitada') : t('context.publishedToast', 'Contexto publicado — enlace copiado'), type: 'success' } }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'custom_slug_taken') setSlugError(t('group.slugTaken', 'Ya tienes un contexto publicado con ese nombre — prueba otro.'))
      else if (msg === 'invalid_custom_slug') setSlugError(t('group.slugInvalid', 'Usa solo letras, números, guiones y guiones bajos.'))
      else window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('common.error', 'Ha ocurrido un error'), type: 'error' } }))
    } finally { setBusy(false) }
  }

  async function doUnpublish() {
    setBusy(true)
    try {
      await unpublishContextPublicly(contextNode)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('context.unpublishedToast', 'Contexto despublicado'), type: 'success' } }))
    } finally { setBusy(false) }
  }

  function copyLink() {
    if (!contextNode.publicSlug) return
    navigator.clipboard.writeText(`https://fromly.app/c/${contextNode.publicSlug}`).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="external" size={18} /></span>
          <h2>{t('context.shareTitle', 'Compartir contexto completo')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary,#666)' }}>
            {t('context.shareHint', 'Publica {{name}} entero — su nota y sus elementos — en una página propia.', { name: contextNode.text || t('common.noTitle') })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: published ? '#22c55e' : 'var(--text-tertiary,#999)', display: 'flex' }}><Icon name="external" size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {published ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text,#222)' }}>{t('group.published', 'Publicado')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary,#999)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    fromly.app/c/{contextNode.publicSlug}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary,#666)' }}>{t('context.notPublished', 'Este contexto no tiene enlace público todavía.')}</div>
              )}
            </div>
            {published && (
              <button onClick={copyLink} disabled={busy} style={btnSecondary}>{copied ? t('common.copied', '¡Copiado!') : t('group.copyLink', 'Copiar enlace')}</button>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary,#999)', display: 'block', marginBottom: 4 }}>
              {t('group.customSlugLabel', 'Nombre personalizado del enlace')}
            </label>
            <input
              value={slugInput}
              onChange={e => { setSlugError(null); setSlugInput(e.target.value) }}
              placeholder={t('group.customSlugPlaceholder', 'p.ej. diabeticos-alicante')}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: `1px solid ${slugError ? '#dc2626' : 'var(--border,#e2e2e2)'}`, background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none' }}
            />
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', marginTop: 4, overflowWrap: 'anywhere' }}>
              fromly.app/c/{userSlug}/{previewSlug}
            </div>
            {slugError && <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 4 }}>{slugError}</div>}
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary,#999)', display: 'block', marginBottom: 4 }}>
              {t('group.descriptionLabel', 'Descripción (opcional)')}
            </label>
            <input
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              placeholder={t('group.descriptionPlaceholder', 'Una frase que aparecerá bajo el título')}
              maxLength={300}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary,#999)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Icon name="lock" size={12} /> {protectedNow ? t('node.passwordProtected', 'Protegido con contraseña') : t('node.passwordOptional', 'Contraseña opcional')}
            </label>
            <input
              type="password"
              value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              placeholder={protectedNow ? t('node.passwordChangePlaceholder', 'Escribe para cambiarla') : t('node.passwordSetPlaceholder', 'Sin contraseña')}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none' }}
            />
            {protectedNow && (
              <button onClick={() => doPublish(null)} disabled={busy} style={{ ...btnDanger, marginTop: 6, padding: '2px 0' }}>
                {t('node.removePassword', 'Quitar contraseña')}
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-tertiary,#999)' }}>
            {t('group.memberCount', '{{count}} elemento(s)', { count: elements.length })}
          </div>
          {elements.length > 0 && (
            <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, padding: 6 }}>
              {elements.slice(0, 30).map(n => {
                const kind = classifyElement(n)
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: 12.5, color: 'var(--text,#333)' }}>
                    <Icon name={kind?.icon || 'document'} size={13} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle(elementDisplayTitle(n), t('common.noTitle'))}</span>
                  </div>
                )
              })}
              {elements.length > 30 && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', padding: '4px 6px' }}>+{elements.length - 30} más</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            {published ? (
              <>
                <button onClick={() => doPublish()} disabled={busy} style={btnSecondary}>{t('group.refresh', 'Actualizar')}</button>
                <button onClick={doUnpublish} disabled={busy} style={btnDanger}>{t('group.unpublish', 'Despublicar')}</button>
              </>
            ) : (
              <button onClick={() => doPublish()} disabled={busy} style={btnPrimary}>
                {copied ? t('common.copied', '¡Copiado!') : t('group.publish', 'Crear enlace público')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

const btnBase: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border,#e2e2e2)', borderRadius: 6,
  cursor: 'pointer', padding: '6px 10px', fontFamily: 'inherit', flexShrink: 0,
}
const btnSecondary: React.CSSProperties = { ...btnBase, background: 'var(--bg,#fff)', color: 'var(--text-secondary,#666)' }
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--accent,#6c5ce7)', color: '#fff', border: 'none' }
const btnDanger: React.CSSProperties = { ...btnBase, background: 'none', color: '#dc2626', border: 'none' }
