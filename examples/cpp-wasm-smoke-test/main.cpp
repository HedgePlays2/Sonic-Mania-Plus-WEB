// Minimal proof-of-concept C++ WebAssembly mod.
// The browser runtime currently provides only hedge_log; this does NOT hook into Sonic Mania.
#if defined(__clang__)
#define HEDGE_IMPORT(module_name, function_name) \
  __attribute__((import_module(module_name), import_name(function_name)))
#else
#define HEDGE_IMPORT(module_name, function_name)
#endif

extern "C" HEDGE_IMPORT("env", "hedge_log") void hedge_log(int code);

extern "C" __attribute__((visibility("default"))) void mod_init() {
  hedge_log(1); // Check the browser console for "[C++ Mod: ...] log code 1".
}

extern "C" __attribute__((visibility("default"))) void mod_update(float delta_ms) {
  (void)delta_ms; // Called by requestAnimationFrame, not the Sonic Mania game tick.
}

extern "C" __attribute__((visibility("default"))) void mod_shutdown() {
  hedge_log(2);
}
