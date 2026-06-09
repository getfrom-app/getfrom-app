/**
 * ContextPropertiesPanel — propiedades de un contexto en la columna derecha.
 * Patrón unificado con Prompts y Agentes: el contenido del contexto se abre en
 * la ventana central; aquí van sus propiedades (color, conocimiento) + ← Atrás.
 */
import { useMemo, useState } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { extractContextKnowledge } from '../../api/autoClassify'

const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#ca8a04', '#dc2626', '#db2777', '#64748b']

interface Props {
  nodeId: string
  onBack: () => void
}

export default function ContextPropertiesPanel({ nodeId, onBack }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const node = s.getNode(nodeId)
  const [updating, setUpdating] = useState(false)

  const color = useMemo(() => {
    if (!node) return 'var(--accent)'
    try { return JSON.parse(node.extraData || '{}')._tagColor || '#7c3aed' } catch { return '#7c3aed' }
  }, [node?.id, node?.extraData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null

  function setColor(c: string) {
    const n = store.getNode(nodeId)
    if (!n) return
    try {
      const ed = JSON.parse(n.extraData || '{}')
      ed._tagColor = c
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    } catch { /* ignore */ }
  }

  async function updateKnowledge() {
    if (updating) return
    setUpdating(true)
    try {
      const directChildren = store.children(nodeId).filter(n => !n.deletedAt)
      const samples: string[] = []
      for (const child of directChildren) {
        if (child.text?.trim() && !(child.text || '').startsWith('🧠')) samples.push(child.text.trim())
        if (samples.length >= 60) break
        for (const gc of store.children(child.id).filter(n => !n.deletedAt)) {
          if (gc.text?.trim()) samples.push(gc.text.trim())
          if (samples.length >= 60) break
        }
      }
      if (samples.length === 0) { setUpdating(false); return }
      const knowledge = await extractContextKnowledge(node!.text || '', '', samples)
      const KNOWLEDGE_NODE_TEXT = '🧠 Lo que From sabe'
      const existing = store.children(nodeId).find(n => !n.deletedAt && n.text === KNOWLEDGE_NODE_TEXT)
      const kid = existing ? existing.id : store.createNode({ text: KNOWLEDGE_NODE_TEXT, parentId: nodeId, siblingOrder: -1000 }).id
      const subnodes: Record<string, string> = {
        'Palabras clave:': `Palabras clave: ${knowledge.keywords.join(', ')}`,
        'Personas:':       `Personas: ${knowledge.people.length ? knowledge.people.join(', ') : '—'}`,
        'Temas frecuentes:': `Temas frecuentes: ${knowledge.topics.join(', ')}`,
      }
      const existingKids = store.children(kid).filter(n => !n.deletedAt)
      let order = 1000
      for (const [prefix, text] of Object.entries(subnodes)) {
        const ex = existingKids.find(n => (n.text || '').startsWith(prefix))
        if (ex) store.updateNode(ex.id, { text })
        else store.createNode({ text, parentId: kid, siblingOrder: order })
        order += 1000
      }
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('ctxProps.knowledgeUpdated', 'Conocimiento actualizado'), type: 'success' } }))
    } catch { /* ignore */ }
    setUpdating(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 40, flexShrink: 0, borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('ctxProps.back', '← Contextos')}
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Color */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {t('ctxProps.colorTitle', 'Color')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent', boxShadow: color === c ? '0 0 0 2px var(--bg-primary) inset' : 'none' }}
              />
            ))}
          </div>
        </div>

        {/* Lo que From sabe */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {t('ctxProps.knowledgeTitle', 'Lo que From sabe')}
          </div>
          <button
            onClick={updateKnowledge}
            disabled={updating}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', cursor: updating ? 'default' : 'pointer', fontFamily: 'inherit', opacity: updating ? 0.6 : 1 }}
          >
            {updating ? t('ctxProps.updating', 'Actualizando…') : `✦ ${t('ctxProps.updateKnowledge', 'Actualizar conocimiento')}`}
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 8 }}>
            {t('ctxProps.knowledgeHint', 'Fromly resume las palabras clave, personas y temas de este contexto para entender mejor tus notas.')}
          </div>
        </div>
      </div>
    </div>
  )
}
