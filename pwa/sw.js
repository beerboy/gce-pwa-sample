/* Simple offline-first Service Worker */

/* 📚 初学者向け学習ガイド
 * このファイルは ../README.md の Phase 3 で読むことを推奨します
 * Service Worker の概念は ../docs/PWA-GUIDE.md で先に学習してください
 * 主要機能: ネットワークプロキシ + キャッシュ制御 + オフライン対応
 */

const CACHE_VERSION = 'v8';
const CACHE_NAME = `gce-pwa-${CACHE_VERSION}`;
const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/background-sync.js',
  '/sw-update.js',
  '/realtime-background.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version...');
  event.waitUntil((async () => {
    const c = await caches.open(CACHE_NAME);
    await c.addAll(PRECACHE);
    console.log('[SW] New version installed, skipping waiting...');
    await self.skipWaiting();
  })());
});

// メッセージ受信でskipWaitingを実行
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  } else if (event.data && event.data.type === 'FORCE_SYNC') {
    console.log('[SW] Received FORCE_SYNC message - executing immediately');
    // 強制的にsendPendingMessagesを実行
    event.waitUntil(sendPendingMessages());
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Mock API endpoint for testing
  if (url.pathname === '/api/send-message' && req.method === 'POST') {
    event.respondWith(handleMockAPI(req));
    return;
  }

  // Navigation requests → network first, fallback to offline.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        return net;
      } catch {
        const c = await caches.open(CACHE_NAME);
        const cached = await c.match('/offline.html');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Others → cache first, fallback to network
  event.respondWith((async () => {
    const c = await caches.open(CACHE_NAME);
    const cached = await c.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      // Optionally cache new responses
      if (net && net.status === 200 && req.method === 'GET') {
        c.put(req, net.clone());
      }
      return net;
    } catch {
      return new Response('Offline asset not in cache', { status: 504 });
    }
  })());
});

// モックAPI: メッセージ送信エンドポイント
async function handleMockAPI(request) {
  try {
    const data = await request.json();
    console.log('[Service Worker] Mock API received:', data);
    
    // オフライン状態をシミュレート: navigator.onLine === false の場合は必ず失敗
    if (!self.navigator.onLine) {
      console.log('[Service Worker] Network is offline, rejecting request');
      throw new Error('Network offline');
    }
    
    // ランダムで失敗をシミュレート（20%の確率）
    if (Math.random() < 0.2) {
      console.log('[Service Worker] Simulating server error');
      return new Response(JSON.stringify({ error: 'Server error (simulated)' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 成功レスポンス
    const response = {
      success: true,
      message: data.message,
      receivedAt: new Date().toISOString(),
      syncedAt: data.syncedAt || null
    };
    
    console.log('[Service Worker] Mock API success:', response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.log('[Service Worker] Mock API error:', error);
    return new Response(JSON.stringify({ error: 'Network error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data.text()}"`);

  const title = 'PWA Push';
  const options = {
    body: event.data.text(),
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Background Sync: バックグラウンド通信の実装
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] !! Background Sync event fired !!', event.tag);
  console.log('[Service Worker] Navigator online:', navigator.onLine);
  console.log('[Service Worker] Event details:', event);
  
  if (event.tag === 'send-message') {
    console.log('[Service Worker] Processing send-message sync...');
    event.waitUntil(sendPendingMessages());
  } else {
    console.log('[Service Worker] Unknown sync tag:', event.tag);
  }
});

// IndexedDBから未送信メッセージを取得して送信
async function sendPendingMessages() {
  try {
    const db = await openIndexedDB();
    const messages = await getAllMessages(db);
    
    console.log(`[Service Worker] Found ${messages.length} pending messages`);
    
    // クライアントに処理開始を通知
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED',
        count: messages.length
      });
    });
    
    for (const message of messages) {
      try {
        // 外部API送信（Background Sync時）
        const response = await fetch('https://httpbin.org/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.message,
            timestamp: message.timestamp,
            syncedAt: new Date().toISOString(),
            source: 'PWA-Background-Sync-Recovery'
          })
        });
        
        if (response.ok) {
          // 送信成功 - IndexedDBから削除
          await deleteMessage(db, message.id);
          
          // クライアントに成功を通知
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              message: message.message
            });
          });
          
          console.log(`[Service Worker] Message sent successfully: ${message.message}`);
        } else {
          console.error(`[Service Worker] Failed to send message: ${response.status}`);
          
          // クライアントにエラーを通知
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_ERROR',
              error: `HTTP ${response.status}`
            });
          });
        }
      } catch (error) {
        console.error(`[Service Worker] Network error sending message:`, error);
        
        // クライアントにエラーを通知
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_ERROR',
            error: error.message
          });
        });
        
        // ネットワークエラーの場合、メッセージを保持して次回リトライ
        break;
      }
    }
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
    
    // クライアントにエラーを通知
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ERROR',
        error: error.message
      });
    });
  }
}

// IndexedDB操作関数
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

function getAllMessages(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['messages'], 'readonly');
    const store = tx.objectStore('messages');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteMessage(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
