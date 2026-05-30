import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { getToken } from '../../api/client'

export default function FilesView() {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isLoggedIn = !!getToken()
  const [search, setSearch] = useState('')

  // As a practical solution, show recent nodes as places to find files
  const recentNotes = s.allActive()
    .filter(n => !n.deletedAt && !n.isDiaryEntry)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20)
    .filter(n => !search || n.text.toLowerCase().includes(search.toLowerCase()))

  if (!isLoggedIn) {
    return (
      <div className="view">
        <div className="view-header">
          <h1 className="view-title">{t('files.title')}</h1>
        </div>
        <div className="view-body">
          <div className="view-empty">{t('files.loginRequired')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="view files-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h1 className="view-title">{t('files.title')}</h1>
        </div>
        <div className="files-info-banner">
          Los archivos adjuntos se encuentran en cada nota. Abre una nota y usa el botón 📎 para adjuntar archivos.
        </div>
        <input
          type="text"
          className="search-input"
          placeholder={t('files.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginTop: 12 }}
        />
      </div>
      <div className="view-body">
        <div className="files-section-label">{t('files.recentNotes')}</div>
        <div className="files-notes-list">
          {recentNotes.map(note => (
            <div
              key={note.id}
              className="files-note-item"
              onClick={() => navigate(`/node/${note.id}`)}
            >
              <span className="files-note-icon">
                {note.status === 'pending' ? '○' : note.status === 'done' ? '✓' : note.isEvent ? '📅' : '📄'}
              </span>
              <div className="files-note-info">
                <span className="files-note-title">{note.text || t('common.noTitle')}</span>
                <span className="files-note-meta">
                  Actualizado {new Date(note.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <button className="files-note-open">
                {t('panel.openArrow')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
