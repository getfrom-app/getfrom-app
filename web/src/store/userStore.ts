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

  get isPremium(): boolean {
    return (
      this.user?.subscriptionStatus === 'active' ||
      this.user?.subscriptionStatus === 'trialing' ||
      this.user?.licenseStatus === 'active'
    )
  }

  get planLabel(): string {
    if (this.user?.licenseStatus === 'active') return i18n.t('account.planLifetime', { defaultValue: 'Licencia perpetua' })
    if (this.user?.subscriptionStatus === 'active') return i18n.t('account.subActive', { defaultValue: 'Suscripción activa' })
    if (this.user?.subscriptionStatus === 'trialing') {
      const ends = this.user.trialEndsAt ? new Date(this.user.trialEndsAt) : null
      const days = ends ? Math.ceil((ends.getTime() - Date.now()) / 86400000) : 0
      return days > 0
        ? i18n.t('account.trialDaysLeft', { defaultValue: 'Prueba gratuita — {{days}}d restantes', days })
        : i18n.t('account.trial', { defaultValue: 'Prueba gratuita' })
    }
    if (this.user?.subscriptionStatus === 'past_due') return i18n.t('account.pastDue', { defaultValue: 'Pago pendiente' })
    return i18n.t('account.planFree', { defaultValue: 'Plan gratuito' })
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
