# Sonic Mania Plus Web

Sonic Mania Plus web port by Crunch Arcade / Crunchtop; this repository packages the web version as a cross-device Progressive Web App (PWA).

## Play

- GitHub Pages: https://hedgeplays2.github.io/Sonic-Mania-Plus-WEB/

## Install on your device

- **Chromebook / ChromeOS:** Open the Pages link in Chrome. Use the install icon in the address bar if it appears, or Chrome menu → **Install page as app**.
- **Android:** Open the link in Chrome → menu → **Install app** or **Add to Home screen**.
- **Windows / Linux:** Open in Chrome or Edge → address-bar install icon or browser menu → **Install**.
- **macOS:** Open in Chrome and use **Install page as app**, or use Safari's web-app option where available.
- **iPhone / iPad:** Open in Safari → Share → **Add to Home Screen**.

## Packaging

The manifest and service worker provide the installable PWA shell. The game engine and some game data are fetched from external CDN URLs, so this is **not a fully offline game yet** and an internet connection may still be required. A PWA is the common cross-platform package; native APK/EXE/DMG installers are separate builds and may require platform-specific signing or setup.

A downloadable ZIP of the web package can be generated from the repository's **Actions → Package PWA → Run workflow**. This ZIP contains the web app files, not a native installer.

## Credits

The original web port is not made by the repository owner. Credit to Crunchtop; game assets and trademarks belong to their respective owners.
