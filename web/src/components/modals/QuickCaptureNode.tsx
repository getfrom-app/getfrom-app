/**
 * QuickCaptureNode — captura rápida con ghost text completo.
 * Espacio → abre modal → escribe con predicción inteligente → Enter → guarda en diario de hoy.
 *
 * Ghost text (en este orden de prioridad):
 *  1. Contexto: "la is" → "@La Isla del Trading" (Tab acepta)
 *  2. Fecha + tarea: "Llamar mañana" → "☐ mañana" (Enter acepta)
 *  3. Solo fecha: "mañana" → "mañana" badge (Tab acepta)
 *  4. Solo tarea (verbo): "Llamar a Marina" → "☐ tarea" (Enter acepta)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'
import { extractDateFromEnd, recurrenceToString } from '../../utils/naturalDate'
import { recordingStore, useRecordingStore } from '../../store/recordingStore'
import type { DateExtraction } from '../../utils/naturalDate'
import { buildTaskVerbRegex } from '../../store/predictionStore'
import { useToast } from '../Toast'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface CtxSuggestion {
  nodeId: string
  displayName: string
  typedLen: number      // cuántos chars del final del texto ya escribió el usuario
  ghost: string         // el resto del nombre que aparece como ghost
}

interface Props {
  onClose: () => void
}

// Shortcuts inline al final del texto:
//   -t  → fuerza tarea
//   -e  → fuerza evento
//   -n  → fuerza nota (cancela detección automática)
type ForceType = 'task' | 'event' | 'note' | null
const FORCE_SHORTCUTS: Record<string, ForceType> = { '-t': 'task', '-e': 'event', '-n': 'note' }

function detectForceType(t: string): { forceType: ForceType; cleanText: string } {
  for (const [shortcut, type] of Object.entries(FORCE_SHORTCUTS)) {
    if (t.trimEnd().endsWith(' ' + shortcut) || t.trimEnd() === shortcut) {
      return { forceType: type, cleanText: t.trimEnd().slice(0, -shortcut.length).trimEnd() }
    }
  }
  return { forceType: null, cleanText: t }
}

export default function QuickCaptureNode({ onClose }: Props) {
  const inputRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [datePrediction, setDatePrediction] = useState<DateExtraction | null>(null)
  const [taskPrediction, setTaskPrediction] = useState(false)
  const [ctxSuggestion, setCtxSuggestion] = useState<CtxSuggestion | null>(null)
  const [forceType, setForceType] = useState<ForceType>(null)
  // @ picker: dropdown cuando el usuario escribe @
  const [atPicker, setAtPicker] = useState<{ query: string; items: { id: string; label: string }[]; activeIdx: number } | null>(null)
  const r = useRecordingStore()
  const { showToast } = useToast()
  const isRecording = r.phase === 'recording'
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spaceIsRecordingRef = useRef(false)
  // Ref a analyze para usarla en el Space handler sin closure stale
  const analyzeRef = useRef<((t: string) => void) | null>(null)

  // Sincronizar transcript de grabación en el input en tiempo real
  useEffect(() => {
    if (!isRecording) {
      // Al parar: transcript queda en el input para editar
      if (r.phase === 'done' && r.transcript && inputRef.current) {
        const t = r.transcript.trim()
        inputRef.current.textContent = t
        setText(t)
        analyze(t)
        // Cursor al final
        const range = document.createRange()
        const sel = window.getSelection()
        const node = inputRef.current.firstChild
        if (node) { range.setStart(node, (node.textContent?.length ?? 0)); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range) }
        inputRef.current.focus()
        recordingStore.resetRecording()
      }
      return
    }
    // Mientras graba: reflejar transcript en el input
    if (inputRef.current && r.transcript !== undefined) {
      const t = r.transcript
      if (inputRef.current.textContent !== t) {
        inputRef.current.textContent = t
        setText(t)
        analyze(t)
      }
    }
  }, [r.transcript, r.phase, isRecording]) // eslint-disable-line react-hooks/exhaustive-deps

  // Space (hold) = grabar — SOLO cuando el input está vacío.
  // Si el input tiene texto, Space se comporta con normalidad (escribe espacio).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      // Solo interceptar si el input está vacío
      const isEmpty = !(inputRef.current?.textContent || '').trim()
      if (!isEmpty) return // dejar pasar — comportamiento normal del contentEditable
      e.preventDefault()
      e.stopImmediatePropagation()
      if (spaceIsRecordingRef.current) return
      spaceHoldTimerRef.current = setTimeout(() => {
        spaceIsRecordingRef.current = true
        if (recordingStore.phase === 'idle') recordingStore.startRecording()
      }, 250)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      // Si no estamos en modo grabación, no hacer nada especial
      if (!spaceIsRecordingRef.current && !spaceHoldTimerRef.current) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (spaceHoldTimerRef.current) {
        clearTimeout(spaceHoldTimerRef.current)
        spaceHoldTimerRef.current = null
      }
      if (spaceIsRecordingRef.current) {
        spaceIsRecordingRef.current = false
        if (recordingStore.phase === 'recording') recordingStore.stopRecording()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      if (spaceHoldTimerRef.current) clearTimeout(spaceHoldTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Items para el @ picker: contextos + todos los nodos activos
  function buildAtItems(query: string) {
    const q = query.toLowerCase()
    const all = store.allActive().filter(n =>
      !n.deletedAt && n.text && !n.isDiaryEntry && !n.isChat &&
      !/^\d{4}$/.test(n.text) &&
      !['🗑 Papelera','🤖 Agentes','📋 Plantillas','🏷 Tags','🧠 Contexto','📅 Agenda'].includes(n.text)
    )
    return all
      .filter(n => !q || n.text.toLowerCase().includes(q))
      .slice(0, 8)
      .map(n => ({ id: n.id, label: n.text }))
  }

  // Análisis del texto en tiempo real
  const analyze = useCallback((t: string) => {
    // 0. Shortcuts inline (-t, -e, -n)
    const { forceType: ft, cleanText: ct } = detectForceType(t)
    setForceType(ft)
    const textToAnalyze = ft ? ct : t

    // 0b. @ picker: detectar @query al final del texto antes del cursor
    const atMatch = textToAnalyze.match(/@([\wÀ-ɏ\s]*)$/)
    if (atMatch) {
      const query = atMatch[1]
      const items = buildAtItems(query)
      setAtPicker(p => ({ query, items, activeIdx: p?.activeIdx ?? 0 }))
    } else {
      setAtPicker(null)
    }

    // 1. Fecha / recurrencia al final
    if (textToAnalyze.length > 3) {
      setDatePrediction(extractDateFromEnd(textToAnalyze))
    } else {
      setDatePrediction(null)
    }

    // 2. Detección de verbo → tarea (solo si no hay force type)
    const normed = normalize(textToAnalyze)
    if (!ft && textToAnalyze.length > 4 && buildTaskVerbRegex().test(normed)) {
      setTaskPrediction(true)
    } else {
      setTaskPrediction(false)
    }

    // 3. Sugerencia de contexto — solo hijos de 🧠 Contexto (o 🏷 Tags legacy)
    if (t.length >= 3) {
      const ctxRoot = store.children(null).find(n => !n.deletedAt && (n.text === '🧠 Contexto' || n.text === '🏷 Tags'))
      const ctxNodes = ctxRoot
        ? store.children(ctxRoot.id).filter(n => !n.deletedAt && n.text)
        : []

      let found: CtxSuggestion | null = null
      const normT = normalize(t)

      for (const n of ctxNodes) {
        const normName = normalize(n.text)
        for (let len = Math.min(t.length, normName.length - 1); len >= 3; len--) {
          const tail = normT.slice(-len)
          const charBefore = t[t.length - len - 1]
          const isWordStart = !charBefore || /[\s,;:([\-]/.test(charBefore)
          if (isWordStart && normName.startsWith(tail) && tail !== normName) {
            const ghost = n.text.slice(len)
            found = { nodeId: n.id, displayName: n.text, typedLen: len, ghost }
            break
          }
        }
        if (found) break
      }
      setCtxSuggestion(found)
    } else {
      setCtxSuggestion(null)
    }
  }, [])

  // Mantener ref siempre actualizada
  analyzeRef.current = analyze

  function getCurrentText() {
    return inputRef.current?.textContent || ''
  }

  function handleInput() {
    const t = getCurrentText()
    setText(t)
    analyze(t)
  }

  function acceptCtx() {
    if (!ctxSuggestion || !inputRef.current) return
    const t = getCurrentText()
    // Reemplazar los últimos typedLen chars con "@DisplayName"
    const before = t.slice(0, -ctxSuggestion.typedLen)
    const newText = before + '@' + ctxSuggestion.displayName + ' '
    inputRef.current.textContent = newText
    // Cursor al final
    const range = document.createRange()
    const sel = window.getSelection()
    const textNode = inputRef.current.firstChild
    if (textNode) {
      range.setStart(textNode, newText.length)
      range.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setText(newText)
    setCtxSuggestion(null)
    setDatePrediction(null)
    setTaskPrediction(false)
    // Re-analizar con el nuevo texto
    analyze(newText)
  }

  function acceptDate() {
    if (!datePrediction || !inputRef.current) return
    const newText = datePrediction.cleanText + ' '
    inputRef.current.textContent = newText
    const range = document.createRange()
    const sel = window.getSelection()
    const textNode = inputRef.current.firstChild
    if (textNode) {
      range.setStart(textNode, newText.length)
      range.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setText(newText)
    // Mantener datePrediction para que se vea el badge pero cleanText ya está aplicado
  }

  function saveAndClose() {
    const rawText = getCurrentText().trim()
    if (!rawText) { onClose(); return }

    const today = getTodayDiaryUnderAgenda()
    const sibs = store.children(today.id)
    const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(s => s.siblingOrder)) : 0

    // Aplicar shortcut de tipo si hay uno
    const { forceType: ft, cleanText: afterForce } = detectForceType(rawText)
    const effectiveText = ft ? afterForce : rawText

    // Parsear fecha si hay predicción
    const dp = extractDateFromEnd(effectiveText)
    const cleanText = dp ? dp.cleanText : effectiveText
    const isTask = ft === 'task' || (ft !== 'note' && ft !== 'event' && (taskPrediction || (dp !== null && buildTaskVerbRegex().test(normalize(effectiveText)))))
    const isEvent = ft === 'event'

    // Detectar @contexto en el texto
    const ctxMatch = rawText.match(/@([\wÀ-ɏ\s\-]+)/g)
    const types: string[] = []
    if (ctxMatch) {
      for (const m of ctxMatch) {
        const name = m.slice(1).trim()
        const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
        if (slug) types.push(slug)
      }
    }

    const node = store.createNode({
      text: cleanText.trim(),
      parentId: today.id,
      siblingOrder: lastOrder + 1000,
      ...(isTask ? { isTask: true } : {}),
    })

    if (dp?.parsed.date) {
      const updates: Record<string, unknown> = {}
      if (dp.timeStr || isEvent) {
        const [h, m] = (dp.timeStr || '00:00').split(':').map(Number)
        const d = new Date(dp.parsed.date)
        d.setHours(h, m, 0, 0)
        updates.due = d.toISOString()
        updates.isEvent = true
      } else {
        updates.due = dp.parsed.date.toISOString()
        if (isTask) updates.status = 'pending'
      }
      if (dp.parsed.recurrence) {
        updates.recurrence = recurrenceToString(dp.parsed.recurrence)
      }
      store.updateNode(node.id, updates)
    } else if (isEvent) {
      // Evento sin fecha explícita — marcar como evento (fecha se asignará después)
      store.updateNode(node.id, { isEvent: true })
    } else if (isTask) {
      store.updateNode(node.id, { status: 'pending' })
    }

    if (types.length > 0) {
      store.updateNode(node.id, { types })
    }

    store.sync(true).catch(() => {})

    const label = isEvent ? 'Evento' : isTask ? 'Tarea' : 'Nota'
    showToast(`✓ ${label} creada`)
    onClose()
  }

  function selectAtItem(item: { id: string; label: string }) {
    if (!inputRef.current || !atPicker) return
    const t = inputRef.current.textContent || ''
    // Reemplazar @query con @NombreCompleto
    const newText = t.replace(/@[\wÀ-ɏ\s]*$/, `@${item.label} `)
    inputRef.current.textContent = newText
    // Cursor al final
    const range = document.createRange()
    const sel = window.getSelection()
    const textNode = inputRef.current.firstChild
    if (textNode) { range.setStart(textNode, newText.length); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range) }
    setText(newText)
    setAtPicker(null)
    analyze(newText)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // @ picker toma prioridad
    if (atPicker) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAtPicker(p => p ? { ...p, activeIdx: Math.min(p.activeIdx + 1, p.items.length - 1) } : p); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAtPicker(p => p ? { ...p, activeIdx: Math.max(p.activeIdx - 1, 0) } : p); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const item = atPicker.items[atPicker.activeIdx]
        if (item) selectAtItem(item)
        return
      }
      if (e.key === 'Escape') { setAtPicker(null); return }
    }

    if (e.key === 'Escape') { onClose(); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (ctxSuggestion) { acceptCtx(); return }
      if (datePrediction) { acceptDate(); return }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Si hay sugerencia de contexto activa, Enter la acepta (no guarda aún)
      if (ctxSuggestion) { acceptCtx(); return }
      saveAndClose()
    }
  }

  // Ghost text label
  const ghostLabel = (() => {
    if (ctxSuggestion) {
      const typed = ctxSuggestion.displayName.slice(0, ctxSuggestion.typedLen)
      return `@${typed}${ctxSuggestion.ghost}`
    }
    if (taskPrediction && datePrediction) return `☐ ${datePrediction.parsed.label}${datePrediction.timeStr ? ' · ' + datePrediction.timeStr : ''}`
    if (taskPrediction) return '☐ tarea'
    if (datePrediction) return datePrediction.parsed.label + (datePrediction.timeStr ? ' · ' + datePrediction.timeStr : '')
    return null
  })()

  const ghostAcceptKey = ctxSuggestion ? '⇥' : (taskPrediction && !datePrediction) ? '↵' : '⇥'

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(2px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        padding: '14px 16px 12px',
        width: 560,
        maxWidth: '90vw',
      }}>
        {/* Onda de audio — solo cuando graba */}
        {isRecording && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            height: 28, marginBottom: 8, paddingLeft: 24,
          }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={{
                width: 2.5, borderRadius: 2, flexShrink: 0,
                height: Math.max(3, Math.min(24, r.audioLevel * 28 * (0.3 + Math.abs(Math.sin(i * 0.7 + Date.now() / 150)) * 0.7))),
                background: '#ef4444',
                transition: 'height 0.06s ease',
              }} />
            ))}
            <span style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
              {Math.floor(r.elapsed / 60)}:{String(r.elapsed % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Input principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: (taskPrediction || forceType === 'task') ? 'var(--accent)' : forceType === 'event' ? '#3b82f6' : 'var(--text-tertiary)', fontSize: 14, flexShrink: 0 }}>
            {forceType === 'event' ? '📅' : (taskPrediction || forceType === 'task') ? '☐' : '•'}
          </span>
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder="Escribe un nodo, tarea o idea..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              minHeight: 24,
              lineHeight: '1.5',
            }}
          />
          {/* Atajos a la derecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <kbd style={{ fontSize: 10, color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px' }}>↵</kbd>
            <kbd style={{ fontSize: 10, color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px' }}>ESC</kbd>
            {/* Mic / Stop */}
            <button
              title={isRecording ? 'Parar grabación' : 'Grabar voz (mantén Espacio)'}
              onMouseDown={e => {
                e.preventDefault()
                if (isRecording) {
                  recordingStore.stopRecording()
                } else {
                  recordingStore.startRecording()
                }
              }}
              style={{
                background: isRecording ? '#ef4444' : 'none',
                border: 'none', cursor: 'pointer',
                color: isRecording ? 'white' : 'var(--text-tertiary)',
                padding: isRecording ? '3px 6px' : '2px 4px',
                borderRadius: isRecording ? 4 : 0,
                display: 'flex', alignItems: 'center',
                transition: 'all 0.15s',
              }}
            >
              {isRecording ? (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="2" y="2" width="8" height="8" rx="1.5"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5.5" y="1.5" width="5" height="9" rx="2.5"/>
                  <path d="M3 7.5v.5a5 5 0 0 0 10 0v-.5"/>
                  <path d="M8 13v2"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* @ picker dropdown */}
        {atPicker && atPicker.items.length > 0 && (
          <div style={{
            marginTop: 4, borderTop: '1px solid var(--border)',
            maxHeight: 180, overflowY: 'auto',
          }}>
            {atPicker.items.map((item, idx) => (
              <div
                key={item.id}
                onMouseDown={e => { e.preventDefault(); selectAtItem(item) }}
                style={{
                  padding: '5px 12px 5px 24px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: idx === atPicker.activeIdx ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 11 }}>@</span>
                {item.label}
              </div>
            ))}
          </div>
        )}

        {/* Ghost text — espacio siempre reservado para no expandir el modal */}
        {!atPicker && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 8, paddingLeft: 24,
            minHeight: 22,
            visibility: ghostLabel ? 'visible' : 'hidden',
          }}>
            {ghostLabel && (
              <span className="from-ghost">
                <span className="from-ghost-text">{ghostLabel}</span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">{ghostAcceptKey}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
