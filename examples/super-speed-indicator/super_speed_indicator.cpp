// Super Speed Indicator — experimental Sonic Mania Web C++ mod.
// Demonstrates a real C++ -> WebAssembly -> browser HUD host call.
// It does not alter Sonic's movement speed yet.

extern "C" {
__attribute__((import_module("env"), import_name("hedge_set_mod_badge")))
void hedge_set_mod_badge(int enabled);

__attribute__((import_module("env"), import_name("hedge_log")))
void hedge_log(int code);

__attribute__((export_name("mod_init")))
void mod_init() {
    hedge_set_mod_badge(1);
    hedge_log(1001);
}

__attribute__((export_name("mod_shutdown")))
void mod_shutdown() {
    hedge_set_mod_badge(0);
    hedge_log(1002);
}
}
