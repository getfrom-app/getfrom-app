import { createPortal } from 'react-dom'
import { useRef, useEffect } from 'react'

// Emojis organizados por categoría
const EMOJI_GROUPS = [
  { label: 'Frecuentes', emojis: ['📝', '✅', '⭐', '🔥', '💡', '🎯', '🚀', '📅', '💼', '🏠', '🌟', '❤️', '🎉', '🔑', '📌'] },
  { label: 'Objetos', emojis: ['📄', '📋', '📁', '📂', '🗂', '📊', '📈', '📉', '💻', '📱', '🖥', '⌨️', '🖨', '📷', '🎧'] },
  { label: 'Símbolos', emojis: ['✨', '💫', '⚡', '🔮', '🎪', '🏆', '🥇', '🎖', '🏅', '💎', '🔷', '🔶', '🟣', '🟢', '🔴'] },
  { label: 'Naturaleza', emojis: ['🌱', '🌿', '🍀', '🌸', '🌻', '🌊', '🏔', '🌙', '☀️', '⛅', '🌈', '❄️', '🔥', '💧', '🌍'] },
  { label: 'Personas', emojis: ['👤', '👥', '🤝', '👋', '💪', '🧠', '👁', '❤️', '🫀', '🙏', '✊', '👍', '🎓', '🧑‍💻', '👨‍🏫'] },
  { label: 'Comida', emojis: ['☕', '🍵', '🥤', '🍕', '🍔', '🍎', '🥗', '🍜', '🎂', '🍰', '🥐', '🍓', '🍇', '🥑', '🌮'] },
  { label: 'Viaje', emojis: ['✈️', '🚀', '🚗', '🏠', '🌆', '🗺', '🧭', '🏖', '🏕', '⛵', '🚂', '🚁', '🏙', '🌉', '🗼'] },
]

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return createPortal(
    <div ref={ref} className="emoji-picker">
      <div className="emoji-picker-header">
        <span className="emoji-picker-title">Elige un icono</span>
        <button className="emoji-picker-clear" onClick={() => onSelect('')} title="Quitar icono">✕ Quitar</button>
      </div>
      <div className="emoji-picker-body">
        {EMOJI_GROUPS.map(group => (
          <div key={group.label} className="emoji-group">
            <div className="emoji-group-label">{group.label}</div>
            <div className="emoji-group-grid">
              {group.emojis.map(emoji => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => onSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
