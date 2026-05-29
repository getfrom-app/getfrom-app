import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n/config'
import { apiRequest } from '../api/client'

export function useLanguage() {
  const { i18n } = useTranslation()

  async function changeLanguage(lang: string) {
    setLanguage(lang)
    // Persistir en el servidor si hay sesión activa
    try {
      await apiRequest('/auth/me/locale', {
        method: 'PUT',
        body: JSON.stringify({ locale: lang }),
      })
    } catch {
      // No-op si no hay sesión o falla el servidor
    }
  }

  return {
    currentLang: i18n.language.slice(0, 2), // "es-ES" → "es"
    languages: SUPPORTED_LANGUAGES,
    changeLanguage,
  }
}
