# HedgeModAPI engine probe

This experiment is intentionally isolated from the production game page.

- Production branch: `main` (unchanged).
- Existing browser engine, HTML, ZIP importer, IndexedDB, and mod UI: untouched.
- Build input: pinned `wasm-gaming/rsdkv5-wasm` recipe at
  `0f65d029a2d111bd06c555b43694a298c7225086`.
- Toolchain: `emscripten/emsdk:6.0.2`.
- Output: a short-lived GitHub Actions artifact, never deployed to GitHub Pages.

## Why this probe exists

The upstream RSDKv5 CMake project does not currently define an Emscripten
platform. The pinned community recipe supplies the Emscripten platform setup,
engine patches, and a reproducible build of the Sonic Mania decompilation
statically linked into RSDKv5U. This gives us a known browser-targeted source
build to experiment against without replacing the engine currently used by
this project.

The first workflow run only verifies that the baseline Mania/RSDKv5U module can
be rebuilt and that its WebAssembly binary validates. It deliberately expects
no HedgeModAPI exports yet.

## Player data confirmed in source

Sonic Mania's `EntityPlayer` extends the RSDK `Entity` structure. The base
entity contains `position`, `velocity`, `groundVel`, and `onGround`.
The Mania player structure adds `playerID`, `characterID`, and movement
parameters such as `topSpeed`, `acceleration`, and `deceleration`.

These are source-level fields, not stable byte offsets. HedgeModAPI must never
read them by guessing offsets in the production engine's linear memory.

## Proposed first bridge (read-only)

The next source patch should add a small C ABI wrapper in the engine/game build:

```c
#define HEDGE_MODAPI_ABI_VERSION 1

typedef struct HedgePlayerStateV1 {
    unsigned int struct_size;
    int player_id;
    int character_id;
    int x_16_16;
    int y_16_16;
    int velocity_x_16_16;
    int velocity_y_16_16;
    int ground_speed_16_16;
    int on_ground;
} HedgePlayerStateV1;

int hedge_modapi_get_version(void);
int hedge_modapi_get_player_state(int player_index, HedgePlayerStateV1 *out_state);
```

The wrapper must locate a currently active player using the engine's own entity
iteration APIs, validate the requested index, and copy values into the
versioned output struct. It must not expose raw pointers or internal object
addresses. Position and velocity use the engine's 16.16 fixed-point values.

The engine build would then explicitly export the two wrapper functions.
The browser mod host can expose a narrow import to C++ mods, translating the
versioned struct into a safe JavaScript object. Start with read-only state;
only consider speed-changing writes after update timing, ownership, and
shutdown behavior are verified.

## Important limitation

This artifact is a separate experimental engine build. It is not wired into
the current page and does not prove gameplay hooks work. The existing engine
build does not expose named player-state functions, so the current C++ mods
cannot yet inspect or change Sonic's physics through the production runtime.

## Next steps

1. Run this workflow and confirm the isolated source build completes.
2. Add the read-only C ABI wrapper to the pinned source build and export it.
3. Add an automated C++/JavaScript bridge test using a mock player state.
4. Only after that, test the wrapper in a separate browser harness with legally
   obtained game data. Do not swap the production engine as part of this probe.
