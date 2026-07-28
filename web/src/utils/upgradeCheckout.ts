import { changePlan, changePlanAnnual, changePlanLifetime } from '../api/client'
import { openExternalUrl } from './openExternal'

export type UpgradeTarget = 'subscription' | 'annual' | 'license'

const CHANGE_FN: Record<UpgradeTarget, () => Promise<{ ok: boolean; checkoutUrl?: string }>> = {
  subscription: changePlan,
  annual: changePlanAnnual,
  license: changePlanLifetime,
}

/**
 * Abre el checkout de LemonSqueezy para el plan indicado. Antes esta misma
 * lógica (try/catch + window.open + fallback a /pricing) estaba reimplementada
 * 3 veces casi idénticas (PaywallModal, TrialBanner, PricingView).
 *
 * Si el backend no tiene el variant configurado (p.ej. Pro Anual, pendiente de
 * crear en LemonSqueezy — ver FROM.md), `res.checkoutUrl` viene vacío: en vez
 * de fingir que funcionó, se cae a /pricing para que el usuario vea las
 * opciones reales en vez de quedarse sin feedback.
 */
export async function openUpgradeCheckout(target: UpgradeTarget): Promise<void> {
  try {
    const res = await CHANGE_FN[target]()
    if (res.checkoutUrl) await openExternalUrl(res.checkoutUrl)
    else await openExternalUrl(`${window.location.origin}/pricing`)
  } catch {
    await openExternalUrl(`${window.location.origin}/pricing`)
  }
}
