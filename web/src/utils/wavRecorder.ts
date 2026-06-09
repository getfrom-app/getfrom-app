// MARK: - WavRecorder
//
// Graba el micrófono y produce un WAV mono a 16 kHz (formato que aceptan tanto
// Gemini como Whisper). Sustituye al Web Speech API del navegador (poco fiable):
// aquí solo capturamos audio; la transcripción la hace el servidor (/ai/transcribe).
//
// Expone `analyser` para que la UI dibuje la onda usando el MISMO stream.

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  let len = 0
  for (const c of chunks) len += c.length
  const out = new Float32Array(len)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}

function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input
  const ratio = inRate / outRate
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    // Promedio simple del bloque → anti-aliasing básico
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : input[start] || 0
  }
  return out
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)          // subchunk1 size
  view.setUint16(20, 1, true)           // PCM
  view.setUint16(22, 1, true)           // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)           // block align
  view.setUint16(34, 16, true)          // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return buffer
}

const OUT_RATE = 16000

export class WavRecorder {
  analyser: AnalyserNode | null = null
  private ctx: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private chunks: Float32Array[] = []
  private inRate = 48000
  recording = false

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.inRate = this.ctx.sampleRate
    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 128
    this.source.connect(this.analyser)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.chunks = []
    this.processor.onaudioprocess = (e) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }
    this.source.connect(this.processor)
    this.processor.connect(this.ctx.destination)
    this.recording = true
  }

  /** Detiene y devuelve el WAV (mono 16 kHz). Si no se grabó nada, devuelve null. */
  stop(): Blob | null {
    this.recording = false
    try { this.processor?.disconnect() } catch { /* */ }
    try { this.source?.disconnect() } catch { /* */ }
    try { this.stream?.getTracks().forEach(t => t.stop()) } catch { /* */ }
    try { this.ctx?.close() } catch { /* */ }
    const merged = mergeFloat32(this.chunks)
    this.chunks = []
    this.analyser = null
    if (merged.length < OUT_RATE * 0.2) return null // < 0.2s → nada útil
    const down = downsample(merged, this.inRate, OUT_RATE)
    return new Blob([encodeWav(down, OUT_RATE)], { type: 'audio/wav' })
  }

  cancel(): void {
    this.recording = false
    try { this.processor?.disconnect() } catch { /* */ }
    try { this.source?.disconnect() } catch { /* */ }
    try { this.stream?.getTracks().forEach(t => t.stop()) } catch { /* */ }
    try { this.ctx?.close() } catch { /* */ }
    this.chunks = []
    this.analyser = null
  }
}
