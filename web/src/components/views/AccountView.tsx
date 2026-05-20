import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateMe, deleteAccount, cancelSubscription, changePlan, clearTokens } from '../../api/client'
import { userStore, useUserStore } from '../../store/userStore'
import { useTheme } from '../../hooks/useTheme'

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

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    userStore.fetchMe()
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
