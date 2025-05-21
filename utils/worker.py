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
                                
                                # モデル評価の実行
                                print("モデル評価の実行を開始")
                                eval_dir = os.path.join(app_config.get('STATIC_FOLDER', 'static'), 'evaluation')
                                print(f"評価結果保存先: {eval_dir}")
                                
                                os.makedirs(eval_dir, exist_ok=True)
                                
                                # モデル評価実行
                                from utils.model_evaluation import evaluate_model
                                eval_results = evaluate_model(X_scaled, y, model, output_dir=eval_dir)
                                
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
                    
                    # アノテーション影響分析実行
                    from utils.model_evaluation import analyze_annotation_impact
                    
                    # コンフィグから評価結果の保存先を取得
                    evaluation_dir = os.path.join(app_config.get('STATIC_FOLDER', 'static'), 'evaluation')
                    
                    # 分析実行
                    result = analyze_annotation_impact(dataset_dir, model_path, output_dir=evaluation_dir)
                    
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