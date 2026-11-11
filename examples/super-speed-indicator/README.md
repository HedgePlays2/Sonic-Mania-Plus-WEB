# Super Speed Indicator

A visible C++ WebAssembly demo for Sonic Mania Web. When enabled, it displays a pulsing `SUPER SPEED MOD • LOADED` badge in the browser page.

**It does not increase Sonic's actual movement speed.** The current engine build has no exported player-physics API for this separate WebAssembly module to call.

## Install

Use the ready-to-import `Super-Speed-Mod.zip` in this folder:

1. Open Sonic Mania Web and choose **Mods**.
2. Import `Super-Speed-Mod.zip`.
3. Enable **Super Speed Mod**.
4. Reload the page so enabled mods start during game startup.

The browser console should show log code `1001` on init, `1003` on the first animation-frame update, and `1002` on shutdown. The badge is removed by `mod_shutdown()` when the page is hidden or unloaded.

## Rebuild

From the repository root, run `bash examples/build-wasm-examples.sh`. The script rebuilds this module and regenerates the ZIP from `mod.json` plus the `.wasm` file.
