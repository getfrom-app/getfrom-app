/**
 * TeachMagicModal — Enseñar a Magic con una corrección en lenguaje natural.
 *
 * El usuario escribe o graba (voz) una corrección sobre un nodo y Magic la
 * interpreta: reasigna contexto, cambia el tipo, actualiza el perfil y/o
 * recuerda una regla para no repetir el error.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { useRecordingStore } from '../../store/recordingStore'
import { teachMagic, applyTeachResult } from '../../api/teachMagic'

interface Props {
  nodeId: string
  onClose: () => void
}

export default function TeachMagicModal({ nodeId, onClose }: Props) {
  const { t } = useTranslation()
  const rec = useRecordingStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const node = store.getNode(nodeId)
  const nodeText = (node?.text || '').slice(0, 80)
  const isRecording = rec.phase === 'recording'

  // Reflejar la transcripción en vivo mientras se graba.
  useEffect(() => {
    if (rec.phase === 'recording') setText(rec.transcript)
    else if (rec.phase === 'done') { setText(rec.finalText); rec.resetRecording() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript, rec.phase])

  // Detener grabación al desmontar.
  useEffect(() => {
    return () => { if (rec.phase === 'recording') rec.stopRecording() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleRecord() {
    if (isRecording) {
      rec.stopRecording()
    } else {
      rec.resetRecording()
      rec.startRecording()
    }
  }

  async function send() {
    const correction = text.trim()
    if (!correction || sending) return
    if (isRecording) rec.stopRecording()
    setSending(true)
    try {
      const result = await teachMagic(correction, nodeId)
      const summary = await applyTeachResult(nodeId, result)
      window.dispatchEvent(new CustomEvent('from:toast', { detail: {
        message: summary.length > 0 ? `✦ ${summary.join(' · ')}` : t('teach.applied', '✦ Magic ha aprendido'),
        type: 'success',
      }}))
      onClose()
    } catch {
      window.dispatchEvent(new CustomEvent('from:toast', { detail: {
        message: t('teach.error', 'No se pudo procesar la corrección'),
        type: 'error',
      }}))
      setSending(false)
    }
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onClose}
    >
      <div
        style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '24px 24px 20px', width: 460, maxWidth: '92vw', boxShadow: '0 24px 80px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 14 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>✦ {t('teach.title', 'Enseñar a Magic')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
        </div>

        {nodeText && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nodeText}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t('teach.hint', 'Corrige a Magic con tus palabras. Ej: "esto no es de la isla, es de mi trading" o "Marina es mi novia, no mi tía".')}
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
            placeholder={t('teach.placeholder', 'Escribe tu corrección…')}
            rows={3}
            style={{ flex: 1, resize: 'vertical', fontSize: 13, padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
          />
          {rec.isSupported && (
            <button
              onClick={toggleRecord}
              title={isRecording ? t('teach.stop', 'Detener') : t('teach.record', 'Grabar voz')}
              style={{
                flexShrink: 0, width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                background: isRecording ? 'var(--color-error, #e53e3e)' : 'var(--bg-secondary)',
                color: isRecording ? '#fff' : 'var(--text-secondary)',
                border: isRecording ? 'none' : '1px solid var(--border)',
                animation: isRecording ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            >{isRecording ? '⏹' : '🎤'}</button>
          )}
        </div>

        {isRecording && (
          <div style={{ fontSize: 11, color: 'var(--color-error, #e53e3e)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {t('teach.recording', 'Grabando…')} {rec.elapsed}s
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >{t('common.cancel', 'Cancelar')}</button>
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!text.trim() || sending) ? 0.5 : 1 }}
          >{sending ? t('teach.sending', 'Procesando…') : t('teach.send', 'Enseñar')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
