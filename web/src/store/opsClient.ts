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
const BOOL_FIELDS = new Set([
  "isActive", "isEvent", "isSeguimiento", "isDiaryEntry", "isChat", "isCollapsed",
  "isFavorite", "isResource", "isInline", "isAtomic", "isQuick",
])

export function normField(field: string, raw: unknown): unknown {
  if (ARRAY_FIELDS.has(field)) {
    // Des-codifica robustamente: tolera doble/triple-encoding histórico
    // (columnas con '"[\\"x\\"]"' en vez de '["x"]'). Hasta llegar al array real.
    let v: unknown = raw
    for (let i = 0; i < 4 && typeof v === "string"; i++) { try { v = JSON.parse(v) } catch { break } }
    return JSON.stringify(Array.isArray(v) ? v : [])
  }
  if (BOOL_FIELDS.has(field)) return raw === true || raw === "true" // default canónico false
  if (raw === undefined || raw === null) return null
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
  private initialPullDone = false  // tras el primer pull, los siguientes se aplican como deltas
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
    if (!this.isEnabled()) return
    this.enqueue(node.id, "create", {
      parentId: node.parentId ?? null,
      siblingOrder: typeof node.siblingOrder === "number" ? node.siblingOrder : 0,
      fields: projectFields(node as unknown as Record<string, unknown>),
    })
  }

  /** Mutación: updateNode(id, changes). Deriva set / move / delete / restore. */
  onUpdate(prev: Node, changes: Partial<Node>, next: Node) {
    if (!this.isEnabled()) return
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
    if (!this.isEnabled() || !getToken()) return
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
    if (!this.isEnabled() || !getToken()) return
    const myDevice = deviceId()
    const wasInitial = !this.initialPullDone
    try {
      for (let guard = 0; guard < 50; guard++) {
        const res = await apiRequest<{ ops: Op[]; hasMore: boolean; latestSeq: number }>(
          `/ops/pull?since=${this.pulledSeq}&limit=2000`, { method: "GET" },
        )
        if (res.ops.length === 0) break
        let maxRemote: HLC | null = null
        const changed = new Set<string>()
        for (const op of res.ops) {
          applyOp(this.shadow, op)
          const h = parseHLC(op.hlc)
          if (!maxRemote || hlcCompare(op.hlc, hlcToString(maxRemote)) > 0) maxRemote = h
          // Modo-live: aplicar al estado REAL sólo los DELTAS de OTROS dispositivos
          // y sólo TRAS el primer pull (el estado base ya está cargado por /sync).
          // Esto evita el rebuild completo cada ciclo (que causaba el parpadeo).
          if (this.live && this.initialPullDone && op.deviceId !== myDevice) changed.add(op.nodeId)
        }
        if (maxRemote) { this.hlc = hlcReceive(this.hlc, maxRemote, deviceId(), Date.now()); saveHlc(this.hlc) }
        if (changed.size && this.applyExternal) {
          const nodes = [...changed]
            .map((id) => this.shadow.get(id))
            .filter((n): n is NodeState => !!n)
            .map((n) => this.shadowToNode(n))
          this.applyExternal(nodes)
        }
        this.pulledSeq = res.latestSeq
        saveSeq(this.pulledSeq)
        if (!res.hasMore) break
      }
      // BOOTSTRAP: en el PRIMER pull en modo-live, sembrar el estado real con TODO
      // el árbol (vivos + borrados → applyNode marca los borrados). Sustituye al
      // bootstrap por /sync. Después, sólo deltas. La siembra es idempotente.
      if (wasInitial && this.live && this.applyExternal) {
        const all = [...this.shadow.values()].map((n) => this.shadowToNode(n))
        this.applyExternal(all)
        this.lastSeededLive = all.filter((n) => !n.deletedAt).length
        console.info(`[ops] bootstrap: ${this.lastSeededLive} nodos vivos sembrados desde el op-log`)
      }
      this.initialPullDone = true // tras el primer pull completo, lo siguiente son deltas
    } catch (e) {
      console.warn("[ops] pull falló:", e)
      if (wasInitial) throw e   // bootstrap necesita saber si el pull inicial falló
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
      for (const f of DATA_FIELDS) fields[f] = normField(f, n.fields[f]) // misma normalización robusta que el real
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

  /** Callback para aplicar nodos reconstruidos desde ops al estado real (modo-live). */
  private applyExternal: ((nodes: Node[]) => void) | null = null

  /** Convierte un nodo del estado SOMBRA (motor de ops) a un Node del store. */
  private shadowToNode(n: NodeState): Node {
    const f = n.fields
    // Des-codifica robustamente (igual que normField): tolera el doble/triple-encoding
    // histórico del op-log ('"[\"x\"]"') hasta llegar al array real.
    const arr = (v: unknown): string[] => {
      let x: unknown = v
      for (let i = 0; i < 6 && typeof x === "string"; i++) { try { x = JSON.parse(x) } catch { break } }
      return Array.isArray(x) ? (x as string[]) : []
    }
    const s = (v: unknown): string | null => (v == null ? null : String(v))
    const now = "1970-01-01T00:00:00.000Z"
    return {
      id: n.id,
      parentId: n.parentId,
      siblingOrder: n.siblingOrder,
      text: String(f.text ?? ""),
      body: s(f.body),
      types: arr(f.types),
      collections: arr(f.collections),
      status: s(f.status) as Node["status"],
      isActive: f.isActive === true, isEvent: f.isEvent === true,
      isDiaryEntry: f.isDiaryEntry === true, isChat: f.isChat === true,
      isCollapsed: f.isCollapsed === true, isFavorite: f.isFavorite === true,
      isResource: f.isResource === true, isInline: f.isInline === true,
      isAtomic: f.isAtomic === true, isQuick: f.isQuick === true,
      isSeguimiento: f.isSeguimiento === true,
      due: s(f.due), dueEnd: s(f.dueEnd), diaryDate: s(f.diaryDate),
      priority: s(f.priority) as Node["priority"], recurrence: s(f.recurrence),
      seguimientoOrder: (f.seguimientoOrder as number | undefined) ?? null,
      color: s(f.color), block: s(f.block), gcalEventId: s(f.gcalEventId), location: s(f.location),
      icon: s(f.icon), resourceUrl: s(f.resourceUrl), resourceType: s(f.resourceType), resourceStatus: s(f.resourceStatus),
      props: s(f.props), extraData: s(f.extraData),
      appleId: s(f.appleId), appleCalId: s(f.appleCalId), publicSlug: s(f.publicSlug),
      gdocId: s(f.gdocId), gdocAccount: s(f.gdocAccount), gdocUrl: s(f.gdocUrl),
      workspaceId: String(f.workspaceId ?? "00000000-0000-0000-0000-000000000001"),
      // En modo-live propagamos también los borrados (deleted → deletedAt no-null).
      deletedAt: n.deleted ? "2000-01-01T00:00:00.000Z" : null,
      createdAt: now, updatedAt: now,
    } as Node
  }

  /** PRUEBA DEL FLIP: reconstruye el estado real desde el op-log (estado sombra) y
   *  lo aplica al store. Demuestra que op-based puede ser la fuente de verdad.
   *  Reversible: recargar la página restaura desde /sync. Invocable: window.fromOpsRebuild() */
  rebuildRealFromShadow(): { applied: number } {
    const nodes = [...this.shadow.values()].filter((n) => !n.deleted).map((n) => this.shadowToNode(n))
    this.applyExternal?.(nodes)
    console.log(`[ops] REBUILD: ${nodes.length} nodos reconstruidos desde el op-log y aplicados al estado real`)
    return { applied: nodes.length }
  }

  /** Activación CENTRAL desde el servidor (campo opsClientEnabled del /sync).
   *  El localStorage `from_ops_v1` queda como override de desarrollo opcional. */
  private serverEnabled = false
  // En PRODUCCIÓN manda el servidor (opsClientEnabled). El localStorage `from_ops_v1`
  // solo sirve como override en desarrollo local — así el usuario nunca gestiona flags.
  private isEnabled(): boolean { return (import.meta.env.DEV && opsEnabled()) || this.serverEnabled }
  setServerEnabled(v: boolean) { this.serverEnabled = v; this.maybeStart() }

  /** MODO-LIVE (Fase 7): op-based es el transporte. Cuando true, el cliente
   *  aplica las ops al estado REAL continuamente y NO usa /sync. */
  private live = false
  isLive(): boolean { return this.live }
  setLive(v: boolean) {
    if (this.live === v) return
    this.live = v
    if (v) { this.serverEnabled = true; this.maybeStart() } // live implica activo
  }

  /** ¿Ya se decidió el transporte (op-based vs /sync)? Hasta entonces, el store NO
   *  debe llamar a /sync (evita la carrera donde un sync() temprano dispara un
   *  /sync completo antes de que el bootstrap marque modo-live). */
  private decided = false
  bootstrapDecided(): boolean { return this.decided }
  /** Nº de nodos vivos sembrados en el último bootstrap (para sanity-check). */
  private lastSeededLive = 0

  /** Registra los callbacks del store (siempre). NO arranca nada: el arranque lo
   *  conduce bootstrap() (modo-live) o el primer sync() (no-live). */
  configure(getReal: () => Map<string, Node>, applyExternal?: (nodes: Node[]) => void) {
    this.getReal = getReal
    this.applyExternal = applyExternal ?? null
  }

  private setupState() {
    this.outbox = loadOutbox()
    this.hlc = loadHlc()
    // El estado SOMBRA se reconstruye ENTERO desde seq 0 en cada arranque.
    this.pulledSeq = 0
    this.shadow = new Map()
    this.initialPullDone = false
  }
  private async cycle(): Promise<void> {
    await this.pushOutbox()
    await this.pullAndApply()   // en modo-live aplica DELTAS (y siembra en el 1er pull)
    if (!this.live) this.compareToState()  // compare sólo en sombra
  }

  /** Arranca el bucle (idempotente). Sólo si está activo (server o localStorage). */
  private maybeStart() {
    if (!this.isEnabled() || this.started || !this.getReal) return
    this.started = true
    this.setupState()
    void this.cycle()
    this.timer = setInterval(() => { void this.cycle() }, 20_000)
    console.info("[ops] cliente de operaciones iniciado (server/localStorage)")
  }

  /** BOOTSTRAP robusto sin /sync. Lee /ops/config; si modo-live, construye el
   *  estado SOMBRA desde seq 0 y SIEMBRA el estado real (AWAIT, una vez), luego
   *  arranca el bucle de deltas. Devuelve el nº de nodos vivos sembrados, o null
   *  si NO es modo-live o el arranque falló (→ el caller hace fallback a /sync). */
  async bootstrap(): Promise<number | null> {
    if (!getToken() || !this.getReal) return null
    let cfg: { opsClientEnabled?: boolean; opsLive?: boolean }
    try { cfg = await apiRequest<{ opsClientEnabled?: boolean; opsLive?: boolean }>("/ops/config", { method: "GET" }) }
    catch (e) { console.warn("[ops] /ops/config falló → fallback /sync:", e); this.decided = true; return null }
    this.serverEnabled = !!cfg.opsClientEnabled
    this.decided = true
    if (!cfg.opsLive) { this.maybeStart(); return null }  // no-live → bootstrap por /sync
    // Modo-live: SIEMBRA awaited y limpia (cancela cualquier ciclo previo).
    this.live = true
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.started = true
    this.setupState()
    try {
      await this.cycle()   // construye sombra seq0 + SIEMBRA el estado real (awaited)
    } catch (e) {
      console.warn("[ops] bootstrap: pull inicial falló → fallback /sync:", e)
      this.live = false; this.started = false
      return null
    }
    this.timer = setInterval(() => { void this.cycle() }, 20_000)
    console.info("[ops] bootstrap modo-live completado (sin /sync)")
    return this.lastSeededLive
  }

  /** Desactiva modo-live (emergencia): el store vuelve a /sync. */
  forceSyncFallback() {
    this.live = false
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.started = false
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.timer = null; this.started = false
  }
}

export const opsClient = new OpsClient()
