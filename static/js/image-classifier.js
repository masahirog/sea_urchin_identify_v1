/**
 * ウニ生殖乳頭分析システム - 画像分類モジュール
 * 画像の雌雄判別と結果表示に関する機能
 */

/**
 * 画像分類モジュールの初期化
 */
function initImageClassifier() {
    // 画像判別フォームの送信イベント設定
    const classifyForm = document.getElementById('classifyForm');
    if (classifyForm) {
        classifyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            classifyImage();
        });
    }
    
    // データセットに画像を保存するモーダルボタンの設定
    document.getElementById('saveMaleBtn')?.addEventListener('click', function() {
        saveImageToDataset('male');
    });
    
    document.getElementById('saveFemaleBtn')?.addEventListener('click', function() {
        saveImageToDataset('female');
    });
}

/**
 * 画像の雌雄判別を実行
 */
function classifyImage() {
    const imageFile = document.getElementById('imageFile').files[0];
    
    if (!imageFile) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // ローディング表示
    showLoading();
    
    // AJAX送信
    fetch('/image/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 結果の表示
        showClassifyResult(data);
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

/**
 * 判別結果の表示
 */
function showClassifyResult(data) {
    // プレースホルダーを非表示
    if (document.getElementById('classifyPlaceholder')) {
        document.getElementById('classifyPlaceholder').classList.add('d-none');
    }
    
    // 結果を表示
    if (document.getElementById('classifyResult')) {
        document.getElementById('classifyResult').classList.remove('d-none');
    }
    
    // 画像
    if (data.marked_image_url && document.getElementById('resultImage')) {
        document.getElementById('resultImage').src = data.marked_image_url;
    }
    
    // 性別結果
    if (document.getElementById('genderResult')) {
        const genderResult = document.getElementById('genderResult');
        const gender = data.gender === 'male' ? 'オス' : 'メス';
        const confidence = (data.confidence * 100).toFixed(1);
        
        genderResult.textContent = `判別結果: ${gender} (信頼度: ${confidence}%)`;
        genderResult.className = 'alert';
        genderResult.classList.add(data.gender === 'male' ? 'alert-primary' : 'alert-danger');
    }
    
    // 特徴重要度
    if (data.feature_importance && document.getElementById('featureImportance')) {
        const importanceContainer = document.getElementById('featureImportance');
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
                <div class="progress feature-bar">
                    <div class="progress-bar" role="progressbar" style="width: ${percent}%"></div>
                </div>
            `;
            
            importanceContainer.appendChild(bar);
        });
    }
}

/**
 * データセットに画像を保存
 */
function saveImageToDataset(gender, imagePath) {
    // imagePath が未指定の場合はモーダルから取得
    if (!imagePath) {
        const modalImage = document.getElementById('modalImage');
        if (!modalImage) return;
        imagePath = modalImage.src;
    }
    
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/image/save-to-dataset', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image_path: imagePath,
            gender: gender
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 成功メッセージ
        alert(data.message);
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageModal'));
        if (modal) {
            modal.hide();
        }
        
        // データセット情報の更新
        loadDatasetInfo();
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// モジュールとしてエクスポート（必要に応じて）
// export { initImageClassifier, saveImageToDataset, showClassifyResult };