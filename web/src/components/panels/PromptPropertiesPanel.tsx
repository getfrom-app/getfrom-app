/**
 * PromptPropertiesPanel — propiedades de un prompt en la columna derecha.
 * Se muestra cuando un prompt está abierto en la ventana central.
 * Contiene: botón ← Prompts, «Probar en Magic», variables disponibles
 * (clic = copiar al portapapeles) y la configuración de activación automática.
 */
import { useMemo } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { findContextRoot } from '../../utils/rootLookup'
import { useTranslation } from 'react-i18next'
import { AVAILABLE_VARIABLES, getPromptActivation, setPromptActivation, type PromptActivation } from '../../utils/promptsHelper'

interface Props {
  nodeId: string
  onBack: () => void
  onTestInMagic: (promptId: string) => void
}

export default function PromptPropertiesPanel({ nodeId, onBack, onTestInMagic }: Props) {
  const s = useStore()
  const { t, i18n } = useTranslation()
  const node = s.getNode(nodeId)
  const isEn = i18n.language?.startsWith('en')

  const activation = getPromptActivation(nodeId)

  // Contextos disponibles (para activación «context:<id>»)
  const contexts = useMemo(() => {
    const tagsRoot = findContextRoot()
    if (!tagsRoot) return []
    return store.children(tagsRoot.id).filter(n => {
      if (n.deletedAt) return false
      if ((n.text || '').startsWith('🧠')) return false
      try { if (JSON.parse(n.extraData || '{}')._perfilIA === '1') return false } catch { /* */ }
      return true
    })
  }, [s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null

  // Inserta la variable directamente en el nodo enfocado del centro (manteniendo
  // el foco gracias a preventDefault en mousedown). Si no hay nada enfocado, copia.
  function insertVar(key: string) {
    const el = document.activeElement as HTMLElement | null
    const isInput = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA'
    const isEditable = !!el && (el.isContentEditable || isInput)
    if (isEditable) {
      if (isInput) {
        const input = el as HTMLInputElement | HTMLTextAreaElement
        const start = input.selectionStart ?? input.value.length
        const end = input.selectionEnd ?? input.value.length
        input.setRangeText(key, start, end, 'end')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        // contenteditable (outliner): execCommand inserta en el caret y dispara input
        document.execCommand('insertText', false, key)
      }
      return
    }
    navigator.clipboard.writeText(key).catch(() => {})
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('prompts.varCopied', { v: key, defaultValue: `${key} copiada — pégala en el prompt` }), type: 'success' } }))
  }

  function setAct(act: PromptActivation) { setPromptActivation(nodeId, act) }

  const isContextAct = activation.startsWith('context:')
  const selectedContextId = isContextAct ? activation.slice('context:'.length) : ''

  const radioRow = (value: string, checked: boolean, label: string, desc: string, onSelect: () => void) => (
    <button
      key={value}
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left',
        background: checked ? 'rgba(139,92,246,0.07)' : 'transparent',
        border: '1px solid', borderColor: checked ? 'var(--accent)' : 'var(--border)',
        borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <span style={{
        width: 15, height: 15, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        border: '2px solid', borderColor: checked ? 'var(--accent)' : 'var(--text-tertiary)',
        background: checked ? 'var(--accent)' : 'transparent',
        boxShadow: checked ? 'inset 0 0 0 2px var(--bg-primary)' : 'none',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: checked ? 600 : 500 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.4, marginTop: 1 }}>{desc}</div>
      </div>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cabecera: ← Prompts · Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 40, flexShrink: 0, borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
        <button
          onClick={onBack}
          title={t('prompts.back', '← Prompts')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {t('prompts.back', '← Prompts')}
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Probar en Magic */}
        <button
          onClick={() => onTestInMagic(nodeId)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 9, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
          {t('prompts.testInMagic', 'Probar en Magic')}
        </button>

        {/* Activación automática */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {t('prompts.activationTitle', 'Activar automáticamente')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {radioRow('manual', activation === 'manual', t('prompts.actManual', 'Solo manual'), t('prompts.actManualDesc', 'Lo eliges tú desde Magic (chip o /).'), () => setAct('manual'))}
            {radioRow('diary', activation === 'diary', t('prompts.actDiary', 'En la nota diaria'), t('prompts.actDiaryDesc', 'Se activa al abrir Magic desde tu diario.'), () => setAct('diary'))}
            {radioRow('task', activation === 'task', t('prompts.actTask', 'En tareas'), t('prompts.actTaskDesc', 'Se activa al abrir Magic desde una tarea.'), () => setAct('task'))}
            {radioRow('context', isContextAct, t('prompts.actContext', 'En un contexto'), t('prompts.actContextDesc', 'Se activa dentro de un contexto concreto.'), () => {
              const first = contexts[0]
              setAct(first ? (`context:${first.id}` as PromptActivation) : 'manual')
            })}
            {isContextAct && (
              <select
                value={selectedContextId}
                onChange={e => setAct(`context:${e.target.value}` as PromptActivation)}
                style={{ marginLeft: 23, marginTop: 2, fontSize: 12.5, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
              >
                {contexts.length === 0 && <option value="">{t('prompts.noContexts', 'No hay contextos')}</option>}
                {contexts.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Variables disponibles */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
            {t('prompts.variablesTitle', 'Variables disponibles')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.45, marginBottom: 8 }}>
            {t('prompts.variablesHint2', 'Escríbelas en el prompt y From las rellena al usarlo. Clic para insertarla donde tengas el cursor.')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {AVAILABLE_VARIABLES.map(v => (
              <button
                key={v.key}
                onMouseDown={e => { e.preventDefault(); insertVar(v.key) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 9px', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                <code style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{v.key}</code>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isEn ? v.labelEn : v.labelEs}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
