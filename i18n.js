/* ═══════════════════════════════════════════════
   From — getfrom.app
   i18n — ES/EN auto-detection + language toggle
   ═══════════════════════════════════════════════ */

const TRANSLATIONS = {
  es: {
    /* ── Nav ── */
    "nav.features":       "Funciones",
    "nav.sync":           "Sync",
    "nav.ai":             "IA",
    "nav.pricing":        "Precios",
    "nav.manual":         "Manual",
    "nav.support":        "Soporte",
    "nav.download":       "Descargar",
    "nav.lang_toggle":    "EN",

    /* ── Footer ── */
    "footer.tagline":        "Tu segundo cerebro. En todos tus dispositivos.",
    "footer.col_product":    "Producto",
    "footer.col_support":    "Soporte",
    "footer.col_legal":      "Legal",
    "footer.link_features":  "Funciones",
    "footer.link_pricing":   "Precios",
    "footer.link_download":  "Descargar",
    "footer.link_help":      "Centro de ayuda",
    "footer.link_contact":   "Contacto",
    "footer.link_account":   "Mi cuenta",
    "footer.link_privacy":   "Privacidad",
    "footer.link_terms":     "Términos",

    /* ── index.html ── */
    "index.meta_title":   "From — Tu segundo cerebro. En todos tus dispositivos.",
    "index.meta_desc":    "From es una app nativa para macOS e iPhone que organiza todo en un árbol de nodos con sincronización en tiempo real. IA contextual, agentes autónomos y captura rápida. Tu segundo cerebro.",
    "index.hero_badge":   "✦ Nuevo · Web app disponible · Sync Mac + iPhone + Web",
    "index.hero_title":   "El outliner que<br><span>Mac estaba esperando.</span>",
    "index.hero_subtitle": "From redefine cómo capturas, organizas y actúas sobre tus ideas. Notas inteligentes, diario automático y IA que conoce tu contexto. Nativo en Mac, iPhone y web.",
    "index.hero_cta_primary":   "Descárgala gratis — macOS",
    "index.hero_cta_secondary": "Usar en el navegador",
    "index.screenshot_placeholder": "Captura de From (próximamente)",

    "index.philosophy_label":   "Cómo funciona",
    "index.philosophy_title":   "Todo en un árbol. En todos tus dispositivos.",
    "index.philosophy_subtitle": "From organiza tu conocimiento en workspaces con un árbol de nodos: cada idea, tarea o proyecto tiene su lugar. Sincronizado en tiempo real entre Mac e iPhone.",

    "index.card_md_title":     "Árbol de nodos",
    "index.card_md_body":      "Todo en From vive en un árbol jerárquico de nodos. Mueve, anida y reorganiza con total libertad. Sin carpetas rígidas, sin archivos sueltos.",
    "index.card_folder_title": "Workspaces organizados",
    "index.card_folder_body":  "Agrupa tu contenido en workspaces: uno para trabajo, otro personal, otro para cada proyecto. Cada workspace es un universo independiente.",
    "index.card_layer_title":  "Sync en tiempo real",
    "index.card_layer_body":   "From sincroniza tu árbol en tiempo real vía servidor privado. Abre el Mac y el iPhone: el cambio ya está ahí. Sin iCloud Drive, sin configuración extra.",

    "index.features_label":    "Funciones",
    "index.features_title":    "Todo lo que necesitas para organizar tu vida",
    "index.features_subtitle": "Nodos, tareas, proyectos, calendario, vistas configurables y un asistente de IA que conoce tu contexto.",

    "index.feat_editor_title":    "Editor de nodos fluido",
    "index.feat_editor_body":     "Escribe en cualquier nodo del árbol. Texto rico, listas, adjuntos e imágenes. Navega entre nodos con un clic sin perder el contexto.",
    "index.feat_tasks_title":     "Tareas integradas",
    "index.feat_tasks_body":      "Las tareas son nodos con fecha, prioridad y estado. Crea, completa y organiza sin salir de tu flujo. Drag & drop en el timeline.",
    "index.feat_timeline_title":  "Timeline: día, semana, mes, año",
    "index.feat_timeline_body":   "Visualiza tareas, eventos de Apple Calendar y recordatorios en una sola vista temporal. Arrastra para reprogramar.",
    "index.feat_hierarchy_title": "Árbol jerárquico libre",
    "index.feat_hierarchy_body":  "Anida nodos sin límite de profundidad. Mueve ramas enteras con drag & drop. Tu conocimiento se organiza como piensas, no como te imponen.",
    "index.feat_views_title":     "Vistas configurables",
    "index.feat_views_body":      "Kanban, calendario, lista, tarjetas y focus. Configura vistas por workspace, filtra y combina. Cada proyecto se ve como tú necesitas.",
    "index.feat_native_title":    "Mac + iPhone nativos",
    "index.feat_native_body":     "Swift y SwiftUI en Mac e iPhone. Rendimiento real, integración con el sistema, atajos nativos. Se siente como parte de tu dispositivo.",
    "index.feat_collections_title": "Captura rápida",
    "index.feat_collections_body":  "Añade nodos al vuelo desde cualquier lugar. Widget en iPhone, atajo global en Mac. Ninguna idea se pierde.",
    "index.feat_canvas_title":    "Canvas visual",
    "index.feat_canvas_body":     "Lienzo infinito para diagramas, mapas mentales y brainstorming. Conecta ideas visualmente sin límites.",
    "index.feat_history_title":   "Historial de versiones",
    "index.feat_history_body":    "Cada cambio se guarda automáticamente en la nube. Viaja en el tiempo a cualquier versión anterior de tus nodos con un clic.",

    "index.sync_label":    "Sincronización",
    "index.sync_title":    "Tu árbol. En todos tus dispositivos.",
    "index.sync_subtitle": "From sincroniza en tiempo real vía servidor privado. Abre la app en Mac o iPhone y tus nodos ya están ahí. Sin iCloud Drive, sin configuración.",
    "index.sync_mac":      "Mac",
    "index.sync_icloud":   "Servidor From",
    "index.sync_macs":     "iPhone",

    "index.sync_icloud_title": "Sincronización en tiempo real",
    "index.sync_icloud_body":  "Cada cambio en un nodo se propaga al instante a todos tus dispositivos. Servidor privado en la nube, latencia mínima, siempre al día.",
    "index.sync_gdrive_title": "Google Drive y Docs",
    "index.sync_gdrive_body":  "Conecta múltiples cuentas de Google. Vincula nodos a Google Docs con sincronización bidireccional automática. Tus docs de Google como contexto para la IA.",
    "index.sync_backup_title": "Backup automático",
    "index.sync_backup_body":  "Tus datos se almacenan de forma segura en Cloudflare R2. Backups automáticos de todo tu árbol. Restaura cualquier versión anterior con un clic.",

    "index.integrations_label":    "Integraciones",
    "index.integrations_title":    "Conectado a lo que ya usas",
    "index.integrations_subtitle": "From se integra nativamente con las apps de Apple y Google que ya forman parte de tu día a día.",

    "index.int_calendar_title":   "Apple Calendar",
    "index.int_calendar_body":    "Tus eventos aparecen en el timeline de From. Crea eventos desde notas. Sincronización bidireccional.",
    "index.int_reminders_title":  "Apple Recordatorios",
    "index.int_reminders_body":   "Las tareas de From se sincronizan con Recordatorios de Apple. Completa desde cualquier dispositivo.",
    "index.int_gdrive_title":     "Google Drive",
    "index.int_gdrive_body":      "Navega, busca y vincula archivos de Drive. Multi-cuenta. Accede a tus carpetas sin salir de From.",
    "index.int_gdocs_title":      "Google Docs",
    "index.int_gdocs_body":       "Vincula notas a Google Docs. Edita en un lado y se sincroniza al otro. Auto-sync al guardar.",
    "index.int_icloud_title":     "App nativa iPhone",
    "index.int_icloud_body":      "From para iPhone sincroniza tu árbol en tiempo real. Captura, consulta y edita desde cualquier lugar.",
    "index.int_aimodels_title":   "Claude, GPT y Gemini",
    "index.int_aimodels_body":    "Elige tu proveedor de IA preferido. Usa tu propia API key o la IA gestionada de From con tokens incluidos.",

    "index.ai_label":    "Inteligencia Artificial",
    "index.ai_title":    "Una IA que conoce tu contexto",
    "index.ai_subtitle": "No es un chatbot genérico. Es un asistente que ha leído tus notas, entiende tus proyectos y trabaja con tu información real.",

    "index.ai_chat_title":    "Chat contextual",
    "index.ai_chat_body":     "Pregunta sobre tus notas, resume proyectos, busca información. La IA recupera los fragmentos relevantes de tu espacio con búsqueda semántica.",
    "index.ai_editor_title":  "Editor IA",
    "index.ai_editor_body":   "La IA edita tus notas directamente. Revisa los cambios, confírmalos o deshazlos. Como un copiloto para tu escritura.",
    "index.ai_agents_title":  "Agentes autónomos",
    "index.ai_agents_body":   "Crea agentes con lenguaje natural. Se ejecutan automáticamente: diario, semanal, al abrir la app. Leen, crean y actualizan notas por ti.",
    "index.ai_privacy_title": "Privacidad real",
    "index.ai_privacy_body":  "Solo el fragmento relevante viaja a la API de IA. Tus nodos no se comparten con terceros. Puedes usar tu propia API key para control total.",

    "index.privacy_label":    "Privacidad",
    "index.privacy_title":    "Tu privacidad, por diseño",
    "index.privacy_subtitle": "From no vende ni comparte tus datos. Tu árbol es tuyo. El servidor existe para sincronizar, no para leer tu contenido.",

    "index.priv_noserver_title":    "Servidor privado",
    "index.priv_noserver_body":     "Tu árbol se sincroniza vía servidor privado de From. Los archivos adjuntos se almacenan en Cloudflare R2, cifrados y solo accesibles por ti.",
    "index.priv_notelemetry_title": "Cero telemetría",
    "index.priv_notelemetry_body":  "No rastreamos uso, no enviamos analíticas, no recopilamos datos de comportamiento. Cero.",
    "index.priv_nolockin_title":    "Sin lock-in",
    "index.priv_nolockin_body":     "Tu contenido es exportable en cualquier momento. Si dejas From, te llevas todo. No hay formatos propietarios sin salida.",
    "index.priv_backup_title":      "Backup local cada 2 horas",
    "index.priv_backup_body":       "From guarda un snapshot completo de tus notas en tu Mac cada 2 horas en Markdown estándar. Legible con cualquier editor, compatible con Obsidian. Restaura cualquier punto de las últimas 12h desde Ajustes.",

    "index.steps_title": "Empieza en 30 segundos",
    "index.step1_title": "Descarga From",
    "index.step1_body":  "Instala la app en Mac o iPhone. Sin configuración compleja, sin cuenta de iCloud obligatoria.",
    "index.step2_title": "Crea tu workspace",
    "index.step2_body":  "Nombra tu primer workspace y empieza a añadir nodos. From sincroniza automáticamente con todos tus dispositivos.",
    "index.step3_title": "Empieza a trabajar",
    "index.step3_body":  "Crea nodos, organiza proyectos, programa tareas. La IA ya conoce tu contexto desde el minuto uno.",

    "index.pricing_teaser_title": "Simple y justo",
    "index.pricing_teaser_body":  "Licencia perpetua para usar From para siempre. Suscripción opcional solo si quieres IA gestionada sin configurar API keys.",
    "index.pricing_teaser_cta":   "Ver precios",

    "index.faq_title": "Preguntas frecuentes",
    "index.faq1_q": "¿From es solo para Mac o también para iPhone?",
    "index.faq1_a": "From está disponible tanto para macOS como para iPhone. Ambas apps son nativas y están sincronizadas en tiempo real. Lo que escribes en el Mac aparece al instante en el iPhone, y viceversa.",
    "index.faq2_q": "¿Cómo funciona la IA?",
    "index.faq2_a": "From indexa tu árbol de nodos y recupera el contexto relevante cuando interactúas con la IA. Solo el fragmento necesario viaja a la API — nada se comparte con terceros. Puedes elegir entre Claude, GPT o Gemini.",
    "index.faq3_q": "¿Cómo funciona la sincronización?",
    "index.faq3_a": "From usa un servidor privado para sincronizar tu árbol en tiempo real. No depende de iCloud Drive ni de ningún servicio externo. Los archivos adjuntos se almacenan en Cloudflare R2.",
    "index.faq4_q": "¿Mis datos están en archivos .md?",
    "index.faq4_a": "No. From v3 usa una base de datos de nodos optimizada para sincronización en tiempo real. Tu contenido siempre es exportable, pero el formato interno no son archivos Markdown sueltos.",
    "index.faq5_q": "¿Qué pasa si dejo de usar From?",
    "index.faq5_a": "Puedes exportar todo tu contenido en cualquier momento antes de cancelar. From no te retiene: tus datos son tuyos y puedes llevártelos.",
    "index.faq6_q": "¿Necesito una API key para la IA?",
    "index.faq6_a": "No necesariamente. Puedes usar la IA gestionada de From (con suscripción) o aportar tu propia API key de Anthropic, OpenAI o Google. También puedes conectar tu suscripción de Claude directamente.",
    "index.faq7_q": "¿Mis datos están seguros?",
    "index.faq7_a": "Tus datos se almacenan en servidores privados de From y en Cloudflare R2, con cifrado en tránsito y en reposo. No hay telemetría, no hay analíticas, no hay venta de datos.",
    "index.faq8_q": "¿Puedo importar mis notas desde Notion u Obsidian?",
    "index.faq8_a": "Sí. From importa desde Obsidian, Notion, LogSeq, NotePlan, Bear y cualquier carpeta de Markdown. Las notas sin fecha van al diario de ayer; las tareas con fecha van automáticamente al día que les corresponde. Consulta el Manual para instrucciones detalladas por app.",

    "index.tab_diary":  "Diario de hoy",
    "index.tab_note":   "Notas con IA",
    "index.tab_search": "Búsqueda ⌘K",
    "index.tab_ai":     "Chat IA",
    "index.cta_title": "Tu segundo cerebro te está esperando",
    "index.cta_body":  "Descarga From y empieza a organizar tus ideas, tareas y proyectos. Disponible para Mac y iPhone.",
    "index.cta_btn":   "Descargar para macOS",

    /* ── pricing.html ── */
    "pricing.meta_title":   "Precios — From",
    "pricing.meta_desc":    "Precios de From. Licencia perpetua o suscripción con IA gestionada. Sin trucos, sin compromisos.",
    "pricing.hero_badge":   "Precios",
    "pricing.hero_title":   "Simple y transparente",
    "pricing.hero_subtitle": "¿Ya tienes suscripción a Claude, ChatGPT o Gemini? Compra la licencia y conecta tu propia API key.<br>¿Prefieres no pagar otra suscripción de IA? Suscríbete a From y la IA va incluida.",

    "pricing.perpetual_title":  "Licencia perpetua",
    "pricing.perpetual_badge":  "50 licencias · Acceso fundadores",
    "pricing.perpetual_desc":   "Para quienes ya tienen su propia suscripción de IA",
    "pricing.perpetual_period": "Pago único. Para siempre.",
    "pricing.perpetual_btn":    "Comprar licencia",
    "pricing.perpetual_f1": "App completa sin límite de tiempo",
    "pricing.perpetual_f2": "Notas, tareas, vistas y timeline",
    "pricing.perpetual_f3": "Integración Apple Calendar y Recordatorios",
    "pricing.perpetual_f4": "Google Drive y Google Docs",
    "pricing.perpetual_f5": "Canvas infinito y backups automáticos",
    "pricing.perpetual_f6": "Agentes autónomos",
    "pricing.perpetual_f7": "IA con tu propia API key (Anthropic, OpenAI, Google)",
    "pricing.perpetual_f8": "Actualizaciones incluidas",

    "pricing.sub_title":  "Suscripción",
    "pricing.sub_desc":   "IA de From incluida. Sin suscripción propia de IA.",
    "pricing.sub_period": "Cancela cuando quieras",
    "pricing.sub_btn":    "Suscribirse",
    "pricing.sub_f1": "Todas las funciones de la app incluidas",
    "pricing.sub_f2": "2 millones de tokens IA/mes incluidos",
    "pricing.sub_f3": "Sin API key ni suscripción propia de IA necesaria",
    "pricing.sub_f4": "Modelos de última generación",
    "pricing.sub_f5": "Agentes con ejecución automática en la nube",
    "pricing.sub_f6": "Soporte prioritario",

    "pricing.comparison_title": "Comparativa de planes",
    "pricing.comp_feature_col": "Función",
    "pricing.comp_perpetual_col": "Licencia perpetua",
    "pricing.comp_sub_col": "Suscripción",
    "pricing.comp_row1":  "Notas, tareas, timeline",
    "pricing.comp_row2":  "Vistas (kanban, calendario, lista, tarjetas)",
    "pricing.comp_row3":  "Apple Calendar y Recordatorios",
    "pricing.comp_row4":  "Google Drive y Docs",
    "pricing.comp_row5":  "Agentes autónomos",
    "pricing.comp_row6":  "Historial de versiones",
    "pricing.comp_row7":  "IA con API key propia",
    "pricing.comp_row8":  "Conectar suscripción de Claude",
    "pricing.comp_row9":  "IA gestionada (sin API key)",
    "pricing.comp_row9_sub": "✓ 2M tokens/mes",
    "pricing.comp_row10": "Soporte prioritario",

    "pricing.ai_modes_title":    "Tres formas de usar la IA",
    "pricing.ai_modes_subtitle": "Tú eliges cómo quieres que funcione la inteligencia artificial en From.",

    "pricing.mode_auto_title":  "Automático (Suscripción)",
    "pricing.mode_auto_body":   "Sin configurar nada. From gestiona las API keys y los modelos por ti. Solo suscríbete y empieza a usar la IA con tokens incluidos.",
    "pricing.mode_manual_title": "Manual (API key propia)",
    "pricing.mode_manual_body":  "Introduce tu API key de Anthropic, OpenAI o Google. Control total sobre el proveedor, modelo y costes. Funciona con la licencia perpetua.",
    "pricing.mode_oauth_title":  "Claude OAuth",
    "pricing.mode_oauth_body":   "Conecta tu suscripción de Claude Pro o Max directamente. Usa tu cuota de Claude sin API key, sin coste extra.",

    "pricing.faq_title": "Preguntas sobre precios",
    "pricing.faq1_q": "¿Puedo usar From sin pagar?",
    "pricing.faq1_a": "Sí. Puedes descargar From y usar todas sus funciones sin pagar nada — notas, tareas, vistas, proyectos y agentes. La IA requiere un plan: licencia perpetua para usar tu propia API key, o suscripción para IA gestionada sin configurar nada.",
    "pricing.faq2_q": "¿La licencia perpetua incluye actualizaciones?",
    "pricing.faq2_a": "Sí. Todas las actualizaciones están incluidas. Paga una vez, usa From para siempre con todas las mejoras futuras.",
    "pricing.faq3_q": "¿Qué pasa si cancelo la suscripción?",
    "pricing.faq3_a": "Sigues usando From con todas sus funciones sin IA gestionada. Si quieres seguir usando la IA, puedes adquirir la licencia perpetua y conectar tu propia API key.",
    "pricing.faq4_q": "¿Puedo cambiar de plan?",
    "pricing.faq4_a": "Sí. Puedes pasar de licencia perpetua a suscripción o viceversa en cualquier momento desde tu cuenta.",
    "pricing.faq5_q": "¿Qué son los tokens?",
    "pricing.faq5_a": "Los tokens son la unidad de medida de la IA. Cada pregunta al chat, edición con IA o ejecución de agente consume tokens. 2M de tokens al mes cubre un uso normal con margen. Si necesitas más, puedes recargar 5M adicionales por €5.",

    "pricing.cta_title": "Empieza hoy",
    "pricing.cta_body":  "Descarga From gratis y decide después qué plan se adapta a ti.",
    "pricing.cta_btn":   "Descargar para macOS",

    /* ── support.html ── */
    "support.meta_title": "Soporte — From",
    "support.meta_desc":  "Centro de ayuda de From. Preguntas frecuentes, guías y contacto.",
    "support.hero_title":    "Centro de ayuda",
    "support.hero_subtitle": "¿Necesitas ayuda con From? Aquí encontrarás respuestas a las preguntas más frecuentes y formas de contactarnos.",

    "support.email_title": "Email",
    "support.email_body":  "Escríbenos directamente y te responderemos lo antes posible.",
    "support.inapp_title": "Desde la app",
    "support.inapp_body":  "En From, ve a Ajustes → Soporte para enviar comentarios o reportar problemas directamente.",
    "support.faq_card_title": "FAQ",
    "support.faq_card_body":  "Consulta las preguntas frecuentes más abajo. Probablemente tu duda ya esté resuelta.",
    "support.faq_card_btn":   "Ver FAQ",

    "support.faq_section_title": "Preguntas frecuentes",
    "support.faq1_q":   "¿Cómo instalo From en Mac?",
    "support.faq1_a":   "Descarga el archivo .dmg desde nuestra web, ábrelo y arrastra From a tu carpeta de Aplicaciones. No necesitas instalador ni crear una cuenta para empezar.",
    "support.faq1b_q":  "¿Hay app para iPhone?",
    "support.faq1b_a":  "Sí. From para iPhone está disponible en el <a href=\"https://apps.apple.com/app/from-tu-segundo-cerebro/id6769823296\">App Store</a>. Sincroniza en tiempo real con tu Mac.",
    "support.faq2_q":   "¿Dónde se guardan mis notas?",
    "support.faq2_a":   "Tus notas se almacenan localmente en tu dispositivo. La sincronización entre Mac e iPhone se hace vía servidor privado de From, cifrada en tránsito. Puedes exportar todo en formato Markdown estándar en cualquier momento desde Ajustes → Exportar.",
    "support.faq4_q":   "¿Cómo funciona la sincronización?",
    "support.faq4_a":   "From sincroniza en tiempo real entre Mac e iPhone vía servidor privado. Abre la app en cualquier dispositivo y los cambios ya están ahí. No usa iCloud Drive. Requiere cuenta activa (gratuita).",
    "support.faq6_q":   "¿Cómo configuro la IA?",
    "support.faq6_a":   "Con la suscripción (€7/mes), la IA está lista sin configuración: incluye 2M tokens/mes. Con la licencia perpetua, ve a Ajustes → IA, pega tu API key de Anthropic, OpenAI o Google y elige el modelo.",
    "support.faq7_q":   "¿Mis notas se envían a servidores externos?",
    "support.faq7_a":   "Solo el fragmento relevante a tu consulta se envía a la API del proveedor de IA en el momento de procesarla. Nada se almacena en servidores de IA. El sync de notas va a nuestro servidor privado, cifrado.",
    "support.faq8_q":   "¿Qué proveedores de IA soporta From?",
    "support.faq8_a":   "Anthropic (Claude Haiku), OpenAI (GPT) y Google (Gemini). Con la suscripción usas el modelo gestionado por From. Con licencia perpetua eliges tú el proveedor y modelo.",
    "support.faq9_q":   "¿Cómo conecto Apple Calendar?",
    "support.faq9_a":   "From pide permiso de acceso a Calendar al abrir la app por primera vez. Una vez concedido, tus eventos aparecen en el timeline del día y puedes crear eventos directamente desde From.",
    "support.faq10_q":  "¿Cómo sincronizo con Google Docs?",
    "support.faq10_a":  "Desde la barra de acciones de cualquier nota, pulsa el botón de Google Docs. La primera vez te pedirá autorización de Google. Una vez conectado, el contenido de la nota se sincroniza con el documento automáticamente.",
    "support.manual_card_title": "Manual de usuario",
    "support.manual_card_body":  "Guía completa de todas las funciones de From: notas, tareas, IA, agentes y más.",
    "support.manual_card_btn":   "Ver manual",
    "support.faq11_q": "¿Cómo cancelo mi suscripción?",
    "support.faq11_a": "Puedes cancelar en cualquier momento desde <a href=\"account.html\">tu cuenta</a> o directamente en la app en Ajustes → Cuenta. La cancelación es inmediata y no se cobra más.",
    "support.faq12_q": "¿Cómo elimino mi cuenta?",
    "support.faq12_a": "Envía un email a <a href=\"mailto:hola@getfrom.app?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta\">hola@getfrom.app</a> con el asunto \"Solicitud de eliminación de cuenta\". Eliminaremos todos los datos asociados en nuestro servidor. Tus notas locales no se ven afectadas.",

    "support.cta_title": "¿No encuentras lo que buscas?",
    "support.cta_body":  "Escríbenos y te ayudaremos personalmente.",

    /* ── account.html ── */
    "account.meta_title": "Mi cuenta — From",
    "account.meta_desc":  "Gestiona tu cuenta de From. Suscripción, facturación, tokens y configuración.",
    "account.hero_title":    "Gestiona tu cuenta",
    "account.hero_subtitle": "Administra tu suscripción, facturación y configuración de From desde aquí o directamente desde la app.",

    "account.sub_title": "Suscripción",
    "account.sub_body":  "Gestiona tu plan, cambia de suscripción mensual a anual, o cancela en cualquier momento.",
    "account.sub_btn":   "Gestionar suscripción",

    "account.billing_title": "Facturación",
    "account.billing_body":  "Consulta tu historial de pagos, descarga facturas y actualiza tu método de pago.",
    "account.billing_btn":   "Ver facturas",

    "account.tokens_title": "Tokens de IA",
    "account.tokens_body":  "Consulta tu balance de tokens desde la app en Ajustes → IA. Compra tokens adicionales cuando lo necesites.",
    "account.tokens_btn":   "Comprar tokens",

    "account.license_title": "Licencia",
    "account.license_body":  "Activa tu licencia perpetua desde la app en Ajustes → Cuenta. Introduce el código que recibiste por email.",
    "account.license_btn":   "Ver planes",

    "account.apikeys_title": "API Keys",
    "account.apikeys_body":  "Configura tus API keys de Anthropic, OpenAI o Google en la app: Ajustes → IA → Modo manual.",
    "account.apikeys_note":  "Las API keys se almacenan solo en tu Mac, nunca en nuestros servidores.",

    "account.delete_title": "Eliminar cuenta",
    "account.delete_body":  "Elimina tu cuenta y todos los datos asociados en nuestro servidor. Tus notas locales no se ven afectadas — siguen siendo archivos en tu Mac.",
    "account.delete_btn":   "Solicitar eliminación",

    "account.info_title": "Información importante",
    "account.info1_q": "Tu cuenta y tus notas son cosas diferentes",
    "account.info1_a": "Tu cuenta de From gestiona la suscripción, tokens y acceso a la IA gestionada. Tus notas son archivos Markdown en tu Mac. Eliminar tu cuenta <strong>no</strong> elimina tus notas — esos archivos siguen siendo tuyos, en tu disco.",
    "account.info2_q": "Gestión desde la app",
    "account.info2_a": "La mayoría de opciones de cuenta están disponibles directamente en From: Ajustes → Cuenta. Desde ahí puedes ver tu plan, balance de tokens, activar licencias y configurar API keys.",
    "account.info3_q": "Pagos procesados por LemonSqueezy",
    "account.info3_a": "Los pagos se procesan de forma segura a través de LemonSqueezy. No almacenamos datos de tarjeta. Puedes gestionar tu método de pago desde el portal del cliente.",
    "account.info4_q": "¿Problemas con tu cuenta?",
    "account.info4_a": "Escríbenos a <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> y te ayudaremos lo antes posible.",

    /* ── privacy.html ── */
    "privacy.meta_title":   "Política de Privacidad — From",
    "privacy.meta_desc":    "Política de privacidad de From. Cómo tratamos tus datos, qué recopilamos y qué no.",
    "privacy.hero_title":   "Política de Privacidad",
    "privacy.hero_subtitle": "En From, la privacidad no es una característica. Es la arquitectura.",

    /* ── terms.html ── */
    "terms.meta_title":   "Términos de Servicio — From",
    "terms.meta_desc":    "Términos y condiciones de uso de From. Licencia, suscripción, responsabilidades y garantías.",
    "terms.hero_title":   "Términos de Servicio",
    "terms.hero_subtitle": "Condiciones de uso de la aplicación From y sus servicios asociados."
  },

  en: {
    /* ── Nav ── */
    "nav.features":       "Features",
    "nav.sync":           "Sync",
    "nav.ai":             "AI",
    "nav.pricing":        "Pricing",
    "nav.manual":         "Manual",
    "nav.support":        "Support",
    "nav.download":       "Download",
    "nav.lang_toggle":    "ES",

    /* ── Footer ── */
    "footer.tagline":        "Your second brain. On all your devices.",
    "footer.col_product":    "Product",
    "footer.col_support":    "Support",
    "footer.col_legal":      "Legal",
    "footer.link_features":  "Features",
    "footer.link_pricing":   "Pricing",
    "footer.link_download":  "Download",
    "footer.link_help":      "Help center",
    "footer.link_contact":   "Contact",
    "footer.link_account":   "My account",
    "footer.link_privacy":   "Privacy",
    "footer.link_terms":     "Terms",

    /* ── index.html ── */
    "index.meta_title":   "From — Your second brain. On all your devices.",
    "index.meta_desc":    "From is a native app for macOS and iPhone that organizes everything in a node tree with real-time sync. Contextual AI, autonomous agents, and quick capture. Your second brain.",
    "index.hero_badge":   "✦ New · Web app available · Mac + iPhone + Web sync",
    "index.hero_title":   "The outliner<br><span>Mac was waiting for.</span>",
    "index.hero_subtitle": "From redefines how you capture, organize and act on your ideas. Smart notes, automatic diary and AI that knows your context. Native on Mac, iPhone and web.",
    "index.hero_cta_primary":   "Download free — macOS",
    "index.hero_cta_secondary": "Use in browser",
    "index.screenshot_placeholder": "From screenshot (coming soon)",

    "index.philosophy_label":   "How it works",
    "index.philosophy_title":   "Everything in a tree. On all your devices.",
    "index.philosophy_subtitle": "From organizes your knowledge in workspaces with a node tree: every idea, task, or project has its place. Synced in real time between Mac and iPhone.",

    "index.card_md_title":     "Node tree",
    "index.card_md_body":      "Everything in From lives in a hierarchical node tree. Move, nest, and reorganize freely. No rigid folders, no loose files.",
    "index.card_folder_title": "Organized workspaces",
    "index.card_folder_body":  "Group your content in workspaces: one for work, one personal, one per project. Each workspace is an independent universe.",
    "index.card_layer_title":  "Real-time sync",
    "index.card_layer_body":   "From syncs your tree in real time via private server. Open Mac or iPhone: the change is already there. No iCloud Drive, no extra setup.",

    "index.features_label":    "Features",
    "index.features_title":    "Everything you need to organize your life",
    "index.features_subtitle": "Nodes, tasks, projects, calendar, configurable views, and an AI assistant that knows your context.",

    "index.feat_editor_title":    "Fluid node editor",
    "index.feat_editor_body":     "Write in any node in the tree. Rich text, lists, attachments, and images. Navigate between nodes in one click without losing context.",
    "index.feat_tasks_title":     "Integrated tasks",
    "index.feat_tasks_body":      "Tasks are nodes with a date, priority, and status. Create, complete, and organize without leaving your flow. Drag & drop on the timeline.",
    "index.feat_timeline_title":  "Timeline: day, week, month, year",
    "index.feat_timeline_body":   "See tasks, Apple Calendar events, and reminders in a single time view. Drag to reschedule.",
    "index.feat_hierarchy_title": "Free hierarchical tree",
    "index.feat_hierarchy_body":  "Nest nodes without depth limits. Move entire branches with drag & drop. Your knowledge organized the way you think, not the way you're told.",
    "index.feat_views_title":     "6 views per note",
    "index.feat_views_body":      "List, Table, Kanban, Gallery, Calendar and Canvas inside any note with the / command. Switch views without leaving the note.",
    "index.feat_native_title":    "Native Mac + iPhone",
    "index.feat_native_body":     "Swift and SwiftUI on Mac and iPhone. Real performance, system integration, native keyboard shortcuts. Feels like part of your device.",
    "index.feat_collections_title": "Quick capture",
    "index.feat_collections_body":  "Add nodes on the fly from anywhere. iPhone widget, global shortcut on Mac. No idea gets lost.",
    "index.feat_canvas_title":    "Smart search",
    "index.feat_canvas_body":     "Search your entire knowledge base with filters by type, area, date and status. AI-powered semantic mode to find the answer, not just the keyword.",
    "index.feat_history_title":   "Infinite canvas",
    "index.feat_history_body":    "Organize your ideas visually on a free canvas. Create nodes, connect them, group them. Unlimited pan and zoom. For when a list isn't enough.",

    "index.sync_label":    "Sync",
    "index.sync_title":    "Your tree. On all your devices.",
    "index.sync_subtitle": "From syncs in real time via a private server. Open the app on Mac or iPhone and your nodes are already there. No iCloud Drive, no configuration.",
    "index.sync_mac":      "Mac",
    "index.sync_icloud":   "From Server",
    "index.sync_macs":     "iPhone",

    "index.sync_icloud_title": "Real-time sync",
    "index.sync_icloud_body":  "Every change to a node propagates instantly to all your devices. Private cloud server, minimal latency, always up to date.",
    "index.sync_gdrive_title": "Google Drive & Docs",
    "index.sync_gdrive_body":  "Connect multiple Google accounts. Link nodes to Google Docs with automatic two-way sync. Use your Google Docs as AI context.",
    "index.sync_backup_title": "Automatic backup",
    "index.sync_backup_body":  "Your data is stored securely on Cloudflare R2. Automatic backups of your entire tree. Export in standard Markdown at any time.",

    "index.integrations_label":    "Integrations",
    "index.integrations_title":    "Connected to what you already use",
    "index.integrations_subtitle": "From integrates natively with the Apple and Google apps already part of your day.",

    "index.int_calendar_title":   "Apple Calendar",
    "index.int_calendar_body":    "Your events appear in the From timeline. Create events from notes. Two-way sync.",
    "index.int_reminders_title":  "Apple Reminders",
    "index.int_reminders_body":   "From tasks sync with Apple Reminders. Complete them from any device.",
    "index.int_gdrive_title":     "Google Drive",
    "index.int_gdrive_body":      "Browse, search, and link Drive files. Multi-account. Access your folders without leaving From.",
    "index.int_gdocs_title":      "Google Docs",
    "index.int_gdocs_body":       "Link notes to Google Docs. Edit on one side and it syncs to the other. Auto-sync on save.",
    "index.int_icloud_title":     "Native iPhone app",
    "index.int_icloud_body":      "From for iPhone syncs your tree in real time. Capture, review, and edit from anywhere.",
    "index.int_aimodels_title":   "Claude, GPT & Gemini",
    "index.int_aimodels_body":    "Choose your preferred AI provider. Use your own API key or From's managed AI with included tokens.",

    "index.ai_label":    "Artificial Intelligence",
    "index.ai_title":    "An AI that knows your context",
    "index.ai_subtitle": "Not a generic chatbot. An assistant that has read your notes, understands your projects, and works with your actual information.",

    "index.ai_chat_title":    "Contextual chat",
    "index.ai_chat_body":     "Ask about your notes, summarize projects, find information. The AI retrieves relevant snippets from your workspace using semantic search.",
    "index.ai_editor_title":  "AI editor",
    "index.ai_editor_body":   "The AI edits your notes directly. Review the changes, confirm or undo them. A true copilot for your writing.",
    "index.ai_agents_title":  "Autonomous agents",
    "index.ai_agents_body":   "Create agents in plain language. They run automatically — daily, weekly, on app launch. They read, create, and update notes for you.",
    "index.ai_privacy_title": "Real privacy",
    "index.ai_privacy_body":  "Only the relevant snippet travels to the AI API. Your nodes are never shared with third parties. Use your own API key for full control.",

    "index.privacy_label":    "Privacy",
    "index.privacy_title":    "Your privacy, by design",
    "index.privacy_subtitle": "From doesn't sell or share your data. Your tree is yours. The server exists to sync, not to read your content.",

    "index.priv_noserver_title":    "Private server",
    "index.priv_noserver_body":     "Your tree syncs via From's private server. File attachments are stored on Cloudflare R2, encrypted and only accessible by you.",
    "index.priv_notelemetry_title": "Zero telemetry",
    "index.priv_notelemetry_body":  "We don't track usage, send analytics, or collect behavioral data. Zero.",
    "index.priv_nolockin_title":    "No lock-in",
    "index.priv_nolockin_body":     "Your content is exportable at any time. If you leave From, you take everything with you. No proprietary formats with no way out.",
    "index.priv_backup_title":      "Local backup every 2 hours",
    "index.priv_backup_body":       "From saves a complete snapshot of your notes on your Mac every 2 hours as standard Markdown. Readable with any editor, compatible with Obsidian. Restore any point from the last 12h from Settings.",

    "index.steps_title": "Up and running in 30 seconds",
    "index.step1_title": "Download From",
    "index.step1_body":  "Install the app on Mac or iPhone. No complex setup, no mandatory iCloud account.",
    "index.step2_title": "Create your workspace",
    "index.step2_body":  "Name your first workspace and start adding nodes. From syncs automatically across all your devices.",
    "index.step3_title": "Start working",
    "index.step3_body":  "Create nodes, organize projects, schedule tasks. The AI already knows your context from minute one.",

    "index.pricing_teaser_title": "Simple and fair",
    "index.pricing_teaser_body":  "A one-time license to use From forever. Optional subscription only if you want managed AI without configuring API keys.",
    "index.pricing_teaser_cta":   "See pricing",

    "index.faq_title": "Frequently asked questions",
    "index.faq1_q": "Is From only for Mac or also for iPhone?",
    "index.faq1_a": "From is available for both macOS and iPhone. Both apps are native and sync in real time. What you write on Mac appears instantly on iPhone, and vice versa.",
    "index.faq2_q": "How does the AI work?",
    "index.faq2_a": "From indexes your node tree and retrieves the relevant context when you interact with the AI. Only the necessary snippet travels to the API — nothing is shared with third parties. You can choose Claude, GPT, or Gemini.",
    "index.faq3_q": "How does sync work?",
    "index.faq3_a": "From uses a private server to sync your tree in real time. It doesn't depend on iCloud Drive or any external service. File attachments are stored on Cloudflare R2.",
    "index.faq4_q": "Are my notes stored as .md files?",
    "index.faq4_a": "No. From v3 uses a node database optimized for real-time sync. Your content is always exportable, but the internal format is not loose Markdown files.",
    "index.faq5_q": "What happens if I stop using From?",
    "index.faq5_a": "You can export all your content at any time before canceling. From doesn't hold you hostage: your data is yours and you can take it with you.",
    "index.faq6_q": "Do I need an API key for AI?",
    "index.faq6_a": "Not necessarily. You can use From's managed AI (with a subscription) or bring your own API key from Anthropic, OpenAI, or Google. You can also connect your Claude subscription directly.",
    "index.faq7_q": "Is my data safe?",
    "index.faq7_a": "Your data is stored on From's private servers and Cloudflare R2, encrypted in transit and at rest. No telemetry, no analytics, no data selling.",
    "index.faq8_q": "Can I import my notes from Notion or Obsidian?",
    "index.faq8_a": "Yes. From imports from Obsidian, Notion, LogSeq, NotePlan, Bear, and any Markdown folder. Notes without a date go to yesterday's diary; tasks with a date are automatically placed on their correct day. See the Manual for step-by-step instructions per app.",

    "index.tab_diary":  "Today's diary",
    "index.tab_note":   "Notes with AI",
    "index.tab_search": "Search ⌘K",
    "index.tab_ai":     "AI Chat",
    "index.cta_title": "Your second brain is waiting",
    "index.cta_body":  "Download From and start organizing your ideas, tasks, and projects. Available for Mac and iPhone.",
    "index.cta_btn":   "Download for macOS",

    /* ── pricing.html ── */
    "pricing.meta_title":   "Pricing — From",
    "pricing.meta_desc":    "From pricing. One-time license or subscription with managed AI. No tricks, no lock-in.",
    "pricing.hero_badge":   "Pricing",
    "pricing.hero_title":   "Simple and transparent",
    "pricing.hero_subtitle": "Already paying for Claude, ChatGPT or Gemini? Buy the license and connect your own API key.<br>Prefer not to manage another AI subscription? Subscribe to From and AI is included.",

    "pricing.perpetual_title":  "Perpetual license",
    "pricing.perpetual_badge":  "50 licenses · Founder access",
    "pricing.perpetual_desc":   "For those who already have their own AI subscription",
    "pricing.perpetual_period": "One-time payment. Yours forever.",
    "pricing.perpetual_btn":    "Buy license",
    "pricing.perpetual_f1": "Full app, no time limit",
    "pricing.perpetual_f2": "Notes, tasks, views, and timeline",
    "pricing.perpetual_f3": "Apple Calendar & Reminders integration",
    "pricing.perpetual_f4": "Google Drive & Google Docs",
    "pricing.perpetual_f5": "Infinite canvas & automatic backups",
    "pricing.perpetual_f6": "Autonomous agents",
    "pricing.perpetual_f7": "AI with your own API key (Anthropic, OpenAI, Google)",
    "pricing.perpetual_f8": "All future updates included",

    "pricing.sub_title":  "Subscription",
    "pricing.sub_desc":   "From's AI included. No separate AI subscription needed.",
    "pricing.sub_period": "Cancel anytime",
    "pricing.sub_btn":    "Subscribe",
    "pricing.sub_f1": "All app features included",
    "pricing.sub_f2": "2 million AI tokens/month included",
    "pricing.sub_f3": "No API key or separate AI subscription needed",
    "pricing.sub_f4": "Latest-generation models",
    "pricing.sub_f5": "Agents with automatic cloud execution",
    "pricing.sub_f6": "Priority support",

    "pricing.comparison_title": "Plan comparison",
    "pricing.comp_feature_col": "Feature",
    "pricing.comp_perpetual_col": "Perpetual license",
    "pricing.comp_sub_col": "Subscription",
    "pricing.comp_row1":  "Notes, tasks, timeline",
    "pricing.comp_row2":  "Views (kanban, calendar, list, cards)",
    "pricing.comp_row3":  "Apple Calendar & Reminders",
    "pricing.comp_row4":  "Google Drive & Docs",
    "pricing.comp_row5":  "Autonomous agents",
    "pricing.comp_row6":  "Version history",
    "pricing.comp_row7":  "AI with own API key",
    "pricing.comp_row8":  "Connect Claude subscription",
    "pricing.comp_row9":  "Managed AI (no API key)",
    "pricing.comp_row9_sub": "✓ 2M tokens/month",
    "pricing.comp_row10": "Priority support",

    "pricing.ai_modes_title":    "Three ways to use AI",
    "pricing.ai_modes_subtitle": "You choose how artificial intelligence works in From.",

    "pricing.mode_auto_title":  "Automatic (Subscription)",
    "pricing.mode_auto_body":   "No setup needed. From manages the API keys and models for you. Just subscribe and start using AI with included tokens.",
    "pricing.mode_manual_title": "Manual (own API key)",
    "pricing.mode_manual_body":  "Enter your Anthropic, OpenAI, or Google API key. Full control over the provider, model, and costs. Works with the perpetual license.",
    "pricing.mode_oauth_title":  "Claude OAuth",
    "pricing.mode_oauth_body":   "Connect your Claude Pro or Max subscription directly. Use your Claude quota without an API key, at no extra cost.",

    "pricing.faq_title": "Pricing questions",
    "pricing.faq1_q": "Can I use From without paying?",
    "pricing.faq1_a": "Yes. You can download From and use all its features for free — notes, tasks, views, projects, and agents. AI requires a plan: the perpetual license for your own API key, or a subscription for managed AI with no setup.",
    "pricing.faq2_q": "Does the perpetual license include updates?",
    "pricing.faq2_a": "Yes. All updates are included. Pay once, use From forever with every future improvement.",
    "pricing.faq3_q": "What happens if I cancel my subscription?",
    "pricing.faq3_a": "You keep using From with all its features, without managed AI. If you still want AI, you can get the perpetual license and connect your own API key.",
    "pricing.faq4_q": "Can I switch plans?",
    "pricing.faq4_a": "Yes. You can move from a perpetual license to a subscription, or vice versa, at any time from your account.",
    "pricing.faq5_q": "What are tokens?",
    "pricing.faq5_a": "Tokens are the unit of measurement for AI. Every chat question, AI edit, or agent run consumes tokens. 2M tokens per month covers normal use with margin. Need more? Top up 5M for €5.",

    "pricing.cta_title": "Start today",
    "pricing.cta_body":  "Download From for free and decide later which plan fits you.",
    "pricing.cta_btn":   "Download for macOS",

    /* ── support.html ── */
    "support.meta_title": "Support — From",
    "support.meta_desc":  "From help center. FAQ, guides, and contact.",
    "support.hero_title":    "Help center",
    "support.hero_subtitle": "Need help with From? Here you'll find answers to the most common questions and ways to reach us.",

    "support.email_title": "Email",
    "support.email_body":  "Write to us directly and we'll get back to you as soon as possible.",
    "support.inapp_title": "From the app",
    "support.inapp_body":  "In From, go to Settings → Support to send feedback or report issues directly.",
    "support.faq_card_title": "FAQ",
    "support.faq_card_body":  "Check the frequently asked questions below. Your question is probably already answered.",
    "support.faq_card_btn":   "See FAQ",

    "support.faq_section_title": "Frequently asked questions",
    "support.faq1_q":   "How do I install From on Mac?",
    "support.faq1_a":   "Download the .dmg from our website, open it, and drag From to your Applications folder. No installer or account needed to get started.",
    "support.faq1b_q":  "Is there an iPhone app?",
    "support.faq1b_a":  "Yes. From for iPhone is available on the <a href=\"https://apps.apple.com/app/from-tu-segundo-cerebro/id6769823296\">App Store</a>. It syncs in real time with your Mac.",
    "support.faq2_q":   "Where are my notes stored?",
    "support.faq2_a":   "Your notes are stored locally on your device. Sync between Mac and iPhone happens via From's private server, encrypted in transit. You can export everything as standard Markdown at any time from Settings → Export.",
    "support.faq4_q":   "How does sync work?",
    "support.faq4_a":   "From syncs in real time between Mac and iPhone via a private server. Open the app on any device and your changes are already there. No iCloud Drive. Requires a free account.",
    "support.faq6_q":   "How do I set up AI?",
    "support.faq6_a":   "With a subscription (€7/month), AI is ready with no setup: includes 2M tokens/month. With the perpetual license, go to Settings → AI, paste your Anthropic, OpenAI, or Google API key and choose the model.",
    "support.faq7_q":   "Are my notes sent to external servers?",
    "support.faq7_a":   "Only the snippet relevant to your query is sent to the AI provider's API when processing it. Nothing is stored on AI servers. Note sync goes to our private server, encrypted.",
    "support.faq8_q":   "Which AI providers does From support?",
    "support.faq8_a":   "Anthropic (Claude Haiku), OpenAI (GPT), and Google (Gemini). With a subscription you use From's managed model. With a perpetual license you choose your own provider and model.",
    "support.faq9_q":   "How do I connect Apple Calendar?",
    "support.manual_card_title": "User guide",
    "support.manual_card_body":  "Full guide to all From features: notes, tasks, AI, agents and more.",
    "support.manual_card_btn":   "View guide",
    "support.faq9_a":  "From requests Calendar access when you enable it in Settings → Integrations. Once granted, your events appear automatically in the timeline.",
    "support.faq10_q": "How do I connect Google Drive?",
    "support.faq10_a": "Go to Settings → Google. Click \"Connect account\" and follow Google's authorization flow. You can connect multiple accounts.",
    "support.faq11_q": "How do I cancel my subscription?",
    "support.faq11_a": "You can cancel at any time from <a href=\"account.html\">your account</a> or directly in the app at Settings → Account. Cancellation is immediate and no further charges are made.",
    "support.faq12_q": "How do I delete my account?",
    "support.faq12_a": "Send an email to <a href=\"mailto:hola@getfrom.app?subject=Account%20deletion%20request\">hola@getfrom.app</a> with the subject \"Account deletion request\". We'll remove all associated data from our server. Your local notes are not affected.",

    "support.cta_title": "Can't find what you're looking for?",
    "support.cta_body":  "Write to us and we'll help you personally.",

    /* ── account.html ── */
    "account.meta_title": "My account — From",
    "account.meta_desc":  "Manage your From account. Subscription, billing, tokens, and settings.",
    "account.hero_title":    "Manage your account",
    "account.hero_subtitle": "Handle your subscription, billing, and From settings here or directly from the app.",

    "account.sub_title": "Subscription",
    "account.sub_body":  "Manage your plan, switch between monthly and annual billing, or cancel at any time.",
    "account.sub_btn":   "Manage subscription",

    "account.billing_title": "Billing",
    "account.billing_body":  "View your payment history, download invoices, and update your payment method.",
    "account.billing_btn":   "View invoices",

    "account.tokens_title": "AI tokens",
    "account.tokens_body":  "Check your token balance in the app at Settings → AI. Buy additional tokens whenever you need them.",
    "account.tokens_btn":   "Buy tokens",

    "account.license_title": "License",
    "account.license_body":  "Activate your perpetual license in the app at Settings → Account. Enter the code you received by email.",
    "account.license_btn":   "See plans",

    "account.apikeys_title": "API Keys",
    "account.apikeys_body":  "Configure your Anthropic, OpenAI, or Google API keys in the app: Settings → AI → Manual mode.",
    "account.apikeys_note":  "API keys are stored only on your Mac, never on our servers.",

    "account.delete_title": "Delete account",
    "account.delete_body":  "Delete your account and all associated data on our server. Your local notes are not affected — they remain files on your Mac.",
    "account.delete_btn":   "Request deletion",

    "account.info_title": "Important information",
    "account.info1_q": "Your account and your notes are different things",
    "account.info1_a": "Your From account manages your subscription, tokens, and access to managed AI. Your notes are Markdown files on your Mac. Deleting your account does <strong>not</strong> delete your notes — those files remain yours, on your disk.",
    "account.info2_q": "Manage from the app",
    "account.info2_a": "Most account options are available directly in From: Settings → Account. From there you can view your plan, token balance, activate licenses, and configure API keys.",
    "account.info3_q": "Payments processed by LemonSqueezy",
    "account.info3_a": "Payments are processed securely through LemonSqueezy. We don't store card data. You can manage your payment method from the customer portal.",
    "account.info4_q": "Issues with your account?",
    "account.info4_a": "Write to us at <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> and we'll help you as soon as possible.",

    /* ── privacy.html ── */
    "privacy.meta_title":   "Privacy Policy — From",
    "privacy.meta_desc":    "From privacy policy. How we handle your data, what we collect, and what we don't.",
    "privacy.hero_title":   "Privacy Policy",
    "privacy.hero_subtitle": "At From, privacy isn't a feature. It's the architecture.",

    /* ── terms.html ── */
    "terms.meta_title":   "Terms of Service — From",
    "terms.meta_desc":    "Terms and conditions of use for From. License, subscription, responsibilities, and warranties.",
    "terms.hero_title":   "Terms of Service",
    "terms.hero_subtitle": "Terms of use for the From application and its associated services."
  }

};

/* ─── Core functions ─────────────────────────────────────── */

// Solo ES y EN. Cualquier idioma no-español usa inglés como fallback.
const LANGUAGES = ['es','en'];

function detectLang() {
  const saved = localStorage.getItem('from-lang');
  if (saved && LANGUAGES.includes(saved)) return saved;
  const b = (navigator.language || navigator.userLanguage || 'es').toLowerCase();
  // Español → español. Cualquier otro idioma → inglés.
  return b.startsWith('es') ? 'es' : 'en';
}

function applyTranslations(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['es'];

  const pageKey = document.body.dataset.page;
  if (pageKey) {
    const tk = pageKey + '.meta_title', dk = pageKey + '.meta_desc';
    if (t[tk]) document.title = t[tk];
    const md = document.querySelector('meta[name="description"]');
    if (md && t[dk]) md.setAttribute('content', t[dk]);
    const og1 = document.querySelector('meta[property="og:title"]');
    if (og1 && t[tk]) og1.setAttribute('content', t[tk]);
    const og2 = document.querySelector('meta[property="og:description"]');
    if (og2 && t[dk]) og2.setAttribute('content', t[dk]);
  }

  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t[el.getAttribute('data-i18n')];
    if (v !== undefined) el.textContent = v;
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = t[el.getAttribute('data-i18n-html')];
    if (v !== undefined) el.innerHTML = v;
  });

  const sel = document.getElementById('lang-select');
  if (sel) sel.value = lang;
}

function setLang(lang) {
  if (!LANGUAGES.includes(lang)) return;
  localStorage.setItem('from-lang', lang);
  applyTranslations(lang);
}

/* ─── Init ───────────────────────────────────────────────── */
(function init() {
  const lang = detectLang();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTranslations(lang));
  } else {
    applyTranslations(lang);
  }
})();
