/**
 * ウニ生殖乳頭分析システム - サンプル分析モジュール
 * サンプル画像の分析と結果表示を担当するモジュール
 */

// モジュールの状態を管理する変数
const sampleAnalysis = {
    currentSample: null,
    analysisInProgress: false
};

/**
 * ページ初期化処理
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - サンプル分析ページ初期化開始');
    initSampleAnalysisPage();
});

/**
 * サンプル分析ページの初期化
 */
function initSampleAnalysisPage() {
    console.log('サンプル分析ページの初期化開始');
    
    // 前回選択されていたサンプルを復元
    restoreLastSelectedSample();
    
    // サンプルカードのクリックイベント設定
    initSampleCardEvents();
    
    // サンプル画像アップロードフォーム
    initSampleUploadForm();
    
    // ファイル選択の表示更新
    initFileInputDisplay();
    
    // ページタイトルにサンプル数を表示
    updatePageTitle();
    
    console.log('サンプル分析ページの初期化完了');
}

/**
 * 前回選択されていたサンプルを復元
 */
function restoreLastSelectedSample() {
    const lastSelectedSample = getFromSession('lastSelectedSample');
    if (lastSelectedSample) {
        console.log('前回選択サンプルを復元:', lastSelectedSample);
        const sampleCard = document.querySelector(`.sample-card[data-path="${lastSelectedSample}"]`);
        if (sampleCard) {
            sampleCard.classList.add('selected-sample');
            analyzeSample(lastSelectedSample);
            // 使用後にクリア
            removeFromSession('lastSelectedSample');
        }
    }
}

/**
 * サンプルカードのクリックイベント設定
 */
function initSampleCardEvents() {
    const sampleCards = document.querySelectorAll('.sample-card');
    console.log(`サンプルカード数: ${sampleCards.length}`);
    
    sampleCards.forEach((card, index) => {
        console.log(`サンプルカード ${index + 1}: data-path="${card.dataset.path}"`);
        
        card.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('サンプルカードクリック:', this.dataset.path);
            
            // 選択状態の更新
            document.querySelectorAll('.sample-card').forEach(c => {
                c.classList.remove('selected-sample');
            });
            this.classList.add('selected-sample');
            
            // サンプルデータを保存
            sampleAnalysis.currentSample = this.dataset.path;
            console.log('現在のサンプル設定:', sampleAnalysis.currentSample);
            
            // サンプル分析
            analyzeSample(this.dataset.path);
        });
        
        // キーボードアクセシビリティ対応
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
        
        // フォーカス可能にする
        card.setAttribute('tabindex', '0');
    });
}

/**
 * サンプルアップロードフォームの初期化
 */
function initSampleUploadForm() {
    const uploadForm = document.getElementById('uploadSampleForm');
    if (uploadForm) {
        console.log('アップロードフォームイベント設定');
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('アップロードフォーム送信');
            uploadSample();
        });
    }
}

/**
 * ファイル選択の表示更新
 */
function initFileInputDisplay() {
    const fileInput = document.getElementById('sampleFile');
    const fileNameDisplay = document.querySelector('.file-name');
    
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function() {
            const fileName = this.files.length > 0 ? this.files[0].name : '選択されていません';
            fileNameDisplay.textContent = fileName;
            console.log('ファイル選択:', fileName);
        });
    }
}

/**
 * サンプル画像を分析
 * @param {string} imagePath - 分析する画像のパス
 */
function analyzeSample(imagePath) {
    if (!imagePath) {
        console.error('画像パスが指定されていません');
        return;
    }
    
    console.log('サンプル分析開始:', imagePath);
    
    // 分析中の場合は処理をキャンセル
    if (sampleAnalysis.analysisInProgress) {
        console.log('分析実行中のため処理をスキップ');
        return;
    }
    sampleAnalysis.analysisInProgress = true;
    
    // プレースホルダーを非表示、分析結果を表示
    const placeholderElement = document.getElementById('analysisPlaceholder');
    const resultElement = document.getElementById('analysisResult');
    
    if (placeholderElement) placeholderElement.classList.add('d-none');
    if (resultElement) {
        resultElement.classList.remove('d-none');
        
        // ローディング表示
        resultElement.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">分析中...</span>
                </div>
                <p class="mt-2">サンプルを分析しています...</p>
            </div>
        `;
    }
    
    // 分析リクエスト
    fetch('/sample/analyze-sample', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'image_path': imagePath
        })
    })
    .then(response => {
        console.log('サーバーレスポンス受信:', response.status, response.ok);
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('サーバーからのレスポンス:', data);
        if (data.error) {
            console.error('分析エラー:', data.error);
            showError('analysisResult', data.error);
            return;
        }
        
        // 分析結果の表示
        displayAnalysisResult(imagePath, data);
    })
    .catch(error => {
        console.error('分析エラー:', error);
        showError('analysisResult', '分析中にエラーが発生しました: ' + error.message);
    })
    .finally(() => {
        sampleAnalysis.analysisInProgress = false;
        console.log('サンプル分析処理完了');
    });
}

/**
 * 分析結果の表示
 * @param {string} imagePath - サンプル画像のパス
 * @param {Object} data - 分析結果データ
 */
function displayAnalysisResult(imagePath, data) {
    console.log('分析結果表示開始:', data);
    
    const resultElement = document.getElementById('analysisResult');
    if (!resultElement) {
        console.error('分析結果表示要素が見つかりません');
        return;
    }
    
    // データの構造を確認
    if (!data || !data.basic_stats) {
        console.error('データの形式が不正です:', data);
        showError('analysisResult', 'データの形式が不正です');
        return;
    }
    
    // HTML生成
    let html = createAnalysisResultHTML(imagePath, data);
    
    // 結果の表示
    resultElement.innerHTML = html;
    resultElement.classList.remove('d-none');
    
    // 結果表示後、アノテーション開始ボタンにイベントリスナーを追加
    setTimeout(() => {
        addAnnotationButtonListener();
    }, 100);
    
    console.log('分析結果表示完了');
}

/**
 * 分析結果のHTML生成
 * @param {string} imagePath - 画像パス
 * @param {Object} data - 分析データ
 * @returns {string} HTML文字列
 */
function createAnalysisResultHTML(imagePath, data) {
    const fileName = imagePath.split('/').pop();
    const hasAnnotation = data.shape_features && Object.keys(data.shape_features).length > 0;
    
    let html = `
        <div class="analysis-content">
            <h3>分析結果: ${fileName}</h3>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="text-center mb-3">
                        <img src="/sample/${imagePath}" class="img-fluid rounded" style="max-height: 300px;" alt="サンプル画像">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="analysis-grid">
                        <!-- 基本統計情報 -->
                        <div class="analysis-card">
                            <h4><i class="fas fa-chart-bar"></i> 基本統計</h4>
                            <p><strong>画像サイズ:</strong> ${data.basic_stats.size[1]} × ${data.basic_stats.size[0]} px</p>
                            <p><strong>平均輝度:</strong> ${data.basic_stats.mean.toFixed(2)}</p>
                            <p><strong>標準偏差:</strong> ${data.basic_stats.std.toFixed(2)}</p>
                        </div>
                        
                        <!-- 検出結果 -->
                        <div class="analysis-card">
                            <h4><i class="fas fa-search"></i> 検出結果</h4>
                            <p><strong>生殖乳頭検出数:</strong> ${data.detection_result.papillae_count}個</p>
                        </div>
                        
                        <!-- エッジ特徴 -->
                        <div class="analysis-card">
                            <h4><i class="fas fa-vector-square"></i> エッジ特徴</h4>
                            <p><strong>エッジ数:</strong> ${data.edge_features.edge_count}</p>
                            <p><strong>エッジ密度:</strong> ${(data.edge_features.edge_density * 100).toFixed(2)}%</p>
                        </div>
                        
                        <!-- テクスチャ特徴 -->
                        <div class="analysis-card">
                            <h4><i class="fas fa-texture"></i> テクスチャ特徴</h4>
                            <p><strong>コントラスト:</strong> ${data.texture_features.contrast.toFixed(2)}</p>
                            <p><strong>均一性:</strong> ${data.texture_features.uniformity.toFixed(4)}</p>
                        </div>
                    </div>
                </div>
            </div>
    `;
    
    // アノテーション状態に応じた表示
    if (hasAnnotation) {
        html += `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        このサンプルはアノテーション済みです
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h5><i class="fas fa-shapes"></i> 形状特性</h5>
                            <div class="analysis-card">
                                <p><strong>面積:</strong> ${data.shape_features.area.toFixed(2)} px²</p>
                                <p><strong>周囲長:</strong> ${data.shape_features.perimeter.toFixed(2)} px</p>
                                <p><strong>円形度:</strong> ${data.shape_features.circularity.toFixed(4)}</p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h5><i class="fas fa-image"></i> アノテーション結果</h5>
                            <div class="text-center p-2 border rounded">
                                <img src="/static/${data.annotation_path}" class="img-fluid" style="max-height: 200px;" alt="アノテーション画像">
                            </div>
                        </div>
                    </div>
                    
                    <div class="text-center mt-3">
                        <button type="button" class="btn btn-outline-primary" id="startAnnotationBtn">
                            <i class="fas fa-edit me-1"></i> アノテーションを編集
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        このサンプルには生殖乳頭のアノテーションが必要です
                    </div>
                    <p class="text-muted mb-3">生殖乳頭の輪郭を手動でマークすることで、より正確な分析と将来の自動検出精度向上に貢献できます。</p>
                    <div class="text-center">
                        <button type="button" class="btn btn-primary" id="startAnnotationBtn">
                            <i class="fas fa-pen me-1"></i> アノテーション開始
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += `
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-light">
                                <h6 class="mb-0"><i class="fas fa-info-circle me-1"></i> 次のステップ</h6>
                            </div>
                            <div class="card-body">
                                <ol class="mb-0">
                                    <li>アノテーションを行って生殖乳頭を正確にマークする</li>
                                    <li>データを保存して学習データセットに追加する</li>
                                    <li>複数のサンプルを処理して、システムの精度を向上させる</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

/**
 * アノテーション開始ボタンにイベントリスナーを追加
 */
function addAnnotationButtonListener() {
    const startAnnotationBtn = document.getElementById('startAnnotationBtn');
    if (startAnnotationBtn) {
        console.log('アノテーションボタンにイベントリスナー追加');
        startAnnotationBtn.addEventListener('click', function() {
            console.log('アノテーション開始ボタンクリック');
            if (typeof openAnnotationModal === 'function') {
                console.log('アノテーションモーダルを開く:', sampleAnalysis.currentSample);
                openAnnotationModal(sampleAnalysis.currentSample);
            } else {
                console.error('openAnnotationModal関数が見つかりません');
                alert('アノテーション機能が利用できません。ページを再読み込みしてください。');
            }
        });
    } else {
        console.warn('アノテーション開始ボタンが見つかりません');
    }
}

/**
 * サンプル画像のアップロード処理
 */
function uploadSample() {
    console.log('サンプルアップロード開始');
    
    const sampleFile = document.getElementById('sampleFile').files[0];
    const gender = document.getElementById('sampleGender').value;
    
    if (!sampleFile) {
        alert('サンプル画像を選択してください');
        return;
    }
    
    console.log('アップロード対象:', sampleFile.name, '性別:', gender);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append('image', sampleFile);
    formData.append('gender', gender);
    
    // ローディング表示
    showLoading();
    
    // AJAX送信
    fetch('/sample/upload-sample', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log('アップロードレスポンス:', response.status);
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('アップロード結果:', data);
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 成功メッセージと画面更新
        alert(data.message);
        location.reload(); // 画面を更新してサンプル一覧を更新
    })
    .catch(error => {
        hideLoading();
        console.error('アップロードエラー:', error);
        alert('エラー: ' + error.message);
    });
}

/**
 * ページタイトルの更新（サンプル数表示）
 */
function updatePageTitle() {
    const maleSamples = document.querySelectorAll('.sample-card[data-path*="male/"]').length;
    const femaleSamples = document.querySelectorAll('.sample-card[data-path*="female/"]').length;
    const totalSamples = maleSamples + femaleSamples;
    
    console.log(`サンプル数 - オス: ${maleSamples}, メス: ${femaleSamples}, 合計: ${totalSamples}`);
    
    document.title = `ウニ生殖乳頭サンプル分析 (${totalSamples}件)`;
}