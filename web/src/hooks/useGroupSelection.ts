// Selección múltiple + «Crear grupo (N)» — mecanismo COMPARTIDO entre la tab
// global Elementos (ElementsPanel.tsx) y la lista de Elementos DENTRO de un
// contexto (V2ContextView.tsx). Extraído el 25 ago 2026 (Alberto: "lo de
// seleccionar elementos también debe poder hacerse en la lista de elementos de
// un contexto concreto") para no duplicar la misma lógica de estado dos veces —
// un grupo creado desde cualquiera de los dos sitios es el MISMO mecanismo
// (utils/groups.ts): mismo modelo, mismo enlace público.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createGroup } from '../utils/groups'
import type { Node } from '../types'

export function useGroupSelection(onCreated: (created: Node) => void) {
  const { t } = useTranslation()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function enterSelectMode() { setSelectMode(true) }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }
  function toggleSelectMode() { selectMode ? exitSelectMode() : enterSelectMode() }
  function selectAll(ids: string[]) { setSelected(new Set(ids)) }

  function createGroupFromSelection() {
    const ids = [...selected]
    if (ids.length < 2) return
    const created = createGroup(t('group.defaultName', 'Grupo nuevo'), ids)
    exitSelectMode()
    onCreated(created)
  }

  return {
    selectMode, selected,
    toggleSelect, enterSelectMode, exitSelectMode, toggleSelectMode, selectAll,
    createGroupFromSelection,
  }
}
