// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — Cliente de SYNC POR OPERACIONES (web). DOBLE ESCRITURA EN SOMBRA.
//
// Cada mutación del nodeStore (create/update/move/delete) además emite una op a
// un OUTBOX local persistente. Un bucle hace push del outbox → pull desde seq →
// aplica al ESTADO SOMBRA (NUNCA toca this.nodes) → COMPARA con el estado real
// del sync por estado y loguea divergencias.
//
// SEGURIDAD:
//   · Todo detrás del flag localStorage `from_ops_v1` (default OFF) → inerte.
//   · No toca el estado real ni el /sync actual: corre en paralelo.
//   · El motor (HLC, applyOp) es COPIA BYTE A BYTE de server/src/lib/ops.ts
//     (debe coincidir, igual que los ids deterministas).
// ─────────────────────────────────────────────────────────────────────────────

import { apiRequest, getToken } from "../api/client"
import { generateId } from "../utils/id"
import type { Node } from "../types"

// ══ MOTOR (copia exacta de server/src/lib/ops.ts) ════════════════════════════

export interface HLC { wall: number; counter: number; node: string }
const WALL_PAD = 15, COUNTER_PAD = 6

export function hlcToString(h: HLC): string {
  return `${String(h.wall).padStart(WALL_PAD, "0")}:${String(h.counter).padStart(COUNTER_PAD, "0")}:${h.node}`
}
export function parseHLC(s: string): HLC {
  const i1 = s.indexOf(":"), i2 = s.indexOf(":", i1 + 1)
  return { wall: Number(s.slice(0, i1)), counter: Number(s.slice(i1 + 1, i2)), node: s.slice(i2 + 1) }
}
export function hlcCompare(a: string, b: string): number { return a === b ? 0 : a < b ? -1 : 1 }
export function hlcSend(prev: HLC | null, deviceId: string, nowWall: number): HLC {
  const pw = prev?.wall ?? 0
  const wall = Math.max(pw, nowWall)
  const counter = wall === pw ? (prev?.counter ?? 0) + 1 : 0
  return { wall, counter, node: deviceId }
}
export function hlcReceive(local: HLC | null, remote: HLC, deviceId: string, nowWall: number): HLC {
  const lw = local?.wall ?? 0
  const wall = Math.max(lw, remote.wall, nowWall)
  let counter: number
  if (wall === lw && wall === remote.wall) counter = Math.max(local!.counter, remote.counter) + 1
  else if (wall === lw) counter = (local?.counter ?? 0) + 1
  else if (wall === remote.wall) counter = remote.counter + 1
  else counter = 0
  return { wall, counter, node: deviceId }
}

export type OpType = "create" | "set" | "move" | "delete" | "restore"
export interface OpPayload { parentId?: string | null; siblingOrder?: number; fields?: Record<string, unknown> }
export interface Op { opId: string; userId?: string; nodeId: string; type: OpType; payload: OpPayload; hlc: string; deviceId: string; seq?: number }

interface NodeState {
  id: string; parentId: string | null; siblingOrder: number
  fields: Record<string, unknown>; deleted: boolean
  fieldClocks: Record<string, string>; moveClock: string; lifeClock: string
}
type State = Map<string, NodeState>

function emptyNode(id: string): NodeState {
  return { id, parentId: null, siblingOrder: 0, fields: {}, deleted: false, fieldClocks: {}, moveClock: "", lifeClock: "" }
}
function ensure(state: State, nodeId: string): NodeState {
  let n = state.get(nodeId); if (!n) { n = emptyNode(nodeId); state.set(nodeId, n) } return n
}
function setField(n: NodeState, field: string, value: unknown, hlc: string): void {
  if (hlcCompare(hlc, n.fieldClocks[field] ?? "") > 0) { n.fields[field] = value; n.fieldClocks[field] = hlc }
}
function wouldCycle(state: State, nodeId: string, candidate: string | null): boolean {
  let cur = candidate; const guard = new Set<string>()
  while (cur) { if (cur === nodeId) return true; if (guard.has(cur)) return true; guard.add(cur); cur = state.get(cur)?.parentId ?? null }
  return false
}
function applyStructural(state: State, n: NodeState, parentId: string | null | undefined, siblingOrder: number | undefined, hlc: string): void {
  if (hlcCompare(hlc, n.moveClock) <= 0) return
  const nextParent = parentId === undefined ? n.parentId : parentId
  if (wouldCycle(state, n.id, nextParent)) return
  n.parentId = nextParent
  if (siblingOrder !== undefined) n.siblingOrder = siblingOrder
  n.moveClock = hlc
}
export function applyOp(state: State, op: Op): void {
  switch (op.type) {
    case "create": {
      const n = ensure(state, op.nodeId)
      applyStructural(state, n, op.payload.parentId, op.payload.siblingOrder, op.hlc)
      for (const [f, v] of Object.entries(op.payload.fields ?? {})) setField(n, f, v, op.hlc)
      break
    }
    case "set": { const n = ensure(state, op.nodeId); for (const [f, v] of Object.entries(op.payload.fields ?? {})) setField(n, f, v, op.hlc); break }
    case "move": { const n = ensure(state, op.nodeId); applyStructural(state, n, op.payload.parentId, op.payload.siblingOrder, op.hlc); break }
    case "delete": { const n = ensure(state, op.nodeId); if (hlcCompare(op.hlc, n.lifeClock) > 0) { n.deleted = true; n.lifeClock = op.hlc } break }
    case "restore": { const n = ensure(state, op.nodeId); if (hlcCompare(op.hlc, n.lifeClock) > 0) { n.deleted = false; n.lifeClock = op.hlc } break }
  }
}

// ══ Normalización (copia de server/src/lib/opsLog.ts) ═════════════════════════

export const DATA_FIELDS = [
  "workspaceId", "text", "body", "types", "collections", "status",
  "isActive", "isEvent", "isSeguimiento", "isDiaryEntry", "isChat", "isCollapsed",
  "due", "dueEnd", "priority", "recurrence", "isFavorite", "seguimientoOrder",
  "diaryDate", "appleId", "appleCalId", "publicSlug", "gdocId", "gdocAccount",
  "gdocUrl", "extraData", "color", "block", "gcalEventId", "location",
  "isResource", "icon", "resourceUrl", "resourceType", "resourceStatus", "props",
  "isInline", "isAtomic", "isQuick",
] as const
const ARRAY_FIELDS = new Set(["types", "collections"])
const DATE_FIELDS = new Set(["due", "dueEnd", "diaryDate"])

export function normField(field: string, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null
  if (ARRAY_FIELDS.has(field)) {
    if (Array.isArray(raw)) return JSON.stringify(raw)
    if (typeof raw === "string") { try { return JSON.stringify(JSON.parse(raw)) } catch { return raw } }
    return JSON.stringify(raw)
  }
  if (DATE_FIELDS.has(field)) { const d = raw instanceof Date ? raw : new Date(raw as string); return isNaN(d.getTime()) ? null : d.toISOString() }
  return raw
}
function projectFields(n: Record<string, unknown>): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  for (const k of DATA_FIELDS) f[k] = normField(k, n[k])
  return f
}

// ══ Persistencia local ════════════════════════════════════════════════════════

const K_FLAG = "from_ops_v1"
const K_DEVICE = "from_device_id"
const K_HLC = "from_ops_hlc"
const K_OUTBOX = "from_ops_outbox"
const K_SEQ = "from_ops_seq"

export function opsEnabled(): boolean {
  try { return localStorage.getItem(K_FLAG) === "1" } catch { return false }
}
function deviceId(): string {
  let d = localStorage.getItem(K_DEVICE)
  if (!d) { d = generateId(); localStorage.setItem(K_DEVICE, d) }
  return d
}
function loadHlc(): HLC | null { try { const s = localStorage.getItem(K_HLC); return s ? parseHLC(s) : null } catch { return null } }
function saveHlc(h: HLC) { try { localStorage.setItem(K_HLC, hlcToString(h)) } catch {} }
function loadOutbox(): Op[] { try { return JSON.parse(localStorage.getItem(K_OUTBOX) ?? "[]") } catch { return [] } }
function saveOutbox(ops: Op[]) { try { localStorage.setItem(K_OUTBOX, JSON.stringify(ops)) } catch {} }
function saveSeq(n: number) { try { localStorage.setItem(K_SEQ, String(n)) } catch {} }

// ══ Cliente de ops ════════════════════════════════════════════════════════════

class OpsClient {
  private outbox: Op[] = []
  private hlc: HLC | null = null
  private counter = 0
  private shadow: State = new Map()
  private pulledSeq = 0
  private started = false
  private timer: ReturnType<typeof setInterval> | null = null
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private getReal: (() => Map<string, Node>) | null = null

  private nextHlc(): string {
    this.hlc = hlcSend(this.hlc, deviceId(), Date.now())
    saveHlc(this.hlc)
    return hlcToString(this.hlc)
  }
  private enqueue(nodeId: string, type: OpType, payload: OpPayload) {
    const hlc = this.nextHlc()
    const opId = `${deviceId()}:${++this.counter}:${hlc}`
    this.outbox.push({ opId, nodeId, type, payload, hlc, deviceId: deviceId() })
    saveOutbox(this.outbox)
    this.schedulePush()
  }

  /** Mutación: nodo nuevo → op create con todos los campos. */
  onCreate(node: Node) {
    if (!opsEnabled()) return
    this.enqueue(node.id, "create", {
      parentId: node.parentId ?? null,
      siblingOrder: typeof node.siblingOrder === "number" ? node.siblingOrder : 0,
      fields: projectFields(node as unknown as Record<string, unknown>),
    })
  }

  /** Mutación: updateNode(id, changes). Deriva set / move / delete / restore. */
  onUpdate(prev: Node, changes: Partial<Node>, next: Node) {
    if (!opsEnabled()) return
    // Vida
    if ("deletedAt" in changes) {
      if (changes.deletedAt && !prev.deletedAt) this.enqueue(next.id, "delete", {})
      else if (!changes.deletedAt && prev.deletedAt) this.enqueue(next.id, "restore", {})
    }
    // Campos de datos cambiados
    const fields: Record<string, unknown> = {}
    for (const k of DATA_FIELDS) {
      if (k in changes) {
        const nv = normField(k, (next as unknown as Record<string, unknown>)[k])
        if (JSON.stringify(nv) !== JSON.stringify(normField(k, (prev as unknown as Record<string, unknown>)[k]))) fields[k] = nv
      }
    }
    if (Object.keys(fields).length) this.enqueue(next.id, "set", { fields })
    // Estructura
    if ("parentId" in changes || "siblingOrder" in changes) {
      this.enqueue(next.id, "move", {
        parentId: next.parentId ?? null,
        siblingOrder: typeof next.siblingOrder === "number" ? next.siblingOrder : 0,
      })
    }
  }

  private schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => { void this.pushOutbox() }, 2000)
  }

  async pushOutbox(): Promise<void> {
    if (!opsEnabled() || !getToken()) return
    if (this.outbox.length === 0) return
    const batch = this.outbox.slice(0, 500)
    try {
      const res = await apiRequest<{ accepted: number; deduped: number; invalid: number; latestSeq: number }>(
        "/ops/push", { method: "POST", body: JSON.stringify({ ops: batch }) },
      )
      // Procesadas (aceptadas o ya existentes) → quitar del outbox
      this.outbox = this.outbox.slice(batch.length)
      saveOutbox(this.outbox)
      console.log(`[ops] push: +${res.accepted} aceptadas, ${res.deduped} dedupe, ${res.invalid} inválidas, latestSeq=${res.latestSeq}`)
    } catch (e) {
      console.warn("[ops] push falló (se reintenta):", e)
    }
  }

  async pullAndApply(): Promise<void> {
    if (!opsEnabled() || !getToken()) return
    try {
      for (let guard = 0; guard < 20; guard++) {
        const res = await apiRequest<{ ops: Op[]; hasMore: boolean; latestSeq: number }>(
          `/ops/pull?since=${this.pulledSeq}&limit=2000`, { method: "GET" },
        )
        if (res.ops.length === 0) break
        let maxRemote: HLC | null = null
        for (const op of res.ops) {
          applyOp(this.shadow, op)
          const h = parseHLC(op.hlc)
          if (!maxRemote || hlcCompare(op.hlc, hlcToString(maxRemote)) > 0) maxRemote = h
        }
        if (maxRemote) { this.hlc = hlcReceive(this.hlc, maxRemote, deviceId(), Date.now()); saveHlc(this.hlc) }
        this.pulledSeq = res.latestSeq
        saveSeq(this.pulledSeq)
        if (!res.hasMore) break
      }
    } catch (e) {
      console.warn("[ops] pull falló:", e)
    }
  }

  /** Compara el estado SOMBRA (replay de ops) con el estado REAL del cliente. */
  compareToState(): { match: boolean; missingInShadow: number; missingInReal: number; fieldDiffs: number } {
    const real = this.getReal?.() ?? new Map<string, Node>()
    const realProj = new Map<string, { parentId: string | null; siblingOrder: number; fields: Record<string, unknown> }>()
    for (const n of real.values()) {
      if (n.deletedAt) continue
      realProj.set(n.id, { parentId: n.parentId ?? null, siblingOrder: typeof n.siblingOrder === "number" ? n.siblingOrder : 0, fields: projectFields(n as unknown as Record<string, unknown>) })
    }
    const shadowProj = new Map<string, { parentId: string | null; siblingOrder: number; fields: Record<string, unknown> }>()
    for (const n of this.shadow.values()) {
      if (n.deleted) continue
      const fields: Record<string, unknown> = {}
      for (const f of DATA_FIELDS) fields[f] = n.fields[f] ?? null
      shadowProj.set(n.id, { parentId: n.parentId, siblingOrder: n.siblingOrder, fields })
    }
    let missingInShadow = 0, missingInReal = 0, fieldDiffs = 0
    const hist: Record<string, number> = {}
    const samples: Array<Record<string, unknown>> = []
    for (const [id, r] of realProj) {
      const s = shadowProj.get(id)
      if (!s) { missingInShadow++; continue }
      const diffFields: string[] = []
      if (r.parentId !== s.parentId) diffFields.push("parentId")
      if (r.siblingOrder !== s.siblingOrder) diffFields.push("siblingOrder")
      for (const f of DATA_FIELDS) if (JSON.stringify(r.fields[f]) !== JSON.stringify(s.fields[f])) diffFields.push(f)
      if (diffFields.length) {
        fieldDiffs++
        for (const f of diffFields) hist[f] = (hist[f] ?? 0) + 1
        if (samples.length < 3) {
          const real_: Record<string, unknown> = {}, shadow_: Record<string, unknown> = {}
          for (const f of diffFields) {
            real_[f] = f === "parentId" ? r.parentId : f === "siblingOrder" ? r.siblingOrder : r.fields[f]
            shadow_[f] = f === "parentId" ? s.parentId : f === "siblingOrder" ? s.siblingOrder : s.fields[f]
          }
          samples.push({ id, diffFields, real: real_, shadow: shadow_ })
        }
      }
    }
    for (const id of shadowProj.keys()) if (!realProj.has(id)) missingInReal++
    const match = missingInShadow === 0 && missingInReal === 0 && fieldDiffs === 0
    console.log(`[ops] compare: match=${match} shadowLive=${shadowProj.size} realLive=${realProj.size} missingInShadow=${missingInShadow} missingInReal=${missingInReal} fieldDiffs=${fieldDiffs}`)
    if (fieldDiffs) {
      console.log("[ops] fieldDiff histograma (campo→nº nodos):", hist)
      console.log("[ops] muestra de diffs (real vs shadow):", samples)
    }
    return { match, missingInShadow, missingInReal, fieldDiffs }
  }

  /** Arranca el bucle en sombra (idempotente). `getReal` devuelve el Map de nodos real. */
  start(getReal: () => Map<string, Node>) {
    if (!opsEnabled() || this.started) return
    this.started = true
    this.getReal = getReal
    this.outbox = loadOutbox()
    this.hlc = loadHlc()
    // El estado SOMBRA vive en memoria y se reinicia al recargar; por eso NO
    // reutilizamos el cursor persistido (causaría un shadow incompleto). Se
    // reconstruye el shadow ENTERO desde seq 0 en cada arranque. (En Fase 5 se
    // persistirá un snapshot del estado materializado para no re-pullear todo.)
    this.pulledSeq = 0
    this.shadow = new Map()
    const cycle = async () => { await this.pushOutbox(); await this.pullAndApply(); this.compareToState() }
    void cycle()
    this.timer = setInterval(() => { void cycle() }, 20_000)
    console.info("[ops] cliente de operaciones en SOMBRA iniciado (flag from_ops_v1)")
  }
  stop() {
    if (this.timer) clearInterval(this.timer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.timer = null; this.started = false
  }
}

export const opsClient = new OpsClient()
