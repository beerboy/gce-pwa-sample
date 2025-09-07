# PWA + Service Worker 完全ガイド

**Progressive Web App（PWA）とService Workerの技術詳細と実装ガイド**

## 目次

- [PWAとは](#pwaとは) ← 初学者はここから
- [Minimum Requirements](#minimum-requirements) ← 初学者必読
- [Service Worker主要機能](#service-worker主要機能)
- [PWA vs WebView比較](#pwa-vs-webview比較)
- [ブラウザ対応状況](#ブラウザ対応状況)
- [実装可能機能](#実装可能機能)
- [バックグラウンド処理](#バックグラウンド処理) ← Phase 4で読む
- [実装チェックリスト](#実装チェックリスト)

> 📚 **初学者の方へ**: [README.md](../README.md)の「初学者向け学習順序」に従って段階的に学習することを推奨します。

---

## PWAとは

**Progressive Web App（PWA）** = Web技術でネイティブアプリ級の体験を提供するアプリケーション

### 🏗 核心構成要素

```
PWA = Service Worker + Web App Manifest + HTTPS
```

- **Service Worker**: バックグラウンド処理・ネットワーク制御
- **Web App Manifest**: アプリメタデータ・インストール設定
- **HTTPS**: セキュリティ基盤（Service Worker動作必須）

---

## Minimum Requirements

### 🚨 絶対必須の4要件

#### 1. HTTPS配信（または localhost）
```
✅ https://example.com     (本番環境)
✅ http://localhost:3000   (開発環境)
❌ http://example.com      (本番環境では動作不可)
```

**理由**: Service Workerが全通信を制御できるため、セキュリティ保護が必須

#### 2. 有効なWeb App Manifest
```json
{
  "name": "アプリ名",           // 必須
  "short_name": "短縮名",      // 必須  
  "start_url": "/",           // 必須
  "display": "standalone",    // 必須
  "icons": [
    {"src": "/icon-192.png", "sizes": "192x192"},  // 必須
    {"src": "/icon-512.png", "sizes": "512x512"}   // 必須
  ]
}
```

#### 3. fetchイベント実装のService Worker
```javascript
self.addEventListener('fetch', event => {
  // この実装がないとインストール判定されない
  event.respondWith(
    caches.match(event.request) || fetch(event.request)
  );
});
```

#### 4. 同一オリジン・同一パス階層
- Service Workerのスコープ制限
- 別ドメインや上位パスには干渉不可

### ⚠️ インストール判定条件（Chrome）
1. Service Worker + fetchイベント実装
2. 有効なmanifest.json
3. HTTPS配信
4. **30秒以上の滞在または頻繁な訪問**

---

## Service Worker主要機能

### 🔄 1. ネットワークプロキシ
```javascript
self.addEventListener('fetch', event => {
  // 全HTTP通信を横取り・制御
  if (event.request.url.includes('/api/')) {
    // API通信の場合
    event.respondWith(
      fetch(event.request).catch(() => 
        caches.match('/offline-data.json')
      )
    );
  } else {
    // 静的ファイルの場合
    event.respondWith(
      caches.match(event.request) || fetch(event.request)
    );
  }
});
```

### 📱 2. バックグラウンド処理
```javascript
// プッシュ通知受信（アプリ閉じてても動作）
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png'
    })
  );
});

// バックグラウンド同期（オフライン復帰時）
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(sendQueuedMessages());
  }
});
```

### 💾 3. 高度なキャッシュ制御
```javascript
// キャッシュ戦略の実装
const CACHE_VERSION = 'v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => 
      cache.addAll([
        '/',
        '/css/style.css',
        '/js/app.js',
        '/offline.html'
      ])
    )
  );
});
```

---

## PWA vs WebView比較

| 項目 | **PWA** | **WebView** |
|------|---------|-------------|
| **実行環境** | システムブラウザ活用 | アプリ内専用エンジン |
| **更新方式** | **即時反映**（ストア審査不要） | APK/IPA更新必要 |
| **プッシュ通知** | **OS標準対応** | iOS制限・独自実装必要 |
| **オフライン機能** | **Service Worker標準** | 独自実装が必要 |
| **リソース使用量** | **低い**（共有プロセス） | 高い（専用プロセス） |
| **バックグラウンド** | **豊富なAPI** | OS制限が厳しい |
| **インストール** | **1タップ** | ストア経由 |
| **URL共有** | **可能** | 不可能 |
| **SEO対応** | **対応** | 不可能 |
| **容量** | **軽量**（数百KB〜数MB） | 重い（専用エンジン込み） |

### 🎯 根本的な違い

**PWA**: 「ブラウザの一機能として最適化・共有」
- システム全体のブラウザエンジンを活用
- OS レベルでの最適化恩恵を受ける

**WebView**: 「アプリが専用ブラウザエンジンを内包」
- アプリごとに独立したエンジン
- リソース効率・機能アクセスで不利

---

## ブラウザ対応状況

### 📊 主要機能対応表（2025年9月時点）

| ブラウザ | Service Worker | PWAインストール | Web Push | Background Sync |
|----------|---------------|----------------|-----------|-----------------|
| **Chrome** | ✅ 40+ | ✅ 68+ | ✅ 42+ | ✅ 49+ |
| **Edge** | ✅ 17+ | ✅ 79+ | ✅ 79+ | ✅ 79+ |
| **Safari iOS** | ✅ 11.3+ | ✅ 11.3+ | ✅ 16.4+ | ❌ **未対応** |
| **Safari Mac** | ✅ 11.1+ | ✅ 17+ | ✅ 16+ | ❌ **未対応** |
| **Firefox** | ✅ 44+ | ✅ 78+ | ✅ 44+ | ❌ **未対応** |
| **Opera** | ✅ 27+ | ✅ 45+ | ✅ 42+ | ✅ 42+ |

### ⚠️ 重要な制約

#### **iOS Safari特有の制限**
- Background Sync API **完全未対応**
- 他ブラウザアプリでもWebKit強制のため同じ制限
- ストレージ上限: 約50MB
- プッシュ通知はSafari 16.4+から対応

#### **Android Chrome**
- 全機能フル対応
- Battery Saverモードで一部制限
- Storage上限: ディスク容量の約6%

---

##実装可能機能

### 🔥 強力な機能

#### **ストレージ・データ管理**
- **IndexedDB**: 数百MB〜数GBの構造化データ
- **Cache Storage**: HTTP応答のキャッシュ管理
- **Local Storage**: 簡易データ保存（5-10MB）

#### **デバイス連携**
```javascript
// カメラ・マイク
const stream = await navigator.mediaDevices.getUserMedia({video: true});

// 位置情報
const position = await navigator.geolocation.getCurrentPosition();

// Bluetooth接続
const device = await navigator.bluetooth.requestDevice();

// ファイルシステム
const fileHandle = await window.showOpenFilePicker();
```

#### **通知・共有**
```javascript
// リッチプッシュ通知
self.registration.showNotification('タイトル', {
  body: '本文',
  icon: '/icon.png',
  badge: '/badge.png',
  actions: [{action: 'reply', title: '返信'}],
  vibrate: [200, 100, 200]
});

// OS共有シート
await navigator.share({
  title: 'タイトル',
  text: 'テキスト',
  url: 'https://example.com'
});
```

#### **課金・決済**
```javascript
// Payment Request API
const payment = new PaymentRequest(methodData, details);
const result = await payment.show();
```

### ⚠️ 制限のある機能

#### **ネイティブ専用・制限あり**
- **高度3Dグラフィック**: WebGLでは限界あり
- **常駐バックグラウンドサービス**: 時間制限あり  
- **DRM**: 高レベルコンテンツ保護制限
- **ARCore/ARKit**: WebXR実装中だが制限多い
- **NFC P2P**: Web NFC APIは読み取りのみ

---

## バックグラウンド処理

### 🌐 Page Visibility APIとの組み合わせ

#### **visible時とhidden時の違い**

| 状態 | タイマー動作 | ネットワーク | Service Worker |
|------|-------------|--------------|----------------|
| **visible** | 正常動作 | ✅ 無制限 | ✅ 正常動作 |
| **hidden** | 1秒→30秒に延長 | ✅ 通信可能 | ✅ 正常動作 |

```javascript
// Page Visibility API
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // バックグラウンド時の処理
    console.log('アプリがバックグラウンドになりました');
  } else {
    // フォアグラウンド復帰時の処理
    console.log('アプリがフォアグラウンドに戻りました');
  }
});
```

### 🔄 Background Sync API

```javascript
// メインスレッド側
navigator.serviceWorker.ready.then(reg => {
  return reg.sync.register('background-sync');
});

// Service Worker側
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(sendQueuedData());
  }
});

async function sendQueuedData() {
  // IndexedDBからキューされたデータを取得・送信
  const queue = await getQueuedMessages();
  for (const message of queue) {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(message)
      });
      await removeFromQueue(message.id);
    } catch (error) {
      console.log('送信失敗、再試行は後で実行');
    }
  }
}
```

### 📱 Web Push API

```javascript
// プッシュ通知購読
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey
});

// サーバーに購読情報を送信
await fetch('/api/subscribe', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(subscription)
});
```

### 🔍 リアルタイムバックグラウンド通信の実証結果（2025-09-07検証）

**実装**: `realtime-background.js` でvisibilityState=hiddenでの通信制限を検証

#### **Chrome環境での観測データ**

| 状態 | 設定間隔 | 実際の間隔 | 制限状況 |
|------|---------|-----------|----------|
| **visible** | 1000ms | 983ms | ✅ 正常 |
| **hidden直後** | 1000ms | 2279ms | ⚠️ 2.3倍遅延 |
| **hidden継続** | 1000ms | 3597ms | ⚠️ 最大3.6倍遅延 |
| **visible復帰** | 1000ms | 574ms | ✅ 即座回復 |

#### **重要な発見**

1. **段階的スロットリング**
   - hidden時に即座に1分間隔にならず段階的に延長
   - 最大3.6秒まで延長を確認

2. **通信継続性**
   - 完全停止はせず、遅延しながらも通信継続
   - 56回の通信中、すべて成功

3. **復帰性能**
   - visible復帰時は即座に正常間隔に戻る
   - ユーザー体験への影響は限定的

#### **ブラウザ別制限まとめ（2025年9月時点）**

| ブラウザ | hidden時制限 | 30秒後制限 | 実証結果 |
|----------|-------------|-----------|----------|
| **Chrome** | 段階的延長 | 1分間隔 | ✅ 確認済み |
| **iOS Safari** | 30秒で切断 | 完全停止 | 🔍 要検証 |
| **Firefox** | 1秒丸め | 1秒丸め | 🔍 要検証 |

**実装提言**: リアルタイム通信が必要な場合は、Push通知+フォアグラウンド同期の組み合わせを推奨

---

## 実装チェックリスト

### 🔧 開発環境セットアップ
- [ ] HTTPS開発環境の構築（localhost使用可）
- [ ] Service Workerファイルの作成
- [ ] Web App Manifestの作成・リンク
- [ ] 必須アイコンファイル（192px, 512px）の準備

### 📝 基本実装
- [ ] Service Workerの登録処理
- [ ] fetchイベントハンドラの実装
- [ ] キャッシュ戦略の実装
- [ ] オフライン用フォールバックページ
- [ ] Web App Manifestの必須フィールド記載

### 🚀 高度な機能
- [ ] Background Sync APIの実装
- [ ] Web Push APIの実装
- [ ] Page Visibility APIの活用
- [ ] IndexedDBでのデータ永続化
- [ ] Service Worker更新処理

### 🧪 テスト・検証
- [ ] Chrome DevToolsでのService Worker動作確認
- [ ] オフライン動作テスト
- [ ] 各ブラウザでのインストールテスト
- [ ] バックグラウンド処理の動作確認
- [ ] パフォーマンス測定

### 📱 デプロイ
- [ ] HTTPS本番環境への配信
- [ ] Cache-Controlヘッダーの設定
- [ ] Service Workerバージョニング
- [ ] モニタリング・ログ設定

---

## 参考リンク

- [MDN - Progressive Web Apps](https://developer.mozilla.org/ja/docs/Web/Progressive_web_apps)
- [Google - Web.dev PWA](https://web.dev/progressive-web-apps/)
- [Can I Use - Service Workers](https://caniuse.com/serviceworkers)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

---

**作成日**: 2025-09-06  
**前回実装プロジェクト**: https://pwa-sample-project-82c16.web.app