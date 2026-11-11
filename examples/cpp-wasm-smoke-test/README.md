# C++ WebAssembly lifecycle smoke test

This is the smallest C++ mod example for the browser-side WebAssembly runtime. It imports only `env.hedge_log` and exports all three lifecycle functions:

- `mod_init()` logs code `1`.
- `mod_update(float delta_ms)` logs code `3` once, on its first browser animation-frame update.
- `mod_shutdown()` logs code `2`.

The update callback receives a browser `requestAnimationFrame` delta in milliseconds. It is **not** the Sonic Mania simulation tick.

## Build and test

From the repository root, run:

```sh
bash examples/build-wasm-examples.sh
node examples/test-wasm-lifecycle.mjs
```

The build uses Clang/LLD directly; Emscripten is not needed for this freestanding example. The checked-in `.wasm` is the ready-built output.

## Package

Put `mod.json` and `cpp-wasm-smoke-test.wasm` at the root of a ZIP archive, import it in the game's Mods panel, enable it, and reload the page. Open the browser console and look for:

- `[C++ Mod: C++ WebAssembly Smoke Test] log code 1` on startup
- `[C++ Mod: C++ WebAssembly Smoke Test] log code 3` after the first animation frame
- `[C++ Mod: C++ WebAssembly Smoke Test] log code 2` when the page is hidden or unloaded

This proves module compilation, instantiation, and lifecycle calls independently of game internals. It does not modify Sonic Mania gameplay and does not provide native GameAPI or Steam DLL compatibility.
