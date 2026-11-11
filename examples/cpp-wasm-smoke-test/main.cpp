// Minimal C++ WebAssembly lifecycle smoke test for Sonic Mania Web.
// This intentionally has no access to Sonic Mania or its internal state.
#if defined(__clang__)
#define HEDGE_IMPORT(module_name, function_name) \
  __attribute__((import_module(module_name), import_name(function_name)))
#else
#define HEDGE_IMPORT(module_name, function_name)
#endif

static int didLogFirstUpdate = 0;

extern "C" HEDGE_IMPORT("env", "hedge_log") void hedge_log(int code);

extern "C" __attribute__((visibility("default"))) void mod_init() {
  didLogFirstUpdate = 0;
  hedge_log(1); // init reached
}

extern "C" __attribute__((visibility("default"))) void mod_update(float delta_ms) {
  (void)delta_ms; // Browser animation-frame delta, not the game simulation tick.
  if (!didLogFirstUpdate) {
    didLogFirstUpdate = 1;
    hedge_log(3); // first update reached
  }
}

extern "C" __attribute__((visibility("default"))) void mod_shutdown() {
  hedge_log(2); // shutdown reached
}
