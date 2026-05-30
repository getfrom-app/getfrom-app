/**
 * ContextChips — Chips de sugerencia contextual en el chat IA
 *
 * Aparecen cuando el chat está vacío y el usuario no ha escrito nada.
 * Desaparecen al escribir o al enviar el primer mensaje.
 *
 * Dos modos:
 *  - Nodo tag o perfil IA → 3 chips especiales de mejora de contexto
 *  - Nodo normal con contenido → chips generados client-side por tipo de contenido
 */
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'

export interface ContextChip {
  label: string
  icon: string
  /** Prompt que se envía al AI, o clave especial '__mejorar__', '__completar__', '__asistente__' */
  prompt: string
  /** Estilo especial para chips de tag/perfil */
  accent?: boolean
}

// ── Detección de tipo de nodo ─────────────────────────────────────────────────

function isTagNode(nodeId: string): boolean {
  const node = store.getNode(nodeId)
  if (!node) return false
  // Bajo árbol 🏷 Tags
  const tagsRoot = store.children(null).find(n => !n.deletedAt && n.text === '🏷 Tags')
  if (tagsRoot) {
    // Comprobar si el nodo es descendiente de tagsRoot
    let current = node
    while (current.parentId) {
      if (current.parentId === tagsRoot.id) return true
      const parent = store.getNode(current.parentId)
      if (!parent) break
      current = parent
    }
  }
  // O tiene _tagDefinition en extraData
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._tagDefinition) return true
  } catch { /* ignore */ }
  return false
}

function isProfileNode(nodeId: string): boolean {
  return store.perfilIANode()?.id === nodeId
}

// ── Generación de chips ───────────────────────────────────────────────────────

export function generateContextChips(nodeId: string | undefined): ContextChip[] {
  if (!nodeId) return []
  const node = store.getNode(nodeId)
  if (!node || node.deletedAt) return []

  // Tag o perfil IA → 3 chips siempre
  if (isProfileNode(nodeId) || isTagNode(nodeId)) {
    const name = node.text || 'este nodo'
    return [
      {
        label: 'Mejorar contexto',
        icon: '✨',
        prompt: `__mejorar_contexto__:${nodeId}`,
        accent: true,
      },
      {
        label: 'Completar contexto',
        icon: '🔍',
        prompt: `__completar_contexto__:${nodeId}`,
        accent: true,
      },
      {
        label: 'Asistente de contexto',
        icon: '🎤',
        prompt: `__asistente_contexto__:${nodeId}:${name}`,
        accent: true,
      },
    ]
  }

  // Nodo normal — chips según contenido
  const chips: ContextChip[] = []
  const body     = node.body || ''
  const text     = node.text || ''
  const children = store.children(nodeId).filter(n => !n.deletedAt)
  const hasTasks = children.some(c => c.status !== null)
  const isEmpty  = !body.trim() && children.length === 0

  if (isEmpty) return []  // nodo vacío → sin chips

  if (body.length > 300) {
    chips.push({ label: 'Resumir', icon: '📝', prompt: 'Resume el contenido de esta nota en los puntos más importantes.' })
  }
  if (hasTasks) {
    chips.push({ label: 'Priorizar tareas', icon: '⚡', prompt: 'Analiza las tareas de esta nota y dime cómo priorizarlas según urgencia e impacto.' })
  }
  if (body.length > 100 || children.length > 3) {
    chips.push({ label: 'Organizar', icon: '📋', prompt: 'Organiza y estructura mejor el contenido de esta nota. Propón un formato más claro.' })
  }
  if (body.length > 0) {
    chips.push({ label: 'Continuar', icon: '🚀', prompt: `Continúa desarrollando el contenido de esta nota sobre "${text}". Añade ideas relevantes.` })
  }
  if (text && !body && children.length > 0) {
    chips.push({ label: 'Analizar', icon: '🔎', prompt: `Analiza el contenido de "${text}" e identifica patrones, insights o acciones clave.` })
  }

  return chips.slice(0, 4)
}

// ── Expansión de prompts especiales ───────────────────────────────────────────

/** Expande una clave especial (__mejorar__, etc.) al prompt real para el AI */
export function expandSpecialPrompt(raw: string): string {
  if (raw.startsWith('__mejorar_contexto__:')) {
    const nodeId = raw.split(':')[1]
    const node = store.getNode(nodeId)
    const content = node ? `Título: ${node.text}\n\nContenido actual:\n${node.body || '(vacío)'}` : '(nodo no encontrado)'
    return `Quiero mejorar el contexto de este nodo para que sirva mejor como referencia para la IA.

${content}

Por favor:
1. Reescribe el contenido de forma más clara, estructurada y completa
2. Usa formato Markdown con secciones claras
3. Mantén toda la información importante, añade la que falta
4. Explica brevemente qué cambios hiciste y por qué

Cuando termines, usa update_node para guardar el resultado con id="${nodeId}".`
  }

  if (raw.startsWith('__completar_contexto__:')) {
    const nodeId = raw.split(':')[1]
    const node = store.getNode(nodeId)
    const content = node ? `Título: ${node.text}\n\nContenido actual:\n${node.body || '(vacío)'}` : '(nodo no encontrado)'
    return `Quiero completar el contexto de este nodo haciéndome preguntas.

${content}

Por favor:
1. Analiza el contenido actual e identifica qué información falta o podría ampliarse
2. Hazme UNA SOLA pregunta a la vez para recopilar esa información
3. Después de cada respuesta mía, haz la siguiente pregunta
4. Cuando tengas suficiente información (mínimo 3-4 rondas de preguntas), avísame y usa update_node para guardar el contexto completo con id="${nodeId}"

Empieza con tu primera pregunta.`
  }

  if (raw.startsWith('__asistente_contexto__:')) {
    const parts = raw.split(':')
    const nodeId = parts[1]
    const name   = parts.slice(2).join(':')
    const node = store.getNode(nodeId)
    const content = node?.body ? `\n\nContenido actual:\n${node.body}` : ''
    return `Actúa como asistente de contexto para el nodo "${name}".${content}

Voy a contarte libremente todo lo que sé sobre este tema. Tu rol:
1. Escucha y absorbe todo lo que te cuento
2. Haz preguntas de aclaración cuando algo no esté claro
3. Resume periódicamente lo que has entendido
4. Cuando yo diga "listo" o "ya está", organiza toda la información y usa update_node con id="${nodeId}" para guardar el contexto completo y bien estructurado

Estoy listo. Cuéntame qué necesitas saber para empezar, o directamente empieza a contarme.`
  }

  return raw
}

// ── Componente UI ─────────────────────────────────────────────────────────────

interface ContextChipsProps {
  nodeId: string | undefined
  visible: boolean   // false cuando el usuario ya escribió o hay mensajes
  onSelect: (prompt: string) => void
}

export default function ContextChips({ nodeId, visible, onSelect }: ContextChipsProps) {
  const { t } = useTranslation()
  if (!visible) return null
  const chips = generateContextChips(nodeId)
  if (!chips.length) return null

  const isSpecial = chips[0]?.accent

  return (
    <div style={{
      padding: '12px 16px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {isSpecial && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('ai.aiContext')}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((chip, i) => (
          <button
            key={i}
            onClick={() => onSelect(chip.prompt)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: chip.accent ? 'rgba(139,92,246,0.08)' : 'var(--bg-secondary)',
              border: `1px solid ${chip.accent ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 12,
              color: chip.accent ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: chip.accent ? 500 : 400,
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.background = chip.accent ? 'rgba(139,92,246,0.15)' : 'var(--bg-hover, var(--bg-primary))'
              el.style.color = chip.accent ? 'var(--accent)' : 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background = chip.accent ? 'rgba(139,92,246,0.08)' : 'var(--bg-secondary)'
              el.style.color = chip.accent ? 'var(--accent)' : 'var(--text-secondary)'
            }}
          >
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
