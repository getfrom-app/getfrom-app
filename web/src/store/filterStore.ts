/**
 * filterStore — estado global del filtro activo.
 * Compartido entre MainLayout (escribe) y NodeView/WFHomeView (leen).
 * Persiste en sessionStorage para sobrevivir recargas de página.
 */
import { useState, useEffect } from 'react'

let _filter = sessionStorage.getItem('from_filter') || ''
const _listeners = new Set<() => void>()

export function getActiveFilter(): string { return _filter }

export function setActiveFilter(text: string) {
  _filter = text
  if (text) sessionStorage.setItem('from_filter', text)
  else sessionStorage.removeItem('from_filter')
  _listeners.forEach(l => l())
}

/** Hook reactivo: devuelve [filter, setter]. Re-renderiza cuando cambia desde cualquier sitio. */
export function useFilterStore(): [string, (t: string) => void] {
  const [val, setVal] = useState(_filter)
  useEffect(() => {
    const listener = () => setVal(_filter)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])
  return [val, setActiveFilter]
}
