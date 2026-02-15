/**
 * @uistate/renderer: Direct-binding reactive renderer for EventState
 *
 * Copyright (c) 2025 Ajdin Imsirovic
 *
 * Three primitives:
 *   1. Delegated Actions (DOM -> Store): set, set-blur, set-enter
 *   2. Direct Node Binding (Store -> DOM): bind-text, bind-value, bind-data-*, bind-focus
 *   3. Keyed Collections: each="path" + <template>
 *
 * No templates. No innerHTML. No interpolation. No diffing.
 * Event delegation survives DOM mutations. Bindings are surgical.
 */

// -- Pure helpers ------------------------------------------------------

const BOUND = Symbol('r2');

export function parseSetExpr(raw) {
  const i = raw.indexOf(':');
  if (i === -1) return { path: raw.trim(), expr: null };
  return { path: raw.slice(0, i).trim(), expr: raw.slice(i + 1).trim() };
}

export function evalExpr(expr, current) {
  if (expr == null) return current;
  if (expr === 'increment') return (Number(current) || 0) + 1;
  if (expr === 'decrement') return (Number(current) || 0) - 1;
  if (expr === 'toggle') return !current;
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null') return null;
  const n = Number(expr);
  if (!isNaN(n) && expr.trim() !== '') return n;
  try { return JSON.parse(expr); } catch (_) {}
  return expr;
}

export function parsePush(expr) {
  if (!expr) return null;
  if (expr === 'push') return { source: null };
  const m = expr.match(/^push\(([^)]+)\)$/);
  return m ? { source: m[1].trim() } : null;
}

// -- Mount -------------------------------------------------------------

export function mount(store, root = document.body) {
  const subs = []; // { node, unsub }

  // -- Binding helpers --

  function addBinding(path, node, updateFn) {
    updateFn(store.get(path));
    const unsub = store.subscribe(path, (value) => updateFn(value));
    subs.push({ node, unsub });
  }

  function cleanupWithin(container) {
    for (let i = subs.length - 1; i >= 0; i--) {
      if (container.contains(subs[i].node)) {
        subs[i].unsub();
        subs.splice(i, 1);
      }
    }
  }

  // -- Scan for bind-* attributes --

  function scanBindings(el) {
    const nodes = el instanceof Element ? [el, ...el.querySelectorAll('*')] : [];

    for (const node of nodes) {
      if (node[BOUND]) continue;
      node[BOUND] = true;

      // bind-text: one-way, textContent
      if (node.hasAttribute('bind-text')) {
        const p = node.getAttribute('bind-text');
        addBinding(p, node, v => {
          node.textContent = v != null ? String(v) : '';
        });
      }

      // bind-value: two-way for inputs
      if (node.hasAttribute('bind-value')) {
        const p = node.getAttribute('bind-value');
        addBinding(p, node, v => {
          const s = v != null ? String(v) : '';
          if (node.type === 'checkbox') {
            if (node.checked !== !!v) node.checked = !!v;
          } else {
            if (node.value !== s) node.value = s;
          }
        });
        node.addEventListener('input', () => {
          store.set(p, node.type === 'checkbox' ? node.checked : node.value);
        });
      }

      // bind-focus: focus element when value is truthy
      if (node.hasAttribute('bind-focus')) {
        const p = node.getAttribute('bind-focus');
        addBinding(p, node, v => {
          if (v) requestAnimationFrame(() => {
            if (node.offsetParent !== null) node.focus();
          });
        });
      }

      // bind-data-* -> dataset, bind-attr-* -> setAttribute
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith('bind-data-')) {
          const dName = attr.name.slice(10);
          const p = attr.value;
          addBinding(p, node, v => {
            node.dataset[dName] = v != null ? String(v) : '';
          });
        } else if (attr.name.startsWith('bind-attr-')) {
          const aName = attr.name.slice(10);
          const p = attr.value;
          addBinding(p, node, v => {
            if (v != null) node.setAttribute(aName, String(v));
            else node.removeAttribute(aName);
          });
        }
      }
    }
  }

  // -- Delegated action execution --

  function executeSet(raw) {
    const { path, expr } = parseSetExpr(raw);

    // delete: remove key from parent collection
    if (expr === 'delete') {
      const dot = path.lastIndexOf('.');
      if (dot === -1) return;
      const parentPath = path.slice(0, dot);
      const key = path.slice(dot + 1);
      const parent = store.get(parentPath) || {};
      const updated = {};
      for (const k of Object.keys(parent)) {
        if (k !== key) updated[k] = parent[k];
      }
      store.set(parentPath, updated);
      return;
    }

    // push(sourcePath): clone source into collection, reset source
    const push = parsePush(expr);
    if (push) {
      const sourcePath = push.source;
      if (!sourcePath) return;
      const src = store.get(sourcePath);
      if (!src || typeof src !== 'object') return;
      const key = `t_${Date.now()}`;
      store.batch(() => {
        store.set(`${path}.${key}`, JSON.parse(JSON.stringify(src)));
        for (const k of Object.keys(src)) {
          const v = src[k];
          store.set(`${sourcePath}.${k}`,
            typeof v === 'string' ? '' :
            typeof v === 'boolean' ? false :
            typeof v === 'number' ? 0 : null
          );
        }
      });
      return;
    }

    // normal: evaluate expression and set
    store.set(path, evalExpr(expr, store.get(path)));
  }

  // -- Step 1: Event delegation (once, never re-wired) --

  root.addEventListener('click', e => {
    const t = e.target.closest('[set]');
    if (t && root.contains(t)) executeSet(t.getAttribute('set'));
  });

  root.addEventListener('focusout', e => {
    const t = e.target.closest('[set-blur]');
    if (t && root.contains(t)) executeSet(t.getAttribute('set-blur'));
  });

  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const t = e.target.closest('[set-enter]');
    if (t && root.contains(t)) {
      e.preventDefault();
      executeSet(t.getAttribute('set-enter'));
    }
  });

  // -- Step 3: Keyed collections --

  function setupCollection(container) {
    const collPath = container.getAttribute('each');
    const tpl = container.querySelector('template');
    if (!collPath || !tpl) return;

    const templateHTML = tpl.innerHTML.trim();
    const rendered = new Map(); // key -> element
    let lastKeyStr = '';

    function resolve(html, key) {
      return html
        .replace(/\{_key\}/g, key)
        .replace(/\{_path\}/g, `${collPath}.${key}`);
    }

    function reconcile() {
      const coll = store.get(collPath) || {};
      const keys = Object.keys(coll).filter(k => coll[k] != null);
      const keyStr = keys.join(',');

      // Fast bail: same keys, no structural change
      if (keyStr === lastKeyStr) return;
      lastKeyStr = keyStr;

      const keySet = new Set(keys);

      // Remove deleted items
      for (const [k, el] of rendered) {
        if (!keySet.has(k)) {
          cleanupWithin(el);
          el.remove();
          rendered.delete(k);
        }
      }

      // Add new items
      for (const k of keys) {
        if (!rendered.has(k)) {
          const html = resolve(templateHTML, k);
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          const el = tmp.firstElementChild;
          if (!el) continue;
          el.dataset.key = k;
          container.appendChild(el);
          rendered.set(k, el);
          scanBindings(el);
        }
      }
    }

    // Subscribe: exact (for delete/replace) + wildcard (for child add)
    const u1 = store.subscribe(collPath, reconcile);
    const u2 = store.subscribe(`${collPath}.*`, reconcile);
    subs.push({ node: container, unsub: u1 });
    subs.push({ node: container, unsub: u2 });

    reconcile();
  }

  // -- Init --

  root.querySelectorAll('[each]').forEach(setupCollection);
  scanBindings(root);

  // Return cleanup function
  return () => subs.forEach(s => s.unsub());
}
