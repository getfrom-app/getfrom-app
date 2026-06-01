// MARK: - WebRecordingBar
//
// Grabadora de larga duración en el sidebar.
// Al parar: IA analiza la transcripción y crea nodos en el diario de hoy
// con transcripción, resumen y tareas (si las hay), todos colapsados.

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRecordingStore } from '../../store/recordingStore'
import { processRecording, type ProcessingResult } from '../../utils/recordingProcessor'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

type MicPermission = 'unknown' | 'granted' | 'denied' | 'prompt'
type ProcessState  = 'idle' | 'processing' | 'done' | 'error'

export default function WebRecordingBar() {
  const r = useRecordingStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [micPerm, setMicPerm] = useState<MicPermission>('unknown')
  const [processState, setProcessState] = useState<ProcessState>('idle')
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [processError, setProcessError] = useState('')
  const prevPhase = useRef(r.phase)

  // Comprobar permiso de micrófono al montar
  useEffect(() => {
    if (!navigator.permissions) { setMicPerm('prompt'); return }
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then(status => {
        setMicPerm(status.state as MicPermission)
        status.onchange = () => setMicPerm(status.state as MicPermission)
      })
      .catch(() => setMicPerm('prompt'))
  }, [])

  // Detectar cuando la grabación para → lanzar IA
  useEffect(() => {
    if (prevPhase.current === 'recording' && r.phase === 'done') {
      handleProcessRecording()
    }
    prevPhase.current = r.phase
  }, [r.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleProcessRecording() {
    const transcript = r.finalText.trim()

    // Sin transcripción: reset directo
    if (!transcript) {
      setProcessState('error')
      setProcessError('No se detectó audio transcribible. Comprueba que el micrófono esté activo.')
      return
    }

    setProcessState('processing')
    setResult(null)
    setProcessError('')

    try {
      const res = await processRecording(transcript, r.elapsed)
      setResult(res)
      setProcessState('done')
    } catch (e) {
      if (e instanceof Error && e.message === 'TOKENS') {
        // El paywall ya se disparó desde recordingProcessor
        setProcessState('idle')
        r.resetRecording()
      } else {
        setProcessError(e instanceof Error ? e.message : 'Error al procesar con IA')
        setProcessState('error')
      }
    }
  }

  function handleReset() {
    r.resetRecording()
    setProcessState('idle')
    setResult(null)
    setProcessError('')
  }

  // ── Permiso denegado ────────────────────────────────────────────────────
  if (micPerm === 'denied') {
    return (
      <div className="rec-bar rec-bar--warning">
        <span style={{ fontSize: 14 }}>🎙</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)' }}>{t('recording.micBlocked')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.3, marginTop: 1 }}>
            {t('recording.micInstructions')}
          </div>
        </div>
      </div>
    )
  }

  // ── Error de store (fallo en getUserMedia, etc.) ────────────────────────
  if (r.error && processState === 'idle') {
    return (
      <div className="rec-bar rec-bar--warning">
        <span style={{ fontSize: 14 }}>⚠️</span>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--warning)', lineHeight: 1.3 }}>{r.error}</div>
        <button className="rec-bar-icon-btn" onClick={() => r.resetRecording()} title={t('recording.retry')} style={{ fontSize: 14 }}>↺</button>
      </div>
    )
  }

  // ── Procesando con IA ───────────────────────────────────────────────────
  if (processState === 'processing') {
    return (
      <div className="rec-bar" style={{ gap: 8 }}>
        <span className="rec-bar-processing-dot" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>Analizando con IA…</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
            Creando resumen y tareas
          </div>
        </div>
      </div>
    )
  }

  // ── Error de procesamiento ──────────────────────────────────────────────
  if (processState === 'error') {
    return (
      <div className="rec-bar rec-bar--warning" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--warning)', lineHeight: 1.3 }}>{processError}</div>
          <button className="rec-bar-icon-btn" onClick={handleReset} title="Reintentar">↺</button>
        </div>
        {/* Botón de copia manual como fallback */}
        {r.finalText && (
          <button
            className="rec-bar-ai-btn rec-bar-ai-btn--secondary"
            style={{ width: '100%', fontSize: 11 }}
            onClick={() => navigator.clipboard.writeText(r.finalText).catch(() => {})}
          >
            Copiar transcripción
          </button>
        )}
      </div>
    )
  }

  // ── Nodo creado con éxito ───────────────────────────────────────────────
  if (processState === 'done' && result) {
    return (
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div className="rec-bar" style={{ borderTop: 'none', gap: 8 }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>Guardado en el diario</div>
            <div style={{
              fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              🎙 {result.title}
              {result.hasTasks ? ' · con tareas' : ''}
            </div>
          </div>
          <button className="rec-bar-icon-btn" onClick={handleReset} title="Nueva grabación">↺</button>
        </div>
        <div style={{ padding: '0 8px 8px', display: 'flex', gap: 4 }}>
          <button
            className="rec-bar-ai-btn"
            onClick={() => {
              const node = store.getNode(result.parentId)
              if (node) navigate(`/node/${node.parentId ?? result.parentId}`)
            }}
          >
            Ir al nodo
          </button>
          <button
            className="rec-bar-ai-btn rec-bar-ai-btn--secondary"
            onClick={handleReset}
          >
            Nueva
          </button>
        </div>
      </div>
    )
  }

  // ── Grabando ────────────────────────────────────────────────────────────
  if (r.phase === 'recording') {
    return (
      <div style={{ borderTop: '1px solid var(--border)', background: 'rgba(239,68,68,0.04)', flexShrink: 0 }}>
        <div className="rec-bar rec-bar--active" style={{ borderTop: 'none' }}>
          <span className="rec-bar-dot" />
          <span className="rec-bar-timer">{formatTime(r.elapsed)}</span>

          {/* Nivel de audio */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, padding: '0 4px', overflow: 'hidden' }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{
                width: 2.5, flexShrink: 0, borderRadius: 2,
                height: Math.max(3, Math.min(16, r.audioLevel * 18 * (0.4 + Math.sin(i * 1.3 + Date.now() / 200) * 0.3 + 0.3))),
                background: r.audioLevel > 0.05 ? '#ef4444' : 'var(--border)',
                transition: 'height 0.08s',
              }} />
            ))}
          </div>

          <button
            className="rec-bar-icon-btn rec-bar-icon-btn--stop"
            onClick={() => r.stopRecording()}
            title="Parar y procesar con IA"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>
          </button>
        </div>

        {/* Transcripción en vivo */}
        {r.transcript && (
          <div style={{
            padding: '3px 8px 6px', fontSize: 10.5, color: 'var(--text-secondary)',
            lineHeight: 1.4, maxHeight: 44, overflow: 'hidden',
            maskImage: 'linear-gradient(to bottom, transparent, black 30%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 30%)',
          }}>
            {r.transcript}
          </div>
        )}
      </div>
    )
  }

  // ── Idle ────────────────────────────────────────────────────────────────
  return (
    <div className="rec-bar rec-bar--idle">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Grabadora</div>
      </div>

      <div style={{ display: 'flex', gap: 2 }}>
        <button
          className={`rec-bar-icon-btn ${r.micEnabled ? 'on' : 'off'}`}
          onClick={() => r.setMicEnabled(!r.micEnabled)}
          title={r.micEnabled ? 'Micrófono activado' : 'Micrófono desactivado'}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5.5" y="1.5" width="5" height="9" rx="2.5"/>
            <path d="M3 7.5v.5a5 5 0 0 0 10 0v-.5"/>
            <path d="M8 13v2"/>
          </svg>
        </button>
        {/* Audio del sistema: solo disponible en Mac nativa (Tauri).
            En Chrome/web requiere getDisplayMedia que abre el diálogo de pantalla compartida — no usar. */}
      </div>

      <button
        className="rec-bar-icon-btn rec-bar-icon-btn--record"
        onClick={() => r.startRecording()}
        disabled={!r.isSupported}
        title={r.isSupported ? 'Iniciar grabación' : 'Reconocimiento de voz no soportado'}
      >
        <svg width="13" height="13" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
