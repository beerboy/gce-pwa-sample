// Background Sync & Page Visibility API Implementation

/* 📚 初学者向け学習ガイド
 * このファイルは ../README.md の Phase 4 で読むことを推奨します
 * 高度な機能: オフライン時のデータ送信予約 + バックグラウンド同期
 * 前提知識: Service Worker の基本理解が必要
 */

// Page Visibility API: ページの表示状態を監視
function initVisibilityAPI() {
  const statusEl = document.getElementById('visibility-status');
  
  function updateVisibility() {
    const state = document.visibilityState;
    if (state === 'visible') {
      statusEl.textContent = 'フォアグラウンド（表示中）';
      statusEl.className = 'ok';
    } else {
      statusEl.textContent = 'バックグラウンド（非表示）';
      statusEl.className = 'warn';
    }
    console.log(`Page visibility changed: ${state}`);
  }

  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility(); // 初期状態を設定
}

// Background Sync: オフライン時のデータ送信予約
async function sendWithBackgroundSync(data) {
  const logEl = document.getElementById('sync-log');
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  
  try {
    // 実際の外部APIへの送信（オフラインで必ず失敗）
    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: data.message, 
        timestamp,
        source: 'PWA-Background-Sync-Test'
      })
    });
    
    if (response.ok) {
      // 成功時
      logEl.innerHTML += `<li class="ok">✅ ${timestamp}: "${data.message}" 即座に送信成功</li>`;
      return;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.log('Network failed, trying Background Sync...', error);
  }
  
  // fetch失敗時はBackground Syncに登録
  try {
    // データをIndexedDBに保存（Service Workerで読み取り）
    await saveToIndexedDB(data);
    
    // Background Sync を登録
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('send-message');
      logEl.innerHTML += `<li class="warn">🔄 ${timestamp}: "${data.message}" Background Sync登録（オフライン）</li>`;
    } else {
      // Background Sync 未対応
      logEl.innerHTML += `<li class="warn">❌ ${timestamp}: Background Sync未対応のブラウザ</li>`;
    }
  } catch (error) {
    logEl.innerHTML += `<li class="warn">❌ ${timestamp}: Background Sync登録失敗: ${error.message}</li>`;
    console.error('Background Sync registration failed:', error);
  }
}

// IndexedDB操作: 送信待ちデータの保存
function saveToIndexedDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sync-store', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['messages'], 'readwrite');
      const store = tx.objectStore('messages');
      
      const item = {
        id: Date.now(),
        message: data.message,
        timestamp: new Date().toISOString()
      };
      
      store.add(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore('messages', { keyPath: 'id' });
    };
  });
}

// フォーム送信イベント
function initBackgroundSyncForm() {
  const form = document.getElementById('sync-form');
  const input = document.getElementById('message-input');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = input.value.trim();
    if (!message) return;
    
    await sendWithBackgroundSync({ message });
    input.value = ''; // フォームをクリア
  });
}

// Service Workerからのメッセージ受信（送信完了通知）
function listenToServiceWorkerMessages() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const logEl = document.getElementById('sync-log');
      const timestamp = new Date().toLocaleTimeString('ja-JP');
      
      if (event.data && event.data.type === 'SYNC_SUCCESS') {
        logEl.innerHTML += `<li class="ok">🚀 ${timestamp}: Background Sync送信完了 "${event.data.message}"</li>`;
      } else if (event.data && event.data.type === 'SYNC_STARTED') {
        logEl.innerHTML += `<li style="color: #0ea5e9;">🔄 ${timestamp}: Background Sync処理開始 (${event.data.count}件)</li>`;
      } else if (event.data && event.data.type === 'SYNC_ERROR') {
        logEl.innerHTML += `<li class="warn">❌ ${timestamp}: Background Sync失敗 - ${event.data.error}</li>`;
      }
    });
  }
}

// Background Sync対応チェック
async function checkBackgroundSyncSupport() {
  const supportEl = document.getElementById('sync-support');
  
  if (!('serviceWorker' in navigator)) {
    supportEl.textContent = '非対応（Service Worker未対応）';
    supportEl.className = 'warn';
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      supportEl.textContent = '対応（Background Sync利用可能）';
      supportEl.className = 'ok';
      return true;
    } else {
      supportEl.textContent = '非対応（Background Sync未対応）';
      supportEl.className = 'warn';
      return false;
    }
  } catch (error) {
    supportEl.textContent = '判定失敗';
    supportEl.className = 'warn';
    return false;
  }
}

// バックグラウンド通信テスト関数（即座にグローバル公開）
window.testBackgroundCommunication = async function testBackgroundCommunication() {
  const logEl = document.getElementById('sync-log');
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  
  logEl.innerHTML += `<li style="color: #8b5cf6; font-weight: bold;">🧪 ${timestamp}: バックグラウンド通信テスト開始</li>`;
  
  // 1. 通常送信テスト
  try {
    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        test: 'background-communication',
        timestamp,
        userAgent: navigator.userAgent
      })
    });
    
    if (response.ok) {
      logEl.innerHTML += `<li class="ok">✅ ${new Date().toLocaleTimeString('ja-JP')}: 通常通信成功</li>`;
    }
  } catch (error) {
    logEl.innerHTML += `<li class="warn">❌ ${new Date().toLocaleTimeString('ja-JP')}: 通信失敗 - ${error.message}</li>`;
  }
  
  // 2. ページ非表示テスト
  logEl.innerHTML += `<li style="color: #8b5cf6;">📱 ${new Date().toLocaleTimeString('ja-JP')}: 10秒後にページを背景にしてください</li>`;
  
  setTimeout(() => {
    if (document.visibilityState === 'hidden') {
      logEl.innerHTML += `<li class="ok">✅ ${new Date().toLocaleTimeString('ja-JP')}: バックグラウンド状態で処理実行中</li>`;
    } else {
      logEl.innerHTML += `<li class="warn">⚠️ ${new Date().toLocaleTimeString('ja-JP')}: まだフォアグラウンド状態です</li>`;
    }
  }, 10000);
};

// 未送信メッセージ確認機能（即座にグローバル公開）
window.checkPendingMessages = async function checkPendingMessages() {
  const logEl = document.getElementById('sync-log');
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  
  try {
    const db = await openIndexedDB();
    const messages = await getAllPendingMessages(db);
    
    logEl.innerHTML += `<li style="color: #f59e0b;">🔍 ${timestamp}: 未送信メッセージ ${messages.length}件</li>`;
    
    messages.forEach((msg, index) => {
      logEl.innerHTML += `<li style="color: #6b7280; margin-left: 20px;">📝 ${index + 1}. "${msg.message}" (${new Date(msg.timestamp).toLocaleTimeString('ja-JP')})</li>`;
    });
    
    if (messages.length > 0) {
      // 手動でBackground Syncをトリガー
      logEl.innerHTML += `<li style="color: #f59e0b;">⚡ ${new Date().toLocaleTimeString('ja-JP')}: 手動でBackground Sync実行中...</li>`;
      
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await registration.sync.register('send-message');
        }
      }
    }
    
  } catch (error) {
    logEl.innerHTML += `<li class="warn">❌ ${timestamp}: 確認エラー - ${error.message}</li>`;
  }
};

// 強制同期実行機能
window.forceSyncNow = async function forceSyncNow() {
  const logEl = document.getElementById('sync-log');
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  
  logEl.innerHTML += `<li style="color: #ef4444; font-weight: bold;">⚡ ${timestamp}: 強制同期開始</li>`;
  
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Service Workerにメッセージを送信して直接実行
      if (registration.active) {
        registration.active.postMessage({ 
          type: 'FORCE_SYNC',
          timestamp: new Date().toISOString()
        });
        logEl.innerHTML += `<li style="color: #ef4444;">📤 ${new Date().toLocaleTimeString('ja-JP')}: Service Workerに強制実行指示を送信</li>`;
      }
      
      // Background Syncも再登録
      if ('sync' in registration) {
        await registration.sync.register('send-message');
        logEl.innerHTML += `<li style="color: #ef4444;">🔄 ${new Date().toLocaleTimeString('ja-JP')}: Background Sync再登録</li>`;
      }
    }
  } catch (error) {
    logEl.innerHTML += `<li class="warn">❌ ${new Date().toLocaleTimeString('ja-JP')}: 強制同期失敗 - ${error.message}</li>`;
  }
};

// IndexedDB操作（フロントエンド用）
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sync-store', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
    };
  });
}

function getAllPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['messages'], 'readonly');
    const store = tx.objectStore('messages');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  initVisibilityAPI();
  initBackgroundSyncForm();
  listenToServiceWorkerMessages();
  checkBackgroundSyncSupport();
});