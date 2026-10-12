import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
const css = await read('index.css');
const layer = name => Number(css.match(new RegExp(`--z-${name}:\\s*(\\d+)`))?.[1]);
assert.ok(layer('menu') > layer('dialog'), 'Modal child menus must be above dialog content');
assert.ok(layer('tooltip') > layer('menu'), 'Tooltips must be above menu content');
assert.ok(layer('toast') > layer('dialog'), 'Error notification must not be hidden by a modal');
for (const [file, token] of [
  ['shared/ui/Dialog.tsx', '--z-dialog'],
  ['shared/ui/DropdownMenu.tsx', '--z-menu'],
  ['shared/ui/Tooltip.tsx', '--z-tooltip'],
  ['shared/ui/AppToaster.tsx', '--z-toast'],
]) assert.ok((await read(file)).includes(token), `${file} must consume the shared layer scale`);
console.log(JSON.stringify({ passed: 7, boundary: 'Layer token ordering and shared primitive consumers; not a focus-trap test' }));
