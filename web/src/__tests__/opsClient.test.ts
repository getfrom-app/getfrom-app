import { describe, it, expect } from 'vitest'
import { normField } from '../store/opsClient'

// ─────────────────────────────────────────────────────────────────────────────
// REGRESIÓN: el motor de ops DEBE coincidir byte a byte en web/servidor/iOS.
// `normField` desanida los campos array (types/collections) con 6 iteraciones de
// JSON.parse en los 3 clientes. La web tenía 4 → ante encoding histórico profundo
// materializaba un array DISTINTO al servidor/iOS y el árbol divergía en silencio.
// Estos tests fijan el contrato. Si alguien baja el contador de iteraciones, fallan.
// ─────────────────────────────────────────────────────────────────────────────

describe('opsClient.normField — desanidado robusto (paridad web/servidor/iOS)', () => {
  it('array directo → JSON canónico', () => {
    expect(normField('types', ['a', 'b'])).toBe('["a","b"]')
  })

  it('encoding simple (1 nivel)', () => {
    expect(normField('types', '["a"]')).toBe('["a"]')
  })

  it('encoding profundo de 5 niveles converge al array real (requiere 6 iteraciones)', () => {
    let v: unknown = ['x', 'y']
    for (let i = 0; i < 5; i++) v = JSON.stringify(v) // 5 capas de string
    // Con 4 iteraciones (bug previo) esto daría "[]"; con 6 da el array correcto.
    expect(normField('types', v)).toBe('["x","y"]')
  })

  it('valor no-array → array vacío canónico', () => {
    expect(normField('types', 'no-soy-json')).toBe('[]')
  })

  it('campo no-array (text) pasa el valor tal cual', () => {
    expect(normField('text', 'hola')).toBe('hola')
  })

  it('colecciones se tratan igual que types', () => {
    expect(normField('collections', '"[\\"c1\\"]"')).toBe('["c1"]')
  })
})
