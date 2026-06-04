/**
 * UnifiedCapture — modal unificado que fusiona QuickCaptureNode y CommandPalette.
 *
 * - Abre con Space, ⌘K o el botón FAB +
 * - Sin texto: muestra shortcuts de navegación (Hoy, Mañana, Filtros, Contextos)
 * - Con texto: busca nodos Y ofrece crear al final
 * - Ghost text (predicción de contexto, fecha, tarea) siempre visible
 * - @ picker para enlazar nodos en línea
 * - Fondo blanco, input contentEditable, estilo de QuickCaptureNode
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast'
import { normalizeText } from '../../utils/normalize'
import { getTodayDiaryUnderAgenda, findAgendaRoot } from '../../utils/agendaHelper'
import { extractDateFromEnd, recurrenceToString } from '../../utils/naturalDate'
import { recordingStore, useRecordingStore } from '../../store/recordingStore'
import { buildTaskVerbRegex } from '../../store/predictionStore'
import { createNodeFromText, labelForType } from '../../utils/captureHelper'
import { getAtajosNode, getShortcutData } from '../../utils/atajosHelper'
import type { DateExtraction } from '../../utils/naturalDate'

// ── Helpers de normalización ─────────────────────────────────────────────────

function normalizeNFD(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ── Force type shortcuts inline ──────────────────────────────────────────────

type ForceType = 'task' | 'event' | 'note' | 'bucle' | null
const FORCE_SHORTCUTS: Record<string, ForceType> = { '-t': 'task', '-e': 'event', '-n': 'note', '-b': 'bucle' }

function detectForceType(t: string): { forceType: ForceType; cleanText: string } {
  const trimmed = t.trimEnd()
  // Shortcuts: -t, -e, -n, -b
  for (const [shortcut, type] of Object.entries(FORCE_SHORTCUTS)) {
    if (trimmed.endsWith(' ' + shortcut) || trimmed === shortcut) {
      return { forceType: type, cleanText: trimmed.slice(0, -shortcut.length).trimEnd() }
    }
  }
  // Palabra "bucle" al final del texto (cualquier case): "Casa Alicante bucle"
  if (/\s+bucle$/i.test(trimmed) || /^bucle$/i.test(trimmed)) {
    const clean = trimmed.replace(/\s*bucle$/i, '').trim()
    return { forceType: 'bucle', cleanText: clean }
  }
  return { forceType: null, cleanText: t }
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreMatch(haystack: string, needle: string): number {
  if (!needle.trim()) return 0
  const h = normalizeText(haystack)
  const n = normalizeText(needle.trim())
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(n)) return 60
  const words = n.split(/\s+/).filter(w => w.length > 1)
  if (words.length >= 2 && words.every(w => h.includes(w))) {
    return 30 + Math.round(20 * n.length / Math.max(h.length, 1))
  }
  if (words.length === 1 && words[0].length >= 3 && h.includes(words[0])) return 20
  return 0
}

// ── Natural date parsing (del CommandPalette original) ───────────────────────

interface ParsedQuery {
  cleanText: string
  isTask: boolean
  isEvent: boolean
  isFavorite: boolean
  due: string | null
  dateLabel: string | null
}

const DAY_NAMES: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3,
  jueves: 4, viernes: 5, sábado: 6,
}

function nextWeekday(dayIndex: number): Date {
  const now = new Date(), today = now.getDay()
  let diff = dayIndex - today
  if (diff <= 0) diff += 7
  const d = new Date(now); d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d
}

function parseNaturalDate(tokens: string[]): { date: Date | null; usedTokens: Set<number> } {
  const used = new Set<number>()
  let date: Date | null = null
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase()
    if (t === 'hoy') { const d = new Date(); d.setHours(0,0,0,0); date = d; used.add(i); continue }
    if (t === 'mañana') { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); date = d; used.add(i); continue }
    if (DAY_NAMES[t] !== undefined) { date = nextWeekday(DAY_NAMES[t]); used.add(i); continue }
    if (/^\d{1,2}\/\d{1,2}$/.test(t)) {
      const [dd, mm] = t.split('/').map(Number)
      const d = new Date(); d.setMonth(mm-1, dd); d.setHours(0,0,0,0)
      if (d < new Date()) d.setFullYear(d.getFullYear()+1)
      date = d; used.add(i); continue
    }
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [hh, mn] = t.split(':').map(Number)
      if (!date) { date = new Date(); date.setHours(0,0,0,0) }
      date.setHours(hh, mn, 0, 0); used.add(i); continue
    }
  }
  return { date, usedTokens: used }
}

function parseQuery(raw: string): ParsedQuery {
  let isTask = false, isEvent = false, isFavorite = false
  const re = /\s*-(t|e|f)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const f = m[1].toLowerCase()
    if (f === 't') isTask = true
    else if (f === 'e') isEvent = true
    else if (f === 'f') isFavorite = true
  }
  const stripped = raw.replace(/\s*-(t|e|f)\b/gi, '').trim()
  const tokens = stripped.split(/\s+/)
  const { date, usedTokens } = parseNaturalDate(tokens)
  const cleanText = tokens.filter((_, i) => !usedTokens.has(i)).join(' ').trim()
  let dateLabel: string | null = null
  if (date) {
    const now = new Date(); now.setHours(0,0,0,0)
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1)
    if (date.toDateString() === now.toDateString()) dateLabel = 'hoy'
    else if (date.toDateString() === tomorrow.toDateString()) dateLabel = 'mañana'
    else {
      const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
      dateLabel = `${days[date.getDay()]} ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`
    }
  }
  return { cleanText, isTask, isEvent, isFavorite, due: date ? date.toISOString() : null, dateLabel }
}

// ── Recent nodes ─────────────────────────────────────────────────────────────

const RECENT_KEY = 'from_recent_nodes'
function getRecentNodes(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
export function recordRecentNode(id: string) {
  const recent = getRecentNodes().filter(r => r !== id)
  recent.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CtxSuggestion {
  nodeId: string
  displayName: string
  typedLen: number
  ghost: string
}

interface PaletteItem {
  id: string
  label: string
  sublabel?: string
  type: 'note' | 'tag' | 'create' | 'wf-action'
  taskStatus?: 'pending' | 'done' | null
  action: () => void
  score: number
}

type PaletteView = 'default' | 'filtros' | 'contextos' | 'bucles'

interface Props {
  onClose: () => void
  onSelectContext?: (nodeId: string) => void
  /**
   * Override de navegación. En la ventana flotante "capture" del Mac la
   * navegación se redirige a la ventana principal en vez de navegar la
   * propia ventana de captura. Por defecto usa el router de esta ventana.
   */
  onNavigate?: (path: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UnifiedCapture({ onClose, onSelectContext, onNavigate }: Props) {
  const routerNavigate = useNavigate()
  const navigate = onNavigate ?? routerNavigate
  const location = useLocation()
  const { t } = useTranslation()
  const { showToast } = useToast()

  // Nodo actual si estamos en /node/:id
  const currentNodeId = (() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    return m ? m[1] : null
  })()

  // ── Estado capture (QuickCaptureNode) ──────────────────────────────────────
  const inputRef = useRef<HTMLDivElement>(null)
  // Suprimir el onInput sintético que dispara el DOM cuando se modifica inputRef.textContent
  // programáticamente (en acceptCtx / selectAtItem), para evitar que resetee justAcceptedCtx
  const skipNextInputRef = useRef(false)
  const [text, setText] = useState('')
  const [datePrediction, setDatePrediction] = useState<DateExtraction | null>(null)
  const [taskPrediction, setTaskPrediction] = useState(false)
  const [ctxSuggestion, setCtxSuggestion] = useState<CtxSuggestion | null>(null)
  const [forceType, setForceType] = useState<ForceType>(null)
  const [atPicker, setAtPicker] = useState<{ query: string; items: { id: string; label: string }[]; activeIdx: number } | null>(null)
  // Contextos asignados como chips (sin @ en el texto)
  const [assignedCtx, setAssignedCtx] = useState<{ name: string; slug: string }[]>([])

  // ── Estado palette (CommandPalette) ────────────────────────────────────────
  const [view, setView] = useState<PaletteView>('default')
  const [activeIdx, setActiveIdx] = useState(0)

  // ── Recording ──────────────────────────────────────────────────────────────
  const r = useRecordingStore()
  const isRecording = r.phase === 'recording'
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spaceIsRecordingRef = useRef(false)
  const analyzeRef = useRef<((t: string) => void) | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const contextoRoot = store.children(null).find(n => !n.deletedAt && n.text === '🧠 Contexto') ?? null
  const atajosRoot = getAtajosNode()

  const allFilterNodes = useCallback((): { id: string; text: string; query: string }[] => {
    const out: { id: string; text: string; query: string }[] = []
    if (!atajosRoot) return out
    const collect = (parentId: string) => {
      for (const n of store.children(parentId).filter(c => !c.deletedAt)) {
        const sc = getShortcutData(n.id)
        if (sc?.query !== undefined) out.push({ id: n.id, text: n.text || '', query: sc.query })
        collect(n.id)
      }
    }
    collect(atajosRoot.id)
    return out
  }, [atajosRoot])

  // ── @ picker items ─────────────────────────────────────────────────────────
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

  // Ref para mantener el forceType tras eliminar el shortcut del texto
  const lockedForceTypeRef = useRef<ForceType>(null)

  // ── Análisis ghost text ────────────────────────────────────────────────────
  const analyze = useCallback((t: string) => {
    const { forceType: ft, cleanText: ct } = detectForceType(t)

    if (ft !== null) {
      // Shortcut nuevo detectado: guardarlo y eliminarlo del input inmediatamente
      lockedForceTypeRef.current = ft
      setForceType(ft)
      if (ct !== t.trimEnd() && inputRef.current) {
        // Eliminar el shortcut del DOM sin activar onInput
        skipNextInputRef.current = true
        inputRef.current.textContent = ct
        setText(ct)  // ← CRÍTICO: actualizar text state al limpiar el DOM
        // Cursor al final
        const range = document.createRange()
        const sel = window.getSelection()
        const textNode = inputRef.current.firstChild
        if (textNode) { range.setStart(textNode, ct.length); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range) }
      }
    } else {
      // Sin shortcut en el texto — mantener el tipo bloqueado si existe
      setForceType(lockedForceTypeRef.current)
    }

    const effective = lockedForceTypeRef.current ?? ft
    const textToAnalyze = effective ? ct : t

    // @ picker
    const atMatch = textToAnalyze.match(/@([\wÀ-ɏ\s]*)$/)
    if (atMatch) {
      const query = atMatch[1]
      const items = buildAtItems(query)
      setAtPicker(p => ({ query, items, activeIdx: p?.activeIdx ?? 0 }))
    } else {
      setAtPicker(null)
    }

    // Fecha
    if (textToAnalyze.length > 3) {
      setDatePrediction(extractDateFromEnd(textToAnalyze))
    } else {
      setDatePrediction(null)
    }

    // Detección tarea por verbo
    const normed = normalizeNFD(textToAnalyze)
    if (!ft && textToAnalyze.length > 4 && buildTaskVerbRegex().test(normed)) {
      setTaskPrediction(true)
    } else {
      setTaskPrediction(false)
    }

    // Sugerencia de contexto
    if (t.length >= 3) {
      const ctxRoot = store.children(null).find(n => !n.deletedAt && (n.text === '🧠 Contexto' || n.text === '🏷 Tags'))
      const ctxNodes = ctxRoot
        ? store.children(ctxRoot.id).filter(n => !n.deletedAt && n.text)
        : []

      let found: CtxSuggestion | null = null
      const normT = normalizeNFD(t)

      for (const n of ctxNodes) {
        const normName = normalizeNFD(n.text)
        const slug = n.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
        // No sugerir contextos ya aceptados como chip
        if (assignedCtx.some(c => c.slug === slug)) continue
        // Incluir el nombre completo (normName.length, sin -1) y sin excluir tail===normName
        // para que "from" detecte "From" igual que "fro"
        for (let len = Math.min(t.length, normName.length); len >= 3; len--) {
          const tail = normT.slice(-len)
          const charBefore = t[t.length - len - 1]
          const isWordStart = !charBefore || /[\s,;:([\-]/.test(charBefore)
          if (isWordStart && normName.startsWith(tail)) {
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  analyzeRef.current = analyze

  // ── Recording sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      if (r.phase === 'done' && r.transcript && inputRef.current) {
        const t = r.transcript.trim()
        inputRef.current.textContent = t
        setText(t)
        analyze(t)
        const range = document.createRange()
        const sel = window.getSelection()
        const node = inputRef.current.firstChild
        if (node) { range.setStart(node, (node.textContent?.length ?? 0)); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range) }
        inputRef.current.focus()
        recordingStore.resetRecording()
      }
      return
    }
    if (inputRef.current && r.transcript !== undefined) {
      const t = r.transcript
      if (inputRef.current.textContent !== t) {
        inputRef.current.textContent = t
        setText(t)
        analyze(t)
      }
    }
  }, [r.transcript, r.phase, isRecording]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Space hold para grabar ─────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return
      const isEmpty = !(inputRef.current?.textContent || '').trim()
      if (!isEmpty) return
      // Siempre prevenir espacio cuando el input está vacío (incluyendo repeat)
      // para que el contentEditable no inserte espacios mientras se mantiene pulsado
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.repeat || spaceIsRecordingRef.current) return
      spaceHoldTimerRef.current = setTimeout(() => {
        spaceIsRecordingRef.current = true
        if (recordingStore.phase === 'idle') recordingStore.startRecording()
      }, 250)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
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
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  // (no global capture listener — MainLayout hace guard con showUnifiedCapture)

  // ── Reset activeIdx cuando cambia query o view ─────────────────────────────
  useEffect(() => { setActiveIdx(0) }, [text, view])

  // ── Scroll to active item ──────────────────────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // ── Input handlers ─────────────────────────────────────────────────────────
  function getCurrentText() {
    return inputRef.current?.textContent || ''
  }

  function handleInput() {
    // Ignorar el input sintético provocado por modificación programática del DOM
    if (skipNextInputRef.current) { skipNextInputRef.current = false; return }
    const t = getCurrentText()
    setText(t)
    analyze(t)
    if (justAcceptedCtx) setJustAcceptedCtx(false)  // vuelve a mostrar lista al escribir
  }

  // ── Aceptar ghost text ─────────────────────────────────────────────────────
  // State: tras aceptar sugerencia de contexto, ocultar lista hasta próxima tecla
  const [justAcceptedCtx, setJustAcceptedCtx] = useState(false)

  function acceptCtx() {
    if (!ctxSuggestion || !inputRef.current) return
    // Añadir chip de contexto
    const slug = ctxSuggestion.displayName.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
    setAssignedCtx(prev =>
      prev.some(c => c.slug === slug) ? prev : [...prev, { name: ctxSuggestion!.displayName, slug }]
    )
    // Mantener el nombre del contexto en el texto con la capitalización correcta
    // (ej. "from" → "From") para que el nodo se cree con el título completo
    const t = getCurrentText()
    const prefix = t.slice(0, -ctxSuggestion.typedLen)
    const newText = prefix + ctxSuggestion.displayName + ' '
    skipNextInputRef.current = true
    inputRef.current.textContent = newText
    const range = document.createRange()
    const sel = window.getSelection()
    const textNode = inputRef.current.firstChild
    if (textNode) {
      range.setStart(textNode, newText.length); range.collapse(true)
      sel?.removeAllRanges(); sel?.addRange(range)
    }
    setText(newText)
    setCtxSuggestion(null)
    setAtPicker(null)
    setJustAcceptedCtx(true)
    const { forceType: ft } = detectForceType(newText)
    setForceType(ft)
  }

  function acceptDate() {
    if (!datePrediction || !inputRef.current) return
    const newText = datePrediction.cleanText + ' '
    inputRef.current.textContent = newText
    const range = document.createRange()
    const sel = window.getSelection()
    const textNode = inputRef.current.firstChild
    if (textNode) {
      range.setStart(textNode, newText.length); range.collapse(true)
      sel?.removeAllRanges(); sel?.addRange(range)
    }
    setText(newText)
  }

  // ── @ picker ───────────────────────────────────────────────────────────────
  function selectAtItem(item: { id: string; label: string }) {
    if (!inputRef.current || !atPicker) return
    const t = inputRef.current.textContent || ''
    const newText = t.replace(/@[\wÀ-ɏ\s]*$/, `@${item.label} `)
    skipNextInputRef.current = true
    inputRef.current.textContent = newText
    const range = document.createRange()
    const sel = window.getSelection()
    const textNode = inputRef.current.firstChild
    if (textNode) { range.setStart(textNode, newText.length); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range) }
    setText(newText)
    setAtPicker(null)
    setJustAcceptedCtx(true)  // ocultar resultados tras seleccionar @contexto
    // NO llamar analyze: detectaría "@Media Sector " al final y reabriría el atPicker.
    // Solo actualizamos predicciones de fecha/tarea sin tocar el atPicker.
    const { forceType: ft } = detectForceType(newText)
    setForceType(ft)
    setCtxSuggestion(null)
    setDatePrediction(null)
    setTaskPrediction(false)
  }

  // ── saveAndClose (igual que QuickCaptureNode) ──────────────────────────────
  function saveAndClose() {
    const rawText = getCurrentText().trim()
    if (!rawText) { onClose(); return }

    // La lógica de creación vive en captureHelper (compartida con la ventana
    // flotante del Mac y el deep-link silencioso). Aquí solo añadimos la UI.
    const result = createNodeFromText(rawText, {
      assignedCtx,
      forceTypeLock: lockedForceTypeRef.current,
      taskPredictionHint: taskPrediction,
    })
    if (!result) { onClose(); return }

    setAssignedCtx([])
    lockedForceTypeRef.current = null
    showToast(`✓ ${labelForType(result.type)} creado`)
    onClose()
    navigate(`/node/${result.node.id}`)
  }

  // ── buildItems (del CommandPalette, sin panel-save) ────────────────────────
  const buildItems = useCallback((): PaletteItem[] => {
    const q = text.trim()
    const qNorm = normalizeText(q)

    // ── Vista FILTROS ──────────────────────────────────────────────────────
    if (view === 'filtros') {
      const filters = allFilterNodes()
      const filtered = q ? filters.filter(f => normalizeText(f.text).includes(qNorm)) : filters
      if (filtered.length === 0) return [{
        id: 'no-filtros',
        label: q ? `Sin filtros para "${q}"` : 'No hay filtros guardados',
        type: 'wf-action', taskStatus: null, score: 0, action: () => {},
      }]
      return filtered.map(f => ({
        id: `filtro-${f.id}`,
        label: f.text || t('common.noTitle'),
        sublabel: f.query,
        type: 'wf-action' as const,
        taskStatus: null,
        score: q ? scoreMatch(f.text, q) : 100,
        action: () => {
          window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: f.query } }))
          onClose()
        },
      }))
    }

    // ── Vista BUCLES ──────────────────────────────────────────────────────
    if (view === 'bucles') {
      const allBucles = store.allActive().filter(n =>
        !n.deletedAt && (n.types || []).includes('bucle')
      )
      const filtered = q ? allBucles.filter(n => normalizeText(n.text || '').includes(qNorm)) : allBucles
      if (filtered.length === 0) return [{
        id: 'no-bucles',
        label: q ? `Sin bucles para "${q}"` : 'No hay bucles abiertos',
        type: 'wf-action', taskStatus: null, score: 0, action: () => {},
      }]
      return filtered.map(n => ({
        id: `bucle-${n.id}`,
        label: n.text || t('common.noTitle'),
        sublabel: (() => {
          const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
          return parentText || 'Bucle abierto'
        })(),
        type: 'wf-action' as const,
        taskStatus: null as null,
        score: q ? scoreMatch(n.text || '', q) : 100,
        action: () => { navigate(`/node/${n.id}`); onClose() },
      }))
    }

    // ── Vista CONTEXTOS ────────────────────────────────────────────────────
    if (view === 'contextos') {
      if (!contextoRoot) return []
      const ctxAll = store.children(contextoRoot.id).filter(n => !n.deletedAt && n.text)
      const filtered = q ? ctxAll.filter(n => normalizeText(n.text).includes(qNorm)) : ctxAll
      if (filtered.length === 0) return [{
        id: 'no-ctx',
        label: q ? `Sin contextos para "${q}"` : 'No hay contextos',
        type: 'wf-action', taskStatus: null, score: 0, action: () => {},
      }]
      return filtered.map(n => ({
        id: `ctx-${n.id}`,
        label: n.text || '',
        sublabel: 'Abrir contexto',
        type: 'wf-action' as const,
        taskStatus: null as null,
        score: q ? scoreMatch(n.text || '', q) : 100,
        action: () => { onSelectContext?.(n.id); onClose() },
      }))
    }

    // ── Vista DEFAULT sin query — categorías limpias ───────────────────────
    if (!q) {
      const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      const tomorrowLabel = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) })()
      return [
        {
          id: 'quick-today',
          label: 'Hoy',
          sublabel: todayLabel,
          type: 'wf-action' as const,
          taskStatus: null,
          score: 200,
          action: () => { const n = getTodayDiaryUnderAgenda(); navigate(`/node/${n.id}`); onClose() },
        },
        {
          id: 'quick-tomorrow',
          label: 'Mañana',
          sublabel: tomorrowLabel,
          type: 'wf-action' as const,
          taskStatus: null,
          score: 190,
          action: () => {
            const d = new Date(); d.setDate(d.getDate()+1)
            import('../../utils/agendaHelper').then(({ ensureDayPath }) => {
              const n = ensureDayPath(d); navigate(`/node/${n.id}`); onClose()
            })
          },
        },
        {
          id: 'cat-filtros',
          label: 'Filtros',
          sublabel: (() => { const c = allFilterNodes().length; return c > 0 ? `${c} filtros guardados` : 'Sin filtros guardados' })(),
          type: 'wf-action' as const,
          taskStatus: null,
          score: 180,
          action: () => { setView('filtros'); setActiveIdx(0) },
        },
        {
          id: 'cat-contextos',
          label: 'Contextos',
          sublabel: (() => {
            if (!contextoRoot) return 'Sin contextos'
            const c = store.children(contextoRoot.id).filter(n => !n.deletedAt).length
            return c > 0 ? `${c} contextos` : 'Sin contextos'
          })(),
          type: 'wf-action' as const,
          taskStatus: null,
          score: 170,
          action: () => { setView('contextos'); setActiveIdx(0) },
        },
        {
          id: 'cat-bucles',
          label: 'Bucles',
          sublabel: (() => {
            const c = store.allActive().filter(n => !n.deletedAt && (n.types || []).includes('bucle')).length
            return c > 0 ? `${c} bucles abiertos` : 'Sin bucles abiertos'
          })(),
          type: 'wf-action' as const,
          taskStatus: null,
          score: 160,
          action: () => { setView('bucles'); setActiveIdx(0) },
        },
      ]
    }

    // ── Con query: búsqueda normal ─────────────────────────────────────────
    const qNormStr = qNorm

    // Shortcuts Hoy/Mañana
    if (['hoy', 'today', 'ho'].some(kw => kw.startsWith(qNormStr) || qNormStr.startsWith(kw.slice(0, 2)))) {
      const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      return [{ id: 'quick-today', label: t('cmdpalette.todayNote'), sublabel: todayLabel, type: 'wf-action', taskStatus: null, score: 300, action: () => { const n = getTodayDiaryUnderAgenda(); navigate(`/node/${n.id}`); onClose() } }]
    }
    if (['mañana', 'manana', 'tomorrow'].some(kw => qNormStr.length >= 2 && (kw.startsWith(qNormStr) || qNormStr.startsWith(kw.slice(0, 3))))) {
      const d = new Date(); d.setDate(d.getDate() + 1)
      const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      return [{ id: 'quick-tomorrow', label: t('cmdpalette.tomorrowNote'), sublabel: label, type: 'wf-action', taskStatus: null, score: 300, action: () => { import('../../utils/agendaHelper').then(({ ensureDayPath }) => { const n = ensureDayPath(d); navigate(`/node/${n.id}`); onClose() }) } }]
    }

    // "filtros" → vista filtros
    if (['filtros', 'filtro', 'filter'].some(kw => kw.startsWith(qNormStr) || qNormStr === kw)) {
      return [{ id: 'cat-filtros', label: 'Filtros guardados', sublabel: 'Ver todos los filtros', type: 'wf-action', taskStatus: null, score: 300, action: () => { setView('filtros'); setText(''); if (inputRef.current) inputRef.current.textContent = ''; setActiveIdx(0) } }]
    }

    // "contextos" → vista contextos
    if (['contextos', 'contexto', 'context'].some(kw => kw.startsWith(qNormStr) || qNormStr === kw)) {
      return [{ id: 'cat-contextos', label: 'Contextos', sublabel: 'Ver todos los contextos', type: 'wf-action', taskStatus: null, score: 300, action: () => { setView('contextos'); setText(''); if (inputRef.current) inputRef.current.textContent = ''; setActiveIdx(0) } }]
    }

    // "bucle/bucles" → vista bucles
    if (['bucles', 'bucle'].some(kw => kw.startsWith(qNormStr) || qNormStr === kw)) {
      return [{ id: 'cat-bucles', label: 'Bucles abiertos', sublabel: 'Ver todos los bucles', type: 'wf-action', taskStatus: null, score: 300, action: () => { setView('bucles'); setText(''); if (inputRef.current) inputRef.current.textContent = ''; setActiveIdx(0) } }]
    }

    // Búsqueda por nombre de contexto
    if (contextoRoot) {
      const ctxNodes = store.children(contextoRoot.id).filter(n => !n.deletedAt && n.text && normalizeText(n.text).includes(qNormStr))
      if (ctxNodes.length > 0) {
        return ctxNodes.map(n => ({
          id: `ctx-${n.id}`, label: n.text || '', sublabel: 'Abrir contexto',
          type: 'wf-action' as const, taskStatus: null as null,
          score: scoreMatch(n.text || '', q),
          action: () => { onSelectContext?.(n.id); onClose() },
        }))
      }
    }

    // Modo tag: query empieza con #
    if (q.startsWith('#')) {
      const tagQuery = q.slice(1).toLowerCase()
      const allTags = store.allUsedTags()
      if (!tagQuery) {
        return allTags.map(tag => ({ id: `tag-${tag}`, label: `#${tag}`, type: 'tag' as const, taskStatus: null, score: 100, action: () => { const nodes = store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(tag)); if (nodes.length === 1) { navigate(`/node/${nodes[0].id}`); onClose(); return }; navigate(`/tag/${tag}`); onClose() } }))
      }
      const matchingTags = allTags.filter(tg => tg.toLowerCase().includes(tagQuery))
      const tagItems: PaletteItem[] = matchingTags.map(tag => ({ id: `tag-${tag}`, label: `#${tag}`, sublabel: `${store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(tag)).length} notas`, type: 'tag' as const, taskStatus: null, score: tag.toLowerCase().startsWith(tagQuery) ? 90 : 60, action: () => { navigate(`/tag/${tag}`); onClose() } }))
      const exactTag = matchingTags.find(tg => tg.toLowerCase() === tagQuery)
      const noteItems: PaletteItem[] = exactTag ? store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(exactTag)).map(n => ({ id: `tagged-${n.id}`, label: n.text || 'Sin título', sublabel: `#${exactTag}`, type: 'note' as const, taskStatus: (n.status as 'pending' | 'done' | null) ?? null, score: 50, action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() } })) : []
      return [...tagItems.sort((a, b) => b.score - a.score), ...noteItems]
    }

    // Búsqueda estricta por texto
    const parsed = parseQuery(q)
    const searchTerm = parsed.cleanText || q
    const results: PaletteItem[] = []

    // Filtros guardados que coincidan
    for (const f of allFilterNodes()) {
      const sc2 = scoreMatch(f.text, searchTerm)
      if (sc2 > 0) results.push({ id: `filtro-${f.id}`, label: f.text || t('common.noTitle'), sublabel: `◈ ${f.query}`, type: 'wf-action' as const, taskStatus: null, score: sc2 + 10, action: () => { window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: f.query } })); onClose() } })
    }

    // Scope de búsqueda de nodos: SOLO dentro de 📅 Agenda (+ favoritos sueltos).
    // Nunca dentro de contextos, papelera ni carpetas de sistema.
    const agendaRoot = findAgendaRoot()
    const agendaIds = new Set<string>()
    if (agendaRoot) {
      const queue = [agendaRoot.id]
      while (queue.length) {
        const pid = queue.shift()!
        for (const c of store.children(pid).filter(c => !c.deletedAt)) {
          agendaIds.add(c.id)
          queue.push(c.id)
        }
      }
    }

    for (const n of store.allActive()) {
      if (n.isDiaryEntry || n.deletedAt) continue
      if (atajosRoot && (n.id === atajosRoot.id || n.parentId === atajosRoot.id)) continue
      // Fuera de Agenda solo se permiten favoritos
      if (!agendaIds.has(n.id) && !n.isFavorite) continue
      const sc = scoreMatch(n.text || '', searchTerm)
      if (sc === 0) continue
      const isBucleNode = (n.types || []).includes('bucle')
      const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
      results.push({
        id: `note-${n.id}`,
        label: n.text || t('common.noTitle'),
        // Bucles: sublabel con indicador, score extra para aparecer primero
        sublabel: isBucleNode ? `⟲ bucle${parentText ? ' · ' + parentText : ''}` : parentText,
        type: 'note' as const,
        taskStatus: (n.status as 'pending' | 'done' | null) ?? null,
        score: isBucleNode ? sc + 30 : sc,  // bucles flotan arriba
        action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() },
      })
    }
    results.sort((a, b) => b.score - a.score)
    results.splice(20)

    // Colapsar / expandir
    const qLow = q.toLowerCase()
    if (['colapsar', 'collapse', 'plegar', 'contraer'].some(kw => kw.includes(qLow) || qLow.includes(kw.slice(0, 3)))) {
      results.unshift({ id: 'wf-collapse-all', label: t('cmdpalette.collapseAll'), sublabel: currentNodeId ? 'Colapsa todos los hijos del nodo actual' : 'Colapsa todos los nodos raíz', type: 'wf-action', taskStatus: null, score: 200, action: () => { store.collapseAll(currentNodeId); onClose(); showToast('Todo colapsado', 'success') } })
    }
    if (['expandir', 'expand', 'desplegar'].some(kw => kw.includes(qLow) || qLow.includes(kw.slice(0, 3)))) {
      results.unshift({ id: 'wf-expand-all', label: t('cmdpalette.expandAll'), sublabel: currentNodeId ? 'Expande todos los hijos del nodo actual' : 'Expande todos los nodos raíz', type: 'wf-action', taskStatus: null, score: 200, action: () => { store.expandAll(currentNodeId); onClose(); showToast('Todo expandido', 'success') } })
    }

    // Item "Crear" siempre al final cuando hay texto
    results.push({
      id: 'create-item',
      label: `Crear: ${q}`,
      type: 'create',
      taskStatus: null,
      score: -1,
      action: saveAndClose,
    })

    return results
  }, [text, view, navigate, onClose, t, contextoRoot, atajosRoot, allFilterNodes, onSelectContext, currentNodeId, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = buildItems()

  // ── handleKeyDown ──────────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Para teclas de navegación: preventDefault PRIMERO para evitar que el
    // contentEditable mueva el cursor antes de que podamos capturar el evento
    const isNav = ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)
    if (isNav) e.preventDefault()

    // Siempre detener la propagación — ninguna tecla llega al árbol ni a MainLayout
    e.stopPropagation();
    (e.nativeEvent as Event).stopImmediatePropagation()

    // @ picker toma prioridad
    if (atPicker) {
      if (e.key === 'ArrowDown') { setAtPicker(p => p ? { ...p, activeIdx: Math.min(p.activeIdx + 1, p.items.length - 1) } : p); return }
      if (e.key === 'ArrowUp') { setAtPicker(p => p ? { ...p, activeIdx: Math.max(p.activeIdx - 1, 0) } : p); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const item = atPicker.items[atPicker.activeIdx]
        if (item) selectAtItem(item)
        return
      }
      if (e.key === 'Escape') { setAtPicker(null); return }
    }

    if (e.key === 'Escape') {
      if (view !== 'default') {
        setView('default')
        setText('')
        if (inputRef.current) inputRef.current.textContent = ''
        setActiveIdx(0)
        return
      }
      onClose(); return
    }

    if (e.key === 'ArrowDown') { setActiveIdx(i => Math.min(i + 1, items.length - 1)); return }
    if (e.key === 'ArrowUp') { setActiveIdx(i => Math.max(i - 1, 0)); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (ctxSuggestion) { acceptCtx(); return }
      if (datePrediction) { acceptDate(); return }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 1. @ picker (ya manejado arriba)
      // 2. ctx suggestion → aceptar ghost text
      if (ctxSuggestion) { acceptCtx(); return }
      // 2b. Acabamos de aceptar un contexto → el siguiente Enter crea directamente
      if (justAcceptedCtx) {
        setJustAcceptedCtx(false)
        const t = getCurrentText().trim()
        if (t) { saveAndClose(); return }
        onClose(); return
      }
      // 3. Tipo forzado activo (-t/-e/-b) → crear directamente, sin ejecutar items
      if (lockedForceTypeRef.current !== null) {
        const t = getCurrentText().trim()
        if (t) { saveAndClose(); return }
        onClose(); return
      }
      // 4. Item activo de la lista (solo si no hay tipo forzado)
      if (items[activeIdx]) { items[activeIdx].action(); return }
      // 5. Texto → crear
      const t = getCurrentText().trim()
      if (t) { saveAndClose(); return }
      // 5. Vacío → cerrar
      onClose()
    }
  }

  // ── Ghost text ─────────────────────────────────────────────────────────────
  const ghostLabel = (() => {
    if (ctxSuggestion) {
      const typed = ctxSuggestion.displayName.slice(0, ctxSuggestion.typedLen)
      return `${typed}${ctxSuggestion.ghost}`
    }
    if (forceType === 'bucle') return '⟲ bucle'
    if (taskPrediction && datePrediction) return `☐ ${datePrediction.parsed.label}${datePrediction.timeStr ? ' · ' + datePrediction.timeStr : ''}`
    if (taskPrediction) return '☐ tarea'
    if (datePrediction) return datePrediction.parsed.label + (datePrediction.timeStr ? ' · ' + datePrediction.timeStr : '')
    return null
  })()

  const ghostAcceptKey = ctxSuggestion ? '⇥' : (forceType === 'bucle' || (taskPrediction && !datePrediction)) ? '↵' : '⇥'

  // ── Icon helper ────────────────────────────────────────────────────────────
  function itemIcon(item: PaletteItem): string {
    if (item.type === 'tag') return '#'
    if (item.type === 'create') return '+'
    if (item.taskStatus === 'pending') return '☐'
    if (item.taskStatus === 'done') return '✓'
    if (item.id.startsWith('ctx-')) return '🧠'
    if (item.id.startsWith('filtro-')) return '◈'
    if (item.id.startsWith('bucle-')) return '⟲'
    if (item.id === 'cat-filtros') return '◈'
    if (item.id === 'cat-contextos') return '🧠'
    if (item.id === 'cat-bucles') return '⟲'
    if (item.id.startsWith('quick-')) return '📅'
    if (item.id.startsWith('wf-')) return '⌘'
    return '•'
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
      <div
        onKeyDown={handleKeyDown as unknown as React.KeyboardEventHandler<HTMLDivElement>}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          padding: '14px 16px 0',
          width: 560,
          maxWidth: '90vw',
          height: 440,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>

        {/* Subview header */}
        {view !== 'default' && (
          <button
            onMouseDown={e => { e.preventDefault(); setView('default'); setText(''); if (inputRef.current) inputRef.current.textContent = ''; setActiveIdx(0) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 12,
              padding: '0 0 10px 0', alignSelf: 'flex-start',
            }}
          >
            ← {view === 'filtros' ? 'Filtros' : view === 'contextos' ? 'Contextos' : 'Bucles'}
          </button>
        )}

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
          <span style={{
            color: (taskPrediction || forceType === 'task') ? 'var(--accent)' : forceType === 'event' ? '#3b82f6' : 'var(--text-tertiary)',
            fontSize: 14, flexShrink: 0,
          }}>
            {forceType === 'event' ? '📅' : forceType === 'bucle' ? '⟲' : (taskPrediction || forceType === 'task') ? '☐' : '•'}
          </span>
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder={
              view === 'filtros' ? 'Buscar filtro…'
              : view === 'contextos' ? 'Buscar contexto…'
              : view === 'bucles' ? 'Buscar bucle…'
              : 'Escribe un nodo, tarea o idea...'
            }
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
                if (isRecording) recordingStore.stopRecording()
                else recordingStore.startRecording()
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
            flex: 1, overflowY: 'auto',
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

        {/* Fila única: chips de contexto + ghost text — siempre reserva espacio */}
        {!atPicker && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            marginTop: 6, paddingLeft: 24, paddingBottom: 4,
            minHeight: 24, flexShrink: 0,
          }}>
            {/* Chips de contextos asignados */}
            {assignedCtx.map(ctx => (
              <span key={ctx.slug} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: 'var(--accent)', color: 'white',
                borderRadius: 20, padding: '2px 6px 2px 5px',
                fontSize: 11, fontWeight: 500, flexShrink: 0,
              }}>
                <span style={{ opacity: 0.75 }}>◈</span>
                {ctx.name}
                <button
                  onMouseDown={e => { e.preventDefault(); setAssignedCtx(prev => prev.filter(c => c.slug !== ctx.slug)) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', opacity: 0.7, padding: 0, fontSize: 11, lineHeight: 1 }}
                >×</button>
              </span>
            ))}
            {/* Ghost text (tarea, fecha, contexto incompleto) */}
            {ghostLabel && (
              <span className="from-ghost" style={{ flexShrink: 0 }}>
                <span className="from-ghost-text">{ghostLabel}</span>
                <span className="from-ghost-sep">·</span>
                <span className="from-ghost-key">{ghostAcceptKey}</span>
              </span>
            )}
          </div>
        )}

        {/* Separador + lista — ocultos en modo creación:
            - texto con @contexto (usuario referenciando, no buscando)
            - forceType activo (-t, -b, -e)
            - justAcceptedCtx (recién aceptó un contexto) */}
        {!atPicker && !justAcceptedCtx && !(text.includes('@')) && forceType === null && items.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0', flexShrink: 0 }} />
            <div
              ref={listRef}
              style={{ flex: 1, overflowY: 'auto', marginTop: 2, paddingBottom: 8 }}
            >
              {items.map((item, idx) => (
                <button
                  key={item.id}
                  tabIndex={-1}
                  data-active={idx === activeIdx ? 'true' : 'false'}
                  onMouseDown={e => { e.preventDefault(); item.action() }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 12px',
                    background: idx === activeIdx ? 'var(--bg-hover)' : 'transparent',
                    border: 'none', textAlign: 'left', cursor: 'pointer',
                    fontSize: 13, borderRadius: 6,
                    color: item.taskStatus === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: item.taskStatus === 'done' ? 'line-through' : 'none',
                  }}
                >
                  <span style={{
                    fontSize: item.type === 'create' ? 16 : 13,
                    color: item.type === 'create' ? 'var(--accent)' : 'var(--text-tertiary)',
                    flexShrink: 0, width: 18, textAlign: 'center',
                  }}>
                    {itemIcon(item)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                    {item.sublabel && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.sublabel}
                      </div>
                    )}
                  </div>
                  {(item.id === 'cat-filtros' || item.id === 'cat-contextos' || item.id === 'cat-bucles') && (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12, flexShrink: 0 }}>→</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
