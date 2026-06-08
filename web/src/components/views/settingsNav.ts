// Navegación de Ajustes compartida entre la columna derecha (SettingsListPanel)
// y la ventana central (SettingsView). Una sola fuente de verdad para las pestañas.

export type Tab =
  | 'cuenta' | 'google'
  | 'apariencia' | 'estadisticas'
  | 'ia' | 'magic'
  | 'atajos' | 'plantillas'
  | 'exportar' | 'importar' | 'backups'
  | 'claude' | 'captura'

export interface NavItem { id: Tab; label: string; icon: string }
export interface NavSection { title: string; items: NavItem[] }

export const NAV: NavSection[] = [
  {
    title: 'Cuenta',
    items: [
      { id: 'cuenta', label: 'Mi cuenta', icon: '👤' },
      { id: 'google', label: 'Google', icon: '🟢' },
    ],
  },
  {
    title: 'Apariencia',
    items: [
      { id: 'apariencia', label: 'Apariencia', icon: '🎨' },
      { id: 'estadisticas', label: 'Estadísticas', icon: '📊' },
    ],
  },
  {
    title: 'IA',
    items: [
      { id: 'ia', label: 'Inteligencia Artificial', icon: '✦' },
      { id: 'magic', label: 'Magic', icon: '💫' },
    ],
  },
  {
    title: 'Productividad',
    items: [
      { id: 'atajos', label: 'Atajos', icon: '⌨' },
      { id: 'plantillas', label: 'Plantillas', icon: '📋' },
    ],
  },
  {
    title: 'Integraciones',
    items: [
      { id: 'captura', label: 'Accesorios', icon: '⚡' },
      { id: 'claude', label: 'Claude (MCP)', icon: '🤖' },
    ],
  },
  {
    title: 'Datos',
    items: [
      { id: 'backups', label: 'Backups', icon: '🗂' },
      { id: 'exportar', label: 'Exportar', icon: '↗' },
      { id: 'importar', label: 'Importar', icon: '↙' },
    ],
  },
]

export const ALL_ITEMS: NavItem[] = NAV.flatMap(s => s.items)

export const SUBTITLES: Partial<Record<Tab, string>> = {
  cuenta: 'Datos de tu cuenta, suscripción y privacidad.',
  google: 'Conexión con Google Calendar y Google Drive.',
  apariencia: 'Tema, tipografía, interlineado y color de acento.',
  estadisticas: 'Resumen de notas, tareas y actividad en tu vault.',
  ia: 'Proveedor de IA, tokens e integración con Claude.',
  magic: 'Sugerencias automáticas y acciones inteligentes.',
  atajos: 'Atajos de teclado y expansión de texto.',
  plantillas: 'Plantillas personalizadas para crear notas rápido.',
  backups: 'Snapshots automáticos cada 2h. Restaura tu vault a cualquier punto.',
  exportar: 'Exporta una copia de tus datos en JSON o Markdown.',
  importar: 'Importa notas y tareas desde un archivo JSON.',
  claude: 'Conecta Claude Desktop con tu vault mediante MCP.',
  captura: 'Tus accesorios de captura rápida: barra de menús, Atajo de Apple, Raycast y Chrome.',
}
