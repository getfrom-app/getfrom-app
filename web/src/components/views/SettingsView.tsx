import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CuentaPane,
  AparienciaPane,
  IAPane,
  AtajosPane,
  PlantillasPane,
  GooglePane,
  ExportarPane,
  ImportarPane,
} from '../modals/SettingsModal'

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab =
  | 'cuenta' | 'google'
  | 'apariencia'
  | 'ia' | 'perfil-ia' | 'magic'
  | 'atajos' | 'plantillas'
  | 'exportar' | 'importar'

interface NavItem { id: Tab; label: string; icon: string }
interface NavSection { title: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    title: 'Cuenta',
    items: [
      { id: 'cuenta', label: 'Cuenta', icon: '👤' },
      { id: 'google', label: 'Google', icon: '🟢' },
    ],
  },
  {
    title: 'Apariencia',
    items: [
      { id: 'apariencia', label: 'Apariencia', icon: '🎨' },
    ],
  },
  {
    title: 'IA',
    items: [
      { id: 'ia', label: 'Inteligencia Artificial', icon: '✦' },
      { id: 'perfil-ia', label: 'Perfil IA', icon: '🧠' },
      { id: 'magic', label: 'Magic', icon: '💫' },
    ],
  },
  {
    title: 'Productividad',
    items: [
      { id: 'atajos', label: 'Atajos', icon: '⌨' },
      { id: 'plantillas', label: 'Plantillas', icon: '📋' },
    ],
  },
  {
    title: 'Datos',
    items: [
      { id: 'exportar', label: 'Exportar', icon: '↗' },
      { id: 'importar', label: 'Importar', icon: '↙' },
    ],
  },
]

const ALL_ITEMS: NavItem[] = NAV.flatMap(s => s.items)
const SUBTITLES: Partial<Record<Tab, string>> = {
  cuenta: 'Datos de tu cuenta, suscripción y privacidad.',
  google: 'Conexión con Google Calendar y Google Drive.',
  apariencia: 'Tema, tipografía e interlineado.',
  ia: 'Proveedor de IA, tokens e integración con Claude.',
  'perfil-ia': 'Contexto e instrucciones personalizadas para la IA.',
  magic: 'Sugerencias automáticas y acciones inteligentes.',
  atajos: 'Atajos de teclado y expansión de texto.',
  plantillas: 'Plantillas personalizadas para crear notas rápido.',
  exportar: 'Exporta una copia de tus datos en JSON o Markdown.',
  importar: 'Importa notas y tareas desde un archivo JSON.',
}

// ── Placeholder panes (Perfil IA & Magic) ─────────────────────────────────────

function PerfilIAPane() {
  return (
    <div className="st-pane">
      <div className="st-section-title">Perfil IA</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">Próximamente en la web</div>
          <div className="st-row-hint">
            Configura un contexto persistente que la IA usará en todas las conversaciones
            (quién eres, en qué trabajas, cómo prefieres que te responda). Disponible por ahora
            en la app de escritorio en Ajustes → Perfil IA.
          </div>
        </div>
      </div>
    </div>
  )
}

function MagicPane() {
  return (
    <div className="st-pane">
      <div className="st-section-title">Magic</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">Próximamente en la web</div>
          <div className="st-row-hint">
            Sugerencias automáticas mientras escribes: completado inteligente, acciones rápidas
            y reescritura. Disponible por ahora en la app de escritorio.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── View ──────────────────────────────────────────────────────────────────────

export default function SettingsView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = (searchParams.get('tab') as Tab) || 'cuenta'
  const [activeTab, setActiveTab] = useState<Tab>(
    ALL_ITEMS.some(i => i.id === initial) ? initial : 'cuenta'
  )

  // Mantener el query param ?tab= sincronizado para deep-linking
  useEffect(() => {
    if (searchParams.get('tab') !== activeTab) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', activeTab)
      setSearchParams(next, { replace: true })
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function renderPane() {
    switch (activeTab) {
      case 'cuenta': return <CuentaPane />
      case 'google': return <GooglePane />
      case 'apariencia': return <AparienciaPane />
      case 'ia': return <IAPane />
      case 'perfil-ia': return <PerfilIAPane />
      case 'magic': return <MagicPane />
      case 'atajos': return <AtajosPane />
      case 'plantillas': return <PlantillasPane />
      case 'exportar': return <ExportarPane />
      case 'importar': return <ImportarPane />
    }
  }

  const current = ALL_ITEMS.find(i => i.id === activeTab)

  return (
    <div className="settings-view">
      {/* Left sidebar */}
      <aside className="settings-view-sidebar">
        {NAV.map((section, si) => (
          <div key={si} className="settings-view-nav-section">
            <div className="settings-view-nav-section-title">{section.title}</div>
            {section.items.map(item => (
              <button
                key={item.id}
                className={`settings-view-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="settings-view-nav-icon">{item.icon}</span>
                <span className="settings-view-nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Main content */}
      <main className="settings-view-content">
        <div className="settings-view-content-inner">
          <div className="settings-view-content-header">
            <h1 className="settings-view-content-title">{current?.label}</h1>
            {SUBTITLES[activeTab] && (
              <div className="settings-view-content-subtitle">{SUBTITLES[activeTab]}</div>
            )}
          </div>
          <div className="settings-view-content-body">
            {renderPane()}
          </div>
        </div>
      </main>
    </div>
  )
}
