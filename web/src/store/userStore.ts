import { useState, useEffect } from 'react'
import { getMe, type UserProfile } from '../api/client'
import { getGoogleStatus } from '../api/googleCalendar'
import i18n from '../i18n/config'

class UserStore {
  user: UserProfile | null = null
  isLoading = false
  googleConnected = false
  googleEmail: string | null = null
  private listeners = new Set<() => void>()

  private notify() {
    this.listeners.forEach(fn => fn())
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  async fetchMe(): Promise<void> {
    this.isLoading = true
    this.notify()
    try {
      const res = await getMe()
      this.user = res.user
    } catch {
      this.user = null
    } finally {
      this.isLoading = false
      this.notify()
    }
    // Also fetch Google status in parallel (non-blocking)
    getGoogleStatus()
      .then(status => {
        this.googleConnected = status.connected
        this.googleEmail = status.email
        this.notify()
      })
      .catch(() => {
        // Silently ignore — Google integration optional
      })
  }

  async refreshGoogleStatus(): Promise<void> {
    try {
      const status = await getGoogleStatus()
      this.googleConnected = status.connected
      this.googleEmail = status.email
      this.notify()
    } catch {
      // Si falla, asumir desconectado (token inválido o servidor caído)
      this.googleConnected = false
      this.googleEmail = null
      this.notify()
    }
  }

  markGoogleDisconnected() {
    this.googleConnected = false
    this.googleEmail = null
    this.notify()
  }

  // Pagando de verdad (suscripción o licencia activa). NO incluye la prueba —
  // para "puede usar el asistente ahora mismo" usa `hasAccess`. Debe coincidir
  // con isPaidPlan() del servidor (lib/plan.ts): si el cliente diera Pro donde
  // el servidor no lo da, la web enseñaría funciones que luego la API rechaza.
  get isPremium(): boolean {
    return (
      this.user?.subscriptionStatus === 'active' ||
      this.user?.licenseStatus === 'active'
    )
  }

  // 15 días desde el registro (`trialEndsAt`, puesto por el servidor — ver
  // hasProAccess() en lib/plan.ts). Sustituye al límite de 1.000 elementos:
  // ahora el asistente es el producto y "gratis" ya no significaba nada.
  get isInTrial(): boolean {
    if (!this.user?.trialEndsAt) return false
    return new Date(this.user.trialEndsAt).getTime() > Date.now()
  }

  get trialDaysLeft(): number {
    if (!this.isInTrial) return 0
    const ms = new Date(this.user!.trialEndsAt!).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / 86400000))
  }

  /** Pagando o en prueba — lo que hay que mirar antes de dejar hablar al asistente. */
  get hasAccess(): boolean {
    return this.isPremium || this.isInTrial
  }

  get planLabel(): string {
    if (this.user?.licenseStatus === 'active') return i18n.t('account.planLifetime', { defaultValue: 'Licencia perpetua' })
    if (this.user?.subscriptionStatus === 'active') {
      if (this.user.subscriptionInterval === 'annual') return i18n.t('account.subActiveAnnual', { defaultValue: 'Suscripción activa (anual)' })
      if (this.user.subscriptionInterval === 'monthly') return i18n.t('account.subActiveMonthly', { defaultValue: 'Suscripción activa (mensual)' })
      return i18n.t('account.subActive', { defaultValue: 'Suscripción activa' })
    }
    if (this.user?.subscriptionStatus === 'past_due') return i18n.t('account.pastDue', { defaultValue: 'Pago pendiente' })
    if (this.isInTrial) {
      return i18n.t('account.planTrial', { defaultValue: 'Prueba — {{days}} días', days: this.trialDaysLeft })
    }
    return i18n.t('account.planExpired', { defaultValue: 'Prueba terminada' })
  }

  reset() {
    this.user = null
    this.googleConnected = false
    this.googleEmail = null
    this.notify()
  }
}

export const userStore = new UserStore()

export function useUserStore() {
  const [, setTick] = useState(0)

  useEffect(() => {
    return userStore.subscribe(() => setTick(t => t + 1))
  }, [])

  return userStore
}
