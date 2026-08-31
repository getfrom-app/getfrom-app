import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { assistantGetPrefs, assistantUpdatePrefs, assistantTelegramLink, assistantTelegramUnlink, type AssistantPrefs, type AssistantPrefsPatch, type AssistantTelegramLink } from '../../api/assistant'
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
import { readLearnedFacts, getOrCreateProfileDoc } from '../../api/userKnowledge'
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
  const ls = useLearningsStore()

  void s.nodesVersion
  void ls           // re-render cuando cambian las reglas de Magic
  const total = readLearnedFacts().length

  // `navigate('/node/:id')` es una ruta que solo existe en el router de v1 —
  // dentro del shell v2 (donde vive esta pantalla de Ajustes) no abre nada
  // visible, solo cambia la URL (mismo patrón ya documentado en
  // PlannerPanel.tsx/V2App.tsx). El mecanismo correcto es el evento
  // `from:open-detail`, que V2App.tsx escucha globalmente y abre vía
  // `onOpenNode` sin salir del overlay (Alberto, 31 ago 2026: "Ver y editar"
  // cambiaba la URL pero la pantalla se quedaba en la Agenda).
  function openNode(id: string) {
    window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: id } }))
  }

  function openLearned() {
    const node = getOrCreateProfileDoc()
    if (node) openNode(node.id)
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
                <button className="btn-secondary btn-sm" onClick={() => openNode(c.id)}>{t('settingsView.view')}</button>
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
  // P4 de la auditoría (29 ago 2026): Telegram ya existía en iOS
  // (IOSSettingsView.swift) — mismo flujo aquí, mismos endpoints de servidor.
  const [telegramLink, setTelegramLink] = useState<AssistantTelegramLink | null>(null)
  const [telegramBusy, setTelegramBusy] = useState(false)

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

  // P5 de la auditoría (28-29 ago 2026): "gana el último dispositivo que
  // abriste" — iOS pisaba el huso en silencio al arrancar. Aquí se puede fijar
  // uno a mano ("timezoneAuto: false", nunca se pisa solo) o volver a
  // "usar la del dispositivo" (timezoneAuto: true).
  const deviceTz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null }
  })()
  const tzOptions = (() => {
    try {
      // @ts-expect-error -- supportedValuesOf es reciente, puede faltar en el lib.d.ts del build
      return (Intl.supportedValuesOf?.('timeZone') as string[] | undefined) ?? []
    } catch { return [] }
  })()

  return (
    <div className="st-pane">
      <div className="st-section-title">{t('settingsView.timezoneTitle', 'Zona horaria')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.timezoneLabel', 'Huso horario')}</div>
          <div className="st-row-hint">
            {prefs.timezoneAuto
              ? t('settingsView.timezoneAutoHint', 'Usando la del dispositivo — cambia sola al abrir Fromly en otro sitio.')
              : t('settingsView.timezoneManualHint', 'Fijado a mano — no cambia aunque abras Fromly desde otro huso.')}
          </div>
        </div>
        <div className="st-row-action" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!prefs.timezoneAuto && (
            <select value={prefs.timezone} onChange={e => patch({ timezone: e.target.value, timezoneAuto: false })}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', maxWidth: 220 }}>
              {(tzOptions.includes(prefs.timezone) ? tzOptions : [prefs.timezone, ...tzOptions]).map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          )}
          {prefs.timezoneAuto ? (
            <button className="btn-secondary btn-sm" disabled={!deviceTz}
              onClick={() => deviceTz && patch({ timezone: deviceTz, timezoneAuto: false })}>
              {t('settingsView.timezoneFix', 'Fijar esta')}
            </button>
          ) : (
            <button className="btn-secondary btn-sm" onClick={() => patch({ timezoneAuto: true })}>
              {t('settingsView.timezoneUseDevice', 'Usar la del dispositivo')}
            </button>
          )}
        </div>
      </div>

      <div className="st-section-title" style={{ marginTop: 24 }}>{t('settingsView.assistantMorningTitle', 'Cada mañana')}</div>
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

      <div className="st-section-title" style={{ marginTop: 24 }}>{t('settingsView.telegramTitle', 'Telegram')}</div>
      <div className="st-row">
        <div className="st-row-info">
          <div className="st-row-label">{t('settingsView.telegramLabel', 'Habla con Fromly desde Telegram')}</div>
          <div className="st-row-hint">
            {prefs.telegramLinked
              ? t('settingsView.telegramLinkedHint', 'Conectado — el mismo cerebro, sin abrir la app.')
              : telegramLink
                ? t('settingsView.telegramCodeHint', 'Ábrelo en Telegram y pulsa enviar. Caduca en {{min}} min.', { min: telegramLink.expiresInMinutes })
                : t('settingsView.telegramUnlinkedHint', 'Recibe el informe del día y escribe tareas sin salir de Telegram.')}
          </div>
        </div>
        <div className="st-row-action" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {prefs.telegramLinked ? (
            <button className="btn-secondary btn-sm" disabled={telegramBusy} onClick={async () => {
              setTelegramBusy(true)
              try { await assistantTelegramUnlink(); setPrefs(await assistantGetPrefs()) }
              finally { setTelegramBusy(false) }
            }}>{t('settingsView.telegramDisconnect', 'Desconectar')}</button>
          ) : telegramLink ? (
            <>
              <code style={{ fontSize: 15, fontWeight: 700 }}>{telegramLink.code}</code>
              <a className="btn-secondary btn-sm" href={telegramLink.url} target="_blank" rel="noreferrer">
                {t('settingsView.telegramOpen', 'Abrir Telegram')}
              </a>
            </>
          ) : (
            <button className="btn-secondary btn-sm" disabled={telegramBusy} onClick={async () => {
              setTelegramBusy(true)
              try { setTelegramLink(await assistantTelegramLink()) }
              finally { setTelegramBusy(false) }
            }}>{t('settingsView.telegramConnect', 'Conectar Telegram')}</button>
          )}
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
