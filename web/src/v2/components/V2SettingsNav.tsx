// Navegación de Ajustes en v2 — ocupa la columna IZQUIERDA (donde normalmente
// están los contextos) mientras los Ajustes están abiertos. Mismo NAV/Tab que
// v1 (settingsNav.ts) — un solo lugar para no duplicar qué pestañas existen.
import { useTranslation } from 'react-i18next'
import { NAV, type Tab } from '../../components/views/settingsNav'

interface Props {
  activeTab: Tab
  onSelect: (tab: Tab) => void
  onClose: () => void
}

export default function V2SettingsNav({ activeTab, onSelect, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <aside className="v2-col v2-sidebar">
      <div className="v2-sidebar-head">
        <span className="v2-brand">Fromly <span className="v2-brand-badge">2.0</span></span>
      </div>
      <button className="v2-newchat" onClick={onClose}>‹ {t('v2.back', 'Volver')}</button>

      <div className="v2-section-label">{t('v2.settings', 'Ajustes')}</div>

      <div className="v2-ctx-list">
        {NAV.map((section, si) => (
          <div key={si}>
            <div className="v2-section-label" style={{ padding: '10px 16px 4px' }}>{section.title}</div>
            {section.items.map(item => (
              <div
                key={item.id}
                className={`v2-ctx-row ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="v2-el-title">{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
