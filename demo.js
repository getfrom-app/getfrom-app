/**
 * From — Interactive Demo Outliner Widget
 * Self-contained, no dependencies, no frameworks.
 * Fresh demo data on every page load. Changes not saved.
 */
(function () {
  'use strict';

  // ─── Data Model ────────────────────────────────────────────────────────────
  // Node: { id, text, parentId, status: null|'pending'|'done', collapsed, isDiary }

  let nodeMap = {}; // id → node
  let childrenOf = {}; // parentId → [id, ...]
  let rootIds = []; // ordered top-level ids
  let focusedId = null;

  let idCounter = 0;
  function uid() { return 'n' + (++idCounter); }

  function createNode(text, parentId = null, status = null, isDiary = false) {
    const id = uid();
    const node = { id, text, parentId, status, collapsed: false, isDiary };
    nodeMap[id] = node;
    if (!childrenOf[id]) childrenOf[id] = [];
    if (parentId !== null) {
      if (!childrenOf[parentId]) childrenOf[parentId] = [];
      childrenOf[parentId].push(id);
    } else {
      rootIds.push(id);
    }
    return node;
  }

  function getChildren(id) { return childrenOf[id] || []; }
  function hasChildren(id) { return getChildren(id).length > 0; }

  function getParent(id) {
    const node = nodeMap[id];
    return node ? node.parentId : null;
  }

  /** Flat ordered list of visible node ids (respects collapse) */
  function flatVisible(ids) {
    const result = [];
    function walk(list) {
      for (const id of list) {
        result.push(id);
        if (!nodeMap[id].collapsed && hasChildren(id)) {
          walk(childrenOf[id]);
        }
      }
    }
    walk(ids);
    return result;
  }

  function getSiblings(id) {
    const parentId = getParent(id);
    return parentId !== null ? childrenOf[parentId] : rootIds;
  }

  function indexInSiblings(id) {
    return getSiblings(id).indexOf(id);
  }

  // ─── Demo Data ─────────────────────────────────────────────────────────────

  function initData() {
    nodeMap = {}; childrenOf = {}; rootIds = []; idCounter = 0; focusedId = null;

    // Diary header
    const diary = createNode('📅 Hoy — Viernes, 29 de mayo de 2026', null, null, true);
    childrenOf[diary.id] = [];

    // Children of diary
    const done1 = createNode('Llamar a cliente para confirmar la reunión', diary.id, 'done');
    const done2 = createNode('Revisar el informe de ventas Q1', diary.id, 'done');
    const task1 = createNode('Preparar presentación para el lanzamiento', diary.id, 'pending');
    const task2 = createNode('Enviar propuesta actualizada al cliente', diary.id, 'pending');

    // Note with children
    const meeting = createNode('Notas de la reunión de ayer', diary.id, null);
    childrenOf[meeting.id] = [];
    createNode('Presupuesto aprobado: 12.000€ para el proyecto Q3', meeting.id);
    createNode('El cliente quiere cambios antes del viernes', meeting.id);
    createNode('Próxima revisión: 5 de junio', meeting.id);

    createNode('Revisar el presupuesto Q3 con el equipo', diary.id, 'pending');
    createNode('Preparar deck para reunión con inversores', diary.id, null);

    // Second root node
    const project = createNode('📁 Proyecto Web Q3', null, null);
    childrenOf[project.id] = [];
    createNode('Definir arquitectura de componentes', project.id, 'pending');
    createNode('Revisión de diseño con el equipo', project.id, 'pending');

    const resources = createNode('Recursos', project.id, null);
    childrenOf[resources.id] = [];
    createNode('Design System v2.0 — figma.com', resources.id);
  }

  // ─── CSS Injection ─────────────────────────────────────────────────────────

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Demo Section Wrapper */
      .from-demo-section {
        max-width: 1100px;
        margin: 0 auto;
        padding: 64px 24px;
      }
      .from-demo-section-header {
        text-align: center;
        margin-bottom: 40px;
      }
      .from-demo-section-label {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--accent, #4a90d9);
        margin-bottom: 12px;
      }
      .from-demo-section-title {
        font-size: 32px;
        font-weight: 800;
        color: var(--text, #1a1a2e);
        margin: 0 0 10px;
        letter-spacing: -0.5px;
        line-height: 1.2;
      }
      .from-demo-section-sub {
        font-size: 16px;
        color: var(--text-secondary, #6b7280);
        margin: 0;
        line-height: 1.5;
      }

      /* Demo Container */
      .from-demo-container {
        max-width: 860px;
        margin: 0 auto;
        border-radius: 14px;
        box-shadow: 0 24px 80px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.07);
        overflow: hidden;
        background: var(--bg, #ffffff);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
        position: relative;
        -webkit-font-smoothing: antialiased;
      }

      /* Header bar */
      .from-demo-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 11px 16px;
        background: var(--card-bg, #f8f8fa);
        border-bottom: 1px solid var(--border, rgba(0,0,0,.08));
        user-select: none;
      }
      .from-demo-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .from-demo-header-dots {
        display: flex;
        gap: 6px;
      }
      .from-demo-header-dots span {
        width: 11px;
        height: 11px;
        border-radius: 50%;
        display: block;
      }
      .from-demo-header-dots span:nth-child(1) { background: #ff5f57; }
      .from-demo-header-dots span:nth-child(2) { background: #febc2e; }
      .from-demo-header-dots span:nth-child(3) { background: #28c840; }
      .from-demo-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary, #6b7280);
        letter-spacing: -0.1px;
      }
      .from-demo-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--accent, #4a90d9);
        background: rgba(74,144,217,0.1);
        padding: 3px 8px;
        border-radius: 5px;
      }

      /* Outliner scroll area */
      .from-demo-body {
        height: 420px;
        overflow-y: auto;
        padding: 12px 0 8px;
        outline: none;
        position: relative;
      }
      .from-demo-body::-webkit-scrollbar { width: 6px; }
      .from-demo-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 3px; }

      /* Node row */
      .from-demo-node {
        display: flex;
        align-items: flex-start;
        padding: 1px 12px 1px 8px;
        position: relative;
        border-radius: 5px;
        cursor: default;
        min-height: 26px;
        transition: background 0.07s;
      }
      .from-demo-node:hover { background: var(--hover-bg, rgba(0,0,0,.04)); }
      .from-demo-node.focused { background: var(--hover-bg, rgba(0,0,0,.035)); }

      /* Indent spacer */
      .from-demo-indent { flex-shrink: 0; }

      /* Triangle toggle */
      .from-demo-toggle {
        width: 16px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: var(--text-secondary, #9ca3af);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.1s, transform 0.15s;
        user-select: none;
        margin-top: 2px;
      }
      .from-demo-node:hover .from-demo-toggle,
      .from-demo-node.focused .from-demo-toggle,
      .from-demo-toggle.has-children {
        opacity: 1;
      }
      .from-demo-toggle.collapsed {
        transform: rotate(-90deg);
      }
      .from-demo-toggle svg { pointer-events: none; }

      /* Bullet dot */
      .from-demo-bullet {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 7px;
        margin-right: 7px;
        cursor: pointer;
        transition: transform 0.15s;
      }
      .from-demo-bullet:hover { transform: scale(1.3); }
      .from-demo-bullet.pulse {
        animation: from-demo-pulse 0.4s ease-out;
      }
      @keyframes from-demo-pulse {
        0%   { transform: scale(1); }
        40%  { transform: scale(1.8); }
        100% { transform: scale(1); }
      }

      /* Checkbox (for tasks) */
      .from-demo-checkbox {
        width: 15px;
        height: 15px;
        border-radius: 4px;
        border: 1.5px solid var(--accent, #4a90d9);
        flex-shrink: 0;
        margin-top: 4px;
        margin-right: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.1s, border-color 0.1s;
        user-select: none;
      }
      .from-demo-checkbox.done {
        background: var(--accent, #4a90d9);
        border-color: var(--accent, #4a90d9);
      }
      .from-demo-checkbox.done::after {
        content: '';
        width: 9px;
        height: 5px;
        border-left: 1.5px solid #fff;
        border-bottom: 1.5px solid #fff;
        transform: rotate(-45deg) translateY(-1px);
        display: block;
      }

      /* Text content */
      .from-demo-text {
        flex: 1;
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--text, #1a1a2e);
        outline: none;
        padding: 2px 0;
        min-height: 22px;
        word-break: break-word;
        caret-color: var(--accent, #4a90d9);
      }
      .from-demo-text[contenteditable="true"]:empty::before {
        content: attr(data-placeholder);
        color: var(--text-secondary, #9ca3af);
        pointer-events: none;
      }
      .from-demo-node.diary-header > .from-demo-text {
        font-size: 14px;
        font-weight: 700;
        color: var(--text, #1a1a2e);
      }
      .from-demo-node.status-done > .from-demo-text {
        text-decoration: line-through;
        color: var(--text-secondary, #9ca3af);
      }

      /* Action buttons (hover) */
      .from-demo-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.1s;
        margin-top: 2px;
        flex-shrink: 0;
      }
      .from-demo-node:hover .from-demo-actions,
      .from-demo-node.focused .from-demo-actions {
        opacity: 1;
      }
      .from-demo-action-btn {
        width: 22px;
        height: 22px;
        border: none;
        background: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        color: var(--text-secondary, #9ca3af);
        padding: 0;
        transition: background 0.1s, color 0.1s;
      }
      .from-demo-action-btn:hover {
        background: var(--hover-bg, rgba(0,0,0,.07));
        color: var(--text, #1a1a2e);
      }

      /* Drag handle */
      .from-demo-drag {
        opacity: 0;
        cursor: grab;
        color: var(--text-secondary, #9ca3af);
        font-size: 11px;
        letter-spacing: -1px;
        margin-top: 3px;
        padding: 0 2px;
        user-select: none;
        flex-shrink: 0;
        transition: opacity 0.1s;
      }
      .from-demo-node:hover .from-demo-drag,
      .from-demo-node.focused .from-demo-drag {
        opacity: 1;
      }

      /* Footer bar */
      .from-demo-footer {
        padding: 7px 16px;
        background: var(--card-bg, #f8f8fa);
        border-top: 1px solid var(--border, rgba(0,0,0,.08));
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
      }
      .from-demo-footer-hint {
        font-size: 11px;
        color: var(--text-secondary, #9ca3af);
        letter-spacing: -0.1px;
      }
      .from-demo-footer-logo {
        font-size: 11px;
        font-weight: 700;
        color: var(--text-secondary, #b0b8c4);
        letter-spacing: -0.3px;
        text-decoration: none;
        opacity: 0.6;
      }
      .from-demo-footer-logo:hover { opacity: 1; }

      /* Keyboard shortcut chips */
      .from-demo-shortcuts {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px 12px;
        border-top: 1px solid var(--border, rgba(0,0,0,.06));
        background: var(--card-bg, #f8f8fa);
      }
      .from-demo-shortcut {
        font-size: 10px;
        color: var(--text-secondary, #9ca3af);
        display: flex;
        align-items: center;
        gap: 3px;
      }
      .from-demo-shortcut kbd {
        font-family: inherit;
        font-size: 9px;
        background: var(--bg, #ffffff);
        border: 1px solid var(--border, rgba(0,0,0,.12));
        border-radius: 3px;
        padding: 1px 4px;
        color: var(--text-secondary, #6b7280);
        line-height: 1.4;
      }

      /* Drag-over indicator */
      .from-demo-node.drag-over-above::before {
        content: '';
        display: block;
        position: absolute;
        left: 8px;
        right: 8px;
        top: -1px;
        height: 2px;
        background: var(--accent, #4a90d9);
        border-radius: 2px;
      }
      .from-demo-node.drag-over-below::after {
        content: '';
        display: block;
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: -1px;
        height: 2px;
        background: var(--accent, #4a90d9);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Bullet color per depth ────────────────────────────────────────────────

  function bulletColor(depth) {
    const colors = ['#4a90d9', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#ffcc00'];
    return colors[depth % colors.length];
  }

  function depthOf(id) {
    let d = 0, cur = nodeMap[id];
    while (cur && cur.parentId !== null) {
      d++;
      cur = nodeMap[cur.parentId];
    }
    return d;
  }

  // ─── Drag State ────────────────────────────────────────────────────────────
  let dragState = null; // { id, startEl }

  // ─── Render ────────────────────────────────────────────────────────────────

  let demoBody = null;

  function render() {
    if (!demoBody) return;
    const visible = flatVisible(rootIds);
    const existing = Array.from(demoBody.children);

    // Remove excess rows
    while (demoBody.children.length > visible.length) {
      demoBody.removeChild(demoBody.lastChild);
    }

    // Create/update rows
    visible.forEach((id, idx) => {
      let row = demoBody.children[idx];
      if (!row || row.dataset.id !== id) {
        const newRow = buildRow(id);
        if (row) {
          demoBody.insertBefore(newRow, row);
        } else {
          demoBody.appendChild(newRow);
        }
      } else {
        updateRow(row, id);
      }
    });
  }

  function buildRow(id) {
    const node = nodeMap[id];
    const depth = depthOf(id);
    const hasKids = hasChildren(id);

    const row = document.createElement('div');
    row.className = 'from-demo-node';
    row.dataset.id = id;
    if (id === focusedId) row.classList.add('focused');
    if (node.isDiary) row.classList.add('diary-header');
    if (node.status === 'done') row.classList.add('status-done');

    // Indent
    const indent = document.createElement('div');
    indent.className = 'from-demo-indent';
    indent.style.width = (depth * 22) + 'px';

    // Drag handle
    const drag = document.createElement('div');
    drag.className = 'from-demo-drag';
    drag.textContent = '⠿';
    drag.title = 'Arrastrar para reordenar';
    drag.draggable = true;
    drag.addEventListener('dragstart', onDragStart.bind(null, id));

    // Toggle triangle
    const toggle = document.createElement('div');
    toggle.className = 'from-demo-toggle';
    if (hasKids) toggle.classList.add('has-children');
    if (node.collapsed) toggle.classList.add('collapsed');
    toggle.innerHTML = `<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 2l3 4 3-4z"/></svg>`;
    toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleCollapse(id); });

    // Bullet or checkbox
    let indicator;
    if (node.status !== null) {
      indicator = document.createElement('div');
      indicator.className = 'from-demo-checkbox' + (node.status === 'done' ? ' done' : '');
      indicator.title = 'Cmd+Enter para cambiar estado';
      indicator.addEventListener('click', (e) => { e.stopPropagation(); cycleStatus(id); });
    } else {
      indicator = document.createElement('div');
      indicator.className = 'from-demo-bullet';
      indicator.style.background = bulletColor(depth);
      indicator.title = 'Clic para resaltar';
      indicator.addEventListener('click', (e) => { e.stopPropagation(); pulseBullet(indicator); });
    }

    // Text
    const text = document.createElement('div');
    text.className = 'from-demo-text';
    text.dataset.id = id;
    text.dataset.placeholder = 'Escribe algo...';
    text.contentEditable = node.isDiary ? 'false' : 'true';
    text.spellcheck = false;
    text.textContent = node.text;
    text.addEventListener('keydown', onKeyDown.bind(null, id));
    text.addEventListener('focus', () => { focusedId = id; updateFocusClass(); });
    text.addEventListener('input', () => {
      nodeMap[id].text = text.textContent;
    });

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'from-demo-actions';

    const addBtn = makeActionBtn(
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      'Añadir nodo hijo',
      () => addChildNode(id)
    );
    const taskBtn = makeActionBtn(
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      'Convertir en tarea',
      () => { cycleStatus(id); }
    );
    actions.appendChild(addBtn);
    actions.appendChild(taskBtn);

    row.appendChild(indent);
    row.appendChild(drag);
    row.appendChild(toggle);
    row.appendChild(indicator);
    row.appendChild(text);
    row.appendChild(actions);

    // Drag drop on row
    row.addEventListener('dragover', onDragOver.bind(null, id));
    row.addEventListener('dragleave', onDragLeave);
    row.addEventListener('drop', onDrop.bind(null, id));

    return row;
  }

  function updateRow(row, id) {
    const node = nodeMap[id];
    const depth = depthOf(id);
    const hasKids = hasChildren(id);

    // Update classes
    row.className = 'from-demo-node';
    if (id === focusedId) row.classList.add('focused');
    if (node.isDiary) row.classList.add('diary-header');
    if (node.status === 'done') row.classList.add('status-done');

    // Indent
    const indent = row.querySelector('.from-demo-indent');
    if (indent) indent.style.width = (depth * 22) + 'px';

    // Toggle
    const toggle = row.querySelector('.from-demo-toggle');
    if (toggle) {
      toggle.className = 'from-demo-toggle';
      if (hasKids) toggle.classList.add('has-children');
      if (node.collapsed) toggle.classList.add('collapsed');
    }

    // Indicator (bullet or checkbox)
    const bullet = row.querySelector('.from-demo-bullet');
    const checkbox = row.querySelector('.from-demo-checkbox');

    if (node.status !== null) {
      if (bullet) {
        // Replace bullet with checkbox
        const newCb = document.createElement('div');
        newCb.className = 'from-demo-checkbox' + (node.status === 'done' ? ' done' : '');
        newCb.title = 'Cmd+Enter para cambiar estado';
        newCb.addEventListener('click', (e) => { e.stopPropagation(); cycleStatus(id); });
        bullet.replaceWith(newCb);
      } else if (checkbox) {
        checkbox.className = 'from-demo-checkbox' + (node.status === 'done' ? ' done' : '');
      }
    } else {
      if (checkbox) {
        const newBullet = document.createElement('div');
        newBullet.className = 'from-demo-bullet';
        newBullet.style.background = bulletColor(depth);
        newBullet.title = 'Clic para resaltar';
        newBullet.addEventListener('click', (e) => { e.stopPropagation(); pulseBullet(newBullet); });
        checkbox.replaceWith(newBullet);
      } else if (bullet) {
        bullet.style.background = bulletColor(depth);
      }
    }

    // Text (only update if not focused to avoid cursor jump)
    const textEl = row.querySelector('.from-demo-text');
    if (textEl && document.activeElement !== textEl) {
      textEl.textContent = node.text;
    }
  }

  function updateFocusClass() {
    demoBody.querySelectorAll('.from-demo-node').forEach(row => {
      row.classList.toggle('focused', row.dataset.id === focusedId);
    });
  }

  function makeActionBtn(svg, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'from-demo-action-btn';
    btn.title = title;
    btn.innerHTML = svg;
    btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); onClick(); });
    return btn;
  }

  // ─── Interactions ──────────────────────────────────────────────────────────

  function toggleCollapse(id) {
    nodeMap[id].collapsed = !nodeMap[id].collapsed;
    render();
  }

  function pulseBullet(el) {
    el.classList.remove('pulse');
    void el.offsetWidth; // reflow
    el.classList.add('pulse');
  }

  function cycleStatus(id) {
    const node = nodeMap[id];
    if (node.isDiary) return;
    if (node.status === null) node.status = 'pending';
    else if (node.status === 'pending') node.status = 'done';
    else node.status = null;
    render();
    focusNode(id);
  }

  function focusNode(id) {
    const el = demoBody.querySelector(`.from-demo-text[data-id="${id}"]`);
    if (el && el.contentEditable !== 'false') {
      el.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    focusedId = id;
    updateFocusClass();
  }

  function addChildNode(parentId) {
    const child = createNode('', parentId, null);
    if (nodeMap[parentId].collapsed) {
      nodeMap[parentId].collapsed = false;
    }
    render();
    focusNode(child.id);
  }

  // ─── Keyboard Handler ──────────────────────────────────────────────────────

  function onKeyDown(id, e) {
    const node = nodeMap[id];

    // Enter → create sibling below
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const text = e.currentTarget.textContent.trim();
      // If on empty node with parent, outdent-delete behavior
      if (text === '' && node.parentId !== null) {
        e.currentTarget.textContent = '';
        nodeMap[id].text = '';
      }
      insertSiblingAfter(id);
      return;
    }

    // Cmd+Enter / Ctrl+Enter → cycle task status
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      cycleStatus(id);
      return;
    }

    // Tab → indent
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      indentNode(id);
      return;
    }

    // Shift+Tab → outdent
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      outdentNode(id);
      return;
    }

    // Backspace on empty node → delete
    if (e.key === 'Backspace') {
      const text = e.currentTarget.textContent;
      if (text === '') {
        e.preventDefault();
        deleteNode(id);
        return;
      }
    }

    // Arrow up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(id, -1);
      return;
    }

    // Arrow down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(id, 1);
      return;
    }
  }

  function insertSiblingAfter(id) {
    const node = nodeMap[id];
    const siblings = getSiblings(id);
    const idx = siblings.indexOf(id);

    const newNode = createNode('', node.parentId, null);
    // Remove from end (createNode appended it), insert after idx
    const arr = node.parentId !== null ? childrenOf[node.parentId] : rootIds;
    const insertedIdx = arr.indexOf(newNode.id);
    arr.splice(insertedIdx, 1);
    arr.splice(idx + 1, 0, newNode.id);

    render();
    focusNode(newNode.id);
  }

  function indentNode(id) {
    const siblings = getSiblings(id);
    const idx = siblings.indexOf(id);
    if (idx === 0) return; // no previous sibling to become parent
    const prevSibId = siblings[idx - 1];
    const node = nodeMap[id];

    // Remove from current parent's children
    siblings.splice(idx, 1);

    // Add to prevSibling's children
    if (!childrenOf[prevSibId]) childrenOf[prevSibId] = [];
    childrenOf[prevSibId].push(id);
    node.parentId = prevSibId;

    // Expand new parent
    nodeMap[prevSibId].collapsed = false;

    render();
    focusNode(id);
  }

  function outdentNode(id) {
    const node = nodeMap[id];
    if (node.parentId === null) return; // already root
    const parent = nodeMap[node.parentId];
    const grandParentId = parent.parentId;

    // Remove from parent's children
    const siblings = childrenOf[node.parentId];
    const idx = siblings.indexOf(id);
    siblings.splice(idx, 1);

    // Insert after parent in grandparent's children
    if (grandParentId !== null) {
      const uncles = childrenOf[grandParentId];
      const parentIdx = uncles.indexOf(node.parentId);
      uncles.splice(parentIdx + 1, 0, id);
    } else {
      const parentRootIdx = rootIds.indexOf(node.parentId);
      rootIds.splice(parentRootIdx + 1, 0, id);
    }
    node.parentId = grandParentId;

    render();
    focusNode(id);
  }

  function deleteNode(id) {
    const visible = flatVisible(rootIds);
    const visIdx = visible.indexOf(id);
    const prevId = visIdx > 0 ? visible[visIdx - 1] : null;

    const node = nodeMap[id];
    const siblings = getSiblings(id);
    const idx = siblings.indexOf(id);
    siblings.splice(idx, 1);
    delete nodeMap[id];
    delete childrenOf[id];

    render();
    if (prevId && nodeMap[prevId]) focusNode(prevId);
  }

  function moveFocus(id, direction) {
    const visible = flatVisible(rootIds);
    const idx = visible.indexOf(id);
    const next = visible[idx + direction];
    if (next && nodeMap[next]) focusNode(next);
  }

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  function onDragStart(id, e) {
    dragState = { id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(id, e) {
    if (!dragState || dragState.id === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.currentTarget;
    const rect = row.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    clearDragClasses();
    if (e.clientY < midY) {
      row.classList.add('drag-over-above');
    } else {
      row.classList.add('drag-over-below');
    }
  }

  function onDragLeave(e) {
    clearDragClasses();
  }

  function clearDragClasses() {
    demoBody.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
      el.classList.remove('drag-over-above', 'drag-over-below');
    });
  }

  function onDrop(targetId, e) {
    e.preventDefault();
    clearDragClasses();
    if (!dragState || dragState.id === targetId) { dragState = null; return; }

    const srcId = dragState.id;
    dragState = null;

    const targetRow = demoBody.querySelector(`.from-demo-node[data-id="${targetId}"]`);
    const isAbove = targetRow && targetRow.classList.contains('drag-over-above');
    clearDragClasses();

    // Remove src from current location
    const srcNode = nodeMap[srcId];
    const srcSiblings = getSiblings(srcId);
    const srcIdx = srcSiblings.indexOf(srcId);
    srcSiblings.splice(srcIdx, 1);

    // Insert near target
    const tgtNode = nodeMap[targetId];
    const tgtSiblings = getSiblings(targetId);
    const tgtIdx = tgtSiblings.indexOf(targetId);

    srcNode.parentId = tgtNode.parentId;

    if (isAbove) {
      tgtSiblings.splice(tgtIdx, 0, srcId);
    } else {
      tgtSiblings.splice(tgtIdx + 1, 0, srcId);
    }

    render();
    focusNode(srcId);
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  function buildWidget(root) {
    injectStyles();
    initData();

    // Section wrapper
    const section = document.createElement('div');
    section.className = 'from-demo-section';

    const header = document.createElement('div');
    header.className = 'from-demo-section-header';
    header.innerHTML = `
      <span class="from-demo-section-label">Demo interactivo</span>
      <h2 class="from-demo-section-title">Pruébalo ahora mismo</h2>
      <p class="from-demo-section-sub">Sin cuenta. Sin instalación. Simplemente empieza a escribir.</p>
    `;

    // Container
    const container = document.createElement('div');
    container.className = 'from-demo-container';

    // Header bar
    const headerBar = document.createElement('div');
    headerBar.className = 'from-demo-header';
    headerBar.innerHTML = `
      <div class="from-demo-header-left">
        <div class="from-demo-header-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="from-demo-title">✦ From — Demo interactivo</span>
      </div>
      <span class="from-demo-badge">Pruébalo</span>
    `;

    // Outliner body
    demoBody = document.createElement('div');
    demoBody.className = 'from-demo-body';
    demoBody.tabIndex = 0;

    // Shortcuts bar
    const shortcuts = document.createElement('div');
    shortcuts.className = 'from-demo-shortcuts';
    shortcuts.innerHTML = `
      <span class="from-demo-shortcut"><kbd>Enter</kbd> nuevo nodo</span>
      <span class="from-demo-shortcut"><kbd>Tab</kbd> indentar</span>
      <span class="from-demo-shortcut"><kbd>⇧Tab</kbd> desindentar</span>
      <span class="from-demo-shortcut"><kbd>⌘↵</kbd> tarea</span>
      <span class="from-demo-shortcut"><kbd>↑↓</kbd> navegar</span>
      <span class="from-demo-shortcut"><kbd>⌫</kbd> borrar vacío</span>
    `;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'from-demo-footer';
    footer.innerHTML = `
      <span class="from-demo-footer-hint">Los cambios no se guardan · Recarga para empezar de nuevo</span>
      <a href="https://getfrom.app" class="from-demo-footer-logo">from ✦</a>
    `;

    container.appendChild(headerBar);
    container.appendChild(demoBody);
    container.appendChild(shortcuts);
    container.appendChild(footer);

    section.appendChild(header);
    section.appendChild(container);
    root.appendChild(section);

    render();

    // Focus first editable node
    const firstEditable = flatVisible(rootIds).find(id => !nodeMap[id].isDiary);
    if (firstEditable) {
      setTimeout(() => {
        const el = demoBody.querySelector(`.from-demo-text[data-id="${firstEditable}"]`);
        if (el) el.focus();
      }, 200);
    }
  }

  // Init on DOM ready
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
