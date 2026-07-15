/**
 * SettingsListPanel — lista de pestañas de Ajustes en la columna derecha.
 * Mismo patrón que ContextListPanel/PromptListPanel: al hacer clic en una pestaña
 * su contenido se abre en la ventana central (/settings?tab=X).
 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NAV, type Tab } from '../views/settingsNav'

export default function SettingsListPanel() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const active = (searchParams.get('tab') as Tab) || 'cuenta'

  function open(tab: Tab) {
    navigate(`/settings?tab=${tab}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '8px 0 4px' }}>
      <div style={{ padding: '2px 16px 8px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
        Ajustes
      </div>
      {NAV.map((section, si) => (
        <div key={si} style={{ marginBottom: 4 }}>
          <div style={{ padding: '8px 16px 3px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {section.title}
          </div>
          {section.items.map(item => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => open(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 14,
                  fontFamily: 'inherit',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
