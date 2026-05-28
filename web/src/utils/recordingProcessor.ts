// MARK: - recordingProcessor
//
// Procesa una grabación de voz con IA y crea nodos en el diario de hoy.
// Flujo: transcripción → AI (título, resumen, tareas, contexto) → nodos.

import { store } from '../store/nodeStore'
import { getTodayDiaryUnderAgenda } from './agendaHelper'
import { aiInlineStream, TokensError } from '../api/client'
import { learningsStore } from '../store/learningsStore'

export interface ProcessingResult {
  parentId: string
  title: string
  hasTasks: boolean
}

interface AIAnalysis {
  title: string
  summary: string
  tasks: string[]          // vacío si no hay tareas claras
  context: string | null   // nombre de contexto/tag, null si no es claro
}

/** Llama a la IA y parsea la respuesta JSON */
async function analyzeTranscript(transcript: string, durationSec: number): Promise<AIAnalysis> {
  const minutes = Math.round(durationSec / 60)
  const isLong = durationSec >= 180  // ≥3 minutos = grabación larga
  const learnings = learningsStore.buildPromptBlock()

  const prompt = `Analiza esta transcripción de audio de ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.
${learnings ? `\n${learnings}\n` : ''}
Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.

Formato exacto:
{
  "title": "Título breve descriptivo (máximo 7 palabras)",
  "summary": "${isLong
    ? 'Resumen ejecutivo estructurado con los puntos clave, decisiones tomadas y conclusiones principales. Usa saltos de línea para separar bloques.'
    : 'Resumen breve de 2-4 frases con la idea principal y el contexto.'}",
  "tasks": ["tarea 1", "tarea 2"],
  "context": null
}

Reglas:
- "tasks": array de strings con las acciones concretas mencionadas. VACÍO si no hay tareas claras y explícitas.
- "context": nombre de proyecto o área si se menciona con claridad (ej: "la-isla", "cafe-ole", "media-sector"). null si no es evidente.
- No inventes información que no esté en el audio.

Transcripción:
${transcript}`

  let raw = ''
  try {
    await aiInlineStream(prompt, undefined, (chunk) => { raw += chunk })
  } catch (e) {
    if (e instanceof TokensError) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'ai_limit' } }))
      throw new Error('TOKENS')
    }
    throw e
  }

  // Extraer JSON de la respuesta (puede venir envuelto en ```json ... ```)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI no devolvió JSON válido')

  try {
    const parsed = JSON.parse(jsonMatch[0]) as AIAnalysis
    return {
      title:   (parsed.title   || 'Grabación').slice(0, 80),
      summary: (parsed.summary || '').trim(),
      tasks:   Array.isArray(parsed.tasks) ? parsed.tasks.filter(Boolean) : [],
      context: typeof parsed.context === 'string' && parsed.context ? parsed.context : null,
    }
  } catch {
    throw new Error('Error al parsear respuesta de la IA')
  }
}

/** Crea los nodos en el diario de hoy y devuelve el resultado */
export async function processRecording(
  transcript: string,
  durationSec: number
): Promise<ProcessingResult> {
  const today = getTodayDiaryUnderAgenda()
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  let analysis: AIAnalysis
  try {
    analysis = await analyzeTranscript(transcript, durationSec)
  } catch (e) {
    if (e instanceof Error && e.message === 'TOKENS') throw e
    // Si la IA falla, crear nodo con datos básicos sin resumen
    analysis = {
      title:   `Grabación ${timeStr}`,
      summary: '',
      tasks:   [],
      context: null,
    }
  }

  // ── Nodo padre ──────────────────────────────────────────────────────────
  const types: string[] = []
  if (analysis.context) types.push(analysis.context)

  const parent = store.createNode({
    text:     `🎙 ${analysis.title}`,
    parentId: today.id,
    types,
  })

  // ── Transcripción completa (colapsada) ─────────────────────────────────
  const transcriptNode = store.createNode({
    text:     'Transcripción completa',
    parentId: parent.id,
  })
  store.updateNode(transcriptNode.id, {
    body:        transcript,
    isCollapsed: true,
  })

  // ── Resumen (colapsado) ────────────────────────────────────────────────
  if (analysis.summary) {
    const summaryNode = store.createNode({
      text:     durationSec >= 180 ? 'Resumen ejecutivo' : 'Resumen',
      parentId: parent.id,
    })
    store.updateNode(summaryNode.id, {
      body:        analysis.summary,
      isCollapsed: true,
    })
  }

  // ── Tareas propuestas (si las hay, colapsadas) ─────────────────────────
  if (analysis.tasks.length > 0) {
    const tasksContainer = store.createNode({
      text:     '📋 Tareas identificadas',
      parentId: parent.id,
    })
    store.updateNode(tasksContainer.id, { isCollapsed: true })

    for (const taskText of analysis.tasks) {
      store.createNode({
        text:     taskText,
        parentId: tasksContainer.id,
        isTask:   true,
      })
    }
  }

  // Forzar sync inmediato para que no se pierda
  store.sync(true).catch(() => {})

  return {
    parentId: parent.id,
    title:    analysis.title,
    hasTasks: analysis.tasks.length > 0,
  }
}
