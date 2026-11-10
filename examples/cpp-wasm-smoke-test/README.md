# C++ WebAssembly smoke test

This tiny example verifies the experimental browser-side C++ WebAssembly module runtime.

## Build

A minimal freestanding build can be made with Clang and wasm-ld (no Emscripten JavaScript glue is needed for this tiny test):

```sh
clang++ --target=wasm32-unknown-unknown -O2 -nostdlib -fno-exceptions -fno-rtti \
  -Wl,--no-entry \
  -Wl,--export=mod_init \
  -Wl,--export=mod_update \
  -Wl,--export=mod_shutdown \
  -Wl,--allow-undefined \
  -o cpp-wasm-smoke-test.wasm main.cpp
```

The resulting module should import only `env.hedge_log` and export `mod_init`, `mod_update`, and `mod_shutdown`. The runtime requires `mod_init`; the other two exports are optional.

## Package

Put `mod.json` and the compiled `cpp-wasm-smoke-test.wasm` together at the root of a ZIP archive, then import it from the game's Mods panel. Enable it and restart the game. Open the browser developer console and look for:

- `[C++ Mod: C++ WebAssembly Smoke Test] log code 1` when it starts
- `[C++ Mod: C++ WebAssembly Smoke Test] log code 2` when the page is hidden/unloaded

This only proves that C++-compiled WebAssembly can load and run. It does not yet modify Sonic Mania or provide native GameAPI compatibility.
