/**
 * ウニ生殖乳頭分析システム - データマネージャー
 * データの読み込み、保存、処理を担当
 */

import {
    showSuccessMessage,
    showErrorMessage,
    getNestedValue,
    getStatusAlertClass,
    checkYoloDatasetStatus
} from '../utilities.js';

/**
 * データマネージャークラス
 * データ操作を担当
 */
export class DataManager {
    /**
     * コンストラクタ
     * @param {Object} parent - 親クラス（UnifiedLearningSystem）への参照
     */
    constructor(parent) {
        this.parent = parent;
        this.lastRefreshTime = 0; // データ更新の重複防止用タイムスタンプ
    }

    /**
     * 初期データ読み込み
     */
    async loadInitialData() {
        try {
            // データセット統計読み込み
            await this.refreshDatasetStats();
            
            // 学習データ読み込み
            await this.loadLearningData();
            
            // 学習履歴読み込み
            await this.loadLearningHistory();
            
            // YOLOデータセット状態チェック
            await this.checkYoloDatasetStatus();
            
        } catch (error) {
            console.error('初期データ読み込みエラー:', error);
            throw error; // 上位でエラーハンドリングするために再スロー
        }
    }

    /**
     * YOLOデータセットの状態チェック
     */
    async checkYoloDatasetStatus() {
        try {
            const status = await checkYoloDatasetStatus();
            this.parent.yoloDatasetStatus = status;
            
            // YOLOデータセット状況表示を更新
            if (this.parent.uiManager && typeof this.parent.uiManager.updateYoloDatasetStatus === 'function') {
                this.parent.uiManager.updateYoloDatasetStatus(status);
            }
            
            return status;
        } catch (error) {
            console.error('YOLOデータセットチェックエラー:', error);
            return null;
        }
    }

    /**
     * 最新の学習結果を読み込み
     */
    async loadLatestResults() {
        try {
            const response = await fetch('/learning/learning-history');
            if (!response.ok) return;
            
            const data = await response.json();
            const history = data.history || [];
            
            if (history.length > 0) {
                // 最新の評価結果を探す
                const latestEvaluation = history.find(item => item.type === 'evaluation');
                
                if (latestEvaluation) {
                    
                    // 結果を仮想的に設定
                    this.parent.learningResults = {
                        summary: {
                            overall_accuracy: latestEvaluation.cv_mean || 0,
                            precision: getNestedValue(latestEvaluation, 'classification_report.weighted_avg.precision') || 0,
                            recall: getNestedValue(latestEvaluation, 'classification_report.weighted_avg.recall') || 0,
                            annotation_rate: latestEvaluation.dataset?.annotation_rate || 0
                        },
                        evaluation: latestEvaluation,
                        metadata: {
                            timestamp: latestEvaluation.timestamp
                        },
                        annotation_analysis: {
                            annotation_timestamp: latestEvaluation.timestamp,
                            dataset: latestEvaluation.dataset || {}
                        }
                    };
                    
                    // 最新の結果があることをフラグで記録
                    this.parent.hasLatestResults = true;
                }
            }
        } catch (error) {
            console.error('最新結果の読み込みエラー:', error);
        }
    }

    /**
     * データセット統計の更新
     * @param {boolean} force - 強制更新するかどうか
     */
    async refreshDatasetStats(force = false) {
        // 短時間での連続更新を防止（300ms以内）
        const now = Date.now();
        if (!force && now - this.lastRefreshTime < 300) {
            return this.parent.datasetStats;
        }
        
        this.lastRefreshTime = now;
        
        try {
            const response = await fetch('/learning/dataset-stats');
            if (!response.ok) throw new Error('統計取得に失敗しました');
            
            this.parent.datasetStats = await response.json();
            this.parent.uiManager.updateDatasetStatsDisplay();
            
            // 準備完了度チェック
            await this.checkReadiness();
            
            return this.parent.datasetStats;
        } catch (error) {
            console.error('データセット統計取得エラー:', error);
            this.parent.uiManager.showError('データセット統計の取得に失敗しました');
            throw error;
        }
    }

    /**
     * 準備完了度チェック
     */
    async checkReadiness() {
        try {
            const response = await fetch('/learning/readiness-check');
            if (!response.ok) throw new Error('準備完了度チェックに失敗しました');
            
            const readiness = await response.json();
            this.parent.uiManager.updateReadinessDisplay(readiness);
            
            return readiness;
        } catch (error) {
            console.error('準備完了度チェックエラー:', error);
            throw error;
        }
    }

    /**
     * 学習データの読み込み
     * @param {string} filter - フィルター（'all', 'male', 'female'）
     */
    async loadLearningData(filter = 'all') {
        try {
            const url = filter !== 'all' ? 
                `/learning/learning-data?gender=${filter}` : 
                '/learning/learning-data';
                
            const response = await fetch(url);
            if (!response.ok) throw new Error('学習データ取得に失敗しました');
            
            const data = await response.json();
            this.parent.uiManager.displayLearningData(data);
            
            return data;
        } catch (error) {
            console.error('学習データ読み込みエラー:', error);
            this.parent.uiManager.showError('学習データの読み込みに失敗しました');
            throw error;
        }
    }

    /**
     * 学習履歴の読み込み
     */
    async loadLearningHistory() {
        try {
            const response = await fetch('/learning/learning-history');
            if (!response.ok) {
                throw new Error(`履歴データの取得に失敗しました: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 履歴データが空でないことを確認
            if (!data.history || data.history.length === 0) {
                this.parent.uiManager.displayEmptyHistory();
                return [];
            }
            
            // 日付でソート（新しい順）- 念のため再ソート
            const sortedHistory = [...data.history].sort((a, b) => {
                // タイムスタンプがない場合は日付で比較
                const timestampA = a.timestamp || '';
                const timestampB = b.timestamp || '';
                return timestampB.localeCompare(timestampA);
            });
            
            // 統合された履歴を表示
            this.parent.uiManager.displayLearningHistory(sortedHistory);
            
            return sortedHistory;
        } catch (error) {
            console.error('履歴読み込みエラー:', error);
            this.parent.uiManager.displayEmptyHistory();
            throw error;
        }
    }

    /**
     * 履歴結果の読み込みと表示
     * @param {string} timestamp - タイムスタンプ
     */
    async loadHistoricalResult(timestamp) {
        try {
            if (!timestamp) {
                this.parent.uiManager.showError('タイムスタンプが無効です');
                return null;
            }
            
            // 履歴から該当する結果を探す
            const response = await fetch('/learning/learning-history');
            if (!response.ok) throw new Error('履歴データの取得に失敗しました');
            
            const data = await response.json();
            const history = data.history || [];
            
            // 可能性のあるすべてのタイムスタンプ形式を生成
            const possibleTimestamps = this.generatePossibleTimestamps(timestamp);
            
            // 同じタイムスタンプを持つすべての履歴項目を取得
            const relatedItems = history.filter(item => {
                const itemTimestamp = item.timestamp || '';
                return possibleTimestamps.some(ts => itemTimestamp === ts);
            });
            
            if (relatedItems.length === 0) {
                this.parent.uiManager.showError('指定された履歴が見つかりませんでした');
                console.error('見つからないタイムスタンプ:', timestamp);
                return null;
            }
            
            // 評価とアノテーションの結果を探す
            const evaluationItem = relatedItems.find(item => item.type === 'evaluation');
            const annotationItem = relatedItems.find(item => item.type === 'annotation');
            
            // 評価結果とアノテーション結果の統合
            const resultData = evaluationItem?.details || evaluationItem || {};
            const annotationData = annotationItem?.details || annotationItem || {};
            
            // 統合結果を設定
            this.parent.learningResults = {
                summary: {
                    overall_accuracy: resultData.cv_mean || resultData.accuracy || 0,
                    precision: getNestedValue(resultData, 'classification_report.weighted_avg.precision') || 0,
                    recall: getNestedValue(resultData, 'classification_report.weighted_avg.recall') || 0,
                    annotation_rate: annotationData.annotation_rate || getNestedValue(resultData, 'dataset.annotation_rate') || 0
                },
                evaluation: resultData,
                metadata: {
                    timestamp: resultData.timestamp || timestamp,
                    isHistorical: true
                },
                annotation_analysis: {
                    dataset: annotationData.dataset || resultData.dataset || {},
                    annotation_timestamp: annotationData.timestamp || resultData.timestamp || timestamp
                }
            };
            
            // 分析フェーズに移動
            this.parent.currentPhase = 'analysis';
            this.parent.uiManager.updatePhaseDisplay();
            this.parent.uiManager.showAnalysisPhase();
            
            // 結果を表示
            this.parent.displayUnifiedResults();
            
            // 履歴表示であることを通知
            const date = evaluationItem?.date || annotationItem?.date || '過去の結果';
            showSuccessMessage(`${date} の統合結果を表示しています`);
            
            return this.parent.learningResults;
        } catch (error) {
            console.error('履歴結果読み込みエラー:', error);
            this.parent.uiManager.showError('履歴結果の読み込みに失敗しました: ' + error.message);
            throw error;
        }
    }

    /**
     * 最新の評価ファイルを探す
     */
    async loadLatestEvaluationFiles() {
        try {
            // 評価履歴を取得して最新のファイルを見つける
            const response = await fetch('/learning/learning-history');
            if (!response.ok) throw new Error('履歴取得に失敗しました');
            
            const data = await response.json();
            const history = data.history || [];
            
            // 利用可能なファイルを格納するオブジェクト
            const latestFiles = {
                learning_curve: null,
                confusion_matrix: null,
                roc_curve: null,
                annotation_impact: null
            };
            
            // 最新の評価結果を探す
            for (const item of history) {
                if (item.type === 'evaluation' && item.images) {
                    // 各グラフタイプについて存在確認
                    for (const [key, value] of Object.entries(item.images)) {
                        if (value && !latestFiles[key]) {
                            latestFiles[key] = value;
                        }
                    }
                    
                    // 全てのグラフが見つかったら終了
                    if (Object.values(latestFiles).every(v => v !== null)) break;
                }
            }
            
            return latestFiles;
        } catch (error) {
            console.error('最新評価ファイル取得エラー:', error);
            return {};
        }
    }

    /**
     * データアップロード処理
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async handleDataUpload() {
        const fileInput = document.getElementById('dataFiles');
        const genderSelect = document.getElementById('dataGender');
        
        const files = fileInput.files;
        const gender = genderSelect.value;
        
        if (files.length === 0) {
            this.parent.uiManager.showError('画像ファイルを選択してください');
            return false;
        }
        
        try {
            // フォームデータ作成
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('images', files[i]);
            }
            formData.append('gender', gender);
            
            // アップロード進捗表示
            this.parent.uiManager.showUploadProgress(0);
            
            // アップロード実行
            const response = await fetch('/learning/upload-data', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
            
            const data = await response.json();
            this.parent.uiManager.hideUploadProgress();
            
            if (data.error) {
                this.parent.uiManager.showError('アップロードエラー: ' + data.error);
                return false;
            }
            
            // 成功処理
            let message = data.message;
            if (data.error_count > 0) {
                message += ` (${data.error_count}ファイルでエラー)`;
            }
            showSuccessMessage(message);
            
            // フォームリセット
            fileInput.value = '';
            
            // データ更新
            await this.refreshDatasetStats(true);
            await this.loadLearningData();
            
            // YOLOデータセット状態を更新
            await this.checkYoloDatasetStatus();
            
            return true;
        } catch (error) {
            this.parent.uiManager.hideUploadProgress();
            console.error('アップロードエラー:', error);
            this.parent.uiManager.showError('アップロード中にエラーが発生しました: ' + error.message);
            return false;
        }
    }

    /**
     * 統合学習の開始
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async startUnifiedTraining() {
        try {
            // 基本的なデータ存在チェックのみ
            const stats = this.parent.datasetStats;
            const totalCount = (stats.male_count || 0) + (stats.female_count || 0);
            
            if (totalCount === 0) {
                this.parent.uiManager.showError('学習データが必要です。データ準備フェーズで画像をアップロードしてください。');
                return false;
            }
            
            // データが少ない場合は警告を表示するが続行可能
            if (totalCount < 5) {
                const confirmed = confirm(`現在のデータ数は${totalCount}枚です。\n学習は可能ですが、より多くのデータがあると精度が向上します。\n\n続行しますか？`);
                if (!confirmed) {
                    return false;
                }
            }
            
            // フェーズ切り替え
            this.parent.currentPhase = 'training';
            this.parent.uiManager.updatePhaseDisplay();
            this.parent.uiManager.showTrainingPhase();
            
            // 統合学習API呼び出し
            const response = await fetch('/learning/start-unified-training', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            
            if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // タスクID保存
            this.parent.taskId = data.task_id;
            
            // 進捗監視開始
            this.parent.startProgressMonitoring();
            
            // 成功メッセージ
            showSuccessMessage('統合学習プロセスを開始しました');
            
            // 学習詳細の更新
            this.parent.uiManager.updateTrainingDetails();
            
            return true;
        } catch (error) {
            console.error('統合学習開始エラー:', error);
            this.parent.uiManager.showError('統合学習の開始に失敗しました: ' + error.message);
            
            // エラー時はフェーズを戻す
            this.parent.currentPhase = 'preparation';
            this.parent.uiManager.updatePhaseDisplay();
            
            return false;
        }
    }

    /**
     * 統合ステータスのチェック
     * @returns {Promise<Object|null>} ステータスオブジェクト
     */
    async checkUnifiedStatus() {
        if (!this.parent.taskId) return null;
        
        try {
            const response = await fetch(`/learning/unified-status/${this.parent.taskId}`);
            if (!response.ok) throw new Error('ステータス取得に失敗しました');
            
            const status = await response.json();
            return status;
        } catch (error) {
            console.error('ステータスチェックエラー:', error);
            return null;
        }
    }

    /**
     * YOLOトレーニングの開始
     * @param {Object} params - トレーニングパラメータ
     * @returns {Promise<Object>} レスポンスデータ
     */
    async startYoloTraining(params) {
        try {
            const response = await fetch('/yolo/training/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            
            if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error('YOLOトレーニング開始エラー:', error);
            throw error;
        }
    }

    /**
     * YOLOトレーニングの状態チェック
     * @returns {Promise<Object>} ステータスオブジェクト
     */
    async checkYoloTrainingStatus() {
        try {
            const response = await fetch('/yolo/training/status');
            if (!response.ok) throw new Error(`ステータス取得エラー: ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error('YOLOトレーニングステータスエラー:', error);
            return {
                status: 'error',
                message: error.message,
                progress: 0
            };
        }
    }

    /**
     * 可能性のあるすべてのタイムスタンプ形式を生成
     * @param {string} timestamp - 元のタイムスタンプ
     * @returns {Array} 可能性のあるタイムスタンプの配列
     */
    generatePossibleTimestamps(timestamp) {
        const formats = [];
        
        // 元のタイムスタンプをそのまま追加
        formats.push(timestamp);
        
        try {
            // 数値のタイムスタンプをチェック
            if (!isNaN(Number(timestamp))) {
                const date = new Date(Number(timestamp));
                
                // YYYY-MM-DDTHH:MM:SS形式
                formats.push(date.toISOString().split('.')[0]);
                
                // YYYYMMDD_HHMMSS形式
                const formatted = date.toISOString()
                    .replace(/[-:]/g, '')
                    .replace('T', '_')
                    .split('.')[0];
                formats.push(formatted);
            }
            // YYYYMMDD_HHMMSS形式をチェック
            else if (/^\d{8}_\d{6}$/.test(timestamp)) {
                // YYYY-MM-DDTHH:MM:SS形式に変換
                const year = timestamp.substring(0, 4);
                const month = timestamp.substring(4, 6);
                const day = timestamp.substring(6, 8);
                const hour = timestamp.substring(9, 11);
                const minute = timestamp.substring(11, 13);
                const second = timestamp.substring(13, 15);
                
                const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
                formats.push(isoString);
                
                // 日時オブジェクトを作成
                const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                formats.push(date.toISOString().split('.')[0]);
            }
            // ISO形式をチェック
            else if (timestamp.includes('T')) {
                // YYYYMMDD_HHMMSS形式に変換
                const formatted = timestamp
                    .replace(/[-:]/g, '')
                    .replace('T', '_')
                    .split('.')[0];
                formats.push(formatted);
                
                // 日時オブジェクトを作成して他の形式も追加
                const date = new Date(timestamp);
                formats.push(date.toISOString().split('.')[0]);
            }
        } catch (error) {
            console.warn('タイムスタンプ変換エラー:', error);
        }
        
        // 重複を削除して返す
        return [...new Set(formats)];
    }
}