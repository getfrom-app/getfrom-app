import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CuentaPane,
  AparienciaPane,
  IAPane,
  ClaudeMcpPane,
  CapturaRapidaPane,
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
import { ALL_ITEMS, SUBTITLES, type Tab } from './settingsNav'
import { readLearnedItems, compactProfileKnowledge } from '../../api/userKnowledge'

// La lista de pestañas vive en la columna derecha (SettingsListPanel). Esta vista
// solo renderiza el contenido de la pestaña activa (leída del query param ?tab=).

// ── MagicPane ─────────────────────────────────────────────────────────────────
// Magic está siempre activo (detección de objeto, completar, botón ✨, editor
// lateral, pill). No hay conmutadores: solo el conocimiento del perfil y lo
// aprendido por Magic.

function MagicPane() {
  return (
    <div className="st-pane">
      <ProfileKnowledgeSection />
      <MagicLearningsSection />
    </div>
  )
}

// ── Conocimiento del perfil (lo que From aprende de ti) ───────────────────────

function ProfileKnowledgeSection() {
  const [items, setItems] = useState(() => readLearnedItems())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const total = items.people.length + items.facts.length

  async function handleCompact() {
    setBusy(true); setMsg(null)
    const r = await compactProfileKnowledge()
    setItems(readLearnedItems())
    if (r) setMsg(r.before === r.after ? 'Ya estaba limpio.' : `Compactado: ${r.before} → ${r.after} entradas.`)
    else setMsg('Nada que compactar.')
    setBusy(false)
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <>
      <div className="st-section-title" style={{ marginTop: 28 }}>Lo que From sabe sobre ti</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">Conocimiento del perfil</div>
          <div className="st-row-hint">
            From aprende datos duraderos sobre ti (personas, objetivos, situación) de tus notas y conversaciones.
            {total > 0 ? ` Ahora guarda ${total} ${total === 1 ? 'entrada' : 'entradas'}.` : ' Aún no ha guardado nada.'}
            {' '}Se compacta solo al crecer; aquí puedes limpiarlo a mano.
          </div>
        </div>
        <div className="st-row-action">
          <button className="btn-secondary btn-sm" onClick={handleCompact} disabled={busy || total === 0}>
            {busy ? 'Limpiando…' : 'Limpiar y compactar'}
          </button>
        </div>
      </div>
      {msg && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0 0 4px' }}>{msg}</div>}
    </>
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

// ── CuentaViewPane ────────────────────────────────────────────────────────────
// (Cerrar sesión no va aquí: ya está en el menú superior desplegable.)

function CuentaViewPane() {
  return <CuentaPane />
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
      case 'plantillas':  return <PlantillasPane />
      case 'backups':     return <BackupsPane />
      case 'exportar':    return <ExportarPane />
      case 'importar':    return <ImportarPane />
      case 'claude':      return <ClaudeMcpPane />
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
