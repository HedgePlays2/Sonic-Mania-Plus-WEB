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
