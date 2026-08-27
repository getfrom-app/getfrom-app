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

export default function GroupAddButton({ nodeId, style, className, size = 14, stopPropagation, popoverAlign = 'left' }: {
  nodeId: string
  style?: CSSProperties
  className?: string
  size?: number
  /** En filas de lista (hover): el botón vive dentro de una fila clicable entera. */
  stopPropagation?: boolean
  /** 'right': el popover cuelga hacia la IZQUIERDA desde el borde derecho del botón,
   *  en vez de hacia la derecha desde su borde izquierdo (por defecto). Imprescindible
   *  cuando el botón vive pegado al borde derecho de una columna estrecha — con 'left'
   *  el popover se salía de la columna y el navegador, al enfocar su campo de texto,
   *  desplazaba TODA la fila horizontalmente para encajarlo (visto en vivo, 27 ago
   *  2026: "al darle clic la columna se desajusta y todo queda mal"). */
  popoverAlign?: 'left' | 'right'
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
    <div
      className="v2-ctxpick-wrap"
      ref={wrap}
      // `alignSelf: center`: este wrapper (no el <button> de dentro) es el hijo
      // real de la fila flex — sin esto queda alineado arriba en filas con
      // `align-items: flex-start` (p.ej. .v2-el-row), desalineado respecto al
      // botón Eliminar de al lado, que sí se autocentra (Alberto, 27 ago 2026:
      // "el icono de grupo... está desalineado respecto a la papelera").
      style={{ position: 'relative', display: 'inline-flex', alignSelf: 'center' }}
      onClick={stopPropagation ? e => e.stopPropagation() : undefined}
    >
      <button
        className={className}
        title={t('tip.addToGroup', 'Añadir a grupo')}
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
        style={style}
      >
        <Icon name="folder" size={size} />
      </button>
      {open && (
        <div className={`v2-ctxpick-pop${popoverAlign === 'right' ? ' v2-ctxpick-pop--right' : ''}`}>
          <GroupPicker nodeId={nodeId} onDone={() => { setOpen(false); toast(t('group.toastAdded', 'Añadido al grupo')) }} />
        </div>
      )}
    </div>
  )
}
