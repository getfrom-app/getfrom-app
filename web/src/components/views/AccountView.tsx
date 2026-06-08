import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { updateMe, deleteAccount, cancelSubscription, changePlan, clearTokens, exportNodes, getToken, getApiToken, generateApiToken } from '../../api/client'
import { userStore, useUserStore } from '../../store/userStore'
import { useTheme } from '../../hooks/useTheme'
import { store } from '../../store/nodeStore'
import { type Shortcut, getShortcuts, saveShortcuts } from '../../hooks/useTextExpansion'

export default function AccountView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const us = useUserStore()
  const { theme, setTheme } = useTheme()

  // Change password
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Change email
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  // Subscription actions
  const [subLoading, setSubLoading] = useState(false)
  const [subError, setSubError] = useState('')

  // Export
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState('')

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Text shortcuts
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => getShortcuts())
  const [newTrigger, setNewTrigger] = useState('')
  const [newExpansion, setNewExpansion] = useState('')
  const [showAddShortcut, setShowAddShortcut] = useState(false)

  // Custom templates
  interface CustomTemplate { id: string; name: string; body: string }
  const TEMPLATES_KEY = 'from_custom_templates'
  function getTemplates(): CustomTemplate[] { try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') } catch { return [] } }
  function saveTemplates(ts: CustomTemplate[]) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(ts)) }

  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(getTemplates)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateBody, setNewTemplateBody] = useState('')

  function handleAddTemplate() {
    if (!newTemplateName.trim()) return
    const templ: CustomTemplate = { id: Date.now().toString(), name: newTemplateName.trim(), body: newTemplateBody.trim() }
    const updated = [...customTemplates, templ]
    saveTemplates(updated)
    setCustomTemplates(updated)
    setNewTemplateName('')
    setNewTemplateBody('')
  }

  function deleteTemplate(id: string) {
    const updated = customTemplates.filter(templ => templ.id !== id)
    saveTemplates(updated)
    setCustomTemplates(updated)
  }

  function handleAddShortcut() {
    if (!newTrigger.trim() || !newExpansion.trim()) return
    const sc: Shortcut = { id: crypto.randomUUID(), trigger: newTrigger.trim(), expansion: newExpansion.trim() }
    const updated = [...shortcuts, sc]
    setShortcuts(updated)
    saveShortcuts(updated)
    setNewTrigger('')
    setNewExpansion('')
    setShowAddShortcut(false)
  }

  function handleDeleteShortcut(id: string) {
    const updated = shortcuts.filter(s => s.id !== id)
    setShortcuts(updated)
    saveShortcuts(updated)
  }

  // Claude API token (MCP)
  const [mcpToken, setMcpToken] = useState<string | null>(null)
  const [mcpCopied, setMcpCopied] = useState(false)
  const [mcpPromptCopied, setMcpPromptCopied] = useState(false)
  const [generatingMcp, setGeneratingMcp] = useState(false)
  const [mcpLoaded, setMcpLoaded] = useState(false)

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

  useEffect(() => {
    userStore.fetchMe()
  }, [])

  useEffect(() => {
    if (!getToken()) return
    getApiToken().then(d => {
      setMcpToken(d.token)
      setMcpLoaded(true)
    }).catch(() => setMcpLoaded(true))
  }, [])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      return
    }
    setPasswordLoading(true)
    try {
      await updateMe({ currentPassword, newPassword })
      setPasswordSuccess(t('account.passwordUpdatedSuccess'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : t('auth.errorUnknown'))
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    setEmailLoading(true)
    try {
      await updateMe({ newEmail, currentPassword: emailPassword })
      await userStore.fetchMe()
      setEmailSuccess(t('account.emailUpdatedSuccess'))
      setNewEmail('')
      setEmailPassword('')
      setShowEmailForm(false)
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : t('auth.errorUnknown'))
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleSubscribe() {
    setSubError('')
    setSubLoading(true)
    try {
      const res = await changePlan()
      if (res.checkoutUrl) {
        const url = us.user?.email
          ? `${res.checkoutUrl}${res.checkoutUrl.includes('?') ? '&' : '?'}checkout[email]=${encodeURIComponent(us.user.email)}`
          : res.checkoutUrl
        window.open(url, '_blank')
      }
    } catch (err: unknown) {
      setSubError(err instanceof Error ? err.message : t('auth.errorUnknown'))
    } finally {
      setSubLoading(false)
    }
  }

  async function handleCancelSubscription() {
    setSubError('')
    setSubLoading(true)
    try {
      const res = await cancelSubscription()
      if (!res.ok && res.billingPortalUrl) {
        window.open(res.billingPortalUrl, '_blank')
      } else {
        await userStore.fetchMe()
      }
    } catch (err: unknown) {
      setSubError(err instanceof Error ? err.message : t('auth.errorUnknown'))
    } finally {
      setSubLoading(false)
    }
  }

  async function handleExport(format: 'json' | 'markdown') {
    setExportError('')
    setExportLoading(true)
    try {
      const data = await exportNodes(format)
      const date = new Date().toISOString().slice(0, 10)
      let blob: Blob
      let filename: string
      if (format === 'markdown') {
        const mdStr = typeof data === 'string' ? data : (data as Record<string, unknown>).markdown as string || JSON.stringify(data)
        blob = new Blob([mdStr], { type: 'text/markdown' })
        filename = `from-backup-${date}.md`
      } else {
        const jsonData = Array.isArray(data) ? data : (data as Record<string, unknown>).nodes || data
        const jsonStr = JSON.stringify(jsonData, null, 2)
        blob = new Blob([jsonStr], { type: 'application/json' })
        filename = `from-backup-${date}.json`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : t('export.exportError'))
    } finally {
      setExportLoading(false)
    }
  }

  async function handleExportMarkdownLocal() {
    setExportError('')
    setExportLoading(true)
    try {
      const nodes = store.allActive().filter(n => !n.deletedAt)
      const date = new Date()
      const lines: string[] = [
        `# From Export — ${date.toLocaleDateString('es-ES')}`,
        `Exportado: ${nodes.length} notas · ${date.toISOString()}`,
        '',
      ]

      function renderNode(node: typeof nodes[0], depth: number): string[] {
        const indent = '  '.repeat(depth)
        const prefix = node.status === 'done' ? '[x] ' : node.status === 'pending' ? '[ ] ' : ''
        const result = [`${indent}${prefix}${node.text || t('common.noTitle')}`]
        if (node.body) {
          result.push('')
          node.body.split('\n').forEach(l => result.push(`${indent}  ${l}`))
          result.push('')
        }
        const children = nodes
          .filter(n => n.parentId === node.id)
          .sort((a, b) => a.siblingOrder - b.siblingOrder)
        children.forEach(child => result.push(...renderNode(child, depth + 1)))
        return result
      }

      const roots = nodes
        .filter(n => !n.parentId)
        .sort((a, b) => a.siblingOrder - b.siblingOrder)

      roots.forEach(root => {
        lines.push(...renderNode(root, 0))
        lines.push('')
      })

      const content = lines.join('\n')
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `from-export-${new Date().toISOString().slice(0, 10)}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : t('export.exportError'))
    } finally {
      setExportLoading(false)
    }
  }

  function handleExportJsonLocal() {
    const nodes = store.allActive().filter(n => !n.deletedAt)
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `from-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    // Confirmación obligatoria: contraseña (o email si la cuenta es de Google).
    const hasPwd = userStore.user?.hasPassword !== false
    const answer = window.prompt(hasPwd
      ? 'Escribe tu contraseña para confirmar la eliminación de tu cuenta:'
      : 'Escribe tu email para confirmar la eliminación de tu cuenta:')
    if (!answer || !answer.trim()) return
    setDeleteLoading(true)
    try {
      await deleteAccount(hasPwd ? { password: answer } : { confirmEmail: answer })
      clearTokens()
      userStore.reset()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : t('auth.errorUnknown'))
      setDeleteLoading(false)
    }
  }

  async function handleGenerateMcpToken() {
    setGeneratingMcp(true)
    try {
      const result = await generateApiToken()
      setMcpToken(result.token)
    } catch (err) {
      console.error('Error generating MCP token', err)
    } finally {
      setGeneratingMcp(false)
    }
  }

  function copyMcpToken() {
    if (!mcpToken) return
    navigator.clipboard.writeText(mcpToken).catch(() => {})
    setMcpCopied(true)
    setTimeout(() => setMcpCopied(false), 2000)
  }

  function copyClaudePrompt() {
    navigator.clipboard.writeText(CLAUDE_CUSTOM_INSTRUCTIONS).catch(() => {})
    setMcpPromptCopied(true)
    setTimeout(() => setMcpPromptCopied(false), 3000)
  }

  const { user } = us

  // ── Estadísticas globales ──
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

  // Racha de diario: días consecutivos hasta hoy
  const diaryDates = new Set(
    nodes
      .filter(n => n.isDiaryEntry && n.diaryDate)
      .map(n => new Date(n.diaryDate!).toDateString())
  )
  let diaryStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (diaryDates.has(d.toDateString())) {
      diaryStreak++
    } else {
      break
    }
  }

  function getPlanBadge() {
    if (user?.licenseStatus === 'active') {
      return <span className="plan-badge plan-badge--license">{t('account.planBadgeLicense')}</span>
    }
    if (user?.subscriptionStatus === 'active') {
      return <span className="plan-badge plan-badge--active">{t('account.planBadgeActive')}</span>
    }
    if (user?.subscriptionStatus === 'trialing') {
      return <span className="plan-badge plan-badge--active">{t('account.planBadgeTrial')}</span>
    }
    if (user?.subscriptionStatus === 'cancelled' || user?.subscriptionStatus === 'expired') {
      return <span className="plan-badge plan-badge--cancelled">{t('account.planBadgeCancelled')}</span>
    }
    return <span className="plan-badge plan-badge--free">{t('account.planBadgeFree')}</span>
  }

  return (
    <div className="view account-view">
      <div className="view-header">
        <h1 className="view-title">{t('account.title')}</h1>
      </div>

      <div className="view-body account-body">

        {/* ── Estadísticas globales ── */}
        <div className="account-stats-grid">
          <div className="account-stat-card">
            <span className="account-stat-number">{totalNotes}</span>
            <span className="account-stat-label">{t('account.statNotes')}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-number">{totalTasks}</span>
            <span className="account-stat-label">{t('account.statTasks')}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-number">{doneTasks}</span>
            <span className="account-stat-label">{t('account.statCompleted')}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-number">{completionRate}%</span>
            <span className="account-stat-label">{t('account.statCompletionRateLong')}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-number">{diaryStreak}</span>
            <span className="account-stat-label">{t('account.statStreakDays')}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-number">{totalWords.toLocaleString()}</span>
            <span className="account-stat-label">{t('account.statTotalWords')}</span>
          </div>
        </div>

        {/* ── Exportar datos section ── */}
        {getToken() && (
          <section className="settings-section">
            <h2 className="settings-section-title">{t('export.sectionTitle')}</h2>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t('account.exportAllLabel')}</div>
                <div className="settings-row-hint">{t('account.exportAllHint')}</div>
              </div>
            </div>
            {exportError && <div className="auth-error" style={{ marginTop: 8 }}>{exportError}</div>}
            <div className="settings-actions">
              <button
                className="btn-secondary"
                onClick={() => handleExport('json')}
                disabled={exportLoading}
              >
                {exportLoading ? t('common.exporting') : t('account.exportJsonButton')}
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleExport('markdown')}
                disabled={exportLoading}
              >
                {exportLoading ? t('common.exporting') : t('account.exportMarkdownButton')}
              </button>
              <button
                className="btn-secondary"
                onClick={handleExportMarkdownLocal}
                disabled={exportLoading}
              >
                {exportLoading ? t('common.exporting') : t('account.exportMarkdownLocalButton')}
              </button>
              <button
                className="btn-secondary"
                onClick={handleExportJsonLocal}
                disabled={exportLoading}
              >
                {t('account.exportJsonLocalButton')}
              </button>
            </div>
          </section>
        )}

        {/* ── Apariencia section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('settings.groupAppearance')}</h2>
          <div className="settings-row">
            <div className="settings-row-label">{t('account.themeLabel')}</div>
            <div className="theme-toggle">
              <button
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >{t('account.themeLight')}</button>
              <button
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >{t('account.themeDark')}</button>
            </div>
          </div>
        </section>

        {/* ── Account section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('settings.tabAccount')}</h2>

          <div className="settings-row">
            <div className="settings-row-label">{t('account.emailRow')}</div>
            <div className="settings-row-value">{user?.email ?? '—'}</div>
            <button
              className="btn-secondary"
              onClick={() => { setShowEmailForm(v => !v); setEmailError(''); setEmailSuccess('') }}
            >
              {t('account.changeEmailButton')}
            </button>
          </div>

          {showEmailForm && (
            <form className="inline-form" onSubmit={handleChangeEmail}>
              <div className="form-field">
                <label>{t('account.newEmailLabel')}</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder={t('account.newEmailPlaceholder')}
                  required
                />
              </div>
              <div className="form-field">
                <label>{t('account.currentPasswordLabel')}</label>
                <input
                  type="password"
                  value={emailPassword}
                  onChange={e => setEmailPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {emailError && <div className="auth-error">{emailError}</div>}
              {emailSuccess && <div className="auth-success">{emailSuccess}</div>}
              <div className="inline-form-actions">
                <button type="submit" className="btn-primary" disabled={emailLoading}>
                  {emailLoading ? t('common.saving') : t('account.saveEmailButton')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowEmailForm(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          <div className="settings-row">
            <div className="settings-row-label">{t('account.passwordRow')}</div>
            <div className="settings-row-value">••••••••</div>
            <button
              className="btn-secondary"
              onClick={() => { setShowPasswordForm(v => !v); setPasswordError(''); setPasswordSuccess('') }}
            >
              {t('account.changePasswordButton')}
            </button>
          </div>

          {showPasswordForm && (
            <form className="inline-form" onSubmit={handleChangePassword}>
              <div className="form-field">
                <label>{t('account.currentPasswordLabel')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="form-field">
                <label>{t('account.newPasswordLabel')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              <div className="form-field">
                <label>{t('account.confirmNewPasswordLabel')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {passwordError && <div className="auth-error">{passwordError}</div>}
              {passwordSuccess && <div className="auth-success">{passwordSuccess}</div>}
              <div className="inline-form-actions">
                <button type="submit" className="btn-primary" disabled={passwordLoading}>
                  {passwordLoading ? t('common.saving') : t('account.savePasswordButton')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowPasswordForm(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── Privacidad section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('account.sectionPrivacy')}</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('account.privacyDataStoredLabel')}</div>
              <div className="settings-row-hint">
                {t('account.privacyDataStoredHint')}
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('account.privacyPolicyLabel')}</div>
              <div className="settings-row-hint">{t('account.privacyPolicyHint')}</div>
            </div>
            <a
              href="https://getfrom.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              {t('account.privacyPolicyButton')}
            </a>
          </div>

          {getToken() && (
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t('account.exportDataLabel')}</div>
                <div className="settings-row-hint">{t('account.exportDataHint')}</div>
              </div>
            </div>
          )}
          {getToken() && (
            <>
              {exportError && <div className="auth-error" style={{ marginTop: 8 }}>{exportError}</div>}
              <div className="settings-actions">
                <button
                  className="btn-secondary"
                  onClick={() => handleExport('json')}
                  disabled={exportLoading}
                >
                  {exportLoading ? t('common.exporting') : t('account.exportJsonButton')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleExport('markdown')}
                  disabled={exportLoading}
                >
                  {exportLoading ? t('common.exporting') : t('account.exportMarkdownButton')}
                </button>
              </div>
            </>
          )}
        </section>

        {/* ── Atajos de texto ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('settings.tabShortcuts')}</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('shortcuts.sectionTextExpansion')}</div>
              <div className="settings-row-hint">{t('shortcuts.textExpansionHint')} Ej: <code>;firma</code> → <em>Un saludo, Alberto</em></div>
            </div>
          </div>

          {shortcuts.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('shortcuts.triggerColumn')}</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('shortcuts.expansionColumn')}</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {shortcuts.map(sc => (
                  <tr key={sc.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{sc.trigger}</code>
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{sc.expansion}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteShortcut(sc.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1, padding: 0 }}
                        title={t('shortcuts.deleteTitle')}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {showAddShortcut ? (
            <div className="inline-form" style={{ gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={t('shortcuts.triggerPlaceholderLong')}
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  style={{ flex: '0 0 140px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder={t('shortcuts.expansionPlaceholder')}
                  value={newExpansion}
                  onChange={e => setNewExpansion(e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddShortcut() }}
                />
                <button className="btn-primary" onClick={handleAddShortcut} style={{ fontSize: 13, padding: '6px 14px' }}>{t('shortcuts.saveButton')}</button>
                <button className="btn-secondary" onClick={() => setShowAddShortcut(false)} style={{ fontSize: 13, padding: '6px 14px' }}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div className="settings-actions">
              <button className="btn-secondary" onClick={() => setShowAddShortcut(true)}>{t('shortcuts.addButton')}</button>
            </div>
          )}
        </section>

        {/* ── Plantillas personalizadas ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('templates.sectionTitle')}</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('templates.myTemplates')}</div>
              <div className="settings-row-hint">{t('templates.hintModal')}</div>
            </div>
          </div>

          {customTemplates.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('templates.nameColumn')}</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('templates.bodyColumn')}</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {customTemplates.map(templ => (
                  <tr key={templ.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontWeight: 500 }}>{templ.name}</span>
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {templ.body ? templ.body.slice(0, 40) + (templ.body.length > 40 ? '…' : '') : <em style={{ opacity: 0.5 }}>{t('templates.noContent')}</em>}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <button
                        onClick={() => deleteTemplate(templ.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1, padding: 0 }}
                        title={t('templates.deleteTitle')}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="inline-form" style={{ gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={t('templates.namePlaceholder')}
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                style={{ flex: '0 0 180px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <textarea
                placeholder={t('templates.bodyPlaceholder')}
                value={newTemplateBody}
                onChange={e => setNewTemplateBody(e.target.value)}
                rows={3}
                style={{ flex: 1, minWidth: 200, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }}
              />
              <button className="btn-primary" onClick={handleAddTemplate} style={{ fontSize: 13, padding: '6px 14px', alignSelf: 'flex-end' }}>{t('templates.addButtonShort')}</button>
            </div>
          </div>
        </section>

        {/* ── Subscription section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('account.sectionSubscription')}</h2>

          <div className="settings-row">
            <div className="settings-row-label">{t('account.subscriptionStatus')}</div>
            <div className="settings-row-value">{getPlanBadge()}</div>
          </div>

          {user?.subscriptionStatus === 'active' && user.subscriptionRenewsAt && (
            <div className="settings-row">
              <div className="settings-row-label">{t('account.subscriptionRenewal')}</div>
              <div className="settings-row-value">
                {new Date(user.subscriptionRenewsAt).toLocaleDateString('es-ES', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
            </div>
          )}

          {user?.subscriptionStatus === 'trialing' && user.trialEndsAt && (
            <div className="settings-row">
              <div className="settings-row-label">{t('account.subscriptionTrialEnds')}</div>
              <div className="settings-row-value">
                {new Date(user.trialEndsAt).toLocaleDateString('es-ES', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
            </div>
          )}

          {user?.tokensBalance !== undefined && (
            <div className="settings-row">
              <div className="settings-row-label">{t('account.tokensBalance')}</div>
              <div className="settings-row-value">{user.tokensBalance.toLocaleString()}</div>
            </div>
          )}

          {subError && <div className="auth-error" style={{ marginTop: 8 }}>{subError}</div>}

          <div className="settings-actions">
            {user?.subscriptionStatus !== 'active' && user?.subscriptionStatus !== 'trialing' && user?.licenseStatus !== 'active' && (
              <button className="btn-primary" onClick={handleSubscribe} disabled={subLoading}>
                {subLoading ? t('common.loading') : t('account.subscribeButton')}
              </button>
            )}

            {(user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing') && (
              <button className="btn-secondary btn-danger-outline" onClick={handleCancelSubscription} disabled={subLoading}>
                {subLoading ? t('common.processing') : t('account.cancelSubscriptionButton')}
              </button>
            )}

            <a
              href="https://app.lemonsqueezy.com/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              {t('account.manageBillingButton')}
            </a>
          </div>
        </section>

        {/* ── Google Calendar ── */}
        {getToken() && (
          <section className="settings-section">
            <h2 className="settings-section-title">{t('google.sectionCalendar')}</h2>

            {/* Estado de sincronización */}
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t('google.calendarSyncLabel')}</div>
                <div className="settings-row-hint">
                  {t('google.calendarSyncHint')}
                </div>
              </div>
              <span style={{
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 99,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                alignSelf: 'flex-start',
              }}>
                {t('google.notConnected')}
              </span>
            </div>

            {/* Instrucciones */}
            <div style={{ marginTop: 4, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Cómo sincronizar Google Calendar</strong>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Cierra sesión en Fromly.</li>
                <li>Inicia sesión usando el botón <em>{t('auth.continueWithGoogle')}</em>.</li>
                <li>Los eventos con fecha y hora se importarán automáticamente al Calendario.</li>
              </ol>
              <a
                href="https://getfrom.app/docs/google-calendar"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 8, color: 'var(--accent)', fontSize: 12 }}
              >
                Ver documentación →
              </a>
            </div>
          </section>
        )}

        {/* ── Integraciones ── */}
        {getToken() && (
          <section className="settings-section">
            <h2 className="settings-section-title">{t('settings.groupIntegrations')}</h2>

            {/* Claude Desktop MCP — Paso 1: token */}
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div className="settings-row-label">{t('sidebar.claudeMCP')}</div>
                  <div className="settings-row-hint">
                    Conecta Claude con tu vault. Instala la extensión y genera tu token.{' '}
                    <a href="https://getfrom.app/claude" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Más info →
                    </a>
                  </div>
                </div>
                <a
                  href="https://getfrom.app/From.dxt"
                  download
                  className="btn-secondary"
                  style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px' }}
                >
                  ↓ Descargar From.dxt
                </a>
              </div>

              {/* Paso 1: Token */}
              <div style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>1</span>
                  {/* Email de la cuenta activa */}
                  {user?.email && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>Cuenta: {user.email}</span>}
                  Token de API — pégalo en Claude Desktop al instalar la extensión
                </div>
                {mcpLoaded && (
                  mcpToken ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
                          {mcpToken}
                        </code>
                        <button className="btn-secondary" onClick={copyMcpToken} style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px' }}>
                          {mcpCopied ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <button onClick={handleGenerateMcpToken} disabled={generatingMcp} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: 0, border: 'none' }}>
                        {generatingMcp ? 'Regenerando...' : 'Regenerar token'}
                      </button>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={handleGenerateMcpToken} disabled={generatingMcp} style={{ fontSize: 13 }}>
                      {generatingMcp ? 'Generando...' : 'Generar token de API'}
                    </button>
                  )
                )}
              </div>

              {/* Paso 2: Custom Instructions — solo si hay token */}
              {mcpToken && (
                <div style={{ width: '100%', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>2</span>
                    Activa el guardado automático
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 10px' }}>
                    Copia el siguiente bloque y pégalo en <strong style={{ color: 'var(--text)' }}>Claude Desktop → Ajustes → Perfil → Instrucciones personalizadas</strong>. Hazlo una vez y Claude guardará tus conversaciones en From automáticamente.
                  </p>
                  <div style={{ position: 'relative' }}>
                    <pre style={{ margin: 0, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}>
                      {CLAUDE_CUSTOM_INSTRUCTIONS}
                    </pre>
                    <button
                      onClick={copyClaudePrompt}
                      className="btn-primary"
                      style={{ marginTop: 8, fontSize: 13, width: '100%', justifyContent: 'center' }}
                    >
                      {mcpPromptCopied ? '✓ Copiado — pégalo en Claude Desktop → Ajustes → Perfil' : 'Copiar instrucciones'}
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            {/* API Key propia */}
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div className="settings-row-label">{t('mcp.accountApiKeyLabel')}</div>
              <div className="settings-row-hint">
                {t('mcp.accountApiKeyHint')}
              </div>
            </div>
          </section>
        )}

        {/* ── Danger zone ── */}
        <section className="settings-section danger-zone">
          <h2 className="settings-section-title danger-title">{t('account.sectionDangerZone')}</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('account.deleteAccountLabel')}</div>
              <div className="settings-row-hint">{t('account.deleteAccountHintShort')}</div>
            </div>
            <button
              className="btn-danger"
              onClick={() => setShowDeleteModal(true)}
            >
              {t('account.deleteAccountButton')}
            </button>
          </div>
        </section>
      </div>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>{t('account.deleteAccountConfirmTitle')}</h2>
            <p>{t('account.deleteAccountConfirmText')}</p>
            {deleteError && <div className="auth-error" style={{ marginTop: 12 }}>{deleteError}</div>}
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? t('common.eliminating') : t('account.deleteAccountConfirmButton')}
              </button>
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
