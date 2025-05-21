/**
 * ウニ生殖乳頭分析システム - モデル訓練モジュール
 * モデルの訓練と評価結果表示に関する機能
 */

/**
 * モデル訓練モジュールの初期化
 */
function initModelTrainer() {
    // モデル訓練ボタンの設定
    const trainModelBtn = document.getElementById('trainModelBtn');
    if (trainModelBtn) {
        trainModelBtn.addEventListener('click', function() {
            validateAndStartTraining();
        });
    }
    
    // データセット情報更新ボタンの設定
    const refreshDatasetBtn = document.getElementById('refreshDatasetBtn');
    if (refreshDatasetBtn) {
        refreshDatasetBtn.addEventListener('click', loadDatasetInfo);
    }
}

/**
 * データセット確認後、訓練を開始する
 */
function validateAndStartTraining() {
    // データセット確認
    fetch('/dataset-info')
    .then(response => response.json())
    .then(data => {
        const totalCount = data.total_count;
        
        if (totalCount < 10) {
            alert('訓練データが少なすぎます。少なくとも10枚のラベル付き画像が必要です。');
            return;
        }
        
        if (data.male_count === 0 || data.female_count === 0) {
            alert('オスとメスの両方の画像が必要です。');
            return;
        }
        
        // 訓練開始
        startModelTraining();
    })
    .catch(error => {
        alert('エラー: ' + error);
    });
}

/**
 * モデル訓練の開始
 */
function startModelTraining() {
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/train-model', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // タスクIDの保存
        currentTaskId = data.task_id;
        // タスクIDをローカルストレージに保存
        saveTaskId(currentTaskId);
        
        // 状態表示の初期化
        document.getElementById('trainingStatus').classList.remove('d-none');
        document.getElementById('trainingStatus').textContent = '訓練を開始しました...';
        document.getElementById('trainingProgressContainer').classList.remove('d-none');
        document.getElementById('trainingProgressBar').style.width = '0%';
        
        // 状態チェックの開始
        startStatusCheck();
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

/**
 * データセット情報の読み込み
 */
function loadDatasetInfo() {
    fetch('/dataset-info')
    .then(response => response.json())
    .then(data => {
        // 情報の表示
        if (document.getElementById('maleCount')) {
            document.getElementById('maleCount').textContent = data.male_count;
        }
        if (document.getElementById('femaleCount')) {
            document.getElementById('femaleCount').textContent = data.female_count;
        }
        if (document.getElementById('totalCount')) {
            document.getElementById('totalCount').textContent = data.total_count;
        }
        
        // 割合の計算と表示
        if (document.getElementById('datasetMaleBar') && document.getElementById('datasetFemaleBar')) {
            const total = data.total_count || 1;  // ゼロ除算を避ける
            const malePercent = (data.male_count / total) * 100;
            const femalePercent = (data.female_count / total) * 100;
            
            document.getElementById('datasetMaleBar').style.width = malePercent + '%';
            document.getElementById('datasetFemaleBar').style.width = femalePercent + '%';
        }
    })
    .catch(error => {
        console.error('データセット情報の読み込みエラー:', error);
    });
}

/**
 * 訓練結果の表示
 */
function showTrainingResult(data) {
    // プレースホルダーを非表示
    if (document.getElementById('modelPlaceholder')) {
        document.getElementById('modelPlaceholder').classList.add('d-none');
    }
    
    // 結果を表示
    if (document.getElementById('modelInfo')) {
        document.getElementById('modelInfo').classList.remove('d-none');
    }
    
    // 精度
    if (document.getElementById('accuracyValue')) {
        document.getElementById('accuracyValue').textContent = (data.accuracy * 100).toFixed(1) + '%';
    }
    
    // 訓練情報
    if (document.getElementById('trainSamples')) {
        document.getElementById('trainSamples').textContent = data.train_samples || '-';
    }
    if (document.getElementById('modelMaleImages')) {
        document.getElementById('modelMaleImages').textContent = data.male_images || '-';
    }
    if (document.getElementById('modelFemaleImages')) {
        document.getElementById('modelFemaleImages').textContent = data.female_images || '-';
    }
    
    // 特徴重要度
    if (data.feature_importance && document.getElementById('modelFeatureImportance')) {
        const importanceContainer = document.getElementById('modelFeatureImportance');
        importanceContainer.innerHTML = '';
        
        // 特徴量を重要度順にソート
        const sortedFeatures = Object.entries(data.feature_importance)
            .sort((a, b) => b[1] - a[1]);
        
        // 特徴バーの作成
        sortedFeatures.forEach(([feature, importance]) => {
            const percent = (importance * 100).toFixed(1);
            const bar = document.createElement('div');
            bar.className = 'mb-3';
            
            bar.innerHTML = `
                <div class="d-flex justify-content-between mb-1">
                    <span>${feature}</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" style="width: ${percent}%"></div>
                </div>
            `;
            
            importanceContainer.appendChild(bar);
        });
    }
}

// モジュールとしてエクスポート（必要に応じて）
// export { initModelTrainer, loadDatasetInfo, showTrainingResult };