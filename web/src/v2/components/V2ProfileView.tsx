// Perfil — la nota donde el usuario escribe lo que quiera que Fromly sepa de él
// (metas, contexto vital, cómo prefiere que le hable…). Existe desde siempre en
// el modelo de datos (nodeStore.perfilIANode, extraData._perfilIA='1') e
// YA se inyecta en TODAS las conversaciones (aiChatStore.buildPayload lee su
// body + hijos en cada turno) — lo que faltaba en v2 era un sitio para verlo y
// editarlo (Alberto, 15 jul: "se tiene que poder acceder al perfil desde algún
// lugar destacado... básicamente una nota donde el usuario puede completar toda
// la información que quiera"). Se abre EN LUGAR DEL CHAT (centro), con la
// sidebar y la columna derecha intactas — mismo patrón que cualquier documento
// (DocEditor), no una pantalla nueva a reinventar.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ensurePerfilSync } from '../../api/userKnowledge'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import DocInspector from '../../components/views/DocInspector'

interface Props {
  onClose: () => void
}

export default function V2ProfileView({ onClose }: Props) {
  const { t } = useTranslation()
  const node = useMemo(() => ensurePerfilSync(), [])

  return (
    <main className="v2-col v2-center">
      <div className="v2-center-head">
        <button className="v2-iconbtn" onClick={onClose} title={t('v2.rightColumn.back', 'Volver')}>‹</button>
        <span className="v2-center-title">🧠 {t('v2.profile.title', 'Perfil')}</span>
      </div>
      <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 0, marginBottom: 18 }}>
          {t('v2.profile.hint', 'Escribe aquí lo que quieras que Fromly sepa de ti: tus metas, tu situación, tu forma de trabajar, cómo prefieres que te hable… Se tiene en cuenta en todas tus conversaciones y agentes, así que no hace falta repetirlo cada vez.')}
        </p>
        <div className="v2-note-formatbar"><DocInspector bar /></div>
        <DocEditorBoundary>
          <DocEditor node={node} registerActive autofocus={false} />
        </DocEditorBoundary>
      </div>
    </main>
  )
}
