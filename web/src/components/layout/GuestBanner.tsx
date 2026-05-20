import { useNavigate } from 'react-router-dom'

export default function GuestBanner() {
  const navigate = useNavigate()

  return (
    <div className="guest-banner">
      <span className="guest-banner-text">
        Estás en modo invitado. Tus datos se perderán al cerrar el navegador.
      </span>
      <div className="guest-banner-actions">
        <button
          className="guest-banner-btn guest-banner-btn--primary"
          onClick={() => navigate('/login?mode=register')}
        >
          Crear cuenta gratis
        </button>
        <button
          className="guest-banner-btn guest-banner-btn--ghost"
          onClick={() => navigate('/login')}
        >
          Iniciar sesión
        </button>
      </div>
    </div>
  )
}
