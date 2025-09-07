// Service Worker更新検知と通知システム

let refreshing = false;

// Service Worker更新の監視
async function initServiceWorkerUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // Service Worker更新時の処理
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[SW Update] New service worker activated, reloading...');
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    
    // 新しいService Workerが待機中の場合
    if (registration.waiting) {
      console.log('[SW Update] New service worker is waiting');
      showUpdateNotification(registration.waiting);
    }

    // 新しいService Workerがインストール中の場合
    if (registration.installing) {
      console.log('[SW Update] New service worker is installing');
      trackInstalling(registration.installing);
    }

    // 更新チェック
    registration.addEventListener('updatefound', () => {
      console.log('[SW Update] Update found, new service worker installing...');
      trackInstalling(registration.installing);
    });

  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}

function trackInstalling(worker) {
  worker.addEventListener('statechange', () => {
    console.log('[SW Update] Service worker state changed to:', worker.state);
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      console.log('[SW Update] New service worker installed, showing notification');
      showUpdateNotification(worker);
    }
  });
}

function showUpdateNotification(worker) {
  // 更新通知バナーを表示
  const banner = createUpdateBanner();
  document.body.appendChild(banner);

  // 更新ボタンのクリックイベント
  const updateBtn = banner.querySelector('#update-app-btn');
  updateBtn.addEventListener('click', () => {
    console.log('[SW Update] User clicked update, sending SKIP_WAITING message');
    worker.postMessage({ type: 'SKIP_WAITING' });
    banner.remove();
  });

  // 後でボタンのクリックイベント
  const laterBtn = banner.querySelector('#update-later-btn');
  laterBtn.addEventListener('click', () => {
    banner.remove();
  });
}

function createUpdateBanner() {
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0ea5e9;
      color: white;
      padding: 16px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slideDown 0.3s ease-out;
    ">
      <p style="margin: 0 0 12px 0; font-weight: 500;">
        📱 アプリの新しいバージョンが利用できます
      </p>
      <button id="update-app-btn" style="
        background: white;
        color: #0ea5e9;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 500;
        margin-right: 8px;
        cursor: pointer;
      ">今すぐ更新</button>
      <button id="update-later-btn" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
      ">後で</button>
    </div>
    <style>
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
    </style>
  `;
  return banner;
}

// 強制更新機能（デバッグ用）
function forceUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
    }).then(() => {
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW Update] Force update: cleared all caches and SW');
        window.location.reload();
      });
    });
  }
}

// グローバルに公開（デバッグ用）
window.forceUpdate = forceUpdate;

// 初期化
document.addEventListener('DOMContentLoaded', initServiceWorkerUpdate);