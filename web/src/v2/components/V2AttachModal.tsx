// «Adjuntar» — un único sitio para meter CUALQUIER cosa de fuera en Fromly
// (Alberto, 5 ago 2026: "en el caso de drive vamos a ampliarlo, quiero que se abra
// un modal para arrastrar o subir cualquier archivo, pegar cualquier link o
// importar desde Drive. Entonces el botón será Adjuntar").
//
// Sustituye al botón «Drive» suelto de la sidebar: Drive pasa a ser UNA de las tres
// vías, no la única. Las tres acaban en el MISMO sitio (contexto activo o día de
// hoy) porque delegan en los handlers que ya existen en V2App:
//   · Archivo  → `onFilesDropped` (la ruta única de importación, ver FROM.md).
//   · Enlace   → nodo-recurso con `_resourceUrl`; el unfurl del servidor rellena
//                título/dominio después, igual que al pegar una URL en un bullet.
//   · Drive    → `onOpenDrive`, el picker de siempre.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { unfurlUrl } from '../../api/unfurl'
import Icon from './Icon'

interface Props {
  onClose: () => void
  /** Ruta única de importación de archivos (V2App.onFilesDropped). */
  onFiles: (files: File[]) => void
  /** Abre el picker de Google Drive (V2App.onDriveInCtx con el contexto activo). */
  onOpenDrive: () => void
  /** Dónde nace lo que se adjunta: contexto activo o nota del día (captureParentId). */
  parentId: string | null
  /** Abre en el centro el recurso recién creado desde un enlace. */
  onOpenNode: (id: string) => void
}

export default function V2AttachModal({ onClose, onFiles, onOpenDrive, parentId, onOpenNode }: Props) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const takeFiles = (files: File[]) => {
    if (!files.length) return
    onFiles(files)
    onClose()
  }

  // Enlace → nodo-recurso. El título provisional es el dominio (algo legible desde
  // el primer instante); `unfurlUrl` lo sustituye por el real cuando responde, sin
  // bloquear el cierre del modal.
  const addLink = () => {
    const clean = url.trim()
    if (!clean) return
    const withProto = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
    let host = withProto
    try { host = new URL(withProto).hostname.replace(/^www\./, '') } catch { /* URL rara: se queda el texto */ }
    const node = store.createNode({ text: host, parentId })
    store.updateNode(node.id, { isResource: true, extraData: JSON.stringify({ _resourceUrl: withProto }) })
    onOpenNode(node.id)
    onClose()
    unfurlUrl(withProto)
      .then(meta => {
        const fresh = store.getNode(node.id)
        if (!fresh) return
        let ed: Record<string, unknown> = {}
        try { ed = JSON.parse(fresh.extraData || '{}') } catch { /* noop */ }
        ed._resourceMeta = meta
        if (meta.type) ed._resourceType = meta.type
        store.updateNode(node.id, { text: meta.title || fresh.text, extraData: JSON.stringify(ed) })
      })
      .catch(() => { /* sin metadatos: el recurso ya existe con su URL, es suficiente */ })
  }

  return createPortal(
    <div className="v2-modal-overlay" onClick={onClose}>
      <div className="v2-modal v2-attach" onClick={e => e.stopPropagation()}>
        <div className="v2-modal-head">
          <span className="v2-modal-title">{t('v2.attach.title', 'Adjuntar')}</span>
          <button className="v2-iconbtn" onClick={onClose} title={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>

        <div className="v2-modal-body">
          {/* 1 — Archivo: soltar o elegir. */}
          <div
            className={`v2-attach-drop ${dragOver ? 'v2-attach-drop--over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); takeFiles(Array.from(e.dataTransfer.files)) }}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="import" size={22} strokeWidth={1.5} />
            <div className="v2-attach-drop-main">{t('v2.attach.dropTitle', 'Arrastra un archivo aquí')}</div>
            <div className="v2-attach-drop-sub">{t('v2.attach.dropHint', 'o haz clic para elegirlo — PDF, imágenes, audio, markdown…')}</div>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => takeFiles(Array.from(e.target.files || []))}
            />
          </div>

          {/* 2 — Enlace. */}
          <div className="v2-attach-section">
            <div className="v2-attach-label">{t('v2.attach.linkLabel', 'Pegar un enlace')}</div>
            <div className="v2-attach-linkrow">
              <Icon name="link" size={14} />
              <input
                ref={urlRef}
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                placeholder={t('v2.attach.linkPlaceholder', 'https://…')}
              />
              <button className="v2-head-action" disabled={!url.trim()} onClick={addLink}>
                {t('v2.attach.linkAdd', 'Añadir')}
              </button>
            </div>
          </div>

          {/* 3 — Google Drive. */}
          <div className="v2-attach-section">
            <div className="v2-attach-label">{t('v2.attach.driveLabel', 'Desde otro sitio')}</div>
            <button className="v2-attach-drive" onClick={() => { onOpenDrive(); onClose() }}>
              <Icon name="folder" size={15} />
              {t('v2.attach.drive', 'Importar desde Google Drive')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
