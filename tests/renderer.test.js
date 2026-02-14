/**
 * @uistate/renderer — eventTest-based tests
 *
 * Tests pure functions AND store integration using @uistate/event-test.
 * Requires node_modules symlinks to @uistate/core and @uistate/event-test.
 */

import { createEventTest, runTests } from '@uistate/event-test';
import {
  parseSetExpr,
  evalExpr,
  parsePush
} from '../renderer.js';

const results = runTests({

  // parseSetExpr

  'parseSetExpr: path and expr': () => {
    const { path, expr } = parseSetExpr('count:increment');
    if (path !== 'count') throw new Error(`path: expected 'count', got '${path}'`);
    if (expr !== 'increment') throw new Error(`expr: expected 'increment', got '${expr}'`);
  },

  'parseSetExpr: path only (no colon)': () => {
    const { path, expr } = parseSetExpr('count');
    if (path !== 'count') throw new Error(`path: expected 'count', got '${path}'`);
    if (expr !== null) throw new Error(`expr: expected null, got '${expr}'`);
  },

  'parseSetExpr: dotted path': () => {
    const { path, expr } = parseSetExpr('user.name:Bob');
    if (path !== 'user.name') throw new Error(`path: expected 'user.name', got '${path}'`);
    if (expr !== 'Bob') throw new Error(`expr: expected 'Bob', got '${expr}'`);
  },

  'parseSetExpr: delete keyword': () => {
    const { path, expr } = parseSetExpr('todos.t1:delete');
    if (path !== 'todos.t1') throw new Error(`path: '${path}'`);
    if (expr !== 'delete') throw new Error(`expr: '${expr}'`);
  },

  'parseSetExpr: push keyword': () => {
    const { path, expr } = parseSetExpr('todos:push');
    if (path !== 'todos') throw new Error(`path: '${path}'`);
    if (expr !== 'push') throw new Error(`expr: '${expr}'`);
  },

  'parseSetExpr: push(source) keyword': () => {
    const { path, expr } = parseSetExpr('todos:push(draft)');
    if (path !== 'todos') throw new Error(`path: '${path}'`);
    if (expr !== 'push(draft)') throw new Error(`expr: '${expr}'`);
  },

  'parseSetExpr: whitespace trimmed': () => {
    const { path, expr } = parseSetExpr('  count : increment  ');
    if (path !== 'count') throw new Error(`path: '${path}'`);
    if (expr !== 'increment') throw new Error(`expr: '${expr}'`);
  },

  // evalExpr

  'evalExpr: increment': () => {
    const r = evalExpr('increment', 5);
    if (r !== 6) throw new Error(`Expected 6, got ${r}`);
  },

  'evalExpr: decrement': () => {
    const r = evalExpr('decrement', 5);
    if (r !== 4) throw new Error(`Expected 4, got ${r}`);
  },

  'evalExpr: toggle true→false': () => {
    const r = evalExpr('toggle', true);
    if (r !== false) throw new Error(`Expected false, got ${r}`);
  },

  'evalExpr: toggle false→true': () => {
    const r = evalExpr('toggle', false);
    if (r !== true) throw new Error(`Expected true, got ${r}`);
  },

  'evalExpr: static number': () => {
    const r = evalExpr('42', 0);
    if (r !== 42) throw new Error(`Expected 42, got ${r}`);
  },

  'evalExpr: static zero': () => {
    const r = evalExpr('0', 99);
    if (r !== 0) throw new Error(`Expected 0, got ${r}`);
  },

  'evalExpr: boolean true': () => {
    const r = evalExpr('true', 0);
    if (r !== true) throw new Error(`Expected true, got ${r}`);
  },

  'evalExpr: boolean false': () => {
    const r = evalExpr('false', 1);
    if (r !== false) throw new Error(`Expected false, got ${r}`);
  },

  'evalExpr: null keyword': () => {
    const r = evalExpr('null', 'x');
    if (r !== null) throw new Error(`Expected null, got ${r}`);
  },

  'evalExpr: plain string passthrough': () => {
    const r = evalExpr('hello', '');
    if (r !== 'hello') throw new Error(`Expected 'hello', got '${r}'`);
  },

  'evalExpr: null expr returns current': () => {
    const r = evalExpr(null, 7);
    if (r !== 7) throw new Error(`Expected 7, got ${r}`);
  },

  // parsePush

  'parsePush: bare push → source null': () => {
    const r = parsePush('push');
    if (!r || r.source !== null) throw new Error(`Expected { source: null }, got ${JSON.stringify(r)}`);
  },

  'parsePush: push(draft) → source "draft"': () => {
    const r = parsePush('push(draft)');
    if (!r || r.source !== 'draft') throw new Error(`Expected { source: 'draft' }, got ${JSON.stringify(r)}`);
  },

  'parsePush: push(form.data) → dotted source': () => {
    const r = parsePush('push(form.data)');
    if (!r || r.source !== 'form.data') throw new Error(`Expected { source: 'form.data' }, got ${JSON.stringify(r)}`);
  },

  'parsePush: non-push returns null': () => {
    const r = parsePush('toggle');
    if (r !== null) throw new Error(`Expected null, got ${JSON.stringify(r)}`);
  },

  'parsePush: null returns null': () => {
    const r = parsePush(null);
    if (r !== null) throw new Error(`Expected null, got ${JSON.stringify(r)}`);
  },

  // Store integration via eventTest

  'integration: evalExpr increment with store value': () => {
    const t = createEventTest({ count: 10 });
    const current = t.store.get('count');
    const next = evalExpr('increment', current);
    if (next !== 11) throw new Error(`Expected 11, got ${next}`);

    t.trigger('count', next);
    t.assertPath('count', 11);
  },

  'integration: evalExpr toggle with store value': () => {
    const t = createEventTest({ ui: { darkMode: false } });
    t.assertPath('ui.darkMode', false);

    const toggled = evalExpr('toggle', t.store.get('ui.darkMode'));
    t.trigger('ui.darkMode', toggled);
    t.assertPath('ui.darkMode', true);
  },

  'integration: push clones source into target and resets source': () => {
    const t = createEventTest({
      draft: { text: 'New todo', done: false },
      todos: {}
    });

    const sourceData = t.store.get('draft');
    const key = 'test_key';
    const clone = JSON.parse(JSON.stringify(sourceData));

    t.store.batch(() => {
      t.store.set(`todos.${key}`, clone);
      t.store.set('draft.text', '');
      t.store.set('draft.done', false);
    });

    t.assertPath(`todos.${key}.text`, 'New todo');
    t.assertPath(`todos.${key}.done`, false);
    t.assertPath('draft.text', '');
    t.assertPath('draft.done', false);
  },

  'integration: subscribe fires on wildcard': () => {
    const t = createEventTest({ user: { name: 'Alice', age: 30 } });
    let fireCount = 0;

    t.store.subscribe('user.*', () => { fireCount++; });
    t.trigger('user.name', 'Bob');
    t.assertPath('user.name', 'Bob');

    if (fireCount !== 1) {
      throw new Error(`Expected 1 fire, got ${fireCount}`);
    }
  },

  // Inline editing: editing flag lifecycle

  'integration: editing flag defaults to false': () => {
    const t = createEventTest({
      todos: { t1: { text: 'Buy milk', done: false, editing: false } }
    });
    t.assertPath('todos.t1.editing', false);
  },

  'integration: set editing to true (enter edit mode)': () => {
    const t = createEventTest({
      todos: { t1: { text: 'Buy milk', done: false, editing: false } }
    });
    t.trigger('todos.t1.editing', true);
    t.assertPath('todos.t1.editing', true);
    t.assertPath('todos.t1.text', 'Buy milk');
  },

  'integration: edit text then exit editing': () => {
    const t = createEventTest({
      todos: { t1: { text: 'Buy milk', done: false, editing: false } }
    });
    t.trigger('todos.t1.editing', true);
    t.trigger('todos.t1.text', 'Buy almond milk');
    t.assertPath('todos.t1.text', 'Buy almond milk');
    t.trigger('todos.t1.editing', false);
    t.assertPath('todos.t1.editing', false);
    t.assertPath('todos.t1.text', 'Buy almond milk');
  },

  // Two-way binding simulation

  'integration: rapid store.set on draft.text preserves value': () => {
    const t = createEventTest({
      draft: { text: '', done: false, editing: false }
    });
    t.trigger('draft.text', 'B');
    t.assertPath('draft.text', 'B');
    t.trigger('draft.text', 'Bu');
    t.assertPath('draft.text', 'Bu');
    t.trigger('draft.text', 'Buy');
    t.assertPath('draft.text', 'Buy');
    t.trigger('draft.text', 'Buy ');
    t.trigger('draft.text', 'Buy m');
    t.trigger('draft.text', 'Buy mi');
    t.trigger('draft.text', 'Buy mil');
    t.trigger('draft.text', 'Buy milk');
    t.assertPath('draft.text', 'Buy milk');
  },

  'integration: push resets draft including editing field': () => {
    const t = createEventTest({
      draft: { text: 'New todo', done: false, editing: false },
      todos: {}
    });

    const sourceData = t.store.get('draft');
    const key = 'test_key';
    const clone = JSON.parse(JSON.stringify(sourceData));

    t.store.batch(() => {
      t.store.set(`todos.${key}`, clone);
      t.store.set('draft.text', '');
      t.store.set('draft.done', false);
      t.store.set('draft.editing', false);
    });

    t.assertPath(`todos.${key}.text`, 'New todo');
    t.assertPath(`todos.${key}.done`, false);
    t.assertPath(`todos.${key}.editing`, false);
    t.assertPath('draft.text', '');
    t.assertPath('draft.done', false);
    t.assertPath('draft.editing', false);
  },

  // Full CRUD cycle via dot-paths

  'integration: full CRUD cycle': () => {
    const t = createEventTest({
      draft: { text: '', done: false, editing: false },
      todos: {
        t1: { text: 'Original', done: false, editing: false }
      }
    });

    // CREATE
    t.trigger('draft.text', 'New item');
    const key = 'new1';
    const clone = JSON.parse(JSON.stringify(t.store.get('draft')));
    t.store.batch(() => {
      t.store.set(`todos.${key}`, clone);
      t.store.set('draft.text', '');
      t.store.set('draft.done', false);
      t.store.set('draft.editing', false);
    });
    t.assertPath(`todos.${key}.text`, 'New item');

    // READ
    t.assertPath('todos.t1.text', 'Original');
    t.assertPath(`todos.${key}.text`, 'New item');

    // UPDATE
    t.trigger('todos.t1.editing', true);
    t.trigger('todos.t1.text', 'Updated');
    t.trigger('todos.t1.editing', false);
    t.assertPath('todos.t1.text', 'Updated');

    // TOGGLE
    t.trigger('todos.t1.done', true);
    t.assertPath('todos.t1.done', true);

    // DELETE
    const todos = t.store.get('todos');
    const updated = {};
    for (const k of Object.keys(todos)) {
      if (k !== 't1') updated[k] = todos[k];
    }
    t.store.set('todos', updated);
    t.assertPath(`todos.${key}.text`, 'New item');
    if (t.store.get('todos.t1') != null) {
      throw new Error('t1 should be deleted');
    }
  },

  // Boolean status toggle

  'integration: boolean status toggle': () => {
    const t = createEventTest({ user: { name: 'Alice', online: true } });
    t.assertPath('user.online', true);
    t.trigger('user.online', !t.store.get('user.online'));
    t.assertPath('user.online', false);
    t.trigger('user.online', !t.store.get('user.online'));
    t.assertPath('user.online', true);
  }
});

process.exit(results.failed > 0 ? 1 : 0);
