// リアルタイムバックグラウンド通信テスト機能
// Page Visibility API + 定期通信でバックグラウンド状態での通信制限を検証

class BackgroundRealtimeTester {
  constructor() {
    this.intervalId = null;
    this.startTime = null;
    this.requestCount = 0;
    this.isRunning = false;
    this.logEl = null;
    this.intervalMs = 1000; // 1秒間隔から開始
  }

  init() {
    this.logEl = document.getElementById('realtime-log');
    this.bindEvents();
  }

  bindEvents() {
    // 定期通信開始/停止ボタン
    document.getElementById('start-realtime').addEventListener('click', () => {
      if (this.isRunning) {
        this.stop();
      } else {
        this.start();
      }
    });

    // インターバル設定変更
    document.getElementById('interval-select').addEventListener('change', (e) => {
      this.intervalMs = parseInt(e.target.value);
      if (this.isRunning) {
        this.restart();
      }
    });

    // Page Visibility監視
    document.addEventListener('visibilitychange', () => {
      this.logVisibilityChange();
    });
  }

  start() {
    this.startTime = new Date();
    this.requestCount = 0;
    this.isRunning = true;
    
    this.log(`🚀 リアルタイム通信開始 (${this.intervalMs}ms間隔)`, 'start');
    this.updateButtonState();
    
    this.intervalId = setInterval(() => {
      this.sendRealtimeRequest();
    }, this.intervalMs);

    // 最初の1回も即座に実行
    this.sendRealtimeRequest();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.log(`⏹️ リアルタイム通信停止 (総${this.requestCount}回)`, 'stop');
    this.updateButtonState();
  }

  restart() {
    this.stop();
    setTimeout(() => this.start(), 100);
  }

  async sendRealtimeRequest() {
    const requestTime = new Date();
    const elapsed = Math.round((requestTime - this.startTime) / 1000);
    this.requestCount++;

    const payload = {
      requestId: this.requestCount,
      timestamp: requestTime.toISOString(),
      visibilityState: document.visibilityState,
      elapsed: elapsed,
      userAgent: navigator.userAgent.slice(0, 50) + '...'
    };

    try {
      const response = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const actualInterval = this.getActualInterval();
        this.log(
          `✅ #${this.requestCount} (${elapsed}s) 通信成功 [${document.visibilityState}] 実際の間隔: ${actualInterval}`, 
          document.visibilityState === 'visible' ? 'success' : 'background-success'
        );
      } else {
        this.log(`❌ #${this.requestCount} HTTP ${response.status}`, 'error');
      }
    } catch (error) {
      this.log(`❌ #${this.requestCount} ネットワークエラー: ${error.message}`, 'error');
    }

    this.lastRequestTime = requestTime;
  }

  getActualInterval() {
    if (!this.lastRequestTime) return `${this.intervalMs}ms`;
    
    const now = new Date();
    const actualMs = now - this.lastRequestTime;
    
    if (actualMs > this.intervalMs * 50) {  // 50倍以上の遅延
      return `${Math.round(actualMs / 1000)}s (大幅遅延)`;
    } else if (actualMs > this.intervalMs * 2) {  // 2倍以上の遅延
      return `${actualMs}ms (遅延)`;
    } else {
      return `${actualMs}ms`;
    }
  }

  logVisibilityChange() {
    const now = new Date().toLocaleTimeString('ja-JP');
    const state = document.visibilityState;
    
    if (state === 'visible') {
      this.log(`👁️ ${now}: フォアグラウンドに復帰`, 'visibility');
    } else {
      this.log(`🫣 ${now}: バックグラウンドに移行`, 'visibility');
    }
  }

  log(message, type = 'info') {
    if (!this.logEl) return;

    const li = document.createElement('li');
    li.textContent = message;
    
    // スタイル設定
    switch (type) {
      case 'start':
        li.style.color = '#059669';
        li.style.fontWeight = 'bold';
        break;
      case 'stop':
        li.style.color = '#dc2626';
        li.style.fontWeight = 'bold';
        break;
      case 'success':
        li.style.color = '#059669';
        break;
      case 'background-success':
        li.style.color = '#0ea5e9';  // バックグラウンド時は青色
        break;
      case 'error':
        li.style.color = '#dc2626';
        break;
      case 'visibility':
        li.style.color = '#7c3aed';
        li.style.fontWeight = 'bold';
        break;
      default:
        li.style.color = '#6b7280';
    }

    // 最新ログを上に追加
    this.logEl.insertBefore(li, this.logEl.firstChild);

    // ログが50件を超えたら古いものを削除
    while (this.logEl.children.length > 50) {
      this.logEl.removeChild(this.logEl.lastChild);
    }
  }

  updateButtonState() {
    const button = document.getElementById('start-realtime');
    if (this.isRunning) {
      button.textContent = '⏹️ 停止';
      button.style.backgroundColor = '#dc2626';
    } else {
      button.textContent = '🚀 開始';
      button.style.backgroundColor = '#059669';
    }
  }

  // 統計情報取得
  getStats() {
    const elapsed = this.startTime ? Math.round((new Date() - this.startTime) / 1000) : 0;
    return {
      isRunning: this.isRunning,
      requestCount: this.requestCount,
      elapsedSeconds: elapsed,
      averageInterval: elapsed > 0 ? elapsed / this.requestCount : 0
    };
  }
}

// グローバルインスタンス作成
window.backgroundTester = new BackgroundRealtimeTester();

// 統計表示関数をグローバルに公開
window.showRealtimeStats = function() {
  const stats = window.backgroundTester.getStats();
  const logEl = document.getElementById('realtime-log');
  
  const li = document.createElement('li');
  li.innerHTML = `📊 統計: ${stats.requestCount}回送信, ${stats.elapsedSeconds}秒経過, 平均間隔: ${stats.averageInterval.toFixed(1)}秒`;
  li.style.color = '#f59e0b';
  li.style.fontWeight = 'bold';
  li.style.borderTop = '1px solid #e5e7eb';
  li.style.paddingTop = '8px';
  li.style.marginTop = '8px';
  
  logEl.insertBefore(li, logEl.firstChild);
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  window.backgroundTester.init();
});