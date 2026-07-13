// Detalle de un PROMPT en la columna derecha de Fromly 2.0.
// Sigue el patrón de V2AgentDetailView: la ventana central es el CONTENIDO del
// prompt — como el contenido son nodos hijos (outliner clásico, no documento),
// usa Outliner directamente sobre parentId={node.id} — + columna de propiedades
// reutilizando PromptPropertiesPanel de v1 TAL CUAL (mismo patrón que
// AgentPropertiesPanel en V2AgentDetailView).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { firstContextOf, contextColor } from '../../utils/cajones'
import { resolvePrompt } from '../../utils/promptsHelper'
import { trashNode } from '../../utils/papeleraHelper'
import Outliner from '../../components/outliner/Outliner'
import PromptPropertiesPanel from '../../components/panels/PromptPropertiesPanel'

interface Props {
  node: Node
  onSelectCtx: (id: string) => void
}

export default function V2PromptDetailView({ node, onSelectCtx }: Props) {
  useStore()
  const { t } = useTranslation()
  const ctx = firstContextOf(node)
  let icon = '⚡'
  try { icon = JSON.parse(node.extraData || '{}')._promptIcon || '⚡' } catch { /* ignore */ }
  // Propiedades a la derecha, dentro de la misma columna (debajo, ya que v2 no
  // tiene una columna extra): panel plegable con el control real de v1.
  const [showProps, setShowProps] = useState(true)

  // «Probar en Magic»: resuelve el prompt (variables sustituidas) y lo envía al
  // chat activo a través de un evento global — lo consume V2Chat.
  const onTestInMagic = (promptId: string) => {
    const text = resolvePrompt(promptId, { currentNodeId: node.id })
    window.dispatchEvent(new CustomEvent('from:send-prompt', { detail: { text } }))
  }

  return (
    <div style={{ padding: '4px 18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <button
          title={t('tip.delete', 'Eliminar')}
          onClick={() => { trashNode(node.id); window.dispatchEvent(new Event('from:close-detail')) }}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>

      {/* Contexto — clic navega (sidebar + columna derecha), mismo patrón que agente/tarea/nota. */}
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

      {/* Contenido del prompt — outliner clásico (los hijos SON las instrucciones). */}
      <div style={{ marginTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📝 {t('prompts.contentLabel', 'Contenido del prompt')}</div>
        <Outliner parentId={node.id} autoFocusEmpty placeholder={t('v2.outlinerPlaceholder', 'Escribe aquí… (usa «/» para insertar tabla, kanban, calendario…)')} />
      </div>

      {/* Propiedades reales del prompt (activación automática, variables, probar) —
          PromptPropertiesPanel de v1 reutilizado tal cual, plegable. */}
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
            <PromptPropertiesPanel nodeId={node.id} onBack={() => setShowProps(false)} onTestInMagic={onTestInMagic} />
          </div>
        )}
      </div>
    </div>
  )
}
