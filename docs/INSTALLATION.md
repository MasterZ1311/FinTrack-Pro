# FinTrack Pro — System Installation & Operating Guide

FinTrack Pro is engineered as a **100% client-side, offline-first Progressive Web App (PWA)** that can be installed directly onto your operating system as a native application without third-party app stores or cloud dependencies.

---

## 🖥️ Desktop Installation

### Windows 10 / 11 (Google Chrome, Microsoft Edge, Brave)
1. Open FinTrack Pro in your browser (e.g. `http://localhost:4173` or your hosted URL).
2. Click the **"Install App"** button located at the bottom of the FinTrack Pro sidebar.
   - *Alternative*: Click the **Install icon (computer/arrow)** in the right side of the browser address bar.
3. In the confirmation dialog, click **Install**.
4. FinTrack Pro will now run in its own standalone, frameless desktop window with its own taskbar icon and Start Menu shortcut.
5. You can pin FinTrack Pro to your Windows Taskbar or Desktop for 1-click native launching.

### macOS (Safari, Chrome, Edge)
#### Using Safari (macOS Sonoma 14+):
1. Navigate to FinTrack Pro in Safari.
2. In the menu bar, click **File → Add to Dock**.
3. Name the app "FinTrack Pro" and click **Add**.
4. Launch FinTrack Pro directly from your macOS Dock or Launchpad in an isolated native window.

#### Using Chrome or Edge on macOS:
1. Click the **"Install App"** button in the FinTrack Pro sidebar or the install icon in the address bar.
2. Click **Install**.
3. FinTrack Pro is added to your macOS `~/Applications` folder and can be launched via Spotlight (`Cmd + Space`).

### Linux (Ubuntu, Fedora, Arch, etc.)
1. Open FinTrack Pro in Chromium, Chrome, or Edge.
2. Click **"Install App"** in the sidebar.
3. The `.desktop` entry is automatically created in `~/.local/share/applications/` and appears in your Application Launcher / GNOME Dash.

---

## 📱 Mobile Installation

### iOS (iPhone & iPad — Safari)
1. Open FinTrack Pro in Safari.
2. Tap the **Share** button (box with an arrow pointing upward) in the browser toolbar.
3. Scroll down the share sheet and tap **"Add to Home Screen"**.
4. Confirm by tapping **"Add"** in the top-right corner.
5. FinTrack Pro is installed on your Home Screen as a standalone mobile application with no browser chrome, full offline support, and safe-area notch adaptation.

### Android (Chrome, Samsung Internet, Edge)
1. Open FinTrack Pro in your mobile browser.
2. Tap the **"Install App"** button in the sidebar or banner.
   - *Alternative*: Tap the browser menu (⋮) in the top-right and select **"Install app"** or **"Add to Home screen"**.
3. Tap **Install** in the system prompt.
4. FinTrack Pro is added to your Android app drawer with full standalone launch capabilities.

---

## 🔒 Offline & Data Privacy Guarantees

- **No Remote Servers**: FinTrack Pro runs 100% in your local environment.
- **Zero Plaintext Storage**: All API keys and credentials are encrypted at rest with AES-256-GCM using PBKDF2 (100,000 iterations).
- **Service Worker Offline Cache**: All JavaScript, CSS, icons, and PDF parser WASM modules are cached locally via the native Cache API (`v2`).
- **Encrypted Backup & Portability**: You can export and import your complete encrypted financial ledger anytime from **Settings → Data Management**.
