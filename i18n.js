/* ═══════════════════════════════════════════════
   From — getfrom.app
   i18n — ES/EN auto-detection + language toggle
   ═══════════════════════════════════════════════ */

const TRANSLATIONS = {
  es: {
    /* ── Nav ── */
    "nav.features":       "Funciones",
    "nav.sync":           "Sync",
    "nav.ai":             "Agentes",
    "nav.pricing":        "Precios",
    "nav.manual":         "Manual",
    "nav.support":        "Soporte",
    "nav.download":       "Descargar",
    "nav.lang_toggle":    "EN",

    /* ── Footer ── */
    "footer.tagline":        "Tu segundo cerebro para web, Mac e iPhone.",
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
    "index.meta_title":   "Fromly — Tu segundo cerebro. Que te entiende. Web, Mac e iPhone",
    "index.meta_desc":    "Fromly entiende lo que escribes: clasifica, fecha y recuerda por ti, sin menús. Chat-first, con outliner ultrarrápido de fondo, para Web, Mac e iPhone. Sync instantáneo y backup local cada 2h. Gratis para empezar.",

    "index.privacy_label":    "Privacidad",
    "index.privacy_title":    "Tu privacidad, por diseño",
    "index.privacy_subtitle": "Fromly no vende ni comparte tus datos. Tu árbol es tuyo. El servidor existe para sincronizar, no para leer tu contenido.",

    "index.steps_title": "Empieza en 30 segundos",
    "index.step1_title": "Empieza en tu plataforma",
    "index.step1_body":  "Entra desde el navegador en fromly.app/app, instala la app en Mac o descárgala en iPhone. Sin configuración compleja, sin iCloud obligatorio.",
    "index.step2_title": "Crea tu workspace",
    "index.step2_body":  "Nombra tu primer workspace y empieza a añadir nodos. Fromly sincroniza automáticamente con todos tus dispositivos.",
    "index.step3_title": "Empieza a trabajar",
    "index.step3_body":  "Crea nodos, organiza proyectos, programa tareas. La IA ya conoce tu contexto desde el minuto uno.",

    "index.pricing_teaser_title": "Simple y justo",
    "index.pricing_teaser_body":  "Gratis para siempre hasta 1.000 nodos, sin IA. Pro desde €7/mes (o €49/año) con IA completa y nodos ilimitados. O paga una vez, €149, y ten todo Pro para siempre con Lifetime.",
    "index.pricing_teaser_cta":   "Ver precios",

    "index.faq_title": "Preguntas frecuentes",

    /* ── pricing.html ── */
    "pricing.meta_title":   "Precios — Fromly",
    "pricing.meta_desc":    "Elige el plan que mejor se adapta a ti. Fromly gratis para siempre, Pro desde €7/mes, o Lifetime por €149.",
    "pricing.hero_badge":   "Precios",
    "pricing.hero_title":   "Elige el plan que mejor se adapta a ti",
    "pricing.hero_subtitle": "Crea tu cuenta gratis. Sin tarjeta de crédito.",

    "pricing.comparison_title": "Comparativa de planes",
    "pricing.faq_title": "Preguntas frecuentes",
    "pricing.cta_title": "Crea tu cuenta gratis",
    "pricing.cta_body":  "Sin tarjeta de crédito. Sin límite de tiempo. Decide después.",

    /* ── support.html ── */
    "support.meta_title": "Soporte — Fromly",
    "support.meta_desc":  "Centro de ayuda de Fromly. Preguntas frecuentes, guías y contacto.",
    "support.hero_title":    "Centro de ayuda",
    "support.hero_subtitle": "¿Necesitas ayuda con Fromly? Aquí encontrarás respuestas a las preguntas más frecuentes y formas de contactarnos.",

    "support.email_title": "Email",
    "support.email_body":  "Escríbenos directamente y te responderemos lo antes posible.",
    "support.inapp_title": "Desde la app",
    "support.inapp_body":  "En Fromly, usa el botón de feedback (fijo en la esquina inferior de la pantalla) para enviar comentarios o reportar un fallo directamente.",
    "support.faq_card_title": "FAQ",
    "support.faq_card_body":  "Consulta las preguntas frecuentes más abajo. Probablemente tu duda ya esté resuelta.",
    "support.faq_card_btn":   "Ver FAQ",

    "support.faq_section_title": "Preguntas frecuentes",
    "support.faq1_q":   "¿Cómo instalo Fromly en Mac?",
    "support.faq1_a":   "Descarga el archivo .dmg desde nuestra web, ábrelo y arrastra Fromly a tu carpeta de Aplicaciones. A partir de la versión 9.4.4, las actualizaciones son automáticas — aparece un aviso en la barra inferior de Fromly y se instalan con un clic.",
    "support.faq1b_q":  "¿Hay app para iPhone?",
    "support.faq1b_a":  "Sí. Fromly para iPhone está disponible en el <a href=\"https://apps.apple.com/app/from-tu-segundo-cerebro/id6769823296\">App Store</a>. Sincroniza en tiempo real con tu Mac.",
    "support.faq2_q":   "¿Dónde se guardan mis notas?",
    "support.faq2_a":   "Tus notas se almacenan localmente en tu dispositivo. La sincronización entre Mac e iPhone se hace vía servidor privado de Fromly, cifrada en tránsito. Puedes exportar todo en formato Markdown estándar en cualquier momento desde Ajustes → Exportar.",
    "support.faq4_q":   "¿Cómo funciona la sincronización?",
    "support.faq4_a":   "Fromly sincroniza en tiempo real entre Mac e iPhone vía servidor privado. Abre la app en cualquier dispositivo y los cambios ya están ahí. No usa iCloud Drive. Requiere cuenta activa (gratuita).",
    "support.faq6_q":   "¿Cómo configuro la IA?",
    "support.faq6_a":   "Con la suscripción (€7/mes), la IA está lista sin configuración: incluye 2M tokens/mes. Con la licencia perpetua, ve a Ajustes → IA, pega tu API key de Anthropic, OpenAI o Google y elige el modelo.",
    "support.faq7_q":   "¿Mis notas se envían a servidores externos?",
    "support.faq7_a":   "Solo el fragmento relevante a tu consulta se envía a la API del proveedor de IA (Anthropic, OpenAI o Google) en el momento de procesarla. Nada se almacena en servidores de IA. El sync de notas va a nuestro servidor privado, cifrado.",
    "support.faq8_q":   "¿Qué proveedores de IA soporta Fromly?",
    "support.faq8_a":   "Anthropic (Claude Haiku), OpenAI (GPT) y Google (Gemini). Con la suscripción usas el modelo gestionado por Fromly. Con licencia perpetua eliges tú el proveedor y modelo.",
    "support.faq9_q":   "¿Cómo conecto Google Calendar?",
    "support.faq9_a":   "Desde Ajustes → Cuenta, en la sección Google Calendar, sigue las instrucciones para iniciar sesión con \"Continuar con Google\". Una vez conectado, tus eventos aparecen en el Planificador y puedes crear eventos directamente desde Fromly. Fromly no usa Apple Calendar ni EventKit.",
    "support.faq10_q":  "¿Cómo sincronizo con Google Docs?",
    "support.faq10_a":  "Desde la barra de acciones de cualquier nota, pulsa el botón de Google Docs. La primera vez te pedirá autorización de Google. Una vez conectado, el contenido de la nota se sincroniza con el documento automáticamente.",
    "support.manual_card_title": "Manual de usuario",
    "support.manual_card_body":  "Guía completa de todas las funciones de Fromly: notas, tareas, IA, agentes y más.",
    "support.manual_card_btn":   "Ver manual",
    "support.faq11_q": "¿Cómo cancelo mi suscripción?",
    "support.faq11_a": "Puedes cancelar en cualquier momento desde <a href=\"account.html\">tu cuenta</a> o directamente en la app en Ajustes → Cuenta. La cancelación es inmediata y no se cobra más.",
    "support.faq12_q": "¿Cómo elimino mi cuenta?",
    "support.faq12_a": "Envía un email a <a href=\"mailto:hello@fromly.app?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta\">hello@fromly.app</a> con el asunto \"Solicitud de eliminación de cuenta\". Eliminaremos todos los datos asociados en nuestro servidor. Tus notas locales no se ven afectadas.",

    "support.cta_title": "¿No encuentras lo que buscas?",
    "support.cta_body":  "Escríbenos y te ayudaremos personalmente.",

    /* ── account.html ── */
    "account.meta_title": "Mi cuenta — Fromly",
    "account.meta_desc":  "Gestiona tu cuenta de Fromly. Suscripción, facturación, tokens y configuración.",
    "account.hero_title":    "Gestiona tu cuenta",
    "account.hero_subtitle": "Administra tu suscripción, facturación y configuración de Fromly desde aquí o directamente desde la app.",

    "account.sub_title": "Suscripción",
    "account.sub_body":  "Gestiona tu plan, cambia de mensual a anual, o cancela en cualquier momento.",
    "account.sub_btn":   "Gestionar suscripción",

    "account.billing_title": "Facturación",
    "account.billing_body":  "Consulta tu historial de pagos, descarga facturas y actualiza tu método de pago.",
    "account.billing_btn":   "Ver facturas",

    "account.tokens_title": "Tokens de IA",
    "account.tokens_body":  "Consulta tu balance de tokens desde la app en Ajustes → IA. Compra tokens adicionales cuando lo necesites.",
    "account.tokens_btn":   "Comprar tokens",

    "account.license_title": "Lifetime",
    "account.license_body":  "Activa tu compra Lifetime desde la app en Ajustes → Cuenta. Introduce el código que recibiste por email.",
    "account.license_btn":   "Ver planes",

    "account.apikeys_title": "API Keys",
    "account.apikeys_body":  "Configura tus API keys de Anthropic, OpenAI o Google en la app: Ajustes → IA → Modo manual.",
    "account.apikeys_note":  "Las API keys se almacenan cifradas y nunca se comparten con terceros.",

    "account.delete_title": "Eliminar cuenta",
    "account.delete_body":  "Elimina tu cuenta y todos los datos asociados en nuestro servidor. Si usas la app de Mac, el backup local en tu equipo no se ve afectado.",
    "account.delete_btn":   "Solicitar eliminación",

    "account.info_title": "Información importante",
    "account.info1_q": "Tu cuenta y tus notas son cosas diferentes",
    "account.info1_a": "Tu cuenta de Fromly gestiona la suscripción, tokens y acceso a la IA gestionada. Tus notas viven en el servidor de Fromly, sincronizadas en tiempo real entre Web, Mac e iPhone. En Mac además tienes un backup local en Markdown cada 2 horas. Eliminar tu cuenta <strong>no</strong> elimina ese backup local — esos archivos siguen siendo tuyos, en tu disco.",
    "account.info2_q": "Gestión desde la app",
    "account.info2_a": "La mayoría de opciones de cuenta están disponibles directamente en Fromly: Ajustes → Cuenta. Desde ahí puedes ver tu plan, balance de tokens, activar Lifetime y configurar API keys.",
    "account.info3_q": "Pagos procesados por LemonSqueezy",
    "account.info3_a": "Los pagos se procesan de forma segura a través de LemonSqueezy. No almacenamos datos de tarjeta. Puedes gestionar tu método de pago desde el portal del cliente.",
    "account.info4_q": "¿Problemas con tu cuenta?",
    "account.info4_a": "Escríbenos a <a href=\"mailto:hello@fromly.app\">hello@fromly.app</a> y te ayudaremos lo antes posible.",

    /* ── privacy.html ── */
    "privacy.meta_title":   "Política de Privacidad — Fromly",
    "privacy.meta_desc":    "Política de privacidad de Fromly. Cómo recopilamos, usamos y protegemos tus datos.",
    "privacy.hero_title":   "Política de Privacidad",
    "privacy.hero_subtitle": "Transparencia total sobre cómo Fromly gestiona tus datos.",

    /* ── terms.html ── */
    "terms.meta_title":   "Términos de Servicio — Fromly",
    "terms.meta_desc":    "Términos y condiciones de uso de Fromly. Licencia, suscripción, datos y responsabilidades.",
    "terms.hero_title":   "Términos de Servicio",
    "terms.hero_subtitle": "Condiciones de uso de Fromly y sus servicios."
  },

  en: {
    /* ── Nav ── */
    "nav.features":       "Features",
    "nav.sync":           "Sync",
    "nav.ai":             "Agents",
    "nav.pricing":        "Pricing",
    "nav.manual":         "Manual",
    "nav.support":        "Support",
    "nav.download":       "Download",
    "nav.lang_toggle":    "ES",

    /* ── Footer ── */
    "footer.tagline":        "Your second brain for web, Mac and iPhone.",
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
    "index.meta_title":   "Fromly — Your second brain. That understands you. Web, Mac and iPhone",
    "index.meta_desc":    "Fromly understands what you write: it classifies, dates and remembers for you — no menus. Chat-first, with an ultra-fast outliner underneath, for Web, Mac and iPhone. Instant sync and local backup every 2h. Free to start.",

    "index.privacy_label":    "Privacy",
    "index.privacy_title":    "Your privacy, by design",
    "index.privacy_subtitle": "Fromly does not sell or share your data. Your tree is yours. The server exists to sync, not to read your content.",

    "index.steps_title": "Get started in 30 seconds",
    "index.step1_title": "Start on your platform",
    "index.step1_body":  "Open the browser at fromly.app/app, install the app on Mac or download it on iPhone. No complex setup, no mandatory iCloud.",
    "index.step2_title": "Create your workspace",
    "index.step2_body":  "Name your first workspace and start adding nodes. Fromly syncs automatically with all your devices.",
    "index.step3_title": "Start working",
    "index.step3_body":  "Create nodes, organize projects, schedule tasks. AI already knows your context from minute one.",

    "index.pricing_teaser_title": "Simple and fair",
    "index.pricing_teaser_body":  "Free forever up to 1,000 nodes, no AI. Pro from €7/month (or €49/year) with full AI and unlimited nodes. Or pay once, €149, and get all of Pro forever with Lifetime.",
    "index.pricing_teaser_cta":   "View pricing",

    "index.faq_title": "Frequently asked questions",

    /* ── pricing.html ── */
    "pricing.meta_title":   "Pricing — Fromly",
    "pricing.meta_desc":    "Choose the plan that works best for you. Fromly free forever, Pro from €7/mo, or Lifetime for €149.",
    "pricing.hero_badge":   "Pricing",
    "pricing.hero_title":   "Choose the plan that works best for you",
    "pricing.hero_subtitle": "Create your free account. No credit card required.",

    "pricing.comparison_title": "Plan comparison",
    "pricing.faq_title": "Frequently asked questions",
    "pricing.cta_title": "Create your free account",
    "pricing.cta_body":  "No credit card. No time limit. Decide later.",

    /* ── support.html ── */
    "support.meta_title": "Support — Fromly",
    "support.meta_desc":  "Fromly help center. FAQ, guides, and contact.",
    "support.hero_title":    "Help center",
    "support.hero_subtitle": "Need help with Fromly? Here you'll find answers to the most common questions and ways to reach us.",

    "support.email_title": "Email",
    "support.email_body":  "Write to us directly and we'll get back to you as soon as possible.",
    "support.inapp_title": "From the app",
    "support.inapp_body":  "In Fromly, use the feedback button (fixed at the bottom of the screen) to send feedback or report a bug directly.",
    "support.faq_card_title": "FAQ",
    "support.faq_card_body":  "Check the frequently asked questions below. Your question is probably already answered.",
    "support.faq_card_btn":   "See FAQ",

    "support.faq_section_title": "Frequently asked questions",
    "support.faq1_q":   "How do I install Fromly on Mac?",
    "support.faq1_a":   "Download the .dmg from our website, open it, and drag Fromly to your Applications folder. Starting from version 9.4.4, updates are automatic — a notice appears in Fromly's bottom bar and installs with one click.",
    "support.faq1b_q":  "Is there an iPhone app?",
    "support.faq1b_a":  "Yes. Fromly for iPhone is available on the <a href=\"https://apps.apple.com/app/from-tu-segundo-cerebro/id6769823296\">App Store</a>. It syncs in real time with your Mac.",
    "support.faq2_q":   "Where are my notes stored?",
    "support.faq2_a":   "Your notes are stored locally on your device. Sync between Mac and iPhone happens via Fromly's private server, encrypted in transit. You can export everything as standard Markdown at any time from Settings → Export.",
    "support.faq4_q":   "How does sync work?",
    "support.faq4_a":   "Fromly syncs in real time between Mac and iPhone via a private server. Open the app on any device and your changes are already there. No iCloud Drive. Requires a free account.",
    "support.faq6_q":   "How do I set up AI?",
    "support.faq6_a":   "With a subscription (€7/month), AI is ready with no setup: includes 2M tokens/month. With the perpetual license, go to Settings → AI, paste your Anthropic, OpenAI, or Google API key and choose the model.",
    "support.faq7_q":   "Are my notes sent to external servers?",
    "support.faq7_a":   "Only the snippet relevant to your query is sent to the AI provider's API (Anthropic, OpenAI, or Google) when processing it. Nothing is stored on AI servers. Note sync goes to our private server, encrypted.",
    "support.faq8_q":   "Which AI providers does Fromly support?",
    "support.faq8_a":   "Anthropic (Claude Haiku), OpenAI (GPT), and Google (Gemini). With a subscription you use Fromly's managed model. With a perpetual license you choose your own provider and model.",
    "support.faq9_q":   "How do I connect Google Calendar?",
    "support.manual_card_title": "User guide",
    "support.manual_card_body":  "Full guide to all Fromly features: notes, tasks, AI, agents and more.",
    "support.manual_card_btn":   "View guide",
    "support.faq9_a":  "From Settings → Account, in the Google Calendar section, follow the instructions to sign in with \"Continue with Google\". Once connected, your events appear in the Planner and you can create events directly from Fromly. Fromly doesn't use Apple Calendar or EventKit.",
    "support.faq10_q": "How do I connect Google Drive?",
    "support.faq10_a": "Go to Settings → Google. Click \"Connect account\" and follow Google's authorization flow. You can connect multiple accounts.",
    "support.faq11_q": "How do I cancel my subscription?",
    "support.faq11_a": "You can cancel at any time from <a href=\"account.html\">your account</a> or directly in the app at Settings → Account. Cancellation is immediate and no further charges are made.",
    "support.faq12_q": "How do I delete my account?",
    "support.faq12_a": "Send an email to <a href=\"mailto:hello@fromly.app?subject=Account%20deletion%20request\">hello@fromly.app</a> with the subject \"Account deletion request\". We'll remove all associated data from our server. Your local notes are not affected.",

    "support.cta_title": "Can't find what you're looking for?",
    "support.cta_body":  "Write to us and we'll help you personally.",

    /* ── account.html ── */
    "account.meta_title": "My account — Fromly",
    "account.meta_desc":  "Manage your Fromly account. Subscription, billing, tokens, and settings.",
    "account.hero_title":    "Manage your account",
    "account.hero_subtitle": "Handle your subscription, billing, and Fromly settings here or directly from the app.",

    "account.sub_title": "Subscription",
    "account.sub_body":  "Manage your plan, switch between monthly and annual, or cancel at any time.",
    "account.sub_btn":   "Manage subscription",

    "account.billing_title": "Billing",
    "account.billing_body":  "View your payment history, download invoices, and update your payment method.",
    "account.billing_btn":   "View invoices",

    "account.tokens_title": "AI tokens",
    "account.tokens_body":  "Check your token balance in the app at Settings → AI. Buy additional tokens whenever you need them.",
    "account.tokens_btn":   "Buy tokens",

    "account.license_title": "Lifetime",
    "account.license_body":  "Activate your Lifetime purchase in the app at Settings → Account. Enter the code you received by email.",
    "account.license_btn":   "See plans",

    "account.apikeys_title": "API Keys",
    "account.apikeys_body":  "Configure your Anthropic, OpenAI, or Google API keys in the app: Settings → AI → Manual mode.",
    "account.apikeys_note":  "API keys are stored encrypted and never shared with third parties.",

    "account.delete_title": "Delete account",
    "account.delete_body":  "Delete your account and all associated data on our server. If you use the Mac app, your local backup on that machine is not affected.",
    "account.delete_btn":   "Request deletion",

    "account.info_title": "Important information",
    "account.info1_q": "Your account and your notes are different things",
    "account.info1_a": "Your Fromly account manages your subscription, tokens, and access to managed AI. Your notes live on Fromly's server, synced in real time across Web, Mac, and iPhone. On Mac you also get a local Markdown backup every 2 hours. Deleting your account does <strong>not</strong> delete that local backup — those files remain yours, on your disk.",
    "account.info2_q": "Manage from the app",
    "account.info2_a": "Most account options are available directly in Fromly: Settings → Account. From there you can view your plan, token balance, activate Lifetime, and configure API keys.",
    "account.info3_q": "Payments processed by LemonSqueezy",
    "account.info3_a": "Payments are processed securely through LemonSqueezy. We don't store card data. You can manage your payment method from the customer portal.",
    "account.info4_q": "Issues with your account?",
    "account.info4_a": "Write to us at <a href=\"mailto:hello@fromly.app\">hello@fromly.app</a> and we'll help you as soon as possible.",

    /* ── privacy.html ── */
    "privacy.meta_title":   "Privacy Policy — Fromly",
    "privacy.meta_desc":    "Fromly privacy policy. How we collect, use and protect your data.",
    "privacy.hero_title":   "Privacy Policy",
    "privacy.hero_subtitle": "Full transparency on how Fromly handles your data.",

    /* ── terms.html ── */
    "terms.meta_title":   "Terms of Service — Fromly",
    "terms.meta_desc":    "Fromly terms of service. License, subscription, data and responsibilities.",
    "terms.hero_title":   "Terms of Service",
    "terms.hero_subtitle": "Terms and conditions for using Fromly and its services."
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
