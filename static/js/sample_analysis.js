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
    initSampleAnalysisPage();
});

/**
 * サンプル分析ページの初期化
 */
function initSampleAnalysisPage() {
    // 前回選択されていたサンプルを復元
    restoreLastSelectedSample();
    
    // サンプルカードのクリックイベント設定
    initSampleCardEvents();
    
    // サンプル画像アップロードフォーム
    initSampleUploadForm();
    
    // ページタイトルにサンプル数を表示
    updatePageTitle();
}

/**
 * 前回選択されていたサンプルを復元
 */
function restoreLastSelectedSample() {
    const lastSelectedSample = getFromSession('lastSelectedSample');
    if (lastSelectedSample) {
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
    document.querySelectorAll('.sample-card').forEach(card => {
        card.addEventListener('click', function() {
            // 選択状態の更新
            document.querySelectorAll('.sample-card').forEach(c => {
                c.classList.remove('selected-sample');
            });
            this.classList.add('selected-sample');
            
            // サンプルデータを保存
            sampleAnalysis.currentSample = this.dataset.path;
            
            // サンプル分析
            analyzeSample(this.dataset.path);
        });
    });
}

/**
 * サンプルアップロードフォームの初期化
 */
function initSampleUploadForm() {
    const uploadForm = document.getElementById('uploadSampleForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            uploadSample(this);
        });
    }
}

/**
 * サンプル画像を分析
 * @param {string} imagePath - 分析する画像のパス
 */
function analyzeSample(imagePath) {
    if (!imagePath) return;
    
    // 分析中の場合は処理をキャンセル
    if (sampleAnalysis.analysisInProgress) return;
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
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2">サンプルを分析しています...</p>
            </div>
        `;
    }
    let processedImagePath = imagePath;
    console.log("分析送信パス:", processedImagePath);

    
    // 分析リクエスト
    fetch('/sample/analyze-sample', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'image_path': processedImagePath
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('サーバーからのレスポンス:', data);
        if (data.error) {
            showError('analysisResult', data.error);
            return;
        }
        
        // 分析結果の表示
        displayAnalysisResult(imagePath, data);
    })
    .catch(error => {
        console.error('分析エラー:', error);
        showError('analysisResult', '分析中にエラーが発生しました: ' + error);
    })
    .finally(() => {
        sampleAnalysis.analysisInProgress = false;
    });
}

/**
 * 分析結果の表示
 * @param {string} imagePath - サンプル画像のパス
 * @param {Object} data - 分析結果データ
 */
function displayAnalysisResult(imagePath, data) {
    const resultElement = document.getElementById('analysisResult');
    if (!resultElement) return;
    
    // データの構造を確認
    if (!data || !data.basic_stats) {
        showError('analysisResult', 'データの形式が不正です');
        return;
    }
    
    // 基本情報セクション
    let html = createBasicInfoSection(imagePath, data);
    
    // 検出情報セクション
    html += createDetectionInfoSection(data);

    // 結果の表示
    resultElement.innerHTML = html;
    resultElement.classList.remove('d-none'); // 表示状態に変更

    // 結果表示後、アノテーション開始ボタンにイベントリスナーを追加
    addAnnotationButtonListener();
}

/**
 * 基本情報セクションHTMLの作成
 * @param {string} imagePath - 画像パス
 * @param {Object} data - 分析データ
 * @returns {string} HTML文字列
 */
function createBasicInfoSection(imagePath, data) {
    return `
        <div class="row">
            <div class="col-md-5">
                <div class="text-center mb-3">
                    <img src="/sample/${imagePath}" class="img-fluid" style="max-height: 300px;" alt="サンプル画像">
                </div>
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">画像情報</h6>
                    </div>
                    <div class="card-body">
                        <table class="table table-sm">
                            <tr>
                                <th style="width: 130px;">ファイル</th>
                                <td>${imagePath.split('/').pop()}</td>
                            </tr>
                            <tr>
                                <th>サイズ</th>
                                <td>${data.basic_stats.size[1]} x ${data.basic_stats.size[0]} ピクセル</td>
                            </tr>
                            <tr>
                                <th>平均輝度</th>
                                <td>${data.basic_stats.mean.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <th>標準偏差</th>
                                <td>${data.basic_stats.std.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-7">
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">検出情報</h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <table class="table table-sm">
                                <tr>
                                    <th style="width: 130px;">生殖乳頭検出数</th>
                                    <td>${data.detection_result.papillae_count}</td>
                                </tr>
                            </table>
                        </div>
    `;
}

/**
* 検出情報セクションHTMLの作成
* @param {Object} data - 分析データ
* @returns {string} HTML文字列
*/
function createDetectionInfoSection(data) {
    let html = '';
   
    // アノテーション状態に応じた表示
    if (data.shape_features && Object.keys(data.shape_features).length > 0) {
        html += `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                このサンプルはアノテーション済みです
            </div>
            <div class="mb-4">
                <h6>形状特性</h6>
                <table class="table table-sm">
                    <tr>
                        <th style="width: 130px;">面積</th>
                        <td>${data.shape_features.area.toFixed(2)} px²</td>
                    </tr>
                    <tr>
                        <th>周囲長</th>
                        <td>${data.shape_features.perimeter.toFixed(2)} px</td>
                    </tr>
                    <tr>
                        <th>円形度</th>
                        <td>${data.shape_features.circularity.toFixed(4)}</td>
                    </tr>
                </table>
            </div>

            <div class="mb-3">
                <h6>アノテーション結果</h6>
                <div class="text-center p-2 border rounded">
                    <img src="/static/${data.annotation_path}" class="img-fluid" style="max-height: 300px;" alt="アノテーション画像">
                </div>
            </div>
       
            <button type="button" class="btn btn-outline-primary" id="startAnnotationBtn">
                <i class="fas fa-edit me-1"></i> アノテーションを編集
            </button>
        `;
    } else {
        html += `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                このサンプルには生殖乳頭のアノテーションが必要です
            </div>
            <p class="text-muted mb-3">生殖乳頭の輪郭を手動でマークすることで、より正確な分析と将来の自動検出精度向上に貢献できます。</p>
            <button type="button" class="btn btn-primary" id="startAnnotationBtn">
                <i class="fas fa-pen me-1"></i> アノテーション開始
            </button>
        `;
    }

    html += `
                    </div>
                </div>
                <div class="card mt-3">
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
    `;
   
    return html;
}

/**
* アノテーション開始ボタンにイベントリスナーを追加
*/
function addAnnotationButtonListener() {
    const startAnnotationBtn = document.getElementById('startAnnotationBtn');
    if (startAnnotationBtn) {
        startAnnotationBtn.addEventListener('click', function() {
            if (typeof openAnnotationModal === 'function') {
                openAnnotationModal(sampleAnalysis.currentSample);
            } else {
                console.error('openAnnotationModal関数が見つかりません');
                alert('アノテーション機能が利用できません。ページを再読み込みしてください。');
            }
        });
    }
}

/**
* サンプル画像のアップロード処理
* @param {HTMLFormElement} formElement - アップロードフォーム要素
* @returns {boolean} 常にfalse（フォームのデフォルト送信を防止）
*/
function uploadSample(formElement) {
    const sampleFile = document.getElementById('sampleFile').files[0];
    const gender = document.getElementById('sampleGender').value;
   
    if (!sampleFile) {
        alert('サンプル画像を選択してください');
        return false;
    }
   
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
        if (!response.ok) {
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
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
        alert('エラー: ' + error);
    });
   
    return false; // フォームのデフォルト送信を防止
}

/**
* ページタイトルの更新（サンプル数表示）
*/
function updatePageTitle() {
    const maleSamples = document.querySelectorAll('.sample-card[data-path^="papillae/male/"]').length;
    const femaleSamples = document.querySelectorAll('.sample-card[data-path^="papillae/female/"]').length;
    const totalSamples = maleSamples + femaleSamples;
   
    document.title = `ウニ生殖乳頭サンプル分析 (${totalSamples}件)`;
}