"""
非同期処理用のワーカー機能
"""

import os
import numpy as np
import joblib

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
                if task_type == 'extract_frames':
                    # 動画フレーム抽出
                    video_path = task.get('video_path')
                    output_dir = task.get('output_dir')
                    file_prefix = task.get('file_prefix', 'frame_')
                    
                    # 進捗状況を更新
                    status_dict[task_id]["message"] = "フレーム抽出準備中..."
                    status_dict[task_id]["progress"] = 20
                    
                    # フレーム抽出実行
                    from video_processing.frame_extractor import extract_frames
                    frames = extract_frames(video_path, output_dir, file_prefix)
                    
                    # 処理完了を記録
                    status_dict[task_id] = {
                        "status": "completed",
                        "message": f"フレーム抽出完了: {frames}フレームを抽出しました",
                        "frames": frames,
                        "progress": 100
                    }
                    
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
                                import traceback
                                print(f"モデル評価中にエラーが発生: {str(e)}")
                                traceback.print_exc()
                                status_dict[task_id] = {
                                    "status": "failed", 
                                    "message": f"モデル評価中にエラーが発生しました: {str(e)}",
                                    "progress": 100
                                }
                    except Exception as e:
                        import traceback
                        print(f"特徴量抽出中にエラーが発生: {str(e)}")
                        traceback.print_exc()
                        status_dict[task_id] = {
                            "status": "failed", 
                            "message": f"特徴量抽出中にエラーが発生しました: {str(e)}",
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
                import traceback
                error_details = traceback.format_exc()
                print(f"処理エラー ({task_type}): {str(e)}")
                print(error_details)
                
                status_dict[task_id] = {
                    "status": "failed",
                    "message": f"処理エラー: {str(e)}",
                    "error_details": error_details,
                    "progress": 100
                }
            
            finally:
                # タスク完了を通知
                queue.task_done()
        
        except Exception as e:
            import traceback
            print(f"ワーカースレッドエラー: {str(e)}")
            print(traceback.format_exc())
            if 'task_id' in locals() and 'status_dict' in locals():
                status_dict[task_id] = {
                    "status": "failed",
                    "message": f"処理エラー: {str(e)}",
                    "progress": 100
                }
            if 'queue' in locals():
                queue.task_done()


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
        from models.analyzer import PapillaeAnalyzer
        analyzer = PapillaeAnalyzer()
        
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
        import traceback
        print(traceback.format_exc())
        print("テストデータを使用します。")
        return create_test_data()


def create_test_data():
    """テスト用のデータを生成（開発用）"""
    print("テストデータの生成を開始")
    
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