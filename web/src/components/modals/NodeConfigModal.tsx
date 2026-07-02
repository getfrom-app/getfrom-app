// NodeConfigModal — edición de un PROMPT / AGENTE / PLANTILLA SIN salir del lienzo.
// Overlay sobre el plano: a la izquierda el CONTENIDO (Outliner editable de sus hijos),
// a la derecha sus PROPIEDADES (el mismo panel de la columna derecha). Así estas
// entidades de configuración se editan enteras dentro del lienzo, sin navegar a /node.
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import Outliner from '../outliner/Outliner'
import PromptPropertiesPanel from '../panels/PromptPropertiesPanel'
import AgentPropertiesPanel from '../panels/AgentPropertiesPanel'
import TemplatePropertiesPanel from '../panels/TemplatePropertiesPanel'

export type ConfigKind = 'prompt' | 'agent' | 'template'

export default function NodeConfigModal({ nodeId, kind, onClose, onTestInMagic }: {
  nodeId: string
  kind: ConfigKind
  onClose: () => void
  onTestInMagic: (promptId: string) => void
}) {
  const { t } = useTranslation()
  useStore()
  const node = store.getNode(nodeId)

  // Escape cierra el modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!node) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: 'stretch', justifyContent: 'center', padding: '4vh 4vw' }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', width: '100%', maxWidth: 1180, height: '92vh', margin: 'auto',
          background: 'var(--bg-elevated, #fff)', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)', border: '1px solid var(--border, #e2e2e2)',
        }}>
        {/* Contenido: outliner editable de los hijos del nodo (el cuerpo real). */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border, #ececec)' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #222)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.text || t('common.noTitle')}</span>
            <span style={{ flex: 1 }} />
            <button onClick={onClose} title={t('common.close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--text-secondary, #888)', padding: 4 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
            <Outliner parentId={nodeId} autoFocusEmpty placeholder={t('cmdpalette.writeHere', 'Escribe aquí…')} />
          </div>
        </div>
        {/* Propiedades: el mismo panel que la columna derecha. */}
        <div style={{ width: 330, flexShrink: 0, borderLeft: '1px solid var(--border, #ececec)', overflowY: 'auto', background: 'var(--bg, #fff)' }}>
          {kind === 'prompt' && <PromptPropertiesPanel nodeId={nodeId} onBack={onClose} onTestInMagic={onTestInMagic} />}
          {kind === 'agent' && <AgentPropertiesPanel nodeId={nodeId} onBack={onClose} />}
          {kind === 'template' && <TemplatePropertiesPanel nodeId={nodeId} onBack={onClose} />}
        </div>
      </div>
    </div>,
    document.body
  )
}
