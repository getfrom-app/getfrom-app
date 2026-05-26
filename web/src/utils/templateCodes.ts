// MARK: - templateCodes
//
// Códigos de plantilla {{código}} para usar en tags, prompts y notas.
// Se resuelven en buildPayload antes de enviar contexto a la IA,
// y pueden insertarse en el editor mediante el picker {{.

export interface TemplateCode {
  code: string
  label: string
  description: string
  example: () => string
}

function getWeekNumber(d: Date): number {
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )
}

export const TEMPLATE_CODES: TemplateCode[] = [
  {
    code: 'fecha',
    label: 'Fecha larga',
    description: 'Con día de la semana y mes completo',
    example: () =>
      new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
  },
  {
    code: 'fecha_corta',
    label: 'Fecha corta',
    description: 'Formato dd/mm/aaaa',
    example: () => new Date().toLocaleDateString('es-ES'),
  },
  {
    code: 'hora',
    label: 'Hora actual',
    description: 'Hora y minutos',
    example: () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  },
  {
    code: 'dia',
    label: 'Día de la semana',
    description: 'Nombre del día',
    example: () => new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
  },
  {
    code: 'semana',
    label: 'Semana del año',
    description: 'Número de semana',
    example: () => {
      const now = new Date()
      return `semana ${getWeekNumber(now)} de ${now.getFullYear()}`
    },
  },
  {
    code: 'mes',
    label: 'Mes y año',
    description: 'Nombre del mes actual',
    example: () => new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  },
  {
    code: 'año',
    label: 'Año actual',
    description: 'Solo el número del año',
    example: () => new Date().getFullYear().toString(),
  },
  {
    code: 'nota',
    label: 'Título de la nota',
    description: 'Título de la nota que el usuario tiene abierta',
    example: () => '(título de la nota)',
  },
  {
    code: 'tag',
    label: 'Nombre del tag',
    description: 'Nombre del tag en cuyo contexto se ejecuta',
    example: () => '(nombre del tag)',
  },
]

/** Resuelve todos los {{códigos}} en un texto dado el contexto actual. */
export function resolveTemplateCodes(
  text: string,
  context?: { noteTitle?: string; tagName?: string }
): string {
  const now = new Date()
  const replacements: Record<string, string> = {
    fecha: now.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    fecha_corta: now.toLocaleDateString('es-ES'),
    hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    dia: now.toLocaleDateString('es-ES', { weekday: 'long' }),
    semana: `semana ${getWeekNumber(now)} de ${now.getFullYear()}`,
    mes: now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    año: now.getFullYear().toString(),
    nota: context?.noteTitle ?? '',
    tag:  context?.tagName  ?? '',
  }
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in replacements ? replacements[key] : match
  )
}
