# Sonic Mania Web Mod Loader

The web port now includes an experimental browser-side mod manager. Open the **Mods** button in the game controls to import ZIPs, enable/disable mods, or remove them.

## ZIP format

Each mod is a ZIP containing a `mod.json` at its root. Game asset replacements go inside `assets/`; the folder path after `assets/` is copied into the game's virtual filesystem.

```text
MyMod.zip
├── mod.json
├── assets/
│   └── Data/
│       └── Sprites/
│           └── Example.bin
└── scripts/
    └── main.js
```

Example `mod.json`:

```json
{
  "id": "my-first-mod",
  "name": "My First Mod",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A small example mod.",
  "type": "asset",
  "scripts": []
}
```

For a browser-logic mod, set `"type": "logic"` and list JavaScript files in `scripts`:

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
  if (input.code === "F8") {
    console.log("F8 pressed");
  }
});
```

The logic script receives an `api` object with:
- `api.on(eventName, callback)` — listen for `gameReady`, `keydown`, and `keyup`.
- `api.emit(eventName, detail)` — send a custom event.
- `api.getCanvas()` — access the game canvas.
- `api.getGameModule()` — access the Emscripten Module object.
- `api.readFile(path)` / `api.writeFile(path, bytes)` — access files in the virtual filesystem.

## Compatibility status

- **ZIP import and browser storage:** implemented.
- **Browser JavaScript logic extensions:** implemented as a small web-specific API. These are not the same as native RSDK logic mods.
- **Asset replacement:** the loader stages files into Emscripten's virtual filesystem after `Data.rsdk` is present. Whether a particular loose-file replacement takes effect depends on how the current upstream RSDK runtime resolves that asset. This needs in-game testing.
- **Native RSDK mod-loader packages, compiled scripts, and Windows DLL mods:** not yet supported. The current deployed `RSDKv5U.js` / WebAssembly runtime has not been rebuilt with the RSDK mod-loader feature enabled. Full native RSDK mod compatibility requires a mod-loader-enabled WebAssembly engine build.

Mods are stored locally in this browser using IndexedDB. Imported JavaScript logic mods execute code in the game page, so only install ZIPs from creators you trust.
