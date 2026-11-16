/**
 * FinTrack Pro — PWA & System Installer Service
 * Bridges browser installation events to native desktop/mobile install experience.
 */

import { showToast, alertModal } from '../utils/dialog.js';

let deferredPrompt = null;
let isAppInstalled = false;

// Check if running in standalone PWA mode
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function initPWAInstaller() {
  isAppInstalled = isStandalone();

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent immediate browser mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-ready'));
    console.log('[PWA] App is installable. Prompt captured.');
  });

  window.addEventListener('appinstalled', () => {
    isAppInstalled = true;
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
    showToast('FinTrack Pro installed successfully! Launch it anytime from your system apps.', 'success', 5000);
    console.log('[PWA] Application installed on device.');
  });
}

/**
 * Check if install prompt is currently primed.
 * @returns {boolean}
 */
export function canInstall() {
  return !!deferredPrompt && !isAppInstalled;
}

/**
 * Trigger system installation dialog.
 * @returns {Promise<boolean>}
 */
export async function installApp() {
  if (isStandalone()) {
    showToast('FinTrack Pro is already running as an installed system app.', 'info');
    return true;
  }

  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === 'accepted') {
        showToast('Installing FinTrack Pro to your system...', 'success');
        return true;
      } else {
        showToast('Installation cancelled.', 'info');
        return false;
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
    }
  }

  // Fallback instructions for iOS Safari or desktop browsers without direct prompt
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    await alertModal({
      title: 'Install FinTrack Pro on iOS',
      message: 'To install on iOS:\n1. Tap the Share button in Safari (box with up arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right.',
      type: 'info'
    });
  } else {
    await alertModal({
      title: 'Install Desktop / Mobile App',
      message: 'To install FinTrack Pro as a native app:\n- On Chrome/Edge: Click the install icon in the address bar (or Menu → "Install FinTrack Pro")\n- On Android: Tap browser menu (⋮) → "Install app" or "Add to Home screen"',
      type: 'info'
    });
  }
  return false;
}
