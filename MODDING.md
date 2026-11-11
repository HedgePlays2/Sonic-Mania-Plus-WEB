# Sonic Mania Web Mod Loader

Open the **Mods** button in the game controls to import a mod archive, enable/disable mods, or remove them. The importer accepts **ZIP and RAR** archives and looks for the standard Sonic Mania `mod.ini` file.

## Standard Sonic Mania mod archives

A typical data mod looks like this:

```text
ExampleMod.zip (or .rar)
└── ExampleMod/
    ├── mod.ini
    └── Data/
        └── Sprites/
            └── ...
```

The archive may also have `mod.ini` and `Data/` directly at its root. The importer reads these common metadata fields:

```ini
Name=Example Mod
Description=An example Sonic Mania mod
Author=Your Name
Version=1.0
TargetVersion=5
```

The `Data/` files are staged as loose-file overrides in the game's Emscripten virtual filesystem. Whether a particular replacement appears in-game depends on how this web build of RSDK resolves loose files, so test one mod at a time.

## Legacy web-logic mods

The earlier custom browser-logic format using `mod.json` is still accepted in ZIP archives. It is a web-specific extension format, not the standard Sonic Mania mod format. It can list JavaScript files under `scripts` and use the `SonicManiaModAPI`.

Example:

```json
{
  "id": "my-logic-mod",
  "name": "My Logic Mod",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Logs when the game is ready.",
  "type": "logic",
  "scripts": ["scripts/main.js"]
}
```

Example `scripts/main.js`:

```js
api.on("gameReady", function () {
  console.log("My mod is running!");
});

api.on("keydown", function (input) {
  if (input.code === "F8") console.log("F8 pressed");
});
```

## Compatibility status

- **ZIP import:** supported.
- **RAR import:** supported through a browser-side WebAssembly archive extractor; encrypted archives and unusual RAR variants may not work.
- **Standard `mod.ini` metadata:** read by the importer.
- **Data-only mod files:** staged as loose-file overrides, but still need testing against the current web runtime.
- **RSDK `LogicFile` mods and Steam `DLLFile` mods:** not executable in this web build. Reading their metadata does not make their compiled code compatible.
- **Full native RSDK mod loading:** not supported yet. The current upstream `RSDKv5U.js` / WebAssembly runtime has not been rebuilt with the native RSDK mod-loader feature.

Imported mods are stored locally in this browser using IndexedDB. Browser-logic mods execute JavaScript in the game page, so only install mods from creators you trust.


## Experimental C++ WebAssembly mods

The web mod manager now has an experimental raw WebAssembly module path. This is **not** native Sonic Mania GameAPI support and it does not load Windows/Steam DLLs. It also does not expose engine memory, RSDK objects, rendering hooks, or gameplay callbacks yet.

A WebAssembly mod is declared with `mod.json` and contains a compiled `.wasm` file:

```text
CheckpointStyleMod.zip
├── mod.json
└── checkpoint-style.wasm
```

Example `mod.json`:

```json
{
  "id": "checkpoint-style",
  "name": "Checkpoint Style Test",
  "version": "0.1.0",
  "author": "Your Name",
  "description": "Tests the experimental C++ WebAssembly runtime.",
  "type": "wasm",
  "wasm": "checkpoint-style.wasm"
}
```

The current experimental ABI is deliberately small:

- Required export: `mod_init()`
- Optional export: `mod_update(delta_ms)`, called from the browser animation frame loop (not the game's actual simulation tick)
- Optional export: `mod_shutdown()`, called when the page is being hidden/unloaded
- Available import: `env.hedge_log(int code)`, which writes a diagnostic message to the browser console
- Available import: `env.hedge_set_mod_badge(int enabled)`, which asks the browser host to show or hide a pulsing status badge for the calling mod

The runtime rejects modules that import other host functions. This keeps the first proof-of-concept narrow; it is not a security boundary against untrusted modules. A badly behaved module can still freeze the page, so only install modules you trust. A WebAssembly module can compile and run successfully without being able to change anything inside Sonic Mania.

Build the repository examples from the root with Clang and LLD:

```sh
bash examples/build-wasm-examples.sh
node examples/test-wasm-lifecycle.mjs
```

The build is freestanding and does not need Emscripten JavaScript glue. The tested compiler shape is:

```sh
clang++ --target=wasm32-unknown-unknown -std=c++17 -O2 -nostdlib \
  -fno-exceptions -fno-rtti -Wl,--no-entry \
  -Wl,--export=mod_init -Wl,--export=mod_update \
  -Wl,--export=mod_shutdown -Wl,--strip-all \
  -o my-mod.wasm my_mod.cpp
```

The Node test checks the module imports, all three lifecycle exports, and the expected host-call order. It verifies the module ABI independently of the full browser/game startup.

### Current limitations

- The module loader is a proof-of-concept runtime only; it does not make existing native GameAPI mods compatible.
- `mod_update` is driven by browser `requestAnimationFrame`, not an engine tick.
- The browser badge host call is implemented, but still needs a live GitHub Pages/game-browser test.
- Data-only asset overrides are staged into the virtual filesystem, but individual in-game replacements still need testing.

### C++ WebAssembly examples

- `examples/cpp-wasm-smoke-test/` is the minimal lifecycle test. It logs code `1` from `mod_init`, `3` on its first `mod_update`, and `2` from `mod_shutdown`.
- `examples/super-speed-indicator/` displays a pulsing `SUPER SPEED MOD • LOADED` badge. It logs `1001` on init, `1003` on its first update, and `1002` on shutdown. The ready-to-import archive is `examples/super-speed-indicator/Super-Speed-Mod.zip`.

The Super Speed example is a visible proof that a C++ module can call a deliberately exposed browser-host function. It does **not** change Sonic's actual movement speed.


## Current engine boundary and future HedgeModAPI

The page keeps the existing prebuilt `RSDKv5U.js` / `RSDKv5U.wasm` engine. Its current generated JavaScript glue exposes Emscripten runtime facilities such as `Module.FS`, `Module.cwrap`, and run-dependency helpers, but it does not publish Sonic Mania player objects or GameAPI callbacks to the page. `cwrap` can call only symbols exported by the engine build; it cannot make hidden engine functions appear.

Each C++ mod is instantiated separately with only the two `env` imports listed above. It does not import the engine's WebAssembly memory or function table. It therefore cannot safely read or write `EntityPlayer`, call RSDK object functions, or change player physics today.

Safe hooks available now are limited to browser-level `keydown` / `keyup` events, the web mod manager's `gameReady` event, file staging through the existing Emscripten `Module.preRun` path, browser UI/logging calls, and the animation-frame callback for harmless mod-side work.

A real gameplay-facing **HedgeModAPI** needs an engine-side bridge. The next route is to rebuild or port the engine/game source for WebAssembly and add a small, versioned C ABI inside that build. Start with read-only player snapshots and engine-originated events, then consider narrowly validated setters. Use stable entity handles and fixed-width values rather than raw pointers or hard-coded memory offsets. Candidate engine events include `Update`, `LateUpdate`, `StaticUpdate`, `Draw`, `Create`, and `StageLoad`.

This is distinct from the native RSDK decompilation's GameAPI/ModAPI system. Its documented logic-file mods and engine events are not automatically available to this separate browser module:

- [RSDKv5 GameAPI](https://rsdkmodding.com/RSDKv5/GameAPI/)
- [RSDKv5 mod loader and LogicFile format](https://rsdkmodding.com/RSDKv5/Decompilation/ModLoader/)
- [RSDKv5 build guide](https://rsdkmodding.com/Guides/RSDKv5/Decompilation/Building/)
- [Emscripten Module object and lifecycle hooks](https://emscripten.org/docs/api_reference/module.html)
