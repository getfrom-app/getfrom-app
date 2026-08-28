import DOMPurify from 'dompurify'

// Sanea HTML antes de pintarlo con dangerouslySetInnerHTML. `node.body` puede
// llegar de sitios que no pasan por el editor TipTap (sync de otro dispositivo,
// el conector MCP, una API externa) — sin esto, un body con
// `<img src=x onerror=alert(1)>` se ejecuta tal cual en el lienzo (auditoría de
// seguridad, 28 ago 2026). Config por defecto de DOMPurify: permite las
// etiquetas/atributos que ya genera TipTap (p, h1-h3, strong, em, u, a, img,
// ul/ol/li, data-* — incluye data-type/data-checked de TaskList) y quita
// script/on*/javascript:.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}
