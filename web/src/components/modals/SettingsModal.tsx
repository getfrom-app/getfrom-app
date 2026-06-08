import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../settings/LanguageSelector'
import { isICloudBackupEnabled, setICloudBackupEnabled } from '../../utils/icloudBackup'
import {
  updateMe, deleteAccount, cancelSubscription, changePlan, getBillingPortalUrl,
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

      {/* Email es solo lectura: cambiarlo rompería el login con Google/Apple. */}
      <Row label={t('account.emailRow')} hint={user?.email ?? '—'} />

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
        <a href="https://getfrom.app/privacy" target="_blank" rel="noopener noreferrer" className="btn-secondary">{t('account.privacyPolicyViewButton')}</a>
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
  const steps = [
    'Abre Claude (claude.ai, iPhone, Android o Desktop)',
    'Ve a Ajustes → Conectores',
    'Busca "From" y pulsa Conectar',
    'Inicia sesión con tu cuenta de From',
    'Listo — Claude puede guardar notas y tareas en tu vault desde cualquier dispositivo',
  ]

  return (
    <div className="st-pane">
      <SectionTitle>From para Claude — ya disponible en el directorio</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 16 }}>
        From está en el directorio oficial de conectores de Claude. No necesitas instalar nada ni copiar tokens.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
            }}>{i + 1}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{step}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <a href="https://getfrom.app/claude" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
          Ver documentación completa →
        </a>
      </div>

      {/* Claude Code (CLI) — opción avanzada */}
      <div style={{ marginTop: 28, padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Para Claude Code (CLI)</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Añade From a <code style={{ fontSize: 11 }}>~/.claude.json</code> con tipo <code style={{ fontSize: 11 }}>http</code> y URL <code style={{ fontSize: 11 }}>https://from-server-production.up.railway.app/mcp</code>. El token lo encuentras en Ajustes → Accesorios.
        </div>
      </div>
    </div>
  )
}

const RAYCAST_API_BASE = 'https://from-server-production.up.railway.app'
const APPLE_SHORTCUT_URL = 'from://capture?text=[Texto]&silent=1'
const APPLE_SHORTCUT_ICLOUD = 'https://www.icloud.com/shortcuts/d77a969efecf414bbb44a8e9bb05f52f'

const isTauriDesktop = import.meta.env.VITE_TAURI === 'true'

export function CapturaRapidaPane() {
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
      <SectionTitle>Token de API</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Una sola clave para conectar From con Raycast, Chrome y Claude Code. No la compartas.
      </div>
      {loaded ? (
        token ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={codeBox}>{'•'.repeat(40)}</code>
            <button className="btn-secondary" onClick={() => copy(token, 'token')} style={{ flexShrink: 0, fontSize: 12 }}>
              {copied === 'token' ? '✓ Copiado' : 'Copiar'}
            </button>
            <button onClick={handleGenerate} disabled={generating} title="Generar uno nuevo (invalida el anterior)" style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: '0 4px', border: 'none' }}>
              {generating ? '…' : 'Regenerar'}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando...' : 'Generar token de API'}
          </button>
        )
      ) : <div className="st-row-hint">Cargando...</div>}

      {/* Barra de menús — solo en Mac */}
      {isTauriDesktop && (
        <>
          <SectionTitle>Barra de menús</SectionTitle>
          <div className="st-row-hint" style={{ marginBottom: 10 }}>
            From vive en la barra de menús del Mac: clic en el icono (o <strong style={{ color: 'var(--text)' }}>Captura rápida</strong>) abre una ventana flotante para crear algo al vuelo. Cerrar la ventana principal no cierra From.
          </div>
          <Row label="Mostrar icono en la barra de menús" hint="También puedes ocultarlo desde el propio icono (clic derecho → Ocultar).">
            <input type="checkbox" checked={trayVisible} onChange={e => toggleTray(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </Row>

          <SectionTitle>Backup en iCloud</SectionTitle>
          <Row label="Copia automática a iCloud Drive" hint="Cada ~2h, una copia de tu vault en iCloud Drive (carpeta «From Backups»), además del backup del servidor.">
            <input type="checkbox" checked={icloud} onChange={e => toggleICloud(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </Row>
        </>
      )}

      {/* Atajo de Apple */}
      <SectionTitle>Atajo de Apple</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Te pide el texto y lo guarda en tu nota de hoy. Luego asígnale una tecla global desde Atajos → Ajustes del atajo.
      </div>
      <a href={APPLE_SHORTCUT_ICLOUD} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ fontSize: 12, display: 'inline-flex' }}>
        ↓ Instalar atajo de Apple
      </a>

      {/* Raycast */}
      <SectionTitle>Raycast</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Crea, busca y abre tu nota de hoy desde Raycast. Al instalarla, pega tu token (arriba) en sus preferencias.
      </div>
      <a href="https://getfrom.app/accesorios" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex' }}>
        Instalar en Raycast →
      </a>

      {/* Chrome */}
      <SectionTitle>Chrome</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        Guarda la página actual en tu nota de hoy y envía texto seleccionado como nodo. Pega tu token en sus opciones.
      </div>
      <a href="https://getfrom.app/accesorios" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex' }}>
        Instalar en Chrome →
      </a>

      {/* Claude (MCP) */}
      <SectionTitle>Claude</SectionTitle>
      <div className="st-row-hint" style={{ marginBottom: 10 }}>
        From está en el <strong style={{ color: 'var(--text)' }}>directorio oficial de conectores de Claude</strong>: abre Claude → Conectores → busca From y conecta con un clic. Sin tokens ni configuración. Funciona en Claude Desktop, Claude.ai y Claude Code.
      </div>
      <a href="https://getfrom.app/claude" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex' }}>
        Conectar en Claude →
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
      {/* La sección de Google Drive se mostrará cuando el adjuntar-archivos esté
          implementado (requiere re-añadir el scope drive.file tras verificar Calendar). */}
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

  return (
    <div className="st-pane">
      <SectionTitle>{t('export.sectionTitle')}</SectionTitle>
      <Row label={t('export.serverBackupLabel')} hint="Descarga una copia completa de tu vault (todo está en el servidor)." />
      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="st-actions">
        <button className="btn-secondary" onClick={() => handleExport('json')} disabled={loading}>
          {loading ? t('common.exporting') : t('export.jsonServerButton')}
        </button>
        <button className="btn-secondary" onClick={() => handleExport('markdown')} disabled={loading}>
          {loading ? t('common.exporting') : t('export.markdownServerButton')}
        </button>
      </div>
    </div>
  )
}

type ImportSource = 'obsidian' | 'notion' | 'apple' | 'markdown' | 'from'

const IMPORT_SOURCES: { id: ImportSource; icon: string; name: string; desc: string }[] = [
  { id: 'obsidian', icon: '🪨', name: 'Obsidian',        desc: 'Tu carpeta de notas .md' },
  { id: 'notion',   icon: '⬛', name: 'Notion',          desc: 'Exportación Markdown' },
  { id: 'apple',    icon: '🍎', name: 'Apple Notes',     desc: 'Vía Markdown / texto' },
  { id: 'markdown', icon: '📝', name: 'Markdown / texto', desc: 'Archivos .md o .txt' },
  { id: 'from',     icon: '📦', name: 'From (JSON)',      desc: 'Copia de seguridad de From' },
]

const IMPORT_STEPS: Record<ImportSource, string[]> = {
  obsidian: [
    'En tu ordenador, localiza la carpeta del vault de Obsidian.',
    'Pulsa «Subir carpeta» y selecciónala. Se respeta la estructura de subcarpetas.',
  ],
  notion: [
    'En Notion: ··· (arriba a la derecha) → Export → formato «Markdown & CSV», con «Include subpages».',
    'Descarga y descomprime el .zip.',
    'Pulsa «Subir carpeta» y elige la carpeta descomprimida.',
  ],
  apple: [
    'Apple Notes no exporta a Markdown directamente.',
    'Pásalas a archivos .txt/.md (con un Atajo de Apple «Exportar notas», o copiando el texto).',
    'Pulsa «Subir archivos» y selecciónalos.',
  ],
  markdown: [
    'Selecciona uno o varios archivos .md o .txt (o una carpeta entera).',
  ],
  from: [
    'Selecciona el archivo .json exportado desde From (Ajustes → Exportar).',
  ],
}

export function ImportarPane() {
  const { t } = useTranslation()
  const [source, setSource] = useState<ImportSource | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── From (JSON) ──────────────────────────────────────────────────────────
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
      if (r.notes === 0) setError('No se encontraron archivos .md / .txt válidos.')
      else setResult(`Importadas ${r.notes} ${r.notes === 1 ? 'nota' : 'notas'}. Las tienes en «📥 Importado…» (en tu árbol).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.importError'))
    } finally { setImporting(false); e.target.value = '' }
  }

  // ── Lista de fuentes ───────────────────────────────────────────────────────
  if (!source) {
    return (
      <div className="st-pane">
        <SectionTitle>Importar desde…</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {IMPORT_SOURCES.map(s => (
            <button
              key={s.id}
              onClick={() => { setSource(s.id); setResult(null); setError(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{s.desc}</span>
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
        ← Todas las fuentes
      </button>
      <SectionTitle>{meta.icon} {meta.name}</SectionTitle>

      <ol style={{ margin: '4px 0 14px', paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: 13 }}>
        {IMPORT_STEPS[source].map((step, i) => <li key={i}>{step}</li>)}
      </ol>

      <div className="st-actions">
        {isJson ? (
          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            {importing ? t('common.importing') : 'Subir archivo .json'}
            <input type="file" accept=".json" onChange={handleJson} style={{ display: 'none' }} disabled={importing} />
          </label>
        ) : (
          <>
            {isFolderSource && (
              <label className="btn-primary" style={{ cursor: 'pointer' }}>
                {importing ? t('common.importing') : 'Subir carpeta'}
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
              {importing ? t('common.importing') : 'Subir archivos'}
              <input type="file" multiple accept=".md,.markdown,.txt" onChange={handleMarkdown} style={{ display: 'none' }} disabled={importing} />
            </label>
          </>
        )}
      </div>

      {result && <div className="auth-success" style={{ marginTop: 10 }}>{result}</div>}
      {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

      <div className="st-row-hint" style={{ marginTop: 14, fontSize: 11.5 }}>
        Lo importado se crea en un nodo «📥 Importado [fecha]» en tu árbol, para que lo revises y reorganices con calma. No toca tus notas actuales.
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
