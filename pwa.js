(function () {
  'use strict';

  const installButton = document.getElementById('pwa-install-btn');
  const connectionStatus = document.getElementById('pwa-connection-status');
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  let deferredInstallPrompt = null;
  let onlineMessageTimer = null;

  function refreshIcons() {
    try { window.lucide?.createIcons(); } catch (_) {}
  }

  function showInstallButton() {
    if (!installButton || isStandalone) return;
    installButton.hidden = false;
    refreshIcons();
  }

  function hideInstallButton() {
    if (installButton) installButton.hidden = true;
  }

  function showConnectionStatus(message, online) {
    if (!connectionStatus) return;
    clearTimeout(onlineMessageTimer);
    connectionStatus.textContent = message;
    connectionStatus.classList.toggle('is-online', Boolean(online));
    connectionStatus.hidden = false;
    if (online) {
      onlineMessageTimer = setTimeout(() => { connectionStatus.hidden = true; }, 3200);
    }
  }

  function reconnectRealtime() {
    try {
      if (typeof phase10StartRealtimeSync === 'function' && phase10CurrentFirebaseProfile) {
        phase10StartRealtimeSync(phase10CurrentFirebaseProfile);
      }
    } catch (error) {
      console.warn('PWA realtime reconnect deferred:', error);
    }
  }

  function updateConnectionStatus() {
    const online = navigator.onLine;
    document.documentElement.classList.toggle('is-offline', !online);
    if (online) {
      showConnectionStatus('Sambungan pulih · Supabase Realtime sedang disambungkan semula.', true);
      reconnectRealtime();
    } else {
      showConnectionStatus('Mode luar talian terhad · paparan cache sahaja; pengisian data memerlukan internet.', false);
    }
  }

  async function requestInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hideInstallButton();
      return;
    }

    if (isIos) {
      const message = 'Pada iPhone/iPad: tekan butang Share, kemudian pilih “Add to Home Screen” untuk memasang iSEJARAH.';
      if (typeof showAlert === 'function') showAlert('Pasang iSEJARAH', message, 'info');
      else window.alert(message);
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallButton();
  });
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  installButton?.addEventListener('click', requestInstall);

  if (isIos && !isStandalone) showInstallButton();
  if (!navigator.onLine) updateConnectionStatus();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
        console.warn('PWA service worker registration failed:', error);
      });
    });
  }
})();
