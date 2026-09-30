// Notas con candado (30 sep 2026) — interfaz web/Mac. Cripto y sesión: utils/noteLock.ts.
//
//  <NoteLockButton node />  candado en la barra de la nota (arriba a la derecha, junto a
//                           favorito/exportar/eliminar), como en Apple Notes.
//  <LockedNoteGate node />  sustituye al editor en una nota bloqueada: pide la contraseña
//                           y, desbloqueada, monta DocEditor con el texto DESCIFRADO (la
//                           store sigue guardando solo el sobre — ver nodeStore.updateNode).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Node } from '../types'
import { store } from '../store/nodeStore'
import DocEditor from './views/DocEditor'
import DocEditorBoundary from './DocEditorBoundary'
import {
  isLockedNode, isNotesUnlocked, lockNotesNow, getLockConfig, setupNotesPassword, unlockWithPassword,
  recoverAndReset, changeNotesPassword, encryptBody, decryptBody, withLockedFlag, scrubServerCopies,
  touchNotesLock,
} from '../utils/noteLock'

const toast = (message: string, type: 'success' | 'warning' = 'success') =>
  window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type } }))

function useNotesLockState() {
  const [, force] = useState(0)
  useEffect(() => {
    const h = () => force(x => x + 1)
    window.addEventListener('from:notes-lock', h)
    return () => window.removeEventListener('from:notes-lock', h)
  }, [])
  return isNotesUnlocked()
}

const LockIcon = ({ closed, size = 14 }: { closed: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" fill={closed ? 'currentColor' : 'none'} />
    <path d={closed ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-1.9'} />
  </svg>
)

// ── Acciones ─────────────────────────────────────────────────────────────────
async function lockNote(node: Node) {
  const fresh = store.getNode(node.id) ?? node
  const env = await encryptBody(fresh.body || '<p></p>')
  store.updateNode(node.id, { body: env, extraData: withLockedFlag(fresh.extraData, true) })
  scrubServerCopies(node.id)
}
async function removeLock(node: Node) {
  const fresh = store.getNode(node.id) ?? node
  const plain = await decryptBody(fresh.body || '')
  store.updateNode(node.id, { body: plain, extraData: withLockedFlag(fresh.extraData, false) })
}

// ── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="note-lock-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="note-lock-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  )
}

type Step = 'setup' | 'recovery-shown' | 'unlock' | 'recover' | 'change'

/** Flujo de contraseña: crear (+ mostrar clave de recuperación), desbloquear,
 *  recuperar con la clave, o cambiar. `onDone` se llama con la sesión desbloqueada. */
function PasswordFlow({ initial, onDone, onClose }: { initial: Step; onDone: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>(initial)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); setErr('') }, [step])

  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn() } catch { setErr(t('noteLock.errGeneric', 'No se pudo completar. Revisa la conexión e inténtalo otra vez.')) } finally { setBusy(false) } }
  const pwOk = pw.length >= 6 && pw === pw2

  if (step === 'setup' || step === 'change' || step === 'recover') {
    const title = step === 'setup' ? t('noteLock.setupTitle', 'Contraseña de notas')
      : step === 'change' ? t('noteLock.changeTitle', 'Cambiar contraseña de notas')
      : t('noteLock.recoverTitle', 'Usar clave de recuperación')
    const submit = () => run(async () => {
      if (!pwOk) { setErr(pw.length < 6 ? t('noteLock.errShort', 'Mínimo 6 caracteres.') : t('noteLock.errMismatch', 'Las contraseñas no coinciden.')); return }
      if (step === 'setup') { setRecovery(await setupNotesPassword(pw)); setStep('recovery-shown') }
      else if (step === 'change') { await changeNotesPassword(pw); toast(t('noteLock.changed', 'Contraseña de notas cambiada')); onDone() }
      else if (await recoverAndReset(code, pw)) { toast(t('noteLock.recovered', 'Contraseña nueva guardada')); onDone() }
      else setErr(t('noteLock.errRecovery', 'La clave de recuperación no es correcta.'))
    })
    return (
      <Modal title={title} onClose={onClose}>
        {step === 'setup' && <p className="note-lock-help">{t('noteLock.setupHelp', 'Una sola contraseña para todas tus notas con candado. Se cifran en tu dispositivo: ni Fromly ni su IA pueden leerlas. Si la olvidas, solo podrás recuperarlas con la clave de recuperación que verás a continuación.')}</p>}
        {step === 'recover' && <input ref={inputRef} className="note-lock-input mono" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={e => setCode(e.target.value)} autoComplete="off" spellCheck={false} />}
        <input ref={step === 'recover' ? undefined : inputRef} className="note-lock-input" type="password" autoComplete="new-password" placeholder={step === 'setup' ? t('noteLock.password', 'Contraseña') : t('noteLock.newPassword', 'Contraseña nueva')} value={pw} onChange={e => setPw(e.target.value)} />
        <input className="note-lock-input" type="password" autoComplete="new-password" placeholder={t('noteLock.repeat', 'Repite la contraseña')} value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
        {err && <div className="note-lock-err">{err}</div>}
        <div className="note-lock-actions">
          <button onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="primary" disabled={busy || !pw || !pw2 || (step === 'recover' && !code)} onClick={submit}>{busy ? '…' : t('noteLock.continue', 'Continuar')}</button>
        </div>
      </Modal>
    )
  }

  if (step === 'recovery-shown') {
    return (
      <Modal title={t('noteLock.recoveryTitle', 'Tu clave de recuperación')} onClose={() => { /* obligatorio confirmarla */ }}>
        <p className="note-lock-help">{t('noteLock.recoveryHelp', 'Guárdala ahora en un sitio seguro (por ejemplo, en Contraseñas de Apple). Es la ÚNICA forma de abrir tus notas si olvidas la contraseña. No se volverá a mostrar.')}</p>
        <div className="note-lock-code">{recovery}</div>
        <div className="note-lock-actions" style={{ justifyContent: 'space-between' }}>
          <button onClick={() => { navigator.clipboard?.writeText(recovery).then(() => toast(t('noteLock.copied', 'Clave copiada'))).catch(() => {}) }}>{t('noteLock.copy', 'Copiar')}</button>
          <label className="note-lock-check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /> {t('noteLock.savedIt', 'La he guardado')}</label>
          <button className="primary" disabled={!saved} onClick={onDone}>{t('noteLock.done', 'Hecho')}</button>
        </div>
      </Modal>
    )
  }

  // unlock
  const submit = () => run(async () => {
    if (await unlockWithPassword(pw)) onDone()
    else { setErr(t('noteLock.errWrong', 'Contraseña incorrecta.')); setPw('') }
  })
  return (
    <Modal title={t('noteLock.unlockTitle', 'Desbloquear notas')} onClose={onClose}>
      <input ref={inputRef} className="note-lock-input" type="password" autoComplete="current-password" placeholder={t('noteLock.password', 'Contraseña')} value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      {err && <div className="note-lock-err">{err}</div>}
      <div className="note-lock-actions" style={{ justifyContent: 'space-between' }}>
        <button className="link" onClick={() => setStep('recover')}>{t('noteLock.forgot', '¿La has olvidado?')}</button>
        <span style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="primary" disabled={busy || !pw} onClick={submit}>{busy ? '…' : t('noteLock.unlock', 'Desbloquear')}</button>
        </span>
      </div>
    </Modal>
  )
}

/** Abre el flujo adecuado (crear o desbloquear) y resuelve cuando la sesión está abierta. */
function useEnsureUnlocked() {
  const [flow, setFlow] = useState<{ step: Step; then: () => void } | null>(null)
  const ensure = async (then: () => void) => {
    if (isNotesUnlocked()) { then(); return }
    try {
      const cfg = await getLockConfig()
      setFlow({ step: cfg ? 'unlock' : 'setup', then })
    } catch { toast('No se pudo contactar con el servidor', 'warning') }
  }
  const element = flow && (
    <PasswordFlow initial={flow.step} onClose={() => setFlow(null)} onDone={() => { const f = flow; setFlow(null); f.then() }} />
  )
  return { ensure, element, open: (step: Step) => setFlow({ step, then: () => {} }) }
}

// ── Botón de la barra ───────────────────────────────────────────────────────
export function NoteLockButton({ node, style }: { node: Node; style?: React.CSSProperties }) {
  const { t } = useTranslation()
  const unlocked = useNotesLockState()
  const locked = isLockedNode(node)
  const [menu, setMenu] = useState(false)
  const { ensure, element, open } = useEnsureUnlocked()
  const wrapRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!menu) return
    const h = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as HTMLElement)) setMenu(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [menu])

  const onClick = () => {
    if (!locked) {
      ensure(() => lockNote(node).then(() => toast(t('noteLock.locked', 'Nota protegida con candado'))).catch(() => toast(t('noteLock.errGeneric', 'No se pudo completar.'), 'warning')))
      return
    }
    setMenu(m => !m)
  }
  const title = locked ? t('noteLock.lockedTip', 'Nota con candado') : t('noteLock.lockTip', 'Proteger con contraseña')

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button title={title} aria-label={title} onClick={onClick} style={{ ...style, color: locked ? 'var(--accent,#6366f1)' : style?.color }}>
        <LockIcon closed={locked && !unlocked} />
      </button>
      {menu && (
        <div className="note-lock-menu">
          {unlocked
            ? <button onClick={() => { setMenu(false); window.setTimeout(lockNotesNow, 700) }}>{t('noteLock.lockNow', 'Bloquear ahora')}</button>
            : <button onClick={() => { setMenu(false); ensure(() => {}) }}>{t('noteLock.unlock', 'Desbloquear')}</button>}
          <button onClick={() => { setMenu(false); ensure(() => removeLock(node).then(() => toast(t('noteLock.removed', 'Candado quitado'))).catch(() => toast(t('noteLock.errGeneric', 'No se pudo completar.'), 'warning'))) }}>{t('noteLock.remove', 'Quitar candado')}</button>
          <button onClick={() => { setMenu(false); ensure(() => open('change')) }}>{t('noteLock.change', 'Cambiar contraseña de notas')}</button>
        </div>
      )}
      {element}
    </span>
  )
}

// ── Puerta del editor ───────────────────────────────────────────────────────
export function LockedNoteGate({ node, autofocus }: { node: Node; autofocus?: boolean | 'start' | 'end' }) {
  const { t } = useTranslation()
  const unlocked = useNotesLockState()
  const [plain, setPlain] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const { ensure, element } = useEnsureUnlocked()

  useEffect(() => {
    let alive = true
    if (!unlocked) { setPlain(null); return }
    decryptBody(node.body || '')
      .then(html => { if (alive) { setPlain(html); setFailed(false) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [node.body, unlocked])

  if (!unlocked || plain === null) {
    return (
      <div className="note-lock-gate">
        <LockIcon closed size={34} />
        <div className="note-lock-gate-title">{t('noteLock.lockedTip', 'Nota con candado')}</div>
        {failed
          ? <div className="note-lock-err">{t('noteLock.errDecrypt', 'No se ha podido descifrar esta nota con tu clave actual.')}</div>
          : unlocked
            ? <div className="note-lock-help">…</div>
            : <button className="note-lock-gate-btn" onClick={() => ensure(() => {})}>{t('noteLock.unlockToView', 'Introduce la contraseña para verla')}</button>}
        {element}
      </div>
    )
  }
  return (
    <div onKeyDown={touchNotesLock} onMouseDown={touchNotesLock}>
      <DocEditorBoundary compact>
        <DocEditor key={node.id} node={{ id: node.id, text: node.text, body: plain }} compact registerActive locked autofocus={autofocus} />
      </DocEditorBoundary>
    </div>
  )
}
