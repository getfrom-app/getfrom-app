import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CuentaPane,
  AparienciaPane,
  IAPane,
  CapturaRapidaPane,
  AtajosPane,
  GooglePane,
  ExportarPane,
  ImportarPane,
} from '../modals/SettingsModal'
import { useTheme, type AccentColor } from '../../hooks/useTheme'
import { useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'
import { useLearningsStore } from '../../store/learningsStore'
import { ALL_ITEMS, SUBTITLES, type Tab } from './settingsNav'
import { readLearnedItems, getOrCreateLearnNode } from '../../api/userKnowledge'
import { findContextRoot } from '../../utils/rootLookup'
import { isContextKnowledge } from '../../utils/knowledgeNodes'

// La lista de pestañas vive en la columna derecha (SettingsListPanel). Esta vista
// solo renderiza el contenido de la pestaña activa (leída del query param ?tab=).

// ── MagicPane ─────────────────────────────────────────────────────────────────
// Magic está siempre activo. Fromly aprende datos duraderos sobre ti y los escribe
// en su parte del Perfil de IA. La limpieza/compactación es automática y periódica
// (no hay botón). "Ver y editar" lleva a lo que Fromly ha escrito por su cuenta.

function MagicPane() {
  const s = useStore()
  const navigate = useNavigate()
  const ls = useLearningsStore()

  void s.nodesVersion
  void ls           // re-render cuando cambian las reglas de Magic
  const learned = readLearnedItems()
  const total = learned.people.length + learned.facts.length

  function openLearned() {
    const node = getOrCreateLearnNode()
    if (node) navigate(`/node/${node.id}`)
  }

  // Conocimiento que Fromly mantiene por contexto (nodo "🧠 Lo que Fromly sabe" dentro
  // de cada contexto; se regenera y sobrescribe solo, no acumula).
  const contextKnowledge = (() => {
    const root = findContextRoot()
    if (!root) return [] as { name: string; id: string }[]
    const out: { name: string; id: string }[] = []
    for (const ctx of s.children(root.id)) {
      if (ctx.deletedAt || (ctx.text || '').startsWith('🧠')) continue
      const kn = s.children(ctx.id).find(n => !n.deletedAt && isContextKnowledge(n.text))
      if (kn) out.push({ name: ctx.text || 'Contexto', id: kn.id })
    }
    return out
  })()

  return (
    <div className="st-pane">
      <div className="st-section-title">Lo que Fromly sabe de ti</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">Conocimiento de Fromly</div>
          <div className="st-row-hint">
            Fromly aprende datos duraderos sobre ti (personas, objetivos, situación) de tus notas y conversaciones, y los guarda aquí por su cuenta. También aprende de lo que le enseñas (botón derecho → Enseñar a Magic).
            {total > 0 ? ` Ha aprendido ${total} ${total === 1 ? 'dato' : 'datos'}.` : ' Aún no ha aprendido datos nuevos.'}
            {' '}Ábrelo para revisarlo y editarlo en bullets, como cualquier nota. La limpieza es automática.
          </div>
        </div>
        <div className="st-row-action">
          <button className="btn-primary btn-sm" onClick={openLearned}>Ver y editar</button>
        </div>
      </div>

      {contextKnowledge.length > 0 && (
        <>
          <div className="st-section-title" style={{ marginTop: 24 }}>Lo que Fromly sabe por contexto</div>
          <div className="st-row-hint" style={{ marginBottom: 4 }}>
            Para cada contexto, Fromly mantiene un resumen (palabras clave, personas, temas) que se actualiza solo al usarlo.
          </div>
          {contextKnowledge.map(c => (
            <div className="st-row" key={c.id}>
              <div className="st-row-info"><div className="st-row-label">{c.name}</div></div>
              <div className="st-row-action">
                <button className="btn-secondary btn-sm" onClick={() => navigate(`/node/${c.id}`)}>Ver</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── AparienciaViewPane (con selector de color de acento) ──────────────────────

const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: 'purple', label: 'Morado',  hex: '#8b5cf6' },
  { value: 'indigo', label: 'Índigo',  hex: '#6366f1' },
  { value: 'blue',   label: 'Azul',    hex: '#3b82f6' },
  { value: 'cyan',   label: 'Cian',    hex: '#06b6d4' },
  { value: 'teal',   label: 'Teal',    hex: '#14b8a6' },
  { value: 'green',  label: 'Verde',   hex: '#22c55e' },
  { value: 'lime',   label: 'Lima',    hex: '#84cc16' },
  { value: 'amber',  label: 'Ámbar',   hex: '#f59e0b' },
  { value: 'orange', label: 'Naranja', hex: '#f97316' },
  { value: 'red',    label: 'Rojo',    hex: '#ef4444' },
  { value: 'rose',   label: 'Rosa',    hex: '#f43f5e' },
  { value: 'pink',   label: 'Fucsia',  hex: '#ec4899' },
]

function PlannerColorRow() {
  const [color, setColor] = useState(() => localStorage.getItem('from_planner_color') || '')
  const accentHex = (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) || '#8b5cf6'
  const current = color || accentHex
  function apply(v: string) { setColor(v); localStorage.setItem('from_planner_color', v) }
  function reset() { setColor(''); localStorage.removeItem('from_planner_color') }
  return (
    <div className="st-row">
      <div className="st-row-info">
        <div className="st-row-label">Color del planner</div>
        <div className="st-row-hint">Color base de las tareas y eventos del planner (se muestra en pastel).</div>
      </div>
      <div className="st-row-action">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="color" value={current} onChange={e => apply(e.target.value)}
            style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
          {color && (
            <button onClick={reset} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Usar acento
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

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
        <PlannerColorRow />
      </div>
    </>
  )
}

// ── CuentaViewPane ────────────────────────────────────────────────────────────
// (Cerrar sesión no va aquí: ya está en el menú superior desplegable.)

function CuentaViewPane() {
  return <CuentaPane />
}

// ── BackupsPane ───────────────────────────────────────────────────────────────

function BackupsPane() {
  const { t } = useTranslation()
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
                title={t('settingsView.restoreSnapshot')}
              >
                ↺ Restaurar
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={busyId === s.id}
                onClick={() => handleDelete(s.id)}
                title={t('settingsView.deleteSnapshot')}
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
  const [searchParams] = useSearchParams()
  const param = searchParams.get('tab') as Tab | null
  const activeTab: Tab = param && ALL_ITEMS.some(i => i.id === param) ? param : 'cuenta'

  function renderPane() {
    switch (activeTab) {
      case 'cuenta':      return <CuentaViewPane />
      case 'google':      return <GooglePane />
      case 'apariencia':  return <AparienciaViewPane />
      case 'ia':          return <IAPane />
      case 'magic':       return <MagicPane />
      case 'atajos':      return <AtajosPane />
      case 'backups':     return <BackupsPane />
      case 'exportar':    return <ExportarPane />
      case 'importar':    return <ImportarPane />
      case 'captura':     return <CapturaRapidaPane />
    }
  }

  const current = ALL_ITEMS.find(i => i.id === activeTab)

  return (
    <div className="settings-view settings-view--embedded">
      {/* La lista de pestañas vive en la columna derecha. Aquí solo el contenido. */}
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
