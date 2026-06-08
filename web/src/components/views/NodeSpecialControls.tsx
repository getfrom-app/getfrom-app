// MARK: - NodeSpecialControls
//
// Barra de controles para nodos especiales de From.
// Se muestra entre el título y los hijos en NodeView.
// Mismo estilo visual que los controles de Agenda (diary-nav-btn).
//
// Nodos soportados:
//   · Agente (_agentDef="1")    — toggle, ejecutar, schedule, último run
//   · Atajo  (_shortcutQuery)   — descripción del filtro + botón Aplicar
//   · 🗑 Papelera (raíz)       — contador + vaciar
//
// NO tienen controles especiales (se crean/gestionan como nodos normales):
//   · 🤖 Agentes (raíz)   — crea nuevo agente con Enter como cualquier nodo
//   · 📋 Plantillas (raíz) — crea nueva plantilla con Enter
//   · 📊 Paneles (raíz)    — los hijos son paneles individuales con sus propios controles

import { useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { emptyTrash } from '../../utils/papeleraHelper'

interface Props {
  node: Node
}

// Nota: los controles del agente (activo/ejecutar/programación) viven SOLO en la
// columna derecha (AgentPropertiesPanel). La ventana central muestra únicamente
// el prompt del usuario, sin barra de controles redundante.

// ── Atajo individual (_shortcutQuery) ─────────────────────────────────────────
// Un atajo es un filtro guardado. Al abrirlo, muestra qué filtro es
// y un botón para aplicarlo al árbol (igual que clicking en el sidebar).

function AtajoControls({ node }: Props) {
  let query = ''
  let view  = ''
  let targetNodeId = ''
  try {
    const ed = JSON.parse(node.extraData || '{}')
    query        = ed._shortcutQuery  || ''
    view         = ed._shortcutView   || 'lista'
    targetNodeId = ed._shortcutNodeId || ''
  } catch { return null }

  if (!query && !targetNodeId) return null

  function applyFilter() {
    if (targetNodeId) {
      // Atajo a un nodo específico → navegar
      window.location.href = `/app/node/${targetNodeId}`
    } else {
      // Atajo a un filtro → aplicar en árbol
      window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query } }))
      // Volver a root para ver el árbol filtrado
      if (window.location.pathname !== '/app/' && window.location.pathname !== '/app') {
        window.location.href = '/app/'
      }
    }
  }

  const label = targetNodeId
    ? 'Navegar al nodo'
    : `Filtrar: ${query}`

  return (
    <div className="node-special-bar">
      <span className="node-special-meta" style={{ fontFamily: 'monospace', fontSize: 11 }}>
        {targetNodeId ? `→ nodo` : `🔍 ${query}`}
      </span>
      <button
        className="node-special-pill node-special-pill--action"
        onClick={applyFilter}
        title={label}
      >
        ▶ Aplicar filtro
      </button>
      <span className="node-special-meta" style={{ opacity: 0.4, fontSize: 10 }}>
        Este nodo es un filtro guardado. El resultado se muestra en el árbol.
      </span>
    </div>
  )
}

// ── Raíz: 🗑 Papelera ────────────────────────────────────────────────────────

function PapeleraRootControls({ node }: Props) {
  const s = useStore()
  const children = s.children(node.id).filter(n => !n.deletedAt)

  function handleEmpty() {
    if (!confirm(`¿Vaciar la papelera? Se eliminarán permanentemente ${children.length} elemento(s).`)) return
    emptyTrash()
  }

  return (
    <div className="node-special-bar">
      <span className="node-special-meta">
        {children.length === 0
          ? 'La papelera está vacía'
          : `${children.length} elemento${children.length !== 1 ? 's' : ''}`
        }
      </span>
      <span className="node-special-meta" style={{ opacity: 0.5 }}>
        Botón derecho → Restaurar para recuperar un nodo
      </span>
      {children.length > 0 && (
        <button
          className="node-special-pill node-special-pill--action"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={handleEmpty}
        >
          Vaciar papelera
        </button>
      )}
    </div>
  )
}

// ── Router: detecta qué tipo de nodo es ──────────────────────────────────────

export default function NodeSpecialControls({ node }: Props) {
  try {
    const ed = JSON.parse(node.extraData || '{}')

    // Los agentes (_agentDef="1") NO tienen barra en el centro — sus controles
    // están en la columna derecha (AgentPropertiesPanel).

    // Atajo individual (_shortcutQuery o _shortcutNodeId)
    if (ed._shortcutQuery !== undefined || ed._shortcutNodeId) {
      return <AtajoControls node={node} />
    }
  } catch { /* ignore */ }

  // Nodos raíz especiales por nombre/emoji
  // (solo los que realmente necesitan controles; el resto se gestiona como nodos normales)
  const text = node.text || ''
  if (text === '🗑 Papelera')  return <PapeleraRootControls node={node} />

  return null
}
