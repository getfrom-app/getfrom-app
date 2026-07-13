// Detalle de un AGENTE en la columna derecha de Fromly 2.0.
// Sigue el patrón de V2TaskDetailView: la ventana central es la NOTA del agente
// (su prompt de usuario, editable con el mismo editor que cualquier nota —
// V2NoteBody, reutilizado tal cual) + su contexto (clic navega). Las propiedades
// reales (activar/pausar, ejecutar ahora, programación) viven en
// AgentPropertiesPanel de v1, reutilizado SIN reescribir (mismo patrón que
// SettingsModal/PlannerPanel/RightColMenu ya reutilizados en v2).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { firstContextOf, contextColor, getOrCreateContainerNotes } from '../../utils/cajones'
import { getAgentData } from '../../utils/agentesHelper'
import { trashNode } from '../../utils/papeleraHelper'
import AgentPropertiesPanel from '../../components/panels/AgentPropertiesPanel'
import { V2NoteBody } from './V2DetailView'

interface Props {
  node: Node
  onSelectCtx: (id: string) => void
}

export default function V2AgentDetailView({ node, onSelectCtx }: Props) {
  useStore()
  const { t } = useTranslation()
  const ctx = firstContextOf(node)
  const data = getAgentData(node.id)
  // La "nota" del agente = su prompt de usuario: se edita como cualquier nota
  // (mismo editor V2NoteBody), aquí sobre un contenedor de notas dedicado del
  // agente (igual patrón que V2TaskDetailView con getOrCreateContainerNotes).
  const notesNode = getOrCreateContainerNotes(node.id)
  // Propiedades a la derecha, dentro de la misma columna (debajo, ya que v2 no
  // tiene una columna extra): panel plegable con el control real de v1.
  const [showProps, setShowProps] = useState(true)

  return (
    <div style={{ padding: '4px 18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
        <span style={{ fontSize: 20 }}>{data?.icon || '🤖'}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          color: data?.enabled ? '#22c55e' : 'var(--text-tertiary)',
          background: data?.enabled ? 'rgba(34,197,94,0.10)' : 'var(--bg-secondary)' }}>
          {data?.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')}
        </span>
        <button
          title={t('tip.delete', 'Eliminar')}
          onClick={() => { trashNode(node.id); window.dispatchEvent(new Event('from:close-detail')) }}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>

      {/* Contexto — clic navega (sidebar + columna derecha), mismo patrón que tarea/nota. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {ctx ? (
          <button className="v2-el-ctxchip" style={{ ['--chip' as string]: contextColor(ctx.id), cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent' }}
            onClick={() => onSelectCtx(ctx.id)}>
            {ctx.text}
          </button>
        ) : (
          <span className="v2-el-meta">{t('v2.taskDetail.noContext', 'Sin contexto')}</span>
        )}
      </div>

      {/* Prompt del agente — EL MISMO editor completo que cualquier nota. */}
      <div style={{ marginTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📝 {t('agents.promptLabel', 'Instrucción del agente')}</div>
        <V2NoteBody node={notesNode} onSelectCtx={onSelectCtx} inlinePage hideContext />
      </div>

      {/* Propiedades reales del agente (activar/pausar, ejecutar, programación) —
          AgentPropertiesPanel de v1 reutilizado tal cual, plegable. */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button
          onClick={() => setShowProps(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showProps ? 8 : 0 }}
        >
          <span className="v2-section-label" style={{ padding: 0 }}>⚙️ {t('agents.propertiesLabel', 'Propiedades')}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{showProps ? '▾' : '▸'}</span>
        </button>
        {showProps && (
          <div style={{ minHeight: 260, border: '1px solid var(--border)', borderRadius: 8 }}>
            <AgentPropertiesPanel nodeId={node.id} onBack={() => setShowProps(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
