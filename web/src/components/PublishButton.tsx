// PublishButton — icono 🌐 reutilizable para publicar/despublicar un nodo y copiar su
// enlace público. MISMA función que la bola del mundo de NodeView.tsx (notas clásicas),
// puesta aquí para reusar en el panel de documento del lienzo y en recursos (PDF/imagen).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '../types'
import { publishNodePublicly, unpublishNodePublicly } from '../utils/nodeExport'

export default function PublishButton({ node }: { node: Node }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const published = !!node.publicSlug

  const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))

  const doPublish = async () => {
    setBusy(true)
    try {
      const url = await publishNodePublicly(node)
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast(t('context.toastPublished'))
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
        onClick={() => published ? doPublish() : setMenuOpen(v => !v)}
        style={{
          background: 'none', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: busy ? 'default' : 'pointer',
          fontSize: 11, padding: '4px 7px', color: published ? '#22c55e' : 'var(--text-secondary,#666)', opacity: busy ? 0.6 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {copied ? t('common.copied', '¡Copiado!') : null}
      </button>
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 1000, minWidth: 190,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          }}>
            <button onClick={doPublish} style={shareMenuItem}>🌐 {t('node.publishAndCopy')}</button>
            <button onClick={copyInternal} style={shareMenuItem}>🔗 {t('node.copyInternalLink')}</button>
          </div>
        </>
      )}
      {published && (
        <button title={t('tip.unpublishNote')} disabled={busy} onClick={doUnpublish}
          style={{ background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', fontSize: 10, padding: '2px 4px', color: 'var(--text-tertiary,#999)', marginLeft: 2 }}>
          ✕
        </button>
      )}
    </div>
  )
}

const shareMenuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 6,
  padding: '7px 9px', fontSize: 13, color: 'var(--text,#333)', cursor: 'pointer',
}
