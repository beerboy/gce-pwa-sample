# GCE 上に PWA + Service Worker をデプロイして外部公開するサンプル

> 前提: Service Worker は **HTTPS または localhost** でのみ動作します。外部からアクセスさせるため、この手順では Let's Encrypt を使って HTTPS 化します（独自ドメインが必要）。

## 📚 初学者向け学習順序

PWA/Service Workerを初めて学ぶ方は、以下の順序で進めることを推奨します：

### **Phase 1: 概念理解**
1. **[PWA-GUIDE.md](docs/PWA-GUIDE.md)** の「PWAとは」「Minimum Requirements」
   - PWAとService Workerの基本概念
   - 必要最低限の要件を理解

### **Phase 2: 実体験**
2. **本番環境でPWAを体験**: https://pwa-sample-project-82c16.web.app
   - スマホでアクセス → ホーム画面に追加
   - オフライン時の動作確認
   - 実際の「PWA体験」を理解
   - 詳細: **[DEMO-GUIDE.md](docs/DEMO-GUIDE.md)** 参照

### **Phase 3: コード構造把握**
3. **[pwa/index.html](pwa/index.html)** - メインUI
4. **[pwa/manifest.webmanifest](pwa/manifest.webmanifest)** - PWAメタデータ
5. **[pwa/sw.js](pwa/sw.js)** - Service Worker核心部分

### **Phase 4: 高度な機能**
6. **[pwa/background-sync.js](pwa/background-sync.js)** - オフライン時データ送信
7. **[PWA-GUIDE.md](docs/PWA-GUIDE.md)** の「バックグラウンド処理」「ブラウザ対応状況」

### **Phase 5: 全体設計理解**
8. **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - アーキテクチャ全体
9. **このREADME.md** - デプロイ手順

### 💡 学習のコツ
- **体験重視**: 必ずスマホで実際のPWAを触る
- **段階的理解**: Service Workerの概念が最重要
- **実践的学習**: DevToolsで実際の動作を確認

---

## 📖 ドキュメント構成

このプロジェクトは目的・読者に応じて複数のドキュメントで構成されています：

### **学習・理解用**
- **[PWA-GUIDE.md](docs/PWA-GUIDE.md)** 📚 *初学者必読*
  - PWAとService Workerの技術詳細
  - ブラウザ対応状況・実装可能機能
  - **対象**: PWA初学者、技術理解を深めたい方

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** 🏗️ *上級者向け*
  - プロジェクト全体のアーキテクチャ詳細
  - データフロー・各ファイルの役割
  - **対象**: システム設計者、詳細実装を理解したい方

### **実装・運用用**
- **[このREADME.md](README.md)** 🚀 *実践者向け*
  - 学習順序ガイド（初学者向け）
  - GCE・Firebase Hostingデプロイ手順
  - **対象**: 実際にデプロイ・運用する方

- **[SESSION-LOG.md](docs/SESSION-LOG.md)** 📝 *開発記録*
  - 学習セッション記録・技術検証結果
  - 実装過程での発見・知見
  - **対象**: 開発経緯を追いたい方

### **応用・発展用**
- **[AAOS-INTEGRATION.md](docs/AAOS-INTEGRATION.md)** 🚗 *車載応用*
  - Android Automotive OS環境での実現可能性
  - OEMパートナーシップ戦略・技術制約
  - **対象**: 車載環境への応用を検討する方

### **補助資料**
- **[DEMO-GUIDE.md](docs/DEMO-GUIDE.md)** 🎮 *体験ガイド*
  - 本番環境PWAの機能詳細・テスト方法
  - **対象**: 実際にPWAを体験・検証したい方

- **[manifest-guide.md](docs/manifest-guide.md)** 🔧 *技術詳細*
  - Web App Manifestの詳細解説
  - **対象**: PWAマニフェストを理解したい方

### 📋 **読む順序の推奨**
```
初学者    : README.md → docs/PWA-GUIDE.md → 実装ファイル → docs/ARCHITECTURE.md
開発者    : docs/ARCHITECTURE.md → 実装ファイル → docs/SESSION-LOG.md
車載応用  : docs/PWA-GUIDE.md → docs/AAOS-INTEGRATION.md
運用担当  : README.md → デプロイ手順
```

---

## 🚀 デプロイ手順（本格運用向け）

## 0. 用意するもの
- GCP プロジェクト (課金有効)
- 独自ドメイン（例: `example.com`）
- ローカルに `gcloud` CLI か、GCP コンソールが使用可能

## 1. GCE インスタンス作成（東京リージョン例）
```bash
PROJECT_ID=$(gcloud config get-value project)
ZONE=asia-northeast1-b
NAME=pwa-demo

# e2-micro は無料枠の対象リージョンに注意
gcloud compute instances create "$NAME"   --zone "$ZONE"   --machine-type e2-micro   --image-family=ubuntu-2204-lts   --image-project=ubuntu-os-cloud   --tags=http-server,https-server   --boot-disk-size=10GB
```

外部 IP を確認します:
```bash
gcloud compute instances describe "$NAME" --zone "$ZONE"   --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

## 2. ファイアウォール（HTTP/HTTPS）
上記 `--tags=http-server,https-server` を付けたので、下記のルールを作成します（未作成の場合のみ）:
```bash
gcloud compute firewall-rules create allow-http   --allow tcp:80 --target-tags=http-server

gcloud compute firewall-rules create allow-https   --allow tcp:443 --target-tags=https-server
```

## 3. DNS を設定
ドメインの DNS で A レコードを GCE の外部 IP に向けます。例:
```
pwa.example.com.  300  IN  A  <GCEの外部IP>
```

## 4. VM に SSH & Nginx + Certbot セットアップ
```bash
gcloud compute ssh "$NAME" --zone "$ZONE"

# --- VM 内 ---
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

## 5. サンプル PWA を配置
この ZIP を展開し、`pwa/` ディレクトリの中身を VM の `/var/www/pwa/` に配置します。

```bash
# --- VM 内 ---
sudo mkdir -p /var/www/pwa
# 例: ローカルから scp でアップロード
# scp -r pwa/* <USER>@<VM_IP>:/tmp/pwa/
# VM で:
# sudo cp -r /tmp/pwa/* /var/www/pwa/
sudo chown -R www-data:www-data /var/www/pwa
```

## 6. Nginx のサーバーブロックを設定
Ubuntu/Debian の場合（sites-available/ sites-enabled スタイル）:
```bash
sudo cp ubuntu-pwa.conf /etc/nginx/sites-available/pwa
sudo sed -i 's/YOUR_DOMAIN_HERE/pwa.example.com/' /etc/nginx/sites-available/pwa
sudo ln -s /etc/nginx/sites-available/pwa /etc/nginx/sites-enabled/pwa
sudo nginx -t && sudo systemctl reload nginx
```

RHEL/AlmaLinux/CentOS の場合（`/etc/nginx/conf.d/` スタイル）:
```bash
sudo cp rhel-pwa.conf /etc/nginx/conf.d/pwa.conf
sudo sed -i 's/YOUR_DOMAIN_HERE/pwa.example.com/' /etc/nginx/conf.d/pwa.conf
sudo nginx -t && sudo systemctl reload nginx
```

> `YOUR_DOMAIN_HERE` をあなたのドメインに置き換えてください。

## 7. Let's Encrypt で HTTPS 化（自動更新付き）
```bash
# メールアドレスとドメインを指定
sudo certbot --nginx -d pwa.example.com   --redirect -m you@example.com --agree-tos -n
```
- 自動で 443 向けの設定が追加され、HTTP→HTTPS リダイレクトも有効化されます。
- 証明書は `systemd` タイマーにより自動更新されます（`systemctl list-timers` 参照）。

## 8. 動作確認
- `https://pwa.example.com/` にアクセス
- DevTools → Application → Service Workers で登録状況を確認
- 一度表示後、ネットワークを切っても `/offline.html` へフォールバックすることを確認

## 9. 参考（ドメインが無い場合）
Service Worker は HTTPS が必須です。独自ドメインが無い場合は以下のいずれかを検討してください。
- いったんローカル開発（`localhost` は例外的に HTTP でも可）
- Cloudflare Tunnel 等のトンネルサービスで HTTPS 化（DNS 設定不要）
- 低コストのドメイン取得 + A レコードで GCE IP に向ける

## 10. ディレクトリ構成（このサンプル）
```
gce-pwa-sample/
├─ pwa/
│  ├─ index.html
│  ├─ offline.html
│  ├─ sw.js
│  ├─ background-sync.js
│  ├─ realtime-background.js    ← NEW: リアルタイム通信検証
│  ├─ sw-update.js
│  ├─ client.js
│  ├─ manifest.webmanifest
│  └─ icons/
│     ├─ icon-192.png
│     └─ icon-512.png
├─ nginx/
│  ├─ ubuntu-pwa.conf
│  └─ rhel-pwa.conf
├─ docs/                        ← ドキュメントディレクトリ
│  ├─ SESSION-LOG.md           ← 学習セッション記録
│  ├─ PWA-GUIDE.md             ← PWA技術ガイド
│  ├─ ARCHITECTURE.md          ← システムアーキテクチャ詳細
│  ├─ AAOS-INTEGRATION.md      ← 車載環境統合ガイド
│  ├─ DEMO-GUIDE.md            ← 本番環境PWA体験ガイド
│  └─ manifest-guide.md        ← Web App Manifest解説
├─ firebase.json               ← Firebase Hosting設定
└─ .firebaserc
```

---

### よくあるハマりどころ
- **HTTP で開いている** → SW が登録されません。必ず `https://` で。
- **`/sw.js` のパス** → スコープは配置パス以下に作用します。ルート配下に置くのが無難。
- **MIME タイプ** → `.webmanifest` は `application/manifest+json` で配信。
- **キャッシュ更新が反映されない** → `CACHE_VERSION` を上げるか、キャッシュを削除。
