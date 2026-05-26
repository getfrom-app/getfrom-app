import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
}

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string; desc: string }[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegación global',
    shortcuts: [
      { keys: 'Esc', desc: 'Ir a hoy / cerrar modales' },
      { keys: '⌘K', desc: 'Búsqueda / captura rápida' },
      { keys: '⌘⇧S', desc: 'Toggle sidebar' },
      { keys: '⌘[', desc: 'Página anterior (historial)' },
      { keys: '⌘]', desc: 'Página siguiente (historial)' },
      { keys: '?', desc: 'Ver atajos de teclado' },
      { keys: '⌘Z / ⌘⇧Z', desc: 'Deshacer / Rehacer' },
    ],
  },
  {
    title: 'Crear',
    shortcuts: [
      { keys: '⌘K', desc: 'Buscar / capturar (paleta de comandos)' },
      { keys: 'Clic ＋', desc: 'Nueva nota / tarea / evento (barra superior)' },
    ],
  },
  {
    title: 'Outliner',
    shortcuts: [
      { keys: 'Tab', desc: 'Indentar nodo' },
      { keys: '⇧Tab', desc: 'Desindentar nodo' },
      { keys: 'Enter', desc: 'Nuevo nodo hermano' },
      { keys: '⌘↑ / ⌘↓', desc: 'Mover nodo arriba/abajo' },
      { keys: '⌘D', desc: 'Duplicar nodo' },
      { keys: '⌘Enter', desc: 'Marcar tarea done/pending' },
      { keys: '⌘T', desc: 'Convertir en tarea' },
      { keys: '⌘⇧F', desc: 'Marcar como favorito' },
      { keys: 'Espacio', desc: 'IA inline — al inicio de un bullet vacío (Tab=aceptar, Esc=descartar)' },
      { keys: '⌘⇧C', desc: 'Colapsar/expandir todo' },
      { keys: 'Alt+Click', desc: 'Colapsar/expandir subárbol completo' },
      { keys: '/', desc: 'Menú de bloques (T, H1, H2, Tarea, Evento…)' },
      { keys: '#tag', desc: 'Añadir tag inline con autocomplete' },
      { keys: '@nombre', desc: 'Mencionar nota (crea enlace)' },
    ],
  },
  {
    title: 'Nota abierta',
    shortcuts: [
      { keys: '⌘P', desc: 'Abrir panel de propiedades' },
      { keys: '⌘F', desc: 'Buscar en documento' },
      { keys: '⌘L', desc: 'Copiar enlace de la nota' },
      { keys: '⌘K', desc: 'Abrir chat IA global' },
      { keys: '⌘B / ⌘I / ⌘E', desc: 'Negrita / Cursiva / Código (en body)' },
      { keys: '⌘⇧K', desc: 'Insertar enlace (en body)' },
      { keys: 'Tab / ⇧Tab', desc: 'Indentar/desindentar línea (en body)' },
    ],
  },
  {
    title: 'Calendario',
    shortcuts: [
      { keys: 'Click celda', desc: 'Crear evento inline en esa hora' },
      { keys: 'Click evento', desc: 'Ver detalles del evento (mini-popup)' },
      { keys: 'Drag evento', desc: 'Mover evento a otra hora/día' },
    ],
  },
  {
    title: 'Cambiar vista (Ctrl+N)',
    shortcuts: [
      { keys: 'Ctrl+1', desc: 'Ir a Hoy (diario)' },
      { keys: 'Ctrl+2', desc: 'Ir a Tareas' },
      { keys: 'Ctrl+3', desc: 'Ir a Calendario' },
      { keys: 'Ctrl+4', desc: 'Ir a Búsqueda' },
      { keys: 'Ctrl+5', desc: 'Ir a Kanban' },
      { keys: 'Ctrl+6', desc: 'Ir a Agentes' },
      { keys: 'Ctrl+7', desc: 'Ir a Chat IA' },
    ],
  },
]

export default function KeyboardShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box shortcuts-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
      >
        <div className="modal-header">
          <h2 className="modal-title">Atajos de teclado</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="shortcuts-grid">
          {GROUPS.map(group => (
            <div key={group.title} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{group.title}</h3>
              <ul className="shortcuts-list">
                {group.shortcuts.map(s => (
                  <li key={s.keys} className="shortcuts-item">
                    <kbd className="shortcut-key">{s.keys}</kbd>
                    <span className="shortcut-desc">{s.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="shortcuts-hint">Pulsa <kbd className="shortcut-key">?</kbd> para abrir este panel</p>
      </div>
    </div>,
    document.body
  )
}
