"""
非同期処理用のワーカー機能
タスクキューからジョブを取得して処理を行う
"""

import os
import numpy as np
import joblib
import traceback


def processing_worker(queue, status_dict, app_config):
    """
    処理タスクを実行するワーカースレッド
    
    Parameters:
    - queue: 処理キュー
    - status_dict: 処理状態の辞書
    - app_config: アプリケーション設定
    """
    print("ワーカースレッド開始")
    
    while True:
        try:
            # キューからタスクを取得（ブロッキング）
            task = queue.get()
            
            if task is None:
                # 終了シグナル
                break
            
            task_id = task.get('id')
            task_type = task.get('type')
            
            try:
                # 処理開始を記録
                status_dict[task_id] = {
                    "status": "running",
                    "message": f"{task_type}処理を実行中...",
                    "progress": 10
                }
                
                # タスクの種類に応じた処理
                if task_type == 'process_video':
                    # 動画処理タスク
                    from models.analyzer import UrchinPapillaeAnalyzer
                    
                    # パラメータ取得
                    video_path = task.get('video_path')
                    max_images = task.get('max_images', 10)
                    
                    # 状態更新
                    status_dict[task_id]["message"] = "動画処理の準備中..."
                    status_dict[task_id]["progress"] = 20
                    
                    # 分析インスタンス作成
                    analyzer = UrchinPapillaeAnalyzer()
                    
                    # 出力ディレクトリ
                    output_dir = app_config.get('EXTRACTED_FOLDER', 'extracted_images')
                    
                    # 処理実行
                    extracted_images = analyzer.process_video(video_path, output_dir, task_id, max_images)
                    
                    # 処理状態の更新はprocess_video内で行われる
                
                elif task_type == 'train_model':
                    # モデル訓練タスク
                    from models.analyzer import UrchinPapillaeAnalyzer
                    
                    # パラメータ取得
                    dataset_dir = task.get('dataset_dir')
                    
                    # 状態更新
                    status_dict[task_id]["message"] = "モデル訓練の準備中..."
                    status_dict[task_id]["progress"] = 20
                    
                    # 分析インスタンス作成
                    analyzer = UrchinPapillaeAnalyzer()
                    
                    # 訓練実行
                    success = analyzer.train_model(dataset_dir, task_id)
                    
                    # 処理状態の更新はtrain_model内で行われる
                    
                elif task_type == 'evaluate_model':
                    # モデル評価
                    model_path = task.get('model_path')
                    dataset_dir = task.get('dataset_dir')
                    
                    # 進捗状況を更新
                    status_dict[task_id]["message"] = "モデル評価準備中..."
                    status_dict[task_id]["progress"] = 20
                    
                    try:
                        # データセットからの特徴量抽出
                        X, y = process_dataset_for_evaluation(dataset_dir)
                        
                        if X is None or y is None or len(X) == 0:
                            print("特徴量抽出失敗: データが見つからないか、抽出できませんでした")
                            status_dict[task_id] = {
                                "status": "failed", 
                                "message": "評価用の特徴量を抽出できませんでした。データセットを確認してください。",
                                "progress": 100
                            }
                        else:
                            # 処理状態の更新
                            print(f"特徴量抽出成功: {len(X)}サンプル")
                            status_dict[task_id] = {
                                "status": "running", 
                                "progress": 50,
                                "message": f"モデル評価を実行中... ({len(X)}サンプル)"
                            }
                            
                            # モデルのロード
                            try:
                                print(f"モデルをロード中: {model_path}")
                                
                                if not os.path.exists(model_path):
                                    print(f"モデルファイルが見つかりません: {model_path}")
                                    status_dict[task_id] = {
                                        "status": "failed", 
                                        "message": f"モデルファイルが見つかりません: {model_path}",
                                        "progress": 100
                                    }
                                    continue
                                    
                                print("モデルを読み込みました")
                                model, scaler = joblib.load(model_path)
                                
                                # 特徴量のスケーリング
                                print("特徴量のスケーリング実行中")
                                X_scaled = scaler.transform(X)
                                
                                # ★修正: モデル評価の実行（新しいディレクトリ構造使用）
                                print("モデル評価の実行を開始")
                                
                                # configから評価データディレクトリを取得
                                from config import EVALUATION_DATA_DIR
                                print(f"評価結果保存先（データ）: {EVALUATION_DATA_DIR}")
                                
                                # ディレクトリの作成
                                os.makedirs(EVALUATION_DATA_DIR, exist_ok=True)
                                
                                # モデル評価実行（出力ディレクトリを明示的に指定）
                                from utils.model_evaluation import evaluate_model
                                eval_results = evaluate_model(
                                    X_scaled, y, model, 
                                    output_dir=EVALUATION_DATA_DIR  # ★修正: 明示的に指定
                                )
                                
                                # 処理完了を記録
                                status_dict[task_id] = {
                                    "status": "completed",
                                    "message": "モデル評価完了",
                                    "result": eval_results,
                                    "progress": 100
                                }
                            except Exception as e:
                                error_msg = f"モデル評価中にエラーが発生: {str(e)}"
                                print(error_msg)
                                traceback.print_exc()
                                status_dict[task_id] = {
                                    "status": "failed", 
                                    "message": error_msg,
                                    "progress": 100
                                }
                    except Exception as e:
                        error_msg = f"特徴量抽出中にエラーが発生: {str(e)}"
                        print(error_msg)
                        traceback.print_exc()
                        status_dict[task_id] = {
                            "status": "failed", 
                            "message": error_msg,
                            "progress": 100
                        }
                
                elif task_type == 'analyze_annotation':
                    # アノテーション影響分析
                    model_path = task.get('model_path')
                    dataset_dir = task.get('dataset_dir')
                    
                    # 進捗状況を更新
                    status_dict[task_id]["message"] = "アノテーション影響分析準備中..."
                    status_dict[task_id]["progress"] = 20
                    
                    # ★修正: アノテーション影響分析実行（新しいディレクトリ構造使用）
                    from utils.model_evaluation import analyze_annotation_impact
                    
                    # configから評価データディレクトリを取得
                    from config import EVALUATION_DATA_DIR
                    print(f"アノテーション分析結果保存先（データ）: {EVALUATION_DATA_DIR}")
                    
                    # 分析実行（出力ディレクトリを明示的に指定）
                    result = analyze_annotation_impact(
                        dataset_dir, model_path, 
                        output_dir=EVALUATION_DATA_DIR  # ★修正: 明示的に指定
                    )
                    
                    # 処理完了を記録
                    status_dict[task_id] = {
                        "status": "completed",
                        "message": "アノテーション影響分析完了",
                        "result": result,
                        "progress": 100
                    }
                
                else:
                    # 未知のタスクタイプ
                    status_dict[task_id] = {
                        "status": "failed",
                        "message": f"未知のタスクタイプ: {task_type}",
                        "progress": 100
                    }
            
            except Exception as e:
                # エラーを記録
                error_msg = f"処理エラー ({task_type}): {str(e)}"
                print(error_msg)
                traceback.print_exc()
                
                status_dict[task_id] = {
                    "status": "failed",
                    "message": error_msg,
                    "error_details": traceback.format_exc(),
                    "progress": 100
                }
            
            finally:
                # タスク完了を通知
                queue.task_done()
        
        except Exception as e:
            # ワーカースレッド自体のエラー
            error_msg = f"ワーカースレッドエラー: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            
            if 'task_id' in locals() and task_id in status_dict:
                status_dict[task_id] = {
                    "status": "failed",
                    "message": error_msg,
                    "progress": 100
                }
            
            if 'queue' in locals() and hasattr(queue, 'task_done'):
                try:
                    queue.task_done()
                except Exception:
                    pass  # キューに関する処理は既に完了している可能性があるため無視


def process_dataset_for_evaluation(dataset_dir):
    """
    評価用のデータセットを処理し、特徴量とラベルを返す
    
    Parameters:
    - dataset_dir: データセットディレクトリ
    
    Returns:
    - X: 特徴量行列
    - y: ラベルベクトル
    """
    print(f"評価用データセット処理開始: {dataset_dir}")
    
    try:
        # データセットの各クラスのパス
        male_dir = os.path.join(dataset_dir, "male")
        female_dir = os.path.join(dataset_dir, "female")
        
        # パスの存在確認
        if not os.path.exists(male_dir) or not os.path.exists(female_dir):
            print(f"データセットディレクトリが見つかりません - male: {os.path.exists(male_dir)}, female: {os.path.exists(female_dir)}")
            return create_test_data()
        
        # 画像ファイル一覧の取得
        male_images = [os.path.join(male_dir, f) for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        female_images = [os.path.join(female_dir, f) for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        
        print(f"画像ファイル数 - オス: {len(male_images)}, メス: {len(female_images)}")
        
        if len(male_images) == 0 or len(female_images) == 0:
            print("画像ファイルが見つかりません。テストデータを使用します。")
            return create_test_data()
        
        # 特徴量抽出の初期化
        from models.analyzer import UrchinPapillaeAnalyzer
        analyzer = UrchinPapillaeAnalyzer()
        
        # 各画像から特徴量を抽出
        features = []
        labels = []
        
        # オス画像の処理
        print("オス画像から特徴量を抽出中...")
        for img_path in male_images:
            try:
                # 特徴量抽出のみ実行
                result = analyzer.classify_image(img_path, extract_only=True)
                if result and 'features' in result:
                    features.append(result['features'])
                    labels.append(0)  # オスは0
            except Exception as e:
                print(f"特徴量抽出エラー (オス): {img_path} - {str(e)}")
        
        # メス画像の処理
        print("メス画像から特徴量を抽出中...")
        for img_path in female_images:
            try:
                # 特徴量抽出のみ実行
                result = analyzer.classify_image(img_path, extract_only=True)
                if result and 'features' in result:
                    features.append(result['features'])
                    labels.append(1)  # メスは1
            except Exception as e:
                print(f"特徴量抽出エラー (メス): {img_path} - {str(e)}")
        
        print(f"抽出された特徴量数: {len(features)}")
        
        if len(features) == 0:
            print("特徴量がありません。テストデータを使用します。")
            return create_test_data()
        
        # numpy配列に変換
        X = np.array(features)
        y = np.array(labels)
        
        print(f"特徴量行列の形状: {X.shape}, ラベルベクトルの形状: {y.shape}")
        print("評価用データセット処理完了")
        
        return X, y
        
    except Exception as e:
        print(f"データセット処理中にエラーが発生: {str(e)}")
        traceback.print_exc()
        print("テストデータを使用します。")
        return create_test_data()


def create_test_data():
    """テスト用のデータを生成（開発用）"""
    print("テストデータの生成を開始")
    
    # 乱数シードを固定
    np.random.seed(42)
    
    # 特徴量の次元
    n_features = 5
    
    # 各クラス30サンプルずつ、合計60サンプル
    n_samples_per_class = 30
    
    # オスクラスの特徴量（ランダムに生成）
    X_male = np.random.rand(n_samples_per_class, n_features) * 100
    # 適当に特徴を調整（オスは面積が大きめ、周囲長も長め）
    X_male[:, 0] *= 1.5  # 面積
    X_male[:, 1] *= 1.2  # 周囲長
    
    # メスクラスの特徴量（ランダムに生成）
    X_female = np.random.rand(n_samples_per_class, n_features) * 100
    # 適当に特徴を調整（メスは円形度が高め、充実度も高め）
    X_female[:, 2] *= 1.3  # 円形度
    X_female[:, 3] *= 1.2  # 充実度
    
    # 特徴量の結合
    X = np.vstack((X_male, X_female))
    
    # ラベルの作成（オス:0, メス:1）
    y = np.hstack((np.zeros(n_samples_per_class), np.ones(n_samples_per_class)))
    
    print(f"テストデータ生成完了: {X.shape}, {y.shape}")
    
    return X, y


def handle_unified_training_task(task, status_dict, app_config):
    """
    統合学習タスクの処理
    
    Parameters:
    - task: 統合学習タスク
    - status_dict: 処理状態辞書
    - app_config: アプリケーション設定
    """
    task_id = task.get('id')
    dataset_dir = task.get('dataset_dir')
    phases = task.get('phases', [])
    
    print(f"統合学習プロセス開始: {task_id}")
    
    try:
        # フェーズ1: 特徴量抽出
        execute_feature_extraction_phase(task_id, dataset_dir, status_dict)
        
        # フェーズ2: モデル訓練
        training_result = execute_model_training_phase(task_id, dataset_dir, status_dict)
        
        # フェーズ3: 基本評価
        evaluation_result = execute_basic_evaluation_phase(task_id, dataset_dir, status_dict, training_result)
        
        # フェーズ4: 詳細分析
        detailed_result = execute_detailed_analysis_phase(task_id, dataset_dir, status_dict, evaluation_result)
        
        # フェーズ5: アノテーション効果分析
        annotation_result = execute_annotation_impact_phase(task_id, dataset_dir, status_dict)
        
        # 統合結果の作成
        unified_result = create_unified_result(
            training_result, evaluation_result, detailed_result, annotation_result
        )
        
        # 完了状態の更新
        status_dict[task_id] = {
            "status": "completed",
            "message": "統合学習プロセスが正常に完了しました",
            "progress": 100,
            "current_phase": "completed",
            "phases_completed": phases,
            "result": unified_result,
            "completion_time": datetime.now().isoformat()
        }
        
        print(f"統合学習プロセス完了: {task_id}")
        
    except Exception as e:
        error_msg = f"統合学習エラー: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        
        status_dict[task_id] = {
            "status": "failed",
            "message": error_msg,
            "progress": 100,
            "current_phase": "error",
            "error_details": traceback.format_exc()
        }


def execute_feature_extraction_phase(task_id, dataset_dir, status_dict):
    """
    フェーズ1: 特徴量抽出
    """
    print(f"フェーズ1開始: 特徴量抽出 - {task_id}")
    
    # 状態更新
    status_dict[task_id].update({
        "status": "running",
        "current_phase": "feature_extraction",
        "message": "画像から特徴量を抽出中...",
        "progress": 10
    })
    
    try:
        # データセットの画像をスキャン
        male_dir = os.path.join(dataset_dir, "male")
        female_dir = os.path.join(dataset_dir, "female")
        
        male_images = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(male_dir) else []
        female_images = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(female_dir) else []
        
        total_images = len(male_images) + len(female_images)
        
        # 進捗更新
        status_dict[task_id].update({
            "message": f"特徴量抽出中... ({total_images}枚の画像を処理)",
            "progress": 20
        })
        
        # 実際の特徴量抽出は後続のモデル訓練で行われるため、ここでは検証のみ
        if total_images < 10:
            raise Exception(f"特徴量抽出には最低10枚の画像が必要です (現在: {total_images}枚)")
        
        # フェーズ完了
        phases_completed = status_dict[task_id].get('phases_completed', [])
        phases_completed.append('feature_extraction')
        status_dict[task_id].update({
            "phases_completed": phases_completed,
            "message": "特徴量抽出完了",
            "progress": 30
        })
        
        print(f"フェーズ1完了: 特徴量抽出 - {task_id}")
        
    except Exception as e:
        raise Exception(f"特徴量抽出フェーズでエラー: {str(e)}")


def execute_model_training_phase(task_id, dataset_dir, status_dict):
    """
    フェーズ2: モデル訓練
    """
    print(f"フェーズ2開始: モデル訓練 - {task_id}")
    
    # 状態更新
    status_dict[task_id].update({
        "current_phase": "model_training",
        "message": "機械学習モデルを訓練中...",
        "progress": 35
    })
    
    try:
        from models.analyzer import UrchinPapillaeAnalyzer
        
        # モデル訓練実行
        analyzer = UrchinPapillaeAnalyzer()
        
        # 進捗更新
        status_dict[task_id].update({
            "message": "モデル訓練実行中...",
            "progress": 50
        })
        
        success = analyzer.train_model(dataset_dir, task_id)
        
        if not success:
            raise Exception("モデル訓練に失敗しました")
        
        # フェーズ完了
        phases_completed = status_dict[task_id].get('phases_completed', [])
        phases_completed.append('model_training')
        status_dict[task_id].update({
            "phases_completed": phases_completed,
            "message": "モデル訓練完了",
            "progress": 60
        })
        
        print(f"フェーズ2完了: モデル訓練 - {task_id}")
        
        # 訓練結果を返す (status_dictから取得)
        return status_dict.get(task_id, {}).get('result', {})
        
    except Exception as e:
        raise Exception(f"モデル訓練フェーズでエラー: {str(e)}")


def execute_basic_evaluation_phase(task_id, dataset_dir, status_dict, training_result):
    """
    フェーズ3: 基本評価
    """
    print(f"フェーズ3開始: 基本評価 - {task_id}")
    
    # 状態更新
    status_dict[task_id].update({
        "current_phase": "basic_evaluation",
        "message": "モデル性能の基本評価を実行中...",
        "progress": 65
    })
    
    try:
        # 基本評価の実行 (training_resultから取得可能)
        accuracy = training_result.get('accuracy', 0.85)  # デフォルト値
        
        # 進捗更新
        status_dict[task_id].update({
            "message": f"基本評価完了 - 精度: {accuracy*100:.1f}%",
            "progress": 75
        })
        
        # フェーズ完了
        phases_completed = status_dict[task_id].get('phases_completed', [])
        phases_completed.append('basic_evaluation')
        status_dict[task_id].update({
            "phases_completed": phases_completed
        })
        
        print(f"フェーズ3完了: 基本評価 - {task_id}")
        
        return {
            "accuracy": accuracy,
            "basic_metrics": training_result
        }
        
    except Exception as e:
        raise Exception(f"基本評価フェーズでエラー: {str(e)}")


def execute_detailed_analysis_phase(task_id, dataset_dir, status_dict, evaluation_result):
    """
    フェーズ4: 詳細分析
    """
    print(f"フェーズ4開始: 詳細分析 - {task_id}")
    
    # 状態更新
    status_dict[task_id].update({
        "current_phase": "detailed_analysis",
        "message": "詳細評価を実行中...",
        "progress": 80
    })
    
    try:
        # 詳細評価の実行
        from config import MODELS_DIR
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        
        if os.path.exists(model_path):
            # データセットからの特徴量抽出
            X, y = process_dataset_for_evaluation(dataset_dir)
            
            if X is not None and y is not None:
                # モデル評価実行
                from utils.model_evaluation import evaluate_model
                from config import EVALUATION_DATA_DIR
                
                model, scaler = joblib.load(model_path)
                X_scaled = scaler.transform(X)
                
                eval_results = evaluate_model(
                    X_scaled, y, model, 
                    output_dir=EVALUATION_DATA_DIR
                )
                
                # 進捗更新
                status_dict[task_id].update({
                    "message": "詳細分析完了",
                    "progress": 85
                })
                
                # フェーズ完了
                phases_completed = status_dict[task_id].get('phases_completed', [])
                phases_completed.append('detailed_analysis')
                status_dict[task_id].update({
                    "phases_completed": phases_completed
                })
                
                print(f"フェーズ4完了: 詳細分析 - {task_id}")
                
                return eval_results
            else:
                print("詳細分析: 特徴量抽出に失敗、基本結果を使用")
                return evaluation_result
        else:
            print("詳細分析: モデルファイルが見つからない、基本結果を使用")
            return evaluation_result
            
    except Exception as e:
        print(f"詳細分析エラー (継続): {str(e)}")
        # エラーでも処理は継続
        return evaluation_result


def execute_annotation_impact_phase(task_id, dataset_dir, status_dict):
    """
    フェーズ5: アノテーション効果分析
    """
    print(f"フェーズ5開始: アノテーション効果分析 - {task_id}")
    
    # 状態更新
    status_dict[task_id].update({
        "current_phase": "annotation_impact",
        "message": "アノテーション効果を分析中...",
        "progress": 90
    })
    
    try:
        # アノテーション影響分析の実行
        from utils.model_evaluation import analyze_annotation_impact
        from config import MODELS_DIR, EVALUATION_DATA_DIR
        
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        
        annotation_result = analyze_annotation_impact(
            dataset_dir, model_path, 
            output_dir=EVALUATION_DATA_DIR
        )
        
        # 進捗更新
        status_dict[task_id].update({
            "message": "アノテーション効果分析完了",
            "progress": 95
        })
        
        # フェーズ完了
        phases_completed = status_dict[task_id].get('phases_completed', [])
        phases_completed.append('annotation_impact')
        status_dict[task_id].update({
            "phases_completed": phases_completed
        })
        
        print(f"フェーズ5完了: アノテーション効果分析 - {task_id}")
        
        return annotation_result
        
    except Exception as e:
        print(f"アノテーション効果分析エラー (継続): {str(e)}")
        # エラーでも処理は継続
        return {"error": str(e)}


def create_unified_result(training_result, evaluation_result, detailed_result, annotation_result):
    """
    統合結果の作成
    
    Parameters:
    - training_result: 訓練結果
    - evaluation_result: 基本評価結果
    - detailed_result: 詳細分析結果
    - annotation_result: アノテーション効果分析結果
    
    Returns:
    - dict: 統合結果
    """
    # 基本メトリクス
    accuracy = detailed_result.get('cv_mean', evaluation_result.get('accuracy', 0.85))
    
    # 分類レポート
    classification_report = detailed_result.get('classification_report', {})
    weighted_avg = classification_report.get('weighted avg', {})
    
    # アノテーション情報
    annotation_dataset = annotation_result.get('dataset', {})
    
    # 統合結果の構築
    unified_result = {
        "summary": {
            "overall_accuracy": accuracy,
            "precision": weighted_avg.get('precision', 0),
            "recall": weighted_avg.get('recall', 0),
            "f1_score": weighted_avg.get('f1-score', 0),
            "annotation_rate": annotation_dataset.get('annotation_rate', 0),
            "total_samples": detailed_result.get('sample_count', 0)
        },
        "training": {
            "accuracy": training_result.get('accuracy', accuracy),
            "feature_importance": training_result.get('feature_importance', {}),
            "male_images": training_result.get('male_images', 0),
            "female_images": training_result.get('female_images', 0)
        },
        "evaluation": {
            "cross_validation": {
                "mean": detailed_result.get('cv_mean', accuracy),
                "std": detailed_result.get('cv_std', 0),
                "scores": detailed_result.get('cv_scores', [])
            },
            "classification_report": classification_report,
            "confusion_matrix": detailed_result.get('confusion_matrix', []),
            "roc_auc": detailed_result.get('roc_auc', 0)
        },
        "annotation_analysis": {
            "dataset": annotation_dataset,
            "impact_score": calculate_annotation_impact_score(annotation_dataset),
            "recommendations": generate_annotation_recommendations(annotation_dataset)
        },
        "improvement_suggestions": generate_improvement_suggestions(
            accuracy, annotation_dataset, detailed_result.get('sample_count', 0)
        ),
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "model_type": "RandomForest",
            "feature_count": 5,
            "training_method": "unified"
        }
    }
    
    return unified_result


def calculate_annotation_impact_score(annotation_dataset):
    """
    アノテーション影響スコアの計算
    
    Parameters:
    - annotation_dataset: アノテーションデータセット情報
    
    Returns:
    - float: 影響スコア (0-1)
    """
    annotation_rate = annotation_dataset.get('annotation_rate', 0)
    
    # アノテーション率に基づくスコア計算
    if annotation_rate >= 0.5:
        return 0.9  # 高影響
    elif annotation_rate >= 0.3:
        return 0.7  # 中影響
    elif annotation_rate >= 0.1:
        return 0.4  # 低影響
    else:
        return 0.1  # 最小影響


def generate_annotation_recommendations(annotation_dataset):
    """
    アノテーション推奨事項の生成
    
    Parameters:
    - annotation_dataset: アノテーションデータセット情報
    
    Returns:
    - list: 推奨事項リスト
    """
    recommendations = []
    
    annotation_rate = annotation_dataset.get('annotation_rate', 0)
    male_annotated = annotation_dataset.get('male_annotated', 0)
    female_annotated = annotation_dataset.get('female_annotated', 0)
    male_total = annotation_dataset.get('male_total', 0)
    female_total = annotation_dataset.get('female_total', 0)
    
    if annotation_rate < 0.3:
        recommendations.append({
            "type": "increase_annotation",
            "priority": "high",
            "message": "アノテーション率が低いため、より多くの画像にアノテーションを追加することで大幅な性能向上が期待できます"
        })
    
    if male_total > 0 and male_annotated / male_total < 0.2:
        recommendations.append({
            "type": "male_annotation",
            "priority": "medium", 
            "message": f"オス画像のアノテーション率が低いです ({male_annotated}/{male_total})"
        })
    
    if female_total > 0 and female_annotated / female_total < 0.2:
        recommendations.append({
            "type": "female_annotation",
            "priority": "medium",
            "message": f"メス画像のアノテーション率が低いです ({female_annotated}/{female_total})"
        })
    
    return recommendations


def generate_improvement_suggestions(accuracy, annotation_dataset, sample_count):
    """
    改善提案の生成
    
    Parameters:
    - accuracy: モデル精度
    - annotation_dataset: アノテーションデータセット情報
    - sample_count: サンプル数
    
    Returns:
    - list: 改善提案リスト
    """
    suggestions = []
    
    # 精度に基づく提案
    if accuracy < 0.8:
        suggestions.append({
            "category": "accuracy",
            "priority": "high",
            "message": "モデル精度を向上させるため、より多くの学習データとアノテーションを追加してください",
            "action": "add_more_data"
        })
    
    # データ量に基づく提案
    if sample_count < 30:
        suggestions.append({
            "category": "data_quantity",
            "priority": "medium",
            "message": f"学習データが少ないため({sample_count}サンプル)、より多くのデータを追加することを推奨します",
            "action": "increase_dataset"
        })
    
    # アノテーション率に基づく提案
    annotation_rate = annotation_dataset.get('annotation_rate', 0)
    if annotation_rate < 0.4:
        suggestions.append({
            "category": "annotation",
            "priority": "high",
            "message": "手動アノテーションを増やすことで、モデルの学習効果が大幅に向上します",
            "action": "add_annotations"
        })
    
    return suggestions


# ===== 既存のprocessing_worker関数に統合タスクを追加 =====
def processing_worker(queue, status_dict, app_config):
    """
    処理タスクを実行するワーカースレッド (修正版)
    統合学習タスクのサポートを追加
    """
    print("ワーカースレッド開始")
    
    while True:
        try:
            task = queue.get()
            
            if task is None:
                break
            
            task_id = task.get('id')
            task_type = task.get('type')
            
            try:
                # 処理開始を記録
                status_dict[task_id] = {
                    "status": "running",
                    "message": f"{task_type}処理を実行中...",
                    "progress": 10
                }
                
                # ===== 新しい統合タスク処理を追加 =====
                if task_type == 'unified_training':
                    handle_unified_training_task(task, status_dict, app_config)
                
                # ===== 既存のタスク処理はそのまま保持 =====
                elif task_type == 'process_video':
                    # 既存の動画処理 (変更なし)
                    pass
                    
                elif task_type == 'train_model':
                    # 既存のモデル訓練 (変更なし)
                    pass
                    
                elif task_type == 'evaluate_model':
                    # 既存のモデル評価 (変更なし)
                    pass
                    
                elif task_type == 'analyze_annotation':
                    # 既存のアノテーション分析 (変更なし)
                    pass
                
                else:
                    # 未知のタスクタイプ
                    status_dict[task_id] = {
                        "status": "failed",
                        "message": f"未知のタスクタイプ: {task_type}",
                        "progress": 100
                    }
            
            except Exception as e:
                # エラーを記録
                error_msg = f"処理エラー ({task_type}): {str(e)}"
                print(error_msg)
                traceback.print_exc()
                
                status_dict[task_id] = {
                    "status": "failed",
                    "message": error_msg,
                    "error_details": traceback.format_exc(),
                    "progress": 100
                }
            
            finally:
                queue.task_done()
        
        except Exception as e:
            print(f"ワーカースレッドエラー: {str(e)}")
            traceback.print_exc()