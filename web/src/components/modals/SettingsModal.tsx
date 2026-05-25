import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  updateMe, deleteAccount, cancelSubscription, changePlan,
  clearTokens, exportNodes, getToken, getApiToken, generateApiToken,
} from '../../api/client'
import { userStore, useUserStore } from '../../store/userStore'
import { useTheme } from '../../hooks/useTheme'
import { store } from '../../store/nodeStore'
import { type Shortcut, getShortcuts, saveShortcuts } from '../../hooks/useTextExpansion'
import { getGoogleOAuthUrl, disconnectGoogle } from '../../api/googleCalendar'

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomTemplate { id: string; name: string; body: string }
const TEMPLATES_KEY = 'from_custom_templates'
function getTemplates(): CustomTemplate[] {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') } catch { return [] }
}
function saveTemplates(ts: CustomTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(ts))
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = 'cuenta' | 'apariencia' | 'ia' | 'atajos' | 'plantillas' | 'google' | 'exportar' | 'importar'

interface Section { id: Tab; label: string; icon: string }
const SECTIONS: { title?: string; items: Section[] }[] = [
  {
    items: [
      { id: 'cuenta', label: 'Cuenta', icon: '👤' },
      { id: 'google', label: 'Google', icon: '📅' },
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
    ],
  },
  {
    title: 'Productividad',
    items: [
      { id: 'atajos', label: 'Atajos de texto', icon: '⌨' },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row-info">
        <div className="st-row-label">{label}</div>
        {hint && <div className="st-row-hint">{hint}</div>}
      </div>
      {children && <div className="st-row-action">{children}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="st-section-title">{children}</div>
}

// ── Tab panes ─────────────────────────────────────────────────────────────────

export function CuentaPane() {
  const navigate = useNavigate()
  const us = useUserStore()
  const { user } = us

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [subLoading, setSubLoading] = useState(false)
  const [subError, setSubError] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Stats
  const nodes = store.allActive()
  const totalNotes = nodes.filter(n => !n.isDiaryEntry && n.status === null).length
  const totalTasks = nodes.filter(n => n.status !== null).length
  const doneTasks = nodes.filter(n => n.status === 'done').length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const totalWords = nodes.reduce((acc, n) => {
    const bodyWords = n.body ? n.body.trim().split(/\s+/).length : 0
    const titleWords = n.text ? n.text.trim().split(/\s+/).length : 0
    return acc + bodyWords + titleWords
  }, 0)
  const diaryDates = new Set(
    nodes.filter(n => n.isDiaryEntry && n.diaryDate).map(n => new Date(n.diaryDate!).toDateString())
  )
  let diaryStreak = 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    if (diaryDates.has(d.toDateString())) diaryStreak++
    else break
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault(); setPasswordError(''); setPasswordSuccess('')
    if (newPassword !== confirmPassword) { setPasswordError('Las contraseñas no coinciden'); return }
    setPasswordLoading(true)
    try {
      await updateMe({ currentPassword, newPassword })
      setPasswordSuccess('Contraseña actualizada')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: unknown) { setPasswordError(err instanceof Error ? err.message : 'Error') }
    finally { setPasswordLoading(false) }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault(); setEmailError(''); setEmailSuccess(''); setEmailLoading(true)
    try {
      await updateMe({ newEmail, currentPassword: emailPassword })
      await userStore.fetchMe()
      setEmailSuccess('Email actualizado'); setNewEmail(''); setEmailPassword(''); setShowEmailForm(false)
    } catch (err: unknown) { setEmailError(err instanceof Error ? err.message : 'Error') }
    finally { setEmailLoading(false) }
  }

  async function handleSubscribe() {
    setSubError(''); setSubLoading(true)
    try {
      const res = await changePlan()
      if (res.checkoutUrl) {
        const url = user?.email
          ? `${res.checkoutUrl}${res.checkoutUrl.includes('?') ? '&' : '?'}checkout[email]=${encodeURIComponent(user.email)}`
          : res.checkoutUrl
        window.open(url, '_blank')
      }
    } catch (err: unknown) { setSubError(err instanceof Error ? err.message : 'Error') }
    finally { setSubLoading(false) }
  }

  async function handleCancelSubscription() {
    setSubError(''); setSubLoading(true)
    try {
      const res = await cancelSubscription()
      if (!res.ok && res.billingPortalUrl) window.open(res.billingPortalUrl, '_blank')
      else await userStore.fetchMe()
    } catch (err: unknown) { setSubError(err instanceof Error ? err.message : 'Error') }
    finally { setSubLoading(false) }
  }

  async function handleDeleteAccount() {
    setDeleteError(''); setDeleteLoading(true)
    try {
      await deleteAccount(); clearTokens(); userStore.reset()
      navigate('/login', { replace: true })
    } catch (err: unknown) { setDeleteError(err instanceof Error ? err.message : 'Error'); setDeleteLoading(false) }
  }

  function getPlanBadge() {
    if (user?.licenseStatus === 'active') return <span className="plan-badge plan-badge--license">Licencia perpetua</span>
    if (user?.subscriptionStatus === 'active') return <span className="plan-badge plan-badge--active">Activa</span>
    if (user?.subscriptionStatus === 'cancelled' || user?.subscriptionStatus === 'expired') return <span className="plan-badge plan-badge--cancelled">Cancelada</span>
    return <span className="plan-badge plan-badge--free">Sin plan</span>
  }

  return (
    <div className="st-pane">
      {/* Stats */}
      <div className="st-stats">
        <div className="st-stat"><span className="st-stat-n">{totalNotes}</span><span>Notas</span></div>
        <div className="st-stat"><span className="st-stat-n">{totalTasks}</span><span>Tareas</span></div>
        <div className="st-stat"><span className="st-stat-n">{doneTasks}</span><span>Completadas</span></div>
        <div className="st-stat"><span className="st-stat-n">{completionRate}%</span><span>Tasa</span></div>
        <div className="st-stat"><span className="st-stat-n">{diaryStreak}</span><span>Racha</span></div>
        <div className="st-stat"><span className="st-stat-n">{totalWords.toLocaleString()}</span><span>Palabras</span></div>
      </div>

      <SectionTitle>Perfil</SectionTitle>

      <Row label="Email" hint={user?.email ?? '—'}>
        <button className="btn-secondary" onClick={() => { setShowEmailForm(v => !v); setEmailError(''); setEmailSuccess('') }}>
          Cambiar
        </button>
      </Row>
      {showEmailForm && (
        <form className="st-form" onSubmit={handleChangeEmail}>
          <div className="st-form-field"><label>Nuevo email</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nuevo@email.com" required /></div>
          <div className="st-form-field"><label>Contraseña actual</label><input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} placeholder="••••••••" required /></div>
          {emailError && <div className="auth-error">{emailError}</div>}
          {emailSuccess && <div className="auth-success">{emailSuccess}</div>}
          <div className="st-form-actions">
            <button type="submit" className="btn-primary" disabled={emailLoading}>{emailLoading ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowEmailForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <Row label="Contraseña" hint="••••••••">
        <button className="btn-secondary" onClick={() => { setShowPasswordForm(v => !v); setPasswordError(''); setPasswordSuccess('') }}>
          Cambiar
        </button>
      </Row>
      {showPasswordForm && (
        <form className="st-form" onSubmit={handleChangePassword}>
          <div className="st-form-field"><label>Contraseña actual</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" required /></div>
          <div className="st-form-field"><label>Nueva contraseña</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={8} /></div>
          <div className="st-form-field"><label>Confirmar nueva contraseña</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required /></div>
          {passwordError && <div className="auth-error">{passwordError}</div>}
          {passwordSuccess && <div className="auth-success">{passwordSuccess}</div>}
          <div className="st-form-actions">
            <button type="submit" className="btn-primary" disabled={passwordLoading}>{passwordLoading ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowPasswordForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <SectionTitle>Suscripción</SectionTitle>

      <Row label="Estado">{getPlanBadge()}</Row>
      {user?.subscriptionStatus === 'active' && user.subscriptionRenewsAt && (
        <Row label="Próxima renovación">
          <span className="st-value">{new Date(user.subscriptionRenewsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </Row>
      )}
      {user?.tokensBalance !== undefined && (
        <Row label="Tokens IA">
          <span className="st-value">{user.tokensBalance.toLocaleString()}</span>
        </Row>
      )}
      {subError && <div className="auth-error" style={{ marginTop: 8 }}>{subError}</div>}
      <div className="st-actions">
        {user?.subscriptionStatus !== 'active' && user?.licenseStatus !== 'active' && (
          <button className="btn-primary" onClick={handleSubscribe} disabled={subLoading}>
            {subLoading ? 'Cargando...' : 'Suscribirse'}
          </button>
        )}
        {user?.subscriptionStatus === 'active' && (
          <button className="btn-secondary btn-danger-outline" onClick={handleCancelSubscription} disabled={subLoading}>
            {subLoading ? 'Procesando...' : 'Cancelar suscripción'}
          </button>
        )}
        <a href="https://app.lemonsqueezy.com/billing" target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Gestionar facturación ↗
        </a>
      </div>

      <SectionTitle>Privacidad</SectionTitle>
      <Row label="Tus datos" hint="Tus notas se guardan localmente y en nuestros servidores para sincronización. Nunca compartimos datos con terceros ni los usamos para entrenar modelos de IA." />
      <Row label="Política de privacidad">
        <a href="https://getfrom.app/privacy" target="_blank" rel="noopener noreferrer" className="btn-secondary">Ver ↗</a>
      </Row>

      <SectionTitle>Zona de peligro</SectionTitle>
      <Row label="Eliminar cuenta" hint="Acción irreversible. Se borrarán todos tus datos permanentemente.">
        <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>Eliminar cuenta</button>
      </Row>

      {showDeleteModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>¿Eliminar cuenta?</h2>
            <p>Esta acción eliminará permanentemente tu cuenta y todos tus datos. No se puede deshacer.</p>
            {deleteError && <div className="auth-error" style={{ marginTop: 12 }}>{deleteError}</div>}
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>{deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}</button>
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function AparienciaPane() {
  const { theme, setTheme } = useTheme()

  // Franja horaria visible (calendario + timeline diario)
  const [dayStart, setDayStartState] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('from_day_start_hour') || '')
    return isNaN(v) ? 7 : v
  })
  const [dayEnd, setDayEndState] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('from_day_end_hour') || '')
    return isNaN(v) ? 23 : v
  })
  function applyDayStart(h: number) {
    setDayStartState(h)
    localStorage.setItem('from_day_start_hour', String(h))
    window.dispatchEvent(new Event('from-day-hours-changed'))
  }
  function applyDayEnd(h: number) {
    setDayEndState(h)
    localStorage.setItem('from_day_end_hour', String(h))
    window.dispatchEvent(new Event('from-day-hours-changed'))
  }

  const fontSizeKey = 'from_font_size'
  const [fontSize, setFontSize] = useState(() => localStorage.getItem(fontSizeKey) || 'normal')

  function applyFontSize(size: string) {
    setFontSize(size)
    localStorage.setItem(fontSizeKey, size)
    const root = document.documentElement
    if (size === 'small') root.style.setProperty('--font-size-base', '13px')
    else if (size === 'large') root.style.setProperty('--font-size-base', '16px')
    else root.style.removeProperty('--font-size-base')
  }

  const lineHeightKey = 'from_line_height'
  const [lineHeight, setLineHeight] = useState(() => localStorage.getItem(lineHeightKey) || 'normal')

  function applyLineHeight(lh: string) {
    setLineHeight(lh)
    localStorage.setItem(lineHeightKey, lh)
    const root = document.documentElement
    if (lh === 'compact') root.style.setProperty('--line-height-base', '1.4')
    else if (lh === 'relaxed') root.style.setProperty('--line-height-base', '1.8')
    else root.style.removeProperty('--line-height-base')
  }

  return (
    <div className="st-pane">
      <SectionTitle>Tema</SectionTitle>
      <Row label="Modo de color" hint="Elige entre modo claro y oscuro.">
        <div className="st-segmented">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>☀️ Claro</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>🌙 Oscuro</button>
        </div>
      </Row>

      <SectionTitle>Tipografía</SectionTitle>
      <Row label="Tamaño de fuente" hint="Ajusta el tamaño base del texto en la app.">
        <div className="st-segmented">
          <button className={fontSize === 'small' ? 'active' : ''} onClick={() => applyFontSize('small')}>Pequeño</button>
          <button className={fontSize === 'normal' ? 'active' : ''} onClick={() => applyFontSize('normal')}>Normal</button>
          <button className={fontSize === 'large' ? 'active' : ''} onClick={() => applyFontSize('large')}>Grande</button>
        </div>
      </Row>
      <Row label="Interlineado" hint="Espacio entre líneas de texto.">
        <div className="st-segmented">
          <button className={lineHeight === 'compact' ? 'active' : ''} onClick={() => applyLineHeight('compact')}>Compacto</button>
          <button className={lineHeight === 'normal' ? 'active' : ''} onClick={() => applyLineHeight('normal')}>Normal</button>
          <button className={lineHeight === 'relaxed' ? 'active' : ''} onClick={() => applyLineHeight('relaxed')}>Espacioso</button>
        </div>
      </Row>

      <SectionTitle>Calendario y Timeline</SectionTitle>
      <Row label="Hora de inicio del día" hint="Las horas anteriores quedan ocultas en calendario semanal y timeline diario.">
        <select value={dayStart} onChange={e => applyDayStart(parseInt(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </Row>
      <Row label="Hora de fin del día" hint="Las horas posteriores quedan ocultas. Por defecto: 7:00 a 23:00.">
        <select value={dayEnd} onChange={e => applyDayEnd(parseInt(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {Array.from({ length: 24 }, (_, h) => h + 1).map(h => (
            <option key={h} value={h} disabled={h <= dayStart}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </Row>
    </div>
  )
}

const ANTHROPIC_KEY_LS = 'from_anthropic_api_key'
const AI_LANG_LS = 'from_ai_language'

export function IAPane() {
  const us = useUserStore()
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(ANTHROPIC_KEY_LS) || '')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [lang, setLang] = useState<string>(() => localStorage.getItem(AI_LANG_LS) || 'es')

  function saveApiKey() {
    if (apiKey.trim()) localStorage.setItem(ANTHROPIC_KEY_LS, apiKey.trim())
    else localStorage.removeItem(ANTHROPIC_KEY_LS)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }
  function clearApiKey() {
    setApiKey('')
    localStorage.removeItem(ANTHROPIC_KEY_LS)
  }
  function setLanguage(v: string) {
    setLang(v)
    localStorage.setItem(AI_LANG_LS, v)
  }

  return (
    <div className="st-pane">
      <SectionTitle>Proveedor de IA</SectionTitle>
      <Row
        label="Modelo por defecto"
        hint="From usa los modelos de Anthropic (Claude) para las funciones de IA. Las llamadas se hacen a través de nuestro servidor con tus tokens incluidos, o con tu propia API key si la configuras."
      >
        <span className="st-value">Claude (Anthropic)</span>
      </Row>

      <SectionTitle>API Key propia</SectionTitle>
      <Row
        label="Clave de Anthropic"
        hint="Si añades tu propia API key de Anthropic, From la usará directamente y no consumirá los tokens incluidos en tu plan. Se guarda solo en este navegador."
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="st-input"
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
        />
        <button className="btn-secondary" onClick={() => setShowKey(v => !v)} style={{ fontSize: 12 }} title={showKey ? 'Ocultar' : 'Mostrar'}>
          {showKey ? '🙈' : '👁'}
        </button>
      </div>
      <div className="st-actions">
        <button className="btn-primary" onClick={saveApiKey}>{keySaved ? '✓ Guardado' : 'Guardar'}</button>
        {apiKey && <button className="btn-secondary btn-danger-outline" onClick={clearApiKey}>Borrar</button>}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12 }}>
          Obtener key ↗
        </a>
      </div>

      <SectionTitle>Tokens incluidos</SectionTitle>
      {us.user?.tokensBalance !== undefined ? (
        <Row label="Balance de tokens">
          <span className="st-value">{us.user.tokensBalance.toLocaleString()}</span>
        </Row>
      ) : (
        <Row label="Balance de tokens" hint="Inicia sesión para ver tu balance." />
      )}
      <Row label="¿Qué son los tokens?" hint="Cada operación de IA consume tokens de tu saldo mensual. Con un plan activo recibes tokens cada mes. Puedes añadir tu propia API key arriba para no consumirlos." />

      <SectionTitle>Idioma</SectionTitle>
      <Row
        label="Idioma de las respuestas IA"
        hint="Idioma preferido para las respuestas generadas por la IA. La IA detecta también el idioma del contexto."
      >
        <div className="st-segmented">
          <button className={lang === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>Español</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
          <button className={lang === 'auto' ? 'active' : ''} onClick={() => setLanguage('auto')}>Auto</button>
        </div>
      </Row>
    </div>
  )
}

export function ClaudeMcpPane() {
  const [mcpToken, setMcpToken] = useState<string | null>(null)
  const [mcpCopied, setMcpCopied] = useState(false)
  const [generatingMcp, setGeneratingMcp] = useState(false)
  const [mcpLoaded, setMcpLoaded] = useState(false)
  const [phraseCopied, setPhraseCopied] = useState(false)

  useEffect(() => {
    if (!getToken()) { setMcpLoaded(true); return }
    getApiToken().then(d => { setMcpToken(d.token); setMcpLoaded(true) }).catch(() => setMcpLoaded(true))
  }, [])

  async function handleGenerateMcpToken() {
    setGeneratingMcp(true)
    try { const r = await generateApiToken(); setMcpToken(r.token) }
    catch (e) { console.error(e) }
    finally { setGeneratingMcp(false) }
  }

  function copyMcpToken() {
    if (!mcpToken) return
    navigator.clipboard.writeText(mcpToken).catch(() => {})
    setMcpCopied(true); setTimeout(() => setMcpCopied(false), 2000)
  }
  function copyPhrase() {
    navigator.clipboard.writeText('Configura From').catch(() => {})
    setPhraseCopied(true); setTimeout(() => setPhraseCopied(false), 2000)
  }

  return (
    <div className="st-pane">
      <SectionTitle>1. Token de API</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Genera un token único para que Claude Desktop pueda conectarse a tu vault de From.
      </div>
      {mcpLoaded ? (
        mcpToken ? (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
                {mcpToken}
              </code>
              <button className="btn-secondary" onClick={copyMcpToken} style={{ flexShrink: 0, fontSize: 12 }}>
                {mcpCopied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <button onClick={handleGenerateMcpToken} disabled={generatingMcp} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', cursor: 'pointer', padding: 0, border: 'none' }}>
              {generatingMcp ? 'Regenerando...' : 'Regenerar token'}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleGenerateMcpToken} disabled={generatingMcp}>
            {generatingMcp ? 'Generando...' : 'Generar token de API'}
          </button>
        )
      ) : <div className="st-row-hint">Cargando...</div>}

      <SectionTitle>2. Descargar extensión</SectionTitle>
      <Row
        label="Extensión Claude Desktop (.dxt)"
        hint="Con Claude Desktop abierto, haz doble clic en el archivo descargado. Cuando Claude pida el token, pega el del paso 1."
      >
        <a href="https://getfrom.app/From.dxt" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ fontSize: 12 }}>
          Descargar From.dxt
        </a>
      </Row>

      <SectionTitle>3. Configurar From en Claude</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 8 }}>
        Una vez instalado, escribe esta frase en Claude una sola vez:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <code style={{ flex: 1, padding: '8px 12px', background: 'rgba(139,92,246,0.08)', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.18)' }}>
          Configura From
        </code>
        <button className="btn-secondary" onClick={copyPhrase} style={{ fontSize: 12 }}>
          {phraseCopied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>

      <SectionTitle>Más información</SectionTitle>
      <Row label="Documentación completa">
        <a href="https://getfrom.app/claude" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12 }}>
          Ver instrucciones ↗
        </a>
      </Row>
    </div>
  )
}

export function AtajosPane() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => getShortcuts())
  const [newTrigger, setNewTrigger] = useState('')
  const [newExpansion, setNewExpansion] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  function handleAdd() {
    if (!newTrigger.trim() || !newExpansion.trim()) return
    const sc: Shortcut = { id: crypto.randomUUID(), trigger: newTrigger.trim(), expansion: newExpansion.trim() }
    const updated = [...shortcuts, sc]
    setShortcuts(updated); saveShortcuts(updated)
    setNewTrigger(''); setNewExpansion(''); setShowAdd(false)
  }

  function handleDelete(id: string) {
    const updated = shortcuts.filter(s => s.id !== id)
    setShortcuts(updated); saveShortcuts(updated)
  }

  const KB_SHORTCUTS = [
    { key: '⌘K', desc: 'Búsqueda y comandos' },
    { key: '⌘Z', desc: 'Deshacer' },
    { key: '⌘⇧Z', desc: 'Rehacer' },
    { key: '⌘⇧S', desc: 'Mostrar/ocultar sidebar' },
    { key: '⌘⇧C', desc: 'Colapsar / expandir todo' },
    { key: '⌘[', desc: 'Ir atrás' },
    { key: '⌘]', desc: 'Ir adelante' },
    { key: '?', desc: 'Ver todos los atajos' },
  ]

  return (
    <div className="st-pane">
      <SectionTitle>Expansión de texto</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 12 }}>
        Define atajos que se expanden automáticamente mientras escribes. Ej: <code>;firma</code> → <em>Un saludo, Alberto</em>
      </div>

      {shortcuts.length > 0 && (
        <table className="st-table">
          <thead>
            <tr><th>Trigger</th><th>Expansión</th><th /></tr>
          </thead>
          <tbody>
            {shortcuts.map(sc => (
              <tr key={sc.id}>
                <td><code className="st-code">{sc.trigger}</code></td>
                <td style={{ color: 'var(--text-secondary)' }}>{sc.expansion}</td>
                <td>
                  <button onClick={() => handleDelete(sc.id)} className="st-delete-btn" title="Eliminar">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd ? (
        <div className="st-add-form">
          <input type="text" placeholder="Trigger (;firma)" value={newTrigger} onChange={e => setNewTrigger(e.target.value)} className="st-input" style={{ width: 130 }} />
          <input type="text" placeholder="Expansión" value={newExpansion} onChange={e => setNewExpansion(e.target.value)} className="st-input" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn-primary" onClick={handleAdd} style={{ fontSize: 13 }}>Guardar</button>
          <button className="btn-secondary" onClick={() => setShowAdd(false)} style={{ fontSize: 13 }}>Cancelar</button>
        </div>
      ) : (
        <div className="st-actions"><button className="btn-secondary" onClick={() => setShowAdd(true)}>+ Añadir atajo</button></div>
      )}

      <SectionTitle>Atajos de teclado</SectionTitle>
      <div className="st-kb-grid">
        {KB_SHORTCUTS.map(s => (
          <div key={s.key} className="st-kb-row">
            <kbd className="st-kbd">{s.key}</kbd>
            <span>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlantillasPane() {
  const [templates, setTemplates] = useState<CustomTemplate[]>(getTemplates)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const t: CustomTemplate = { id: Date.now().toString(), name: name.trim(), body: body.trim() }
    const updated = [...templates, t]
    saveTemplates(updated); setTemplates(updated)
    setName(''); setBody('')
  }

  function handleDelete(id: string) {
    const updated = templates.filter(t => t.id !== id)
    saveTemplates(updated); setTemplates(updated)
  }

  return (
    <div className="st-pane">
      <SectionTitle>Plantillas de nodo</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 12 }}>
        Define plantillas para crear notas con contenido predefinido. Aparecerán en el menú contextual de nodos.
      </div>

      {templates.length > 0 && (
        <table className="st-table">
          <thead>
            <tr><th>Nombre</th><th>Contenido</th><th /></tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.name}</td>
                <td style={{ color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.body ? t.body.slice(0, 50) + (t.body.length > 50 ? '…' : '') : <em>Sin contenido</em>}
                </td>
                <td><button onClick={() => handleDelete(t.id)} className="st-delete-btn" title="Eliminar">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="st-template-form">
        <input type="text" placeholder="Nombre de la plantilla" value={name} onChange={e => setName(e.target.value)} className="st-input" />
        <textarea placeholder="Contenido markdown (opcional)..." value={body} onChange={e => setBody(e.target.value)} rows={4} className="st-input" style={{ resize: 'vertical' }} />
        <div className="st-actions">
          <button className="btn-primary" onClick={handleAdd}>+ Añadir plantilla</button>
        </div>
      </div>
    </div>
  )
}

export function GooglePane() {
  const us = useUserStore()
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Refresh status when pane opens
    userStore.refreshGoogleStatus()
  }, [])

  async function handleDisconnect() {
    setError('')
    setDisconnecting(true)
    try {
      await disconnectGoogle()
      await userStore.refreshGoogleStatus()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al desconectar')
    } finally {
      setDisconnecting(false)
    }
  }

  function handleConnect() {
    window.location.href = getGoogleOAuthUrl()
  }

  return (
    <div className="st-pane">
      <SectionTitle>Google</SectionTitle>

      <Row
        label="Estado de la conexión"
        hint="Conectar Google te da acceso a Google Calendar y Google Drive en una sola autorización."
      >
        {us.googleConnected ? (
          <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#22c55e', whiteSpace: 'nowrap' }}>
            Conectado
          </span>
        ) : (
          <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            No conectado
          </span>
        )}
      </Row>

      {us.googleConnected && us.googleEmail && (
        <Row label="Cuenta">
          <span className="st-value" style={{ fontSize: 12 }}>{us.googleEmail}</span>
        </Row>
      )}

      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="st-actions">
        {us.googleConnected ? (
          <button className="btn-secondary btn-danger-outline" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Desconectando...' : 'Desconectar Google'}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleConnect}>
            Conectar Google
          </button>
        )}
      </div>

      <SectionTitle>Google Calendar</SectionTitle>
      <Row
        label="Sincronización de eventos"
        hint="Cuando Google está conectado, los eventos de tu calendario aparecen en el Timeline del Diario automáticamente."
      />

      <SectionTitle>Google Drive</SectionTitle>
      <Row
        label="Acceso a archivos"
        hint="La misma autorización permite adjuntar archivos desde Google Drive en tus notas."
      />
    </div>
  )
}

export function ExportarPane() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleExport(format: 'json' | 'markdown') {
    setError(''); setLoading(true)
    try {
      const data = await exportNodes(format)
      const date = new Date().toISOString().slice(0, 10)
      let blob: Blob, filename: string
      if (format === 'markdown') {
        const mdStr = typeof data === 'string' ? data : (data as Record<string, unknown>).markdown as string || JSON.stringify(data)
        blob = new Blob([mdStr], { type: 'text/markdown' }); filename = `from-backup-${date}.md`
      } else {
        const jsonData = Array.isArray(data) ? data : (data as Record<string, unknown>).nodes || data
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }); filename = `from-backup-${date}.json`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al exportar') }
    finally { setLoading(false) }
  }

  function handleExportLocal(format: 'json' | 'markdown') {
    const nodes = store.allActive().filter(n => !n.deletedAt)
    const date = new Date().toISOString().slice(0, 10)
    let blob: Blob, filename: string
    if (format === 'markdown') {
      const lines: string[] = [`# From Export — ${new Date().toLocaleDateString('es-ES')}`, '']
      function renderNode(node: typeof nodes[0], depth: number): string[] {
        const indent = '  '.repeat(depth)
        const prefix = node.status === 'done' ? '[x] ' : node.status === 'pending' ? '[ ] ' : ''
        const result = [`${indent}${prefix}${node.text || 'Sin título'}`]
        if (node.body) { result.push(''); node.body.split('\n').forEach(l => result.push(`${indent}  ${l}`)); result.push('') }
        nodes.filter(n => n.parentId === node.id).sort((a, b) => a.siblingOrder - b.siblingOrder).forEach(child => result.push(...renderNode(child, depth + 1)))
        return result
      }
      nodes.filter(n => !n.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder).forEach(root => { lines.push(...renderNode(root, 0)); lines.push('') })
      blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }); filename = `from-export-${date}.md`
    } else {
      blob = new Blob([JSON.stringify(nodes, null, 2)], { type: 'application/json' }); filename = `from-export-${date}.json`
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="st-pane">
      <SectionTitle>Exportar datos</SectionTitle>
      <Row label="Backup del servidor" hint="Exporta una copia de tus datos almacenados en el servidor." />
      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="st-actions">
        <button className="btn-secondary" onClick={() => handleExport('json')} disabled={loading}>
          {loading ? 'Exportando...' : 'Backup JSON (servidor)'}
        </button>
        <button className="btn-secondary" onClick={() => handleExport('markdown')} disabled={loading}>
          {loading ? 'Exportando...' : 'Backup Markdown (servidor)'}
        </button>
      </div>

      <SectionTitle>Exportar local</SectionTitle>
      <Row label="Datos locales" hint="Exporta los datos almacenados en este navegador." />
      <div className="st-actions">
        <button className="btn-secondary" onClick={() => handleExportLocal('json')}>Exportar JSON (local)</button>
        <button className="btn-secondary" onClick={() => handleExportLocal('markdown')}>Exportar Markdown (local)</button>
      </div>
    </div>
  )
}

export function ImportarPane() {
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportResult(null); setImportError(null)
    try {
      const text = await file.text()
      let nodes: unknown[]
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text)
        nodes = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>).nodes as unknown[] || []
      } else {
        setImportError('Solo se admite formato JSON por ahora.')
        setImporting(false); return
      }
      // Import each node via store
      let count = 0
      for (const raw of nodes) {
        const n = raw as Record<string, unknown>
        if (!n.id || !n.text) continue
        // Use createNode + updateNode to import
        try {
          const existing = store.getNode(n.id as string)
          if (existing) {
            store.updateNode(n.id as string, n as Partial<typeof existing>)
          } else {
            store.createNode({ text: n.text as string, parentId: n.parentId as string | null })
          }
          count++
        } catch { /* skip invalid */ }
      }
      setImportResult(`${count} nodos importados correctamente.`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Error al importar')
    } finally { setImporting(false) }
    e.target.value = ''
  }

  return (
    <div className="st-pane">
      <SectionTitle>Importar datos</SectionTitle>
      <Row
        label="Importar desde JSON"
        hint="Sube un archivo JSON exportado desde From para importar tus notas y tareas."
      />
      <div className="st-actions">
        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
          {importing ? 'Importando...' : 'Seleccionar archivo JSON'}
          <input type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} disabled={importing} />
        </label>
      </div>
      {importResult && <div className="auth-success" style={{ marginTop: 8 }}>{importResult}</div>}
      {importError && <div className="auth-error" style={{ marginTop: 8 }}>{importError}</div>}

      <div className="st-info-box" style={{ marginTop: 16 }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>Notas sobre la importación</strong>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <li>Los nodos existentes con el mismo ID se actualizarán.</li>
          <li>Los nodos nuevos se añadirán a tu vault.</li>
          <li>Se admiten archivos exportados desde From (JSON).</li>
        </ul>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  initialTab?: Tab
}

export default function SettingsModal({ onClose, initialTab = 'cuenta' }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function renderPane() {
    switch (activeTab) {
      case 'cuenta': return <CuentaPane />
      case 'apariencia': return <AparienciaPane />
      case 'ia': return <IAPane />
      case 'atajos': return <AtajosPane />
      case 'plantillas': return <PlantillasPane />
      case 'google': return <GooglePane />
      case 'exportar': return <ExportarPane />
      case 'importar': return <ImportarPane />
    }
  }

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-window" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">Ajustes</div>
          {SECTIONS.map((section, si) => (
            <div key={si} className="settings-sidebar-section">
              {section.title && <div className="settings-sidebar-section-title">{section.title}</div>}
              {section.items.map(item => (
                <button
                  key={item.id}
                  className={`settings-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <span className="settings-sidebar-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          <div className="settings-content-header">
            <h2 className="settings-content-title">
              {SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)?.label}
            </h2>
            <button className="settings-close-btn" onClick={onClose} title="Cerrar (Esc)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="settings-content-body">
            {renderPane()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
