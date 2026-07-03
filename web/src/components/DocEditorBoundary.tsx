// DocEditorBoundary — red de seguridad LOCAL alrededor de DocEditor (tarjeta y panel).
// Contexto: un bucle de renders (React #185) al SELECCIONAR texto en el lienzo tumbaba
// TODA la app (solo quedaba «Reintentar» → recarga completa). Causa exacta sin determinar
// del todo tras una investigación a fondo (aislado a DocEditor con Claude in Chrome +
// modo dev, pero persistía tras desactivar BubbleMenu y los disparos de notifyDocEditor).
// Mientras se sigue investigando: si DocEditor vuelve a explotar, que se rompa SOLO su
// hueco (tarjeta o columna derecha) — nunca la app entera — y se pueda reintentar sin
// recargar toda la página. v9.6.681.
import { Component, ErrorInfo, ReactNode } from 'react'

export default class DocEditorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { error: Error | null }> {
  constructor(props: { children: ReactNode; compact?: boolean }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DocEditor error (contenido):', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: this.props.compact ? '10px 4px' : '20px', fontSize: 13, color: 'var(--text-secondary,#888)' }}>
          No se pudo abrir este texto.{' '}
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background: 'none', border: '1px solid var(--border,#ddd)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--accent,#8b5cf6)' }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
