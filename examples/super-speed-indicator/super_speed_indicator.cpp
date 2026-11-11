// Super Speed Indicator — browser-side C++ -> WebAssembly demonstration.
// This proves the host-call and lifecycle path; it does not change Sonic's speed.

static int update_reported = 0;

extern "C" {
__attribute__((import_module("env"), import_name("hedge_set_mod_badge")))
void hedge_set_mod_badge(int enabled);

__attribute__((import_module("env"), import_name("hedge_log")))
void hedge_log(int code);

__attribute__((export_name("mod_init")))
void mod_init() {
    update_reported = 0;
    hedge_set_mod_badge(1);
    hedge_log(1001); // init reached
}

__attribute__((export_name("mod_update")))
void mod_update(double delta_ms) {
    (void)delta_ms; // Browser animation-frame delta, not the game simulation tick.
    if (!update_reported) {
        update_reported = 1;
        hedge_log(1003); // first update reached
    }
}

__attribute__((export_name("mod_shutdown")))
void mod_shutdown() {
    hedge_set_mod_badge(0);
    hedge_log(1002); // shutdown reached
}
}
