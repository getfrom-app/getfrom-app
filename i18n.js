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
    "index.hero_badge":   "macOS + iPhone · Sync en tiempo real · Árbol de nodos",
    "index.hero_title":   "Tu segundo cerebro.<br><span>En todos tus dispositivos.</span>",
    "index.hero_subtitle": "From organiza todo en un árbol de nodos sincronizado en tiempo real entre tu Mac y tu iPhone. Notas, tareas, proyectos y agentes de IA en un solo lugar.",
    "index.hero_cta_primary":   "Descargar para Mac",
    "index.hero_cta_secondary": "Cómo funciona",
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

    "index.cta_title": "Tu segundo cerebro te está esperando",
    "index.cta_body":  "Descarga From y empieza a organizar tus ideas, tareas y proyectos. Disponible para Mac y iPhone.",
    "index.cta_btn":   "Descargar para macOS",

    /* ── pricing.html ── */
    "pricing.meta_title":   "Precios — From",
    "pricing.meta_desc":    "Precios de From. Licencia perpetua o suscripción con IA gestionada. Sin trucos, sin compromisos.",
    "pricing.hero_badge":   "Precios",
    "pricing.hero_title":   "Simple y transparente",
    "pricing.hero_subtitle": "Paga una vez y usa From para siempre conectando tu propia IA.<br>O suscríbete y ten la IA incluida sin configurar nada.",

    "pricing.perpetual_title":  "Licencia perpetua",
    "pricing.perpetual_desc":   "Para quienes quieren From para siempre",
    "pricing.perpetual_period": "Pago único. Para siempre.",
    "pricing.perpetual_btn":    "Comprar licencia",
    "pricing.perpetual_f1": "App completa sin límite de tiempo",
    "pricing.perpetual_f2": "Notas, tareas, vistas y timeline",
    "pricing.perpetual_f3": "Integración Apple Calendar y Recordatorios",
    "pricing.perpetual_f4": "Google Drive y Google Docs",
    "pricing.perpetual_f5": "Historial de versiones y backups",
    "pricing.perpetual_f6": "Agentes autónomos",
    "pricing.perpetual_f7": "IA con tu propia API key (Anthropic, OpenAI, Google)",
    "pricing.perpetual_f8": "Actualizaciones incluidas",

    "pricing.sub_title":  "Suscripción",
    "pricing.sub_desc":   "Todo incluido con IA gestionada",
    "pricing.sub_period": "Cancela cuando quieras",
    "pricing.sub_btn":    "Suscribirse",
    "pricing.sub_f1": "Todas las funciones de la app incluidas",
    "pricing.sub_f2": "10 millones de tokens IA/mes incluidos",
    "pricing.sub_f3": "IA gestionada: sin API key, sin configuración",
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
    "support.faq1_q":  "¿Cómo instalo From?",
    "support.faq1_a":  "Descarga el archivo .dmg desde nuestra web, ábrelo y arrastra From a tu carpeta de Aplicaciones. No necesitas instalador ni crear una cuenta para empezar.",
    "support.faq2_q":  "¿Dónde se guardan mis notas?",
    "support.faq2_a":  "En una carpeta de tu Mac. Por defecto, From crea un espacio en iCloud Drive, pero puedes elegir cualquier carpeta. Tus notas son archivos .md estándar que puedes abrir con cualquier editor.",
    "support.faq3_q":  "¿Puedo usar una carpeta de Obsidian existente?",
    "support.faq3_a":  "Sí. Puedes apuntar From a cualquier carpeta existente con archivos Markdown. From leerá la estructura y te permitirá trabajar con esas notas.",
    "support.faq4_q":  "¿Cómo funciona la sincronización?",
    "support.faq4_a":  "From usa iCloud Drive. Si tu espacio está en iCloud (opción por defecto), las notas se sincronizan automáticamente entre todos tus Macs. No hay que configurar nada extra.",
    "support.faq5_q":  "¿Puedo acceder a mis notas desde iPhone?",
    "support.faq5_a":  "Tus notas en iCloud Drive son accesibles desde la app Archivos de iOS, o con cualquier editor Markdown para iPhone. La app nativa de From para iOS está en desarrollo.",
    "support.faq6_q":  "¿Cómo configuro la IA?",
    "support.faq6_a":  "Ve a Ajustes → IA. Elige entre modo automático (suscripción), manual (tu propia API key) o Claude OAuth (tu suscripción de Claude). En modo manual, pega tu API key y elige el modelo.",
    "support.faq7_q":  "¿Mis notas se envían a un servidor?",
    "support.faq7_a":  "No. From indexa tus notas localmente. Cuando usas la IA, solo el fragmento relevante se envía a la API del proveedor (Anthropic, OpenAI o Google) para procesar tu consulta. Nada se almacena en servidores externos.",
    "support.faq8_q":  "¿Qué proveedores de IA soporta From?",
    "support.faq8_a":  "Anthropic (Claude), OpenAI (GPT) y Google (Gemini). Puedes cambiar de proveedor en cualquier momento desde Ajustes → IA.",
    "support.faq9_q":  "¿Cómo conecto Apple Calendar?",
    "support.faq9_a":  "From pide permiso de acceso a Calendar cuando lo activas en Ajustes → Integraciones. Una vez concedido, tus eventos aparecen automáticamente en el timeline.",
    "support.faq10_q": "¿Cómo conecto Google Drive?",
    "support.faq10_a": "Ve a Ajustes → Google. Haz clic en \"Conectar cuenta\" y sigue el proceso de autorización de Google. Puedes conectar múltiples cuentas.",
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
    "index.hero_badge":   "macOS + iPhone · Real-time sync · Node tree",
    "index.hero_title":   "Your second brain.<br><span>On all your devices.</span>",
    "index.hero_subtitle": "From organizes everything in a node tree synced in real time between your Mac and iPhone. Notes, tasks, projects, and AI agents — all in one place.",
    "index.hero_cta_primary":   "Download for Mac",
    "index.hero_cta_secondary": "How it works",
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

    "index.cta_title": "Your second brain is waiting",
    "index.cta_body":  "Download From and start organizing your ideas, tasks, and projects. Available for Mac and iPhone.",
    "index.cta_btn":   "Download for macOS",

    /* ── pricing.html ── */
    "pricing.meta_title":   "Pricing — From",
    "pricing.meta_desc":    "From pricing. One-time license or subscription with managed AI. No tricks, no lock-in.",
    "pricing.hero_badge":   "Pricing",
    "pricing.hero_title":   "Simple and transparent",
    "pricing.hero_subtitle": "Pay once and use From forever with your own AI.<br>Or subscribe and get AI included with no setup required.",

    "pricing.perpetual_title":  "Perpetual license",
    "pricing.perpetual_desc":   "For those who want From forever",
    "pricing.perpetual_period": "One-time payment. Yours forever.",
    "pricing.perpetual_btn":    "Buy license",
    "pricing.perpetual_f1": "Full app, no time limit",
    "pricing.perpetual_f2": "Notes, tasks, views, and timeline",
    "pricing.perpetual_f3": "Apple Calendar & Reminders integration",
    "pricing.perpetual_f4": "Google Drive & Google Docs",
    "pricing.perpetual_f5": "Version history & backups",
    "pricing.perpetual_f6": "Autonomous agents",
    "pricing.perpetual_f7": "AI with your own API key (Anthropic, OpenAI, Google)",
    "pricing.perpetual_f8": "All future updates included",

    "pricing.sub_title":  "Subscription",
    "pricing.sub_desc":   "Everything included with managed AI",
    "pricing.sub_period": "Cancel anytime",
    "pricing.sub_btn":    "Subscribe",
    "pricing.sub_f1": "All app features included",
    "pricing.sub_f2": "10 million AI tokens/month included",
    "pricing.sub_f3": "Managed AI: no API key, no setup",
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
    "support.faq1_q":  "How do I install From?",
    "support.faq1_a":  "Download the .dmg from our website, open it, and drag From to your Applications folder. No installer or account needed to get started.",
    "support.faq2_q":  "Where are my notes stored?",
    "support.faq2_a":  "In a folder on your Mac. By default, From creates a workspace in iCloud Drive, but you can choose any folder. Your notes are standard .md files that open in any editor.",
    "support.faq3_q":  "Can I use an existing Obsidian vault?",
    "support.faq3_a":  "Yes. You can point From at any existing folder with Markdown files. From will read the structure and let you work with those notes.",
    "support.faq4_q":  "How does sync work?",
    "support.faq4_a":  "From uses iCloud Drive. If your workspace is in iCloud (the default), notes sync automatically across all your Macs. No extra configuration needed.",
    "support.faq5_q":  "Can I access my notes from iPhone?",
    "support.faq5_a":  "Your notes in iCloud Drive are accessible from the iOS Files app or any Markdown editor for iPhone. A native From app for iOS is in development.",
    "support.faq6_q":  "How do I set up AI?",
    "support.faq6_a":  "Go to Settings → AI. Choose between automatic mode (subscription), manual (your own API key), or Claude OAuth (your Claude subscription). In manual mode, paste your API key and choose the model.",
    "support.faq7_q":  "Are my notes sent to a server?",
    "support.faq7_a":  "No. From indexes your notes locally. When you use AI, only the relevant snippet is sent to the provider's API (Anthropic, OpenAI, or Google) to process your query. Nothing is stored on external servers.",
    "support.faq8_q":  "Which AI providers does From support?",
    "support.faq8_a":  "Anthropic (Claude), OpenAI (GPT), and Google (Gemini). You can switch providers at any time from Settings → AI.",
    "support.faq9_q":  "How do I connect Apple Calendar?",
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

  ,fr: {
    "nav.features":"Fonctionnalités","nav.sync":"Sync","nav.ai":"IA","nav.pricing":"Tarifs","nav.support":"Support","nav.download":"Télécharger",
    "footer.tagline":"Votre second cerveau. Sur votre Mac. Rien qu'à vous.","footer.col_product":"Produit","footer.col_support":"Support","footer.col_legal":"Légal","footer.link_features":"Fonctionnalités","footer.link_pricing":"Tarifs","footer.link_download":"Télécharger","footer.link_help":"Centre d'aide","footer.link_contact":"Contact","footer.link_account":"Mon compte","footer.link_privacy":"Confidentialité","footer.link_terms":"Conditions",
    "index.meta_title":"From — Vos notes. Votre productivité. Votre contrôle.","index.meta_desc":"From est une app native macOS qui ajoute une couche de productivité à vos notes sans vous retirer le contrôle. Fichiers Markdown, iCloud, IA contextuelle. Vos données vous appartiennent.",
    "index.hero_badge":"macOS natif · Local-first · Markdown","index.hero_title":"Vos notes vous appartiennent.<br><span>From les rend productives.</span>","index.hero_subtitle":"Fichiers Markdown sur votre Mac, synchronisés via iCloud, organisés comme vous le souhaitez. From ajoute des tâches, des vues, une IA et de l'automatisation sans toucher à votre propriété des données.","index.hero_cta_primary":"Télécharger pour Mac","index.hero_cta_secondary":"Comment ça marche","index.screenshot_placeholder":"Capture de From (bientôt disponible)",
    "index.philosophy_label":"Philosophie","index.philosophy_title":"Vos notes ne devraient pas appartenir à une app","index.philosophy_subtitle":"La plupart des apps de productivité stockent vos données sur leurs serveurs, dans des formats propriétaires. Si l'app ferme, vos notes disparaissent. From fonctionne à l'envers.",
    "index.card_md_title":"Fichiers .md standard","index.card_md_body":"Chaque note est un fichier Markdown sur votre disque. Ouvrez-le avec VS Code, Obsidian, iA Writer ou n'importe quel éditeur. Aucun format propriétaire.","index.card_folder_title":"Dans votre dossier, pas dans le cloud","index.card_folder_body":"Vos données vivent dans un dossier de votre Mac (iCloud Drive par défaut). From lit ce dossier. Désinstallez From et vos notes restent là.","index.card_layer_title":"From est la couche, pas le conteneur","index.card_layer_body":"From ajoute de la productivité — vues, tâches, IA, automatisation — par-dessus vos fichiers. C'est une couche intelligente, pas une prison pour vos données.",
    "index.features_label":"Fonctionnalités","index.features_title":"Tout ce dont vous avez besoin pour organiser votre vie","index.features_subtitle":"Notes, tâches, projets, calendrier, vues configurables et un assistant IA qui connaît votre contexte.",
    "index.feat_editor_title":"Éditeur Markdown visuel","index.feat_editor_body":"Un éditeur riche qui masque la syntaxe et affiche le résultat. Wikilinks entre notes, pièces jointes, images et mise en forme sans complications.","index.feat_tasks_title":"Tâches intégrées","index.feat_tasks_body":"Les tâches sont des notes avec une date, une priorité et un statut. Créez, complétez et organisez sans quitter votre flux. Drag & drop sur la timeline.","index.feat_timeline_title":"Timeline : jour, semaine, mois, an","index.feat_timeline_body":"Visualisez tâches, événements Apple Calendar et rappels dans une seule vue temporelle. Glissez pour reprogrammer.","index.feat_hierarchy_title":"Hiérarchie flexible","index.feat_hierarchy_body":"Zones, projets et notes enfants. Sans dossiers rigides : chaque note sait d'où elle vient. Organisez comme vous pensez.","index.feat_views_title":"Vues configurables","index.feat_views_body":"Kanban, calendrier, liste, cartes et focus. Configurez des vues par projet, filtrez et combinez. Chaque projet s'affiche comme vous le souhaitez.","index.feat_native_title":"macOS 100% natif","index.feat_native_body":"Swift et SwiftUI. Performances réelles, intégration système, raccourcis clavier natifs. Ça fait partie de votre Mac.","index.feat_collections_title":"Collections transversales","index.feat_collections_body":"Regroupez des notes de différents projets en collections. Créez des vues croisées sans déplacer de fichiers.","index.feat_canvas_title":"Canvas visuel","index.feat_canvas_body":"Un tableau infini pour les diagrammes, cartes mentales et brainstorming. Connectez des idées visuellement sans limites.","index.feat_history_title":"Historique des versions","index.feat_history_body":"Chaque modification est sauvegardée automatiquement. Voyagez dans le temps à n'importe quelle version précédente d'un clic.",
    "index.sync_label":"Synchronisation","index.sync_title":"Vos notes, sur tous vos appareils","index.sync_subtitle":"From utilise iCloud Drive pour se synchroniser automatiquement sur tous vos appareils Apple. Sans configuration, sans comptes supplémentaires.","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"Autres Macs",
    "index.sync_icloud_title":"iCloud Drive natif","index.sync_icloud_body":"Votre espace From est un dossier dans iCloud Drive. Il se synchronise automatiquement entre tous vos Macs sans aucune action de votre part.","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"Connectez plusieurs comptes Google. Liez des notes à Google Docs avec synchronisation bidirectionnelle automatique. Vos Docs Google comme contexte pour l'IA.","index.sync_backup_title":"Sauvegarde automatique","index.sync_backup_body":"Sauvegardes quotidiennes automatiques de tout votre espace. Restaurez n'importe quelle note à une version précédente en un clic.",
    "index.integrations_label":"Intégrations","index.integrations_title":"Connecté à ce que vous utilisez déjà","index.integrations_subtitle":"From s'intègre nativement avec les apps Apple et Google qui font déjà partie de votre quotidien.",
    "index.int_calendar_title":"Apple Calendar","index.int_calendar_body":"Vos événements apparaissent dans la timeline de From. Créez des événements depuis des notes. Synchronisation bidirectionnelle.","index.int_reminders_title":"Apple Rappels","index.int_reminders_body":"Les tâches From se synchronisent avec les Rappels Apple. Complétez depuis n'importe quel appareil.","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"Parcourez, recherchez et liez des fichiers Drive. Multi-compte. Accédez à vos dossiers sans quitter From.","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"Liez des notes à Google Docs. Éditez d'un côté et ça se synchronise de l'autre. Auto-sync à la sauvegarde.","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"Stockage principal. Vos notes se synchronisent entre tous vos Macs automatiquement.","index.int_aimodels_title":"Claude, GPT & Gemini","index.int_aimodels_body":"Choisissez votre fournisseur d'IA préféré. Utilisez votre propre clé API ou l'IA gérée de From avec des tokens inclus.",
    "index.ai_label":"Intelligence Artificielle","index.ai_title":"Une IA qui connaît votre contexte","index.ai_subtitle":"Pas un chatbot générique. Un assistant qui a lu vos notes, comprend vos projets et travaille avec vos vraies informations.",
    "index.ai_chat_title":"Chat contextuel","index.ai_chat_body":"Posez des questions sur vos notes, résumez des projets, trouvez des informations. L'IA récupère les passages pertinents de votre espace avec recherche sémantique.","index.ai_editor_title":"Éditeur IA","index.ai_editor_body":"L'IA modifie vos notes directement. Révisez les changements, confirmez-les ou annulez-les. Un vrai copilote pour votre écriture.","index.ai_agents_title":"Agents autonomes","index.ai_agents_body":"Créez des agents en langage naturel. Ils s'exécutent automatiquement : quotidiennement, hebdomadairement, à l'ouverture de l'app. Ils lisent, créent et mettent à jour des notes pour vous.","index.ai_privacy_title":"Vraie confidentialité","index.ai_privacy_body":"Seul le fragment pertinent voyage vers l'API IA. Rien n'est stocké sur des serveurs. Utilisez votre propre clé API pour un contrôle total.",
    "index.privacy_label":"Confidentialité","index.privacy_title":"Confidentialité radicale","index.privacy_subtitle":"Pas du marketing. C'est l'architecture. From ne peut pas accéder à vos données même s'il le voulait.",
    "index.priv_noserver_title":"Sans serveurs propriétaires","index.priv_noserver_body":"Vos fichiers vivent sur votre Mac et dans votre iCloud privé. From n'a pas de backend qui stocke vos données.","index.priv_notelemetry_title":"Zéro télémétrie","index.priv_notelemetry_body":"Nous ne suivons pas l'utilisation, n'envoyons pas d'analytics, ne collectons pas de données comportementales. Zéro.","index.priv_nolockin_title":"Sans lock-in","index.priv_nolockin_body":"Fichiers Markdown standard. Si vous quittez From, vos notes continuent de fonctionner dans n'importe quel éditeur.",
    "index.steps_title":"Prêt en 30 secondes","index.step1_title":"Téléchargez From","index.step1_body":"Ouvrez le .dmg et faites glisser From dans Applications. Pas d'installeur, pas de compte obligatoire.","index.step2_title":"Choisissez votre dossier","index.step2_body":"From crée un dossier dans iCloud Drive par défaut. Ou choisissez n'importe quel dossier existant.","index.step3_title":"Commencez à travailler","index.step3_body":"Créez des notes, organisez des projets, planifiez des tâches. L'IA connaît déjà votre contexte dès la première minute.",
    "index.pricing_teaser_title":"Simple et juste","index.pricing_teaser_body":"Une licence perpétuelle pour utiliser From pour toujours. Abonnement optionnel uniquement si vous voulez une IA gérée sans configurer de clés API.","index.pricing_teaser_cta":"Voir les tarifs",
    "index.faq_title":"Questions fréquentes","index.faq1_q":"Ai-je besoin d'Obsidian pour utiliser From ?","index.faq1_a":"Non. From est entièrement indépendant. Il utilise des fichiers Markdown standard, vous pouvez donc ouvrir les mêmes notes dans Obsidian ou tout autre éditeur, mais ce n'est pas nécessaire.","index.faq2_q":"Comment fonctionne l'IA ?","index.faq2_a":"From indexe vos notes localement. Quand vous posez une question, il récupère les fragments pertinents et les envoie à l'API IA. Seul le fragment nécessaire voyage — rien n'est stocké sur des serveurs externes.","index.faq3_q":"Puis-je synchroniser entre appareils ?","index.faq3_a":"Oui. Si vous utilisez iCloud Drive (l'option par défaut), vos notes se synchronisent automatiquement entre tous vos Macs.","index.faq4_q":"Ça fonctionne sur iPhone ou iPad ?","index.faq4_a":"Pour l'instant, From est uniquement pour macOS. L'app native iOS est en développement.","index.faq5_q":"Que se passe-t-il si j'arrête d'utiliser From ?","index.faq5_a":"Rien. Vos notes sont des fichiers .md sur votre ordinateur. Ils restent là, lisibles par n'importe quel éditeur.","index.faq6_q":"Ai-je besoin d'une clé API pour l'IA ?","index.faq6_a":"Non nécessairement. Vous pouvez utiliser l'IA gérée de From (avec abonnement) ou apporter votre propre clé API. Vous pouvez aussi connecter votre abonnement Claude directement.","index.faq7_q":"Mes données sont-elles en sécurité ?","index.faq7_a":"Vos notes ne quittent jamais votre Mac ni votre iCloud privé. From n'a pas de serveurs qui stockent vos données. Pas de télémétrie, pas d'analytics, pas de tracking.",
    "index.cta_title":"Votre second cerveau vous attend","index.cta_body":"Téléchargez From et commencez à organiser vos notes, tâches et projets. Sans compte, sans carte, sans engagement.","index.cta_btn":"Télécharger pour macOS",
    "pricing.meta_title":"Tarifs — From","pricing.meta_desc":"Tarifs de From. Licence perpétuelle ou abonnement avec IA gérée. Sans surprises.","pricing.hero_badge":"Tarifs","pricing.hero_title":"Simple et transparent","pricing.hero_subtitle":"Payez une fois et utilisez From pour toujours avec votre propre IA.<br>Ou abonnez-vous et bénéficiez de l'IA incluse sans rien configurer.",
    "pricing.perpetual_title":"Licence perpétuelle","pricing.perpetual_desc":"Pour ceux qui veulent From pour toujours","pricing.perpetual_period":"Paiement unique. Pour toujours.","pricing.perpetual_btn":"Acheter la licence","pricing.perpetual_f1":"App complète sans limite de temps","pricing.perpetual_f2":"Notes, tâches, vues et timeline","pricing.perpetual_f3":"Intégration Apple Calendar & Rappels","pricing.perpetual_f4":"Google Drive & Google Docs","pricing.perpetual_f5":"Historique des versions & sauvegardes","pricing.perpetual_f6":"Agents autonomes","pricing.perpetual_f7":"IA avec votre propre clé API (Anthropic, OpenAI, Google)","pricing.perpetual_f8":"Mises à jour incluses",
    "pricing.sub_title":"Abonnement","pricing.sub_desc":"Tout inclus avec IA gérée","pricing.sub_period":"Annulez quand vous voulez","pricing.sub_btn":"S'abonner","pricing.sub_f1":"Toutes les fonctionnalités de l'app incluses","pricing.sub_f2":"10 millions de tokens IA/mois inclus","pricing.sub_f3":"IA gérée : sans clé API, sans configuration","pricing.sub_f4":"Modèles de dernière génération","pricing.sub_f5":"Agents avec exécution automatique dans le cloud","pricing.sub_f6":"Support prioritaire",
    "pricing.comparison_title":"Comparatif des plans","pricing.comp_feature_col":"Fonctionnalité","pricing.comp_perpetual_col":"Licence perpétuelle","pricing.comp_sub_col":"Abonnement","pricing.comp_row1":"Notes, tâches, timeline","pricing.comp_row2":"Vues (kanban, calendrier, liste, cartes)","pricing.comp_row3":"Apple Calendar & Rappels","pricing.comp_row4":"Google Drive & Docs","pricing.comp_row5":"Agents autonomes","pricing.comp_row6":"Historique des versions","pricing.comp_row7":"IA avec clé API propre","pricing.comp_row8":"Connecter abonnement Claude","pricing.comp_row9":"IA gérée (sans clé API)","pricing.comp_row9_sub":"✓ 2M tokens/mois","pricing.comp_row10":"Support prioritaire",
    "pricing.ai_modes_title":"Trois façons d'utiliser l'IA","pricing.ai_modes_subtitle":"Vous choisissez comment fonctionne l'intelligence artificielle dans From.","pricing.mode_auto_title":"Automatique (Abonnement)","pricing.mode_auto_body":"Sans rien configurer. From gère les clés API et les modèles pour vous. Abonnez-vous et commencez à utiliser l'IA avec des tokens inclus.","pricing.mode_manual_title":"Manuel (clé API propre)","pricing.mode_manual_body":"Entrez votre clé API Anthropic, OpenAI ou Google. Contrôle total sur le fournisseur, le modèle et les coûts. Fonctionne avec la licence perpétuelle.","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"Connectez votre abonnement Claude Pro ou Max directement. Utilisez votre quota Claude sans clé API, sans coût supplémentaire.",
    "pricing.faq_title":"Questions sur les tarifs","pricing.faq1_q":"Puis-je utiliser From sans payer ?","pricing.faq1_a":"Oui. Vous pouvez télécharger From et utiliser toutes ses fonctionnalités gratuitement — notes, tâches, vues, projets et agents. L'IA nécessite un plan : licence perpétuelle pour votre propre clé API, ou abonnement pour l'IA gérée.","pricing.faq2_q":"La licence perpétuelle inclut-elle les mises à jour ?","pricing.faq2_a":"Oui. Toutes les mises à jour sont incluses. Payez une fois, utilisez From pour toujours avec toutes les améliorations futures.","pricing.faq3_q":"Que se passe-t-il si j'annule mon abonnement ?","pricing.faq3_a":"Vous continuez à utiliser From avec toutes ses fonctionnalités, sans IA gérée. Pour continuer à utiliser l'IA, vous pouvez acquérir la licence perpétuelle et connecter votre propre clé API.","pricing.faq4_q":"Puis-je changer de plan ?","pricing.faq4_a":"Oui. Vous pouvez passer d'une licence perpétuelle à un abonnement ou vice versa à tout moment depuis votre compte.","pricing.faq5_q":"Que sont les tokens ?","pricing.faq5_a":"Les tokens sont l'unité de mesure de l'IA. Chaque question au chat, édition IA ou exécution d'agent consomme des tokens. 2M de tokens par mois couvrent un usage normal.",
    "pricing.cta_title":"Commencez aujourd'hui","pricing.cta_body":"Téléchargez From gratuitement et décidez ensuite quel plan vous convient.","pricing.cta_btn":"Télécharger pour macOS",
    "support.meta_title":"Support — From","support.meta_desc":"Centre d'aide de From. FAQ, guides et contact.","support.hero_title":"Centre d'aide","support.hero_subtitle":"Besoin d'aide avec From ? Trouvez ici des réponses aux questions les plus fréquentes et les moyens de nous contacter.",
    "support.email_title":"Email","support.email_body":"Écrivez-nous directement et nous vous répondrons dans les plus brefs délais.","support.inapp_title":"Depuis l'app","support.inapp_body":"Dans From, allez dans Réglages → Support pour envoyer des commentaires ou signaler des problèmes directement.","support.faq_card_title":"FAQ","support.faq_card_body":"Consultez les questions fréquentes ci-dessous. Votre question est probablement déjà résolue.","support.faq_card_btn":"Voir la FAQ",
    "support.faq_section_title":"Questions fréquentes","support.faq1_q":"Comment installer From ?","support.faq1_a":"Téléchargez le fichier .dmg depuis notre site, ouvrez-le et faites glisser From dans votre dossier Applications. Pas d'installeur ni de compte nécessaire pour commencer.","support.faq2_q":"Où sont stockées mes notes ?","support.faq2_a":"Dans un dossier de votre Mac. Par défaut, From crée un espace dans iCloud Drive, mais vous pouvez choisir n'importe quel dossier. Vos notes sont des fichiers .md standard.","support.faq3_q":"Puis-je utiliser un vault Obsidian existant ?","support.faq3_a":"Oui. Vous pouvez pointer From vers n'importe quel dossier existant avec des fichiers Markdown.","support.faq4_q":"Comment fonctionne la synchronisation ?","support.faq4_a":"From utilise iCloud Drive. Si votre espace est dans iCloud (l'option par défaut), les notes se synchronisent automatiquement entre tous vos Macs.","support.faq5_q":"Puis-je accéder à mes notes depuis iPhone ?","support.faq5_a":"Vos notes dans iCloud Drive sont accessibles depuis l'app Fichiers iOS ou tout éditeur Markdown pour iPhone. L'app native From pour iOS est en développement.","support.faq6_q":"Comment configurer l'IA ?","support.faq6_a":"Allez dans Réglages → IA. Choisissez entre le mode automatique (abonnement), manuel (votre propre clé API) ou Claude OAuth.","support.faq7_q":"Mes notes sont-elles envoyées à un serveur ?","support.faq7_a":"Non. From indexe vos notes localement. Seul le fragment pertinent est envoyé à l'API du fournisseur pour traiter votre requête.","support.faq8_q":"Quels fournisseurs d'IA From supporte-t-il ?","support.faq8_a":"Anthropic (Claude), OpenAI (GPT) et Google (Gemini). Vous pouvez changer de fournisseur à tout moment dans Réglages → IA.","support.faq9_q":"Comment connecter Apple Calendar ?","support.faq9_a":"From demande l'accès au Calendrier quand vous l'activez dans Réglages → Intégrations. Une fois accordé, vos événements apparaissent automatiquement dans la timeline.","support.faq10_q":"Comment connecter Google Drive ?","support.faq10_a":"Allez dans Réglages → Google. Cliquez sur \"Connecter un compte\" et suivez le processus d'autorisation Google.","support.faq11_q":"Comment annuler mon abonnement ?","support.faq11_a":"Vous pouvez annuler à tout moment depuis <a href=\"account.html\">votre compte</a> ou directement dans l'app dans Réglages → Compte.","support.faq12_q":"Comment supprimer mon compte ?","support.faq12_a":"Envoyez un email à <a href=\"mailto:hola@getfrom.app?subject=Demande%20de%20suppression%20de%20compte\">hola@getfrom.app</a> avec l'objet \"Demande de suppression de compte\".",
    "support.cta_title":"Vous ne trouvez pas ce que vous cherchez ?","support.cta_body":"Écrivez-nous et nous vous aiderons personnellement.",
    "account.meta_title":"Mon compte — From","account.meta_desc":"Gérez votre compte From. Abonnement, facturation, tokens et configuration.","account.hero_title":"Gérez votre compte","account.hero_subtitle":"Administrez votre abonnement, facturation et configuration de From ici ou directement depuis l'app.",
    "account.sub_title":"Abonnement","account.sub_body":"Gérez votre plan, passez de mensuel à annuel, ou annulez à tout moment.","account.sub_btn":"Gérer l'abonnement","account.billing_title":"Facturation","account.billing_body":"Consultez votre historique de paiements, téléchargez des factures et mettez à jour votre mode de paiement.","account.billing_btn":"Voir les factures","account.tokens_title":"Tokens IA","account.tokens_body":"Consultez votre solde de tokens depuis l'app dans Réglages → IA. Achetez des tokens supplémentaires si nécessaire.","account.tokens_btn":"Acheter des tokens","account.license_title":"Licence","account.license_body":"Activez votre licence perpétuelle depuis l'app dans Réglages → Compte. Entrez le code reçu par email.","account.license_btn":"Voir les plans","account.apikeys_title":"Clés API","account.apikeys_body":"Configurez vos clés API Anthropic, OpenAI ou Google dans l'app : Réglages → IA → Mode manuel.","account.apikeys_note":"Les clés API sont stockées uniquement sur votre Mac, jamais sur nos serveurs.",
    "account.delete_title":"Supprimer le compte","account.delete_body":"Supprimez votre compte et toutes les données associées sur notre serveur. Vos notes locales ne sont pas affectées.","account.delete_btn":"Demander la suppression",
    "account.info_title":"Informations importantes","account.info1_q":"Votre compte et vos notes sont deux choses différentes","account.info1_a":"Votre compte From gère l'abonnement, les tokens et l'accès à l'IA gérée. Vos notes sont des fichiers Markdown sur votre Mac. Supprimer votre compte ne supprime <strong>pas</strong> vos notes.","account.info2_q":"Gestion depuis l'app","account.info2_a":"La plupart des options de compte sont disponibles directement dans From : Réglages → Compte.","account.info3_q":"Paiements traités par LemonSqueezy","account.info3_a":"Les paiements sont traités de façon sécurisée via LemonSqueezy. Nous ne stockons pas de données de carte.","account.info4_q":"Problèmes avec votre compte ?","account.info4_a":"Écrivez-nous à <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> et nous vous aiderons au plus vite.",
    "privacy.meta_title":"Politique de Confidentialité — From","privacy.meta_desc":"Politique de confidentialité de From. Comment nous traitons vos données.","privacy.hero_title":"Politique de Confidentialité","privacy.hero_subtitle":"Chez From, la confidentialité n'est pas une fonctionnalité. C'est l'architecture.",
    "terms.meta_title":"Conditions d'utilisation — From","terms.meta_desc":"Conditions générales d'utilisation de From. Licence, abonnement, responsabilités et garanties.","terms.hero_title":"Conditions d'utilisation","terms.hero_subtitle":"Conditions d'utilisation de l'application From et de ses services associés."
  }

  ,de: {
    "nav.features":"Funktionen","nav.sync":"Sync","nav.ai":"KI","nav.pricing":"Preise","nav.support":"Support","nav.download":"Herunterladen",
    "footer.tagline":"Dein zweites Gehirn. Auf deinem Mac. Nur deins.","footer.col_product":"Produkt","footer.col_support":"Support","footer.col_legal":"Rechtliches","footer.link_features":"Funktionen","footer.link_pricing":"Preise","footer.link_download":"Herunterladen","footer.link_help":"Hilfe-Center","footer.link_contact":"Kontakt","footer.link_account":"Mein Konto","footer.link_privacy":"Datenschutz","footer.link_terms":"Nutzungsbedingungen",
    "index.meta_title":"From — Deine Notizen. Deine Produktivität. Deine Kontrolle.","index.meta_desc":"From ist eine native macOS-App, die deinen Notizen eine Produktivitätsschicht hinzufügt, ohne dir die Kontrolle zu nehmen. Markdown-Dateien, iCloud, kontextuelle KI. Deine Daten gehören dir.",
    "index.hero_badge":"Natives macOS · Local-first · Markdown","index.hero_title":"Deine Notizen gehören dir.<br><span>From macht sie produktiv.</span>","index.hero_subtitle":"Markdown-Dateien auf deinem Mac, über iCloud synchronisiert, so organisiert wie du willst. From fügt Aufgaben, Ansichten, KI und Automatisierung hinzu, ohne dein Eigentum an den Daten anzutasten.","index.hero_cta_primary":"Für Mac herunterladen","index.hero_cta_secondary":"So funktioniert's","index.screenshot_placeholder":"From-Screenshot (demnächst)",
    "index.philosophy_label":"Philosophie","index.philosophy_title":"Deine Notizen sollten keiner App gehören","index.philosophy_subtitle":"Die meisten Produktivitäts-Apps speichern deine Daten auf ihren Servern, in proprietären Formaten. Schließt die App, verschwinden deine Notizen. From funktioniert umgekehrt.",
    "index.card_md_title":"Standard-.md-Dateien","index.card_md_body":"Jede Notiz ist eine Markdown-Datei auf deiner Festplatte. Öffne sie mit VS Code, Obsidian, iA Writer oder jedem Texteditor. Kein proprietäres Format.","index.card_folder_title":"In deinem Ordner, nicht in der Cloud","index.card_folder_body":"Deine Daten liegen in einem Ordner auf deinem Mac (standardmäßig iCloud Drive). From liest diesen Ordner. Deinstalliere From und deine Notizen bleiben trotzdem da.","index.card_layer_title":"From ist die Schicht, nicht der Container","index.card_layer_body":"From fügt Produktivität hinzu — Ansichten, Aufgaben, KI, Automatisierung — auf deinen Dateien. Eine intelligente Schicht, kein Gefängnis für deine Daten.",
    "index.features_label":"Funktionen","index.features_title":"Alles, was du brauchst, um dein Leben zu organisieren","index.features_subtitle":"Notizen, Aufgaben, Projekte, Kalender, konfigurierbare Ansichten und ein KI-Assistent, der deinen Kontext kennt.",
    "index.feat_editor_title":"Visueller Markdown-Editor","index.feat_editor_body":"Ein reichhaltiger Editor, der die Syntax verbirgt und das Ergebnis zeigt. Wikilinks zwischen Notizen, Anhänge, Bilder und Formatierung ohne Komplikationen.","index.feat_tasks_title":"Integrierte Aufgaben","index.feat_tasks_body":"Aufgaben sind Notizen mit Datum, Priorität und Status. Erstelle, erledige und organisiere, ohne deinen Fluss zu unterbrechen. Drag & Drop in der Timeline.","index.feat_timeline_title":"Timeline: Tag, Woche, Monat, Jahr","index.feat_timeline_body":"Sieh Aufgaben, Apple-Kalender-Ereignisse und Erinnerungen in einer einzigen Zeitansicht. Ziehen zum Neuterminieren.","index.feat_hierarchy_title":"Flexible Hierarchie","index.feat_hierarchy_body":"Bereiche, Projekte und untergeordnete Notizen. Ohne starre Ordner — jede Notiz weiß, wo sie hingehört. Organisiere wie du denkst.","index.feat_views_title":"Konfigurierbare Ansichten","index.feat_views_body":"Kanban, Kalender, Liste, Karten und Fokus. Konfiguriere Ansichten pro Projekt, filtere und kombiniere. Jedes Projekt sieht genau so aus, wie du es brauchst.","index.feat_native_title":"100% natives macOS","index.feat_native_body":"Swift und SwiftUI. Echte Performance, Systemintegration, native Tastenkürzel. Fühlt sich an wie ein Teil deines Macs.","index.feat_collections_title":"Projektübergreifende Sammlungen","index.feat_collections_body":"Gruppiere Notizen aus verschiedenen Projekten in Sammlungen. Erstelle projektübergreifende Ansichten, ohne Dateien zu verschieben.","index.feat_canvas_title":"Visuelles Canvas","index.feat_canvas_body":"Ein unendliches Board für Diagramme, Mind Maps und Brainstorming. Verbinde Ideen visuell ohne Grenzen.","index.feat_history_title":"Versionsverlauf","index.feat_history_body":"Jede Änderung wird automatisch gespeichert. Reise mit einem Klick zu jeder früheren Version deiner Notizen zurück.",
    "index.sync_label":"Synchronisierung","index.sync_title":"Deine Notizen auf allen deinen Geräten","index.sync_subtitle":"From verwendet iCloud Drive, um automatisch über alle deine Apple-Geräte zu synchronisieren. Ohne Konfiguration, ohne zusätzliche Konten.","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"Andere Macs",
    "index.sync_icloud_title":"Natives iCloud Drive","index.sync_icloud_body":"Dein From-Arbeitsbereich ist ein Ordner in iCloud Drive. Er synchronisiert sich automatisch über alle deine Macs, ohne dass du etwas tun musst.","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"Verbinde mehrere Google-Konten. Verknüpfe Notizen mit Google Docs mit automatischer bidirektionaler Synchronisierung.","index.sync_backup_title":"Automatische Sicherung","index.sync_backup_body":"Tägliche automatische Sicherungen deines gesamten Arbeitsbereichs. Stelle jede Notiz mit einem Klick wieder her.",
    "index.integrations_label":"Integrationen","index.integrations_title":"Verbunden mit dem, was du bereits nutzt","index.integrations_subtitle":"From integriert sich nativ mit den Apple- und Google-Apps, die bereits Teil deines Alltags sind.",
    "index.int_calendar_title":"Apple Kalender","index.int_calendar_body":"Deine Ereignisse erscheinen in der From-Timeline. Erstelle Ereignisse aus Notizen. Bidirektionale Synchronisierung.","index.int_reminders_title":"Apple Erinnerungen","index.int_reminders_body":"From-Aufgaben synchronisieren sich mit Apple Erinnerungen. Erledige sie von jedem Gerät aus.","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"Durchsuche und verknüpfe Drive-Dateien. Multi-Konto. Greife auf deine Ordner zu, ohne From zu verlassen.","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"Verknüpfe Notizen mit Google Docs. Bearbeite auf einer Seite und es synchronisiert sich auf der anderen.","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"Primärer Speicher. Deine Notizen synchronisieren sich automatisch über alle deine Macs.","index.int_aimodels_title":"Claude, GPT & Gemini","index.int_aimodels_body":"Wähle deinen bevorzugten KI-Anbieter. Nutze deinen eigenen API-Schlüssel oder das verwaltete KI von From mit enthaltenen Tokens.",
    "index.ai_label":"Künstliche Intelligenz","index.ai_title":"Eine KI, die deinen Kontext kennt","index.ai_subtitle":"Kein generischer Chatbot. Ein Assistent, der deine Notizen gelesen hat, deine Projekte versteht und mit deinen echten Informationen arbeitet.",
    "index.ai_chat_title":"Kontextueller Chat","index.ai_chat_body":"Stelle Fragen zu deinen Notizen, fasse Projekte zusammen, finde Informationen. Die KI ruft relevante Ausschnitte aus deinem Arbeitsbereich ab.","index.ai_editor_title":"KI-Editor","index.ai_editor_body":"Die KI bearbeitet deine Notizen direkt. Überprüfe die Änderungen, bestätige oder mache sie rückgängig. Ein echter Copilot für dein Schreiben.","index.ai_agents_title":"Autonome Agenten","index.ai_agents_body":"Erstelle Agenten in natürlicher Sprache. Sie laufen automatisch — täglich, wöchentlich, beim App-Start. Sie lesen, erstellen und aktualisieren Notizen für dich.","index.ai_privacy_title":"Echter Datenschutz","index.ai_privacy_body":"Nur der relevante Ausschnitt reist zur KI-API. Nichts wird auf Servern gespeichert. Verwende deinen eigenen API-Schlüssel für volle Kontrolle.",
    "index.privacy_label":"Datenschutz","index.privacy_title":"Radikaler Datenschutz","index.privacy_subtitle":"Kein Marketing. Die Architektur. From kann nicht auf deine Daten zugreifen, selbst wenn es wollte.",
    "index.priv_noserver_title":"Keine eigenen Server","index.priv_noserver_body":"Deine Dateien liegen auf deinem Mac und in deinem privaten iCloud. From hat kein Backend, das deine Daten speichert.","index.priv_notelemetry_title":"Null Telemetrie","index.priv_notelemetry_body":"Wir verfolgen keine Nutzung, senden keine Analytics, sammeln keine Verhaltensdaten. Null.","index.priv_nolockin_title":"Kein Lock-in","index.priv_nolockin_body":"Standard-Markdown-Dateien. Verlässt du From, funktionieren deine Notizen weiterhin in jedem Editor.",
    "index.steps_title":"In 30 Sekunden startklar","index.step1_title":"From herunterladen","index.step1_body":"Öffne die .dmg und ziehe From in den Anwendungsordner. Kein Installer, kein Pflichtkonto.","index.step2_title":"Ordner wählen","index.step2_body":"From erstellt standardmäßig einen Ordner in iCloud Drive. Oder wähle einen beliebigen vorhandenen Ordner.","index.step3_title":"Loslegen","index.step3_body":"Erstelle Notizen, organisiere Projekte, plane Aufgaben. Die KI kennt deinen Kontext von der ersten Minute an.",
    "index.pricing_teaser_title":"Einfach und fair","index.pricing_teaser_body":"Eine lebenslange Lizenz für die ewige Nutzung von From. Optionales Abonnement nur wenn du verwaltete KI ohne API-Schlüssel-Konfiguration möchtest.","index.pricing_teaser_cta":"Preise ansehen",
    "index.faq_title":"Häufig gestellte Fragen","index.faq1_q":"Brauche ich Obsidian, um From zu nutzen?","index.faq1_a":"Nein. From ist völlig unabhängig. Es verwendet Standard-Markdown-Dateien, du kannst dieselben Notizen also in Obsidian oder jedem anderen Editor öffnen — aber das ist nicht notwendig.","index.faq2_q":"Wie funktioniert die KI?","index.faq2_a":"From indiziert deine Notizen lokal. Wenn du etwas fragst, ruft es die relevanten Ausschnitte ab und sendet sie an die KI-API. Nur der notwendige Ausschnitt reist — nichts wird auf externen Servern gespeichert.","index.faq3_q":"Kann ich zwischen Geräten synchronisieren?","index.faq3_a":"Ja. Wenn du iCloud Drive verwendest (Standard), synchronisieren sich deine Notizen automatisch über alle deine Macs.","index.faq4_q":"Funktioniert es auf iPhone oder iPad?","index.faq4_a":"Derzeit ist From nur für macOS. Die native iOS-App ist in Entwicklung.","index.faq5_q":"Was passiert, wenn ich From nicht mehr nutze?","index.faq5_a":"Nichts. Deine Notizen sind .md-Dateien auf deinem Computer. Sie bleiben dort, lesbar von jedem Texteditor.","index.faq6_q":"Brauche ich einen API-Schlüssel für KI?","index.faq6_a":"Nicht unbedingt. Du kannst das verwaltete KI von From (mit Abonnement) nutzen oder deinen eigenen API-Schlüssel mitbringen. Du kannst auch dein Claude-Abonnement direkt verbinden.","index.faq7_q":"Sind meine Daten sicher?","index.faq7_a":"Deine Notizen verlassen nie deinen Mac oder dein privates iCloud. From hat keine Server, die deine Daten speichern. Keine Telemetrie, keine Analytics, kein Tracking.",
    "index.cta_title":"Dein zweites Gehirn wartet auf dich","index.cta_body":"Lade From herunter und beginne, deine Notizen, Aufgaben und Projekte zu organisieren. Ohne Konto, ohne Karte, ohne Verpflichtung.","index.cta_btn":"Für macOS herunterladen",
    "pricing.meta_title":"Preise — From","pricing.meta_desc":"From-Preise. Lebenslange Lizenz oder Abonnement mit verwalteter KI. Keine Überraschungen.","pricing.hero_badge":"Preise","pricing.hero_title":"Einfach und transparent","pricing.hero_subtitle":"Zahle einmal und nutze From für immer mit deiner eigenen KI.<br>Oder abonniere und erhalte KI inklusive ohne jede Konfiguration.",
    "pricing.perpetual_title":"Lebenslange Lizenz","pricing.perpetual_desc":"Für alle, die From für immer wollen","pricing.perpetual_period":"Einmalige Zahlung. Für immer.","pricing.perpetual_btn":"Lizenz kaufen","pricing.perpetual_f1":"Vollständige App ohne Zeitlimit","pricing.perpetual_f2":"Notizen, Aufgaben, Ansichten und Timeline","pricing.perpetual_f3":"Apple Kalender & Erinnerungen-Integration","pricing.perpetual_f4":"Google Drive & Google Docs","pricing.perpetual_f5":"Versionsverlauf & Sicherungen","pricing.perpetual_f6":"Autonome Agenten","pricing.perpetual_f7":"KI mit eigenem API-Schlüssel (Anthropic, OpenAI, Google)","pricing.perpetual_f8":"Alle Updates inklusive",
    "pricing.sub_title":"Abonnement","pricing.sub_desc":"Alles inklusive mit verwalteter KI","pricing.sub_period":"Jederzeit kündbar","pricing.sub_btn":"Abonnieren","pricing.sub_f1":"Alle App-Funktionen inklusive","pricing.sub_f2":"10 Millionen KI-Tokens/Monat inklusive","pricing.sub_f3":"Verwaltete KI: kein API-Schlüssel, keine Konfiguration","pricing.sub_f4":"Neueste KI-Modelle","pricing.sub_f5":"Agenten mit automatischer Cloud-Ausführung","pricing.sub_f6":"Prioritätssupport",
    "pricing.comparison_title":"Planvergleich","pricing.comp_feature_col":"Funktion","pricing.comp_perpetual_col":"Lebenslange Lizenz","pricing.comp_sub_col":"Abonnement","pricing.comp_row1":"Notizen, Aufgaben, Timeline","pricing.comp_row2":"Ansichten (Kanban, Kalender, Liste, Karten)","pricing.comp_row3":"Apple Kalender & Erinnerungen","pricing.comp_row4":"Google Drive & Docs","pricing.comp_row5":"Autonome Agenten","pricing.comp_row6":"Versionsverlauf","pricing.comp_row7":"KI mit eigenem API-Schlüssel","pricing.comp_row8":"Claude-Abonnement verbinden","pricing.comp_row9":"Verwaltete KI (kein API-Schlüssel)","pricing.comp_row9_sub":"✓ 2M Tokens/Monat","pricing.comp_row10":"Prioritätssupport",
    "pricing.ai_modes_title":"Drei Wege, KI zu nutzen","pricing.ai_modes_subtitle":"Du wählst, wie künstliche Intelligenz in From funktioniert.","pricing.mode_auto_title":"Automatisch (Abonnement)","pricing.mode_auto_body":"Ohne Konfiguration. From verwaltet API-Schlüssel und Modelle für dich. Einfach abonnieren und KI mit enthaltenen Tokens nutzen.","pricing.mode_manual_title":"Manuell (eigener API-Schlüssel)","pricing.mode_manual_body":"Gib deinen Anthropic-, OpenAI- oder Google-API-Schlüssel ein. Volle Kontrolle über Anbieter, Modell und Kosten. Funktioniert mit der lebenslangen Lizenz.","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"Verbinde dein Claude Pro oder Max Abonnement direkt. Nutze dein Claude-Kontingent ohne API-Schlüssel, ohne Zusatzkosten.",
    "pricing.faq_title":"Fragen zu den Preisen","pricing.faq1_q":"Kann ich From kostenlos nutzen?","pricing.faq1_a":"Ja. Du kannst From herunterladen und alle Funktionen kostenlos nutzen — Notizen, Aufgaben, Ansichten, Projekte und Agenten. KI erfordert einen Plan: lebenslange Lizenz für deinen eigenen API-Schlüssel oder Abonnement für verwaltete KI.","pricing.faq2_q":"Beinhaltet die lebenslange Lizenz Updates?","pricing.faq2_a":"Ja. Alle Updates sind inklusive. Einmal zahlen, From für immer mit allen zukünftigen Verbesserungen nutzen.","pricing.faq3_q":"Was passiert, wenn ich mein Abonnement kündige?","pricing.faq3_a":"Du nutzt From weiterhin mit allen Funktionen, ohne verwaltete KI. Für weitere KI-Nutzung kannst du die lebenslange Lizenz erwerben und deinen eigenen API-Schlüssel verbinden.","pricing.faq4_q":"Kann ich den Plan wechseln?","pricing.faq4_a":"Ja. Du kannst jederzeit von einer lebenslangen Lizenz zu einem Abonnement wechseln oder umgekehrt.","pricing.faq5_q":"Was sind Tokens?","pricing.faq5_a":"Tokens sind die Maßeinheit für KI. Jede Chat-Frage, KI-Bearbeitung oder Agent-Ausführung verbraucht Tokens. 2M Tokens pro Monat reichen für normale Nutzung. Mehr benötigt? Lade 5M für 5€ auf.",
    "pricing.cta_title":"Starte heute","pricing.cta_body":"Lade From kostenlos herunter und entscheide danach, welcher Plan zu dir passt.","pricing.cta_btn":"Für macOS herunterladen",
    "support.meta_title":"Support — From","support.meta_desc":"From-Hilfe-Center. FAQ, Anleitungen und Kontakt.","support.hero_title":"Hilfe-Center","support.hero_subtitle":"Brauchst du Hilfe mit From? Hier findest du Antworten auf die häufigsten Fragen und Kontaktmöglichkeiten.",
    "support.email_title":"E-Mail","support.email_body":"Schreib uns direkt und wir antworten so schnell wie möglich.","support.inapp_title":"Aus der App","support.inapp_body":"Gehe in From zu Einstellungen → Support, um Feedback zu senden oder Probleme zu melden.","support.faq_card_title":"FAQ","support.faq_card_body":"Schau dir die häufig gestellten Fragen unten an. Deine Frage ist wahrscheinlich schon beantwortet.","support.faq_card_btn":"FAQ ansehen",
    "support.faq_section_title":"Häufig gestellte Fragen","support.faq1_q":"Wie installiere ich From?","support.faq1_a":"Lade die .dmg-Datei von unserer Website herunter, öffne sie und ziehe From in deinen Anwendungsordner.","support.faq2_q":"Wo werden meine Notizen gespeichert?","support.faq2_a":"In einem Ordner auf deinem Mac. Standardmäßig erstellt From einen Arbeitsbereich in iCloud Drive, aber du kannst jeden Ordner wählen.","support.faq3_q":"Kann ich ein vorhandenes Obsidian-Vault verwenden?","support.faq3_a":"Ja. Du kannst From auf jeden vorhandenen Ordner mit Markdown-Dateien verweisen.","support.faq4_q":"Wie funktioniert die Synchronisierung?","support.faq4_a":"From verwendet iCloud Drive. Wenn dein Arbeitsbereich in iCloud ist (Standard), synchronisieren sich Notizen automatisch über alle deine Macs.","support.faq5_q":"Kann ich von iPhone auf meine Notizen zugreifen?","support.faq5_a":"Deine Notizen in iCloud Drive sind über die iOS-Dateien-App oder jeden Markdown-Editor für iPhone zugänglich. Eine native From-App für iOS ist in Entwicklung.","support.faq6_q":"Wie konfiguriere ich die KI?","support.faq6_a":"Gehe zu Einstellungen → KI. Wähle zwischen automatischem Modus (Abonnement), manuell (eigener API-Schlüssel) oder Claude OAuth.","support.faq7_q":"Werden meine Notizen an einen Server gesendet?","support.faq7_a":"Nein. From indiziert deine Notizen lokal. Nur der relevante Ausschnitt wird an die Anbieter-API gesendet, um deine Anfrage zu verarbeiten.","support.faq8_q":"Welche KI-Anbieter unterstützt From?","support.faq8_a":"Anthropic (Claude), OpenAI (GPT) und Google (Gemini). Du kannst den Anbieter jederzeit in Einstellungen → KI wechseln.","support.faq9_q":"Wie verbinde ich Apple Kalender?","support.faq9_a":"From bittet um Zugriff auf den Kalender, wenn du es in Einstellungen → Integrationen aktivierst.","support.faq10_q":"Wie verbinde ich Google Drive?","support.faq10_a":"Gehe zu Einstellungen → Google. Klicke auf \"Konto verbinden\" und folge dem Google-Autorisierungsprozess.","support.faq11_q":"Wie kündige ich mein Abonnement?","support.faq11_a":"Du kannst jederzeit über <a href=\"account.html\">dein Konto</a> oder direkt in der App unter Einstellungen → Konto kündigen.","support.faq12_q":"Wie lösche ich mein Konto?","support.faq12_a":"Sende eine E-Mail an <a href=\"mailto:hola@getfrom.app?subject=Anfrage%20zur%20Kontol%C3%B6schung\">hola@getfrom.app</a> mit dem Betreff \"Anfrage zur Kontolöschung\".",
    "support.cta_title":"Du findest nicht, was du suchst?","support.cta_body":"Schreib uns und wir helfen dir persönlich.",
    "account.meta_title":"Mein Konto — From","account.meta_desc":"Verwalte dein From-Konto. Abonnement, Abrechnung, Tokens und Einstellungen.","account.hero_title":"Konto verwalten","account.hero_subtitle":"Verwalte dein Abonnement, deine Abrechnung und From-Einstellungen hier oder direkt aus der App.",
    "account.sub_title":"Abonnement","account.sub_body":"Verwalte deinen Plan, wechsle zwischen monatlicher und jährlicher Abrechnung oder kündige jederzeit.","account.sub_btn":"Abonnement verwalten","account.billing_title":"Abrechnung","account.billing_body":"Sieh dir deinen Zahlungsverlauf an, lade Rechnungen herunter und aktualisiere deine Zahlungsmethode.","account.billing_btn":"Rechnungen ansehen","account.tokens_title":"KI-Tokens","account.tokens_body":"Prüfe dein Token-Guthaben in der App unter Einstellungen → KI. Kaufe bei Bedarf zusätzliche Tokens.","account.tokens_btn":"Tokens kaufen","account.license_title":"Lizenz","account.license_body":"Aktiviere deine lebenslange Lizenz in der App unter Einstellungen → Konto. Gib den per E-Mail erhaltenen Code ein.","account.license_btn":"Pläne ansehen","account.apikeys_title":"API-Schlüssel","account.apikeys_body":"Konfiguriere deine Anthropic-, OpenAI- oder Google-API-Schlüssel in der App: Einstellungen → KI → Manueller Modus.","account.apikeys_note":"API-Schlüssel werden nur auf deinem Mac gespeichert, niemals auf unseren Servern.",
    "account.delete_title":"Konto löschen","account.delete_body":"Lösche dein Konto und alle zugehörigen Daten auf unserem Server. Deine lokalen Notizen sind davon nicht betroffen.","account.delete_btn":"Löschung beantragen",
    "account.info_title":"Wichtige Informationen","account.info1_q":"Dein Konto und deine Notizen sind verschiedene Dinge","account.info1_a":"Dein From-Konto verwaltet das Abonnement, Tokens und den Zugriff auf verwaltete KI. Deine Notizen sind Markdown-Dateien auf deinem Mac. Das Löschen deines Kontos löscht <strong>nicht</strong> deine Notizen.","account.info2_q":"Verwaltung aus der App","account.info2_a":"Die meisten Kontooptionen sind direkt in From verfügbar: Einstellungen → Konto.","account.info3_q":"Zahlungen werden über LemonSqueezy verarbeitet","account.info3_a":"Zahlungen werden sicher über LemonSqueezy verarbeitet. Wir speichern keine Kartendaten.","account.info4_q":"Probleme mit deinem Konto?","account.info4_a":"Schreib uns an <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> und wir helfen dir so schnell wie möglich.",
    "privacy.meta_title":"Datenschutzrichtlinie — From","privacy.meta_desc":"Datenschutzrichtlinie von From. Wie wir deine Daten behandeln.","privacy.hero_title":"Datenschutzrichtlinie","privacy.hero_subtitle":"Bei From ist Datenschutz kein Feature. Es ist die Architektur.",
    "terms.meta_title":"Nutzungsbedingungen — From","terms.meta_desc":"Nutzungsbedingungen von From. Lizenz, Abonnement, Verantwortlichkeiten und Garantien.","terms.hero_title":"Nutzungsbedingungen","terms.hero_subtitle":"Nutzungsbedingungen der From-Anwendung und der zugehörigen Dienste."
  }

  ,zh: {
    "nav.features":"功能","nav.sync":"同步","nav.ai":"AI","nav.pricing":"定价","nav.support":"支持","nav.download":"下载",
    "footer.tagline":"你的第二大脑。在你的 Mac 上。只属于你。","footer.col_product":"产品","footer.col_support":"支持","footer.col_legal":"法律","footer.link_features":"功能","footer.link_pricing":"定价","footer.link_download":"下载","footer.link_help":"帮助中心","footer.link_contact":"联系我们","footer.link_account":"我的账户","footer.link_privacy":"隐私政策","footer.link_terms":"服务条款",
    "index.meta_title":"From — 你的笔记。你的效率。你的掌控。","index.meta_desc":"From 是一款原生 macOS 应用，在不失去控制的前提下为你的笔记添加生产力层。Markdown 文件、iCloud、上下文 AI。你的数据属于你。",
    "index.hero_badge":"原生 macOS · 本地优先 · Markdown","index.hero_title":"你的笔记属于你。<br><span>From 让它们更高效。</span>","index.hero_subtitle":"Mac 上的 Markdown 文件，通过 iCloud 同步，按你的方式整理。From 添加任务、视图、AI 和自动化，而不影响你对数据的所有权。","index.hero_cta_primary":"下载 Mac 版","index.hero_cta_secondary":"了解如何使用","index.screenshot_placeholder":"From 截图（即将推出）",
    "index.philosophy_label":"理念","index.philosophy_title":"你的笔记不应该属于某个应用","index.philosophy_subtitle":"大多数生产力应用将你的数据存储在他们的服务器上，使用专有格式。应用关闭了，你的笔记就消失了。From 的做法恰恰相反。",
    "index.card_md_title":"标准 .md 文件","index.card_md_body":"每篇笔记都是磁盘上的 Markdown 文件。可以用 VS Code、Obsidian、iA Writer 或任何文本编辑器打开。没有专有格式。","index.card_folder_title":"在你的文件夹里，不在云端","index.card_folder_body":"你的数据存放在 Mac 上的文件夹中（默认为 iCloud Drive）。From 读取该文件夹。卸载 From 后，你的笔记依然还在。","index.card_layer_title":"From 是层，不是容器","index.card_layer_body":"From 在你的文件之上添加生产力——视图、任务、AI、自动化。这是一个智能层，而不是囚禁数据的牢笼。",
    "index.features_label":"功能","index.features_title":"组织生活所需的一切","index.features_subtitle":"笔记、任务、项目、日历、可配置视图，以及了解你上下文的 AI 助手。",
    "index.feat_editor_title":"可视化 Markdown 编辑器","index.feat_editor_body":"隐藏语法、显示效果的富文本编辑器。笔记间的维基链接、附件、图片，简洁无烦恼。","index.feat_tasks_title":"集成任务管理","index.feat_tasks_body":"任务即是有日期、优先级和状态的笔记。不打断工作流地创建、完成和整理。在时间轴上拖放。","index.feat_timeline_title":"时间轴：日、周、月、年","index.feat_timeline_body":"在单一时间视图中查看任务、Apple 日历事件和提醒。拖动即可重新安排。","index.feat_hierarchy_title":"灵活的层级结构","index.feat_hierarchy_body":"区域、项目和子笔记。无需死板的文件夹——每篇笔记都知道自己归属何处。按你的思维方式整理。","index.feat_views_title":"可配置视图","index.feat_views_body":"看板、日历、列表、卡片和专注视图。按项目配置视图、筛选和组合。每个项目展示成你需要的样子。","index.feat_native_title":"100% 原生 macOS","index.feat_native_body":"Swift 和 SwiftUI。真实性能、系统集成、原生键盘快捷键。感觉就是 Mac 的一部分。","index.feat_collections_title":"跨项目集合","index.feat_collections_body":"将不同项目的笔记归入集合。无需移动文件即可创建跨项目视图。","index.feat_canvas_title":"可视化画布","index.feat_canvas_body":"用于图表、思维导图和头脑风暴的无限画板。无限制地以可视方式连接想法。","index.feat_history_title":"版本历史","index.feat_history_body":"每次更改都自动保存。点击一下即可回到任意之前的版本。",
    "index.sync_label":"同步","index.sync_title":"你的笔记，在所有设备上","index.sync_subtitle":"From 使用 iCloud Drive 在所有 Apple 设备间自动同步。无需配置，无需额外账户。","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"其他 Mac",
    "index.sync_icloud_title":"原生 iCloud Drive","index.sync_icloud_body":"你的 From 工作区是 iCloud Drive 中的一个文件夹。无需任何操作，即可在所有 Mac 间自动同步。","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"连接多个 Google 账户。将笔记与 Google Docs 链接，实现自动双向同步。用你的 Google Docs 作为 AI 上下文。","index.sync_backup_title":"自动备份","index.sync_backup_body":"每日自动备份整个工作区。一键将任意笔记恢复到之前的版本。",
    "index.integrations_label":"集成","index.integrations_title":"与你已有的工具连接","index.integrations_subtitle":"From 与你日常使用的 Apple 和 Google 应用原生集成。",
    "index.int_calendar_title":"Apple 日历","index.int_calendar_body":"你的事件出现在 From 时间轴上。从笔记创建事件。双向同步。","index.int_reminders_title":"Apple 提醒事项","index.int_reminders_body":"From 任务与 Apple 提醒事项同步。从任何设备完成。","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"浏览、搜索和链接 Drive 文件。支持多账户。不离开 From 即可访问文件夹。","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"将笔记链接到 Google Docs。在一侧编辑，另一侧自动同步。","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"主存储。你的笔记在所有 Mac 间自动同步。","index.int_aimodels_title":"Claude、GPT & Gemini","index.int_aimodels_body":"选择你喜欢的 AI 提供商。使用自己的 API 密钥或 From 的托管 AI（含 token）。",
    "index.ai_label":"人工智能","index.ai_title":"了解你上下文的 AI","index.ai_subtitle":"不是通用聊天机器人。是一个读过你的笔记、理解你的项目、基于你真实信息工作的助手。",
    "index.ai_chat_title":"上下文对话","index.ai_chat_body":"询问笔记内容、总结项目、查找信息。AI 通过语义搜索从你的工作区检索相关片段。","index.ai_editor_title":"AI 编辑器","index.ai_editor_body":"AI 直接编辑你的笔记。查看更改，确认或撤销。真正的写作副驾驶。","index.ai_agents_title":"自主代理","index.ai_agents_body":"用自然语言创建代理。自动运行——每日、每周、应用启动时。为你读取、创建和更新笔记。","index.ai_privacy_title":"真正的隐私","index.ai_privacy_body":"只有相关片段传输到 AI API。没有任何内容存储在服务器上。使用自己的 API 密钥获得完全控制。",
    "index.privacy_label":"隐私","index.privacy_title":"彻底的隐私保护","index.privacy_subtitle":"这不是营销话术，这是架构。From 即使想访问你的数据也做不到。",
    "index.priv_noserver_title":"无自有服务器","index.priv_noserver_body":"你的文件存放在你的 Mac 和私人 iCloud 上。From 没有存储你数据的后端。","index.priv_notelemetry_title":"零遥测","index.priv_notelemetry_body":"我们不追踪使用情况，不发送分析数据，不收集行为数据。绝对零。","index.priv_nolockin_title":"无锁定","index.priv_nolockin_body":"标准 Markdown 文件。离开 From 后，你的笔记在地球上任何编辑器中都能使用。",
    "index.steps_title":"30 秒内启动","index.step1_title":"下载 From","index.step1_body":"打开 .dmg 并将 From 拖入应用程序。无需安装程序，无需强制注册账户。","index.step2_title":"选择文件夹","index.step2_body":"From 默认在 iCloud Drive 中创建文件夹。或者选择你已有的任意文件夹。","index.step3_title":"开始工作","index.step3_body":"创建笔记、整理项目、安排任务。AI 从第一分钟起就了解你的上下文。",
    "index.pricing_teaser_title":"简单公平","index.pricing_teaser_body":"一次性购买，永久使用 From。可选订阅，仅在需要托管 AI 而不想配置 API 密钥时才需要。","index.pricing_teaser_cta":"查看定价",
    "index.faq_title":"常见问题","index.faq1_q":"使用 From 需要 Obsidian 吗？","index.faq1_a":"不需要。From 完全独立。它使用标准 Markdown 文件，所以你可以在 Obsidian 或任何编辑器中打开同样的笔记，但这并非必须。","index.faq2_q":"AI 如何工作？","index.faq2_a":"From 在本地为你的笔记建立索引。当你提问时，它检索相关片段并发送给 AI API。只有必要的片段传输——没有任何内容存储在外部服务器上。","index.faq3_q":"可以跨设备同步吗？","index.faq3_a":"可以。如果使用 iCloud Drive（默认选项），你的笔记会在所有 Mac 之间自动同步。","index.faq4_q":"支持 iPhone 或 iPad 吗？","index.faq4_a":"目前 From 仅支持 macOS。iOS 原生应用正在开发中。","index.faq5_q":"停止使用 From 会怎样？","index.faq5_a":"什么都不会发生。你的笔记是电脑上的 .md 文件，任何文本编辑器都能打开，没有专有格式，没有任何依赖。","index.faq6_q":"AI 需要 API 密钥吗？","index.faq6_a":"不一定。你可以使用 From 的托管 AI（订阅制）或提供自己的 API 密钥，也可以直接连接 Claude 订阅。","index.faq7_q":"我的数据安全吗？","index.faq7_a":"你的笔记永远不会离开你的 Mac 或私人 iCloud。From 没有存储你数据的服务器。没有遥测，没有分析，没有追踪。",
    "index.cta_title":"你的第二大脑在等你","index.cta_body":"下载 From，开始整理你的笔记、任务和项目。无需账户，无需信用卡，无需承诺。","index.cta_btn":"下载 macOS 版",
    "pricing.meta_title":"定价 — From","pricing.meta_desc":"From 定价。一次性授权或含托管 AI 的订阅。无隐藏费用。","pricing.hero_badge":"定价","pricing.hero_title":"简单透明","pricing.hero_subtitle":"一次付款，永远使用 From 并接入你自己的 AI。<br>或订阅，无需任何配置即享 AI 服务。",
    "pricing.perpetual_title":"永久授权","pricing.perpetual_desc":"适合想永久使用 From 的用户","pricing.perpetual_period":"一次性付款，永久有效。","pricing.perpetual_btn":"购买授权","pricing.perpetual_f1":"完整应用，无时间限制","pricing.perpetual_f2":"笔记、任务、视图和时间轴","pricing.perpetual_f3":"Apple 日历和提醒事项集成","pricing.perpetual_f4":"Google Drive & Google Docs","pricing.perpetual_f5":"版本历史和备份","pricing.perpetual_f6":"自主代理","pricing.perpetual_f7":"使用自己的 API 密钥（Anthropic、OpenAI、Google）","pricing.perpetual_f8":"包含所有未来更新",
    "pricing.sub_title":"订阅","pricing.sub_desc":"含托管 AI 的全功能套餐","pricing.sub_period":"随时取消","pricing.sub_btn":"立即订阅","pricing.sub_f1":"包含所有应用功能","pricing.sub_f2":"每月 1000 万 AI token","pricing.sub_f3":"托管 AI：无需 API 密钥，无需配置","pricing.sub_f4":"最新一代 AI 模型","pricing.sub_f5":"代理云端自动执行","pricing.sub_f6":"优先支持",
    "pricing.comparison_title":"计划对比","pricing.comp_feature_col":"功能","pricing.comp_perpetual_col":"永久授权","pricing.comp_sub_col":"订阅","pricing.comp_row1":"笔记、任务、时间轴","pricing.comp_row2":"视图（看板、日历、列表、卡片）","pricing.comp_row3":"Apple 日历和提醒事项","pricing.comp_row4":"Google Drive & Docs","pricing.comp_row5":"自主代理","pricing.comp_row6":"版本历史","pricing.comp_row7":"使用自有 API 密钥的 AI","pricing.comp_row8":"连接 Claude 订阅","pricing.comp_row9":"托管 AI（无需 API 密钥）","pricing.comp_row9_sub":"✓ 每月 1000 万 token","pricing.comp_row10":"优先支持",
    "pricing.ai_modes_title":"使用 AI 的三种方式","pricing.ai_modes_subtitle":"你选择 AI 在 From 中的工作方式。","pricing.mode_auto_title":"自动（订阅）","pricing.mode_auto_body":"无需配置。From 为你管理 API 密钥和模型。订阅后立即使用含 token 的 AI。","pricing.mode_manual_title":"手动（自有 API 密钥）","pricing.mode_manual_body":"输入你的 Anthropic、OpenAI 或 Google API 密钥。完全控制提供商、模型和费用。适用于永久授权。","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"直接连接你的 Claude Pro 或 Max 订阅。无需 API 密钥使用你的 Claude 配额，无额外费用。",
    "pricing.faq_title":"定价问题","pricing.faq1_q":"可以免费使用 From 吗？","pricing.faq1_a":"可以。你可以下载 From 并免费使用所有功能——笔记、任务、视图、项目和代理。AI 需要付费计划：永久授权用于自有 API 密钥，或订阅用于托管 AI。","pricing.faq2_q":"永久授权包含更新吗？","pricing.faq2_a":"是的。包含所有更新。一次付款，永享 From 及所有未来改进。","pricing.faq3_q":"取消订阅后会怎样？","pricing.faq3_a":"你可以继续使用 From 的所有功能，但没有托管 AI。如需继续使用 AI，可购买永久授权并连接自己的 API 密钥。","pricing.faq4_q":"可以切换计划吗？","pricing.faq4_a":"可以。你随时可以从账户中在永久授权和订阅之间切换。","pricing.faq5_q":"什么是 token？","pricing.faq5_a":"Token 是 AI 的计量单位。每次聊天提问、AI 编辑或代理运行都会消耗 token。每月 1000 万 token 足够高强度使用。",
    "pricing.cta_title":"今天开始","pricing.cta_body":"免费下载 From，之后再决定哪个计划适合你。","pricing.cta_btn":"下载 macOS 版",
    "support.meta_title":"支持 — From","support.meta_desc":"From 帮助中心。常见问题、指南和联系方式。","support.hero_title":"帮助中心","support.hero_subtitle":"需要 From 的帮助？在这里找到最常见问题的答案以及联系方式。",
    "support.email_title":"电子邮件","support.email_body":"直接给我们写信，我们会尽快回复。","support.inapp_title":"从应用内","support.inapp_body":"在 From 中，前往设置 → 支持，直接发送反馈或报告问题。","support.faq_card_title":"常见问题","support.faq_card_body":"查看下方常见问题，你的疑问很可能已有答案。","support.faq_card_btn":"查看常见问题",
    "support.faq_section_title":"常见问题","support.faq1_q":"如何安装 From？","support.faq1_a":"从我们网站下载 .dmg 文件，打开并将 From 拖入应用程序文件夹。无需安装程序或账户即可开始。","support.faq2_q":"我的笔记存储在哪里？","support.faq2_a":"存储在 Mac 上的文件夹中。默认情况下，From 在 iCloud Drive 中创建工作区，但你可以选择任何文件夹。","support.faq3_q":"可以使用现有的 Obsidian vault 吗？","support.faq3_a":"可以。你可以将 From 指向任何包含 Markdown 文件的现有文件夹。","support.faq4_q":"同步如何工作？","support.faq4_a":"From 使用 iCloud Drive。如果工作区在 iCloud（默认），笔记会在所有 Mac 间自动同步。","support.faq5_q":"可以从 iPhone 访问笔记吗？","support.faq5_a":"iCloud Drive 中的笔记可通过 iOS 文件 App 或任何 iPhone Markdown 编辑器访问。From iOS 原生应用正在开发中。","support.faq6_q":"如何设置 AI？","support.faq6_a":"前往设置 → AI。在自动模式（订阅）、手动模式（自有 API 密钥）或 Claude OAuth 之间选择。","support.faq7_q":"我的笔记会被发送到服务器吗？","support.faq7_a":"不会。From 在本地为笔记建立索引。只有相关片段发送到提供商 API 来处理你的查询。没有任何内容存储在外部服务器上。","support.faq8_q":"From 支持哪些 AI 提供商？","support.faq8_a":"Anthropic（Claude）、OpenAI（GPT）和 Google（Gemini）。可随时在设置 → AI 中切换提供商。","support.faq9_q":"如何连接 Apple 日历？","support.faq9_a":"在设置 → 集成中启用时，From 会请求日历访问权限。授权后，你的事件自动出现在时间轴上。","support.faq10_q":"如何连接 Google Drive？","support.faq10_a":"前往设置 → Google，点击\"连接账户\"并完成 Google 授权流程。可连接多个账户。","support.faq11_q":"如何取消订阅？","support.faq11_a":"你可以随时从<a href=\"account.html\">账户</a>或应用内设置 → 账户取消。","support.faq12_q":"如何删除账户？","support.faq12_a":"发送邮件至 <a href=\"mailto:hola@getfrom.app?subject=账户删除申请\">hola@getfrom.app</a>，主题为\"账户删除申请\"。",
    "support.cta_title":"没找到你要的答案？","support.cta_body":"给我们写信，我们会亲自帮助你。",
    "account.meta_title":"我的账户 — From","account.meta_desc":"管理你的 From 账户。订阅、账单、token 和设置。","account.hero_title":"管理账户","account.hero_subtitle":"在此处或直接从应用程序管理你的订阅、账单和 From 设置。",
    "account.sub_title":"订阅","account.sub_body":"管理计划，在月付和年付之间切换，或随时取消。","account.sub_btn":"管理订阅","account.billing_title":"账单","account.billing_body":"查看付款历史、下载发票并更新付款方式。","account.billing_btn":"查看发票","account.tokens_title":"AI Token","account.tokens_body":"在应用中通过设置 → AI 查看 token 余额。需要时购买额外 token。","account.tokens_btn":"购买 token","account.license_title":"授权","account.license_body":"在应用中通过设置 → 账户激活永久授权。输入邮件中收到的代码。","account.license_btn":"查看计划","account.apikeys_title":"API 密钥","account.apikeys_body":"在应用中配置 Anthropic、OpenAI 或 Google API 密钥：设置 → AI → 手动模式。","account.apikeys_note":"API 密钥仅存储在你的 Mac 上，绝不存储在我们的服务器上。",
    "account.delete_title":"删除账户","account.delete_body":"删除你的账户及服务器上的所有相关数据。本地笔记不受影响——它们仍是你 Mac 上的文件。","account.delete_btn":"申请删除",
    "account.info_title":"重要信息","account.info1_q":"你的账户和笔记是两回事","account.info1_a":"你的 From 账户管理订阅、token 和托管 AI 访问权限。你的笔记是 Mac 上的 Markdown 文件。删除账户<strong>不会</strong>删除你的笔记——这些文件仍然属于你。","account.info2_q":"从应用管理","account.info2_a":"大多数账户选项可直接在 From 中使用：设置 → 账户。","account.info3_q":"通过 LemonSqueezy 处理付款","account.info3_a":"付款通过 LemonSqueezy 安全处理。我们不存储信用卡数据。","account.info4_q":"账户问题？","account.info4_a":"发邮件至 <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a>，我们会尽快帮助你。",
    "privacy.meta_title":"隐私政策 — From","privacy.meta_desc":"From 隐私政策。我们如何处理你的数据。","privacy.hero_title":"隐私政策","privacy.hero_subtitle":"在 From，隐私不是一个功能，它是架构本身。",
    "terms.meta_title":"服务条款 — From","terms.meta_desc":"From 使用条款。授权、订阅、责任和保证。","terms.hero_title":"服务条款","terms.hero_subtitle":"From 应用及其相关服务的使用条款。"
  }

  ,ja: {
    "nav.features":"機能","nav.sync":"同期","nav.ai":"AI","nav.pricing":"料金","nav.support":"サポート","nav.download":"ダウンロード",
    "footer.tagline":"あなたのセカンドブレイン。Mac の中に。あなただけのもの。","footer.col_product":"製品","footer.col_support":"サポート","footer.col_legal":"法的情報","footer.link_features":"機能","footer.link_pricing":"料金","footer.link_download":"ダウンロード","footer.link_help":"ヘルプセンター","footer.link_contact":"お問い合わせ","footer.link_account":"マイアカウント","footer.link_privacy":"プライバシーポリシー","footer.link_terms":"利用規約",
    "index.meta_title":"From — あなたのノート。あなたの生産性。あなたのコントロール。","index.meta_desc":"From はネイティブ macOS アプリです。コントロールを失うことなく、ノートに生産性の層を追加します。Markdown ファイル、iCloud、コンテキスト AI。あなたのデータはあなたのものです。",
    "index.hero_badge":"ネイティブ macOS · ローカルファースト · Markdown","index.hero_title":"あなたのノートはあなたのもの。<br><span>From がそれを生産的にします。</span>","index.hero_subtitle":"Mac 上の Markdown ファイルを iCloud で同期し、あなた好みに整理。From はデータの所有権を侵害することなく、タスク、ビュー、AI、自動化を追加します。","index.hero_cta_primary":"Mac 版をダウンロード","index.hero_cta_secondary":"使い方を見る","index.screenshot_placeholder":"From のスクリーンショット（近日公開）",
    "index.philosophy_label":"フィロソフィー","index.philosophy_title":"あなたのノートはアプリのものであるべきではない","index.philosophy_subtitle":"ほとんどの生産性アプリはサーバーにデータを保存し、独自フォーマットを使います。アプリが終了すれば、ノートも消えます。From はその逆です。",
    "index.card_md_title":"標準 .md ファイル","index.card_md_body":"すべてのノートはディスク上の Markdown ファイルです。VS Code、Obsidian、iA Writer、または任意のテキストエディタで開けます。独自フォーマットはありません。","index.card_folder_title":"あなたのフォルダに、クラウドではなく","index.card_folder_body":"データは Mac のフォルダに保存されます（デフォルトは iCloud Drive）。From がそのフォルダを読み取ります。From をアンインストールしてもノートはそこに残ります。","index.card_layer_title":"From はレイヤー、コンテナではない","index.card_layer_body":"From はファイルの上に生産性を追加します——ビュー、タスク、AI、自動化。データの牢獄ではなく、インテリジェントな層です。",
    "index.features_label":"機能","index.features_title":"生活を整理するために必要なすべて","index.features_subtitle":"ノート、タスク、プロジェクト、カレンダー、設定可能なビュー、そしてあなたのコンテキストを知る AI アシスタント。",
    "index.feat_editor_title":"ビジュアル Markdown エディタ","index.feat_editor_body":"構文を隠して結果を表示するリッチエディタ。ノート間のウィキリンク、添付ファイル、画像、手間なしの書式設定。","index.feat_tasks_title":"統合タスク管理","index.feat_tasks_body":"タスクは日付、優先度、ステータスを持つノートです。フローを中断せずに作成、完了、整理できます。タイムラインでドラッグ＆ドロップ。","index.feat_timeline_title":"タイムライン：日・週・月・年","index.feat_timeline_body":"タスク、Apple カレンダーイベント、リマインダーを一つの時間ビューで確認。ドラッグしてスケジュール変更。","index.feat_hierarchy_title":"柔軟な階層","index.feat_hierarchy_body":"エリア、プロジェクト、子ノート。固定フォルダなし——各ノートがどこに属するかを知っています。思考に合わせて整理。","index.feat_views_title":"設定可能なビュー","index.feat_views_body":"カンバン、カレンダー、リスト、カード、フォーカス。プロジェクトごとにビューを設定し、フィルタリングと組み合わせが可能。","index.feat_native_title":"100% ネイティブ macOS","index.feat_native_body":"Swift と SwiftUI。本物のパフォーマンス、システム統合、ネイティブキーボードショートカット。Mac の一部のように感じます。","index.feat_collections_title":"クロスプロジェクトコレクション","index.feat_collections_body":"異なるプロジェクトのノートをコレクションにまとめます。ファイルを移動せずにクロスプロジェクトビューを作成。","index.feat_canvas_title":"ビジュアルキャンバス","index.feat_canvas_body":"図、マインドマップ、ブレインストーミングのための無限ボード。制限なしにアイデアを視覚的に接続。","index.feat_history_title":"バージョン履歴","index.feat_history_body":"すべての変更は自動的に保存されます。クリック一つで以前のバージョンに戻れます。",
    "index.sync_label":"同期","index.sync_title":"すべてのデバイスであなたのノート","index.sync_subtitle":"From は iCloud Drive を使ってすべての Apple デバイス間で自動同期します。設定不要、追加アカウント不要。","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"その他の Mac",
    "index.sync_icloud_title":"ネイティブ iCloud Drive","index.sync_icloud_body":"From のワークスペースは iCloud Drive のフォルダです。すべての Mac 間で自動同期されます。","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"複数の Google アカウントを接続。ノートを Google Docs にリンクして自動双方向同期。","index.sync_backup_title":"自動バックアップ","index.sync_backup_body":"ワークスペース全体の毎日自動バックアップ。クリック一つで以前のバージョンに復元。",
    "index.integrations_label":"インテグレーション","index.integrations_title":"すでに使っているものに接続","index.integrations_subtitle":"From は日常的に使っている Apple と Google のアプリとネイティブに統合されます。",
    "index.int_calendar_title":"Apple カレンダー","index.int_calendar_body":"イベントが From タイムラインに表示されます。ノートからイベントを作成。双方向同期。","index.int_reminders_title":"Apple リマインダー","index.int_reminders_body":"From タスクが Apple リマインダーと同期します。どのデバイスからでも完了可能。","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"Drive ファイルの閲覧、検索、リンク。マルチアカウント対応。From を離れずにフォルダにアクセス。","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"ノートを Google Docs にリンク。片方を編集すると自動同期。","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"メインストレージ。ノートがすべての Mac 間で自動同期されます。","index.int_aimodels_title":"Claude、GPT & Gemini","index.int_aimodels_body":"好みの AI プロバイダーを選択。独自の API キーまたは From のマネージド AI（トークン付き）を使用。",
    "index.ai_label":"人工知能","index.ai_title":"あなたのコンテキストを知る AI","index.ai_subtitle":"汎用チャットボットではありません。あなたのノートを読み、プロジェクトを理解し、実際の情報で作業するアシスタントです。",
    "index.ai_chat_title":"コンテキスト対応チャット","index.ai_chat_body":"ノートについて質問し、プロジェクトを要約し、情報を探す。AI はセマンティック検索でワークスペースから関連する断片を取得します。","index.ai_editor_title":"AI エディタ","index.ai_editor_body":"AI がノートを直接編集します。変更を確認し、確定またはアンドゥ。ライティングの真のコパイロット。","index.ai_agents_title":"自律エージェント","index.ai_agents_body":"自然言語でエージェントを作成。自動実行——毎日、毎週、アプリ起動時。ノートの読み取り、作成、更新を代行します。","index.ai_privacy_title":"真のプライバシー","index.ai_privacy_body":"関連する断片のみが AI API に送信されます。サーバーには何も保存されません。完全なコントロールのために独自の API キーを使用可能。",
    "index.privacy_label":"プライバシー","index.privacy_title":"ラジカルなプライバシー","index.privacy_subtitle":"マーケティングではありません。アーキテクチャです。From は望んでもあなたのデータにアクセスできません。",
    "index.priv_noserver_title":"独自サーバーなし","index.priv_noserver_body":"ファイルは Mac とプライベート iCloud に保存されます。From にはデータを保存するバックエンドがありません。","index.priv_notelemetry_title":"ゼロテレメトリー","index.priv_notelemetry_body":"使用状況の追跡、分析の送信、行動データの収集は一切しません。ゼロです。","index.priv_nolockin_title":"ロックインなし","index.priv_nolockin_body":"標準 Markdown ファイル。From を離れても、ノートは地球上のどんなエディタでも使えます。",
    "index.steps_title":"30秒で起動","index.step1_title":"From をダウンロード","index.step1_body":".dmg を開いて From をアプリケーションにドラッグ。インストーラー不要、アカウント登録不要。","index.step2_title":"フォルダを選択","index.step2_body":"From はデフォルトで iCloud Drive にフォルダを作成します。または既存の任意のフォルダを選択。","index.step3_title":"作業を開始","index.step3_body":"ノートを作成し、プロジェクトを整理し、タスクを計画。AI は最初の1分からコンテキストを把握しています。",
    "index.pricing_teaser_title":"シンプルで公正","index.pricing_teaser_body":"永続ライセンスで From を永久に使用。API キーの設定なしにマネージド AI が必要な場合のみオプションのサブスクリプション。","index.pricing_teaser_cta":"料金を見る",
    "index.faq_title":"よくある質問","index.faq1_q":"From を使うために Obsidian は必要ですか？","index.faq1_a":"いいえ。From は完全に独立しています。標準 Markdown ファイルを使用しているので、Obsidian などで同じノートを開くことができますが、必須ではありません。","index.faq2_q":"AI はどのように機能しますか？","index.faq2_a":"From はノートをローカルにインデックス化します。質問すると、関連する断片を取得して AI API に送信します。必要な断片のみ送信——外部サーバーには何も保存されません。","index.faq3_q":"デバイス間で同期できますか？","index.faq3_a":"はい。iCloud Drive（デフォルト）を使用すると、すべての Mac 間でノートが自動同期されます。","index.faq4_q":"iPhone や iPad で動作しますか？","index.faq4_a":"現在、From は macOS 専用です。iOS ネイティブアプリを開発中です。","index.faq5_q":"From の使用をやめたらどうなりますか？","index.faq5_a":"何も起こりません。ノートはコンピュータ上の .md ファイルで、任意のテキストエディタで読めます。","index.faq6_q":"AI に API キーは必要ですか？","index.faq6_a":"必須ではありません。From のマネージド AI（サブスクリプション）を使うか、独自の API キーを使うか、Claude サブスクリプションを直接接続することもできます。","index.faq7_q":"データは安全ですか？","index.faq7_a":"ノートは Mac またはプライベート iCloud を離れることはありません。From にはデータを保存するサーバーがありません。テレメトリー、分析、追跡は一切ありません。",
    "index.cta_title":"あなたのセカンドブレインが待っています","index.cta_body":"From をダウンロードして、ノート、タスク、プロジェクトの整理を始めましょう。アカウント不要、カード不要、コミットメント不要。","index.cta_btn":"macOS 版をダウンロード",
    "pricing.meta_title":"料金 — From","pricing.meta_desc":"From の料金。永続ライセンスまたはマネージド AI 付きサブスクリプション。隠し費用なし。","pricing.hero_badge":"料金","pricing.hero_title":"シンプルで透明","pricing.hero_subtitle":"一度支払えば、自分の AI を接続して From を永久に使用できます。<br>またはサブスクリプションで、設定不要で AI を利用できます。",
    "pricing.perpetual_title":"永続ライセンス","pricing.perpetual_desc":"From を永久に使いたい方へ","pricing.perpetual_period":"一回払い。永久に。","pricing.perpetual_btn":"ライセンスを購入","pricing.perpetual_f1":"時間制限なしの完全アプリ","pricing.perpetual_f2":"ノート、タスク、ビュー、タイムライン","pricing.perpetual_f3":"Apple カレンダー & リマインダー統合","pricing.perpetual_f4":"Google Drive & Google Docs","pricing.perpetual_f5":"バージョン履歴 & バックアップ","pricing.perpetual_f6":"自律エージェント","pricing.perpetual_f7":"独自 API キーで AI（Anthropic、OpenAI、Google）","pricing.perpetual_f8":"将来のアップデートすべて含む",
    "pricing.sub_title":"サブスクリプション","pricing.sub_desc":"マネージド AI 付きオールインクルーシブ","pricing.sub_period":"いつでもキャンセル可能","pricing.sub_btn":"登録する","pricing.sub_f1":"すべてのアプリ機能を含む","pricing.sub_f2":"月1,000万 AI トークン付き","pricing.sub_f3":"マネージド AI：API キー不要、設定不要","pricing.sub_f4":"最新世代のモデル","pricing.sub_f5":"クラウドでの自動エージェント実行","pricing.sub_f6":"優先サポート",
    "pricing.comparison_title":"プラン比較","pricing.comp_feature_col":"機能","pricing.comp_perpetual_col":"永続ライセンス","pricing.comp_sub_col":"サブスクリプション","pricing.comp_row1":"ノート、タスク、タイムライン","pricing.comp_row2":"ビュー（カンバン、カレンダー、リスト、カード）","pricing.comp_row3":"Apple カレンダー & リマインダー","pricing.comp_row4":"Google Drive & Docs","pricing.comp_row5":"自律エージェント","pricing.comp_row6":"バージョン履歴","pricing.comp_row7":"独自 API キーで AI","pricing.comp_row8":"Claude サブスクリプション接続","pricing.comp_row9":"マネージド AI（API キー不要）","pricing.comp_row9_sub":"✓ 月1,000万トークン","pricing.comp_row10":"優先サポート",
    "pricing.ai_modes_title":"AI を使う3つの方法","pricing.ai_modes_subtitle":"From での AI の動作方法をあなたが選択します。","pricing.mode_auto_title":"自動（サブスクリプション）","pricing.mode_auto_body":"設定不要。From が API キーとモデルを管理します。登録してトークン付き AI をすぐに使用。","pricing.mode_manual_title":"手動（独自 API キー）","pricing.mode_manual_body":"Anthropic、OpenAI、または Google の API キーを入力。プロバイダー、モデル、コストを完全コントロール。永続ライセンスで動作。","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"Claude Pro または Max サブスクリプションを直接接続。API キーなし、追加費用なしで Claude のクォータを使用。",
    "pricing.faq_title":"料金についての質問","pricing.faq1_q":"無料で From を使えますか？","pricing.faq1_a":"はい。From をダウンロードしてすべての機能を無料で使えます——ノート、タスク、ビュー、プロジェクト、エージェント。AI にはプランが必要です：独自 API キー用の永続ライセンス、またはマネージド AI 用のサブスクリプション。","pricing.faq2_q":"永続ライセンスにアップデートは含まれますか？","pricing.faq2_a":"はい。すべてのアップデートが含まれます。一度支払えば、将来のすべての改善を含む From を永久に使用できます。","pricing.faq3_q":"サブスクリプションをキャンセルするとどうなりますか？","pricing.faq3_a":"マネージド AI なしですべての機能で From を引き続き使用できます。AI を引き続き使用するには、永続ライセンスを取得して独自の API キーを接続できます。","pricing.faq4_q":"プランを変更できますか？","pricing.faq4_a":"はい。アカウントからいつでも永続ライセンスとサブスクリプションを切り替えられます。","pricing.faq5_q":"トークンとは何ですか？","pricing.faq5_a":"トークンは AI の計量単位です。チャットの質問、AI 編集、エージェントの実行ごとにトークンを消費します。月1,000万トークンは集中的な使用に十分です。",
    "pricing.cta_title":"今日から始めましょう","pricing.cta_body":"From を無料でダウンロードして、後でどのプランが合うか決めてください。","pricing.cta_btn":"macOS 版をダウンロード",
    "support.meta_title":"サポート — From","support.meta_desc":"From ヘルプセンター。よくある質問、ガイド、お問い合わせ。","support.hero_title":"ヘルプセンター","support.hero_subtitle":"From についてサポートが必要ですか？よくある質問の回答と連絡先をここで見つけましょう。",
    "support.email_title":"メール","support.email_body":"直接ご連絡いただければ、できるだけ早くお返事します。","support.inapp_title":"アプリから","support.inapp_body":"From で、設定 → サポートに移動して、フィードバックや問題を直接報告できます。","support.faq_card_title":"よくある質問","support.faq_card_body":"下のよくある質問をご確認ください。あなたの疑問はすでに回答されているかもしれません。","support.faq_card_btn":"FAQ を見る",
    "support.faq_section_title":"よくある質問","support.faq1_q":"From のインストール方法は？","support.faq1_a":"ウェブサイトから .dmg ファイルをダウンロードし、開いて From をアプリケーションフォルダにドラッグします。インストーラーもアカウントも不要です。","support.faq2_q":"ノートはどこに保存されますか？","support.faq2_a":"Mac のフォルダに保存されます。デフォルトでは iCloud Drive にワークスペースを作成しますが、任意のフォルダを選択できます。","support.faq3_q":"既存の Obsidian Vault を使えますか？","support.faq3_a":"はい。Markdown ファイルが入った任意のフォルダを From に指定できます。","support.faq4_q":"同期はどのように機能しますか？","support.faq4_a":"From は iCloud Drive を使用します。ワークスペースが iCloud にある場合（デフォルト）、すべての Mac 間でノートが自動同期されます。","support.faq5_q":"iPhone からノートにアクセスできますか？","support.faq5_a":"iCloud Drive のノートは iOS のファイル App または任意の Markdown エディタからアクセスできます。iOS 向けネイティブ From アプリは開発中です。","support.faq6_q":"AI の設定方法は？","support.faq6_a":"設定 → AI に移動します。自動モード（サブスクリプション）、手動（独自 API キー）、または Claude OAuth を選択します。","support.faq7_q":"ノートはサーバーに送信されますか？","support.faq7_a":"いいえ。From はノートをローカルにインデックス化します。関連する断片のみがプロバイダー API に送信されます。","support.faq8_q":"From はどの AI プロバイダーをサポートしていますか？","support.faq8_a":"Anthropic（Claude）、OpenAI（GPT）、Google（Gemini）。設定 → AI でいつでも切り替えられます。","support.faq9_q":"Apple カレンダーの接続方法は？","support.faq9_a":"設定 → 統合で有効にすると、From がカレンダーへのアクセスを要求します。","support.faq10_q":"Google Drive の接続方法は？","support.faq10_a":"設定 → Google に移動し、「アカウントを接続」をクリックして Google の認証フローに従います。","support.faq11_q":"サブスクリプションのキャンセル方法は？","support.faq11_a":"<a href=\"account.html\">アカウント</a>から、またはアプリの設定 → アカウントからいつでもキャンセルできます。","support.faq12_q":"アカウントの削除方法は？","support.faq12_a":"件名「アカウント削除リクエスト」で <a href=\"mailto:hola@getfrom.app?subject=アカウント削除リクエスト\">hola@getfrom.app</a> にメールをお送りください。",
    "support.cta_title":"お探しのものが見つかりませんか？","support.cta_body":"ご連絡いただければ、個人的にサポートします。",
    "account.meta_title":"マイアカウント — From","account.meta_desc":"From アカウントを管理します。サブスクリプション、請求、トークン、設定。","account.hero_title":"アカウントを管理","account.hero_subtitle":"サブスクリプション、請求、From の設定をここまたはアプリから直接管理します。",
    "account.sub_title":"サブスクリプション","account.sub_body":"プランの管理、月払いから年払いへの切り替え、またはいつでもキャンセル。","account.sub_btn":"サブスクリプションを管理","account.billing_title":"請求","account.billing_body":"支払い履歴の確認、請求書のダウンロード、支払い方法の更新。","account.billing_btn":"請求書を見る","account.tokens_title":"AI トークン","account.tokens_body":"アプリの設定 → AI でトークン残高を確認。必要に応じて追加トークンを購入。","account.tokens_btn":"トークンを購入","account.license_title":"ライセンス","account.license_body":"アプリの設定 → アカウントで永続ライセンスを有効化。メールで受け取ったコードを入力。","account.license_btn":"プランを見る","account.apikeys_title":"API キー","account.apikeys_body":"アプリで Anthropic、OpenAI、Google の API キーを設定：設定 → AI → 手動モード。","account.apikeys_note":"API キーは Mac のみに保存され、サーバーには保存されません。",
    "account.delete_title":"アカウントを削除","account.delete_body":"アカウントとサーバー上のすべての関連データを削除します。ローカルノートは影響を受けません。","account.delete_btn":"削除をリクエスト",
    "account.info_title":"重要な情報","account.info1_q":"アカウントとノートは別物です","account.info1_a":"From アカウントはサブスクリプション、トークン、マネージド AI へのアクセスを管理します。ノートは Mac 上の Markdown ファイルです。アカウントを削除しても、ノートは<strong>削除されません</strong>。","account.info2_q":"アプリから管理","account.info2_a":"ほとんどのアカウントオプションは From の設定 → アカウントから利用できます。","account.info3_q":"LemonSqueezy で支払い処理","account.info3_a":"支払いは LemonSqueezy を通じて安全に処理されます。カードデータは保存しません。","account.info4_q":"アカウントの問題？","account.info4_a":"<a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> までメールをお送りください。できるだけ早くサポートします。",
    "privacy.meta_title":"プライバシーポリシー — From","privacy.meta_desc":"From のプライバシーポリシー。データの取り扱い方法。","privacy.hero_title":"プライバシーポリシー","privacy.hero_subtitle":"From では、プライバシーは機能ではありません。それはアーキテクチャです。",
    "terms.meta_title":"利用規約 — From","terms.meta_desc":"From の利用規約。ライセンス、サブスクリプション、責任、保証。","terms.hero_title":"利用規約","terms.hero_subtitle":"From アプリケーションおよび関連サービスの利用規約。"
  }

  ,pt: {
    "nav.features":"Funcionalidades","nav.sync":"Sync","nav.ai":"IA","nav.pricing":"Preços","nav.support":"Suporte","nav.download":"Baixar",
    "footer.tagline":"Seu segundo cérebro. No seu Mac. Só seu.","footer.col_product":"Produto","footer.col_support":"Suporte","footer.col_legal":"Legal","footer.link_features":"Funcionalidades","footer.link_pricing":"Preços","footer.link_download":"Baixar","footer.link_help":"Central de ajuda","footer.link_contact":"Contato","footer.link_account":"Minha conta","footer.link_privacy":"Privacidade","footer.link_terms":"Termos",
    "index.meta_title":"From — Suas notas. Sua produtividade. Seu controle.","index.meta_desc":"From é um app nativo para macOS que adiciona uma camada de produtividade às suas notas sem tirar o controle. Arquivos Markdown, iCloud, IA contextual. Seus dados são seus.",
    "index.hero_badge":"macOS nativo · Local-first · Markdown","index.hero_title":"Suas notas são suas.<br><span>From as torna produtivas.</span>","index.hero_subtitle":"Arquivos Markdown no seu Mac, sincronizados pelo iCloud, organizados do seu jeito. From adiciona tarefas, visões, IA e automação sem tocar na sua propriedade dos dados.","index.hero_cta_primary":"Baixar para Mac","index.hero_cta_secondary":"Como funciona","index.screenshot_placeholder":"Captura do From (em breve)",
    "index.philosophy_label":"Filosofia","index.philosophy_title":"Suas notas não deveriam pertencer a um app","index.philosophy_subtitle":"A maioria dos apps de produtividade guarda seus dados em servidores, em formatos proprietários. Se o app fechar, suas notas somem. From funciona ao contrário.",
    "index.card_md_title":"Arquivos .md padrão","index.card_md_body":"Cada nota é um arquivo Markdown no seu disco. Abra com VS Code, Obsidian, iA Writer ou qualquer editor. Nenhum formato proprietário.","index.card_folder_title":"Na sua pasta, não na nuvem","index.card_folder_body":"Seus dados ficam em uma pasta do seu Mac (padrão: iCloud Drive). From lê essa pasta. Desinstale o From e suas notas continuam lá.","index.card_layer_title":"From é a camada, não o contêiner","index.card_layer_body":"From adiciona produtividade — visões, tarefas, IA, automação — sobre seus arquivos. É uma camada inteligente, não uma prisão para seus dados.",
    "index.features_label":"Funcionalidades","index.features_title":"Tudo que você precisa para organizar sua vida","index.features_subtitle":"Notas, tarefas, projetos, calendário, visões configuráveis e um assistente de IA que conhece seu contexto.",
    "index.feat_editor_title":"Editor Markdown visual","index.feat_editor_body":"Editor rico que esconde a sintaxe e mostra o resultado. Wikilinks entre notas, anexos, imagens e formatação sem complicação.","index.feat_tasks_title":"Tarefas integradas","index.feat_tasks_body":"Tarefas são notas com data, prioridade e status. Crie, conclua e organize sem sair do fluxo. Drag & drop na timeline.","index.feat_timeline_title":"Timeline: dia, semana, mês, ano","index.feat_timeline_body":"Veja tarefas, eventos do Apple Calendar e lembretes em uma única visão temporal. Arraste para reprogramar.","index.feat_hierarchy_title":"Hierarquia flexível","index.feat_hierarchy_body":"Áreas, projetos e notas filhas. Sem pastas rígidas: cada nota sabe de onde vem. Organize como você pensa.","index.feat_views_title":"Visões configuráveis","index.feat_views_body":"Kanban, calendário, lista, cartões e foco. Configure visões por projeto, filtre e combine.","index.feat_native_title":"macOS 100% nativo","index.feat_native_body":"Swift e SwiftUI. Desempenho real, integração com o sistema, atalhos de teclado nativos. Parece parte do seu Mac.","index.feat_collections_title":"Coleções transversais","index.feat_collections_body":"Agrupe notas de projetos diferentes em coleções. Crie visões cruzadas sem mover arquivos.","index.feat_canvas_title":"Canvas visual","index.feat_canvas_body":"Quadro infinito para diagramas, mapas mentais e brainstorming. Conecte ideias visualmente sem limites.","index.feat_history_title":"Histórico de versões","index.feat_history_body":"Cada mudança é salva automaticamente. Volte a qualquer versão anterior das suas notas com um clique.",
    "index.sync_label":"Sincronização","index.sync_title":"Suas notas em todos os seus dispositivos","index.sync_subtitle":"From usa iCloud Drive para sincronizar automaticamente entre seus dispositivos Apple. Sem configuração, sem contas extras.","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"Outros Macs",
    "index.sync_icloud_title":"iCloud Drive nativo","index.sync_icloud_body":"Seu espaço From é uma pasta no iCloud Drive. Sincroniza automaticamente entre todos os seus Macs.","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"Conecte várias contas do Google. Vincule notas ao Google Docs com sincronização bidirecional automática.","index.sync_backup_title":"Backup automático","index.sync_backup_body":"Backups diários automáticos de todo o seu espaço. Restaure qualquer nota a uma versão anterior com um clique.",
    "index.integrations_label":"Integrações","index.integrations_title":"Conectado ao que você já usa","index.integrations_subtitle":"From se integra nativamente com os apps da Apple e Google que já fazem parte do seu dia.",
    "index.int_calendar_title":"Apple Calendar","index.int_calendar_body":"Seus eventos aparecem na timeline do From. Crie eventos a partir de notas. Sincronização bidirecional.","index.int_reminders_title":"Apple Lembretes","index.int_reminders_body":"Tarefas do From sincronizam com Lembretes da Apple. Conclua de qualquer dispositivo.","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"Navegue, pesquise e vincule arquivos do Drive. Multi-conta. Acesse suas pastas sem sair do From.","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"Vincule notas ao Google Docs. Edite de um lado e sincroniza do outro.","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"Armazenamento principal. Suas notas sincronizam entre todos os seus Macs automaticamente.","index.int_aimodels_title":"Claude, GPT & Gemini","index.int_aimodels_body":"Escolha seu provedor de IA preferido. Use sua própria API key ou a IA gerenciada do From com tokens incluídos.",
    "index.ai_label":"Inteligência Artificial","index.ai_title":"Uma IA que conhece seu contexto","index.ai_subtitle":"Não é um chatbot genérico. É um assistente que leu suas notas, entende seus projetos e trabalha com suas informações reais.",
    "index.ai_chat_title":"Chat contextual","index.ai_chat_body":"Pergunte sobre suas notas, resuma projetos, encontre informações. A IA recupera fragmentos relevantes com busca semântica.","index.ai_editor_title":"Editor IA","index.ai_editor_body":"A IA edita suas notas diretamente. Revise as mudanças, confirme ou desfaça. Um copiloto de verdade para sua escrita.","index.ai_agents_title":"Agentes autônomos","index.ai_agents_body":"Crie agentes em linguagem natural. Executam automaticamente: diariamente, semanalmente, ao abrir o app.","index.ai_privacy_title":"Privacidade real","index.ai_privacy_body":"Só o fragmento relevante vai para a API de IA. Nada é armazenado em servidores. Use sua própria API key para controle total.",
    "index.privacy_label":"Privacidade","index.privacy_title":"Privacidade radical","index.privacy_subtitle":"Não é marketing. É a arquitetura. From não pode acessar seus dados mesmo que quisesse.",
    "index.priv_noserver_title":"Sem servidores próprios","index.priv_noserver_body":"Seus arquivos ficam no seu Mac e no seu iCloud privado. From não tem backend que armazena seus dados.","index.priv_notelemetry_title":"Zero telemetria","index.priv_notelemetry_body":"Não rastreamos uso, não enviamos analytics, não coletamos dados de comportamento. Zero.","index.priv_nolockin_title":"Sem lock-in","index.priv_nolockin_body":"Arquivos Markdown padrão. Se você sair do From, suas notas continuam funcionando em qualquer editor.",
    "index.steps_title":"Pronto em 30 segundos","index.step1_title":"Baixe o From","index.step1_body":"Abra o .dmg e arraste o From para Aplicativos. Sem instalador, sem conta obrigatória.","index.step2_title":"Escolha sua pasta","index.step2_body":"O From cria uma pasta no iCloud Drive por padrão. Ou escolha qualquer pasta existente.","index.step3_title":"Comece a trabalhar","index.step3_body":"Crie notas, organize projetos, programe tarefas. A IA já conhece seu contexto desde o primeiro minuto.",
    "index.pricing_teaser_title":"Simples e justo","index.pricing_teaser_body":"Licença perpétua para usar o From para sempre. Assinatura opcional só se quiser IA gerenciada sem configurar API keys.","index.pricing_teaser_cta":"Ver preços",
    "index.faq_title":"Perguntas frequentes","index.faq1_q":"Preciso do Obsidian para usar o From?","index.faq1_a":"Não. O From é completamente independente. Usa arquivos Markdown padrão.","index.faq2_q":"Como funciona a IA?","index.faq2_a":"O From indexa suas notas localmente. Quando você pergunta algo, recupera os fragmentos relevantes e os envia para a API de IA.","index.faq3_q":"Posso sincronizar entre dispositivos?","index.faq3_a":"Sim. Se usar iCloud Drive (padrão), suas notas sincronizam automaticamente entre todos os seus Macs.","index.faq4_q":"Funciona no iPhone ou iPad?","index.faq4_a":"Por enquanto, From é apenas para macOS. O app nativo para iOS está em desenvolvimento.","index.faq5_q":"O que acontece se eu parar de usar o From?","index.faq5_a":"Nada. Suas notas são arquivos .md no seu computador. Continuam lá, legíveis por qualquer editor.","index.faq6_q":"Preciso de uma API key para a IA?","index.faq6_a":"Não necessariamente. Você pode usar a IA gerenciada do From (com assinatura) ou trazer sua própria API key. Também pode conectar sua assinatura do Claude diretamente.","index.faq7_q":"Meus dados estão seguros?","index.faq7_a":"Suas notas nunca saem do seu Mac ou do seu iCloud privado. From não tem servidores que armazenam seus dados.",
    "index.cta_title":"Seu segundo cérebro está esperando","index.cta_body":"Baixe o From e comece a organizar suas notas, tarefas e projetos. Sem conta, sem cartão, sem compromisso.","index.cta_btn":"Baixar para macOS",
    "pricing.meta_title":"Preços — From","pricing.meta_desc":"Preços do From. Licença perpétua ou assinatura com IA gerenciada. Sem surpresas.","pricing.hero_badge":"Preços","pricing.hero_title":"Simples e transparente","pricing.hero_subtitle":"Pague uma vez e use o From para sempre com sua própria IA.<br>Ou assine e tenha a IA incluída sem configurar nada.",
    "pricing.perpetual_title":"Licença perpétua","pricing.perpetual_desc":"Para quem quer o From para sempre","pricing.perpetual_period":"Pagamento único. Para sempre.","pricing.perpetual_btn":"Comprar licença","pricing.perpetual_f1":"App completo sem limite de tempo","pricing.perpetual_f2":"Notas, tarefas, visões e timeline","pricing.perpetual_f3":"Integração Apple Calendar e Lembretes","pricing.perpetual_f4":"Google Drive e Google Docs","pricing.perpetual_f5":"Histórico de versões e backups","pricing.perpetual_f6":"Agentes autônomos","pricing.perpetual_f7":"IA com sua própria API key (Anthropic, OpenAI, Google)","pricing.perpetual_f8":"Atualizações incluídas",
    "pricing.sub_title":"Assinatura","pricing.sub_desc":"Tudo incluído com IA gerenciada","pricing.sub_period":"Cancele quando quiser","pricing.sub_btn":"Assinar","pricing.sub_f1":"Todas as funcionalidades do app incluídas","pricing.sub_f2":"10 milhões de tokens IA/mês incluídos","pricing.sub_f3":"IA gerenciada: sem API key, sem configuração","pricing.sub_f4":"Modelos de última geração","pricing.sub_f5":"Agentes com execução automática na nuvem","pricing.sub_f6":"Suporte prioritário",
    "pricing.comparison_title":"Comparativo de planos","pricing.comp_feature_col":"Funcionalidade","pricing.comp_perpetual_col":"Licença perpétua","pricing.comp_sub_col":"Assinatura","pricing.comp_row1":"Notas, tarefas, timeline","pricing.comp_row2":"Visões (kanban, calendário, lista, cartões)","pricing.comp_row3":"Apple Calendar e Lembretes","pricing.comp_row4":"Google Drive e Docs","pricing.comp_row5":"Agentes autônomos","pricing.comp_row6":"Histórico de versões","pricing.comp_row7":"IA com API key própria","pricing.comp_row8":"Conectar assinatura do Claude","pricing.comp_row9":"IA gerenciada (sem API key)","pricing.comp_row9_sub":"✓ 2M tokens/mês","pricing.comp_row10":"Suporte prioritário",
    "pricing.ai_modes_title":"Três formas de usar a IA","pricing.ai_modes_subtitle":"Você escolhe como a inteligência artificial funciona no From.","pricing.mode_auto_title":"Automático (Assinatura)","pricing.mode_auto_body":"Sem configurar nada. O From gerencia as API keys e modelos por você. Só assine e comece a usar a IA com tokens incluídos.","pricing.mode_manual_title":"Manual (API key própria)","pricing.mode_manual_body":"Insira sua API key da Anthropic, OpenAI ou Google. Controle total sobre o provedor, modelo e custos. Funciona com a licença perpétua.","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"Conecte sua assinatura do Claude Pro ou Max diretamente. Use sua cota do Claude sem API key, sem custo extra.",
    "pricing.faq_title":"Perguntas sobre preços","pricing.faq1_q":"Posso usar o From sem pagar?","pricing.faq1_a":"Sim. Você pode baixar o From e usar todas as funcionalidades gratuitamente — notas, tarefas, visões, projetos e agentes. A IA requer um plano: licença perpétua para sua própria API key, ou assinatura para IA gerenciada.","pricing.faq2_q":"A licença perpétua inclui atualizações?","pricing.faq2_a":"Sim. Todas as atualizações estão incluídas. Pague uma vez, use o From para sempre com todas as melhorias futuras.","pricing.faq3_q":"O que acontece se eu cancelar a assinatura?","pricing.faq3_a":"Você continua usando o From com todas as funcionalidades, sem IA gerenciada. Para continuar usando IA, pode adquirir a licença perpétua e conectar sua própria API key.","pricing.faq4_q":"Posso mudar de plano?","pricing.faq4_a":"Sim. Você pode passar da licença perpétua para assinatura ou vice-versa a qualquer momento.","pricing.faq5_q":"O que são tokens?","pricing.faq5_a":"Tokens são a unidade de medida da IA. Cada pergunta no chat, edição com IA ou execução de agente consome tokens. 2M de tokens por mês cobre uso normal. Precisa de mais? Recarregue 5M por €5.",
    "pricing.cta_title":"Comece hoje","pricing.cta_body":"Baixe o From gratuitamente e decida depois qual plano se adapta a você.","pricing.cta_btn":"Baixar para macOS",
    "support.meta_title":"Suporte — From","support.meta_desc":"Central de ajuda do From. FAQ, guias e contato.","support.hero_title":"Central de ajuda","support.hero_subtitle":"Precisa de ajuda com o From? Aqui você encontra respostas para as perguntas mais frequentes e formas de entrar em contato.",
    "support.email_title":"Email","support.email_body":"Escreva-nos diretamente e responderemos o mais rápido possível.","support.inapp_title":"Pelo app","support.inapp_body":"No From, vá em Ajustes → Suporte para enviar feedback ou reportar problemas diretamente.","support.faq_card_title":"FAQ","support.faq_card_body":"Consulte as perguntas frequentes abaixo. Sua dúvida provavelmente já está respondida.","support.faq_card_btn":"Ver FAQ",
    "support.faq_section_title":"Perguntas frequentes","support.faq1_q":"Como instalo o From?","support.faq1_a":"Baixe o arquivo .dmg do nosso site, abra-o e arraste o From para a pasta Aplicativos.","support.faq2_q":"Onde minhas notas são salvas?","support.faq2_a":"Em uma pasta do seu Mac. Por padrão, o From cria um espaço no iCloud Drive, mas você pode escolher qualquer pasta.","support.faq3_q":"Posso usar um vault do Obsidian existente?","support.faq3_a":"Sim. Você pode apontar o From para qualquer pasta existente com arquivos Markdown.","support.faq4_q":"Como funciona a sincronização?","support.faq4_a":"O From usa iCloud Drive. Se seu espaço está no iCloud (padrão), as notas sincronizam automaticamente entre todos os seus Macs.","support.faq5_q":"Posso acessar minhas notas pelo iPhone?","support.faq5_a":"Suas notas no iCloud Drive são acessíveis pelo app Arquivos do iOS ou qualquer editor Markdown para iPhone.","support.faq6_q":"Como configuro a IA?","support.faq6_a":"Vá em Ajustes → IA. Escolha entre modo automático (assinatura), manual (sua própria API key) ou Claude OAuth.","support.faq7_q":"Minhas notas são enviadas para um servidor?","support.faq7_a":"Não. O From indexa suas notas localmente. Só o fragmento relevante é enviado para a API do provedor para processar sua consulta.","support.faq8_q":"Quais provedores de IA o From suporta?","support.faq8_a":"Anthropic (Claude), OpenAI (GPT) e Google (Gemini). Você pode trocar de provedor a qualquer momento em Ajustes → IA.","support.faq9_q":"Como conecto o Apple Calendar?","support.faq9_a":"O From pede permissão de acesso ao Calendar quando você o ativa em Ajustes → Integrações.","support.faq10_q":"Como conecto o Google Drive?","support.faq10_a":"Vá em Ajustes → Google. Clique em \"Conectar conta\" e siga o processo de autorização do Google.","support.faq11_q":"Como cancelo minha assinatura?","support.faq11_a":"Você pode cancelar a qualquer momento em <a href=\"account.html\">sua conta</a> ou no app em Ajustes → Conta.","support.faq12_q":"Como excluo minha conta?","support.faq12_a":"Envie um email para <a href=\"mailto:hola@getfrom.app?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20conta\">hola@getfrom.app</a> com o assunto \"Solicitação de exclusão de conta\".",
    "support.cta_title":"Não encontrou o que procurava?","support.cta_body":"Escreva-nos e te ajudaremos pessoalmente.",
    "account.meta_title":"Minha conta — From","account.meta_desc":"Gerencie sua conta do From. Assinatura, faturamento, tokens e configurações.","account.hero_title":"Gerencie sua conta","account.hero_subtitle":"Administre sua assinatura, faturamento e configurações do From aqui ou diretamente pelo app.",
    "account.sub_title":"Assinatura","account.sub_body":"Gerencie seu plano, mude de mensal para anual, ou cancele a qualquer momento.","account.sub_btn":"Gerenciar assinatura","account.billing_title":"Faturamento","account.billing_body":"Consulte seu histórico de pagamentos, baixe faturas e atualize seu método de pagamento.","account.billing_btn":"Ver faturas","account.tokens_title":"Tokens de IA","account.tokens_body":"Consulte seu saldo de tokens no app em Ajustes → IA. Compre tokens adicionais quando precisar.","account.tokens_btn":"Comprar tokens","account.license_title":"Licença","account.license_body":"Ative sua licença perpétua no app em Ajustes → Conta. Insira o código recebido por email.","account.license_btn":"Ver planos","account.apikeys_title":"API Keys","account.apikeys_body":"Configure suas API keys da Anthropic, OpenAI ou Google no app: Ajustes → IA → Modo manual.","account.apikeys_note":"As API keys são armazenadas apenas no seu Mac, nunca nos nossos servidores.",
    "account.delete_title":"Excluir conta","account.delete_body":"Exclua sua conta e todos os dados associados no nosso servidor. Suas notas locais não são afetadas.","account.delete_btn":"Solicitar exclusão",
    "account.info_title":"Informações importantes","account.info1_q":"Sua conta e suas notas são coisas diferentes","account.info1_a":"Sua conta do From gerencia a assinatura, tokens e acesso à IA gerenciada. Suas notas são arquivos Markdown no seu Mac. Excluir sua conta <strong>não</strong> exclui suas notas.","account.info2_q":"Gerenciamento pelo app","account.info2_a":"A maioria das opções de conta está disponível diretamente no From: Ajustes → Conta.","account.info3_q":"Pagamentos processados pela LemonSqueezy","account.info3_a":"Os pagamentos são processados com segurança pela LemonSqueezy. Não armazenamos dados de cartão.","account.info4_q":"Problemas com sua conta?","account.info4_a":"Escreva-nos em <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> e te ajudaremos o mais rápido possível.",
    "privacy.meta_title":"Política de Privacidade — From","privacy.meta_desc":"Política de privacidade do From. Como tratamos seus dados.","privacy.hero_title":"Política de Privacidade","privacy.hero_subtitle":"No From, a privacidade não é uma funcionalidade. É a arquitetura.",
    "terms.meta_title":"Termos de Serviço — From","terms.meta_desc":"Termos e condições de uso do From. Licença, assinatura, responsabilidades e garantias.","terms.hero_title":"Termos de Serviço","terms.hero_subtitle":"Condições de uso da aplicação From e seus serviços associados."
  }

  ,it: {
    "nav.features":"Funzionalità","nav.sync":"Sync","nav.ai":"IA","nav.pricing":"Prezzi","nav.support":"Supporto","nav.download":"Scarica",
    "footer.tagline":"Il tuo secondo cervello. Sul tuo Mac. Solo tuo.","footer.col_product":"Prodotto","footer.col_support":"Supporto","footer.col_legal":"Legale","footer.link_features":"Funzionalità","footer.link_pricing":"Prezzi","footer.link_download":"Scarica","footer.link_help":"Centro assistenza","footer.link_contact":"Contatti","footer.link_account":"Il mio account","footer.link_privacy":"Privacy","footer.link_terms":"Termini",
    "index.meta_title":"From — Le tue note. La tua produttività. Il tuo controllo.","index.meta_desc":"From è un'app nativa per macOS che aggiunge uno strato di produttività alle tue note senza toglierti il controllo. File Markdown, iCloud, IA contestuale. I tuoi dati sono tuoi.",
    "index.hero_badge":"macOS nativo · Local-first · Markdown","index.hero_title":"Le tue note sono tue.<br><span>From le rende produttive.</span>","index.hero_subtitle":"File Markdown sul tuo Mac, sincronizzati via iCloud, organizzati come vuoi. From aggiunge attività, viste, IA e automazione senza toccare la tua proprietà dei dati.","index.hero_cta_primary":"Scarica per Mac","index.hero_cta_secondary":"Come funziona","index.screenshot_placeholder":"Screenshot di From (prossimamente)",
    "index.philosophy_label":"Filosofia","index.philosophy_title":"Le tue note non dovrebbero appartenere a un'app","index.philosophy_subtitle":"La maggior parte delle app di produttività salva i tuoi dati sui loro server, in formati proprietari. Se l'app chiude, le tue note spariscono. From funziona al contrario.",
    "index.card_md_title":"File .md standard","index.card_md_body":"Ogni nota è un file Markdown sul tuo disco. Aprilo con VS Code, Obsidian, iA Writer o qualsiasi editor. Nessun formato proprietario.","index.card_folder_title":"Nella tua cartella, non nel cloud","index.card_folder_body":"I tuoi dati vivono in una cartella del tuo Mac (di default in iCloud Drive). From legge quella cartella. Disinstalla From e le tue note restano lì.","index.card_layer_title":"From è il livello, non il contenitore","index.card_layer_body":"From aggiunge produttività — viste, attività, IA, automazione — sopra i tuoi file. È uno strato intelligente, non una prigione per i tuoi dati.",
    "index.features_label":"Funzionalità","index.features_title":"Tutto ciò di cui hai bisogno per organizzare la tua vita","index.features_subtitle":"Note, attività, progetti, calendario, viste configurabili e un assistente IA che conosce il tuo contesto.",
    "index.feat_editor_title":"Editor Markdown visuale","index.feat_editor_body":"Un editor ricco che nasconde la sintassi e mostra il risultato. Wikilink tra note, allegati, immagini e formattazione senza complicazioni.","index.feat_tasks_title":"Attività integrate","index.feat_tasks_body":"Le attività sono note con data, priorità e stato. Crea, completa e organizza senza interrompere il flusso.","index.feat_timeline_title":"Timeline: giorno, settimana, mese, anno","index.feat_timeline_body":"Visualizza attività, eventi Apple Calendar e promemoria in un'unica vista temporale. Trascina per riprogrammare.","index.feat_hierarchy_title":"Gerarchia flessibile","index.feat_hierarchy_body":"Aree, progetti e note figlie. Senza cartelle rigide: ogni nota sa da dove viene. Organizza come pensi.","index.feat_views_title":"Viste configurabili","index.feat_views_body":"Kanban, calendario, lista, schede e focus. Configura viste per progetto, filtra e combina.","index.feat_native_title":"macOS 100% nativo","index.feat_native_body":"Swift e SwiftUI. Prestazioni reali, integrazione con il sistema, scorciatoie da tastiera native.","index.feat_collections_title":"Collezioni trasversali","index.feat_collections_body":"Raggruppa note di progetti diversi in collezioni. Crea viste incrociate senza spostare file.","index.feat_canvas_title":"Canvas visuale","index.feat_canvas_body":"Una lavagna infinita per diagrammi, mappe mentali e brainstorming. Connetti idee visivamente senza limiti.","index.feat_history_title":"Cronologia versioni","index.feat_history_body":"Ogni modifica viene salvata automaticamente. Torna a qualsiasi versione precedente con un clic.",
    "index.sync_label":"Sincronizzazione","index.sync_title":"Le tue note su tutti i tuoi dispositivi","index.sync_subtitle":"From usa iCloud Drive per sincronizzare automaticamente tra i tuoi dispositivi Apple. Senza configurazione, senza account extra.","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"Altri Mac",
    "index.sync_icloud_title":"iCloud Drive nativo","index.sync_icloud_body":"Il tuo spazio From è una cartella in iCloud Drive. Si sincronizza automaticamente tra tutti i tuoi Mac.","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"Connetti più account Google. Collega note a Google Docs con sincronizzazione bidirezionale automatica.","index.sync_backup_title":"Backup automatico","index.sync_backup_body":"Backup giornalieri automatici di tutto il tuo spazio. Ripristina qualsiasi nota a una versione precedente con un clic.",
    "index.integrations_label":"Integrazioni","index.integrations_title":"Connesso a ciò che già usi","index.integrations_subtitle":"From si integra nativamente con le app Apple e Google che già fanno parte della tua giornata.",
    "index.int_calendar_title":"Apple Calendar","index.int_calendar_body":"I tuoi eventi appaiono nella timeline di From. Crea eventi dalle note. Sincronizzazione bidirezionale.","index.int_reminders_title":"Apple Promemoria","index.int_reminders_body":"Le attività From si sincronizzano con Promemoria Apple. Completale da qualsiasi dispositivo.","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"Sfoglia, cerca e collega file di Drive. Multi-account. Accedi alle tue cartelle senza uscire da From.","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"Collega note a Google Docs. Modifica da un lato e si sincronizza dall'altro.","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"Storage principale. Le tue note si sincronizzano tra tutti i tuoi Mac automaticamente.","index.int_aimodels_title":"Claude, GPT & Gemini","index.int_aimodels_body":"Scegli il tuo provider IA preferito. Usa la tua chiave API o l'IA gestita di From con token inclusi.",
    "index.ai_label":"Intelligenza Artificiale","index.ai_title":"Un'IA che conosce il tuo contesto","index.ai_subtitle":"Non è un chatbot generico. È un assistente che ha letto le tue note, capisce i tuoi progetti e lavora con le tue informazioni reali.",
    "index.ai_chat_title":"Chat contestuale","index.ai_chat_body":"Fai domande sulle tue note, riassumi progetti, trova informazioni. L'IA recupera frammenti pertinenti con ricerca semantica.","index.ai_editor_title":"Editor IA","index.ai_editor_body":"L'IA modifica le tue note direttamente. Rivedi le modifiche, confermale o annullale. Un vero copilota per la tua scrittura.","index.ai_agents_title":"Agenti autonomi","index.ai_agents_body":"Crea agenti in linguaggio naturale. Vengono eseguiti automaticamente: quotidianamente, settimanalmente, all'apertura dell'app.","index.ai_privacy_title":"Privacy reale","index.ai_privacy_body":"Solo il frammento pertinente viaggia verso l'API IA. Nulla viene archiviato sui server. Usa la tua chiave API per il controllo totale.",
    "index.privacy_label":"Privacy","index.privacy_title":"Privacy radicale","index.privacy_subtitle":"Non è marketing. È l'architettura. From non può accedere ai tuoi dati anche se lo volesse.",
    "index.priv_noserver_title":"Senza server propri","index.priv_noserver_body":"I tuoi file vivono sul tuo Mac e nel tuo iCloud privato. From non ha un backend che archivia i tuoi dati.","index.priv_notelemetry_title":"Zero telemetria","index.priv_notelemetry_body":"Non tracciamo l'utilizzo, non inviamo analytics, non raccogliamo dati comportamentali. Zero.","index.priv_nolockin_title":"Senza lock-in","index.priv_nolockin_body":"File Markdown standard. Se lasci From, le tue note continuano a funzionare in qualsiasi editor.",
    "index.steps_title":"Pronto in 30 secondi","index.step1_title":"Scarica From","index.step1_body":"Apri il .dmg e trascina From in Applicazioni. Nessun installer, nessun account obbligatorio.","index.step2_title":"Scegli la tua cartella","index.step2_body":"From crea una cartella in iCloud Drive per impostazione predefinita. O scegli qualsiasi cartella esistente.","index.step3_title":"Inizia a lavorare","index.step3_body":"Crea note, organizza progetti, pianifica attività. L'IA conosce già il tuo contesto dal primo minuto.",
    "index.pricing_teaser_title":"Semplice e giusto","index.pricing_teaser_body":"Una licenza perpetua per usare From per sempre. Abbonamento opzionale solo se vuoi IA gestita senza configurare chiavi API.","index.pricing_teaser_cta":"Vedi i prezzi",
    "index.faq_title":"Domande frequenti","index.faq1_q":"Ho bisogno di Obsidian per usare From?","index.faq1_a":"No. From è completamente indipendente. Usa file Markdown standard, quindi puoi aprire le stesse note in Obsidian o qualsiasi editor, ma non è necessario.","index.faq2_q":"Come funziona l'IA?","index.faq2_a":"From indicizza le tue note localmente. Quando fai una domanda, recupera i frammenti pertinenti e li invia all'API IA.","index.faq3_q":"Posso sincronizzare tra dispositivi?","index.faq3_a":"Sì. Se usi iCloud Drive (opzione predefinita), le tue note si sincronizzano automaticamente tra tutti i tuoi Mac.","index.faq4_q":"Funziona su iPhone o iPad?","index.faq4_a":"Per ora From è solo per macOS. L'app nativa per iOS è in sviluppo.","index.faq5_q":"Cosa succede se smetto di usare From?","index.faq5_a":"Niente. Le tue note sono file .md sul tuo computer. Restano lì, leggibili da qualsiasi editor di testo.","index.faq6_q":"Ho bisogno di una chiave API per l'IA?","index.faq6_a":"Non necessariamente. Puoi usare l'IA gestita di From (con abbonamento) o portare la tua chiave API. Puoi anche connettere il tuo abbonamento Claude direttamente.","index.faq7_q":"I miei dati sono al sicuro?","index.faq7_a":"Le tue note non lasciano mai il tuo Mac o il tuo iCloud privato. From non ha server che archiviano i tuoi dati.",
    "index.cta_title":"Il tuo secondo cervello ti sta aspettando","index.cta_body":"Scarica From e inizia a organizzare le tue note, attività e progetti. Senza account, senza carta, senza impegno.","index.cta_btn":"Scarica per macOS",
    "pricing.meta_title":"Prezzi — From","pricing.meta_desc":"Prezzi di From. Licenza perpetua o abbonamento con IA gestita. Senza sorprese.","pricing.hero_badge":"Prezzi","pricing.hero_title":"Semplice e trasparente","pricing.hero_subtitle":"Paga una volta e usa From per sempre con la tua IA.<br>O abbonati e avrai l'IA inclusa senza configurare nulla.",
    "pricing.perpetual_title":"Licenza perpetua","pricing.perpetual_desc":"Per chi vuole From per sempre","pricing.perpetual_period":"Pagamento unico. Per sempre.","pricing.perpetual_btn":"Acquista licenza","pricing.perpetual_f1":"App completa senza limiti di tempo","pricing.perpetual_f2":"Note, attività, viste e timeline","pricing.perpetual_f3":"Integrazione Apple Calendar e Promemoria","pricing.perpetual_f4":"Google Drive e Google Docs","pricing.perpetual_f5":"Cronologia versioni e backup","pricing.perpetual_f6":"Agenti autonomi","pricing.perpetual_f7":"IA con la tua chiave API (Anthropic, OpenAI, Google)","pricing.perpetual_f8":"Aggiornamenti inclusi",
    "pricing.sub_title":"Abbonamento","pricing.sub_desc":"Tutto incluso con IA gestita","pricing.sub_period":"Disdici quando vuoi","pricing.sub_btn":"Abbonati","pricing.sub_f1":"Tutte le funzionalità dell'app incluse","pricing.sub_f2":"10 milioni di token IA/mese inclusi","pricing.sub_f3":"IA gestita: senza chiave API, senza configurazione","pricing.sub_f4":"Modelli di ultima generazione","pricing.sub_f5":"Agenti con esecuzione automatica nel cloud","pricing.sub_f6":"Supporto prioritario",
    "pricing.comparison_title":"Confronto piani","pricing.comp_feature_col":"Funzionalità","pricing.comp_perpetual_col":"Licenza perpetua","pricing.comp_sub_col":"Abbonamento","pricing.comp_row1":"Note, attività, timeline","pricing.comp_row2":"Viste (kanban, calendario, lista, schede)","pricing.comp_row3":"Apple Calendar e Promemoria","pricing.comp_row4":"Google Drive e Docs","pricing.comp_row5":"Agenti autonomi","pricing.comp_row6":"Cronologia versioni","pricing.comp_row7":"IA con chiave API propria","pricing.comp_row8":"Connetti abbonamento Claude","pricing.comp_row9":"IA gestita (senza chiave API)","pricing.comp_row9_sub":"✓ 2M token/mese","pricing.comp_row10":"Supporto prioritario",
    "pricing.ai_modes_title":"Tre modi di usare l'IA","pricing.ai_modes_subtitle":"Scegli come funziona l'intelligenza artificiale in From.","pricing.mode_auto_title":"Automatico (Abbonamento)","pricing.mode_auto_body":"Senza configurare nulla. From gestisce le chiavi API e i modelli per te. Abbonati e inizia a usare l'IA con token inclusi.","pricing.mode_manual_title":"Manuale (chiave API propria)","pricing.mode_manual_body":"Inserisci la tua chiave API Anthropic, OpenAI o Google. Controllo totale su provider, modello e costi. Funziona con la licenza perpetua.","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"Connetti il tuo abbonamento Claude Pro o Max direttamente. Usa la tua quota Claude senza chiave API, senza costi extra.",
    "pricing.faq_title":"Domande sui prezzi","pricing.faq1_q":"Posso usare From senza pagare?","pricing.faq1_a":"Sì. Puoi scaricare From e usare tutte le funzionalità gratuitamente — note, attività, viste, progetti e agenti. L'IA richiede un piano: licenza perpetua per la tua chiave API, o abbonamento per IA gestita.","pricing.faq2_q":"La licenza perpetua include gli aggiornamenti?","pricing.faq2_a":"Sì. Tutti gli aggiornamenti sono inclusi. Paga una volta, usa From per sempre con tutti i miglioramenti futuri.","pricing.faq3_q":"Cosa succede se cancello l'abbonamento?","pricing.faq3_a":"Continui a usare From con tutte le funzionalità, senza IA gestita. Per continuare a usare l'IA, puoi acquistare la licenza perpetua e connettere la tua chiave API.","pricing.faq4_q":"Posso cambiare piano?","pricing.faq4_a":"Sì. Puoi passare dalla licenza perpetua all'abbonamento o viceversa in qualsiasi momento.","pricing.faq5_q":"Cosa sono i token?","pricing.faq5_a":"I token sono l'unità di misura dell'IA. Ogni domanda alla chat, modifica con IA o esecuzione di agente consuma token. 2M di token al mese coprono un uso normale.",
    "pricing.cta_title":"Inizia oggi","pricing.cta_body":"Scarica From gratuitamente e decidi dopo quale piano fa per te.","pricing.cta_btn":"Scarica per macOS",
    "support.meta_title":"Supporto — From","support.meta_desc":"Centro assistenza di From. FAQ, guide e contatti.","support.hero_title":"Centro assistenza","support.hero_subtitle":"Hai bisogno di aiuto con From? Qui trovi risposte alle domande più frequenti e come contattarci.",
    "support.email_title":"Email","support.email_body":"Scrivici direttamente e risponderemo il prima possibile.","support.inapp_title":"Dall'app","support.inapp_body":"In From, vai in Impostazioni → Supporto per inviare feedback o segnalare problemi direttamente.","support.faq_card_title":"FAQ","support.faq_card_body":"Consulta le domande frequenti qui sotto. La tua domanda è probabilmente già risposta.","support.faq_card_btn":"Vedi FAQ",
    "support.faq_section_title":"Domande frequenti","support.faq1_q":"Come installo From?","support.faq1_a":"Scarica il file .dmg dal nostro sito, aprilo e trascina From nella cartella Applicazioni.","support.faq2_q":"Dove vengono salvate le mie note?","support.faq2_a":"In una cartella del tuo Mac. Di default, From crea uno spazio in iCloud Drive, ma puoi scegliere qualsiasi cartella.","support.faq3_q":"Posso usare un vault Obsidian esistente?","support.faq3_a":"Sì. Puoi puntare From su qualsiasi cartella esistente con file Markdown.","support.faq4_q":"Come funziona la sincronizzazione?","support.faq4_a":"From usa iCloud Drive. Se il tuo spazio è in iCloud (predefinito), le note si sincronizzano automaticamente tra tutti i tuoi Mac.","support.faq5_q":"Posso accedere alle mie note da iPhone?","support.faq5_a":"Le tue note in iCloud Drive sono accessibili dall'app File iOS o qualsiasi editor Markdown per iPhone.","support.faq6_q":"Come configuro l'IA?","support.faq6_a":"Vai in Impostazioni → IA. Scegli tra modalità automatica (abbonamento), manuale (tua chiave API) o Claude OAuth.","support.faq7_q":"Le mie note vengono inviate a un server?","support.faq7_a":"No. From indicizza le note localmente. Solo il frammento pertinente viene inviato all'API del provider per elaborare la tua richiesta.","support.faq8_q":"Quali provider IA supporta From?","support.faq8_a":"Anthropic (Claude), OpenAI (GPT) e Google (Gemini). Puoi cambiare provider in qualsiasi momento in Impostazioni → IA.","support.faq9_q":"Come connetto Apple Calendar?","support.faq9_a":"From richiede l'accesso al Calendar quando lo abiliti in Impostazioni → Integrazioni.","support.faq10_q":"Come connetto Google Drive?","support.faq10_a":"Vai in Impostazioni → Google. Clicca su \"Connetti account\" e segui il processo di autorizzazione Google.","support.faq11_q":"Come cancello il mio abbonamento?","support.faq11_a":"Puoi cancellare in qualsiasi momento da <a href=\"account.html\">il tuo account</a> o nell'app in Impostazioni → Account.","support.faq12_q":"Come elimino il mio account?","support.faq12_a":"Invia un'email a <a href=\"mailto:hola@getfrom.app?subject=Richiesta%20eliminazione%20account\">hola@getfrom.app</a> con oggetto \"Richiesta eliminazione account\".",
    "support.cta_title":"Non trovi quello che cerchi?","support.cta_body":"Scrivici e ti aiuteremo personalmente.",
    "account.meta_title":"Il mio account — From","account.meta_desc":"Gestisci il tuo account From. Abbonamento, fatturazione, token e impostazioni.","account.hero_title":"Gestisci il tuo account","account.hero_subtitle":"Amministra il tuo abbonamento, la fatturazione e le impostazioni di From qui o direttamente dall'app.",
    "account.sub_title":"Abbonamento","account.sub_body":"Gestisci il tuo piano, passa da mensile ad annuale, o cancella in qualsiasi momento.","account.sub_btn":"Gestisci abbonamento","account.billing_title":"Fatturazione","account.billing_body":"Consulta il tuo storico pagamenti, scarica fatture e aggiorna il metodo di pagamento.","account.billing_btn":"Vedi fatture","account.tokens_title":"Token IA","account.tokens_body":"Controlla il tuo saldo token nell'app in Impostazioni → IA. Acquista token aggiuntivi quando necessario.","account.tokens_btn":"Acquista token","account.license_title":"Licenza","account.license_body":"Attiva la tua licenza perpetua nell'app in Impostazioni → Account. Inserisci il codice ricevuto via email.","account.license_btn":"Vedi piani","account.apikeys_title":"Chiavi API","account.apikeys_body":"Configura le tue chiavi API Anthropic, OpenAI o Google nell'app: Impostazioni → IA → Modalità manuale.","account.apikeys_note":"Le chiavi API sono archiviate solo sul tuo Mac, mai sui nostri server.",
    "account.delete_title":"Elimina account","account.delete_body":"Elimina il tuo account e tutti i dati associati sul nostro server. Le tue note locali non sono interessate.","account.delete_btn":"Richiedi eliminazione",
    "account.info_title":"Informazioni importanti","account.info1_q":"Il tuo account e le tue note sono cose diverse","account.info1_a":"Il tuo account From gestisce l'abbonamento, i token e l'accesso all'IA gestita. Le tue note sono file Markdown sul tuo Mac. Eliminare il tuo account <strong>non</strong> elimina le tue note.","account.info2_q":"Gestione dall'app","account.info2_a":"La maggior parte delle opzioni account sono disponibili direttamente in From: Impostazioni → Account.","account.info3_q":"Pagamenti elaborati da LemonSqueezy","account.info3_a":"I pagamenti vengono elaborati in modo sicuro tramite LemonSqueezy. Non archiviamo dati della carta.","account.info4_q":"Problemi con il tuo account?","account.info4_a":"Scrivici a <a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a> e ti aiuteremo il prima possibile.",
    "privacy.meta_title":"Informativa sulla Privacy — From","privacy.meta_desc":"Informativa sulla privacy di From. Come trattiamo i tuoi dati.","privacy.hero_title":"Informativa sulla Privacy","privacy.hero_subtitle":"In From, la privacy non è una funzionalità. È l'architettura.",
    "terms.meta_title":"Termini di Servizio — From","terms.meta_desc":"Termini e condizioni d'uso di From. Licenza, abbonamento, responsabilità e garanzie.","terms.hero_title":"Termini di Servizio","terms.hero_subtitle":"Condizioni d'uso dell'applicazione From e dei suoi servizi associati."
  }

  ,ko: {
    "nav.features":"기능","nav.sync":"동기화","nav.ai":"AI","nav.pricing":"요금","nav.support":"지원","nav.download":"다운로드",
    "footer.tagline":"당신의 세컨드 브레인. Mac에서. 오직 당신만의 것.","footer.col_product":"제품","footer.col_support":"지원","footer.col_legal":"법적 정보","footer.link_features":"기능","footer.link_pricing":"요금","footer.link_download":"다운로드","footer.link_help":"도움말 센터","footer.link_contact":"문의","footer.link_account":"내 계정","footer.link_privacy":"개인정보 처리방침","footer.link_terms":"이용약관",
    "index.meta_title":"From — 당신의 노트. 당신의 생산성. 당신의 통제.","index.meta_desc":"From은 통제권을 잃지 않고 노트에 생산성 레이어를 추가하는 네이티브 macOS 앱입니다. Markdown 파일, iCloud, 맥락 AI. 당신의 데이터는 당신 것입니다.",
    "index.hero_badge":"네이티브 macOS · 로컬 우선 · Markdown","index.hero_title":"당신의 노트는 당신 것입니다.<br><span>From이 그것을 생산적으로 만듭니다.</span>","index.hero_subtitle":"Mac의 Markdown 파일을 iCloud로 동기화하고, 원하는 대로 구성합니다. From은 데이터 소유권을 건드리지 않고 작업, 뷰, AI, 자동화를 추가합니다.","index.hero_cta_primary":"Mac용 다운로드","index.hero_cta_secondary":"어떻게 작동하나요","index.screenshot_placeholder":"From 스크린샷 (출시 예정)",
    "index.philosophy_label":"철학","index.philosophy_title":"당신의 노트는 앱에 속하면 안 됩니다","index.philosophy_subtitle":"대부분의 생산성 앱은 독점 형식으로 서버에 데이터를 저장합니다. 앱이 종료되면 노트도 사라집니다. From은 반대로 작동합니다.",
    "index.card_md_title":"표준 .md 파일","index.card_md_body":"모든 노트는 디스크의 Markdown 파일입니다. VS Code, Obsidian, iA Writer 또는 모든 텍스트 편집기로 열 수 있습니다. 독점 형식 없음.","index.card_folder_title":"당신의 폴더에, 클라우드가 아닌","index.card_folder_body":"데이터는 Mac의 폴더에 저장됩니다(기본값: iCloud Drive). From이 해당 폴더를 읽습니다. From을 제거해도 노트는 그대로 남아 있습니다.","index.card_layer_title":"From은 레이어, 컨테이너가 아닙니다","index.card_layer_body":"From은 파일 위에 생산성을 추가합니다 — 뷰, 작업, AI, 자동화. 데이터의 감옥이 아닌 지능형 레이어입니다.",
    "index.features_label":"기능","index.features_title":"생활을 구성하는 데 필요한 모든 것","index.features_subtitle":"노트, 작업, 프로젝트, 캘린더, 구성 가능한 뷰, 그리고 당신의 맥락을 아는 AI 어시스턴트.",
    "index.feat_editor_title":"시각적 Markdown 편집기","index.feat_editor_body":"구문을 숨기고 결과를 보여주는 풍부한 편집기. 노트 간 위키링크, 첨부파일, 이미지, 번거로움 없는 서식.","index.feat_tasks_title":"통합 작업 관리","index.feat_tasks_body":"작업은 날짜, 우선순위, 상태가 있는 노트입니다. 흐름을 방해하지 않고 생성, 완료, 구성. 타임라인에서 드래그 앤 드롭.","index.feat_timeline_title":"타임라인: 일, 주, 월, 연","index.feat_timeline_body":"하나의 시간 뷰에서 작업, Apple Calendar 이벤트, 알림을 확인. 드래그하여 일정 변경.","index.feat_hierarchy_title":"유연한 계층 구조","index.feat_hierarchy_body":"영역, 프로젝트, 하위 노트. 고정된 폴더 없음 — 각 노트는 어디에 속하는지 알고 있습니다. 생각하는 방식으로 구성.","index.feat_views_title":"구성 가능한 뷰","index.feat_views_body":"칸반, 캘린더, 목록, 카드, 포커스. 프로젝트별 뷰 구성, 필터링 및 조합.","index.feat_native_title":"100% 네이티브 macOS","index.feat_native_body":"Swift와 SwiftUI. 실제 성능, 시스템 통합, 네이티브 키보드 단축키. Mac의 일부처럼 느껴집니다.","index.feat_collections_title":"크로스 프로젝트 컬렉션","index.feat_collections_body":"다른 프로젝트의 노트를 컬렉션으로 묶습니다. 파일을 이동하지 않고 크로스 프로젝트 뷰 생성.","index.feat_canvas_title":"시각적 캔버스","index.feat_canvas_body":"다이어그램, 마인드맵, 브레인스토밍을 위한 무한 보드. 제한 없이 아이디어를 시각적으로 연결.","index.feat_history_title":"버전 기록","index.feat_history_body":"모든 변경 사항이 자동으로 저장됩니다. 클릭 한 번으로 이전 버전으로 돌아갑니다.",
    "index.sync_label":"동기화","index.sync_title":"모든 기기에서 당신의 노트","index.sync_subtitle":"From은 iCloud Drive를 사용하여 모든 Apple 기기에서 자동 동기화합니다. 설정 필요 없음, 추가 계정 불필요.","index.sync_mac":"Mac","index.sync_icloud":"iCloud Drive","index.sync_macs":"다른 Mac",
    "index.sync_icloud_title":"네이티브 iCloud Drive","index.sync_icloud_body":"From 작업 공간은 iCloud Drive의 폴더입니다. 아무 작업 없이 모든 Mac에서 자동 동기화됩니다.","index.sync_gdrive_title":"Google Drive & Docs","index.sync_gdrive_body":"여러 Google 계정 연결. 자동 양방향 동기화로 노트를 Google Docs에 연결.","index.sync_backup_title":"자동 백업","index.sync_backup_body":"전체 작업 공간의 일일 자동 백업. 클릭 한 번으로 이전 버전으로 복원.",
    "index.integrations_label":"통합","index.integrations_title":"이미 사용하는 것과 연결","index.integrations_subtitle":"From은 일상적으로 사용하는 Apple 및 Google 앱과 기본으로 통합됩니다.",
    "index.int_calendar_title":"Apple 캘린더","index.int_calendar_body":"이벤트가 From 타임라인에 표시됩니다. 노트에서 이벤트 생성. 양방향 동기화.","index.int_reminders_title":"Apple 미리 알림","index.int_reminders_body":"From 작업이 Apple 미리 알림과 동기화됩니다. 모든 기기에서 완료 가능.","index.int_gdrive_title":"Google Drive","index.int_gdrive_body":"Drive 파일 탐색, 검색, 연결. 다중 계정 지원. From을 떠나지 않고 폴더 접근.","index.int_gdocs_title":"Google Docs","index.int_gdocs_body":"노트를 Google Docs에 연결. 한쪽을 편집하면 다른 쪽과 자동 동기화.","index.int_icloud_title":"iCloud Drive","index.int_icloud_body":"기본 저장소. 노트가 모든 Mac에서 자동 동기화됩니다.","index.int_aimodels_title":"Claude, GPT & Gemini","index.int_aimodels_body":"선호하는 AI 공급자 선택. 자체 API 키 또는 토큰이 포함된 From의 관리형 AI 사용.",
    "index.ai_label":"인공지능","index.ai_title":"당신의 맥락을 아는 AI","index.ai_subtitle":"일반 챗봇이 아닙니다. 당신의 노트를 읽고, 프로젝트를 이해하고, 실제 정보로 작업하는 어시스턴트입니다.",
    "index.ai_chat_title":"맥락 대화","index.ai_chat_body":"노트에 대해 질문하고, 프로젝트를 요약하고, 정보를 찾습니다. AI가 시맨틱 검색으로 작업 공간에서 관련 내용을 검색합니다.","index.ai_editor_title":"AI 편집기","index.ai_editor_body":"AI가 노트를 직접 편집합니다. 변경 사항을 검토하고 확인하거나 취소. 글쓰기를 위한 진정한 코파일럿.","index.ai_agents_title":"자율 에이전트","index.ai_agents_body":"자연어로 에이전트를 생성합니다. 자동으로 실행 — 매일, 매주, 앱 시작 시. 노트를 읽고, 생성하고, 업데이트합니다.","index.ai_privacy_title":"진정한 개인정보 보호","index.ai_privacy_body":"관련 내용만 AI API로 전송됩니다. 서버에는 아무것도 저장되지 않습니다. 완전한 제어를 위해 자체 API 키 사용 가능.",
    "index.privacy_label":"개인정보 보호","index.privacy_title":"급진적 개인정보 보호","index.privacy_subtitle":"마케팅이 아닙니다. 아키텍처입니다. From은 원해도 당신의 데이터에 접근할 수 없습니다.",
    "index.priv_noserver_title":"자체 서버 없음","index.priv_noserver_body":"파일은 Mac과 개인 iCloud에 저장됩니다. From에는 데이터를 저장하는 백엔드가 없습니다.","index.priv_notelemetry_title":"제로 텔레메트리","index.priv_notelemetry_body":"사용량 추적, 분석 전송, 행동 데이터 수집 없음. 완전한 제로.","index.priv_nolockin_title":"잠금 없음","index.priv_nolockin_body":"표준 Markdown 파일. From을 떠나도 노트는 지구상 어떤 편집기에서도 작동합니다.",
    "index.steps_title":"30초 안에 시작","index.step1_title":"From 다운로드","index.step1_body":".dmg를 열고 From을 응용 프로그램으로 드래그. 설치 프로그램 불필요, 필수 계정 불필요.","index.step2_title":"폴더 선택","index.step2_body":"From은 기본적으로 iCloud Drive에 폴더를 생성합니다. 또는 기존 폴더를 선택하세요.","index.step3_title":"작업 시작","index.step3_body":"노트를 생성하고, 프로젝트를 구성하고, 작업을 계획하세요. AI는 첫 번째 분부터 맥락을 파악합니다.",
    "index.pricing_teaser_title":"간단하고 공정한","index.pricing_teaser_body":"영구 라이선스로 From을 영원히 사용. API 키 설정 없이 관리형 AI를 원할 때만 선택적 구독.","index.pricing_teaser_cta":"요금 보기",
    "index.faq_title":"자주 묻는 질문","index.faq1_q":"From을 사용하려면 Obsidian이 필요한가요?","index.faq1_a":"아니요. From은 완전히 독립적입니다. 표준 Markdown 파일을 사용하므로 Obsidian 등에서 같은 노트를 열 수 있지만 필수는 아닙니다.","index.faq2_q":"AI는 어떻게 작동하나요?","index.faq2_a":"From은 노트를 로컬에서 인덱싱합니다. 질문하면 관련 내용을 검색하여 AI API로 전송합니다.","index.faq3_q":"기기 간 동기화가 가능한가요?","index.faq3_a":"예. iCloud Drive(기본값)를 사용하면 모든 Mac에서 노트가 자동으로 동기화됩니다.","index.faq4_q":"iPhone이나 iPad에서 작동하나요?","index.faq4_a":"현재 From은 macOS 전용입니다. iOS 네이티브 앱은 개발 중입니다.","index.faq5_q":"From 사용을 중단하면 어떻게 되나요?","index.faq5_a":"아무 일도 없습니다. 노트는 컴퓨터의 .md 파일이며 모든 텍스트 편집기로 읽을 수 있습니다.","index.faq6_q":"AI에 API 키가 필요한가요?","index.faq6_a":"반드시 필요한 것은 아닙니다. From의 관리형 AI(구독)를 사용하거나 자체 API 키를 가져올 수 있습니다.","index.faq7_q":"데이터가 안전한가요?","index.faq7_a":"노트는 Mac이나 개인 iCloud를 벗어나지 않습니다. From에는 데이터를 저장하는 서버가 없습니다.",
    "index.cta_title":"당신의 세컨드 브레인이 기다리고 있습니다","index.cta_body":"From을 다운로드하여 노트, 작업, 프로젝트를 정리하세요. 계정 불필요, 카드 불필요, 약정 불필요.","index.cta_btn":"macOS용 다운로드",
    "pricing.meta_title":"요금 — From","pricing.meta_desc":"From 요금. 영구 라이선스 또는 관리형 AI 포함 구독. 숨겨진 비용 없음.","pricing.hero_badge":"요금","pricing.hero_title":"간단하고 투명한","pricing.hero_subtitle":"한 번 결제하고 자신의 AI를 연결하여 From을 영원히 사용하세요.<br>또는 구독하여 아무 설정 없이 AI를 이용하세요.",
    "pricing.perpetual_title":"영구 라이선스","pricing.perpetual_desc":"From을 영원히 원하는 분들을 위해","pricing.perpetual_period":"일회성 결제. 영원히.","pricing.perpetual_btn":"라이선스 구매","pricing.perpetual_f1":"시간 제한 없는 완전한 앱","pricing.perpetual_f2":"노트, 작업, 뷰, 타임라인","pricing.perpetual_f3":"Apple 캘린더 및 미리 알림 통합","pricing.perpetual_f4":"Google Drive & Google Docs","pricing.perpetual_f5":"버전 기록 및 백업","pricing.perpetual_f6":"자율 에이전트","pricing.perpetual_f7":"자체 API 키로 AI(Anthropic, OpenAI, Google)","pricing.perpetual_f8":"모든 업데이트 포함",
    "pricing.sub_title":"구독","pricing.sub_desc":"관리형 AI 포함 전체 기능","pricing.sub_period":"언제든지 취소 가능","pricing.sub_btn":"구독하기","pricing.sub_f1":"모든 앱 기능 포함","pricing.sub_f2":"월 1,000만 AI 토큰 포함","pricing.sub_f3":"관리형 AI: API 키 불필요, 설정 불필요","pricing.sub_f4":"최신 세대 모델","pricing.sub_f5":"클라우드 자동 에이전트 실행","pricing.sub_f6":"우선 지원",
    "pricing.comparison_title":"플랜 비교","pricing.comp_feature_col":"기능","pricing.comp_perpetual_col":"영구 라이선스","pricing.comp_sub_col":"구독","pricing.comp_row1":"노트, 작업, 타임라인","pricing.comp_row2":"뷰(칸반, 캘린더, 목록, 카드)","pricing.comp_row3":"Apple 캘린더 및 미리 알림","pricing.comp_row4":"Google Drive & Docs","pricing.comp_row5":"자율 에이전트","pricing.comp_row6":"버전 기록","pricing.comp_row7":"자체 API 키로 AI","pricing.comp_row8":"Claude 구독 연결","pricing.comp_row9":"관리형 AI(API 키 불필요)","pricing.comp_row9_sub":"✓ 월 1,000만 토큰","pricing.comp_row10":"우선 지원",
    "pricing.ai_modes_title":"AI를 사용하는 세 가지 방법","pricing.ai_modes_subtitle":"From에서 인공지능이 작동하는 방식을 선택하세요.","pricing.mode_auto_title":"자동(구독)","pricing.mode_auto_body":"아무것도 설정할 필요 없습니다. From이 API 키와 모델을 관리합니다. 구독하고 토큰이 포함된 AI를 바로 사용하세요.","pricing.mode_manual_title":"수동(자체 API 키)","pricing.mode_manual_body":"Anthropic, OpenAI 또는 Google API 키를 입력하세요. 공급자, 모델, 비용을 완전히 제어. 영구 라이선스와 함께 작동.","pricing.mode_oauth_title":"Claude OAuth","pricing.mode_oauth_body":"Claude Pro 또는 Max 구독을 직접 연결. API 키 없이, 추가 비용 없이 Claude 할당량 사용.",
    "pricing.faq_title":"요금 관련 질문","pricing.faq1_q":"무료로 From을 사용할 수 있나요?","pricing.faq1_a":"예. From을 다운로드하여 모든 기능을 무료로 사용할 수 있습니다 — 노트, 작업, 뷰, 프로젝트, 에이전트. AI에는 플랜이 필요합니다: 자체 API 키용 영구 라이선스 또는 관리형 AI용 구독.","pricing.faq2_q":"영구 라이선스에 업데이트가 포함되나요?","pricing.faq2_a":"예. 모든 업데이트가 포함됩니다. 한 번 결제하면 모든 미래 개선 사항과 함께 From을 영원히 사용할 수 있습니다.","pricing.faq3_q":"구독을 취소하면 어떻게 되나요?","pricing.faq3_a":"관리형 AI 없이 모든 기능으로 From을 계속 사용할 수 있습니다. AI를 계속 사용하려면 영구 라이선스를 구매하고 자체 API 키를 연결할 수 있습니다.","pricing.faq4_q":"플랜을 변경할 수 있나요?","pricing.faq4_a":"예. 언제든지 계정에서 영구 라이선스와 구독 사이를 전환할 수 있습니다.","pricing.faq5_q":"토큰이란 무엇인가요?","pricing.faq5_a":"토큰은 AI의 측정 단위입니다. 모든 채팅 질문, AI 편집, 에이전트 실행이 토큰을 소비합니다. 월 1,000만 토큰은 집중적인 사용에 충분합니다.",
    "pricing.cta_title":"오늘 시작하세요","pricing.cta_body":"From을 무료로 다운로드하고 나중에 어떤 플랜이 맞는지 결정하세요.","pricing.cta_btn":"macOS용 다운로드",
    "support.meta_title":"지원 — From","support.meta_desc":"From 도움말 센터. FAQ, 가이드, 문의.","support.hero_title":"도움말 센터","support.hero_subtitle":"From에 대한 도움이 필요하신가요? 여기서 가장 자주 묻는 질문에 대한 답변과 연락 방법을 찾으세요.",
    "support.email_title":"이메일","support.email_body":"직접 문의해 주시면 최대한 빨리 답변드리겠습니다.","support.inapp_title":"앱에서","support.inapp_body":"From에서 설정 → 지원으로 이동하여 피드백을 보내거나 문제를 직접 보고하세요.","support.faq_card_title":"FAQ","support.faq_card_body":"아래의 자주 묻는 질문을 확인하세요. 질문이 이미 답변되어 있을 것입니다.","support.faq_card_btn":"FAQ 보기",
    "support.faq_section_title":"자주 묻는 질문","support.faq1_q":"From은 어떻게 설치하나요?","support.faq1_a":"웹사이트에서 .dmg 파일을 다운로드하고, 열어서 From을 응용 프로그램 폴더로 드래그하세요.","support.faq2_q":"노트는 어디에 저장되나요?","support.faq2_a":"Mac의 폴더에 저장됩니다. 기본적으로 From은 iCloud Drive에 작업 공간을 생성하지만 어떤 폴더든 선택할 수 있습니다.","support.faq3_q":"기존 Obsidian Vault를 사용할 수 있나요?","support.faq3_a":"예. Markdown 파일이 있는 기존 폴더를 From에 지정할 수 있습니다.","support.faq4_q":"동기화는 어떻게 작동하나요?","support.faq4_a":"From은 iCloud Drive를 사용합니다. 작업 공간이 iCloud에 있으면(기본값) 모든 Mac에서 노트가 자동으로 동기화됩니다.","support.faq5_q":"iPhone에서 노트에 접근할 수 있나요?","support.faq5_a":"iCloud Drive의 노트는 iOS 파일 앱이나 iPhone용 Markdown 편집기에서 접근할 수 있습니다.","support.faq6_q":"AI는 어떻게 설정하나요?","support.faq6_a":"설정 → AI로 이동합니다. 자동 모드(구독), 수동(자체 API 키) 또는 Claude OAuth 중에서 선택하세요.","support.faq7_q":"노트가 서버로 전송되나요?","support.faq7_a":"아니요. From은 노트를 로컬에서 인덱싱합니다. 관련 내용만 공급자 API로 전송되어 쿼리를 처리합니다.","support.faq8_q":"From은 어떤 AI 공급자를 지원하나요?","support.faq8_a":"Anthropic(Claude), OpenAI(GPT), Google(Gemini). 설정 → AI에서 언제든지 공급자를 전환할 수 있습니다.","support.faq9_q":"Apple 캘린더는 어떻게 연결하나요?","support.faq9_a":"설정 → 통합에서 활성화하면 From이 캘린더 접근을 요청합니다.","support.faq10_q":"Google Drive는 어떻게 연결하나요?","support.faq10_a":"설정 → Google로 이동합니다. \"계정 연결\"을 클릭하고 Google 인증 절차를 따르세요.","support.faq11_q":"구독은 어떻게 취소하나요?","support.faq11_a":"<a href=\"account.html\">계정</a>에서 또는 앱의 설정 → 계정에서 언제든지 취소할 수 있습니다.","support.faq12_q":"계정은 어떻게 삭제하나요?","support.faq12_a":"제목 \"계정 삭제 요청\"으로 <a href=\"mailto:hola@getfrom.app?subject=계정 삭제 요청\">hola@getfrom.app</a>에 이메일을 보내주세요.",
    "support.cta_title":"찾는 것을 찾지 못하셨나요?","support.cta_body":"문의해 주시면 개인적으로 도와드리겠습니다.",
    "account.meta_title":"내 계정 — From","account.meta_desc":"From 계정을 관리합니다. 구독, 청구, 토큰, 설정.","account.hero_title":"계정 관리","account.hero_subtitle":"여기 또는 앱에서 직접 구독, 청구, From 설정을 관리하세요.",
    "account.sub_title":"구독","account.sub_body":"플랜을 관리하고, 월간에서 연간으로 전환하거나, 언제든지 취소하세요.","account.sub_btn":"구독 관리","account.billing_title":"청구","account.billing_body":"결제 내역을 확인하고, 청구서를 다운로드하고, 결제 방법을 업데이트하세요.","account.billing_btn":"청구서 보기","account.tokens_title":"AI 토큰","account.tokens_body":"앱의 설정 → AI에서 토큰 잔액을 확인하세요. 필요할 때 추가 토큰을 구매하세요.","account.tokens_btn":"토큰 구매","account.license_title":"라이선스","account.license_body":"앱의 설정 → 계정에서 영구 라이선스를 활성화하세요. 이메일로 받은 코드를 입력하세요.","account.license_btn":"플랜 보기","account.apikeys_title":"API 키","account.apikeys_body":"앱에서 Anthropic, OpenAI 또는 Google API 키를 구성하세요: 설정 → AI → 수동 모드.","account.apikeys_note":"API 키는 Mac에만 저장되며 서버에는 절대 저장되지 않습니다.",
    "account.delete_title":"계정 삭제","account.delete_body":"계정과 서버의 모든 관련 데이터를 삭제합니다. 로컬 노트는 영향을 받지 않습니다.","account.delete_btn":"삭제 요청",
    "account.info_title":"중요 정보","account.info1_q":"계정과 노트는 별개입니다","account.info1_a":"From 계정은 구독, 토큰, 관리형 AI 접근을 관리합니다. 노트는 Mac의 Markdown 파일입니다. 계정을 삭제해도 노트는 <strong>삭제되지 않습니다</strong>.","account.info2_q":"앱에서 관리","account.info2_a":"대부분의 계정 옵션은 From에서 직접 사용할 수 있습니다: 설정 → 계정.","account.info3_q":"LemonSqueezy로 결제 처리","account.info3_a":"결제는 LemonSqueezy를 통해 안전하게 처리됩니다. 카드 데이터는 저장하지 않습니다.","account.info4_q":"계정 문제가 있으신가요?","account.info4_a":"<a href=\"mailto:hola@getfrom.app\">hola@getfrom.app</a>으로 연락해 주시면 최대한 빨리 도와드리겠습니다.",
    "privacy.meta_title":"개인정보 처리방침 — From","privacy.meta_desc":"From 개인정보 처리방침. 데이터를 처리하는 방법.","privacy.hero_title":"개인정보 처리방침","privacy.hero_subtitle":"From에서 개인정보 보호는 기능이 아닙니다. 그것은 아키텍처입니다.",
    "terms.meta_title":"이용약관 — From","terms.meta_desc":"From 이용약관. 라이선스, 구독, 책임, 보증.","terms.hero_title":"이용약관","terms.hero_subtitle":"From 애플리케이션 및 관련 서비스의 이용 약관."
  }
};

/* ─── Core functions ─────────────────────────────────────── */

const LANGUAGES = ['es','en','fr','de','zh','ja','pt','it','ko'];

function detectLang() {
  const saved = localStorage.getItem('from-lang');
  if (saved && LANGUAGES.includes(saved)) return saved;
  const b = (navigator.language || navigator.userLanguage || 'es').toLowerCase();
  if (b.startsWith('en')) return 'en';
  if (b.startsWith('fr')) return 'fr';
  if (b.startsWith('de')) return 'de';
  if (b.startsWith('zh')) return 'zh';
  if (b.startsWith('ja')) return 'ja';
  if (b.startsWith('pt')) return 'pt';
  if (b.startsWith('it')) return 'it';
  if (b.startsWith('ko')) return 'ko';
  return 'es';
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
