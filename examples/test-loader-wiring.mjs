import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loader = readFileSync(resolve(root, 'mod-loader.js'), 'utf8');
const checks = [
  ['instantiates separate WebAssembly modules', /WebAssembly\.instantiate\(compiled, imports\)/],
  ['requires mod_init', /available\.mod_init !== \"function\"/],
  ['validates optional mod_update export type', /available\.mod_update !== undefined && available\.mod_update !== \"function\"/],
  ['validates optional mod_shutdown export type', /available\.mod_shutdown !== undefined && available\.mod_shutdown !== \"function\"/],
  ['calls mod_init', /instance\.exports\.mod_init\(\)/],
  ['calls mod_update from the browser frame loop', /item\.exports\.mod_update\(delta\)/],
  ['calls mod_shutdown on pagehide', /window\.addEventListener\("pagehide", stopWasmMods\)/],
  ['uses requestAnimationFrame for mod_update', /window\.requestAnimationFrame\(tick\)/],
  ['limits host imports to the documented functions', /item\.name !== "hedge_log" && item\.name !== "hedge_set_mod_badge"/]
];

for (const [label, pattern] of checks) {
  assert.match(loader, pattern, `mod-loader.js: missing ${label}`);
  console.log(`PASS loader wiring: ${label}`);
}
