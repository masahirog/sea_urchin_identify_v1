/**
 * ウニ生殖乳頭分析システム - サンプル分析機能
 * サンプル画像の分析と結果表示を担当するスクリプト
 */

// サンプル分析
function analyzeSample(imagePath) {
    // プレースホルダーを非表示、分析結果を表示
    document.getElementById('analysisPlaceholder').classList.add('d-none');
    const resultElement = document.getElementById('analysisResult');
    resultElement.classList.remove('d-none');
    
    // ローディング表示
    resultElement.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2">サンプルを分析しています...</p>
        </div>
    `;
    
    // 分析リクエスト
    fetch('/sample/analyze-sample', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'image_path': 'samples/' + imagePath
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('サーバーからのレスポンス:', data); // レスポンスをコンソールに出力
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
    });
}

// 分析結果の表示
function displayAnalysisResult(imagePath, data) {
    const resultElement = document.getElementById('analysisResult');
    
    // データの構造を確認
    if (!data || !data.basic_stats) {
        showError('analysisResult', 'データの形式が不正です');
        return;
    }
    
    // 基本情報
    let html = `
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

    resultElement.innerHTML = html;

    // 結果表示後、アノテーション開始ボタンにイベントリスナーを追加
    const startAnnotationBtn = document.getElementById('startAnnotationBtn');
    if (startAnnotationBtn) {
        startAnnotationBtn.addEventListener('click', function() {
            openAnnotationModal(imagePath);
        });
    }
}

// サンプル画像のアップロード処理
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

// ページ初期化とイベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // 前回選択されていたサンプルを復元
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
    
    // サンプルカードの選択
    document.querySelectorAll('.sample-card').forEach(card => {
        card.addEventListener('click', function() {
            // 選択状態の更新
            document.querySelectorAll('.sample-card').forEach(c => {
                c.classList.remove('selected-sample');
            });
            this.classList.add('selected-sample');
            
            // サンプル分析
            analyzeSample(this.dataset.path);
        });
    });
    
    // サンプル画像アップロードフォーム
    const uploadForm = document.getElementById('uploadSampleForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            uploadSample(this);
        });
    }
    
    // ページタイトルにサンプル数を表示
    updatePageTitle();
});

// ページタイトルの更新（サンプル数表示）
function updatePageTitle() {
    const maleSamples = document.querySelectorAll('.sample-card[data-path^="papillae/male/"]').length;
    const femaleSamples = document.querySelectorAll('.sample-card[data-path^="papillae/female/"]').length;
    const totalSamples = maleSamples + femaleSamples;
    
    document.title = `ウニ生殖乳頭サンプル分析 (${totalSamples}件)`;
}