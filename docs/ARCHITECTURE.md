# PWA Architecture Documentation

**Progressive Web App + Service Worker + Background Sync 実装詳細**

> 📚 **初学者の方へ**: このドキュメントは上級者向けです。[README.md](../README.md)の「初学者向け学習順序」のPhase 5で読むことを推奨します。基本概念は[PWA-GUIDE.md](PWA-GUIDE.md)で先に学習してください。

## 📁 プロジェクト構成

```
gce-pwa-sample/
├── pwa/                           # PWAアプリケーション本体
│   ├── index.html                 # メインUI + 各種テスト機能
│   ├── offline.html               # オフライン時フォールバックページ
│   ├── sw.js                      # Service Worker (v8)
│   ├── background-sync.js         # Background Sync実装
│   ├── realtime-background.js     # リアルタイム通信制限検証
│   ├── sw-update.js               # Service Worker自動更新
│   ├── client.js                  # Push通知クライアント
│   ├── manifest.webmanifest       # PWAマニフェスト
│   └── icons/                     # PWAアイコン
│       ├── icon-192.png
│       └── icon-512.png
├── nginx/                         # Nginx設定 (GCE用)
│   ├── ubuntu-pwa.conf           # Ubuntu/Debian用設定
│   └── rhel-pwa.conf             # RHEL/CentOS用設定  
├── firebase.json                  # Firebase Hosting設定
├── .firebaserc                    # Firebase プロジェクト設定
├── docs/
│   ├── SESSION-LOG.md             # 学習セッション記録
│   ├── PWA-GUIDE.md               # PWA技術ガイド
│   ├── ARCHITECTURE.md            # このファイル
│   ├── AAOS-INTEGRATION.md        # 車載環境統合ガイド
│   └── manifest-guide.md          # Web App Manifest解説
└── README.md                      # セットアップ手順
```

## 🏗️ Core Files 詳細解説

### 1. **index.html** - メインアプリケーション

```html
<!doctype html>
<html lang="ja">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0ea5e9">
  <link rel="manifest" href="/manifest.webmanifest">  <!-- PWAマニフェスト -->
</head>
```

**主要機能**:
- **PWA基本機能**: Service Worker登録、オンライン/オフライン状態監視
- **Background Syncテスト**: オフライン時のデータ送信予約機能
- **リアルタイム通信テスト**: visibilityState=hiddenでの通信制限検証
- **Push通知テスト**: VAPID鍵でのプッシュ通知購読

**読み込みスクリプト順**:
1. `sw-update.js` → Service Worker更新管理
2. `client.js` → Push通知クライアント 
3. `background-sync.js` → Background Sync機能
4. `realtime-background.js` → リアルタイム通信テスト

### 2. **sw.js** - Service Worker (Core)

```javascript
const CACHE_VERSION = 'v8';
const CACHE_NAME = `gce-pwa-${CACHE_VERSION}`;
```

**実装パターン**:

#### A. **Install Event** - キャッシュ事前保存
```javascript
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE_NAME);
    await c.addAll(PRECACHE);           // 重要ファイルを事前キャッシュ
    await self.skipWaiting();           // 即座にアクティベート
  })());
});
```

#### B. **Fetch Event** - ネットワークプロキシ
```javascript
self.addEventListener('fetch', (event) => {
  if (req.mode === 'navigate') {
    // ナビゲーション → Network First戦略
    event.respondWith(networkFirstStrategy(req));
  } else {
    // 静的リソース → Cache First戦略
    event.respondWith(cacheFirstStrategy(req));
  }
});
```

#### C. **Sync Event** - Background Sync処理
```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-message') {
    event.waitUntil(sendPendingMessages());  // IndexedDBからデータ取得・送信
  }
});
```

#### D. **Push Event** - Push通知受信
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
```

### 3. **background-sync.js** - Background Sync実装

**アーキテクチャ**:
```
[メインスレッド] → IndexedDB書き込み → Background Sync登録
                      ↓
[Service Worker] ← ネットワーク復帰時 ← Background Syncイベント
                      ↓
[外部API送信] → 成功時IndexedDB削除 → クライアント通知
```

#### **主要関数**:

##### A. **sendWithBackgroundSync()** - 送信ロジック
```javascript
async function sendWithBackgroundSync(data) {
  try {
    // 1. 通常送信を試行
    const response = await fetch('https://httpbin.org/post', {/*...*/});
    if (response.ok) return; // 成功時は即座に終了
  } catch (error) {
    // 2. 失敗時はBackground Syncに登録
    await saveToIndexedDB(data);                    // IndexedDBに保存
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('send-message'); // Sync登録
  }
}
```

##### B. **sendPendingMessages()** - Service Worker側処理
```javascript
async function sendPendingMessages() {
  const db = await openIndexedDB();
  const messages = await getAllMessages(db);       // 未送信データ取得
  
  for (const message of messages) {
    const response = await fetch('https://httpbin.org/post', {/*...*/});
    if (response.ok) {
      await deleteMessage(db, message.id);         // 成功時削除
      // クライアントに通知
      clients.forEach(client => client.postMessage({
        type: 'SYNC_SUCCESS',
        message: message.message
      }));
    }
  }
}
```

### 4. **realtime-background.js** - リアルタイム通信検証

**目的**: Page Visibility APIと組み合わせてバックグラウンド時の通信制限を実証

#### **BackgroundRealtimeTester クラス**:

```javascript
class BackgroundRealtimeTester {
  constructor() {
    this.intervalId = null;
    this.startTime = null;
    this.requestCount = 0;
    this.intervalMs = 1000;  // 1秒間隔から開始
  }
}
```

##### **通信制限検証ロジック**:
```javascript
async function sendRealtimeRequest() {
  const payload = {
    requestId: this.requestCount,
    timestamp: new Date().toISOString(),
    visibilityState: document.visibilityState,  // visible/hidden判定
    elapsed: Math.round((new Date() - this.startTime) / 1000)
  };

  const response = await fetch('https://httpbin.org/post', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  
  // 実際の通信間隔を計測・記録
  const actualInterval = this.getActualInterval();
  this.log(`✅ #${this.requestCount} 通信成功 [${document.visibilityState}] 
           実際の間隔: ${actualInterval}`);
}
```

### 5. **sw-update.js** - Service Worker自動更新

**更新検知パターン**:
```javascript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  // 新しいService Workerがアクティブになった時の処理
  window.location.reload(); // ページリロードで最新版適用
});

registration.addEventListener('updatefound', () => {
  const newWorker = registration.installing;
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed') {
      // 更新通知とskipWaitingメッセージ送信
    }
  });
});
```

### 6. **client.js** - Push通知実装

**VAPID認証フロー**:
```javascript
// 1. Push通知権限要求
const permission = await Notification.requestPermission();

// 2. Service Worker購読
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey  // VAPID公開鍵
});

// 3. サーバーに購読情報送信（実際のアプリでは必須）
await fetch('/api/subscribe', {
  method: 'POST',
  body: JSON.stringify(subscription)
});
```

## 🔄 データフローアーキテクチャ

### Background Sync フロー
```
1. [UI] フォーム送信
     ↓
2. [background-sync.js] 通常送信試行
     ↓ (失敗時)
3. [IndexedDB] データ永続化
     ↓
4. [Service Worker] Background Sync登録
     ↓ (ネットワーク復帰時)
5. [sw.js] sync イベント発火
     ↓
6. [外部API] 送信成功
     ↓
7. [IndexedDB] データ削除
     ↓
8. [UI] 成功通知表示
```

### Page Visibility 監視フロー
```
1. [realtime-background.js] 1秒間隔で通信開始
     ↓
2. [Page Visibility API] タブ切り替え検知
     ↓
3. [Browser] タイマー制限適用 (hidden時)
     ↓
4. [実際の通信] 間隔延長 (1s → 2-4s)
     ↓
5. [UI] 制限状況をリアルタイム表示
```

## 🚀 Deploy & Hosting

### Firebase Hosting 設定
```json
// firebase.json
{
  "hosting": {
    "public": "pwa",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {"source": "**", "destination": "/index.html"}  // SPA対応
    ],
    "headers": [
      {
        "source": "/sw.js",
        "headers": [{"key": "Cache-Control", "value": "no-cache"}]  // SW更新対応
      }
    ]
  }
}
```

### GCE Nginx 設定
```nginx
# ubuntu-pwa.conf
server {
    server_name YOUR_DOMAIN_HERE;
    root /var/www/pwa;
    
    # Service Worker専用設定
    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
    
    # PWAマニフェスト
    location /manifest.webmanifest {
        add_header Content-Type "application/manifest+json";
    }
}
```

## 🧪 テスト機能

### 1. **Background Sync テスト**
- **目的**: オフライン時のデータ送信予約機能確認
- **手順**: オフライン化 → データ送信 → オンライン復帰 → 自動送信確認

### 2. **リアルタイム通信制限テスト**
- **目的**: visibilityState=hiddenでの通信制限実証
- **手順**: 通信開始 → タブ切り替え → 間隔変化観測

### 3. **Service Worker更新テスト** 
- **目的**: 無停止でのアプリ更新確認
- **手順**: コード変更 → デプロイ → 自動更新通知 → 適用

## 📊 ブラウザ対応状況

| 機能 | Chrome | Safari iOS | Firefox |
|------|--------|------------|---------|
| Service Worker | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ |
| Push通知 | ✅ | ✅ (16.4+) | ✅ |
| リアルタイム制限 | 段階的延長 | 30s切断 | 1s丸め |

## 🔧 カスタマイズポイント

### 1. **外部API変更**
`background-sync.js` と `realtime-background.js` の `https://httpbin.org/post` を実際のAPIエンドポイントに変更

### 2. **キャッシュ戦略変更**
`sw.js` の `fetchEvent` ハンドラでCache First/Network First戦略を調整

### 3. **Push通知サーバー**
`client.js` のVAPID鍵と購読エンドポイントを実際のプッシュサーバーに設定

### 4. **UI拡張**
`index.html` に独自の機能追加時は、対応するJavaScriptファイルを作成し読み込み順を調整

---

**作成日**: 2025-09-07  
**対応PWA**: https://pwa-sample-project-82c16.web.app  
**技術スタック**: Service Worker + Background Sync + Page Visibility API + IndexedDB