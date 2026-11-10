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

The runtime rejects modules that import other host functions. This keeps the first proof-of-concept narrow; it is not a security boundary against untrusted modules. A badly behaved module can still freeze the page, so only install modules you trust. A WebAssembly module can compile and run successfully without being able to change anything inside Sonic Mania.

For the first test, build a tiny freestanding WebAssembly module that exports the three lifecycle functions and imports only `env.hedge_log`. The C++ source should use `extern "C"` so the export names are not C++-mangled. The exact Emscripten linker flags still need to be validated against a real build before we publish a copy-paste compiler command.

### Current limitations

- The module loader is a proof-of-concept runtime only; it does not make existing native GameAPI mods compatible.
- No C++ module can currently call Sonic Mania functions or replace checkpoint sprites through this ABI.
- `mod_update` is driven by `requestAnimationFrame`, not an engine tick, and should only be used for harmless runtime tests for now.
- The checkpoint asset override path remains separately unverified.
