import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info'
export interface ToastAction { label: string; onClick: () => void }

interface ToastItem {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

let _idCounter = 0
function nextId() { return `toast-${++_idCounter}` }

interface ToastEntryProps {
  toast: ToastItem
  onDone: (id: string) => void
}

function ToastEntry({ toast, onDone }: ToastEntryProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Trigger fade-in on next tick
    const raf = requestAnimationFrame(() => setVisible(true))

    // Con acción (p.ej. "Deshacer") dejamos más tiempo para poder pulsarla.
    timerRef.current = setTimeout(() => {
      setVisible(false)
      // Wait for fade-out animation before removing
      setTimeout(() => onDone(toast.id), 300)
    }, toast.action ? 5000 : 2500)

    return () => {
      cancelAnimationFrame(raf)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.action, onDone])

  return (
    <div className={`toast toast--${toast.type} ${visible ? 'toast--visible' : ''}`}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action!.onClick()
            setVisible(false)
            setTimeout(() => onDone(toast.id), 300)
            if (timerRef.current) clearTimeout(timerRef.current)
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction) => {
    const id = nextId()
    setToasts(prev => [...prev, { id, message, type, action }])
  }, [])

  // Escuchar evento global from:toast para usar desde cualquier componente
  useEffect(() => {
    function handleToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type?: ToastType; action?: ToastAction }
      if (detail?.message) showToast(detail.message, detail.type ?? 'info', detail.action)
    }
    window.addEventListener('from:toast', handleToast)
    return () => window.removeEventListener('from:toast', handleToast)
  }, [showToast])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => (
            <ToastEntry key={t.id} toast={t} onDone={remove} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
