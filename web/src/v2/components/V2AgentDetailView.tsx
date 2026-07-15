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
import {
  getAgentData, getOrCreateAgentInstructionDoc, syncAgentUserMessage,
  getAgentReferencedElements, addAgentReferencedElement, removeAgentReferencedElement,
} from '../../utils/agentesHelper'
import { trashNode } from '../../utils/papeleraHelper'
import { apiRequest, getToken } from '../../api/client'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import DocInspector from '../../components/views/DocInspector'
import AgentPropertiesPanel from '../../components/panels/AgentPropertiesPanel'
import { V2NoteContext } from './V2DetailView'

interface Props {
  node: Node
  onSelectCtx: (id: string) => void
  onOpenElementsFiltered?: (kind: 'agent' | 'prompt') => void
}

/** Buscador ligero de CUALQUIER elemento de Fromly por título, para "Elementos a
 *  tener en cuenta". No usa ContextPicker (solo contextos) — busca sobre todos
 *  los nodos activos, excluyendo el propio agente y lo que ya está en la lista. */
function ElementRefSearch({ excludeIds, onPick, onClose }: { excludeIds: string[]; onPick: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return store.allActive()
      .filter(n => !n.deletedAt && !excludeIds.includes(n.id) && (n.text || '').toLowerCase().includes(query))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 12)
  }, [q, excludeIds]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="v2-ctxpick-pop">
      <input
        autoFocus
        className="ctx-pick-search"
        placeholder={t('agents.searchElementPlaceholder', 'Buscar nota, documento, tarea…')}
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      />
      <div className="ctx-pick-list">
        {results.map(n => (
          <button key={n.id} className="ctx-pick-item" onClick={() => { onPick(n.id); onClose() }}>
            <span className="ctx-pick-name">{n.text || t('common.noTitle', 'Sin título')}</span>
          </button>
        ))}
        {q.trim() && results.length === 0 && <div className="ctx-pick-empty">{t('common.noResults', 'Sin resultados')}</div>}
      </div>
    </div>
  )
}

export default function V2AgentDetailView({ node, onSelectCtx, onOpenElementsFiltered }: Props) {
  const s = useStore()
  const { t } = useTranslation()
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

  // Elementos que el agente debe tener SIEMPRE en cuenta (p.ej. Morning Formula
  // como guía de vida) — se inyectan en cada respuesta vía originAgentBlock en
  // aiChatStore.ts, no solo se mencionan.
  const referencedIds = useMemo(() => getAgentReferencedElements(node.id), [node.id, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  // «Cómo debe responder» — _agentSystemPrompt, ANTES invisible en la UI (solo se
  // veía la pregunta de apertura en «Instrucción del agente») — el usuario no podía
  // ver ni editar el formato de respuesta (Alberto, 15 jul: "si no tiene esas
  // instrucciones no va a saber cómo contestarme"). Editable directamente, igual
  // que KnowledgeBlock en ContextPropertiesPanel.tsx.
  const [systemPrompt, setSystemPrompt] = useState(data?.systemPrompt || '')
  const [spFocused, setSpFocused] = useState(false)
  useEffect(() => { if (!spFocused) setSystemPrompt(data?.systemPrompt || '') }, [data?.systemPrompt, spFocused])
  const commitSystemPrompt = () => {
    setSpFocused(false)
    if (!data || systemPrompt.trim() === data.systemPrompt.trim()) return
    const ed = JSON.parse(node.extraData || '{}')
    ed._agentSystemPrompt = systemPrompt
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    // Mismo patrón que AgentPropertiesPanel: sync al servidor si ya hay schedule.
    if (getToken() && data.schedule) {
      apiRequest('/agents/schedule', {
        method: 'POST',
        body: JSON.stringify({
          nodeId: node.id, agentId: data.agentId, agentTitle: node.text,
          systemPrompt, userMessage: data.userMessage,
          schedule: data.schedule, enabled: data.enabled,
          expiresAt: data.scheduleExpiresAt || undefined,
        }),
      }).catch(() => { /* silencioso */ })
    }
  }

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

      {/* Contexto — chip + botón de editar (igual que cualquier nota/tarea): antes
          solo mostraba el chip si ya tenía uno, sin forma de asignarlo o cambiarlo
          desde aquí (Alberto, 15 jul: "falta el botón de contexto y de editar
          contexto"). Todas las interacciones/conversaciones de este agente se
          guardan por defecto en este mismo contexto (ver openAgentConversation). */}
      <V2NoteContext node={node} onSelectCtx={onSelectCtx} />

      {/* Prompt del agente — UN hijo-documento del propio nodo agente ES la
          instrucción (createAgentUnder/readAgentNote/getOrCreateAgentInstructionDoc),
          editado con el editor de documento normal (párrafos, formato), NUNCA con
          viñetas de outliner. Esto es SOLO la pregunta/tarea de apertura — el
          formato de respuesta va en el bloque de abajo. */}
      <div style={{ marginTop: 10 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📝 {t('agents.promptLabel', 'Instrucción del agente')}</div>
        <div className="v2-note-formatbar"><DocInspector bar /></div>
        <DocEditorBoundary compact>
          <DocEditor node={docNode} compact registerActive autofocus={false} />
        </DocEditorBoundary>
      </div>

      {/* Cómo debe responder — _agentSystemPrompt. Antes de este cambio no se veía
          en ningún sitio de la UI, aunque SÍ se usaba internamente (originAgentBlock
          en aiChatStore.ts) para que Fromly sepa cómo estructurar su respuesta tras
          la primera pregunta de un agente conversacional. */}
      <div style={{ marginTop: 18 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>💬 {t('agents.responseFormatLabel', 'Cómo debe responder')}</div>
        <textarea
          value={systemPrompt}
          placeholder={t('agents.responseFormatPlaceholder', 'Formato y estilo de la respuesta que debe dar el agente (p. ej. secciones, tono, longitud)…')}
          onFocus={() => setSpFocused(true)}
          onChange={e => setSystemPrompt(e.target.value)}
          onBlur={commitSystemPrompt}
          rows={Math.max(3, Math.min(14, systemPrompt.split('\n').length + 1))}
          style={{
            width: '100%', minWidth: 0, maxWidth: '100%', resize: 'none',
            fontSize: 13, lineHeight: 1.5,
            color: 'var(--text-primary)', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Elementos a tener en cuenta — el agente los lee y los usa en TODA la
          conversación (Alberto, 15 jul: "si al agente de pensamientos diarios le
          digo que debe tener en cuenta la nota de morning fórmula podrá leerla y
          la tendrá en cuenta... el agente conoce mis metas, objetivos, ética"). */}
      <div style={{ marginTop: 18 }}>
        <div className="v2-section-label" style={{ padding: '0 0 4px' }}>📎 {t('agents.referencedElementsLabel', 'Elementos a tener en cuenta')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {referencedIds.map(id => {
            const n = store.getNode(id)
            if (!n) return null
            return (
              <span key={id} className="v2-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {n.text || t('common.noTitle', 'Sin título')}
                <button
                  title={t('common.remove', 'Quitar')}
                  onClick={() => removeAgentReferencedElement(node.id, id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}
                >
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>
                </button>
              </span>
            )
          })}
          <div className="v2-ctxpick-wrap">
            <button className="v2-ctx-add-btn" onClick={() => setRefPickerOpen(o => !o)}>＋ {t('agents.addElement', 'Añadir elemento…')}</button>
            {refPickerOpen && (
              <ElementRefSearch
                excludeIds={[node.id, ...referencedIds]}
                onPick={id => addAgentReferencedElement(node.id, id)}
                onClose={() => setRefPickerOpen(false)}
              />
            )}
          </div>
        </div>
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
