import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useLearningsStore } from '../../store/learningsStore'

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab =
  | 'cuenta' | 'google'
  | 'apariencia' | 'estadisticas'
  | 'ia' | 'magic'
  | 'atajos' | 'plantillas'
  | 'exportar' | 'importar' | 'backups'
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
      { id: 'backups', label: 'Backups', icon: '🗂' },
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
  magic: 'Sugerencias automáticas y acciones inteligentes.',
  atajos: 'Atajos de teclado y expansión de texto.',
  plantillas: 'Plantillas personalizadas para crear notas rápido.',
  backups: 'Snapshots automáticos cada 2h. Restaura tu vault a cualquier punto.',
  exportar: 'Exporta una copia de tus datos en JSON o Markdown.',
  importar: 'Importa notas y tareas desde un archivo JSON.',
  claude: 'Conecta Claude Desktop con tu vault mediante MCP.',
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
  const { t } = useTranslation()
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
      <div className="st-section-title">{t('settings.magic.suggestions')}</div>
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

      <div className="st-section-title" style={{ marginTop: 20 }}>{t('settings.magic.actions')}</div>
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

      <div className="st-section-title" style={{ marginTop: 20 }}>{t('settings.magic.visual')}</div>
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

      <MagicLearningsSection />
    </div>
  )
}

function MagicLearningsSection() {
  const { t } = useTranslation()
  const ls = useLearningsStore()
  const items = ls.getAll()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const categoryLabel: Record<string, string> = {
    type:     'Tipo',
    context:  'Contexto',
    behavior: 'Comportamiento',
    positive: 'Refuerzo',
  }
  const categoryColor: Record<string, string> = {
    type:     '#3b82f6',
    context:  '#8b5cf6',
    behavior: '#f59e0b',
    positive: '#10b981',
  }

  return (
    <>
      <div className="st-section-title" style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{t('settings.magic.learned')}</span>
        {items.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 10, padding: '1px 6px' }}>
            {items.length}
          </span>
        )}
        {items.length > 0 && (
          <button
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => { if (confirm('¿Borrar todos los aprendizajes?')) ls.clear() }}
          >
            Borrar todo
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '16px 0', fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>✦</div>
          Magic todavía no ha aprendido nada de ti.<br />
          Usa <strong>botón derecho → Enseñar a Magic</strong> en cualquier nodo<br />
          para corregir interpretaciones y ayudarle a entenderte mejor.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {items.map(item => (
            <div key={item.id} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {/* Categoría badge */}
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                  color: categoryColor[item.category] ?? 'var(--text-tertiary)',
                  background: `${categoryColor[item.category] ?? '#999'}18`,
                  borderRadius: 4, padding: '1px 5px', flexShrink: 0, marginTop: 1,
                }}>
                  {categoryLabel[item.category] ?? item.category}
                </span>

                {/* Texto editable */}
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { ls.update(item.id, editText); setEditingId(null) }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    style={{
                      flex: 1, fontSize: 12, background: 'var(--bg-primary)',
                      border: '1px solid var(--border-focus)', borderRadius: 4,
                      padding: '2px 6px', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {item.text}
                  </span>
                )}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      if (editingId === item.id) { ls.update(item.id, editText); setEditingId(null) }
                      else { setEditingId(item.id); setEditText(item.text) }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '1px 4px' }}
                    title="Editar"
                  >✎</button>
                  <button
                    onClick={() => ls.remove(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '1px 4px' }}
                    title="Eliminar"
                  >✕</button>
                </div>
              </div>

              {/* Nodo origen y fecha */}
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                {item.nodeText && <span>en: "{item.nodeText.slice(0, 40)}"</span>}
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
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
        {stat(followUps, 'Bucles')}
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

// ── BackupsPane ───────────────────────────────────────────────────────────────

function BackupsPane() {
  const [snapshots, setSnapshots] = useState<import('../../api/backups').BackupSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { listBackups } = await import('../../api/backups')
      const list = await listBackups()
      setSnapshots(list)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleCreate() {
    setCreating(true); setError(null); setInfo(null)
    try {
      const { createBackup } = await import('../../api/backups')
      const r = await createBackup('web')
      setInfo(`Snapshot creado (${r.nodeCount} nodos)`)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setCreating(false)
      setTimeout(() => setInfo(null), 3000)
    }
  }

  async function handleRestore(id: string, createdAt: string) {
    if (!confirm(`¿Restaurar el vault al snapshot del ${new Date(createdAt).toLocaleString('es-ES')}?\n\nSe creará un snapshot de seguridad del estado actual antes de restaurar, así puedes deshacerlo.`)) return
    setBusyId(id); setError(null); setInfo(null)
    try {
      const { restoreBackup } = await import('../../api/backups')
      const r = await restoreBackup(id)
      setInfo(`Restaurado (${r.restoredCount} nodos). Recarga la página.`)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar este snapshot?')) return
    setBusyId(id); setError(null)
    try {
      const { deleteBackup } = await import('../../api/backups')
      await deleteBackup(id)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="st-section-title">Snapshots</div>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
        Cada 2h se guarda una copia completa de tu vault. Mantenemos los últimos 12 snapshots.
        Mac y web comparten los mismos snapshots — puedes restaurar desde cualquier dispositivo.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16 }}>
        <button className="btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creando...' : '📸 Crear snapshot ahora'}
        </button>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>⚠️ {error}</div>}
      {info && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 8 }}>✓ {info}</div>}
      {loading ? (
        <div style={{ opacity: 0.6, fontSize: 13 }}>Cargando…</div>
      ) : snapshots.length === 0 ? (
        <div style={{ opacity: 0.6, fontSize: 13 }}>Aún no hay snapshots. Crea uno con el botón de arriba o espera al cron automático.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {snapshots.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {new Date(s.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 12, fontWeight: 400 }}>
                    {formatAge(s.createdAt)} · {s.source}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{s.nodeCount} nodos</div>
              </div>
              <button
                className="btn-secondary btn-sm"
                disabled={busyId === s.id}
                onClick={() => handleRestore(s.id, s.createdAt)}
                title="Restaurar este snapshot"
              >
                ↺ Restaurar
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={busyId === s.id}
                onClick={() => handleDelete(s.id)}
                title="Borrar snapshot"
                style={{ opacity: 0.6 }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function formatAge(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Hace un momento'
  if (m < 60) return `Hace ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Hace ${h}h`
  const d = Math.floor(h / 24)
  return `Hace ${d}d`
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
      case 'magic':       return <MagicPane />
      case 'atajos':      return <AtajosPane />
      case 'plantillas':  return <PlantillasPane />
      case 'backups':     return <BackupsPane />
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
