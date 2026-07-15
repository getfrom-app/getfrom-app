// Navegación de Ajustes compartida entre la columna derecha (SettingsListPanel)
// y la ventana central (SettingsView). Una sola fuente de verdad para las pestañas.

export type Tab =
  | 'cuenta' | 'google'
  | 'apariencia'
  | 'ia' | 'magic'
  | 'atajos'
  | 'exportar' | 'importar' | 'backups'
  | 'captura'

export interface NavItem { id: Tab; label: string }
export interface NavSection { title: string; items: NavItem[] }

export const NAV: NavSection[] = [
  {
    title: 'Cuenta',
    items: [
      { id: 'cuenta', label: 'Mi cuenta' },
      { id: 'google', label: 'Google' },
    ],
  },
  {
    title: 'Apariencia',
    items: [
      { id: 'apariencia', label: 'Apariencia' },
    ],
  },
  {
    title: 'IA',
    items: [
      { id: 'ia', label: 'Inteligencia Artificial' },
      { id: 'magic', label: 'Magic' },
    ],
  },
  {
    title: 'Productividad',
    items: [
      { id: 'atajos', label: 'Atajos' },
    ],
  },
  {
    title: 'Integraciones',
    items: [
      { id: 'captura', label: 'Accesorios' },
    ],
  },
  {
    title: 'Datos',
    items: [
      { id: 'backups', label: 'Backups' },
      { id: 'exportar', label: 'Exportar' },
      { id: 'importar', label: 'Importar' },
    ],
  },
]

export const ALL_ITEMS: NavItem[] = NAV.flatMap(s => s.items)

export const SUBTITLES: Partial<Record<Tab, string>> = {
  cuenta: 'Datos de tu cuenta, suscripción y privacidad.',
  google: 'Conexión con Google Calendar y Google Drive.',
  apariencia: 'Tema, color de acento y horario del día.',
  ia: 'Proveedor de IA, tokens e integración con Claude.',
  magic: 'Sugerencias automáticas y acciones inteligentes.',
  atajos: 'Atajos de teclado y expansión de texto.',
  backups: 'Snapshots automáticos cada 2h. Restaura tu vault a cualquier punto.',
  exportar: 'Exporta una copia de tus datos en JSON o Markdown.',
  importar: 'Importa notas y tareas desde un archivo JSON.',
  captura: 'Token de API, barra de menús, Atajo de Apple, Raycast, Chrome y Claude.',
}
