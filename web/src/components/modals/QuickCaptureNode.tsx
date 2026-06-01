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
import { recordingStore } from '../../store/recordingStore'
import type { DateExtraction } from '../../utils/naturalDate'
import { buildTaskVerbRegex } from '../../store/predictionStore'

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

export default function QuickCaptureNode({ onClose }: Props) {
  const inputRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [datePrediction, setDatePrediction] = useState<DateExtraction | null>(null)
  const [taskPrediction, setTaskPrediction] = useState(false)
  const [ctxSuggestion, setCtxSuggestion] = useState<CtxSuggestion | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Análisis del texto en tiempo real
  const analyze = useCallback((t: string) => {
    // 1. Fecha / recurrencia al final
    if (t.length > 3) {
      setDatePrediction(extractDateFromEnd(t))
    } else {
      setDatePrediction(null)
    }

    // 2. Detección de verbo → tarea
    const normed = normalize(t)
    if (t.length > 4 && buildTaskVerbRegex().test(normed)) {
      setTaskPrediction(true)
    } else {
      setTaskPrediction(false)
    }

    // 3. Sugerencia de contexto (busca en TODOS los nodos activos)
    if (t.length >= 3) {
      const allNodes = store.allActive().filter(n =>
        !n.deletedAt && n.text && n.text.length >= 3 &&
        !n.isDiaryEntry && !n.isChat &&
        !/^\d{4}$/.test(n.text) &&
        !['🗑 Papelera', '🤖 Agentes', '📋 Plantillas', '🏷 Tags', '🧠 Contexto', '📅 Agenda'].includes(n.text)
      )

      let found: CtxSuggestion | null = null
      const normT = normalize(t)

      for (const n of allNodes) {
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

    // Parsear fecha si hay predicción
    const dp = extractDateFromEnd(rawText)
    const cleanText = dp ? dp.cleanText : rawText
    const isTask = taskPrediction || (dp !== null && buildTaskVerbRegex().test(normalize(rawText)))

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
      if (dp.timeStr) {
        const [h, m] = dp.timeStr.split(':').map(Number)
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
    } else if (isTask) {
      store.updateNode(node.id, { status: 'pending' })
    }

    if (types.length > 0) {
      store.updateNode(node.id, { types })
    }

    store.sync(true).catch(() => {})
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { onClose(); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (ctxSuggestion) { acceptCtx(); return }
      if (datePrediction) { acceptDate(); return }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveAndClose()
    }

    // R = grabar voz (solo si el input está vacío)
    if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !getCurrentText()) {
      e.preventDefault()
      onClose()
      setTimeout(() => recordingStore.startRecording(), 80)
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
        {/* Input principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: taskPrediction ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 14, flexShrink: 0 }}>
            {taskPrediction ? '☐' : '•'}
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
            {/* R = grabar voz */}
            <button
              title="Grabar voz (R)"
              onMouseDown={e => { e.preventDefault(); onClose(); setTimeout(() => recordingStore.startRecording(), 80) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5.5" y="1.5" width="5" height="9" rx="2.5"/>
                <path d="M3 7.5v.5a5 5 0 0 0 10 0v-.5"/>
                <path d="M8 13v2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Ghost text — solo si hay predicción */}
        {ghostLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 24 }}>
            <span className="from-ghost">
              <span className="from-ghost-text">{ghostLabel}</span>
              <span className="from-ghost-sep">·</span>
              <span className="from-ghost-key">{ghostAcceptKey}</span>
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
