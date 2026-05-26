// Polyfill localStorage para tests en entornos sin DOM (o con localStorage roto)
{
  const _store: Record<string, string> = {}
  const stub: Storage = {
    getItem: (k: string) => (k in _store ? _store[k] : null),
    setItem: (k: string, v: string) => { _store[k] = String(v) },
    removeItem: (k: string) => { delete _store[k] },
    clear: () => { for (const k of Object.keys(_store)) delete _store[k] },
    key: (i: number) => Object.keys(_store)[i] ?? null,
    get length() { return Object.keys(_store).length },
  }
  // Forzar override (Node 25+ trae un localStorage parcial via --localstorage-file)
  Object.defineProperty(globalThis, 'localStorage', { value: stub, writable: true, configurable: true })
}
