# Web App Manifest 解説

> 📚 **初学者向け**: このファイルは ../README.md の Phase 3 で読むことを推奨します

## Web App Manifest とは

PWAがネイティブアプリのように動作するためのメタデータファイルです。
このファイルがあることで、ブラウザは「ホーム画面に追加」機能を提供できます。

## 主要プロパティ解説（manifest.webmanifest参照）

### 基本情報
```json
{
  "name": "GCE PWA + SW Sample",        // アプリの正式名称
  "short_name": "PWA-Sample",           // ホーム画面での短縮名
  "start_url": "/",                     // アプリ起動時のURL
}
```

### 表示設定
```json
{
  "display": "standalone",              // ブラウザUIを非表示（アプリ風）
  "background_color": "#ffffff",        // スプラッシュ画面背景色
  "theme_color": "#0ea5e9",            // ステータスバーの色
}
```

### アイコン設定
```json
{
  "icons": [
    {
      "src": "/icons/icon-192.png",     // 192x192px（必須）
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "/icons/icon-512.png",     // 512x512px（推奨）
      "type": "image/png", 
      "sizes": "512x512"
    }
  ]
}
```

## 重要なポイント

1. **ファイル名**: `.webmanifest` 拡張子を使用
2. **MIME Type**: `application/manifest+json` で配信必須
3. **アイコンサイズ**: 192px は最低必須、512px は高解像度対応
4. **display: standalone**: ブラウザのURLバーが非表示になる

## ブラウザでの確認方法

Chrome DevTools → Application → Manifest で内容を確認できます。

---

このファイルの設定により、ユーザーは「ホーム画面に追加」でPWAをインストールできるようになります。