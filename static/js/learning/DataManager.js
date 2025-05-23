/**
 * ウニ生殖乳頭分析システム - データマネージャー
 * データの読み込み、保存、処理を担当
 */

import {
    showSuccessMessage,
    showErrorMessage,
    showLoading,
    hideLoading,
    showLoadingWithProgress,
    updateLoadingProgress,
    apiRequest,
    apiRequestFormData,
    getNestedValue,
    deepCopy
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
        this.lastRefreshTime = 0;
    }

    /**
     * 初期データ読み込み
     */
    async loadInitialData() {
        try {
            await this.refreshDatasetStats();
            await this.loadLearningData();
            await this.loadLearningHistory();
            await this.checkYoloDatasetStatus();
        } catch (error) {
            console.error('初期データ読み込みエラー:', error);
            throw error;
        }
    }

    /**
     * YOLOデータセットの状態チェック
     */
    async checkYoloDatasetStatus() {
        try {
            const status = await apiRequest('/yolo/dataset-status');
            this.parent.yoloDatasetStatus = status;
            
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
            const data = await apiRequest('/learning/learning-history');
            const history = data.history || [];
            
            if (history.length > 0) {
                const latestEvaluation = history.find(item => item.type === 'evaluation');
                
                if (latestEvaluation) {
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
        const now = Date.now();
        if (!force && now - this.lastRefreshTime < 300) {
            return this.parent.datasetStats;
        }
        
        this.lastRefreshTime = now;
        
        try {
            this.parent.datasetStats = await apiRequest('/learning/dataset-stats');
            this.parent.uiManager.updateDatasetStatsDisplay();
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
            const readiness = await apiRequest('/learning/readiness-check');
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
                
            const data = await apiRequest(url);
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
            const data = await apiRequest('/learning/learning-history');
            
            if (!data.history || data.history.length === 0) {
                this.parent.uiManager.displayEmptyHistory();
                return [];
            }
            
            const sortedHistory = [...data.history].sort((a, b) => {
                const timestampA = a.timestamp || '';
                const timestampB = b.timestamp || '';
                return timestampB.localeCompare(timestampA);
            });
            
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
            
            const data = await apiRequest('/learning/learning-history');
            const history = data.history || [];
            
            const possibleTimestamps = this.generatePossibleTimestamps(timestamp);
            
            const relatedItems = history.filter(item => {
                const itemTimestamp = item.timestamp || '';
                return possibleTimestamps.some(ts => itemTimestamp === ts);
            });
            
            if (relatedItems.length === 0) {
                this.parent.uiManager.showError('指定された履歴が見つかりませんでした');
                console.error('見つからないタイムスタンプ:', timestamp);
                return null;
            }
            
            const evaluationItem = relatedItems.find(item => item.type === 'evaluation');
            const annotationItem = relatedItems.find(item => item.type === 'annotation');
            
            const resultData = evaluationItem?.details || evaluationItem || {};
            const annotationData = annotationItem?.details || annotationItem || {};
            
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
            
            this.parent.currentPhase = 'analysis';
            this.parent.uiManager.updatePhaseDisplay();
            this.parent.uiManager.showAnalysisPhase();
            
            this.parent.displayUnifiedResults();
            
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
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('images', files[i]);
            }
            formData.append('gender', gender);
            
            this.parent.uiManager.showUploadProgress(0);
            
            const data = await apiRequestFormData('/learning/upload-data', formData);
            
            this.parent.uiManager.hideUploadProgress();
            
            if (data.error) {
                this.parent.uiManager.showError('アップロードエラー: ' + data.error);
                return false;
            }
            
            let message = data.message;
            if (data.error_count > 0) {
                message += ` (${data.error_count}ファイルでエラー)`;
            }
            showSuccessMessage(message);
            
            fileInput.value = '';
            
            await this.refreshDatasetStats(true);
            await this.loadLearningData();
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
            const stats = this.parent.datasetStats;
            const totalCount = (stats.male_count || 0) + (stats.female_count || 0);
            
            if (totalCount === 0) {
                this.parent.uiManager.showError('学習データが必要です。データ準備フェーズで画像をアップロードしてください。');
                return false;
            }
            
            if (totalCount < 5) {
                const confirmed = confirm(`現在のデータ数は${totalCount}枚です。\n学習は可能ですが、より多くのデータがあると精度が向上します。\n\n続行しますか？`);
                if (!confirmed) {
                    return false;
                }
            }
            
            this.parent.currentPhase = 'training';
            this.parent.uiManager.updatePhaseDisplay();
            this.parent.uiManager.showTrainingPhase();
            
            const data = await apiRequest('/learning/start-unified-training', {
                method: 'POST'
            });
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.parent.taskId = data.task_id;
            this.parent.startProgressMonitoring();
            
            showSuccessMessage('統合学習プロセスを開始しました');
            this.parent.uiManager.updateTrainingDetails();
            
            return true;
        } catch (error) {
            console.error('統合学習開始エラー:', error);
            this.parent.uiManager.showError('統合学習の開始に失敗しました: ' + error.message);
            
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
            return await apiRequest(`/learning/unified-status/${this.parent.taskId}`);
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
            return await apiRequest('/yolo/training/start', {
                method: 'POST',
                body: JSON.stringify(params)
            });
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
            return await apiRequest('/yolo/training/status');
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
        
        formats.push(timestamp);
        
        try {
            if (!isNaN(Number(timestamp))) {
                const date = new Date(Number(timestamp));
                
                formats.push(date.toISOString().split('.')[0]);
                
                const formatted = date.toISOString()
                    .replace(/[-:]/g, '')
                    .replace('T', '_')
                    .split('.')[0];
                formats.push(formatted);
            }
            else if (/^\d{8}_\d{6}$/.test(timestamp)) {
                const year = timestamp.substring(0, 4);
                const month = timestamp.substring(4, 6);
                const day = timestamp.substring(6, 8);
                const hour = timestamp.substring(9, 11);
                const minute = timestamp.substring(11, 13);
                const second = timestamp.substring(13, 15);
                
                const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
                formats.push(isoString);
                
                const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                formats.push(date.toISOString().split('.')[0]);
            }
            else if (timestamp.includes('T')) {
                const formatted = timestamp
                    .replace(/[-:]/g, '')
                    .replace('T', '_')
                    .split('.')[0];
                formats.push(formatted);
                
                const date = new Date(timestamp);
                formats.push(date.toISOString().split('.')[0]);
            }
        } catch (error) {
            console.warn('タイムスタンプ変換エラー:', error);
        }
        
        return [...new Set(formats)];
    }
}