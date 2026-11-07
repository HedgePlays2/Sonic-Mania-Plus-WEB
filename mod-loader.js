/* Hedge Web Mod Loader — browser-side mod manager for the Sonic Mania Web port.
   Mod ZIP format:
   - mod.json at ZIP root: {id,name,version,author,description,type,scripts?}
   - assets/<game-relative-path> files are copied into the Emscripten FS before startup.
   - scripts/*.js are optional browser-logic extensions loaded after the game starts.
   Note: native RSDK/C++ DLL mods are not executable in this existing WebAssembly build.
*/
(function () {
  "use strict";

  var DB_NAME = "hedge-sonic-mania-mods";
  var DB_VERSION = 1;
  var STORE = "mods";
  var MAX_ZIP_BYTES = 200 * 1024 * 1024;
  var MAX_UNPACKED_BYTES = 256 * 1024 * 1024;
  var dbPromise;
  var logicListeners = Object.create(null);
  var installedLogic = [];
  var statusLine;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function transaction(mode, work) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result;
        try { result = work(store); } catch (error) { reject(error); return; }
        tx.oncomplete = function () { resolve(result && result.result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("Storage transaction aborted")); };
      });
    });
  }

  function allMods() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function saveMod(mod) {
    return transaction("readwrite", function (store) { return store.put(mod); });
  }

  function deleteMod(id) {
    return transaction("readwrite", function (store) { return store.delete(id); });
  }

  function safeId(value) {
    return /^[a-z0-9][a-z0-9._-]{0,47}$/i.test(value || "");
  }

  function safePath(path) {
    if (!path || path.indexOf("\\") !== -1 || path.startsWith("/") || /^[a-z]:/i.test(path)) return false;
    var parts = path.split("/");
    return parts.every(function (part) { return part && part !== "." && part !== ".."; });
  }

  function parseIni(text) {
    var values = Object.create(null);
    text.replace(/^\uFEFF/, "").split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === ";" || trimmed.charAt(0) === "#" || /^\[.*\]$/.test(trimmed)) return;
      var equals = trimmed.indexOf("=");
      if (equals < 1) return;
      values[trimmed.slice(0, equals).trim().toLowerCase()] = trimmed.slice(equals + 1).trim();
    });
    return values;
  }

  function flattenArchiveTree(node, prefix, output) {
    Object.keys(node || {}).forEach(function (name) {
      var value = node[name];
      var path = prefix ? prefix + "/" + name : name;
      if (value && typeof value.arrayBuffer === "function") {
        output.push({ path: path, file: value });
      } else if (value && typeof value === "object") {
        flattenArchiveTree(value, path, output);
      }
    });
    return output;
  }

  function normalizeModEntries(entries, archiveName) {
    var manifestEntry = entries.find(function (entry) { return /(^|\/)mod\.ini$/i.test(entry.path); });
    var jsonEntry = entries.find(function (entry) { return /(^|\/)mod\.json$/i.test(entry.path); });
    var marker = manifestEntry || jsonEntry;
    if (!marker) throw new Error("This archive needs a mod.ini file (standard Sonic Mania format).");

    var markerParts = marker.path.split("/");
    var root = markerParts.length > 1 ? markerParts.slice(0, -1).join("/") + "/" : "";
    var normalized = entries.filter(function (entry) {
      return entry.path.indexOf(root) === 0 && entry.path !== marker.path;
    }).map(function (entry) {
      var path = entry.path.slice(root.length);
      if (!safePath(path)) throw new Error("Unsafe path in archive: " + entry.path);
      // RSDK mods store loose game files in Data/. Map those into the
      // browser loader's asset overlay folder.
      if (/^Data\//i.test(path)) path = "assets/" + path;
      return { path: path, file: entry.file };
    });

    return Promise.all(normalized.map(function (entry) {
      return entry.file.arrayBuffer().then(function (buffer) {
        return { path: entry.path, bytes: new Uint8Array(buffer) };
      });
    })).then(function (files) {
      if (manifestEntry) {
        return manifestEntry.file.text().then(function (text) {
          var ini = parseIni(text);
          var name = ini.name || archiveName.replace(/\.(zip|rar)$/i, "");
          var id = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "sonic-mania-mod";
          return {
            id: id, name: name, version: ini.version || "1.0", author: ini.author || "Unknown",
            description: ini.description || "", type: "asset", scripts: [],
            targetVersion: ini.targetversion || "", logicFile: ini.logicfile || "", dllFile: ini.dllfile || "",
            files: files
          };
        });
      }
      return jsonEntry.file.text().then(function (text) {
        var manifest;
        try { manifest = JSON.parse(text); } catch (_) { throw new Error("mod.json is not valid JSON."); }
        if (!manifest || !safeId(manifest.id) || !manifest.name) throw new Error("mod.json needs a valid id and a name.");
        manifest.scripts = manifest.scripts || [];
        if (!Array.isArray(manifest.scripts)) throw new Error("The scripts field must be an array of archive paths.");
        manifest.scripts.forEach(function (path) {
          if (!safePath(path) || !files.some(function (entry) { return entry.path === path; })) throw new Error("Missing or unsafe logic script: " + path);
        });
        return {
          id: manifest.id, name: String(manifest.name), version: String(manifest.version || "1.0"),
          author: String(manifest.author || "Unknown"), description: String(manifest.description || ""),
          type: manifest.type === "logic" ? "logic" : "asset", scripts: manifest.scripts,
          files: files
        };
      });
    });
  }

  function installArchive(file) {
    if (!file || file.size > MAX_ZIP_BYTES) return Promise.reject(new Error("Archive files must be 200 MB or smaller."));
    var extension = (file.name.split(".").pop() || "").toLowerCase();
    var entriesPromise;
    if (extension === "zip") {
      if (!window.JSZip) return Promise.reject(new Error("ZIP support did not load. Refresh and try again."));
      entriesPromise = file.arrayBuffer().then(function (buffer) {
        return JSZip.loadAsync(buffer, { checkCRC32: true }).then(function (zip) {
          return Promise.all(Object.keys(zip.files).filter(function (path) {
            return !zip.files[path].dir;
          }).map(function (path) {
            return zip.files[path].async("blob").then(function (blob) { return { path: path, file: blob }; });
          }));
        });
      });
    } else if (extension === "rar") {
      entriesPromise = import("https://esm.sh/libarchive.js@2.0.2").then(function (library) {
        var Archive = library.Archive || (library.default && library.default.Archive);
        if (!Archive) throw new Error("RAR extraction library did not initialize.");
        Archive.init({ workerUrl: "https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/worker-bundle.js" });
        return Archive.open(file).then(function (archive) {
          return archive.extractFiles().then(function (tree) { return flattenArchiveTree(tree, "", []); });
        });
      }).catch(function (error) {
        console.error("[Sonic Mania Web Mods] RAR extraction failed:", error);
        throw new Error("Could not open this RAR. It may be encrypted, damaged, or unsupported.");
      });
    } else {
      return Promise.reject(new Error("Choose a .zip or .rar mod archive."));
    }

    return entriesPromise.then(function (entries) {
      var total = entries.reduce(function (sum, entry) { return sum + (entry.file.size || 0); }, 0);
      if (total > MAX_UNPACKED_BYTES) throw new Error("This mod expands beyond the 256 MB safety limit.");
      var unsafe = entries.find(function (entry) { return !safePath(entry.path); });
      if (unsafe) throw new Error("Unsafe path in archive: " + unsafe.path);
      return normalizeModEntries(entries, file.name);
    }).then(function (mod) {
      mod.enabled = false;
      mod.installedAt = Date.now();
      return saveMod(mod);
    });
  }

  function makeAPI(modId) {
    return Object.freeze({
      modId: modId,
      on: function (eventName, callback) {
        if (typeof callback !== "function") throw new TypeError("Mod event callback must be a function.");
        (logicListeners[eventName] || (logicListeners[eventName] = [])).push({ modId: modId, callback: callback });
        return function () {
          logicListeners[eventName] = (logicListeners[eventName] || []).filter(function (item) {
            return item.callback !== callback || item.modId !== modId;
          });
        };
      },
      emit: function (eventName, detail) {
        (logicListeners[eventName] || []).slice().forEach(function (item) {
          try { item.callback(detail); } catch (error) { console.error("[Web Mod] " + item.modId, error); }
        });
      },
      getCanvas: function () { return document.getElementById("canvas"); },
      getGameModule: function () { return window.Module || null; },
      readFile: function (path) {
        if (!window.FS || !safePath(path)) throw new Error("Invalid game file path.");
        return FS.readFile("/" + path);
      },
      writeFile: function (path, bytes) {
        if (!window.FS || !safePath(path)) throw new Error("Invalid game file path.");
        FS.writeFile("/" + path, bytes);
      }
    });
  }

  window.SonicManiaModAPI = Object.freeze({
    version: "0.1.0",
    on: function (eventName, callback) {
      return makeAPI("anonymous").on(eventName, callback);
    },
    emit: function (eventName, detail) {
      (logicListeners[eventName] || []).slice().forEach(function (item) {
        try { item.callback(detail); } catch (error) { console.error("[Web Mod]", error); }
      });
    }
  });

  function loadEnabledModsIntoFS() {
    return allMods().then(function (mods) {
      var enabled = mods.filter(function (mod) { return mod.enabled; }).sort(function (a, b) {
        return (a.priority || 0) - (b.priority || 0) || a.installedAt - b.installedAt;
      });
      var chain = Promise.resolve();
      enabled.forEach(function (mod) {
        chain = chain.then(function () {
          mod.files.forEach(function (entry) {
            if (entry.path.indexOf("assets/") !== 0) return;
            var relative = entry.path.slice(7);
            if (!safePath(relative)) return;
            var fullPath = "/" + relative;
            var parent = fullPath.slice(0, fullPath.lastIndexOf("/"));
            if (parent && parent !== "/" && FS.mkdirTree) FS.mkdirTree(parent);
            FS.writeFile(fullPath, entry.bytes);
          });
          installedLogic.push(mod);
        });
      });
      return chain;
    });
  }

  function runLogicMods() {
    var chain = Promise.resolve();
    installedLogic.forEach(function (mod) {
      if (mod.type !== "logic") return;
      (mod.scripts || []).forEach(function (scriptPath) {
        var entry = mod.files.find(function (item) { return item.path === scriptPath; });
        if (!entry) return;
        chain = chain.then(function () {
          return new Promise(function (resolve) {
            var source = new TextDecoder().decode(entry.bytes);
            var wrapped = '"use strict";\n(function(api){\n' + source + '\n})(window.__createSonicManiaModAPI(' + JSON.stringify(mod.id) + '));';
            var blobUrl = URL.createObjectURL(new Blob([wrapped], { type: "text/javascript" }));
            var script = document.createElement("script");
            script.async = false;
            script.src = blobUrl;
            script.onload = function () { URL.revokeObjectURL(blobUrl); resolve(); };
            script.onerror = function () {
              URL.revokeObjectURL(blobUrl);
              console.error("Could not load logic script for " + mod.name);
              resolve();
            };
            document.head.appendChild(script);
          });
        });
      });
    });
    return chain.then(function () {
      window.SonicManiaModAPI.emit("gameReady", { canvas: document.getElementById("canvas") });
    });
  }

  window.__createSonicManiaModAPI = makeAPI;

  function setStatus(message) {
    if (statusLine) statusLine.textContent = message;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderMods(list) {
    var container = document.getElementById("sm-mod-list");
    if (!container) return;
    container.textContent = "";
    if (!list.length) {
      container.appendChild(el("p", "sm-empty", "No mods installed yet. Import a .zip or .rar to get started."));
      return;
    }
    list.sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (mod) {
      var card = el("article", "sm-mod-card");
      var details = el("div", "sm-mod-details");
      details.appendChild(el("strong", "", mod.name));
      details.appendChild(el("small", "", "v" + mod.version + " · " + mod.author + " · " + (mod.type === "logic" ? "Web logic" : "Assets")));
      if (mod.description) details.appendChild(el("p", "", mod.description));
      var actions = el("div", "sm-mod-actions");
      var toggle = el("button", "sm-small-button", mod.enabled ? "Enabled" : "Disabled");
      toggle.setAttribute("aria-pressed", String(!!mod.enabled));
      toggle.addEventListener("click", function () {
        mod.enabled = !mod.enabled;
        saveMod(mod).then(refreshList).catch(function (error) { setStatus(error.message); });
        setStatus("Mod setting saved. Restart the game to apply changes.");
      });
      var remove = el("button", "sm-small-button sm-remove", "Remove");
      remove.addEventListener("click", function () {
        if (!confirm("Remove " + mod.name + "?")) return;
        deleteMod(mod.id).then(refreshList).then(function () { setStatus("Mod removed."); });
      });
      actions.appendChild(toggle);
      actions.appendChild(remove);
      card.appendChild(details);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  function refreshList() {
    return allMods().then(function (mods) { renderMods(mods); return mods; });
  }

  function buildUI() {
    if (document.getElementById("sm-mod-manager")) return;
    var style = el("style");
    style.textContent = [
      "#sm-mod-open{margin-top:8px}",
      "#sm-mod-manager{position:fixed;inset:0;z-index:5000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);font-family:Inter,Arial,sans-serif;color:#fff}",
      "#sm-mod-manager.open{display:flex}",
      ".sm-mod-window{width:min(720px,100%);max-height:88vh;overflow:auto;background:#101827;border:1px solid #42628c;border-radius:14px;box-shadow:0 20px 70px #000;padding:20px;text-align:left}",
      ".sm-mod-head{display:flex;align-items:center;justify-content:space-between;gap:12px}",
      ".sm-mod-head h2{font-size:22px;margin:0}",
      ".sm-mod-sub{color:#a9bad0;font-size:13px;line-height:1.5;margin:10px 0 16px}",
      ".sm-mod-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}",
      ".sm-mod-toolbar button,.sm-mod-toolbar label,.sm-small-button{border:1px solid #58759b;background:#1d3554;color:white;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;font:inherit;font-size:13px}",
      ".sm-mod-toolbar button:hover,.sm-mod-toolbar label:hover,.sm-small-button:hover{background:#294a72}",
      ".sm-mod-toolbar input{display:none}",
      "#sm-mod-list{display:grid;gap:9px}",
      ".sm-mod-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:#172338;border:1px solid #2d4566;border-radius:10px}",
      ".sm-mod-details{min-width:0;display:grid;gap:4px}.sm-mod-details small,.sm-mod-details p{color:#b4c3d6;font-size:12px;margin:0;overflow-wrap:anywhere}",
      ".sm-mod-actions{display:flex;gap:6px;flex-shrink:0}.sm-small-button{padding:7px 9px}.sm-remove{border-color:#8d4d57;background:#49232d}",
      ".sm-empty{padding:20px;color:#b4c3d6;text-align:center;background:#172338;border-radius:10px}",
      "#sm-mod-status{font-size:12px;color:#9ec7ff;min-height:18px;margin-top:12px}",
      ".sm-mod-warning{font-size:12px;line-height:1.5;color:#ffd58a;background:#3b2c13;border:1px solid #795a22;padding:10px;border-radius:8px;margin-top:12px}",
      "@media(max-width:520px){.sm-mod-card{align-items:flex-start;flex-direction:column}.sm-mod-window{padding:14px}.sm-mod-head h2{font-size:18px}}"
    ].join("\n");
    document.head.appendChild(style);

    var panel = document.querySelector(".control-panel");
    var open = el("button", "game-btn", "Mods");
    open.id = "sm-mod-open";
    open.type = "button";
    if (panel) panel.appendChild(open);

    var overlay = el("div");
    overlay.id = "sm-mod-manager";
    var windowBox = el("section", "sm-mod-window");
    windowBox.setAttribute("role", "dialog");
    windowBox.setAttribute("aria-modal", "true");
    windowBox.setAttribute("aria-labelledby", "sm-mod-title");
    var header = el("div", "sm-mod-head");
    var heading = el("h2", "", "Sonic Mania Web · Mod Manager");
    heading.id = "sm-mod-title";
    var close = el("button", "sm-small-button", "Close");
    close.type = "button";
    header.appendChild(heading);
    header.appendChild(close);
    windowBox.appendChild(header);
    windowBox.appendChild(el("p", "sm-mod-sub", "Install Sonic Mania mod archives (.zip or .rar), switch them on or off, and keep your collection saved in this browser. Changes apply after restarting the game."));
    var toolbar = el("div", "sm-mod-toolbar");
    var importLabel = el("label", "", "＋ Import .ZIP / .RAR");
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.rar,application/zip,application/vnd.rar";
    importLabel.appendChild(input);
    var reload = el("button", "", "Refresh list");
    reload.type = "button";
    toolbar.appendChild(importLabel);
    toolbar.appendChild(reload);
    windowBox.appendChild(toolbar);
    var list = el("div");
    list.id = "sm-mod-list";
    windowBox.appendChild(list);
    statusLine = el("p");
    statusLine.id = "sm-mod-status";
    windowBox.appendChild(statusLine);
    windowBox.appendChild(el("p", "sm-mod-warning", "Compatibility note: asset files load through the game's Emscripten filesystem. JavaScript logic mods can use SonicManiaModAPI. Native RSDK/C++ DLL mods need a specially rebuilt WebAssembly engine and are not supported by this existing runtime yet."));
    overlay.appendChild(windowBox);
    document.body.appendChild(overlay);

    function show() { overlay.classList.add("open"); refreshList().catch(function (e) { setStatus(e.message); }); }
    function hide() { overlay.classList.remove("open"); }
    open.addEventListener("click", show);
    close.addEventListener("click", hide);
    overlay.addEventListener("click", function (event) { if (event.target === overlay) hide(); });
    reload.addEventListener("click", function () { refreshList().catch(function (e) { setStatus(e.message); }); });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      setStatus("Installing " + file.name + "…");
      installArchive(file).then(function () {
        setStatus("Mod installed. Enable it, then restart the game.");
        return refreshList();
      }).catch(function (error) {
        setStatus("Install failed: " + error.message);
      }).finally(function () { input.value = ""; });
    });
    refreshList().catch(function (error) { setStatus("Storage unavailable: " + error.message); });
  }

  function registerEngineHooks() {
    if (!window.Module) return;
    Module.preRun = Module.preRun || [];
    Module.preRun.push(function () {
      var addDependency = Module.addRunDependency || window.addRunDependency;
      var removeDependency = Module.removeRunDependency || window.removeRunDependency;
      var dependencyAdded = typeof addDependency === "function" && typeof removeDependency === "function";
      if (dependencyAdded) addDependency.call(Module, "sonic-web-mods");
      var startedAt = Date.now();
      function waitForGameArchive() {
        var archiveReady = false;
        try {
          archiveReady = !!(window.FS && FS.analyzePath("/Data.rsdk").exists);
        } catch (_) {}
        if (archiveReady) {
          loadEnabledModsIntoFS().catch(function (error) {
            console.error("[Sonic Mania Web Mods] Could not apply mods:", error);
          }).finally(function () {
            if (dependencyAdded) removeDependency.call(Module, "sonic-web-mods");
          });
          return;
        }
        if (Date.now() - startedAt > 90000) {
          console.warn("[Sonic Mania Web Mods] Data.rsdk was not ready; skipping mod injection.");
          if (dependencyAdded) removeDependency.call(Module, "sonic-web-mods");
          return;
        }
        setTimeout(waitForGameArchive, 50);
      }
      waitForGameArchive();
    });
    Module.postRun = Module.postRun || [];
    Module.postRun.push(function () {
      runLogicMods().catch(function (error) { console.error("[Sonic Mania Web Mods] Logic mod error:", error); });
    });
  }

  function bindGameEvents() {
    window.addEventListener("keydown", function (event) {
      window.SonicManiaModAPI.emit("keydown", { key: event.key, code: event.code, repeat: event.repeat });
    });
    window.addEventListener("keyup", function (event) {
      window.SonicManiaModAPI.emit("keyup", { key: event.key, code: event.code });
    });
  }

  // Register the Emscripten hooks immediately: the async RSDK script may
  // finish downloading before DOMContentLoaded on a warm cache.
  registerEngineHooks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { buildUI(); bindGameEvents(); });
  } else {
    buildUI(); bindGameEvents();
  }
})();