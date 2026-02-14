/**
 * @uistate/renderer — self-test
 *
 * Standalone test of pure functions. No dependencies beyond renderer.js.
 * Runs on `node self-test.js` or as a postinstall hook.
 */

import {
  parseSetExpr,
  evalExpr,
  parsePush
} from './renderer.js';

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// ── parseSetExpr ────────────────────────────────────────────────────

const p1 = parseSetExpr('count:increment');
assert('parseSetExpr: path', p1.path === 'count');
assert('parseSetExpr: expr', p1.expr === 'increment');

const p2 = parseSetExpr('count');
assert('parseSetExpr: path only', p2.path === 'count');
assert('parseSetExpr: no expr → null', p2.expr === null);

const p3 = parseSetExpr('user.name:Bob');
assert('parseSetExpr: dotted path', p3.path === 'user.name');
assert('parseSetExpr: string expr', p3.expr === 'Bob');

const p4 = parseSetExpr('count:0');
assert('parseSetExpr: zero expr', p4.expr === '0');

const p5 = parseSetExpr('todos:push');
assert('parseSetExpr: push path', p5.path === 'todos');
assert('parseSetExpr: push expr', p5.expr === 'push');

const p6 = parseSetExpr('todos:push(draft)');
assert('parseSetExpr: push(source) path', p6.path === 'todos');
assert('parseSetExpr: push(source) expr', p6.expr === 'push(draft)');

const p7 = parseSetExpr('todos.t1:delete');
assert('parseSetExpr: delete path', p7.path === 'todos.t1');
assert('parseSetExpr: delete expr', p7.expr === 'delete');

const p8 = parseSetExpr('todos.t1.editing:false');
assert('parseSetExpr: editing path', p8.path === 'todos.t1.editing');
assert('parseSetExpr: editing expr', p8.expr === 'false');

const p9 = parseSetExpr('  count : increment  ');
assert('parseSetExpr: trims whitespace path', p9.path === 'count');
assert('parseSetExpr: trims whitespace expr', p9.expr === 'increment');

// ── evalExpr ────────────────────────────────────────────────────────

assert('evalExpr: increment', evalExpr('increment', 5) === 6);
assert('evalExpr: increment from 0', evalExpr('increment', 0) === 1);
assert('evalExpr: increment from null', evalExpr('increment', null) === 1);
assert('evalExpr: decrement', evalExpr('decrement', 5) === 4);
assert('evalExpr: decrement from 0', evalExpr('decrement', 0) === -1);
assert('evalExpr: toggle true→false', evalExpr('toggle', true) === false);
assert('evalExpr: toggle false→true', evalExpr('toggle', false) === true);
assert('evalExpr: number 42', evalExpr('42', 0) === 42);
assert('evalExpr: number 0', evalExpr('0', 99) === 0);
assert('evalExpr: negative number', evalExpr('-5', 0) === -5);
assert('evalExpr: boolean true', evalExpr('true', 0) === true);
assert('evalExpr: boolean false', evalExpr('false', 1) === false);
assert('evalExpr: null keyword', evalExpr('null', 'x') === null);
assert('evalExpr: plain string', evalExpr('hello', '') === 'hello');
assert('evalExpr: null expr → returns current', evalExpr(null, 7) === 7);
assert('evalExpr: undefined expr → returns current', evalExpr(undefined, 7) === 7);

// ── parsePush ───────────────────────────────────────────────────────

const pp1 = parsePush('push');
assert('parsePush: bare push → source null', pp1 !== null && pp1.source === null);

const pp2 = parsePush('push(draft)');
assert('parsePush: push(draft) → source "draft"', pp2 !== null && pp2.source === 'draft');

const pp3 = parsePush('push(form.data)');
assert('parsePush: push(form.data) → source "form.data"', pp3 !== null && pp3.source === 'form.data');

assert('parsePush: non-push returns null', parsePush('increment') === null);
assert('parsePush: null returns null', parsePush(null) === null);
assert('parsePush: empty string returns null', parsePush('') === null);

// ── Results ─────────────────────────────────────────────────────────

console.log(`\n@uistate/renderer v1.0.0 — self-test`);
console.log(`✓ ${passed} assertions passed${failed ? `, ✗ ${failed} failed` : ''}\n`);

if (failed > 0) process.exit(1);
