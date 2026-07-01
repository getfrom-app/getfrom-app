// canvasNav — abrir un nodo SIN salir del lienzo infinito.
//
// En la app-lienzo, la columna derecha y sus listas NUNCA deben navegar a `/node/:id`
// (eso entraría en un sub-lienzo). En su lugar disparan `from:open-detail`, que
// MainLayout escucha para: abrir el panel derecho correcto según el tipo de nodo
// (contexto / documento / tarea / día…) y, si es un contexto/nodo colocado, VOLAR el
// lienzo hasta él. Todo en el mismo plano.
export function openNodeDetail(nodeId: string): void {
  if (!nodeId) return
  window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId } }))
}
