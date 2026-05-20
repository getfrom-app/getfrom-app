import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateMe, deleteAccount, cancelSubscription, changePlan, clearTokens, exportNodes, getToken, getApiToken, generateApiToken } from '../../api/client'
import { userStore, useUserStore } from '../../store/userStore'
import { useTheme } from '../../hooks/useTheme'
import { store } from '../../store/nodeStore'
import { type Shortcut, getShortcuts, saveShortcuts } from '../../hooks/useTextExpansion'

export default function AccountView() {
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

  // Google Calendar
  const [gcalInfoVisible, setGcalInfoVisible] = useState(false)

  // Text shortcuts
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => getShortcuts())
  const [newTrigger, setNewTrigger] = useState('')
  const [newExpansion, setNewExpansion] = useState('')
  const [showAddShortcut, setShowAddShortcut] = useState(false)

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
  const [generatingMcp, setGeneratingMcp] = useState(false)
  const [mcpLoaded, setMcpLoaded] = useState(false)

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
      setPasswordSuccess('Contraseña actualizada correctamente')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Error desconocido')
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
      setEmailSuccess('Email actualizado correctamente')
      setNewEmail('')
      setEmailPassword('')
      setShowEmailForm(false)
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Error desconocido')
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
      setSubError(err instanceof Error ? err.message : 'Error desconocido')
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
      setSubError(err instanceof Error ? err.message : 'Error desconocido')
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
      setExportError(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExportLoading(false)
    }
  }

  function exportMarkdown() {
    const nodes = store.allActive().filter(n => !n.deletedAt && !n.isDiaryEntry)
    const lines = nodes.map(n => {
      const prefix = n.status !== null ? (n.status === 'done' ? '- [x] ' : '- [ ] ') : '- '
      return prefix + (n.text || '')
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
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleteLoading(true)
    try {
      await deleteAccount()
      clearTokens()
      userStore.reset()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Error desconocido')
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

  const { user } = us

  function getPlanBadge() {
    if (user?.licenseStatus === 'active') {
      return <span className="plan-badge plan-badge--license">Licencia perpetua</span>
    }
    if (user?.subscriptionStatus === 'active') {
      return <span className="plan-badge plan-badge--active">Activa</span>
    }
    if (user?.subscriptionStatus === 'cancelled' || user?.subscriptionStatus === 'expired') {
      return <span className="plan-badge plan-badge--cancelled">Cancelada</span>
    }
    return <span className="plan-badge plan-badge--free">Sin plan</span>
  }

  return (
    <div className="view account-view">
      <div className="view-header">
        <h1 className="view-title">Ajustes de cuenta</h1>
      </div>

      <div className="view-body account-body">

        {/* ── Exportar datos section ── */}
        {getToken() && (
          <section className="settings-section">
            <h2 className="settings-section-title">Exportar datos</h2>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Exportar todas tus notas y tareas</div>
                <div className="settings-row-hint">Descarga una copia de todos tus datos en el formato que prefieras.</div>
              </div>
            </div>
            {exportError && <div className="auth-error" style={{ marginTop: 8 }}>{exportError}</div>}
            <div className="settings-actions">
              <button
                className="btn-secondary"
                onClick={() => handleExport('json')}
                disabled={exportLoading}
              >
                {exportLoading ? 'Exportando...' : 'Backup completo (JSON)'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleExport('markdown')}
                disabled={exportLoading}
              >
                {exportLoading ? 'Exportando...' : 'Descarga Markdown'}
              </button>
              <button
                className="btn-secondary"
                onClick={exportMarkdown}
              >
                Exportar Markdown (local)
              </button>
            </div>
          </section>
        )}

        {/* ── Apariencia section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Apariencia</h2>
          <div className="settings-row">
            <div className="settings-row-label">Tema</div>
            <div className="theme-toggle">
              <button
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >☀️ Claro</button>
              <button
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >🌙 Oscuro</button>
            </div>
          </div>
        </section>

        {/* ── Account section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Cuenta</h2>

          <div className="settings-row">
            <div className="settings-row-label">Email</div>
            <div className="settings-row-value">{user?.email ?? '—'}</div>
            <button
              className="btn-secondary"
              onClick={() => { setShowEmailForm(v => !v); setEmailError(''); setEmailSuccess('') }}
            >
              Cambiar email
            </button>
          </div>

          {showEmailForm && (
            <form className="inline-form" onSubmit={handleChangeEmail}>
              <div className="form-field">
                <label>Nuevo email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="nuevo@email.com"
                  required
                />
              </div>
              <div className="form-field">
                <label>Contraseña actual</label>
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
                  {emailLoading ? 'Guardando...' : 'Guardar email'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowEmailForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="settings-row">
            <div className="settings-row-label">Contraseña</div>
            <div className="settings-row-value">••••••••</div>
            <button
              className="btn-secondary"
              onClick={() => { setShowPasswordForm(v => !v); setPasswordError(''); setPasswordSuccess('') }}
            >
              Cambiar contraseña
            </button>
          </div>

          {showPasswordForm && (
            <form className="inline-form" onSubmit={handleChangePassword}>
              <div className="form-field">
                <label>Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="form-field">
                <label>Nueva contraseña</label>
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
                <label>Confirmar nueva contraseña</label>
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
                  {passwordLoading ? 'Guardando...' : 'Guardar contraseña'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowPasswordForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── Privacidad section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Privacidad</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Datos almacenados</div>
              <div className="settings-row-hint">
                Tus notas y tareas se guardan localmente en tu dispositivo y, si tienes cuenta activa, también en nuestros servidores para sincronización.
                Nunca compartimos tus datos con terceros ni los usamos para entrenar modelos de IA.
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Política de privacidad</div>
              <div className="settings-row-hint">Consulta cómo tratamos y protegemos tus datos.</div>
            </div>
            <a
              href="https://getfrom.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Ver política ↗
            </a>
          </div>

          {getToken() && (
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Exportar mis datos</div>
                <div className="settings-row-hint">Descarga una copia completa de todos tus datos en formato JSON o Markdown.</div>
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
                  {exportLoading ? 'Exportando...' : 'Backup completo (JSON)'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleExport('markdown')}
                  disabled={exportLoading}
                >
                  {exportLoading ? 'Exportando...' : 'Descarga Markdown'}
                </button>
              </div>
            </>
          )}
        </section>

        {/* ── Atajos de texto ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Atajos de texto</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Expansión de texto</div>
              <div className="settings-row-hint">Define atajos que se expanden automáticamente mientras escribes. Ej: <code>;firma</code> → <em>Un saludo, Alberto</em></div>
            </div>
          </div>

          {shortcuts.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Trigger</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Expansión</th>
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
                        title="Eliminar atajo"
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
                  placeholder="Trigger (ej: ;firma)"
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  style={{ flex: '0 0 140px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder="Expansión"
                  value={newExpansion}
                  onChange={e => setNewExpansion(e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddShortcut() }}
                />
                <button className="btn-primary" onClick={handleAddShortcut} style={{ fontSize: 13, padding: '6px 14px' }}>Guardar</button>
                <button className="btn-secondary" onClick={() => setShowAddShortcut(false)} style={{ fontSize: 13, padding: '6px 14px' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="settings-actions">
              <button className="btn-secondary" onClick={() => setShowAddShortcut(true)}>Añadir atajo</button>
            </div>
          )}
        </section>

        {/* ── Subscription section ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Suscripción</h2>

          <div className="settings-row">
            <div className="settings-row-label">Estado</div>
            <div className="settings-row-value">{getPlanBadge()}</div>
          </div>

          {user?.subscriptionStatus === 'active' && user.subscriptionRenewsAt && (
            <div className="settings-row">
              <div className="settings-row-label">Próxima renovación</div>
              <div className="settings-row-value">
                {new Date(user.subscriptionRenewsAt).toLocaleDateString('es-ES', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
            </div>
          )}

          {user?.tokensBalance !== undefined && (
            <div className="settings-row">
              <div className="settings-row-label">Tokens IA</div>
              <div className="settings-row-value">{user.tokensBalance.toLocaleString()}</div>
            </div>
          )}

          {subError && <div className="auth-error" style={{ marginTop: 8 }}>{subError}</div>}

          <div className="settings-actions">
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

            <a
              href="https://app.lemonsqueezy.com/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Gestionar facturación ↗
            </a>
          </div>
        </section>

        {/* ── Google Calendar ── */}
        {getToken() && (
          <section className="settings-section">
            <h2 className="settings-section-title">Google Calendar</h2>

            {/* Info cuenta */}
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Cuenta</div>
                <div className="settings-row-value">{user?.email ?? '—'}</div>
              </div>
            </div>

            {/* Estado de conexión */}
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Estado</div>
                <div className="settings-row-hint">
                  La sincronización con Google Calendar se realiza automáticamente cuando inicias sesión con Google.
                  Los eventos con fecha y hora aparecen en el Calendario de From.
                </div>
              </div>
            </div>

            {gcalInfoVisible ? (
              <div className="settings-info-box" style={{ marginTop: 8, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.6 }}>
                <strong>Cómo conectar Google Calendar</strong>
                <p style={{ margin: '8px 0 0' }}>
                  Para sincronizar con Google Calendar, inicia sesión con Google en la pantalla de login.
                  Los eventos con fecha/hora aparecerán automáticamente en el Calendario.
                </p>
                <button
                  className="btn-secondary"
                  style={{ marginTop: 10, fontSize: 12 }}
                  onClick={() => setGcalInfoVisible(false)}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="settings-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setGcalInfoVisible(true)}
                >
                  Conectar Google Calendar
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Extensión Claude — MCP token ── */}
        {getToken() && (
          <section className="settings-section">
            <h2 className="settings-section-title">Extensión Claude</h2>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Token de API para Claude</div>
                <div className="settings-row-hint">
                  Conecta Claude con tu vault de From.{' '}
                  <a href="https://getfrom.app/claude" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                    Ver instrucciones →
                  </a>
                </div>
              </div>
            </div>
            {mcpLoaded && (
              mcpToken ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
                      {mcpToken}
                    </code>
                    <button className="btn-secondary" onClick={copyMcpToken} style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px' }}>
                      {mcpCopied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <button onClick={handleGenerateMcpToken} disabled={generatingMcp} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', cursor: 'pointer', padding: 0, border: 'none' }}>
                    {generatingMcp ? 'Regenerando...' : 'Regenerar token'}
                  </button>
                </div>
              ) : (
                <div className="settings-actions">
                  <button className="btn-secondary" onClick={handleGenerateMcpToken} disabled={generatingMcp}>
                    {generatingMcp ? 'Generando...' : 'Generar token de API'}
                  </button>
                </div>
              )
            )}
          </section>
        )}

        {/* ── Danger zone ── */}
        <section className="settings-section danger-zone">
          <h2 className="settings-section-title danger-title">Zona de peligro</h2>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Eliminar cuenta</div>
              <div className="settings-row-hint">Esta acción es irreversible. Se borrarán todos tus datos.</div>
            </div>
            <button
              className="btn-danger"
              onClick={() => setShowDeleteModal(true)}
            >
              Eliminar cuenta
            </button>
          </div>
        </section>
      </div>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>¿Eliminar cuenta?</h2>
            <p>Esta acción eliminará permanentemente tu cuenta y todos tus datos. No se puede deshacer.</p>
            {deleteError && <div className="auth-error" style={{ marginTop: 12 }}>{deleteError}</div>}
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
