/**
 * TemplatePropertiesPanel — propiedades de una plantilla en la columna derecha.
 * Mismo patrón que Contextos/Prompts/Agentes. El contenido de la plantilla se
 * edita en la ventana central (sus nodos hijos, como cualquier nota).
 * Aquí: opciones de auto-aplicación (de momento, a la nota diaria).
 */
import { useStore } from '../../store/nodeStore'
import { getDailyTemplate, setDailyTemplate } from '../../utils/tagsHelper'

interface Props {
  nodeId: string
  onBack: () => void
}

export default function TemplatePropertiesPanel({ nodeId, onBack }: Props) {
  const s = useStore()
  void s.nodesVersion
  const node = s.getNode(nodeId)
  if (!node) return null

  const daily = getDailyTemplate()
  const isDaily = daily?.id === nodeId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 40, flexShrink: 0, borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          ← Plantillas
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Aplicar a la nota diaria */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Auto-aplicar
          </div>
          <button
            onClick={() => setDailyTemplate(nodeId, !isDaily)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: isDaily ? 'rgba(34,197,94,0.10)' : 'var(--bg-secondary)',
              border: '1px solid', borderColor: isDaily ? 'rgba(34,197,94,0.4)' : 'var(--border)',
              borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: isDaily ? '#22c55e' : 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Nota diaria</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {isDaily ? 'Cada día nuevo arranca con esta plantilla.' : 'Aplicar esta plantilla al crear la nota del día.'}
              </span>
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{isDaily ? 'Activa' : 'clic'}</span>
          </button>
          {isDaily && daily && daily.id !== nodeId && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              (Sustituirá a «{daily.text}» como plantilla diaria.)
            </div>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          El contenido de la plantilla se edita en la ventana central, en bullets, como cualquier nota. Lo que pongas aquí dentro es lo que se copiará al aplicarla.
        </div>
      </div>
    </div>
  )
}
