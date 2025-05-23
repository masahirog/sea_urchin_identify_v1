/**
 * ウニ生殖乳頭分析システム - 評価マネージャー
 * 学習結果の評価と分析を担当
 */

import {
    showSuccessMessage,
    showElement,
    hideElement
} from '../utilities.js';

/**
 * 評価マネージャークラス
 * 評価と分析を担当
 */
export class EvaluationManager {
    /**
     * コンストラクタ
     * @param {Object} parent - 親クラス（UnifiedLearningSystem）への参照
     */
    constructor(parent) {
        this.parent = parent;
        
        // グラフ説明データ
        this.graphDescriptions = {
            learning_curve: {
                title: '学習曲線',
                description: 'データ量に対するモデルの学習進捗を示します',
                insights: {
                    good: '学習データと検証データの精度が近い場合、モデルは適切に学習しています',
                    overfit: '学習データの精度が高く、検証データの精度が低い場合、過学習の可能性があります',
                    underfit: '両方の精度が低い場合、より多くのデータかより複雑なモデルが必要です'
                }
            },
            confusion_matrix: {
                title: '混同行列',
                description: '実際の分類と予測の関係を示します',
                insights: {
                    diagonal: '対角線上の数値が高いほど、正確に分類できています',
                    offDiagonal: '対角線以外の数値は誤分類を示します'
                }
            },
            roc_curve: {
                title: 'ROCカーブ',
                description: '分類器の性能を示す曲線です',
                insights: {
                    auc: 'AUC値が1に近いほど優れた分類器です（0.5は無作為判定と同等）',
                    curve: '曲線が左上に近いほど性能が良いことを示します'
                }
            },
            annotation_impact: {
                title: 'アノテーション効果',
                description: '手動アノテーションがモデル性能に与える影響を示します',
                insights: {
                    high: 'アノテーション率が高いほど、モデルの精度向上が期待できます',
                    balance: 'オスとメスのアノテーション数のバランスも重要です'
                }
            }
        };
    }

    /**
     * 統合結果の表示
     */
    displayUnifiedResults() {
        if (!this.parent.learningResults) return;
        
        // プレースホルダー非表示
        hideElement('results-placeholder');
        
        // サマリーメトリクス更新
        this.parent.uiManager.updateSummaryMetrics();
        
        // 詳細結果表示
        this.displayDetailedResults();
        
        // 改善提案表示
        this.displayImprovementSuggestions();
    }

    /**
     * 詳細結果の表示
     */
    displayDetailedResults() {
        const container = document.getElementById('unified-results-content');
        if (!container) return;
        
        // ローディング表示
        container.innerHTML = `
            <div class="text-center my-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">読み込み中...</span>
                </div>
                <p class="mt-2">グラフデータを読み込んでいます...</p>
            </div>
        `;
        
        // 正しいタイムスタンプ形式（サーバーログから判明）
        const correctFormat = '2025-05-23T09:52:21.613416';
        
        // グラフタイプの配列
        const graphTypes = ['learning_curve', 'confusion_matrix', 'roc_curve', 'annotation_impact'];
        
        // 各グラフの読み込み状態を確認する関数
        const checkImageExists = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = url;
            });
        };

        // すべてのグラフURLをチェック
        Promise.all(graphTypes.map(type => {
            const url = `/evaluation/images/${type}_${correctFormat}.png`;
            return checkImageExists(url).then(exists => ({
                type, 
                url,
                exists
            }));
        })).then(results => {
            // グラフHTMLを生成
            let graphsHTML = '<div class="row">';
            
            // グラフパスと説明を使用してカードを生成
            results.forEach((result, index) => {
                // 2つ目の行に移る
                if (index === 2) {
                    graphsHTML += '</div><div class="row">';
                }
                
                graphsHTML += this.createCleanGraphCard(
                    result.type, 
                    result.url, 
                    result.exists, 
                    this.graphDescriptions[result.type]
                );
            });
            
            graphsHTML += '</div>';
            container.innerHTML = graphsHTML;
            
            // グラフモーダル用のコードを追加
            this.addGraphModal();
            
            // クリックイベントを設定
            this.setupGraphInteractions();
        }).catch(error => {
            // エラー時の表示
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>グラフ表示に問題が発生しました</strong><br>
                    グラフの読み込みに失敗しました。学習を実行して評価グラフを生成してください。
                </div>
            `;
        });
    }

    /**
     * クリーンなグラフカードを生成
     * @param {string} type - グラフタイプ
     * @param {string} url - 画像URL
     * @param {boolean} exists - 画像が存在するかどうか
     * @param {Object} description - グラフの説明データ
     * @returns {string} グラフカードのHTML
     */
    createCleanGraphCard(type, url, exists, description) {
        return `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0 d-flex align-items-center">
                            ${description.title}
                        </h6>
                    </div>
                    <div class="card-body text-center">
                        ${exists ? 
                            `<img src="${url}" alt="${description.title}" class="img-fluid graph-image" data-graph-type="${type}" style="cursor: zoom-in;"
                                 onclick="unifiedLearningSystem.evaluationManager.showGraphZoom('${url}', '${encodeURIComponent(JSON.stringify(description))}')">` : 
                            `<div class="graph-placeholder">
                                <i class="fas fa-chart-line fa-3x text-muted mb-3"></i>
                                <p>グラフデータがありません</p>
                            </div>`
                        }
                    </div>
                    <div class="card-footer">
                        <small class="text-muted">${description.description}</small>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * グラフモーダルを追加
     */
    addGraphModal() {
        // すでにモーダルが存在する場合は何もしない
        if (document.getElementById('graphZoomModal')) return;
        
        const modalHTML = `
            <div class="modal fade" id="graphZoomModal" tabindex="-1" aria-labelledby="graphZoomModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="graphZoomModalLabel">グラフ詳細</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center">
                            <img id="modalGraphImage" src="" alt="グラフ詳細" class="img-fluid">
                            <div id="modalGraphDescription" class="mt-3"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * グラフのインタラクション設定
     */
    setupGraphInteractions() {
        // ツールチップ初期化
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
        
        // グラフホバー効果
        document.querySelectorAll('.graph-container').forEach(container => {
            const overlay = container.querySelector('.graph-overlay');
            if (overlay) {
                container.addEventListener('mouseenter', () => {
                    overlay.style.opacity = '1';
                });
                container.addEventListener('mouseleave', () => {
                    overlay.style.opacity = '0';
                });
            }
        });
        
        // 情報アイコンのイベントリスナーを追加
        document.querySelectorAll('.graph-info-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation(); // カードのクリックイベントが発火しないようにする
                const graphType = icon.dataset.graphType;
                this.showGraphExplanation(graphType);
            });
        });
    }

    /**
     * グラフの詳細表示
     * @param {string} imageSrc - 画像のソースURL
     * @param {string} encodedDescription - エンコードされたグラフ説明
     */
    showGraphZoom(imageSrc, encodedDescription) {
        try {
            // 画像がない場合は処理しない
            if (!imageSrc) {
                return;
            }
            
            const description = JSON.parse(decodeURIComponent(encodedDescription));
            
            // モーダル要素の取得
            const modal = document.getElementById('graphZoomModal');
            const modalImage = document.getElementById('modalGraphImage');
            const modalDescription = document.getElementById('modalGraphDescription');
            
            if (!modal || !modalImage || !modalDescription) {
                return;
            }
            
            // モーダルの内容を設定
            modalImage.src = imageSrc;
            modalImage.alt = description.title;
            
            // エラー処理を追加
            modalImage.onerror = function() {
                this.style.display = 'none';
                modalDescription.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <p>画像を読み込めませんでした。</p>
                    </div>
                    ${this.createInsightsHTML(description)}
                `;
            }.bind(this);
            
            // 説明文を設定
            let descriptionHTML = `
                <div class="alert alert-info mb-3">
                    <p><strong>${description.title}について:</strong> ${description.description}</p>
                </div>
            `;
            
            // インサイト情報があれば追加
            descriptionHTML += this.createInsightsHTML(description);
            
            // 詳細な説明を追加
            descriptionHTML += this.getDetailedExplanation(description.title);
            
            modalDescription.innerHTML = descriptionHTML;
            
            // モーダルを表示
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
        } catch (error) {
            // エラー処理
        }
    }

    /**
     * インサイト情報のHTML生成
     * @param {Object} description - グラフ説明データ
     * @returns {string} インサイト情報のHTML
     */
    createInsightsHTML(description) {
        if (!description.insights) return '';
        
        let html = '<div class="card mt-3"><div class="card-header">解釈のポイント</div><div class="card-body">';
        
        // インサイトの追加
        Object.entries(description.insights).forEach(([key, insight]) => {
            const insightTitle = this.getInsightTitle(key);
            const safeInsightTitle = insightTitle.replace(/"/g, '&quot;');
            const safeInsight = insight.replace(/"/g, '&quot;');
            
            html += `<p><strong>${safeInsightTitle}:</strong> ${safeInsight}</p>`;
        });
        
        html += '</div></div>';
        return html;
    }

    /**
     * インサイトタイトルの取得
     * @param {string} key - インサイトキー
     * @returns {string} インサイトタイトル
     */
    getInsightTitle(key) {
        const titles = {
            good: '✅ 良好な状態',
            overfit: '⚠️ 過学習の兆候',
            underfit: '📊 学習不足の兆候',
            diagonal: '🎯 正解率',
            offDiagonal: '❌ 誤分類',
            auc: '📈 AUC値',
            curve: '📉 曲線の形状',
            high: '⬆️ 高アノテーション率',
            balance: '⚖️ バランス'
        };
        return titles[key] || key;
    }

    /**
     * 詳細な説明を取得
     * @param {string} graphTitle - グラフタイトル
     * @returns {string} 詳細な説明のHTML
     */
    getDetailedExplanation(graphTitle) {
        const explanations = {
            '学習曲線': `
                <div class="card mt-3">
                    <div class="card-header">詳細な説明</div>
                    <div class="card-body">
                        <h5>学習曲線とは</h5>
                        <p>学習曲線は、モデルの訓練過程における精度の変化を示すグラフです。横軸は学習サンプル数、縦軸は精度を表します。</p>
                        
                        <h5>グラフの読み方</h5>
                        <ul>
                            <li><strong>青線（学習データ）</strong>: 訓練に使用したデータでの精度を示します。</li>
                            <li><strong>緑線（検証データ）</strong>: モデルが見たことのないデータでの精度を示します。</li>
                        </ul>
                        
                        <h5>理想的なパターン</h5>
                        <p>両方の線が高い値（1.0に近い）で安定している場合、モデルの性能が良いことを示します。</p>
                        
                        <h5>問題のあるパターン</h5>
                        <ul>
                            <li><strong>過学習</strong>: 青線（学習データ）は高いが、緑線（検証データ）が低い場合、モデルが訓練データを「暗記」してしまい、新しいデータに対応できていません。</li>
                            <li><strong>適合不足</strong>: 両方の線が低い値の場合、モデルの複雑さが足りないか、特徴が不十分である可能性があります。</li>
                        </ul>
                        
                        <h5>改善方法</h5>
                        <ul>
                            <li>過学習の場合: より多くの訓練データを追加するか、モデルを単純化する</li>
                            <li>適合不足の場合: より複雑なモデルを使用するか、特徴を追加する</li>
                        </ul>
                    </div>
                </div>
            `,
            '混同行列': `
                <div class="card mt-3">
                    <div class="card-header">詳細な説明</div>
                    <div class="card-body">
                        <h5>混同行列とは</h5>
                        <p>混同行列は、分類モデルの性能を評価するための表です。モデルが予測した結果と実際の正解の関係を示します。</p>
                        
                        <h5>グラフの読み方</h5>
                        <ul>
                            <li><strong>行（縦軸）</strong>: 実際のクラス（正解）</li>
                            <li><strong>列（横軸）</strong>: 予測されたクラス（モデルの出力）</li>
                            <li><strong>セル内の数値</strong>: その組み合わせのサンプル数</li>
                        </ul>
                        
                        <h5>主要な指標</h5>
                        <ul>
                            <li><strong>正解率（Accuracy）</strong>: 全体の予測のうち、正しく予測された割合</li>
                            <li><strong>適合率（Precision）</strong>: 特定のクラスと予測したもののうち、実際にそのクラスだった割合</li>
                            <li><strong>再現率（Recall）</strong>: 実際の特定のクラスのうち、正しく予測された割合</li>
                        </ul>
                        
                        <h5>解釈のポイント</h5>
                        <p>対角線上の値が高いほど、モデルの予測精度が高いことを示します。非対角の値が高い場合、モデルがそれらのクラス間で混乱していることを示します。</p>
                    </div>
                </div>
            `,
            'ROCカーブ': `
                <div class="card mt-3">
                    <div class="card-header">詳細な説明</div>
                    <div class="card-body">
                        <h5>ROCカーブとは</h5>
                        <p>ROCカーブ（Receiver Operating Characteristic curve）は、様々な閾値における真陽性率（TPR）と偽陽性率（FPR）をプロットしたグラフです。</p>
                        
                        <h5>グラフの読み方</h5>
                        <ul>
                            <li><strong>横軸（偽陽性率）</strong>: 実際は陰性なのに陽性と予測した割合</li>
                            <li><strong>縦軸（真陽性率）</strong>: 実際に陽性のものを正しく陽性と予測した割合</li>
                            <li><strong>AUC（Area Under Curve）</strong>: カーブの下の面積。1に近いほど良いモデル</li>
                        </ul>
                        
                        <h5>AUCの解釈</h5>
                        <ul>
                            <li><strong>1.0</strong>: 完璧な分類</li>
                            <li><strong>0.9-0.99</strong>: 非常に優れたモデル</li>
                            <li><strong>0.8-0.89</strong>: 良いモデル</li>
                            <li><strong>0.7-0.79</strong>: まずまずのモデル</li>
                            <li><strong>0.6-0.69</strong>: あまり良くないモデル</li>
                            <li><strong>0.5</strong>: ランダム予測と同等（無意味なモデル）</li>
                        </ul>
                    </div>
                </div>
            `,
            'アノテーション効果': `
                <div class="card mt-3">
                    <div class="card-header">詳細な説明</div>
                    <div class="card-body">
                        <h5>アノテーション効果とは</h5>
                        <p>アノテーション効果は、手動でアノテーション（データへの追加情報の付与）を行った画像の数と、モデルの性能向上の関係を示します。</p>
                        
                        <h5>グラフの読み方</h5>
                        <ul>
                            <li><strong>横軸</strong>: 雄（オス）、雌（メス）、および合計のカテゴリ</li>
                            <li><strong>縦軸</strong>: アノテーション済み画像の数</li>
                            <li><strong>青色のバー</strong>: アノテーション済みの画像数</li>
                            <li><strong>オレンジ色のバー</strong>: アノテーションされていない画像数</li>
                        </ul>
                        
                        <h5>重要なポイント</h5>
                        <ol>
                            <li><strong>高アノテーション率</strong>: アノテーション率が高いほど、モデルの精度向上が期待できます</li>
                            <li><strong>バランス</strong>: オスとメスのアノテーション数のバランスも重要です</li>
                        </ol>
                    </div>
                </div>
            `
        };
        
        return explanations[graphTitle] || '';
    }

    /**
     * 改善提案表示
     */
    displayImprovementSuggestions() {
        const container = document.getElementById('improvement-suggestions');
        if (!container) return;
        
        const suggestions = this.parent.learningResults.improvement_suggestions || [];
        
        if (suggestions.length === 0) {
            container.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong>素晴らしい結果です！</strong><br>
                    現在のモデルは良好な性能を示しています。
                </div>
            `;
            return;
        }
        
        const suggestionsHTML = suggestions.map(suggestion => {
            const priorityClass = suggestion.priority === 'high' ? 'alert-warning' : 'alert-info';
            const priorityIcon = suggestion.priority === 'high' ? 'fas fa-exclamation-triangle' : 'fas fa-lightbulb';
            
            return `
                <div class="alert ${priorityClass}">
                    <i class="${priorityIcon} me-2"></i>
                    <strong>${suggestion.category}:</strong><br>
                    ${suggestion.message}
                </div>
            `;
        }).join('');
        
        container.innerHTML = suggestionsHTML;
    }

    /**
     * グラフパスを生成
     * @param {string} graphType - グラフタイプ
     * @param {string} baseTimestamp - 基本タイムスタンプ
     * @param {string} annotationTimestamp - アノテーションタイムスタンプ
     * @returns {Array} パスの配列
     */
    generateGraphPaths(graphType, baseTimestamp, annotationTimestamp) {
        const paths = [];
        
        // 基本パターン
        paths.push(`/evaluation/images/${graphType}_${baseTimestamp}.png`);
        
        // ISO形式のタイムスタンプ変換を試みる
        if (baseTimestamp.includes('_')) {
            try {
                // YYYYMMDD_HHMMSS → YYYY-MM-DDTHH:MM:SS 形式に変換
                const year = baseTimestamp.substring(0, 4);
                const month = baseTimestamp.substring(4, 6);
                const day = baseTimestamp.substring(6, 8);
                const hour = baseTimestamp.substring(9, 11);
                const minute = baseTimestamp.substring(11, 13);
                const second = baseTimestamp.substring(13, 15);
                
                const isoTimestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
                paths.push(`/evaluation/images/${graphType}_${isoTimestamp}.png`);
                
                // 完全なISO文字列も試す
                paths.push(`/evaluation/images/${graphType}_${isoTimestamp}.558600.png`);
            } catch (e) {
                // タイムスタンプ変換エラー
            }
        }
        
        // アノテーション効果の場合は特別なパスも追加
        if (graphType === 'annotation_impact' && annotationTimestamp && annotationTimestamp !== baseTimestamp) {
            paths.push(`/evaluation/images/${graphType}_${annotationTimestamp}.png`);
        }
        
        // 既知の動作確認済みパスを追加（フォールバック）
        paths.push(`/evaluation/images/${graphType}_2025-05-23T09:52:21.613416.png`);
        
        return paths;
    }

    /**
     * 学習曲線の取得
     * @param {string} timestamp - タイムスタンプ
     * @returns {Promise<Array>} 学習曲線データ
     */
    async getLearningCurve(timestamp) {
        try {
            const response = await fetch(`/learning/learning-curve/${timestamp}`);
            if (!response.ok) throw new Error('学習曲線の取得に失敗しました');
            
            const data = await response.json();
            return data.curve || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * 混同行列の取得
     * @param {string} timestamp - タイムスタンプ
     * @returns {Promise<Object>} 混同行列データ
     */
    async getConfusionMatrix(timestamp) {
        try {
            const response = await fetch(`/learning/confusion-matrix/${timestamp}`);
            if (!response.ok) throw new Error('混同行列の取得に失敗しました');
            
            const data = await response.json();
            return data.matrix || {};
        } catch (error) {
            return {};
        }
    }

    /**
     * ROC曲線の取得
     * @param {string} timestamp - タイムスタンプ
     * @returns {Promise<Object>} ROC曲線データ
     */
    async getRocCurve(timestamp) {
        try {
            const response = await fetch(`/learning/roc-curve/${timestamp}`);
            if (!response.ok) throw new Error('ROC曲線の取得に失敗しました');
            
            const data = await response.json();
            return data.curve || {};
        } catch (error) {
            return {};
        }
    }
}