// MARK: - FeedbackButton
//
// Botón flotante (abajo-izquierda) con etiqueta «Beta» que abre un modal para
// enviar feedback o reportar un fallo. El mensaje llega a la Bandeja del
// dashboard (POST /contact/feedback) junto con la versión y la URL actual.
//
// Enter envía · Shift+Enter = salto de línea.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sendFeedback } from '../../api/client'
import { WEB_VERSION } from '../layout/StatusBar'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function FeedbackButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setStatus('idle')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function submit() {
    const text = message.trim()
    if (!text || status === 'sending') return
    setStatus('sending')
    try {
      await sendFeedback(text, WEB_VERSION)
      setStatus('sent')
      setMessage('')
      setTimeout(() => setOpen(false), 1600)
    } catch {
      setStatus('error')
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        title={t('feedback.tooltip')}
        style={{
          position: 'fixed', bottom: 38, left: 16, zIndex: 9998,
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#ffffff', border: '1px solid rgba(62,92,118,0.25)',
          borderRadius: 999, padding: '7px 13px 7px 11px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.10)', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#5b21b6',
          transition: 'box-shadow 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(62,92,118,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <span style={{ fontSize: 14 }}>💬</span>
        <span>{t('feedback.buttonLabel')}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
          background: 'linear-gradient(135deg, #3E5C76, #2C4356)', color: '#fff',
          borderRadius: 5, padding: '1px 5px',
        }}>BETA</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(20,16,40,0.32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{
            width: 'min(460px, 100%)', background: '#fff', borderRadius: 16,
            boxShadow: '0 16px 60px rgba(0,0,0,0.28)', overflow: 'hidden',
          }}>
            {/* Cabecera */}
            <div style={{
              background: 'linear-gradient(135deg, #3E5C76, #2C4356)',
              padding: '16px 20px', color: '#fff',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>
                {t('feedback.title')}
              </div>
              <div style={{ fontSize: 12.5, opacity: 0.92, lineHeight: 1.5 }}>
                {t('feedback.subtitle')}
              </div>
            </div>

            {status === 'sent' ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🙌</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                  {t('feedback.thanksTitle')}
                </div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  {t('feedback.thanksSubtitle')}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px 20px 18px' }}>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('feedback.placeholder')}
                  rows={5}
                  style={{
                    width: '100%', resize: 'vertical', minHeight: 110,
                    border: '1px solid #e3e0ef', borderRadius: 10,
                    padding: '11px 13px', fontSize: 14, lineHeight: 1.5,
                    fontFamily: 'inherit', color: '#1a1a1a', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#8FB4D9')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e3e0ef')}
                />
                {status === 'error' && (
                  <div style={{ fontSize: 12.5, color: '#dc2626', marginTop: 8 }}>
                    {t('feedback.error')}
                  </div>
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 12,
                }}>
                  <span style={{ fontSize: 11.5, color: '#aaa' }}>{t('feedback.enterHint')}</span>
                  <button
                    onClick={submit}
                    disabled={!message.trim() || status === 'sending'}
                    style={{
                      background: !message.trim() || status === 'sending'
                        ? '#9FB8CB' : 'linear-gradient(135deg, #3E5C76, #2C4356)',
                      color: '#fff', border: 'none', borderRadius: 9,
                      padding: '9px 18px', fontSize: 13.5, fontWeight: 600,
                      cursor: !message.trim() || status === 'sending' ? 'default' : 'pointer',
                    }}
                  >
                    {status === 'sending' ? t('feedback.sending') : t('feedback.send')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
