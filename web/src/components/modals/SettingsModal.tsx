import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n/config'
import { isICloudBackupEnabled, setICloudBackupEnabled } from '../../utils/icloudBackup'
import {
  updateMe, deleteAccount, cancelSubscription, changePlan, getBillingPortalUrl,
  clearTokens, exportNodes, getToken, getApiToken, generateApiToken,
} from '../../api/client'
import { userStore, useUserStore } from '../../store/userStore'
import { useTheme, type AccentColor } from '../../hooks/useTheme'
import { store } from '../../store/nodeStore'
import { type Shortcut, getShortcuts, saveShortcuts } from '../../hooks/useTextExpansion'
import HotkeysPane from '../settings/HotkeysPane'
import { getGoogleOAuthUrl, disconnectGoogle } from '../../api/googleCalendar'
import { downloadFullTextExport } from '../../utils/bulkTextExport'

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
  const { t } = useTranslation()
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
  const [deleteConfirm, setDeleteConfirm] = useState('')   // contraseña o email de confirmación
  const hasPassword = user?.hasPassword !== false           // por defecto asume contraseña

  // Stats — una NOTA es un nodo con hijos (no cada párrafo). Ver store.isNote.
  const nodes = store.allActive()
  const totalNotes = store.noteCount()
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
    if (newPassword !== confirmPassword) { setPasswordError(t('auth.errorPasswordsNoMatch')); return }
    setPasswordLoading(true)
    try {
      await updateMe({ currentPassword, newPassword })
      setPasswordSuccess(t('account.passwordUpdated'))
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: unknown) { setPasswordError(err instanceof Error ? err.message : 'Error') }
    finally { setPasswordLoading(false) }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault(); setEmailError(''); setEmailSuccess('')
    setEmailLoading(true)
    try {
      await updateMe({ newEmail, currentPassword: emailPassword })
      await us.fetchMe()
      setEmailSuccess(t('account.emailUpdatedSuccess'))
      setNewEmail(''); setEmailPassword('')
      setShowEmailForm(false)
    } catch (err: unknown) { setEmailError(err instanceof Error ? err.message : t('auth.errorUnknown')) }
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
    if (!confirm(t('account.cancelConfirm', '¿Seguro que quieres cancelar tu suscripción? Mantendrás el acceso hasta el final del periodo pagado.'))) return
    setSubError(''); setSubLoading(true)
    try {
      const res = await cancelSubscription()
      if (res.ok) await userStore.fetchMe()
      else if (res.billingPortalUrl) window.open(res.billingPortalUrl, '_blank')
    } catch (err: unknown) { setSubError(err instanceof Error ? err.message : 'Error') }
    finally { setSubLoading(false) }
  }

  async function handleManageBilling() {
    setSubError(''); setSubLoading(true)
    try {
      const url = await getBillingPortalUrl()
      if (url) window.open(url, '_blank')
      else setSubError(t('account.billingUnavailable', 'No hay portal de facturación disponible para esta cuenta.'))
    } catch (err: unknown) { setSubError(err instanceof Error ? err.message : 'Error') }
    finally { setSubLoading(false) }
  }

  async function handleDeleteAccount() {
    setDeleteError(''); setDeleteLoading(true)
    try {
      await deleteAccount(hasPassword ? { password: deleteConfirm } : { confirmEmail: deleteConfirm })
      clearTokens(); userStore.reset()
      navigate('/login', { replace: true })
    } catch (err: unknown) { setDeleteError(err instanceof Error ? err.message : 'Error'); setDeleteLoading(false) }
  }

  return (
    <div className="st-pane">
      {/* Stats */}
      <div className="st-stats">
        <div className="st-stat"><span className="st-stat-n">{totalNotes}</span><span>{t('account.statNotes')}</span></div>
        <div className="st-stat"><span className="st-stat-n">{totalTasks}</span><span>{t('account.statTasks')}</span></div>
        <div className="st-stat"><span className="st-stat-n">{doneTasks}</span><span>{t('account.statCompleted')}</span></div>
        <div className="st-stat"><span className="st-stat-n">{completionRate}%</span><span>{t('account.statCompletionRate')}</span></div>
        <div className="st-stat"><span className="st-stat-n">{diaryStreak}</span><span>{t('account.statStreak')}</span></div>
        <div className="st-stat"><span className="st-stat-n">{totalWords.toLocaleString()}</span><span>{t('account.statWords')}</span></div>
      </div>

      <SectionTitle>{t('account.sectionProfile')}</SectionTitle>

      {/* Cambiar email solo si la cuenta tiene contraseña: en cuentas Google/Apple
          el email es la identidad de login y cambiarlo la rompería. */}
      {hasPassword ? (
        <Row label={t('account.emailRow')} hint={user?.email ?? '—'}>
          <button className="btn-secondary" onClick={() => { setShowEmailForm(v => !v); setEmailError(''); setEmailSuccess('') }}>
            {t('account.changeEmailButton')}
          </button>
        </Row>
      ) : (
        <Row label={t('account.emailRow')} hint={user?.email ?? '—'} />
      )}
      {showEmailForm && (
        <form className="st-form" onSubmit={handleChangeEmail}>
          <div className="st-form-field"><label>{t('account.newEmailLabel')}</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('account.newEmailPlaceholder')} required /></div>
          <div className="st-form-field"><label>{t('account.currentPasswordLabel')}</label><input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} placeholder="••••••••" required /></div>
          {emailError && <div className="auth-error">{emailError}</div>}
          {emailSuccess && <div className="auth-success">{emailSuccess}</div>}
          <div className="st-form-actions">
            <button type="submit" className="btn-primary" disabled={emailLoading}>{emailLoading ? t('common.saving') : t('account.saveEmailButton')}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowEmailForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      <Row label={t('account.passwordRow')} hint="••••••••">
        <button className="btn-secondary" onClick={() => { setShowPasswordForm(v => !v); setPasswordError(''); setPasswordSuccess('') }}>
          {t('account.changeButton')}
        </button>
      </Row>
      {showPasswordForm && (
        <form className="st-form" onSubmit={handleChangePassword}>
          <div className="st-form-field"><label>{t('account.currentPasswordLabel')}</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" required /></div>
          <div className="st-form-field"><label>{t('account.newPasswordLabel')}</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={8} /></div>
          <div className="st-form-field"><label>{t('account.confirmNewPasswordLabel')}</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required /></div>
          {passwordError && <div className="auth-error">{passwordError}</div>}
          {passwordSuccess && <div className="auth-success">{passwordSuccess}</div>}
          <div className="st-form-actions">
            <button type="submit" className="btn-primary" disabled={passwordLoading}>{passwordLoading ? t('common.saving') : t('common.save')}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowPasswordForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      <SectionTitle>{t('account.sectionSubscription')}</SectionTitle>

      {(() => {
        const isLifetime  = user?.licenseStatus === 'active'
        const isActiveSub = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing'
        const isCancelled = user?.subscriptionStatus === 'cancelled' || user?.subscriptionStatus === 'expired'
        const estadoLabel = isLifetime ? t('account.planBadgeLicense', 'Licencia perpetua')
          : user?.subscriptionStatus === 'active' ? t('account.planBadgeActive', 'Suscripción activa')
          : user?.subscriptionStatus === 'trialing' ? t('account.planBadgeTrial', 'Prueba gratuita')
          : isCancelled ? t('account.planBadgeCancelled', 'Cancelada')
          : t('account.planBadgeFree', 'Plan gratuito')
        return (
          <>
            <Row label={t('account.subscriptionStatus')}>
              <span className="st-value">{estadoLabel}</span>
            </Row>
            {isActiveSub && user?.subscriptionRenewsAt && (
              <Row label={t('account.subscriptionRenewal')}>
                <span className="st-value">{new Date(user.subscriptionRenewsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </Row>
            )}
            {user?.tokensBalance !== undefined && (
              <Row label={t('account.tokensBalance')}>
                <span className="st-value">{user.tokensBalance.toLocaleString()}</span>
              </Row>
            )}
            {subError && <div className="auth-error" style={{ marginTop: 8 }}>{subError}</div>}
            <div className="st-actions">
              {/* Free → solo mejorar. Suscripción activa → cancelar + facturación.
                  Lifetime → nada que gestionar. */}
              {!isLifetime && !isActiveSub && (
                <button className="btn-primary" onClick={handleSubscribe} disabled={subLoading}>
                  {subLoading ? t('common.loading') : t('account.subscribeButton')}
                </button>
              )}
              {isActiveSub && (
                <>
                  <button className="btn-secondary btn-danger-outline" onClick={handleCancelSubscription} disabled={subLoading}>
                    {subLoading ? t('common.processing') : t('account.cancelSubscriptionButton')}
                  </button>
                  <button className="btn-secondary" onClick={handleManageBilling} disabled={subLoading}>
                    {t('account.manageBillingButton')}
                  </button>
                </>
              )}
            </div>
          </>
        )
      })()}

      <SectionTitle>{t('account.sectionPrivacy')}</SectionTitle>
      <Row label={t('account.privacyDataLabel')} hint={t('account.privacyDataHint')} />
      <Row label={t('account.privacyPolicyLabel')}>
        <a href="https://fromly.app/privacy" target="_blank" rel="noopener noreferrer" className="btn-secondary">{t('account.privacyPolicyViewButton')}</a>
      </Row>

      <SectionTitle>{t('account.sectionDangerZone')}</SectionTitle>
      <Row label={t('account.deleteAccountLabel')} hint={t('account.deleteAccountHint')}>
        <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>{t('account.deleteAccountButton')}</button>
      </Row>

      {showDeleteModal && createPortal(
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError('') }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>{t('account.deleteAccountConfirmTitle')}</h2>
            <p>{t('account.deleteAccountConfirmText')}</p>
            {/* Confirmación obligatoria: contraseña (o email exacto si es cuenta Google). */}
            <div className="st-form-field" style={{ marginTop: 12 }}>
              <label>{hasPassword
                ? t('account.deleteConfirmPasswordLabel', 'Escribe tu contraseña para confirmar')
                : t('account.deleteConfirmEmailLabel', 'Escribe tu email para confirmar')}</label>
              <input
                type={hasPassword ? 'password' : 'email'}
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={hasPassword ? '••••••••' : user?.email ?? ''}
                autoFocus
              />
            </div>
            {deleteError && <div className="auth-error" style={{ marginTop: 12 }}>{deleteError}</div>}
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading || !deleteConfirm.trim()}>{deleteLoading ? t('common.eliminating') : t('account.deleteAccountConfirmButton')}</button>
              <button className="btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError('') }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Paleta de color de acento — compartida con SettingsView (v1 embebido).
export const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: 'steel',  label: 'settingsView.colorSteel',  hex: '#3E5C76' },
  { value: 'purple', label: 'settingsView.colorPurple', hex: '#8b5cf6' },
  { value: 'indigo', label: 'settingsView.colorIndigo', hex: '#6366f1' },
  { value: 'blue',   label: 'settingsView.colorBlue',   hex: '#3b82f6' },
  { value: 'cyan',   label: 'settingsView.colorCyan',   hex: '#06b6d4' },
  { value: 'teal',   label: 'settingsView.colorTeal',   hex: '#14b8a6' },
  { value: 'green',  label: 'settingsView.colorGreen',  hex: '#22c55e' },
  { value: 'lime',   label: 'settingsView.colorLime',   hex: '#84cc16' },
  { value: 'amber',  label: 'settingsView.colorAmber',  hex: '#f59e0b' },
  { value: 'orange', label: 'settingsView.colorOrange', hex: '#f97316' },
  { value: 'red',    label: 'settingsView.colorRed',    hex: '#ef4444' },
  { value: 'rose',   label: 'settingsView.colorRose',   hex: '#f43f5e' },
  { value: 'pink',   label: 'settingsView.colorPink',   hex: '#ec4899' },
]

// Fila de color del planner — mismo patrón que SettingsView (color propio o heredado del acento).
function PlannerColorRow() {
  const { t } = useTranslation()
  const [color, setColor] = useState(() => localStorage.getItem('from_planner_color') || '')
  const accentHex = (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) || '#3E5C76'
  const current = color || accentHex
  function apply(v: string) { setColor(v); localStorage.setItem('from_planner_color', v) }
  function reset() { setColor(''); localStorage.removeItem('from_planner_color') }
  return (
    <Row label={t('settingsView.plannerColorLabel')} hint={t('settingsView.plannerColorHint')}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="color" value={current} onChange={e => apply(e.target.value)}
          style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
        {color && (
          <button onClick={reset} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {t('settingsView.useAccent')}
          </button>
        )}
      </div>
    </Row>
  )
}

export function AparienciaPane() {
  const { t } = useTranslation()
  const { theme, setTheme, accent, setAccent } = useTheme()

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

  return (
    <div className="st-pane">
      <SectionTitle>{t('appearance.sectionTheme')}</SectionTitle>
      <Row label={t('appearance.colorModeLabel')} hint={t('appearance.colorModeHint')}>
        <div className="st-segmented">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>{t('appearance.themeLight')}</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>{t('appearance.themeDark')}</button>
        </div>
      </Row>

      <SectionTitle>{t('appearance.sectionCalendar')}</SectionTitle>
      <Row label={t('appearance.dayStartLabel')} hint={t('appearance.dayStartHint')}>
        <select value={dayStart} onChange={e => applyDayStart(parseInt(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </Row>
      <Row label={t('appearance.dayEndLabel')} hint={t('appearance.dayEndHint')}>
        <select value={dayEnd} onChange={e => applyDayEnd(parseInt(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {Array.from({ length: 24 }, (_, h) => h + 1).map(h => (
            <option key={h} value={h} disabled={h <= dayStart}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </Row>

      <SectionTitle>{t('settingsView.accentColor')}</SectionTitle>
      <Row label={t('settingsView.mainColor')} hint={t('settingsView.mainColorHint')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              title={t(c.label)}
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
      </Row>
      <PlannerColorRow />
    </div>
  )
}

const ANTHROPIC_KEY_LS = 'from_anthropic_api_key'
const OPENAI_KEY_LS    = 'from_openai_api_key'
const GOOGLE_KEY_LS    = 'from_google_api_key'
const AI_LANG_LS = 'from_ai_language'

type ProviderId = 'anthropic' | 'openai' | 'google'

interface ProviderConfig {
  id: ProviderId
  label: string
  lsKey: string
  placeholder: string
  getKeyUrl: string
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', lsKey: ANTHROPIC_KEY_LS, placeholder: 'sk-ant-…',
    getKeyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai',    label: 'OpenAI (GPT)',       lsKey: OPENAI_KEY_LS,    placeholder: 'sk-…',
    getKeyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'google',    label: 'Google (Gemini)',    lsKey: GOOGLE_KEY_LS,    placeholder: 'AIza…',
    getKeyUrl: 'https://aistudio.google.com/apikey' },
]

// Editor por proveedor — extraído para evitar duplicar markup.
function ProviderKeyEditor({ provider, hasPaidPlan }: { provider: ProviderConfig; hasPaidPlan: boolean }) {
  const { t } = useTranslation()
  const us = useUserStore()
  const serverKey = (us.user?.aiApiKeys?.[provider.id] as string | undefined) ?? ''
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(provider.lsKey) || serverKey
  )
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  useEffect(() => {
    if (serverKey && !apiKey) {
      setApiKey(serverKey)
      localStorage.setItem(provider.lsKey, serverKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  async function save() {
    const trimmed = apiKey.trim()
    setKeyError(null)
    if (!hasPaidPlan && trimmed.length > 0) {
      setKeyError(t('ai.keyErrorPlan'))
      return
    }
    if (trimmed) localStorage.setItem(provider.lsKey, trimmed)
    else localStorage.removeItem(provider.lsKey)
    try {
      const existing = { ...(us.user?.aiApiKeys ?? {}) }
      if (trimmed) (existing as Record<string, string>)[provider.id] = trimmed
      else delete (existing as Record<string, string>)[provider.id]
      await updateMe({ aiApiKeys: Object.keys(existing).length ? existing : null })
      await us.fetchMe()
      setKeySaved(true)
      setTimeout(() => setKeySaved(false), 2000)
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : t('ai.keyErrorSaving'))
    }
  }

  async function clear() {
    setApiKey('')
    localStorage.removeItem(provider.lsKey)
    try {
      const existing = { ...(us.user?.aiApiKeys ?? {}) }
      delete (existing as Record<string, string>)[provider.id]
      await updateMe({ aiApiKeys: Object.keys(existing).length ? existing : null })
      await us.fetchMe()
    } catch {
      /* cache local ya limpio */
    }
  }

  return (
    <>
      <Row
        label={provider.label}
        hint={
          hasPaidPlan
            ? t('ai.apiKeyHintPaid', { provider: provider.label })
            : t('ai.apiKeyHintFree')
        }
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={hasPaidPlan ? provider.placeholder : t('ai.apiKeyUnavailablePlaceholder')}
          className="st-input"
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, opacity: hasPaidPlan ? 1 : 0.5 }}
          disabled={!hasPaidPlan}
        />
        <button className="btn-secondary" onClick={() => setShowKey(v => !v)} style={{ fontSize: 12 }} disabled={!hasPaidPlan}>
          {showKey ? t('ai.hideKeyButton') : t('ai.showKeyButton')}
        </button>
      </div>
      <div className="st-actions">
        <button className="btn-primary" onClick={save} disabled={!hasPaidPlan}>{keySaved ? t('ai.keySavedButton') : t('ai.saveKeyButton')}</button>
        {apiKey && <button className="btn-secondary btn-danger-outline" onClick={clear}>{t('ai.clearKeyButton')}</button>}
        <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12 }}>
          {t('ai.getKeyButton')}
        </a>
      </div>
      {keyError && (
        <div style={{ color: '#c33', fontSize: 12, marginTop: 6 }}>{keyError}</div>
      )}
    </>
  )
}

export function IAPane() {
  const { t } = useTranslation()
  const us = useUserStore()
  const [lang, setLang] = useState<string>(() => localStorage.getItem(AI_LANG_LS) || 'auto')

  // Las API keys propias son un extra de la licencia perpetua (lifetime).
  const isLifetime = us.user?.licenseStatus === 'active'

  function setLanguage(v: string) {
    setLang(v)
    localStorage.setItem(AI_LANG_LS, v)
  }

  return (
    <div className="st-pane">
      {/* API keys propias: solo lifetime puede usar sus propias claves. */}
      {isLifetime && (
        <>
          <SectionTitle>{t('ai.sectionApiKeys')}</SectionTitle>
          {PROVIDERS.map(p => (
            <ProviderKeyEditor key={p.id} provider={p} hasPaidPlan={isLifetime} />
          ))}
        </>
      )}

      <SectionTitle>{t('ai.sectionIncludedTokens')}</SectionTitle>
      {us.user?.tokensBalance !== undefined ? (
        <Row label={t('ai.tokensBalanceLabel')}>
          <span className="st-value">{us.user.tokensBalance.toLocaleString()}</span>
        </Row>
      ) : (
        <Row label={t('ai.tokensBalanceLabel')} hint={t('ai.tokensBalanceLoginHint')} />
      )}
      <Row label={t('ai.tokensExplanationLabel')} hint={t('ai.tokensExplanationHint')} />

      <SectionTitle>{t('ai.sectionLanguage')}</SectionTitle>
      <Row
        label={t('ai.languageLabel')}
        hint={t('ai.languageHint')}
      >
        <div className="st-segmented">
          <button className={lang === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>{t('ai.languageSpanish')}</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>{t('ai.languageEnglish')}</button>
          <button className={lang === 'auto' ? 'active' : ''} onClick={() => setLanguage('auto')}>{t('ai.languageAuto')}</button>
        </div>
      </Row>
    </div>
  )
}

// La conexión con Claude (MCP) vive solo en la tarjeta "Claude" de CapturaRapidaPane
// (más abajo) — enlaza a fromly.app/claude, que ya explica pasos + URL + Claude Code.
// (Antes había un ClaudeMcpPane duplicado con su propia UI de pasos; eliminado.)

const APPLE_SHORTCUT_ICLOUD = 'https://www.icloud.com/shortcuts/d77a969efecf414bbb44a8e9bb05f52f'

const isTauriDesktop = import.meta.env.VITE_TAURI === 'true'

export function CapturaRapidaPane() {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [trayVisible, setTrayVisible] = useState(localStorage.getItem('from_tray_visible') !== 'false')
  const [icloud, setIcloud] = useState(isICloudBackupEnabled())

  function toggleICloud(on: boolean) {
    setIcloud(on)
    setICloudBackupEnabled(on)
  }

  function toggleTray(visible: boolean) {
    setTrayVisible(visible)
    localStorage.setItem('from_tray_visible', visible ? 'true' : 'false')
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_tray_visible', { visible }).catch(() => {})
    }).catch(() => {})
  }

  useEffect(() => {
    if (!getToken()) { setLoaded(true); return }
    getApiToken().then(d => { setToken(d.token); setLoaded(true) }).catch(() => setLoaded(true))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try { const r = await generateApiToken(); setToken(r.token) }
    catch (e) { console.error(e) }
    finally { setGenerating(false) }
  }

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value).catch(() => {})
    setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
  }

  const codeBox: React.CSSProperties = {
    flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6,
    fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    border: '1px solid var(--border)',
  }

  return (
    <div className="st-pane">
      {/* Token de API — uno para todo (Raycast, Chrome, Claude Code) */}
      <SectionTitle>{t('settingsModal.apiTokenTitle')}</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        {t('settingsModal.apiTokenHint')}
      </div>
      {loaded ? (
        token ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={codeBox}>{'•'.repeat(40)}</code>
            <button className="btn-secondary" onClick={() => copy(token, 'token')} style={{ flexShrink: 0, fontSize: 12 }}>
              {copied === 'token' ? t('common.copied') : t('common.copy')}
            </button>
            <button onClick={handleGenerate} disabled={generating} title={t('settingsModal.generateNew')} style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: '0 4px', border: 'none' }}>
              {generating ? '…' : t('common.regenerate')}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? t('common.generating') : t('settingsModal.generateApiToken')}
          </button>
        )
      ) : <div className="st-row-hint">{t('common.loading')}</div>}

      {/* Barra de menús — solo en Mac */}
      {isTauriDesktop && (
        <>
          <SectionTitle>{t('settingsModal.menuBarTitle')}</SectionTitle>
          <div className="st-row-hint" style={{ marginBottom: 10 }}>
            {t('settingsModal.menuBarHintPre')} <strong style={{ color: 'var(--text)' }}>{t('settingsModal.quickCapture')}</strong>{t('settingsModal.menuBarHintPost')}
          </div>
          <Row label={t('settingsModal.showTrayIcon')} hint={t('settingsModal.showTrayIconHint')}>
            <input type="checkbox" checked={trayVisible} onChange={e => toggleTray(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </Row>

          <SectionTitle>{t('settingsModal.icloudBackupTitle')}</SectionTitle>
          <Row label={t('settingsModal.icloudAutoCopy')} hint={t('settingsModal.icloudAutoCopyHint')}>
            <input type="checkbox" checked={icloud} onChange={e => toggleICloud(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </Row>
        </>
      )}

      {/* Atajo de Apple */}
      <SectionTitle>{t('settingsModal.appleShortcutTitle')}</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        {t('settingsModal.appleShortcutHint')}
      </div>
      <a href={APPLE_SHORTCUT_ICLOUD} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ fontSize: 12, display: 'inline-flex' }}>
        {t('settingsModal.installAppleShortcut')}
      </a>

      {/* Raycast */}
      <SectionTitle>Raycast</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        {t('settingsModal.raycastHint')}
      </div>
      <a href="https://fromly.app/accesorios" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex' }}>
        {t('settingsModal.installRaycast')}
      </a>

      {/* Chrome */}
      <SectionTitle>Chrome</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        {t('settingsModal.chromeHint')}
      </div>
      <a href="https://fromly.app/accesorios" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex' }}>
        {t('settingsModal.installChrome')}
      </a>

      {/* Claude (MCP) */}
      <SectionTitle>Claude</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        {t('settingsModal.claudeHintPre')} <strong style={{ color: 'var(--text)' }}>{t('settingsModal.claudeHintBold')}</strong>{t('settingsModal.claudeHintPost')}
      </div>
      <a href="https://fromly.app/claude" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex' }}>
        {t('settingsModal.connectClaude')}
      </a>
    </div>
  )
}

export function AtajosPane() {
  // ── Hotkeys configurables ────────────────────────────────────────────────
  // Renderizado por el componente separado HotkeysPane
  return (
    <div className="st-pane">
      <HotkeysPane />
      <div style={{ marginTop: 32 }}>
        <AtajosPaneTextExpansion />
      </div>
    </div>
  )
}

function AtajosPaneTextExpansion() {
  const { t } = useTranslation()
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

  return (
    <>
      <SectionTitle>{t('shortcuts.sectionTextExpansion')}</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 12 }}>
        {t('shortcuts.textExpansionHint')} Ej: <code>;firma</code> → <em>Un saludo, Alberto</em>
      </div>

      {shortcuts.length > 0 && (
        <table className="st-table">
          <thead>
            <tr><th>{t('shortcuts.triggerColumn')}</th><th>{t('shortcuts.expansionColumn')}</th><th /></tr>
          </thead>
          <tbody>
            {shortcuts.map(sc => (
              <tr key={sc.id}>
                <td><code className="st-code">{sc.trigger}</code></td>
                <td style={{ color: 'var(--text-secondary)' }}>{sc.expansion}</td>
                <td>
                  <button onClick={() => handleDelete(sc.id)} className="st-delete-btn" title={t('shortcuts.deleteTitle')}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd ? (
        <div className="st-add-form">
          <input type="text" placeholder={t('shortcuts.triggerPlaceholder')} value={newTrigger} onChange={e => setNewTrigger(e.target.value)} className="st-input" style={{ width: 130 }} />
          <input type="text" placeholder={t('shortcuts.expansionPlaceholder')} value={newExpansion} onChange={e => setNewExpansion(e.target.value)} className="st-input" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn-primary" onClick={handleAdd} style={{ fontSize: 13 }}>{t('shortcuts.saveButton')}</button>
          <button className="btn-secondary" onClick={() => setShowAdd(false)} style={{ fontSize: 13 }}>{t('common.cancel')}</button>
        </div>
      ) : (
        <div className="st-actions"><button className="btn-secondary" onClick={() => setShowAdd(true)}>{t('shortcuts.addShortcutButton')}</button></div>
      )}

    </>
  )
}

// La gestión de plantillas vive en V2TemplatesModal (v2/components/V2TemplatesModal.tsx,
// crear/editar/eliminar completo) — accesible desde "Gestionar plantillas" en el
// composer del chat. El PlantillasPane que había aquí duplicaba esa función.

export function GooglePane() {
  const { t } = useTranslation()
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
      setError(err instanceof Error ? err.message : t('google.disconnectError'))
    } finally {
      setDisconnecting(false)
    }
  }

  function handleConnect() {
    window.location.href = getGoogleOAuthUrl()
  }

  return (
    <div className="st-pane">
      <SectionTitle>{t('google.sectionTitle')}</SectionTitle>

      <Row
        label={t('google.connectionStatusLabel')}
        hint={t('google.connectionStatusHint')}
      >
        {us.googleConnected ? (
          <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#22c55e', whiteSpace: 'nowrap' }}>
            {t('google.connected')}
          </span>
        ) : (
          <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {t('google.notConnected')}
          </span>
        )}
      </Row>

      {us.googleConnected && us.googleEmail && (
        <Row label={t('google.accountLabel')}>
          <span className="st-value" style={{ fontSize: 12 }}>{us.googleEmail}</span>
        </Row>
      )}

      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="st-actions">
        {us.googleConnected ? (
          <button className="btn-secondary btn-danger-outline" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? t('google.disconnecting') : t('google.disconnectButton')}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleConnect}>
            {t('google.connectButton')}
          </button>
        )}
      </div>

      <SectionTitle>{t('google.sectionCalendar')}</SectionTitle>
      <Row
        label={t('google.calendarSyncLabel')}
        hint={t('google.calendarSyncHint')}
      />
      {/* La sección de Google Drive se mostrará cuando el adjuntar-archivos esté
          implementado (requiere re-añadir el scope drive.file tras verificar Calendar). */}
    </div>
  )
}

export function ExportarPane() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [textsLoading, setTextsLoading] = useState(false)
  const [textsCount, setTextsCount] = useState<number | null>(null)

  function handleExportTexts() {
    setTextsLoading(true); setTextsCount(null)
    try {
      // Trabajo síncrono pesado (recorre TODO el árbol) — dar un frame al loading antes.
      setTimeout(() => {
        try {
          const count = downloadFullTextExport()
          setTextsCount(count)
        } finally { setTextsLoading(false) }
      }, 30)
    } catch { setTextsLoading(false) }
  }

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
    } catch (err: unknown) { setError(err instanceof Error ? err.message : t('export.exportError')) }
    finally { setLoading(false) }
  }

  return (
    <div className="st-pane">
      <SectionTitle>{t('export.sectionTitle')}</SectionTitle>
      <Row label={t('export.serverBackupLabel')} hint={t('export.serverBackupHint')} />
      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="st-actions">
        <button className="btn-secondary" onClick={() => handleExport('json')} disabled={loading}>
          {loading ? t('common.exporting') : t('export.jsonServerButton')}
        </button>
        <button className="btn-secondary" onClick={() => handleExport('markdown')} disabled={loading}>
          {loading ? t('common.exporting') : t('export.markdownServerButton')}
        </button>
      </div>

      <SectionTitle>{t('export.textsOnlyTitle')}</SectionTitle>
      <Row label={t('export.textsOnlyLabel')} hint={t('export.textsOnlyHint')} />
      {textsCount != null && <div style={{ fontSize: 12.5, color: 'var(--accent,#6c5ce7)', marginTop: 6 }}>{t('export.textsOnlyDone', { count: textsCount })}</div>}
      <div className="st-actions">
        <button className="btn-secondary" onClick={handleExportTexts} disabled={textsLoading}>
          {textsLoading ? t('common.exporting') : t('export.textsOnlyButton')}
        </button>
      </div>
    </div>
  )
}

type ImportSource = 'obsidian' | 'notion' | 'apple' | 'markdown' | 'from'

const IMPORT_SOURCES: { id: ImportSource; nameKey: string; descKey: string }[] = [
  { id: 'obsidian', nameKey: 'import.sourceObsidianName',  descKey: 'import.sourceObsidianDesc' },
  { id: 'notion',   nameKey: 'import.sourceNotionName',    descKey: 'import.sourceNotionDesc' },
  { id: 'apple',    nameKey: 'import.sourceAppleName',     descKey: 'import.sourceAppleDesc' },
  { id: 'markdown', nameKey: 'import.sourceMarkdownName',  descKey: 'import.sourceMarkdownDesc' },
  { id: 'from',     nameKey: 'import.sourceFromName',      descKey: 'import.sourceFromDesc' },
]

const IMPORT_STEPS: Record<ImportSource, string[]> = {
  obsidian: ['import.stepObsidian1', 'import.stepObsidian2'],
  notion:   ['import.stepNotion1', 'import.stepNotion2', 'import.stepNotion3'],
  apple:    ['import.stepApple1', 'import.stepApple2', 'import.stepApple3'],
  markdown: ['import.stepMarkdown1'],
  from:     ['import.stepFrom1'],
}

export function ImportarPane() {
  const { t } = useTranslation()
  const [source, setSource] = useState<ImportSource | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Fromly (JSON) ──────────────────────────────────────────────────────────
  async function handleJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setResult(null); setError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const nodes: unknown[] = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>).nodes as unknown[] || []
      let count = 0
      for (const raw of nodes) {
        const n = raw as Record<string, unknown>
        if (!n.id || !n.text) continue
        try {
          const existing = store.getNode(n.id as string)
          if (existing) store.updateNode(n.id as string, n as Partial<typeof existing>)
          else store.createNode({ text: n.text as string, parentId: n.parentId as string | null })
          count++
        } catch { /* skip */ }
      }
      setResult(t('import.importSuccess', { count }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.importError'))
    } finally { setImporting(false); e.target.value = '' }
  }

  // ── Markdown / Obsidian / Notion / Apple ───────────────────────────────────
  async function handleMarkdown(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(e.target.files || [])
    if (!fileList.length) return
    setImporting(true); setResult(null); setError(null)
    try {
      const files = await Promise.all(fileList.map(async f => ({
        path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        content: await f.text(),
      })))
      const { importMarkdownFiles } = await import('../../utils/importMarkdown')
      const r = await importMarkdownFiles(files)
      if (r.notes === 0) setError(t('import.noValidFiles'))
      else setResult(t('import.importedNotes', { count: r.notes }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.importError'))
    } finally { setImporting(false); e.target.value = '' }
  }

  // ── Lista de fuentes ───────────────────────────────────────────────────────
  if (!source) {
    return (
      <div className="st-pane">
        <SectionTitle>{t('import.importFrom')}</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {IMPORT_SOURCES.map(s => (
            <button
              key={s.id}
              onClick={() => { setSource(s.id); setResult(null); setError(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            >
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t(s.nameKey)}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{t(s.descKey)}</span>
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>→</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Asistente de la fuente elegida ─────────────────────────────────────────
  const meta = IMPORT_SOURCES.find(s => s.id === source)!
  const isFolderSource = source === 'obsidian' || source === 'notion'
  const isJson = source === 'from'

  return (
    <div className="st-pane">
      <button onClick={() => { setSource(null); setResult(null); setError(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0 8px' }}>
        ← {t('import.allSources')}
      </button>
      <SectionTitle>{t(meta.nameKey)}</SectionTitle>

      <ol style={{ margin: '4px 0 14px', paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: 13 }}>
        {IMPORT_STEPS[source].map((step, i) => <li key={i}>{t(step)}</li>)}
      </ol>

      <div className="st-actions">
        {isJson ? (
          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            {importing ? t('common.importing') : t('import.uploadJsonFile')}
            <input type="file" accept=".json" onChange={handleJson} style={{ display: 'none' }} disabled={importing} />
          </label>
        ) : (
          <>
            {isFolderSource && (
              <label className="btn-primary" style={{ cursor: 'pointer' }}>
                {importing ? t('common.importing') : t('import.uploadFolder')}
                <input
                  type="file"
                  multiple
                  ref={el => { if (el) el.setAttribute('webkitdirectory', '') }}
                  onChange={handleMarkdown}
                  style={{ display: 'none' }}
                  disabled={importing}
                />
              </label>
            )}
            <label className={isFolderSource ? 'btn-secondary' : 'btn-primary'} style={{ cursor: 'pointer' }}>
              {importing ? t('common.importing') : t('import.uploadFiles')}
              <input type="file" multiple accept=".md,.markdown,.txt" onChange={handleMarkdown} style={{ display: 'none' }} disabled={importing} />
            </label>
          </>
        )}
      </div>

      {result && <div className="auth-success" style={{ marginTop: 10 }}>{result}</div>}
      {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

      <div className="st-row-hint" style={{ marginTop: 14, fontSize: 11.5 }}>
        {t('import.footerHint')}
      </div>
    </div>
  )
}

function formatBackupAge(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return i18n.t('settingsView.ageJustNow')
  if (m < 60) return i18n.t('settingsView.ageMinutes', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.t('settingsView.ageHours', { n: h })
  const d = Math.floor(h / 24)
  return i18n.t('settingsView.ageDays', { n: d })
}

export function BackupsPane() {
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
      setInfo(t('settingsView.snapshotCreated', { n: r.nodeCount }))
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setCreating(false)
      setTimeout(() => setInfo(null), 3000)
    }
  }

  async function handleRestore(id: string, createdAt: string) {
    if (!confirm(t('settingsView.confirmRestore', { date: new Date(createdAt).toLocaleString('es-ES') }))) return
    setBusyId(id); setError(null); setInfo(null)
    try {
      const { restoreBackup } = await import('../../api/backups')
      const r = await restoreBackup(id)
      setInfo(t('settingsView.restored', { n: r.restoredCount }))
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('settingsView.confirmDeleteSnapshot'))) return
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
    <div className="st-pane">
      <SectionTitle>{t('settingsView.snapshots')}</SectionTitle>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
        {t('settingsView.snapshotsIntro')}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16 }}>
        <button className="btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
          {creating ? t('settingsView.creating') : t('settingsView.createSnapshotNow')}
        </button>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      {info && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 8 }}>{info}</div>}
      {loading ? (
        <div style={{ opacity: 0.6, fontSize: 13 }}>{t('common.loading')}</div>
      ) : snapshots.length === 0 ? (
        <div style={{ opacity: 0.6, fontSize: 13 }}>{t('settingsView.noSnapshots')}</div>
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
                    {formatBackupAge(s.createdAt)} · {s.source}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{t('settingsView.nodesCount', { n: s.nodeCount })}</div>
              </div>
              <button
                className="btn-secondary btn-sm"
                disabled={busyId === s.id}
                onClick={() => handleRestore(s.id, s.createdAt)}
                title={t('settingsView.restoreSnapshot')}
              >
                {t('settingsView.restore')}
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={busyId === s.id}
                onClick={() => handleDelete(s.id)}
                style={{ opacity: 0.6 }}
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
