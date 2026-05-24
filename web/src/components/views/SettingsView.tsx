import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  CuentaPane,
  AparienciaPane,
  IAPane,
  ClaudeMcpPane,
  AtajosPane,
  PlantillasPane,
  GooglePane,
  ExportarPane,
  ImportarPane,
} from '../modals/SettingsModal'
import { useTheme, type AccentColor } from '../../hooks/useTheme'
import { useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab =
  | 'cuenta' | 'google'
  | 'apariencia' | 'estadisticas'
  | 'ia' | 'perfil-ia' | 'magic'
  | 'atajos' | 'plantillas'
  | 'exportar' | 'importar'
  | 'claude'

interface NavItem { id: Tab; label: string; icon: string }
interface NavSection { title: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    title: 'Cuenta',
    items: [
      { id: 'cuenta', label: 'Mi cuenta', icon: '👤' },
      { id: 'google', label: 'Google', icon: '🟢' },
    ],
  },
  {
    title: 'Apariencia',
    items: [
      { id: 'apariencia', label: 'Apariencia', icon: '🎨' },
      { id: 'estadisticas', label: 'Estadísticas', icon: '📊' },
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
    title: 'Integraciones',
    items: [
      { id: 'claude', label: 'Claude (MCP)', icon: '🤖' },
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
  apariencia: 'Tema, tipografía, interlineado y color de acento.',
  estadisticas: 'Resumen de notas, tareas y actividad en tu vault.',
  ia: 'Proveedor de IA, tokens e integración con Claude.',
  'perfil-ia': 'Contexto e instrucciones personalizadas para la IA.',
  magic: 'Sugerencias automáticas y acciones inteligentes.',
  atajos: 'Atajos de teclado y expansión de texto.',
  plantillas: 'Plantillas personalizadas para crear notas rápido.',
  exportar: 'Exporta una copia de tus datos en JSON o Markdown.',
  importar: 'Importa notas y tareas desde un archivo JSON.',
  claude: 'Conecta Claude Desktop con tu vault mediante MCP.',
}

// ── Extra panes ────────────────────────────────────────────────────────────────

const PERFIL_IA_KEY = 'from_ai_profile'

function PerfilIAPane() {
  const [text, setText] = useState<string>(() => localStorage.getItem(PERFIL_IA_KEY) || '')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function handleSave() {
    localStorage.setItem(PERFIL_IA_KEY, text)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2500)
  }

  function handleClear() {
    if (!confirm('¿Borrar todo el perfil IA?')) return
    setText('')
    localStorage.removeItem(PERFIL_IA_KEY)
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="st-pane">
      <div className="st-section-title">Perfil IA</div>
      <div className="st-row" style={{ display: 'block' }}>
        <div className="st-row-info" style={{ marginBottom: 10 }}>
          <div className="st-row-label">Contexto para la IA</div>
          <div className="st-row-hint">
            Escribe quién eres, en qué trabajas y cómo prefieres que la IA te responda. Este contexto
            se incluirá automáticamente en todas las conversaciones con la IA.
          </div>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ej: Me llamo Alberto, soy presentador de radio y emprendedor. Trabajo en La Isla del Trading (academia de trading). Prefiero respuestas directas, sin rodeos, en español."
          rows={12}
          className="st-input"
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button className="btn-primary" onClick={handleSave}>Guardar</button>
          {text && <button className="btn-secondary btn-danger-outline" onClick={handleClear}>Borrar</button>}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{wordCount} palabras</span>
          {savedAt && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Guardado</span>}
        </div>
      </div>
    </div>
  )
}

// ── Magic toggles ────────────────────────────────────────────────────────────

interface MagicToggleDef {
  key: string
  title: string
  subtitle: string
  defaultOn: boolean
}

const MAGIC_TOGGLES: MagicToggleDef[] = [
  { key: 'magic.objectDetection', title: 'Detectar objeto desde el texto',
    subtitle: 'Cuando escribes algo como "Sync con Adrián mañana", From propone #reunión como ghost text. Tab acepta.',
    defaultOn: true },
  { key: 'magic.completion', title: 'Completar el pensamiento',
    subtitle: 'From sugiere cómo terminar la frase con texto en gris cursiva. Tab acepta.',
    defaultOn: true },
  { key: 'magic.ambient', title: 'Acciones IA por nodo (botón ✨)',
    subtitle: 'En hover sobre cada bullet o nota aparece el botón ✨ con acciones precocinadas por tipo (resumir, sugerir subtareas, etc).',
    defaultOn: true },
  { key: 'magic.draftSidebar', title: 'Editor lateral para outputs largos',
    subtitle: 'Cuando la IA genera texto largo, abre un panel lateral editable antes de aplicar. Si lo apagas, todo se aplica directo.',
    defaultOn: true },
  { key: 'magic.animatedPill', title: 'Animar el pill al cambiar objeto',
    subtitle: 'Cuando el objeto detectado cambia, el pill del panel derecho hace un pulso con glow.',
    defaultOn: true },
]

function readMagic(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key)
  if (v === null) return def
  return v === 'true'
}

function MagicPane() {
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {}
    MAGIC_TOGGLES.forEach(t => { v[t.key] = readMagic(t.key, t.defaultOn) })
    return v
  })

  function setToggle(key: string, val: boolean) {
    setValues(v => ({ ...v, [key]: val }))
    localStorage.setItem(key, String(val))
  }

  return (
    <div className="st-pane">
      <div className="st-section-title">Sugerencias mientras escribes</div>
      {MAGIC_TOGGLES.slice(0, 2).map(t => (
        <div key={t.key} className="st-row">
          <div className="st-row-info">
            <div className="st-row-label">{t.title}</div>
            <div className="st-row-hint">{t.subtitle}</div>
          </div>
          <div className="st-row-action">
            <button
              className={`st-switch ${values[t.key] ? 'on' : 'off'}`}
              onClick={() => setToggle(t.key, !values[t.key])}
              aria-pressed={values[t.key]}
              role="switch"
            >
              <span className="st-switch-thumb" />
            </button>
          </div>
        </div>
      ))}

      <div className="st-section-title" style={{ marginTop: 20 }}>Acciones sobre el contenido</div>
      {MAGIC_TOGGLES.slice(2, 4).map(t => (
        <div key={t.key} className="st-row">
          <div className="st-row-info">
            <div className="st-row-label">{t.title}</div>
            <div className="st-row-hint">{t.subtitle}</div>
          </div>
          <div className="st-row-action">
            <button
              className={`st-switch ${values[t.key] ? 'on' : 'off'}`}
              onClick={() => setToggle(t.key, !values[t.key])}
              aria-pressed={values[t.key]}
              role="switch"
            >
              <span className="st-switch-thumb" />
            </button>
          </div>
        </div>
      ))}

      <div className="st-section-title" style={{ marginTop: 20 }}>Detalles visuales</div>
      {MAGIC_TOGGLES.slice(4).map(t => (
        <div key={t.key} className="st-row">
          <div className="st-row-info">
            <div className="st-row-label">{t.title}</div>
            <div className="st-row-hint">{t.subtitle}</div>
          </div>
          <div className="st-row-action">
            <button
              className={`st-switch ${values[t.key] ? 'on' : 'off'}`}
              onClick={() => setToggle(t.key, !values[t.key])}
              aria-pressed={values[t.key]}
              role="switch"
            >
              <span className="st-switch-thumb" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── EstadísticasPane ──────────────────────────────────────────────────────────

function EstadísticasPane() {
  const s = useStore()
  const nodes = s.allActive()

  const totalNotes = nodes.filter(n => !n.isDiaryEntry && n.status === null && !n.deletedAt).length
  const totalTasks = nodes.filter(n => n.status !== null && !n.deletedAt).length
  const doneTasks = nodes.filter(n => n.status === 'done' && !n.deletedAt).length
  const pendingTasks = nodes.filter(n => n.status === 'pending' && !n.deletedAt).length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const totalWords = nodes.reduce((acc, n) => {
    const bodyWords = n.body ? n.body.trim().split(/\s+/).length : 0
    const titleWords = n.text ? n.text.trim().split(/\s+/).length : 0
    return acc + bodyWords + titleWords
  }, 0)
  const usedTags = s.allUsedTags ? s.allUsedTags() : []
  const diaryEntries = nodes.filter(n => n.isDiaryEntry && !n.deletedAt)
  const diaryDates = new Set(
    diaryEntries.filter(n => n.diaryDate).map(n => new Date(n.diaryDate!).toDateString())
  )
  const followUps = nodes.filter(n => n.isSeguimiento && !n.deletedAt).length
  let diaryStreak = 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    if (diaryDates.has(d.toDateString())) diaryStreak++
    else break
  }
  const overdueCount = s.overdueTasks ? s.overdueTasks().length : 0

  const stat = (value: number | string, label: string) => (
    <div className="st-stat">
      <span className="st-stat-n">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span>{label}</span>
    </div>
  )

  return (
    <div className="st-pane">
      <div className="st-section-title">Tu vault</div>
      <div className="st-stats">
        {stat(totalNotes, 'Notas')}
        {stat(totalTasks, 'Tareas')}
        {stat(doneTasks, 'Completadas')}
        {stat(pendingTasks, 'Pendientes')}
        {stat(`${completionRate}%`, 'Completado')}
      </div>

      <div className="st-section-title" style={{ marginTop: 24 }}>Escritura</div>
      <div className="st-stats">
        {stat(totalWords, 'Palabras')}
        {stat(diaryEntries.length, 'Entradas diario')}
        {stat(diaryStreak, 'Racha diario')}
        {stat(usedTags.length, 'Tags activos')}
      </div>

      <div className="st-section-title" style={{ marginTop: 24 }}>Tareas</div>
      <div className="st-stats">
        {stat(overdueCount, 'Vencidas')}
        {stat(followUps, 'Seguimiento')}
      </div>
    </div>
  )
}

// ── AparienciaViewPane (con selector de color de acento) ──────────────────────

const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: 'purple', label: 'Morado', hex: '#8b5cf6' },
  { value: 'blue',   label: 'Azul',   hex: '#3b82f6' },
  { value: 'green',  label: 'Verde',  hex: '#22c55e' },
  { value: 'orange', label: 'Naranja', hex: '#f97316' },
  { value: 'rose',   label: 'Rosa',   hex: '#f43f5e' },
  { value: 'teal',   label: 'Teal',   hex: '#14b8a6' },
]

function AparienciaViewPane() {
  const { accent, setAccent } = useTheme()
  return (
    <>
      <AparienciaPane />
      <div className="st-pane" style={{ paddingTop: 0 }}>
        <div className="st-section-title">Color de acento</div>
        <div className="st-row">
          <div className="st-row-info">
            <div className="st-row-label">Color principal</div>
            <div className="st-row-hint">Color que se usa en botones, selecciones y elementos activos.</div>
          </div>
          <div className="st-row-action">
            <div style={{ display: 'flex', gap: 8 }}>
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setAccent(c.value)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c.hex, border: 'none', cursor: 'pointer',
                    outline: accent === c.value ? `2px solid ${c.hex}` : '2px solid transparent',
                    outlineOffset: 2,
                    boxSizing: 'border-box',
                    transition: 'outline 0.15s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── CuentaViewPane (con cerrar sesión) ────────────────────────────────────────

function CuentaViewPane() {
  const navigate = useNavigate()

  function handleLogout() {
    clearTokens()
    userStore.reset()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <CuentaPane />
      <div className="st-pane" style={{ paddingTop: 0 }}>
        <div className="st-section-title">Sesión</div>
        <div className="st-row">
          <div className="st-row-info">
            <div className="st-row-label">Cerrar sesión</div>
            <div className="st-row-hint">Salir de tu cuenta en este dispositivo.</div>
          </div>
          <div className="st-row-action">
            <button className="btn-secondary btn-danger-outline" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </>
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
      case 'cuenta':      return <CuentaViewPane />
      case 'google':      return <GooglePane />
      case 'apariencia':  return <AparienciaViewPane />
      case 'estadisticas': return <EstadísticasPane />
      case 'ia':          return <IAPane />
      case 'perfil-ia':   return <PerfilIAPane />
      case 'magic':       return <MagicPane />
      case 'atajos':      return <AtajosPane />
      case 'plantillas':  return <PlantillasPane />
      case 'exportar':    return <ExportarPane />
      case 'importar':    return <ImportarPane />
      case 'claude':      return <ClaudeMcpPane />
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
