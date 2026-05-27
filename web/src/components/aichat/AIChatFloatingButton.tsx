// MARK: - AIChatFloatingButton
//
// Botón flotante siempre visible (esquina inferior derecha) que abre
// AIChatModal. Mismo patrón que Mac AIChatFloatingButton.swift.

import { useAIChat } from '../../store/aiChatStore'

interface Props {
  onClick: () => void
  isOpen: boolean
}

export default function AIChatFloatingButton({ onClick, isOpen }: Props) {
  const chat = useAIChat()
  if (isOpen) return null
  const hasSession = chat.messages.length > 0
  return (
    <button
      onClick={onClick}
      title="From AI (⌘J)"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 40,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
        zIndex: 999,
        fontSize: 20,
      }}
    >
      <span style={{
        display: 'inline-block',
        animation: chat.isStreaming ? 'fromai-pulse 1s ease-in-out infinite' : 'none',
      }}>{chat.isStreaming ? '…' : '✨'}</span>
      {hasSession && (
        <span style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#ef4444',
          border: '2px solid white',
        }} />
      )}
      <style>{`
        @keyframes fromai-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      `}</style>
    </button>
  )
}
