// V2TemplatesModal — gestión de plantillas desde v2 (crear / editar / eliminar).
// v2 ya podía APLICAR plantillas al crear un documento (menú "＋ Nota"), pero no
// existía forma de crearlas ni editarlas sin salir a v1. Reutiliza tal cual el
// NodeConfigModal + TemplatePropertiesPanel de v1 (mismo patrón que SettingsModal/
// PlannerPanel/RightColMenu ya reutilizados en v2): una plantilla es solo un nodo
// hijo de "📋 Plantillas" cuyo contenido se edita en el Outliner normal.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { listTemplates, getPlantillasRoot, ensurePlantillasNode } from '../../utils/tagsHelper'
import NodeConfigModal from '../../components/modals/NodeConfigModal'

interface Props {
  onClose: () => void
}

export default function V2TemplatesModal({ onClose }: Props) {
  const { t } = useTranslation()
  useStore()
  const [editingId, setEditingId] = useState<string | null>(null)

  const templates = listTemplates()

  function createTemplate() {
    ensurePlantillasNode() // idempotente: asegura que "📋 Plantillas" existe (v2 no corre el init de v1)
    const root = getPlantillasRoot()
    if (!root) return
    const n = store.createNode({ text: t('v2.templates.newTemplateName', 'Nueva plantilla'), parentId: root.id })
    setEditingId(n.id)
  }

  function removeTemplate(id: string, name: string) {
    if (!confirm(t('v2.templates.confirmDelete', '¿Eliminar la plantilla «{{name}}»?', { name: name || t('common.noTitle', 'Sin título') }))) return
    store.deleteNode(id)
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="v2-templates-modal" onClick={e => e.stopPropagation()}>
        <div className="v2-templates-head">
          <span className="v2-templates-title">📋 {t('v2.templates.manageTitle', 'Gestionar plantillas')}</span>
          <button className="v2-iconbtn" title={t('common.close', 'Cerrar')} onClick={onClose}>✕</button>
        </div>

        <div className="v2-templates-body">
          {templates.length === 0 ? (
            <div className="v2-templates-empty">{t('v2.templates.emptyHint', 'Aún no tienes plantillas. Crea una para reutilizar contenido al abrir notas nuevas.')}</div>
          ) : (
            <ul className="v2-templates-list">
              {templates.map(tpl => (
                <li key={tpl.id} className="v2-templates-item">
                  <button className="v2-templates-item-name" onClick={() => setEditingId(tpl.id)}>
                    {(tpl.text || t('common.noTitle', 'Sin título'))}
                  </button>
                  <button className="v2-templates-item-del" title={t('common.delete', 'Eliminar')} onClick={() => removeTemplate(tpl.id, tpl.text || '')}>🗑</button>
                </li>
              ))}
            </ul>
          )}

          <button className="v2-templates-new" onClick={createTemplate}>＋ {t('v2.templates.newTemplate', 'Nueva plantilla')}</button>
        </div>
      </div>

      {editingId && (
        <NodeConfigModal
          nodeId={editingId}
          kind="template"
          onClose={() => setEditingId(null)}
          onTestInMagic={() => {}}
        />
      )}
    </div>,
    document.body,
  )
}
