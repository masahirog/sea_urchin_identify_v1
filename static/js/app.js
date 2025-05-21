/**
 * ウニ生殖乳頭分析システム - アプリケーション初期化
 * アプリケーション全体に関わる初期化処理とイベントリスナーのセットアップ
 */

// グローバル変数（必要最小限にする）
let currentTaskId = null;

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', function() {
    // 既存のタスクIDを復元
    restoreTaskState();
    
    // タブ切り替え時の処理
    initTabHandlers();
    
    // 各機能の初期化
    initVideoProcessor();
    initImageClassifier();  
    initModelTrainer();
    initTaskManager();
    initMarkingTools();
    
    // 初期表示データの読み込み
    loadDatasetInfo();
});

/**
 * 保存されていたタスク状態を復元する
 */
function restoreTaskState() {
    const savedTaskId = getTaskId();
    if (savedTaskId) {
        currentTaskId = savedTaskId;
        // タスク状態を確認し、処理結果を表示
        checkTaskStatus();
        // 抽出画像を読み込む
        loadExtractedImages();
    }
}

/**
 * タブ切り替え時の処理を初期化
 */
function initTabHandlers() {
    // 履歴タブが選択されたときに履歴を読み込む
    document.getElementById('history-tab')?.addEventListener('click', function() {
        loadTaskHistory();
    });
    
    // その他のタブ切り替え時の処理があればここに追加
}

/**
 * タスクIDをローカルストレージに保存
 */
function saveTaskId(taskId) {
    localStorage.setItem('currentTaskId', taskId);
}

/**
 * タスクIDをローカルストレージから取得
 */
function getTaskId() {
    return localStorage.getItem('currentTaskId');
}

// モジュールとしてエクスポート（必要に応じて）
// export { currentTaskId, saveTaskId, getTaskId };