import { useLanguage } from '../../hooks/useLanguage'

export default function LanguageSelector() {
  const { currentLang, languages, changeLanguage } = useLanguage()

  return (
    <div className="language-selector">
      {languages.map(lang => (
        <button
          key={lang.code}
          className={`lang-btn ${currentLang === lang.code ? 'lang-btn--active' : ''}`}
          onClick={() => changeLanguage(lang.code)}
        >
          <span className="lang-flag">{lang.flag}</span>
          <span className="lang-label">{lang.label}</span>
        </button>
      ))}
    </div>
  )
}
