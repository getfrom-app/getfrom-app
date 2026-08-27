import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { assistantGetPrefs, assistantUpdatePrefs, type AssistantPrefs, type AssistantPrefsPatch } from '../../api/assistant'
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

// ── AsistentePane ─────────────────────────────────────────────────────────
// Informe del día / Repasa el día conmigo / Recordatorios — misma fila de
// `assistantPrefs` por usuario que ya lee/escribe iOS (`IOSSettingsView.swift`,
// sección Asistente). Antes solo existía ahí; la web no tenía ningún ajuste
// para esto (24 ago 2026, paridad web/iOS).

function AsistentePane() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useState<AssistantPrefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)

  // Con reintento y estado de error visible — antes un fallo dejaba la
  // pestaña EN BLANCO para siempre, sin explicación (auditoría 28 ago 2026).
  useEffect(() => {
    setLoadError(false)
    assistantGetPrefs().then(setPrefs).catch(() => setLoadError(true))
  }, [retry])

  async function patch(p: AssistantPrefsPatch) {
    if (!prefs) return
    setPrefs({ ...prefs, ...p }) // optimista — la UI no espera al servidor
    setSaving(true)
    try { setPrefs(await assistantUpdatePrefs(p)) }
    catch { /* deja el valor optimista; el próximo fetch de ajustes lo corrige */ }
    finally { setSaving(false) }
  }

  if (!prefs) {
    return (
      <div className="st-pane">
        {loadError ? (
          <div className="st-row">
            <div className="st-row-info">
              <div className="st-row-label">{t('settingsView.assistantLoadError', 'No se pudieron cargar los ajustes del asistente')}</div>
              <div className="st-row-hint">{t('settingsView.assistantLoadErrorHint', 'Comprueba tu conexión e inténtalo de nuevo.')}</div>
            </div>
            <div className="st-row-action">
              <button className="btn-secondary btn-sm" onClick={() => setRetry(n => n + 1)}>{t('common.retry', 'Reintentar')}</button>
            </div>
          </div>
        ) : (
          <div className="st-row-hint">{t('common.loading', 'Cargando…')}</div>
        )}
      </div>
    )
  }

  return (
    <div className="st-pane">
      <div className="st-section-title">{t('settingsView.assistantMorningTitle', 'Cada mañana')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.assistantBriefLabel', 'Escríbeme al empezar el día')}</div>
          <div className="st-row-hint">{t('settingsView.assistantBriefHint', 'Tu informe del día: tareas, eventos y a qué prestar atención.')}</div>
        </div>
        <div className="st-row-action" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {prefs.briefEnabled && (
            <select value={prefs.briefHour} onChange={e => patch({ briefHour: parseInt(e.target.value) })}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              {Array.from({ length: 8 }, (_, i) => i + 5).map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          )}
          <input type="checkbox" checked={prefs.briefEnabled} onChange={e => patch({ briefEnabled: e.target.checked })}
            style={{ width: 16, height: 16, cursor: 'pointer' }} />
        </div>
      </div>

      <div className="st-section-title" style={{ marginTop: 24 }}>{t('settingsView.assistantEveningTitle', 'Al final del día')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.assistantEveningLabel', 'Repasa el día conmigo')}</div>
          <div className="st-row-hint">{t('settingsView.assistantEveningHint', 'Lo que queda sin hacer, lo de mañana y si quieres añadir algo.')}</div>
        </div>
        <div className="st-row-action" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {prefs.eveningEnabled && (
            <select value={prefs.eveningHour} onChange={e => patch({ eveningHour: parseInt(e.target.value) })}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              {Array.from({ length: 6 }, (_, i) => i + 18).map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          )}
          <input type="checkbox" checked={prefs.eveningEnabled} onChange={e => patch({ eveningEnabled: e.target.checked })}
            style={{ width: 16, height: 16, cursor: 'pointer' }} />
        </div>
      </div>

      <div className="st-section-title" style={{ marginTop: 24 }}>{t('settingsView.assistantRemindersTitle', 'Recordatorios')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.assistantRemindersLabel', 'Avísame de lo que vence')}</div>
          <div className="st-row-hint">{t('settingsView.assistantRemindersHint', 'Tareas y eventos con hora.')}</div>
        </div>
        <div className="st-row-action" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {prefs.remindersEnabled && (
            <select value={prefs.reminderLeadMin} onChange={e => patch({ reminderLeadMin: parseInt(e.target.value) })}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              {[0, 5, 10, 15, 30, 60].map(m => (
                <option key={m} value={m}>{m === 0 ? t('settingsView.assistantReminderExact', 'justo a la hora') : t('settingsView.assistantReminderBefore', '{{m}} min antes', { m })}</option>
              ))}
            </select>
          )}
          <input type="checkbox" checked={prefs.remindersEnabled} onChange={e => patch({ remindersEnabled: e.target.checked })}
            style={{ width: 16, height: 16, cursor: 'pointer' }} />
        </div>
      </div>
      <div className="st-section-title" style={{ marginTop: 24 }}>{t('settingsView.assistantCheckinTitle', 'Iniciativa de Fromly')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.assistantCheckinLabel', 'Pregúntame por tareas estancadas')}</div>
          <div className="st-row-hint">{t('settingsView.assistantCheckinHint', 'De vez en cuando, Fromly te pregunta por una tarea que lleva días parada.')}</div>
        </div>
        <div className="st-row-action" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={prefs.checkinEnabled} onChange={e => patch({ checkinEnabled: e.target.checked })}
            style={{ width: 16, height: 16, cursor: 'pointer' }} />
        </div>
      </div>
      {saving && <div className="st-row-hint">{t('settingsView.saving', 'Guardando…')}</div>}
    </div>
  )
}

// ── Contenido compartido ──────────────────────────────────────────────────────
// Extraído para que v2 (a pantalla completa, estado local — sin ruta) y v1 (aquí
// abajo, dirigido por ?tab= de la URL) usen EXACTAMENTE el mismo contenido por
// pestaña, sin duplicar el switch. BackupsPane vive en SettingsModal.tsx
// (compartida con v2) — se reutiliza tal cual.

export function SettingsPaneContent({ activeTab }: { activeTab: Tab }) {
  function renderPane() {
    switch (activeTab) {
      case 'cuenta':      return <CuentaViewPane />
      case 'google':      return <GooglePane />
      case 'apariencia':  return <AparienciaViewPane />
      case 'ia':          return <IAPane />
      case 'magic':       return <MagicPane />
      case 'asistente':   return <AsistentePane />
      case 'atajos':      return <AtajosPane />
      case 'backups':     return <BackupsPane />
      case 'exportar':    return <ExportarPane />
      case 'importar':    return <ImportarPane />
      case 'captura':     return <CapturaRapidaPane />
    }
  }

  const current = ALL_ITEMS.find(i => i.id === activeTab)

  return (
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
  )
}

// ── View (v1) ─────────────────────────────────────────────────────────────────

export default function SettingsView() {
  const [searchParams] = useSearchParams()
  const param = searchParams.get('tab') as Tab | null
  const activeTab: Tab = param && ALL_ITEMS.some(i => i.id === param) ? param : 'cuenta'

  return (
    <div className="settings-view settings-view--embedded">
      {/* La lista de pestañas vive en la columna derecha. Aquí solo el contenido. */}
      <main className="settings-view-content">
        <SettingsPaneContent activeTab={activeTab} />
      </main>
    </div>
  )
}
