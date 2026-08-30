import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import { unfurlUrl, type UnfurlMeta } from '../../api/unfurl'

// ⚠️ Hasta el 30 ago 2026 esta ficha tenía su PROPIO selector de "Tipo"
// (Enlace/Vídeo/Libro/Podcast/Documento + tipos custom en localStorage,
// `_resourceType`) — anterior a `v2/elementKind.ts`, la clasificación real
// que usa Elementos hoy (documento/nota/pdf/imagen/enlace/audio…). Los dos
// sistemas no eran el mismo: elegir aquí "Vídeo" o "Libro" no cambiaba nada
// en Elementos (ahí siempre era "Enlace"), así que el chip solo confundía
// sin tener ningún efecto real. Eliminado (Alberto, 30 ago 2026: "queda un
// bloque de tipo que creo que es algo de antiguo... hay que quitar esto, ya
// no aplica") — de paso, rediseño visual completo de la ficha (tokens `--v2-*`
// en vez de los genéricos `--bg-*`/`--border` de la v1, tarjeta de vista
// previa más grande y con jerarquía real en vez de chips diminutos).
type ResourceType = string

function getResourceData(node: Node) {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    // Columna promovida (v8.29) tiene prioridad sobre extraData legacy
    return {
      type: (node.resourceType || ed._resourceType || 'url') as ResourceType,
      url: (node.resourceUrl || ed._resourceUrl || '') as string,
      meta: (ed._resourceMeta || null) as UnfurlMeta | null,
    }
  } catch {
    return { type: (node.resourceType || 'url') as ResourceType, url: node.resourceUrl || '', meta: null }
  }
}

function setResourceField(node: Node, fields: Record<string, unknown>) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  Object.assign(ed, fields)
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

interface Props { node: Node }

export default function ResourcePanel({ node }: Props) {
  const { t } = useTranslation()
  const { url, meta } = getResourceData(node)
  const [urlInput, setUrlInput] = useState(url)
  const [editingUrl, setEditingUrl] = useState(!url)
  const [loadingMeta, setLoadingMeta] = useState(false)

  useEffect(() => { setUrlInput(url) }, [url])

  // Auto-fetch meta si hay URL pero no hay meta
  useEffect(() => {
    if (url && !meta && !loadingMeta) {
      setLoadingMeta(true)
      unfurlUrl(url)
        .then(m => setResourceField(node, { _resourceMeta: m, _resourceType: m.type }))
        .catch(() => { /* ignore */ })
        .finally(() => setLoadingMeta(false))
    }
  }, [url]) // eslint-disable-line

  function handleFetchMeta() {
    if (!urlInput.trim()) return
    setLoadingMeta(true)
    setEditingUrl(false)
    setResourceField(node, { _resourceUrl: urlInput.trim(), _resourceMeta: null })
    unfurlUrl(urlInput.trim())
      .then(m => setResourceField(node, { _resourceMeta: m, _resourceType: m.type }))
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingMeta(false))
  }

  let domain = ''
  try { domain = url ? new URL(url).hostname.replace(/^www\./, '') : '' } catch { /* url incompleta */ }

  return (
    <div className="v2-resource-panel">
      {/* Tarjeta de vista previa — protagonista de la ficha (antes un bloque
          diminuto al final, después de un selector de "Tipo" que no hacía
          nada real, ver comentario arriba del archivo). */}
      {loadingMeta && !meta && (
        <div className="v2-resource-card v2-resource-card--loading">
          <div className="v2-resource-skel-thumb" />
          <div className="v2-resource-card-body">
            <div className="v2-resource-skel-line" style={{ width: '70%' }} />
            <div className="v2-resource-skel-line" style={{ width: '40%' }} />
          </div>
        </div>
      )}
      {meta && !editingUrl && (
        <a
          className="v2-resource-card"
          href={url} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          {meta.image && (
            <img
              src={meta.image}
              alt=""
              className={`v2-resource-thumb${meta.type === 'youtube' ? ' v2-resource-thumb--wide' : ''}`}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="v2-resource-card-body">
            <div className="v2-resource-title">{meta.title || domain}</div>
            <div className="v2-resource-sub">
              <span className="v2-resource-favicon" />
              {meta.channel || meta.domain || domain}
            </div>
            {meta.description && <div className="v2-resource-desc">{meta.description.slice(0, 160)}{meta.description.length > 160 ? '…' : ''}</div>}
          </div>
          <span className="v2-resource-open" title={t('panel.openArrow', 'Abrir ↗')}>↗</span>
        </a>
      )}
      {!meta && !loadingMeta && url && !editingUrl && (
        <a className="v2-resource-card v2-resource-card--bare" href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          <div className="v2-resource-card-body">
            <div className="v2-resource-title">{domain || url}</div>
          </div>
          <span className="v2-resource-open">↗</span>
        </a>
      )}

      {/* URL — colapsada en un botón "Editar enlace" salvo que no haya URL
          todavía o el usuario pida cambiarla; antes era un campo fijo siempre
          visible aunque ya hubiera una tarjeta de vista previa clara debajo. */}
      {editingUrl ? (
        <div className="v2-resource-url-row">
          <input
            className="v2-resource-url-input"
            placeholder="https://..."
            value={urlInput}
            autoFocus={!!url}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleFetchMeta(); if (e.key === 'Escape' && url) setEditingUrl(false) }}
          />
          <button
            className="v2-resource-url-go"
            onClick={handleFetchMeta}
            disabled={loadingMeta || !urlInput.trim()}
          >{t('panel.preview', 'Vista previa')}</button>
        </div>
      ) : (
        (meta || url) && (
          <button className="v2-resource-edit-url" onClick={() => setEditingUrl(true)}>
            {t('panel.changeUrl', 'Cambiar enlace')}
          </button>
        )
      )}
    </div>
  )
}
