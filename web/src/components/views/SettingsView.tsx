import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CuentaPane,
  AparienciaPane,
  IAPane,
  CapturaRapidaPane,
  AtajosPane,
  GooglePane,
  ExportarPane,
  ImportarPane,
  BackupsPane,
} from '../modals/SettingsModal'
import { useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'
import { useLearningsStore } from '../../store/learningsStore'
import { ALL_ITEMS, SUBTITLES, type Tab } from './settingsNav'
import { readLearnedItems, getOrCreateLearnNode } from '../../api/userKnowledge'
import { findContextRoot } from '../../utils/rootLookup'
import { isContextKnowledge } from '../../utils/knowledgeNodes'

// La lista de pestañas vive en la columna derecha (SettingsListPanel). Esta vista
// solo renderiza el contenido de la pestaña activa (leída del query param ?tab=).

// ── MagicPane ─────────────────────────────────────────────────────────────────
// Magic está siempre activo. Fromly aprende datos duraderos sobre ti y los escribe
// en su parte del Perfil de IA. La limpieza/compactación es automática y periódica
// (no hay botón). "Ver y editar" lleva a lo que Fromly ha escrito por su cuenta.

function MagicPane() {
  const { t } = useTranslation()
  const s = useStore()
  const navigate = useNavigate()
  const ls = useLearningsStore()

  void s.nodesVersion
  void ls           // re-render cuando cambian las reglas de Magic
  const learned = readLearnedItems()
  const total = learned.people.length + learned.facts.length

  function openLearned() {
    const node = getOrCreateLearnNode()
    if (node) navigate(`/node/${node.id}`)
  }

  // Conocimiento que Fromly mantiene por contexto (nodo "🧠 Lo que Fromly sabe" dentro
  // de cada contexto; se regenera y sobrescribe solo, no acumula).
  const contextKnowledge = (() => {
    const root = findContextRoot()
    if (!root) return [] as { name: string; id: string }[]
    const out: { name: string; id: string }[] = []
    for (const ctx of s.children(root.id)) {
      if (ctx.deletedAt || (ctx.text || '').startsWith('🧠')) continue
      const kn = s.children(ctx.id).find(n => !n.deletedAt && isContextKnowledge(n.text))
      if (kn) out.push({ name: ctx.text || t('settingsView.context'), id: kn.id })
    }
    return out
  })()

  return (
    <div className="st-pane">
      <div className="st-section-title">{t('settingsView.magicTitle')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.magicKnowledgeLabel')}</div>
          <div className="st-row-hint">
            {t('settingsView.magicKnowledgeHint')}
            {total > 0 ? ' ' + t(total === 1 ? 'settingsView.magicLearnedOne' : 'settingsView.magicLearnedMany', { n: total }) : ' ' + t('settingsView.magicNothingLearned')}
            {' '}{t('settingsView.magicOpenHint')}
          </div>
        </div>
        <div className="st-row-action">
          <button className="btn-primary btn-sm" onClick={openLearned}>{t('settingsView.viewAndEdit')}</button>
        </div>
      </div>

      {contextKnowledge.length > 0 && (
        <>
          <div className="st-section-title" style={{ marginTop: 24 }}>{t('settingsView.magicContextTitle')}</div>
          <div className="st-row-hint" style={{ marginBottom: 4 }}>
            {t('settingsView.magicContextHint')}
          </div>
          {contextKnowledge.map(c => (
            <div className="st-row" key={c.id}>
              <div className="st-row-info"><div className="st-row-label">{c.name}</div></div>
              <div className="st-row-action">
                <button className="btn-secondary btn-sm" onClick={() => navigate(`/node/${c.id}`)}>{t('settingsView.view')}</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── AparienciaViewPane ──────────────────────────────────────────────────────
// El color de acento y el color del planner ya viven en AparienciaPane (base,
// compartida con v2 vía SettingsModal) — aquí solo delegamos, sin duplicar.

function AparienciaViewPane() {
  return <AparienciaPane />
}

// ── CuentaViewPane ────────────────────────────────────────────────────────────
// (Cerrar sesión no va aquí: ya está en el menú superior desplegable.)

function CuentaViewPane() {
  return <CuentaPane />
}

// ── View ──────────────────────────────────────────────────────────────────────
// BackupsPane vive en SettingsModal.tsx (compartida con v2) — se reutiliza tal cual.

export default function SettingsView() {
  const [searchParams] = useSearchParams()
  const param = searchParams.get('tab') as Tab | null
  const activeTab: Tab = param && ALL_ITEMS.some(i => i.id === param) ? param : 'cuenta'

  function renderPane() {
    switch (activeTab) {
      case 'cuenta':      return <CuentaViewPane />
      case 'google':      return <GooglePane />
      case 'apariencia':  return <AparienciaViewPane />
      case 'ia':          return <IAPane />
      case 'magic':       return <MagicPane />
      case 'atajos':      return <AtajosPane />
      case 'backups':     return <BackupsPane />
      case 'exportar':    return <ExportarPane />
      case 'importar':    return <ImportarPane />
      case 'captura':     return <CapturaRapidaPane />
    }
  }

  const current = ALL_ITEMS.find(i => i.id === activeTab)

  return (
    <div className="settings-view settings-view--embedded">
      {/* La lista de pestañas vive en la columna derecha. Aquí solo el contenido. */}
      <main className="settings-view-content">
        <div className="settings-view-content-inner">
          <div className="settings-view-content-header">
            <h1 className="settings-view-content-title">{current?.label}</h1>
            {SUBTITLES[activeTab] && (
              <div className="settings-view-content-subtitle">{SUBTITLES[activeTab]}</div>
            )}
          </div>
          <div className="settings-view-content-body">
            {renderPane()}
          </div>
        </div>
      </main>
    </div>
  )
}
