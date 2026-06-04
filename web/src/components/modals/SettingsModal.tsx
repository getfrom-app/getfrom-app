import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../settings/LanguageSelector'
import {
  updateMe, deleteAccount, cancelSubscription, changePlan,
  clearTokens, exportNodes, getToken, getApiToken, generateApiToken,
} from '../../api/client'
import { userStore, useUserStore } from '../../store/userStore'
import { useTheme } from '../../hooks/useTheme'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { type Shortcut, getShortcuts, saveShortcuts } from '../../hooks/useTextExpansion'
import HotkeysPane from '../settings/HotkeysPane'
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

type Tab = 'cuenta' | 'apariencia' | 'ia' | 'magic' | 'estadisticas'
  | 'atajos' | 'plantillas' | 'google' | 'mcp'
  | 'tags' | 'estados' | 'voz' | 'agentes' | 'timeline' | 'prompts'
  | 'backups' | 'exportar' | 'importar' | 'idioma'

interface Section { id: Tab; label: string; icon: string }

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
      setPasswordSuccess(t('account.passwordUpdated'))
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
      setEmailSuccess(t('account.emailUpdated')); setNewEmail(''); setEmailPassword(''); setShowEmailForm(false)
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
    if (user?.licenseStatus === 'active') return <span className="plan-badge plan-badge--license">{t('account.planBadgeLicense')}</span>
    if (user?.subscriptionStatus === 'active') return <span className="plan-badge plan-badge--active">{t('account.planBadgeActive')}</span>
    if (user?.subscriptionStatus === 'trialing') return <span className="plan-badge plan-badge--active">{t('account.planBadgeTrial')}</span>
    if (user?.subscriptionStatus === 'cancelled' || user?.subscriptionStatus === 'expired') return <span className="plan-badge plan-badge--cancelled">{t('account.planBadgeCancelled')}</span>
    return <span className="plan-badge plan-badge--free">{t('account.planBadgeFree')}</span>
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

      <Row label={t('account.emailRow')} hint={user?.email ?? '—'}>
        <button className="btn-secondary" onClick={() => { setShowEmailForm(v => !v); setEmailError(''); setEmailSuccess('') }}>
          {t('account.changeButton')}
        </button>
      </Row>
      {showEmailForm && (
        <form className="st-form" onSubmit={handleChangeEmail}>
          <div className="st-form-field"><label>{t('account.newEmailLabel')}</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('account.newEmailPlaceholder')} required /></div>
          <div className="st-form-field"><label>{t('account.currentPasswordLabel')}</label><input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} placeholder="••••••••" required /></div>
          {emailError && <div className="auth-error">{emailError}</div>}
          {emailSuccess && <div className="auth-success">{emailSuccess}</div>}
          <div className="st-form-actions">
            <button type="submit" className="btn-primary" disabled={emailLoading}>{emailLoading ? t('common.saving') : t('common.save')}</button>
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

      <Row label={t('account.subscriptionStatus')}>{getPlanBadge()}</Row>
      {user?.subscriptionStatus === 'active' && user.subscriptionRenewsAt && (
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
        {user?.subscriptionStatus !== 'active' && user?.licenseStatus !== 'active' && (
          <button className="btn-primary" onClick={handleSubscribe} disabled={subLoading}>
            {subLoading ? t('common.loading') : t('account.subscribeButton')}
          </button>
        )}
        {user?.subscriptionStatus === 'active' && (
          <button className="btn-secondary btn-danger-outline" onClick={handleCancelSubscription} disabled={subLoading}>
            {subLoading ? t('common.processing') : t('account.cancelSubscriptionButton')}
          </button>
        )}
        <a href="https://app.lemonsqueezy.com/billing" target="_blank" rel="noopener noreferrer" className="btn-secondary">
          {t('account.manageBillingButton')}
        </a>
      </div>

      <SectionTitle>{t('account.sectionPrivacy')}</SectionTitle>
      <Row label={t('account.privacyDataLabel')} hint={t('account.privacyDataHint')} />
      <Row label={t('account.privacyPolicyLabel')}>
        <a href="https://getfrom.app/privacy" target="_blank" rel="noopener noreferrer" className="btn-secondary">{t('account.privacyPolicyViewButton')}</a>
      </Row>

      <SectionTitle>{t('account.sectionDangerZone')}</SectionTitle>
      <Row label={t('account.deleteAccountLabel')} hint={t('account.deleteAccountHint')}>
        <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>{t('account.deleteAccountButton')}</button>
      </Row>

      {showDeleteModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>{t('account.deleteAccountConfirmTitle')}</h2>
            <p>{t('account.deleteAccountConfirmText')}</p>
            {deleteError && <div className="auth-error" style={{ marginTop: 12 }}>{deleteError}</div>}
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>{deleteLoading ? t('common.eliminating') : t('account.deleteAccountConfirmButton')}</button>
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function AparienciaPane() {
  const { t } = useTranslation()
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
      <SectionTitle>{t('appearance.sectionTheme')}</SectionTitle>
      <Row label={t('appearance.colorModeLabel')} hint={t('appearance.colorModeHint')}>
        <div className="st-segmented">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>{t('appearance.themeLight')}</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>{t('appearance.themeDark')}</button>
        </div>
      </Row>

      <SectionTitle>{t('appearance.sectionTypography')}</SectionTitle>
      <Row label={t('appearance.fontSizeLabel')} hint={t('appearance.fontSizeHint')}>
        <div className="st-segmented">
          <button className={fontSize === 'small' ? 'active' : ''} onClick={() => applyFontSize('small')}>{t('appearance.fontSizeSmall')}</button>
          <button className={fontSize === 'normal' ? 'active' : ''} onClick={() => applyFontSize('normal')}>{t('appearance.fontSizeNormal')}</button>
          <button className={fontSize === 'large' ? 'active' : ''} onClick={() => applyFontSize('large')}>{t('appearance.fontSizeLarge')}</button>
        </div>
      </Row>
      <Row label={t('appearance.lineHeightLabel')} hint={t('appearance.lineHeightHint')}>
        <div className="st-segmented">
          <button className={lineHeight === 'compact' ? 'active' : ''} onClick={() => applyLineHeight('compact')}>{t('appearance.lineHeightCompact')}</button>
          <button className={lineHeight === 'normal' ? 'active' : ''} onClick={() => applyLineHeight('normal')}>{t('appearance.lineHeightNormal')}</button>
          <button className={lineHeight === 'relaxed' ? 'active' : ''} onClick={() => applyLineHeight('relaxed')}>{t('appearance.lineHeightRelaxed')}</button>
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
        <button className="btn-secondary" onClick={() => setShowKey(v => !v)} style={{ fontSize: 12 }} title={showKey ? t('ai.hideKeyButton') : t('ai.showKeyButton')} disabled={!hasPaidPlan}>
          {showKey ? '🙈' : '👁'}
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
  const [lang, setLang] = useState<string>(() => localStorage.getItem(AI_LANG_LS) || 'es')

  const hasPaidPlan =
    us.user?.licenseStatus === 'active' ||
    us.user?.subscriptionStatus === 'active' ||
    us.user?.subscriptionStatus === 'trialing'

  function setLanguage(v: string) {
    setLang(v)
    localStorage.setItem(AI_LANG_LS, v)
  }

  return (
    <div className="st-pane">
      <SectionTitle>{t('ai.sectionProvider')}</SectionTitle>
      <Row
        label={t('ai.defaultModelLabel')}
        hint={t('ai.defaultModelHint')}
      >
        <span className="st-value">{t('ai.defaultModelValue')}</span>
      </Row>

      <SectionTitle>{t('ai.sectionApiKeys')}</SectionTitle>
      {PROVIDERS.map(p => (
        <ProviderKeyEditor key={p.id} provider={p} hasPaidPlan={hasPaidPlan} />
      ))}

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

const CLAUDE_CUSTOM_INSTRUCTIONS = `Tienes acceso a From, mi segundo cerebro, vía MCP. Úsalo de forma proactiva y automática.

ARQUITECTURA DE FROM (crítico):
From es un árbol de nodos. No existe body. Todo el contenido son nodos hijos.
HEADINGS Y BULLETS AL MISMO NIVEL — nunca anidar bullets bajo un heading.
Correcto: [{heading:2,text:"Sección"},{text:"bullet 1"},{text:"bullet 2"},{heading:2,text:"Otra sección"}]
Incorrecto: [{heading:2,text:"Sección",children:[{text:"bullet 1"}]}]

INICIO DE CONVERSACIÓN:
- Si menciono un área (La Isla, inversión, piloto, coding, From...), llama a from_get_context("nombre-kebab").
- Llama a from_get_today_note() y guarda el ID.
- Busca sesión existente: from_search("Sesión " + fecha). Si existe, guarda su ID y transcriptId.

DURANTE LA CONVERSACIÓN (automático):
- Análisis o documento → from_create_tree con lista FLAT de headings y bullets + transcript.
- Tarea → from_create_node(isTask:true, parentId=ID_DIARIO).
- No pidas permiso. Confírmame en una línea qué guardaste.

AL TERMINAR ("fin"):
- PRIMERA VEZ: from_create_tree(text="Sesión FECHA — TEMA", parentId=ID_DIARIO, children=[{heading:2,text:"Resumen"},{text:"punto 1"},{text:"punto 2"},{heading:2,text:"Decisiones"},{text:"..."}], transcript="conversación íntegra").
- CONTINUACIÓN: from_update_session(sessionId=ID_SESION, transcriptId=ID_TRANSCRIPCION, appendTranscript="texto nuevo", newChildren=[{heading:2,text:"Actualización FECHA"},{text:"..."}]).
- Si hay info nueva del área → from_update_context(contexto, info).
- Confirma: "Guardado en From (cuenta: X) — [título sesión]".`

export function ClaudeMcpPane() {
  const { t } = useTranslation()
  const [mcpToken, setMcpToken] = useState<string | null>(null)
  const [mcpCopied, setMcpCopied] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [generatingMcp, setGeneratingMcp] = useState(false)
  const [mcpLoaded, setMcpLoaded] = useState(false)

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

  function copyPrompt() {
    navigator.clipboard.writeText(CLAUDE_CUSTOM_INSTRUCTIONS).catch(() => {})
    setPromptCopied(true); setTimeout(() => setPromptCopied(false), 3000)
  }

  return (
    <div className="st-pane">

      {/* Paso 1: Descargar extensión */}
      <SectionTitle>Paso 1 — Instala la extensión en Claude Desktop</SectionTitle>
      <Row label="From.dxt" hint="Descarga e instala haciendo doble clic. Claude Desktop te pedirá el token.">
        <a href="https://getfrom.app/From.dxt" download className="btn-primary" style={{ fontSize: 12 }}>
          ↓ Descargar From.dxt
        </a>
      </Row>

      {/* Paso 2: Token */}
      <SectionTitle>Paso 2 — Tu token de API</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Genera tu token y pégalo en Claude Desktop cuando te lo pida al instalar la extensión.
      </div>
      {mcpLoaded ? (
        mcpToken ? (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
                {mcpToken}
              </code>
              <button className="btn-secondary" onClick={copyMcpToken} style={{ flexShrink: 0, fontSize: 12 }}>
                {mcpCopied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <button onClick={handleGenerateMcpToken} disabled={generatingMcp} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: 0, border: 'none' }}>
              {generatingMcp ? 'Regenerando...' : 'Regenerar token'}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleGenerateMcpToken} disabled={generatingMcp}>
            {generatingMcp ? 'Generando...' : 'Generar token de API'}
          </button>
        )
      ) : <div className="st-row-hint">Cargando...</div>}

      {/* Paso 3: Custom Instructions — solo si hay token */}
      {mcpToken && <>
        <SectionTitle>Paso 3 — Activa el guardado automático</SectionTitle>
        <div className="st-row-hint" style={{ marginBottom: 10 }}>
          Copia el bloque y pégalo en <strong style={{ color: 'var(--text)' }}>Claude Desktop → Ajustes → Perfil → Instrucciones personalizadas</strong>. Solo hay que hacerlo una vez.
        </div>
        <pre style={{ margin: '0 0 8px', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 130, overflow: 'hidden', maskImage: 'linear-height(to bottom, black 60%, transparent 100%)' }}>
          {CLAUDE_CUSTOM_INSTRUCTIONS}
        </pre>
        <button className="btn-primary" onClick={copyPrompt} style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
          {promptCopied ? '✓ Copiado — pégalo en Claude Desktop → Ajustes → Perfil' : 'Copiar instrucciones'}
        </button>
      </>}

      {/* Más info */}
      <div style={{ marginTop: 20 }}>
        <a href="https://getfrom.app/claude" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
          Ver documentación completa →
        </a>
      </div>
    </div>
  )
}

const RAYCAST_API_BASE = 'https://from-server-production.up.railway.app'
const APPLE_SHORTCUT_URL = 'from://capture?text=[Texto]&silent=1'

export function CapturaRapidaPane() {
  const [token, setToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

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
      {/* Barra de menús */}
      <SectionTitle>Barra de menús</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        From vive en la barra de menús del Mac con el icono <strong style={{ color: 'var(--text)' }}>⚡</strong>.
        Haz clic en él (o elige <strong style={{ color: 'var(--text)' }}>Captura rápida</strong>) para abrir
        una ventana flotante y crear una nota, tarea o evento al vuelo — sin cambiar de app.
        Cerrar la ventana principal no cierra From: sigue disponible en la barra de menús.
      </div>

      {/* Atajo de Apple */}
      <SectionTitle>Atajo de Apple — tecla global</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Crea un Atajo (app Atajos de macOS) con la acción <strong style={{ color: 'var(--text)' }}>«Abrir URL»</strong>
        usando la URL de abajo, y asígnale la tecla global que quieras desde
        <strong style={{ color: 'var(--text)' }}> Atajos → Ajustes del atajo → Tecla rápida</strong>.
        Con <code>silent=1</code> el texto se guarda directamente en tu nota de hoy, sin abrir nada.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <code style={codeBox}>{APPLE_SHORTCUT_URL}</code>
        <button className="btn-secondary" onClick={() => copy(APPLE_SHORTCUT_URL, 'shortcut')} style={{ flexShrink: 0, fontSize: 12 }}>
          {copied === 'shortcut' ? '✓ Copiado' : 'Copiar URL'}
        </button>
      </div>
      <div className="st-row-hint">
        Sustituye <code>[Texto]</code> por una acción de «Pedir texto» o «Texto del Portapapeles».
        Quita <code>&amp;silent=1</code> si prefieres revisar antes de guardar.
      </div>

      {/* Raycast */}
      <SectionTitle>Raycast</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Instala la extensión <strong style={{ color: 'var(--text)' }}>From</strong> desde la Raycast Store y pega
        tu token de API en sus preferencias. Podrás crear, buscar y abrir tu nota de hoy desde Raycast.
      </div>
      <div className="st-row-hint" style={{ marginBottom: 6 }}>Servidor (URL base):</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <code style={codeBox}>{RAYCAST_API_BASE}</code>
        <button className="btn-secondary" onClick={() => copy(RAYCAST_API_BASE, 'base')} style={{ flexShrink: 0, fontSize: 12 }}>
          {copied === 'base' ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="st-row-hint" style={{ marginBottom: 6 }}>Tu token de API (válido 1 año):</div>
      {loaded ? (
        token ? (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <code style={codeBox}>{token}</code>
              <button className="btn-secondary" onClick={() => copy(token, 'token')} style={{ flexShrink: 0, fontSize: 12 }}>
                {copied === 'token' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <button onClick={handleGenerate} disabled={generating} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: 0, border: 'none' }}>
              {generating ? 'Regenerando...' : 'Regenerar token'}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando...' : 'Generar token de API'}
          </button>
        )
      ) : <div className="st-row-hint">Cargando...</div>}

      <div className="st-row-hint" style={{ marginTop: 12, fontSize: 11 }}>
        El mismo token sirve para Raycast y para la extensión de Claude (MCP). Regenerarlo invalida el anterior.
      </div>
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

export function PlantillasPane() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<CustomTemplate[]>(getTemplates)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const templ: CustomTemplate = { id: Date.now().toString(), name: name.trim(), body: body.trim() }
    const updated = [...templates, templ]
    saveTemplates(updated); setTemplates(updated)
    setName(''); setBody('')
  }

  function handleDelete(id: string) {
    const updated = templates.filter(templ => templ.id !== id)
    saveTemplates(updated); setTemplates(updated)
  }

  return (
    <div className="st-pane">
      <SectionTitle>{t('templates.sectionTitle')}</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 12 }}>
        {t('templates.hint')}
      </div>

      {templates.length > 0 && (
        <table className="st-table">
          <thead>
            <tr><th>{t('templates.nameColumn')}</th><th>{t('templates.contentColumn')}</th><th /></tr>
          </thead>
          <tbody>
            {templates.map(templ => (
              <tr key={templ.id}>
                <td style={{ fontWeight: 500 }}>{templ.name}</td>
                <td style={{ color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {templ.body ? templ.body.slice(0, 50) + (templ.body.length > 50 ? '…' : '') : <em>{t('templates.noContent')}</em>}
                </td>
                <td><button onClick={() => handleDelete(templ.id)} className="st-delete-btn" title={t('templates.deleteTitle')}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="st-template-form">
        <input type="text" placeholder={t('templates.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} className="st-input" />
        <textarea placeholder={t('templates.contentPlaceholder')} value={body} onChange={e => setBody(e.target.value)} rows={4} className="st-input" style={{ resize: 'vertical' }} />
        <div className="st-actions">
          <button className="btn-primary" onClick={handleAdd}>{t('templates.addButton')}</button>
        </div>
      </div>
    </div>
  )
}

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

      <SectionTitle>{t('google.sectionDrive')}</SectionTitle>
      <Row
        label={t('google.driveAccessLabel')}
        hint={t('google.driveAccessHint')}
      />
    </div>
  )
}

export function ExportarPane() {
  const { t } = useTranslation()
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
    } catch (err: unknown) { setError(err instanceof Error ? err.message : t('export.exportError')) }
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
        const result = [`${indent}${prefix}${node.text || t('common.noTitle')}`]
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

      <SectionTitle>{t('export.sectionLocal')}</SectionTitle>
      <Row label={t('export.localDataLabel')} hint={t('export.localDataHint')} />
      <div className="st-actions">
        <button className="btn-secondary" onClick={() => handleExportLocal('json')}>{t('export.jsonLocalButton')}</button>
        <button className="btn-secondary" onClick={() => handleExportLocal('markdown')}>{t('export.markdownLocalButton')}</button>
      </div>
    </div>
  )
}

export function ImportarPane() {
  const { t } = useTranslation()
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
        setImportError(t('import.formatError'))
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
      setImportResult(t('import.importSuccess', { count }))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('import.importError'))
    } finally { setImporting(false) }
    e.target.value = ''
  }

  return (
    <div className="st-pane">
      <SectionTitle>{t('import.sectionTitle')}</SectionTitle>
      <Row
        label={t('import.jsonLabel')}
        hint={t('import.jsonHint')}
      />
      <div className="st-actions">
        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
          {importing ? t('common.importing') : t('import.selectFileButton')}
          <input type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} disabled={importing} />
        </label>
      </div>
      {importResult && <div className="auth-success" style={{ marginTop: 8 }}>{importResult}</div>}
      {importError && <div className="auth-error" style={{ marginTop: 8 }}>{importError}</div>}

      <div className="st-info-box" style={{ marginTop: 16 }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>{t('import.notesTitle')}</strong>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <li>{t('import.noteExisting')}</li>
          <li>{t('import.noteNew')}</li>
          <li>{t('import.noteFormat')}</li>
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

// ── Panes nuevos (paridad Mac v8.30) ──────────────────────────────────────

function MagicPane() {
  const { t } = useTranslation()
  const [autoTitles, setAutoTitles] = useState(() => localStorage.getItem('from_magic_autoTitles') === '1')
  const [autoTags, setAutoTags]     = useState(() => localStorage.getItem('from_magic_autoTags') === '1')
  const [autoUnfurl, setAutoUnfurl] = useState(() => localStorage.getItem('from_magic_autoUnfurl') !== '0')
  function toggle(key: string, val: boolean, set: (v: boolean) => void) {
    set(val); localStorage.setItem(key, val ? '1' : '0')
  }
  return (
    <div className="st-pane">
      <SectionTitle>{t('magic.sectionTitle')}</SectionTitle>
      <Row label={t('magic.autoTitlesLabel')} hint={t('magic.autoTitlesHint')}>
        <input type="checkbox" checked={autoTitles} onChange={e => toggle('from_magic_autoTitles', e.target.checked, setAutoTitles)} />
      </Row>
      <Row label={t('magic.autoTagsLabel')} hint={t('magic.autoTagsHint')}>
        <input type="checkbox" checked={autoTags} onChange={e => toggle('from_magic_autoTags', e.target.checked, setAutoTags)} />
      </Row>
      <Row label={t('magic.autoUnfurlLabel')} hint={t('magic.autoUnfurlHint')}>
        <input type="checkbox" checked={autoUnfurl} onChange={e => toggle('from_magic_autoUnfurl', e.target.checked, setAutoUnfurl)} />
      </Row>
    </div>
  )
}

function EstadisticasPane() {
  const { t } = useTranslation()
  const s = useStore()
  const all = s.allActive()
  const total = all.length
  const tasks = all.filter((n: Node) => n.status !== null)
  const done = tasks.filter((n: Node) => n.status === 'done').length
  const pending = tasks.filter((n: Node) => n.status === 'pending').length
  const resources = all.filter((n: Node) => n.isResource).length
  const events = all.filter((n: Node) => n.isEvent).length
  return (
    <div className="st-pane">
      <SectionTitle>{t('stats.sectionTitle')}</SectionTitle>
      <Row label={t('stats.notesAndTasksLabel')}><span className="st-value">{total} nodos activos</span></Row>
      <Row label={t('stats.pendingTasksLabel')}><span className="st-value">{pending}</span></Row>
      <Row label={t('stats.completedTasksLabel')}><span className="st-value">{done}</span></Row>
      <Row label={t('stats.eventsLabel')}><span className="st-value">{events}</span></Row>
      <Row label={t('stats.resourcesLabel')}><span className="st-value">{resources}</span></Row>
      <Row label={t('stats.completionRateLabel')} hint={t('stats.completionRateHint')}>
        <span className="st-value">{tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0}%</span>
      </Row>
    </div>
  )
}

function TagsPane() {
  const { t } = useTranslation()
  const s = useStore()
  const tags = (s.allUsedTags?.() ?? []) as string[]
  return (
    <div className="st-pane">
      <SectionTitle>{t('tags.sectionTitle')}</SectionTitle>
      <Row label={`${tags.length} tags`} hint={t('tags.hint')} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {tags.map((tag: string) => (
          <span key={tag} style={{ padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12 }}>#{tag}</span>
        ))}
      </div>
    </div>
  )
}

function EstadosPane() {
  const { t } = useTranslation()
  return (
    <div className="st-pane">
      <SectionTitle>{t('states.sectionTitle')}</SectionTitle>
      <Row label="pending" hint={t('states.pendingHint')} />
      <Row label="done" hint={t('states.doneHint')} />
      <Row label="cancelled" hint={t('states.cancelledHint')} />
      <Row label="future" hint={t('states.futureHint')} />
      <Row label={t('states.customizationLabel')} hint={t('states.customizationHint')} />
    </div>
  )
}

function VozPane() {
  const { t } = useTranslation()
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  const supported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  function start() {
    if (!supported) return
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = localStorage.getItem('from_ai_language') === 'en' ? 'en-US' : 'es-ES'
    rec.onresult = (event: any) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setTranscript(text)
    }
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
  }

  function stop() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="st-pane">
      <SectionTitle>{t('voice.sectionTitle')}</SectionTitle>
      {!supported ? (
        <Row label={t('voice.notAvailableLabel')} hint={t('voice.notAvailableHint')} />
      ) : (
        <>
          <Row label={t('voice.languageLabel')} hint={t('voice.languageHint')} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {!recording
              ? <button className="btn-primary" onClick={start}>{t('voice.startDictationButton')}</button>
              : <button className="btn-secondary btn-danger-outline" onClick={stop}>{t('voice.stopButton')}</button>
            }
          </div>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={6}
            className="st-input"
            placeholder={t('voice.transcriptPlaceholder')}
            style={{ width: '100%', marginTop: 10 }}
          />
        </>
      )}
    </div>
  )
}

function AgentesPane() {
  const { t } = useTranslation()
  const s = useStore()
  const agents = s.allActive().filter((n: Node) => (n.types || []).includes('agente'))
  return (
    <div className="st-pane">
      <SectionTitle>{t('agents.sectionTitle')}</SectionTitle>
      <Row label={`${agents.length} agentes definidos`} hint={t('agents.hint')} />
      <div style={{ marginTop: 12 }}>
        {agents.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span>{a.text || t('agents.unnamedAgent')}</span>
            <button className="btn-secondary" style={{ fontSize: 11 }}>{t('agents.runButton')}</button>
          </div>
        ))}
        {agents.length === 0 && <Row label={t('agents.noAgentsLabel')} hint={t('agents.noAgentsHint')} />}
      </div>
    </div>
  )
}

function TimelinePane() {
  const { t } = useTranslation()
  const [startHour, setStartHour] = useState<number>(() => Number(localStorage.getItem('from_timelineStart') || '7'))
  const [endHour, setEndHour]     = useState<number>(() => Number(localStorage.getItem('from_timelineEnd')   || '22'))
  function update(s: number, e: number) {
    setStartHour(s); setEndHour(e)
    localStorage.setItem('from_timelineStart', String(s))
    localStorage.setItem('from_timelineEnd', String(e))
  }
  return (
    <div className="st-pane">
      <SectionTitle>{t('timeline.sectionTitle')}</SectionTitle>
      <Row label={t('timeline.startHourLabel')} hint={t('timeline.startHourHint')}>
        <select value={startHour} onChange={e => update(Number(e.target.value), endHour)}>
          {Array.from({ length: 13 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </Row>
      <Row label={t('timeline.endHourLabel')} hint={t('timeline.endHourHint')}>
        <select value={endHour} onChange={e => update(startHour, Number(e.target.value))}>
          {Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h} disabled={h <= startHour}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </Row>
    </div>
  )
}

function PromptsPane() {
  const { t } = useTranslation()
  const PROMPTS_LS = 'from_prompts_v1'
  const [prompts, setPrompts] = useState<{ id: string; name: string; body: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(PROMPTS_LS) || '[]') } catch { return [] }
  })
  const [newName, setNewName] = useState('')
  const [newBody, setNewBody] = useState('')
  function save(list: typeof prompts) {
    setPrompts(list)
    localStorage.setItem(PROMPTS_LS, JSON.stringify(list))
  }
  function add() {
    if (!newName.trim() || !newBody.trim()) return
    save([...prompts, { id: 'p' + Date.now(), name: newName.trim(), body: newBody.trim() }])
    setNewName(''); setNewBody('')
  }
  return (
    <div className="st-pane">
      <SectionTitle>{t('prompts.sectionTitle')}</SectionTitle>
      <Row label={`${prompts.length} prompts`} hint={t('prompts.hint')} />
      <div style={{ marginTop: 10 }}>
        <input className="st-input" placeholder={t('prompts.namePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
        <textarea className="st-input" placeholder={t('prompts.contentPlaceholder')} value={newBody} onChange={e => setNewBody(e.target.value)} rows={4} style={{ width: '100%' }} />
        <button className="btn-primary" onClick={add} style={{ marginTop: 8 }}>{t('prompts.addButton')}</button>
      </div>
      <div style={{ marginTop: 14 }}>
        {prompts.map(p => (
          <div key={p.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{p.name}</strong>
              <button className="btn-secondary btn-danger-outline" style={{ fontSize: 11 }} onClick={() => save(prompts.filter(x => x.id !== p.id))}>{t('prompts.deleteButton')}</button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{p.body.slice(0, 120)}{p.body.length > 120 ? '…' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BackupsPane() {
  const { t } = useTranslation()
  return (
    <div className="st-pane">
      <SectionTitle>{t('backups.sectionTitle')}</SectionTitle>
      <Row label={t('backups.snapshotsLabel')} hint={t('backups.snapshotsHint')} />
      <Row label={t('backups.restoreLabel')} hint={t('backups.restoreHint')} />
    </div>
  )
}

export default function SettingsModal({ onClose, initialTab = 'cuenta' }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const SECTIONS: { title?: string; items: Section[] }[] = [
    {
      items: [
        { id: 'cuenta', label: t('settings.tabAccount'), icon: '👤' },
        { id: 'google', label: t('settings.tabGoogle'), icon: '📅' },
      ],
    },
    {
      title: t('settings.groupAppearance'),
      items: [
        { id: 'apariencia', label: t('settings.tabAppearance'), icon: '🎨' },
        { id: 'estadisticas', label: t('settings.tabStatistics'), icon: '📊' },
      ],
    },
    {
      title: t('settings.groupAI'),
      items: [
        { id: 'ia', label: t('settings.tabAI'), icon: '✦' },
        { id: 'magic', label: t('settings.tabMagic'), icon: '🪄' },
      ],
    },
    {
      title: t('settings.groupProductivity'),
      items: [
        { id: 'atajos', label: t('settings.tabShortcuts'), icon: '⌨' },
        { id: 'plantillas', label: t('settings.tabTemplates'), icon: '📋' },
        { id: 'voz', label: t('settings.tabVoice'), icon: '🎤' },
      ],
    },
    {
      title: t('settings.groupIntegrations'),
      items: [
        { id: 'mcp', label: t('settings.tabMCP'), icon: '🔌' },
      ],
    },
    {
      title: t('settings.groupAdvanced'),
      items: [
        { id: 'tags', label: t('settings.tabTags'), icon: '🏷' },
        { id: 'estados', label: t('settings.tabStates'), icon: '✓' },
        { id: 'agentes', label: t('settings.tabAgents'), icon: '🤖' },
        { id: 'timeline', label: t('settings.tabTimeline'), icon: '⏱' },
        { id: 'prompts', label: t('settings.tabPrompts'), icon: '⚡' },
      ],
    },
    {
      title: t('settings.groupData'),
      items: [
        { id: 'backups', label: t('settings.tabBackups'), icon: '💾' },
        { id: 'exportar', label: t('settings.tabExport'), icon: '↗' },
        { id: 'importar', label: t('settings.tabImport'), icon: '↙' },
        { id: 'idioma', label: t('settings.tabLanguage', 'Idioma'), icon: '🌐' },
      ],
    },
  ]

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
      case 'magic': return <MagicPane />
      case 'estadisticas': return <EstadisticasPane />
      case 'atajos': return <AtajosPane />
      case 'plantillas': return <PlantillasPane />
      case 'google': return <GooglePane />
      case 'mcp': return <ClaudeMcpPane />
      case 'tags': return <TagsPane />
      case 'estados': return <EstadosPane />
      case 'voz': return <VozPane />
      case 'agentes': return <AgentesPane />
      case 'timeline': return <TimelinePane />
      case 'prompts': return <PromptsPane />
      case 'backups': return <BackupsPane />
      case 'exportar': return <ExportarPane />
      case 'importar': return <ImportarPane />
      case 'idioma': return (
        <div className="settings-pane">
          <p className="settings-pane-hint">{t('settings.language.hint', 'Selecciona el idioma de la interfaz. Se detecta automáticamente del navegador.')}</p>
          <LanguageSelector />
        </div>
      )
    }
  }

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-window" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">{t('settings.title')}</div>
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
            <button className="settings-close-btn" onClick={onClose} title={t('settings.closeButton')}>
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
