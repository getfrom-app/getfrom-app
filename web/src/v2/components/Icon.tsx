// Sistema de iconos ÚNICO de Fromly — sustituye por completo a los emojis
// (Alberto, 5 ago 2026: "quitaría los emojis de toda la aplicación... los emojis
// en una aplicación dan una impresión de aplicación barata y de mala calidad").
//
// Reglas del sistema (no romperlas al añadir un icono nuevo):
//  · Trazo, nunca relleno: `fill="none"`, `stroke="currentColor"` → el icono
//    hereda SIEMPRE el color del texto que lo acompaña (y por tanto el tema
//    claro/oscuro y el acento del usuario) sin una sola línea de CSS extra.
//  · Rejilla 24×24, grosor 1.7 (1.5 en los muy densos), esquinas y uniones
//    redondeadas — el mismo lenguaje visual en los ~60 iconos.
//  · Tamaño por defecto 16px (fila de lista, botón de barra); 18-20 en
//    cabeceras, 14 en metadatos. Se pasa por prop, nunca por CSS.
//
// Uso: <Icon name="chat" /> · <Icon name="calendar" size={18} />
// `strokeWidth` solo se toca para casos puntuales (iconos muy pequeños).
import type { CSSProperties } from 'react'

export type IconName =
  // Navegación / destinos
  | 'chat' | 'history' | 'calendar' | 'layers' | 'context' | 'contexts' | 'general'
  | 'planner' | 'today' | 'search' | 'settings' | 'user' | 'trash' | 'profile'
  // Elementos
  | 'note' | 'document' | 'canvas' | 'task' | 'event' | 'pdf' | 'image' | 'link'
  | 'audio' | 'highlight' | 'quote' | 'agent' | 'prompt' | 'conversation' | 'folder'
  | 'attachment' | 'template' | 'report'
  // Acciones
  | 'plus' | 'close' | 'check' | 'pencil' | 'send' | 'mic' | 'mic-off' | 'stop'
  | 'sparkle' | 'star' | 'clock' | 'repeat' | 'arrow-right' | 'arrow-up'
  | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'more' | 'download'
  | 'import' | 'archive' | 'eye' | 'copy' | 'external' | 'lock'
  // Tema
  | 'sun' | 'moon' | 'auto'

interface Props {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
  /** Etiqueta accesible; sin ella el icono es decorativo (aria-hidden). */
  title?: string
}

// Cada entrada es el CONTENIDO del <svg> (rejilla 24×24). Ordenadas igual que
// IconName para poder localizarlas de un vistazo.
const PATHS: Record<IconName, JSX.Element> = {
  // ── Navegación / destinos ──────────────────────────────────────────────
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v4h4" /><path d="M12 7.5V12l3 1.8" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></>,
  layers: <><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" /><path d="m3 12.5 9 4.5 9-4.5M3 17l9 4.5L21 17" /></>,
  context: <><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.2l1.8 2.2H18a2.5 2.5 0 0 1 2.5 2.5v7.3A2.2 2.2 0 0 1 18.3 19H5.7a2.2 2.2 0 0 1-2.2-2.2V7.5z" /></>,
  contexts: <><rect x="3" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  general: <circle cx="12" cy="12" r="8" />,
  planner: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M9 9.5v11M15 9.5v11" /></>,
  today: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  trash: <><path d="M3.5 6.5h17M9 6.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M18 6.5V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6.5" /></>,
  profile: <><path d="M12 3a4 4 0 0 0-4 4c0 .6.1 1.1.4 1.6A3.5 3.5 0 0 0 6.5 15a3.5 3.5 0 0 0 3 3.4A3 3 0 0 0 12 21V3z" /><path d="M12 3a4 4 0 0 1 4 4c0 .6-.1 1.1-.4 1.6A3.5 3.5 0 0 1 17.5 15a3.5 3.5 0 0 1-3 3.4A3 3 0 0 1 12 21" /></>,

  // ── Elementos ──────────────────────────────────────────────────────────
  note: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15z" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  document: <><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3z" /><path d="M13.5 3v5.5H19" /></>,
  canvas: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 15.5c1.8-3.5 3.3-5 4.5-4.5 1.4.6.4 3.4 1.8 4 1.2.5 2.3-.8 3.7-3" /></>,
  task: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="m8 12.2 2.7 2.6L16 9.2" /></>,
  event: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /><circle cx="12" cy="14.5" r="1.6" /></>,
  pdf: <><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3z" /><path d="M13.5 3v5.5H19M8.5 16.5v-4h1.3a1.3 1.3 0 0 1 0 2.6H8.5" /></>,
  image: <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="10" r="1.6" /><path d="m4 17 4.5-4.3a2 2 0 0 1 2.7 0L16 17M14.5 15.4l1.4-1.3a2 2 0 0 1 2.7 0L21 16" /></>,
  link: <><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.4 1.4" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.4-1.4" /></>,
  audio: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></>,
  highlight: <><path d="M14 3.5 20.5 10 11 19.5H4.5V13L14 3.5z" /><path d="m11.5 6 6.5 6.5M3 21.5h18" /></>,
  quote: <><path d="M9.5 6.5C7 7.5 5.5 9.6 5.5 12.4c0 2.1 1.3 3.6 3.1 3.6 1.6 0 2.8-1.2 2.8-2.8 0-1.5-1.1-2.7-2.6-2.7-.3 0-.6 0-.8.1.3-1.3 1.3-2.3 2.7-2.9l-1.2-1.2zM17.5 6.5c-2.5 1-4 3.1-4 5.9 0 2.1 1.3 3.6 3.1 3.6 1.6 0 2.8-1.2 2.8-2.8 0-1.5-1.1-2.7-2.6-2.7-.3 0-.6 0-.8.1.3-1.3 1.3-2.3 2.7-2.9l-1.2-1.2z" /></>,
  agent: <><rect x="4" y="7.5" width="16" height="12" rx="3.5" /><path d="M12 3v4.5M8.5 13v1.5M15.5 13v1.5M2.5 12.5v3M21.5 12.5v3" /></>,
  prompt: <path d="M13.5 2.5 5 13.5h5.5l-1 8L18 10.5h-5.5l1-8z" />,
  conversation: <><path d="M20 10.5a6.5 6.5 0 0 1-6.5 6.5c-.9 0-1.8-.2-2.6-.5L6 18l1.3-4A6.4 6.4 0 0 1 6.5 10.5 6.5 6.5 0 0 1 13 4a6.5 6.5 0 0 1 7 6.5z" /></>,
  folder: <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.2l1.8 2.2H18a2.5 2.5 0 0 1 2.5 2.5v7.3A2.2 2.2 0 0 1 18.3 19H5.7a2.2 2.2 0 0 1-2.2-2.2V7.5z" />,
  attachment: <path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5" />,
  template: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M9 9v11" /></>,
  report: <><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3z" /><path d="M13.5 3v5.5H19M9 17v-3M12 17v-5.5M15 17v-2" /></>,

  // ── Acciones ───────────────────────────────────────────────────────────
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  pencil: <><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" /><path d="m14.5 5.5 4 4" /></>,
  send: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
  mic: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  'mic-off': <><path d="M15 5.5a3 3 0 0 0-6 0v4M9 12.5a3 3 0 0 0 5.1 1.9" /><path d="M5.5 11a6.5 6.5 0 0 0 10 5.5M12 17.5V21M3.5 3.5l17 17" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  sparkle: <path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5z" />,
  star: <path d="m12 3.8 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 10l5.9-.9L12 3.8z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.2 1.9" /></>,
  repeat: <><path d="M4 10.5V9a3.5 3.5 0 0 1 3.5-3.5h9.7" /><path d="m14.7 3 2.5 2.5-2.5 2.5M20 13.5V15a3.5 3.5 0 0 1-3.5 3.5H6.8" /><path d="M9.3 21 6.8 18.5 9.3 16" /></>,
  'arrow-right': <path d="M4.5 12h15m-6-6 6 6-6 6" />,
  'arrow-up': <path d="M12 19.5v-15m-6 6 6-6 6 6" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  'chevron-left': <path d="M15 5 8 12l7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  more: <><circle cx="5.5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18.5" cy="12" r="1.4" /></>,
  download: <><path d="M12 3.5v12m-4.5-4.5L12 15.5l4.5-4.5" /><path d="M4.5 18.5v.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-.5" /></>,
  import: <><path d="M4 14.5V18a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3.5" /><path d="M12 3.5v11m-4.5-4.5L12 14.5l4.5-4.5" /></>,
  archive: <><rect x="3" y="4" width="18" height="4.5" rx="1.5" /><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5v-2a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6.5V13A2.5 2.5 0 0 0 6 15.5h2" /></>,
  external: <><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5 11 13" /><path d="M18.5 14v4.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2H10" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /><circle cx="12" cy="15" r="1.4" /></>,

  // ── Tema ───────────────────────────────────────────────────────────────
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  auto: <><rect x="2.5" y="4.5" width="19" height="13" rx="2.5" /><path d="M8 21h8M12 17.5V21" /></>,
}

/** ¿Es esta cadena el nombre de un icono del sistema? Lo usan las listas que
 *  mezclan glifos tipográficos («H1», «⊞», «☰» — que se pintan como texto) con
 *  iconos de verdad, p.ej. el menú «/» del outliner. */
export function isIconName(s: string): s is IconName {
  return Object.prototype.hasOwnProperty.call(PATHS, s)
}

export default function Icon({ name, size = 16, strokeWidth = 1.7, className, style, title }: Props) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  )
}

/** Icono con caja fija — alinea filas de lista aunque los glifos varíen de ancho.
 *  Sustituye al `<span className="v2-el-icon">{emoji}</span>` de antes. */
export function ElIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <span className="v2-el-icon"><Icon name={name} size={size} /></span>
  )
}
