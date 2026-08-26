// PublishButton — icono 🌐 reutilizable para publicar/despublicar un nodo y copiar su
// enlace público. MISMA función que la bola del mundo de NodeView.tsx (notas clásicas),
// puesta aquí para reusar en el panel de documento del lienzo y en recursos (PDF/imagen).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '../types'
import { publishNodePublicly, unpublishNodePublicly } from '../utils/nodeExport'
import { parseExtraData } from '../utils/papeleraHelper'
import { userStore } from '../store/userStore'
import Icon from '../v2/components/Icon'

export default function PublishButton({ node }: { node: Node }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const published = !!node.publicSlug
  // Pista visual — el HASH real solo vive en el servidor (`publicNotes.passwordHash`);
  // esto es solo para pintar el candado, nunca lo que decide si el enlace pide
  // contraseña de verdad (26 ago 2026, ver utils/nodeExport.ts).
  const protectedNow = parseExtraData(node.extraData)._pubProtected === '1'

  const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))

  // `explicitPassword`: undefined → deja la contraseña como estuviera, salvo que
  // el usuario haya escrito algo en el campo (se usa eso); null → la quita
  // explícitamente (botón "Quitar contraseña", ignora lo que haya en el campo).
  const doPublish = async (explicitPassword?: string | null) => {
    // El servidor ya rechaza /notes/publish para free (402 publish_limit) —
    // esto evita el intento fallido y muestra el paywall en el punto de fricción.
    if (!userStore.hasAccess) {
      setMenuOpen(false)
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'publish_limit' } }))
      return
    }
    const password = explicitPassword !== undefined ? explicitPassword : (pwInput.trim() || undefined)
    setBusy(true)
    try {
      const url = await publishNodePublicly(node, password)
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      setPwInput('')
      toast(explicitPassword === null ? t('node.passwordRemoved', 'Contraseña quitada') : t('context.toastPublished'))
    } catch {
      toast(t('common.error', 'Ha ocurrido un error'))
    } finally {
      setBusy(false); setMenuOpen(false)
    }
  }

  const doUnpublish = async () => {
    setBusy(true)
    try {
      await unpublishNodePublicly(node)
      toast(t('context.toastUnpublished'))
    } finally {
      setBusy(false); setMenuOpen(false)
    }
  }

  const copyInternal = () => {
    navigator.clipboard.writeText(`https://fromly.app/app/node/${node.id}`).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    setMenuOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        title={published ? t('tip.publishedCopyLink') : t('tip.publishNote')}
        disabled={busy}
        onClick={() => setMenuOpen(v => !v)}
        style={{
          background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: busy ? 'default' : 'pointer',
          fontSize: 11, padding: '4px 7px', color: published ? '#22c55e' : 'var(--text-secondary,#666)', opacity: busy ? 0.6 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {protectedNow && <Icon name="lock" size={10} />}
        {copied ? t('common.copied', '¡Copiado!') : null}
      </button>
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 1000, minWidth: 220,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          }}>
            <button onClick={() => doPublish()} style={shareMenuItem}>
              <Icon name="external" size={13} /> {published ? t('node.refreshAndCopy', 'Actualizar y copiar enlace') : t('node.publishAndCopy')}
            </button>
            <button onClick={copyInternal} style={shareMenuItem}><Icon name="link" size={13} /> {t('node.copyInternalLink')}</button>
            {published && (
              <button onClick={doUnpublish} style={{ ...shareMenuItem, color: '#dc2626' }}>
                <Icon name="close" size={13} /> {t('tip.unpublishNote')}
              </button>
            )}
            {/* Contraseña opcional del enlace público — por defecto sin ella (26 ago
                2026). Vacío en "Actualizar" no la toca; solo se cambia si se escribe
                algo aquí, o se quita del todo con el botón de abajo. */}
            <div style={{ borderTop: '1px solid var(--border,#e2e2e2)', margin: '4px 0', paddingTop: 6, padding: '6px 9px 4px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary,#999)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="lock" size={11} /> {protectedNow ? t('node.passwordProtected', 'Protegido con contraseña') : t('node.passwordOptional', 'Contraseña opcional')}
              </div>
              <input
                type="password"
                value={pwInput}
                onChange={e => setPwInput(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder={protectedNow ? t('node.passwordChangePlaceholder', 'Escribe para cambiarla') : t('node.passwordSetPlaceholder', 'Sin contraseña')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 12, outline: 'none' }}
              />
              {protectedNow && (
                <button onClick={() => doPublish(null)} style={{ ...shareMenuItem, color: '#dc2626', padding: '6px 2px 2px', fontSize: 12 }}>
                  {t('node.removePassword', 'Quitar contraseña')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const shareMenuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 6,
  padding: '7px 9px', fontSize: 13, color: 'var(--text,#333)', cursor: 'pointer',
}
