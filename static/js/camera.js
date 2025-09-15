/**
 * カメラ制御用JavaScript
 */

class CameraController {
    constructor() {
        this.isRunning = false;
        this.detectionEnabled = false;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // ビデオ要素
        this.videoFeed = document.getElementById('videoFeed');
        this.detectionOverlay = document.getElementById('detectionOverlay');

        // ボタン
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.snapshotBtn = document.getElementById('snapshotBtn');

        // ステータス
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');

        // 情報表示
        this.cameraInfo = document.getElementById('infoText');
        this.fpsValue = document.getElementById('fpsValue');
        this.detectionCount = document.getElementById('detectionCount');

        // 判定トグル
        this.detectionToggle = document.getElementById('detectionToggle');
        this.detectionStats = document.getElementById('detectionStats');

        // スナップショット
        this.snapshotPreview = document.getElementById('snapshotPreview');

        // URLパスからカメラインデックスを取得
        const pathParts = window.location.pathname.split('/');
        this.currentCameraIndex = pathParts[2] ? parseInt(pathParts[2]) : 0;
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.snapshotBtn.addEventListener('click', () => this.captureSnapshot());
        this.detectionToggle.addEventListener('change', (e) => this.toggleDetection(e.target.checked));
    }

    async startCamera() {
        try {
            this.setStatus('loading', '接続中...');

            const response = await fetch('/camera/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            const data = await response.json();

            if (response.ok) {
                this.isRunning = true;
                this.setStatus('active', '配信中');

                // ビデオフィードを開始（判定モードに応じて）
                const detectionParam = this.detectionEnabled ? '?detection=true' : '';
                this.videoFeed.src = '/camera/video_feed' + detectionParam;

                // ボタンの状態を更新
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.snapshotBtn.disabled = false;

                // カメラ情報を取得
                this.updateCameraInfo();

                console.log('カメラ開始成功:', data.message);
            } else {
                this.setStatus('error', 'エラー');
                alert('カメラの開始に失敗しました: ' + data.message);
            }
        } catch (error) {
            console.error('カメラ開始エラー:', error);
            this.setStatus('error', 'エラー');
            alert('カメラの開始に失敗しました');
        }
    }

    async stopCamera() {
        try {
            const response = await fetch('/camera/stop', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            const data = await response.json();

            if (response.ok) {
                this.isRunning = false;
                this.setStatus('inactive', '停止中');

                // ビデオフィードを停止
                this.videoFeed.src = '';

                // ボタンの状態を更新
                this.startBtn.disabled = false;
                this.stopBtn.disabled = true;
                this.snapshotBtn.disabled = true;

                // 判定を無効化
                if (this.detectionEnabled) {
                    this.detectionToggle.checked = false;
                    this.toggleDetection(false);
                }

                console.log('カメラ停止成功:', data.message);
            }
        } catch (error) {
            console.error('カメラ停止エラー:', error);
        }
    }

    async captureSnapshot() {
        try {
            const response = await fetch('/camera/snapshot', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            const data = await response.json();

            if (response.ok) {
                // スナップショットプレビューを更新
                const timestamp = new Date().getTime();
                this.snapshotPreview.innerHTML = `
                    <img src="/uploads/snapshots/${data.filename}?t=${timestamp}"
                         class="img-fluid snapshot-preview"
                         alt="スナップショット">
                    <p class="mt-2 mb-0"><small>${data.filename}</small></p>
                `;

                // 成功メッセージ
                this.showNotification('スナップショットを保存しました', 'success');
            } else {
                alert('スナップショットの保存に失敗しました: ' + data.message);
            }
        } catch (error) {
            console.error('スナップショット取得エラー:', error);
            alert('スナップショットの保存に失敗しました');
        }
    }

    async updateCameraInfo() {
        try {
            const response = await fetch('/camera/info');
            const info = await response.json();

            if (!info.error) {
                this.cameraInfo.textContent = `解像度: ${info.width}x${info.height} | FPS: ${info.fps.toFixed(1)} | バックエンド: ${info.backend}`;
            }
        } catch (error) {
            console.error('カメラ情報取得エラー:', error);
        }
    }

    toggleDetection(enabled) {
        this.detectionEnabled = enabled;

        if (enabled) {
            this.detectionStats.style.display = 'block';

            // 判定付きビデオフィードに切り替え
            if (this.isRunning) {
                this.videoFeed.src = '/camera/video_feed?detection=true';
                console.log('判定機能を有効化');

                // 統計情報の定期更新を開始
                this.startStatsUpdate();
            }
        } else {
            this.detectionStats.style.display = 'none';

            // 通常のビデオフィードに戻す
            if (this.isRunning) {
                this.videoFeed.src = '/camera/video_feed?detection=false';
                console.log('判定機能を無効化');

                // 統計情報の更新を停止
                this.stopStatsUpdate();
            }

            // オーバーレイをクリア
            const ctx = this.detectionOverlay.getContext('2d');
            ctx.clearRect(0, 0, this.detectionOverlay.width, this.detectionOverlay.height);
        }
    }

    startStatsUpdate() {
        // 統計情報を定期的に更新
        this.statsInterval = setInterval(async () => {
            try {
                const response = await fetch('/camera/detection/stats');
                const stats = await response.json();

                if (stats.fps !== undefined) {
                    this.fpsValue.textContent = stats.fps.toFixed(1);
                }
                if (stats.total_detections !== undefined) {
                    this.detectionCount.textContent = stats.total_detections;
                }
            } catch (error) {
                console.error('統計取得エラー:', error);
            }
        }, 1000); // 1秒ごとに更新
    }

    stopStatsUpdate() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    setStatus(status, text) {
        this.statusText.textContent = text;
        this.statusIndicator.className = 'status-indicator';

        switch (status) {
            case 'active':
                this.statusIndicator.classList.add('status-active');
                break;
            case 'inactive':
                this.statusIndicator.classList.add('status-inactive');
                break;
            case 'loading':
                this.statusIndicator.classList.add('status-inactive');
                break;
            case 'error':
                this.statusIndicator.classList.add('status-inactive');
                break;
        }
    }

    // カメラ切り替えはページ遷移で対応するため、JavaScriptでの切り替え処理は不要

    showNotification(message, type = 'info') {
        // 簡易的な通知表示
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);

        // 3秒後に自動で削除
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', () => {
    const controller = new CameraController();
    console.log('カメラコントローラー初期化完了');
});