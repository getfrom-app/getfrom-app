/**
 * Fromly — Interactive Demo Chat Widget
 * Self-contained, no dependencies, no frameworks.
 * Simulates the real "habla, no organices" chat experience — no fake outliner.
 * Nothing is saved; state resets on reload.
 */
(function () {
  'use strict';

  // ─── Canned NLU — keyword heuristics, not real AI ─────────────────────────

  const DAY_WORDS = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
  const REL_DAY_WORDS = ['mañana', 'manana', 'pasado mañana', 'pasado manana', 'hoy'];

  function extractDateLabel(text) {
    const lower = text.toLowerCase();
    for (const w of REL_DAY_WORDS) {
      if (lower.includes(w)) return capitalize(w.replace('manana', 'mañana'));
    }
    for (const w of DAY_WORDS) {
      if (lower.includes(w)) return capitalize(w.replace('miercoles', 'miércoles').replace('sabado', 'sábado'));
    }
    const m = lower.match(/\b(\d{1,2})\s*(?:de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
    if (m) return capitalize(m[0]);
    return null;
  }

  function extractTimeLabel(text) {
    const m = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)?\b/) || text.match(/\ba las (\d{1,2})\b/i);
    if (!m) return null;
    let h = m[1];
    let min = m[2] || '00';
    return `${h.padStart(2, '0')}:${min}`;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function stripLeadTrigger(text) {
    return text.replace(/^(recu[ée]rdame|record[aá]rme|apunta que|apunta|crea una tarea|crea un evento|crea una nota)\s*/i, '').trim();
  }

  const QUERY_HINTS = ['resume', 'busca', 'qué', 'que ', 'cómo', 'como ', 'cuál', 'cual ', '¿'];
  const EVENT_HINTS = ['reunión', 'reunion', 'cita', 'llamada con', 'demo', 'evento', 'presentación', 'presentacion'];
  const TASK_HINTS = ['recuérdame', 'recuerdame', 'record', 'tarea', 'llamar a', 'enviar', 'preparar', 'revisar'];
  const NOTE_HINTS = ['nota', 'apunta', 'documento', 'idea', 'brainstorm'];

  function classify(text) {
    const lower = text.toLowerCase();
    const dateLabel = extractDateLabel(text);
    const timeLabel = extractTimeLabel(text);

    if (QUERY_HINTS.some(w => lower.includes(w)) && !dateLabel) return { kind: 'query' };
    if (EVENT_HINTS.some(w => lower.includes(w)) && (dateLabel || timeLabel)) {
      return { kind: 'event', title: capitalize(stripLeadTrigger(text)), date: dateLabel, time: timeLabel };
    }
    if ((dateLabel || TASK_HINTS.some(w => lower.includes(w)))) {
      return { kind: 'task', title: capitalize(stripLeadTrigger(text)), date: dateLabel, time: timeLabel };
    }
    if (NOTE_HINTS.some(w => lower.includes(w))) {
      return { kind: 'note', title: capitalize(stripLeadTrigger(text)) };
    }
    // Fallback: short text with no clear signal → treat as a note
    return { kind: 'note', title: capitalize(text.length > 60 ? text.slice(0, 57) + '…' : text) };
  }

  const QUERY_ANSWERS = [
    'Según tus notas de la semana pasada, el proyecto sigue en fase de diseño — la reunión del martes quedó pendiente de aprobación del presupuesto.',
    'Tienes 3 tareas pendientes para hoy y una reunión a las 16:00. La más urgente es enviar la propuesta al cliente.',
    'Encontré 2 notas relacionadas: el brief del proyecto y los apuntes de la última llamada. El presupuesto aprobado fue de 12.000€.',
  ];

  function buildResponse(input) {
    const c = classify(input);
    if (c.kind === 'query') {
      return { text: QUERY_ANSWERS[Math.floor(Math.random() * QUERY_ANSWERS.length)], card: null };
    }
    if (c.kind === 'task') {
      const when = [c.date, c.time].filter(Boolean).join(' · ') || 'sin fecha';
      return {
        text: `Apuntado 📝 He creado la tarea y la he colocado en tu contexto de Trabajo.`,
        card: { kind: 'task', title: c.title || 'Nueva tarea', meta: when },
      };
    }
    if (c.kind === 'event') {
      const when = [c.date, c.time].filter(Boolean).join(' · ') || 'sin fecha';
      return {
        text: `Listo 📅 Evento creado. Te avisaré antes de que empiece.`,
        card: { kind: 'event', title: c.title || 'Nuevo evento', meta: when },
      };
    }
    return {
      text: `Hecho ✨ He guardado esto como nota en tu contexto activo.`,
      card: { kind: 'note', title: c.title || 'Nueva nota', meta: 'Sin contexto' },
    };
  }

  // ─── Suggested prompts ─────────────────────────────────────────────────────

  const SUGGESTIONS = [
    'Recuérdame llamar al cliente el lunes a las 10',
    'Resume mis notas de la reunión de ayer',
    'Crea una nota sobre el lanzamiento del proyecto Q3',
    '¿Qué tengo pendiente esta semana?',
  ];

  // ─── CSS ────────────────────────────────────────────────────────────────────

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .from-demo-section { max-width: 1100px; margin: 0 auto; padding: 64px 24px; }
      .from-demo-section-header { text-align: center; margin-bottom: 40px; }
      .from-demo-section-label {
        display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.1em; color: var(--accent, #4a90d9); margin-bottom: 12px;
      }
      .from-demo-section-title {
        font-size: 32px; font-weight: 800; color: var(--text, #1a1a2e); margin: 0 0 10px;
        letter-spacing: -0.5px; line-height: 1.2;
      }
      .from-demo-section-sub { font-size: 16px; color: var(--text-secondary, #6b7280); margin: 0; line-height: 1.5; }

      .from-demo-container {
        max-width: 640px; margin: 0 auto; border-radius: 14px;
        box-shadow: 0 24px 80px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.07);
        overflow: hidden; background: var(--bg, #ffffff);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
        display: flex; flex-direction: column; -webkit-font-smoothing: antialiased;
      }
      .from-demo-header {
        display: flex; align-items: center; justify-content: space-between; padding: 11px 16px;
        background: var(--card-bg, #f8f8fa); border-bottom: 1px solid var(--border, rgba(0,0,0,.08));
        user-select: none;
      }
      .from-demo-header-left { display: flex; align-items: center; gap: 10px; }
      .from-demo-header-dots { display: flex; gap: 6px; }
      .from-demo-header-dots span { width: 11px; height: 11px; border-radius: 50%; display: block; }
      .from-demo-header-dots span:nth-child(1) { background: #ff5f57; }
      .from-demo-header-dots span:nth-child(2) { background: #febc2e; }
      .from-demo-header-dots span:nth-child(3) { background: #28c840; }
      .from-demo-title { font-size: 12px; font-weight: 600; color: var(--text-secondary, #6b7280); letter-spacing: -0.1px; }
      .from-demo-badge {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--accent, #4a90d9); background: rgba(74,144,217,0.1); padding: 3px 8px; border-radius: 5px;
      }

      .from-demo-body { height: 420px; overflow-y: auto; padding: 20px 20px 8px; display: flex; flex-direction: column; gap: 14px; }
      .from-demo-body::-webkit-scrollbar { width: 6px; }
      .from-demo-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 3px; }

      .from-demo-empty { text-align: center; margin: auto 0; padding: 20px 10px; }
      .from-demo-empty-emoji { font-size: 30px; margin-bottom: 10px; }
      .from-demo-empty-title { font-size: 16px; font-weight: 700; color: var(--text, #1a1a2e); margin-bottom: 6px; }
      .from-demo-empty-sub { font-size: 13px; color: var(--text-secondary, #6b7280); line-height: 1.5; margin-bottom: 18px; }
      .from-demo-suggestions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
      .from-demo-suggestion {
        font-size: 12.5px; text-align: left; padding: 9px 12px; border-radius: 9px;
        border: 1px solid var(--border, rgba(0,0,0,.1)); background: var(--card-bg, #f8f8fa);
        color: var(--text, #1a1a2e); cursor: pointer; transition: background 0.1s, border-color 0.1s;
      }
      .from-demo-suggestion:hover { background: rgba(74,144,217,0.08); border-color: rgba(74,144,217,0.3); }

      .from-demo-row { display: flex; gap: 8px; align-items: flex-start; }
      .from-demo-row.user { justify-content: flex-end; }
      .from-demo-avatar {
        width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0; display: flex; align-items: center;
        justify-content: center; font-size: 12px; background: var(--accent, #4a90d9); color: #fff; margin-top: 2px;
      }
      .from-demo-bubble {
        font-size: 13.5px; line-height: 1.55; padding: 9px 13px; border-radius: 12px; max-width: 78%;
        color: var(--text, #1a1a2e);
      }
      .from-demo-row.user .from-demo-bubble {
        background: var(--accent, #4a90d9); color: #fff; border-bottom-right-radius: 4px;
      }
      .from-demo-row.ai .from-demo-bubble {
        background: var(--card-bg, #f2f2f5); border-bottom-left-radius: 4px;
      }
      .from-demo-typing .from-demo-bubble { display: flex; gap: 4px; padding: 12px 14px; }
      .from-demo-typing-dot {
        width: 6px; height: 6px; border-radius: 50%; background: var(--text-secondary, #9ca3af);
        animation: from-demo-blink 1.1s infinite ease-in-out;
      }
      .from-demo-typing-dot:nth-child(2) { animation-delay: 0.15s; }
      .from-demo-typing-dot:nth-child(3) { animation-delay: 0.3s; }
      @keyframes from-demo-blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

      .from-demo-card {
        margin-top: 8px; display: flex; align-items: center; gap: 9px; padding: 9px 12px;
        border-radius: 10px; background: var(--bg, #fff); border: 1px solid var(--border, rgba(0,0,0,.08));
      }
      .from-demo-card-icon {
        width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; font-size: 12px; color: #fff;
      }
      .from-demo-card.task .from-demo-card-icon { background: #4a90d9; }
      .from-demo-card.event .from-demo-card-icon { background: #ff9500; }
      .from-demo-card.note .from-demo-card-icon { background: #34c759; }
      .from-demo-card-body { min-width: 0; }
      .from-demo-card-title {
        font-size: 12.5px; font-weight: 600; color: var(--text, #1a1a2e);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .from-demo-card-meta { font-size: 11px; color: var(--text-secondary, #6b7280); margin-top: 1px; }

      .from-demo-composer {
        display: flex; align-items: center; gap: 8px; padding: 12px 16px;
        border-top: 1px solid var(--border, rgba(0,0,0,.08)); background: var(--bg, #fff);
      }
      .from-demo-input {
        flex: 1; font-size: 13.5px; font-family: inherit; border: 1px solid var(--border, rgba(0,0,0,.12));
        border-radius: 10px; padding: 9px 12px; outline: none; background: var(--card-bg, #f8f8fa);
        color: var(--text, #1a1a2e); transition: border-color 0.1s;
      }
      .from-demo-input:focus { border-color: var(--accent, #4a90d9); }
      .from-demo-send {
        width: 32px; height: 32px; border-radius: 9px; border: none; background: var(--accent, #4a90d9);
        color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
        transition: opacity 0.1s;
      }
      .from-demo-send:disabled { opacity: 0.4; cursor: default; }

      .from-demo-footer {
        padding: 7px 16px; background: var(--card-bg, #f8f8fa); border-top: 1px solid var(--border, rgba(0,0,0,.08));
        display: flex; align-items: center; justify-content: space-between; user-select: none;
      }
      .from-demo-footer-hint { font-size: 11px; color: var(--text-secondary, #9ca3af); letter-spacing: -0.1px; }
      .from-demo-footer-logo {
        font-size: 11px; font-weight: 700; color: var(--text-secondary, #b0b8c4); letter-spacing: -0.3px;
        text-decoration: none; opacity: 0.6;
      }
      .from-demo-footer-logo:hover { opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  // ─── State + render ─────────────────────────────────────────────────────────

  let demoBody = null;
  let inputEl = null;
  let sendBtn = null;
  let messages = []; // { role: 'user'|'ai', text, card }
  let busy = false;

  function iconFor(kind) {
    if (kind === 'task') return '☑';
    if (kind === 'event') return '📅';
    return '📝';
  }

  function renderEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'from-demo-empty';
    wrap.innerHTML = `
      <div class="from-demo-empty-emoji">👋</div>
      <div class="from-demo-empty-title">Habla con Fromly</div>
      <div class="from-demo-empty-sub">Escribe lo que necesitas — crea la tarea, la nota o el evento por ti.</div>
      <div class="from-demo-suggestions"></div>
    `;
    const box = wrap.querySelector('.from-demo-suggestions');
    SUGGESTIONS.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'from-demo-suggestion';
      btn.textContent = s;
      btn.addEventListener('click', () => sendMessage(s));
      box.appendChild(btn);
    });
    return wrap;
  }

  function renderMessageRow(msg) {
    const row = document.createElement('div');
    row.className = 'from-demo-row ' + (msg.role === 'user' ? 'user' : 'ai');

    if (msg.role === 'ai') {
      const avatar = document.createElement('div');
      avatar.className = 'from-demo-avatar';
      avatar.textContent = '✦';
      row.appendChild(avatar);
    }

    const bubbleWrap = document.createElement('div');
    bubbleWrap.style.maxWidth = '78%';

    const bubble = document.createElement('div');
    bubble.className = 'from-demo-bubble';
    bubble.textContent = msg.text;
    bubbleWrap.appendChild(bubble);

    if (msg.card) {
      const card = document.createElement('div');
      card.className = 'from-demo-card ' + msg.card.kind;
      card.innerHTML = `
        <div class="from-demo-card-icon">${iconFor(msg.card.kind)}</div>
        <div class="from-demo-card-body">
          <div class="from-demo-card-title"></div>
          <div class="from-demo-card-meta"></div>
        </div>
      `;
      card.querySelector('.from-demo-card-title').textContent = msg.card.title;
      card.querySelector('.from-demo-card-meta').textContent = msg.card.meta;
      bubbleWrap.appendChild(card);
    }

    row.appendChild(bubbleWrap);
    return row;
  }

  function renderTypingRow() {
    const row = document.createElement('div');
    row.className = 'from-demo-row ai from-demo-typing';
    row.innerHTML = `
      <div class="from-demo-avatar">✦</div>
      <div class="from-demo-bubble">
        <span class="from-demo-typing-dot"></span><span class="from-demo-typing-dot"></span><span class="from-demo-typing-dot"></span>
      </div>
    `;
    return row;
  }

  function render() {
    demoBody.innerHTML = '';
    if (messages.length === 0) {
      demoBody.appendChild(renderEmptyState());
    } else {
      messages.forEach(m => demoBody.appendChild(renderMessageRow(m)));
      if (busy) demoBody.appendChild(renderTypingRow());
    }
    demoBody.scrollTop = demoBody.scrollHeight;
  }

  function sendMessage(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    messages.push({ role: 'user', text });
    busy = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    render();

    const delay = 550 + Math.random() * 500;
    setTimeout(() => {
      const resp = buildResponse(text);
      busy = false;
      messages.push({ role: 'ai', text: resp.text, card: resp.card });
      sendBtn.disabled = false;
      render();
      inputEl.focus();
    }, delay);
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  function buildWidget(root) {
    injectStyles();
    messages = [];
    busy = false;

    const section = document.createElement('div');
    section.className = 'from-demo-section';

    const header = document.createElement('div');
    header.className = 'from-demo-section-header';
    header.innerHTML = `
      <span class="from-demo-section-label">Demo interactivo</span>
      <h2 class="from-demo-section-title">Pruébalo ahora mismo</h2>
      <p class="from-demo-section-sub">Sin cuenta. Sin instalación. Simplemente escribe lo que necesitas.</p>
    `;

    const container = document.createElement('div');
    container.className = 'from-demo-container';

    const headerBar = document.createElement('div');
    headerBar.className = 'from-demo-header';
    headerBar.innerHTML = `
      <div class="from-demo-header-left">
        <div class="from-demo-header-dots"><span></span><span></span><span></span></div>
        <span class="from-demo-title">✦ Fromly — Demo interactivo</span>
      </div>
      <span class="from-demo-badge">Pruébalo</span>
    `;

    demoBody = document.createElement('div');
    demoBody.className = 'from-demo-body';

    const composer = document.createElement('div');
    composer.className = 'from-demo-composer';
    inputEl = document.createElement('input');
    inputEl.className = 'from-demo-input';
    inputEl.type = 'text';
    inputEl.placeholder = 'Escribe a Fromly…';
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage(inputEl.value);
    });
    sendBtn = document.createElement('button');
    sendBtn.className = 'from-demo-send';
    sendBtn.type = 'button';
    sendBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>`;
    sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
    composer.appendChild(inputEl);
    composer.appendChild(sendBtn);

    const footer = document.createElement('div');
    footer.className = 'from-demo-footer';
    footer.innerHTML = `
      <span class="from-demo-footer-hint">Los cambios no se guardan · Recarga para empezar de nuevo</span>
      <a href="https://fromly.app" class="from-demo-footer-logo">Fromly ✦</a>
    `;

    container.appendChild(headerBar);
    container.appendChild(demoBody);
    container.appendChild(composer);
    container.appendChild(footer);

    section.appendChild(header);
    section.appendChild(container);
    root.appendChild(section);

    render();
  }

  function init() {
    const root = document.getElementById('from-demo-root');
    if (!root) return;
    buildWidget(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
