# @uistate/renderer

Direct-binding reactive renderer for [@uistate/core](https://www.npmjs.com/package/@uistate/core). Bind DOM nodes to store paths with `bind-*` attributes and `set` actions. Zero build step. ~270 lines.

## Install

```bash
npm install @uistate/renderer
```

Peer dependency: `@uistate/core >= 5.0.0`

## Quick Start

```html
<body>
  <h1>Count: <span bind-text="count"></span></h1>
  <button set="count:decrement">−</button>
  <button set="count:0">Reset</button>
  <button set="count:increment">+</button>

  <script type="module">
    import { createEventState } from '@uistate/core';
    import { mount } from '@uistate/renderer';

    const store = createEventState({ count: 0 });
    mount(store);
  </script>
</body>
```

A reactive counter. No React. No Babel. No bundler. No innerHTML. Just HTML attributes and two imports.

## Three Primitives

### 1. Delegated Actions (DOM -> Store)

Attach store writes to user events. Three delegated listeners on the root handle everything; they survive DOM mutations and never need re-wiring.

| Attribute | Event | Example |
|---|---|---|
| `set` | click | `<button set="count:increment">+</button>` |
| `set-blur` | focusout | `<input set-blur="item.editing:false">` |
| `set-enter` | keydown Enter | `<input set-enter="todos:push(draft)">` |

#### Set Expressions

| Syntax | Effect |
|---|---|
| `set="count:increment"` | `store.set('count', current + 1)` |
| `set="count:decrement"` | `store.set('count', current - 1)` |
| `set="count:0"` | `store.set('count', 0)` |
| `set="ui.dark:toggle"` | `store.set('ui.dark', !current)` |
| `set="user.name:Bob"` | `store.set('user.name', 'Bob')` |
| `set="todos:push(draft)"` | Clone `draft` into `todos`, reset `draft` |
| `set="todos.t1:delete"` | Remove `t1` from `todos` |
| `set="flag:true"` | `store.set('flag', true)` |
| `set="flag:false"` | `store.set('flag', false)` |
| `set="val:null"` | `store.set('val', null)` |

### 2. Direct Node Binding (Store -> DOM)

Bind store paths directly to DOM node properties. Each binding creates one EventState subscription and performs surgical updates; no re-rendering, no diffing.

| Attribute | What it does | Example |
|---|---|---|
| `bind-text` | Sets `textContent` | `<span bind-text="user.name"></span>` |
| `bind-value` | Two-way input binding | `<input bind-value="draft.text">` |
| `bind-focus` | Focus when truthy | `<input bind-focus="item.editing">` |
| `bind-data-*` | Sets `dataset.*` | `<div bind-data-done="item.done">` |
| `bind-attr-*` | Sets any attribute | `<img bind-attr-src="user.avatar">` |

**`bind-data-*` + CSS attribute selectors** replace conditional class logic:

```html
<div bind-data-done="todos.t1.done">...</div>
```

```css
[data-done="true"]  { text-decoration: line-through; opacity: 0.6; }
[data-done="false"] { text-decoration: none; }
```

No ternary operators. No `classnames()`. CSS does what CSS was designed to do.

### 3. Keyed Collections

Render dynamic lists with `each` + `<template>`. Reconciliation is key-based: only added/removed items touch the DOM.

```html
<div each="todos">
  <template>
    <div class="todo-item" bind-data-done="{_path}.done">
      <button set="{_path}.done:toggle">✓</button>
      <span bind-text="{_path}.text"></span>
      <small bind-text="{_key}"></small>
      <button set="{_path}:delete">×</button>
    </div>
  </template>
</div>
```

- `{_key}` — the object key (e.g., `t1`)
- `{_path}` — the full path (e.g., `todos.t1`)

Placeholders are resolved once when the item is created. All `bind-*` and `set` attributes work inside templates.

## API

### `mount(store, root?)`

Scans the DOM tree rooted at `root` (default: `document.body`) for `bind-*`, `set`, and `each` attributes. Sets up event delegation, bindings, and collections. Returns a cleanup function.

```js
import { mount } from '@uistate/renderer';

const cleanup = mount(store);
// Later: cleanup() to remove all subscriptions and listeners
```

### Pure Functions (testable in Node — no DOM required)

```js
import { parseSetExpr, evalExpr, parsePush } from '@uistate/renderer';

parseSetExpr('count:increment');
// -> { path: 'count', expr: 'increment' }

evalExpr('increment', 5);
// -> 6

parsePush('push(draft)');
// -> { source: 'draft' }
```

These are the same functions the renderer uses internally. Because they're pure, they run in Node with zero dependencies, enabling the self-test.

## Testing

Two test layers, both DOMless:

### `self-test.js` — Pure function tests (zero dependencies)

Tests the renderer's internal pure functions (`parseSetExpr`, `evalExpr`, `parsePush`) in Node. No store, no DOM, no test framework, no devDependencies. Runs automatically on `npm install` via the `postinstall` hook. **39 assertions, instant feedback.**

```bash
node self-test.js
```

### `tests/renderer.test.js` — Store integration tests

Tests full state workflows via `@uistate/event-test`: CRUD cycles, editing lifecycles, wildcard subscriptions, batch operations. Creates real EventState stores and exercises the same dot-path patterns the renderer drives — still without touching the DOM. **34 tests, all passing.**

```bash
npm test
```

The self-test is a direct consequence of the architecture: since the renderer's logic is split into pure functions and a DOM-mounting function (`mount`), the pure functions are testable without a DOM, without JSDOM, without any test framework.

## What's Not Here

- No virtual DOM
- No template interpolation engine
- No innerHTML in the render loop
- No diffing algorithm
- No component lifecycle
- No build step
- No JSX transform

HTML is the skeleton. The store is the brain. Bindings are the nerves.

## Philosophy

The renderer exists to prove that **the state layer is the real product**. The same `@uistate/core` store works with React, Vue, Svelte, Angular, or with this 268-line renderer that needs nothing but a browser.

```
A React Component (for comparison):     f(props, ownState, lifecycle, hooks, context, memo, refs) -> VDOM -> DOM
A UIstate Renderer (for comparison):     mount(store) -> bind-text="path" -> textContent
```

## Author

Ajdin Imsirovic

## License

Proprietary — see [LICENSE.md](./LICENSE.md)
