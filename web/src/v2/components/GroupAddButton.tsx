// Botón «carpeta» — añadir UN elemento a un grupo, en cualquier sitio donde
// aparezca una fila o la cabecera de un elemento (Alberto, 27 ago 2026: "en
// todos los elementos añadimos tanto en los botones de la ventana principal
// como en hover un botón de carpeta para añadir a un grupo. si no existe el
// grupo también se podrá crear en ese momento"). Encapsula su propio popover
// (GroupPicker) para poder soltarse en cualquier toolbar/fila sin repetir el
// estado open/click-fuera en cada sitio.
import { useRef, useState, useEffect, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import GroupPicker from '../../components/panels/GroupPicker'
import Icon from './Icon'

const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))

export default function GroupAddButton({ nodeId, style, className, size = 14, stopPropagation }: {
  nodeId: string
  style?: CSSProperties
  className?: string
  size?: number
  /** En filas de lista (hover): el botón vive dentro de una fila clicable entera. */
  stopPropagation?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as HTMLElement)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="v2-ctxpick-wrap" ref={wrap} style={{ position: 'relative', display: 'inline-flex' }} onClick={stopPropagation ? e => e.stopPropagation() : undefined}>
      <button
        className={className}
        title={t('tip.addToGroup', 'Añadir a grupo')}
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
        style={style}
      >
        <Icon name="folder" size={size} />
      </button>
      {open && (
        <div className="v2-ctxpick-pop">
          <GroupPicker nodeId={nodeId} onDone={() => { setOpen(false); toast(t('group.toastAdded', 'Añadido al grupo')) }} />
        </div>
      )}
    </div>
  )
}
