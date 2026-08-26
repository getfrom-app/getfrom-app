// ─────────────────────────────────────────────────────────────────────────────
// PARIDAD servidor/web del motor de sync-por-operaciones.
//
// El motor (HLC + applyOp) vive reimplementado por separado en este archivo
// (landing/web/src/store/opsClient.ts) y en server/src/lib/ops.ts — sin tipo ni
// paquete compartido, "debe coincidir byte a byte" solo por disciplina manual.
// Este vector de operaciones (mismo literal, duplicado también en
// server/src/lib/opsParity.test.ts) es la única red real: si alguna de las dos
// implementaciones diverge, el test de ESE lado falla. No sustituye a un
// contrato compartido, pero convierte una divergencia silenciosa en un fallo
// de CI en vez de un bug de datos descubierto en producción.
//
// ⚠️ LÍMITE HONESTO (auditoría del 26 ago): esto NO compara las dos
// implementaciones entre sí en el mismo proceso — cada lado corre el mismo
// fixture contra SU PROPIO applyOp. Un bug idéntico presente en ambas
// implementaciones no lo detecta este test. Se descartó un test cruzado real
// (importar server/src/lib/ops.ts directamente desde aquí) porque el CI de
// este repo (landing/.github/workflows/ci.yml) solo hace checkout de este
// repo — server/ no existe como sibling ahí y el import rompería el pipeline.
//
// IMPORTANTE: si tocas esto, aplica el MISMO cambio (payload Y userId de cada
// op) al fixture del otro lado.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest"
import { applyOp, hlcToString, type Op } from "../store/opsClient"

function mk(wall: number, counter: number, node: string): string {
  return hlcToString({ wall, counter, node })
}

// Escenario: dos nodos (folder1, n1), dos dispositivos (devA, devB), ops
// aplicadas en un orden DELIBERADAMENTE fuera de secuencia — el motor debe
// converger al mismo estado sin importar el orden de llegada (conmutatividad
// por HLC total).
const ops: Op[] = [
  { opId: "1", userId: "u1", nodeId: "n1", type: "create", deviceId: "devA", hlc: mk(1000, 0, "devA"),
    payload: { parentId: null, fields: { text: "hola" } } },
  { opId: "2", userId: "u1", nodeId: "n1", type: "set", deviceId: "devB", hlc: mk(1000, 1, "devB"),
    payload: { fields: { text: "mundo" } } }, // más reciente que #1 → gana
  { opId: "3", userId: "u1", nodeId: "n1", type: "set", deviceId: "devA", hlc: mk(999, 5, "devA"),
    payload: { fields: { text: "descartado (hlc menor que la create)" } } }, // debe ignorarse
  { opId: "4", userId: "u1", nodeId: "folder1", type: "create", deviceId: "devA", hlc: mk(900, 0, "devA"),
    payload: { parentId: null, fields: {} } },
  { opId: "5", userId: "u1", nodeId: "n1", type: "move", deviceId: "devA", hlc: mk(1001, 0, "devA"),
    payload: { parentId: "folder1" } },
  { opId: "6", userId: "u1", nodeId: "folder1", type: "move", deviceId: "devB", hlc: mk(1002, 0, "devB"),
    payload: { parentId: "n1" } }, // crearía un ciclo (n1 ya cuelga de folder1) → debe rechazarse
  { opId: "7", userId: "u1", nodeId: "n1", type: "delete", deviceId: "devA", hlc: mk(1010, 0, "devA"),
    payload: {} },
  { opId: "8", userId: "u1", nodeId: "n1", type: "restore", deviceId: "devB", hlc: mk(1005, 0, "devB"),
    payload: {} }, // anterior al delete → debe ignorarse, sigue borrado
  { opId: "9", userId: "u1", nodeId: "n1", type: "restore", deviceId: "devB", hlc: mk(1020, 0, "devB"),
    payload: {} }, // posterior al delete → restaura de verdad
]

// Orden de aplicación deliberadamente revuelto respecto al orden causal.
const scrambledOrder = [8, 5, 1, 9, 2, 6, 7, 3, 4].map((i) => ops[i - 1])

describe("paridad servidor/web — vector de ops compartido", () => {
  it("converge al mismo estado final sin importar el orden de llegada", () => {
    const state = new Map()
    for (const op of scrambledOrder) applyOp(state, op)

    const n1 = state.get("n1")!
    const folder1 = state.get("folder1")!

    expect(n1.fields.text).toBe("mundo")           // #2 gana sobre #1 y #3
    expect(n1.parentId).toBe("folder1")             // #5 aplicado
    expect(folder1.parentId).toBe(null)             // #6 rechazado por ciclo
    expect(n1.deleted).toBe(false)                  // #9 gana sobre #7 y #8
  })

  it("es idempotente: reaplicar todas las ops no cambia el resultado", () => {
    const state = new Map()
    for (const op of scrambledOrder) applyOp(state, op)
    for (const op of scrambledOrder) applyOp(state, op) // segunda pasada completa

    const n1 = state.get("n1")!
    expect(n1.fields.text).toBe("mundo")
    expect(n1.parentId).toBe("folder1")
    expect(n1.deleted).toBe(false)
  })
})
