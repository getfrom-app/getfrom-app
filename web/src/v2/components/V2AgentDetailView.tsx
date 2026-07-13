// Detalle de un AGENTE en la columna derecha de Fromly 2.0.
// La ventana central es el CONTENIDO real del agente — el prompt de usuario se
// guarda como UN hijo-DOCUMENTO del nodo agente (createAgentUnder/readAgentNote/
// syncAgentUserMessage/getOrCreateAgentInstructionDoc en agentesHelper.ts), y se
// edita con el mismo editor de documento que cualquier nota (DocEditor, con
// formato/párrafos) — NUNCA con Outliner, que siempre muestra viñetas de lista
// aunque solo haya un hijo. Las propiedades reales (activar/pausar, ejecutar
// ahora, programación) viven en AgentPropertiesPanel de v1, reutilizado SIN
// reescribir.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { firstContextOf, contextColor } from '../../utils/cajones'
import { getAgentData, getOrCreateAgentInstructionDoc, syncAgentUserMessage } from '../../utils/agentesHelper'
import { trashNode } from '../../utils/papeleraHelper'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import DocInspector from '../../components/views/DocInspector'
import AgentPropertiesPanel from '../../components/panels/AgentPropertiesPanel'

interface Props {
  node: Node
  onSelectCtx: (id: string) => void
  onOpenElementsFiltered?: (kind: 'agent' | 'prompt') => void
}

export default function V2AgentDetailView({ node, onSelectCtx, onOpenElementsFiltered }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const ctx = firstContextOf(node)
  const data = getAgentData(node.id)
  // Propiedades a la derecha, dentro de la misma columna (debajo, ya que v2 no
  // tiene una columna extra): panel plegable con el control real de v1.
  const [showProps, setShowProps] = useState(true)
  const toggleFavorite = () => { const next = !node.isFavorite; store.updateNode(node.id, { isFavorite: next }) }

  // Documento-instrucción del agente (get-or-create UNA vez por nodo, no en cada
  // render — mismo patrón que getOrCreateContainerNotes en V2ContextView).
  const docNode = useMemo(() => getOrCreateAgentInstructionDoc(node.id), [node.id])

  // Mantiene _agentUserMessage (lo que ejecuta el cron del servidor) sincronizado
  // con lo que el usuario edita en el documento-instrucción (mismo patrón que
  // AgentPropertiesPanel.handleRun/setSchedule, aquí en cada cambio del árbol).
  useEffect(() => { syncAgentUserMessage(node.id) }, [node.id, s.nodesVersion])

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
          title={node.isFavorite ? t('tip.removeFavorite') : t('tip.addFavorite')}
          onClick={toggleFavorite}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: node.isFavorite ? '#f59e0b' : 'var(--text-tertiary,#999)', padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={node.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/></svg>
        </button>
        <button
          title={t('tip.delete', 'Eliminar')}
          onClick={() => { trashNode(node.id); window.dispatchEvent(new Event('from:close-detail')) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: 4 }}
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

      {/* Prompt del agente — UN hijo-documento del propio nodo agente ES la
          instrucción (createAgentUnder/readAgentNote/getOrCreateAgentInstructionDoc),
          editado con el editor de documento normal (párrafos, formato), NUNCA con
          viñetas de outliner. */}
      <div style={{ marginTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📝 {t('agents.promptLabel', 'Instrucción del agente')}</div>
        <div className="v2-note-formatbar"><DocInspector bar /></div>
        <DocEditorBoundary compact>
          <DocEditor node={docNode} compact registerActive autofocus={false} />
        </DocEditorBoundary>
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
            <AgentPropertiesPanel nodeId={node.id} onBack={() => onOpenElementsFiltered ? onOpenElementsFiltered('agent') : setShowProps(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
