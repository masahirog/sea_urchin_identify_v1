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

        // カメラ検出関連
        this.detectCamerasBtn = document.getElementById('detectCamerasBtn');
        this.cameraListContainer = document.getElementById('cameraListContainer');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.connectCameraBtn = document.getElementById('connectCameraBtn');
        this.detectionMessage = document.getElementById('detectionMessage');
        this.currentCameraInfo = document.getElementById('currentCameraInfo');
        this.currentCameraName = document.getElementById('currentCameraName');

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
        this.detectionSettings = document.getElementById('detectionSettings');

        // 判定パラメータ
        this.confidenceThreshold = document.getElementById('confidenceThreshold');
        this.confidenceValue = document.getElementById('confidenceValue');
        this.iouThreshold = document.getElementById('iouThreshold');
        this.iouValue = document.getElementById('iouValue');
        this.detectionSize = document.getElementById('detectionSize');
        this.updateDetectionParams = document.getElementById('updateDetectionParams');

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

        // カメラ検出関連のイベント
        this.detectCamerasBtn.addEventListener('click', () => this.detectCameras());
        this.connectCameraBtn.addEventListener('click', () => this.connectToSelectedCamera());

        // 判定パラメータのイベント
        if (this.confidenceThreshold) {
            this.confidenceThreshold.addEventListener('input', (e) => {
                this.confidenceValue.textContent = e.target.value;
            });
        }
        if (this.iouThreshold) {
            this.iouThreshold.addEventListener('input', (e) => {
                this.iouValue.textContent = e.target.value;
            });
        }
        if (this.updateDetectionParams) {
            this.updateDetectionParams.addEventListener('click', () => this.applyDetectionParameters());
        }
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
                this.detectCamerasBtn.disabled = true;  // カメラ検出ボタンを無効化

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
                this.detectCamerasBtn.disabled = false;  // カメラ検出ボタンを有効化

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
            this.detectionSettings.style.display = 'block';  // 設定パネルを表示

            // 判定付きビデオフィードに切り替え
            if (this.isRunning) {
                // 現在のパラメータを含めてURLを構築
                const params = this.getDetectionParams();
                const queryString = new URLSearchParams(params).toString();
                this.videoFeed.src = `/camera/video_feed?${queryString}`;
                console.log('判定機能を有効化:', params);

                // 統計情報の定期更新を開始
                this.startStatsUpdate();
            }
        } else {
            this.detectionStats.style.display = 'none';
            this.detectionSettings.style.display = 'none';  // 設定パネルを非表示

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

    async detectCameras() {
        try {
            this.detectionMessage.textContent = 'カメラを検出中...';
            this.detectCamerasBtn.disabled = true;

            const response = await fetch('/camera/detect');
            const data = await response.json();

            if (response.ok && data.cameras.length > 0) {
                // カメラリストを表示
                this.cameraListContainer.style.display = 'block';
                this.cameraSelect.innerHTML = '';

                data.cameras.forEach(camera => {
                    const option = document.createElement('option');
                    option.value = camera.index;
                    option.textContent = `${camera.name} (${camera.width}x${camera.height})`;
                    if (camera.index === this.currentCameraIndex) {
                        option.selected = true;
                        // 現在接続中のカメラを表示
                        this.updateCurrentCameraDisplay(camera.name, camera.width, camera.height);
                    }
                    this.cameraSelect.appendChild(option);
                });

                this.detectionMessage.textContent = `${data.cameras.length}台のカメラを検出しました`;
                this.detectionMessage.className = 'text-success small mt-2';
            } else {
                this.detectionMessage.textContent = 'カメラが検出されませんでした';
                this.detectionMessage.className = 'text-warning small mt-2';
                this.cameraListContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('カメラ検出エラー:', error);
            this.detectionMessage.textContent = 'カメラ検出に失敗しました';
            this.detectionMessage.className = 'text-danger small mt-2';
        } finally {
            this.detectCamerasBtn.disabled = false;
        }
    }

    async connectToSelectedCamera() {
        const selectedIndex = parseInt(this.cameraSelect.value);

        if (selectedIndex === this.currentCameraIndex) {
            this.detectionMessage.textContent = 'すでに選択されているカメラです';
            this.detectionMessage.className = 'text-info small mt-2';
            return;
        }

        try {
            this.connectCameraBtn.disabled = true;
            this.detectionMessage.textContent = 'カメラに接続中...';
            this.detectionMessage.className = 'text-info small mt-2';

            // カメラを停止
            if (this.isRunning) {
                await this.stopCamera();
            }

            // カメラを切り替え
            const response = await fetch('/camera/switch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ camera_index: selectedIndex })
            });

            const data = await response.json();

            if (response.ok) {
                // ページをリロードして新しいカメラに切り替え
                window.location.href = `/camera/${selectedIndex}`;
            } else {
                this.detectionMessage.textContent = `接続失敗: ${data.message}`;
                this.detectionMessage.className = 'text-danger small mt-2';
            }
        } catch (error) {
            console.error('カメラ接続エラー:', error);
            this.detectionMessage.textContent = 'カメラ接続に失敗しました';
            this.detectionMessage.className = 'text-danger small mt-2';
        } finally {
            this.connectCameraBtn.disabled = false;
        }
    }

    updateCurrentCameraDisplay(name, width, height) {
        // 現在接続中のカメラ情報を表示
        this.currentCameraInfo.style.display = 'block';
        this.currentCameraName.textContent = `${name} (${width}x${height})`;
    }

    getDetectionParams() {
        return {
            detection: 'true',
            confidence: this.confidenceThreshold ? this.confidenceThreshold.value : 0.25,
            iou: this.iouThreshold ? this.iouThreshold.value : 0.45,
            size: this.detectionSize ? this.detectionSize.value : 640
        };
    }

    async applyDetectionParameters() {
        // パラメータをサーバーに送信
        const params = this.getDetectionParams();

        try {
            const response = await fetch('/camera/update_detection_params', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(params)
            });

            const data = await response.json();

            if (response.ok) {
                // ビデオフィードを再起動して新しいパラメータを適用
                if (this.isRunning && this.detectionEnabled) {
                    const queryString = new URLSearchParams(params).toString();
                    this.videoFeed.src = `/camera/video_feed?${queryString}`;
                }
                this.showNotification('パラメータを更新しました', 'success');
            } else {
                alert('パラメータ更新エラー: ' + data.message);
            }
        } catch (error) {
            console.error('パラメータ更新エラー:', error);
            alert('パラメータの更新に失敗しました');
        }
    }

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