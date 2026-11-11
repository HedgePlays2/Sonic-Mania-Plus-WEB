import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cases = [
  {
    name: 'C++ WebAssembly lifecycle smoke test',
    path: 'examples/cpp-wasm-smoke-test/cpp-wasm-smoke-test.wasm',
    expectedImports: ['env.hedge_log'],
    expectedEvents: ['log:1', 'log:3', 'log:2'],
    host: events => ({
      hedge_log: code => events.push(`log:${code}`)
    })
  },
  {
    name: 'Super Speed Indicator',
    path: 'examples/super-speed-indicator/super-speed-indicator.wasm',
    expectedImports: ['env.hedge_log', 'env.hedge_set_mod_badge'],
    expectedEvents: ['badge:1', 'log:1001', 'log:1003', 'badge:0', 'log:1002'],
    host: events => ({
      hedge_log: code => events.push(`log:${code}`),
      hedge_set_mod_badge: enabled => events.push(`badge:${enabled}`)
    })
  }
];

for (const test of cases) {
  const bytes = readFileSync(resolve(root, test.path));
  const module = new WebAssembly.Module(bytes);
  const imports = WebAssembly.Module.imports(module)
    .map(item => `${item.module}.${item.name}`)
    .sort();
  const exports = WebAssembly.Module.exports(module);
  const functions = new Set(exports.filter(item => item.kind === 'function').map(item => item.name));

  assert.deepEqual(imports, [...test.expectedImports].sort(), `${test.name}: unexpected imports`);
  for (const name of ['mod_init', 'mod_update', 'mod_shutdown']) {
    assert.ok(functions.has(name), `${test.name}: missing ${name} export`);
  }

  const events = [];
  const instance = new WebAssembly.Instance(module, { env: test.host(events) });
  instance.exports.mod_init();
  instance.exports.mod_update(16.67);
  instance.exports.mod_update(16.67);
  instance.exports.mod_shutdown();

  assert.deepEqual(events, test.expectedEvents, `${test.name}: lifecycle order mismatch`);
  console.log(`PASS ${test.name} (${bytes.byteLength} bytes)`);
  console.log(`  imports: ${imports.join(', ')}`);
  console.log('  lifecycle: mod_init -> mod_update -> mod_shutdown');
}
