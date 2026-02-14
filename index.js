/**
 * @uistate/renderer - Direct-binding reactive renderer for @uistate/core
 *
 * Bind DOM nodes to store paths with bind-* attributes and set actions.
 * Zero build step. Licensed under a proprietary license — see LICENSE.md.
 */

export {
  parseSetExpr,
  evalExpr,
  parsePush,
  mount
} from './renderer.js';
