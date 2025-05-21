from models.analyzer import UrchinPapillaeAnalyzer
import os
import numpy as np
import joblib
from utils.model_evaluation import evaluate_model, analyze_annotation_impact
from sklearn.preprocessing import StandardScaler

def process_dataset_for_evaluation(dataset_dir):
    """
    評価用にデータセットを処理して特徴量とラベルを抽出
    
    Parameters:
    - dataset_dir: データセットディレクトリ
    
    Returns:
    - X: 特徴量データ
    - y: ラベルデータ
    """
    analyzer = UrchinPapillaeAnalyzer()
    X = []
    y = []
    
    # オス画像の処理
    male_dir = os.path.join(dataset_dir, "male")
    if os.path.exists(male_dir):
        male_images = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        for img_file in male_images:
            try:
                img_path = os.path.join(male_dir, img_file)
                result = analyzer.classify_image(img_path, extract_only=True)
                
                if "features" in result and result["features"] is not None:
                    X.append(result["features"])
                    y.append(0)  # オス
            except Exception as e:
                print(f"オス画像処理エラー: {img_file} - {str(e)}")
    
    # メス画像の処理
    female_dir = os.path.join(dataset_dir, "female")
    if os.path.exists(female_dir):
        female_images = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        for img_file in female_images:
            try:
                img_path = os.path.join(female_dir, img_file)
                result = analyzer.classify_image(img_path, extract_only=True)
                
                if "features" in result and result["features"] is not None:
                    X.append(result["features"])
                    y.append(1)  # メス
            except Exception as e:
                print(f"メス画像処理エラー: {img_file} - {str(e)}")
    
    if X and y:
        X = np.array(X)
        y = np.array(y)
        return X, y
    else:
        return None, None

def processing_worker(processing_queue, processing_status, app_config):
    while True:
        try:
            task = processing_queue.get()
            if task is None:
                break
                
            task_type = task["type"]
            task_id = task["id"]
            
            analyzer = UrchinPapillaeAnalyzer()
            
            if task_type == "process_video":
                analyzer.process_video(
                    task["video_path"],
                    app_config['EXTRACTED_FOLDER'],
                    task_id,
                    task.get("max_images", 10)
                )
            elif task_type == "train_model":
                analyzer.train_model(
                    task["dataset_dir"],
                    task_id
                )
            elif task_type == "evaluate_model":
                # 処理状態の更新
                processing_status[task_id] = {
                    "status": "processing", 
                    "progress": 10,
                    "message": "データセットから特徴量を抽出中..."
                }
                
                # データセットからの特徴量抽出
                X, y = process_dataset_for_evaluation(task["dataset_dir"])
                
                if X is None or y is None or len(X) == 0:
                    processing_status[task_id] = {
                        "status": "error", 
                        "message": "評価用の特徴量を抽出できませんでした。データセットを確認してください。"
                    }
                else:
                    # 処理状態の更新
                    processing_status[task_id] = {
                        "status": "processing", 
                        "progress": 50,
                        "message": f"モデル評価を実行中... ({len(X)}サンプル)"
                    }
                    
                    # モデルのロード
                    try:
                        model_path = task["model_path"]
                        model, scaler = joblib.load(model_path)
                        
                        # 特徴量のスケーリング
                        X_scaled = scaler.transform(X)
                        
                        # モデル評価の実行
                        eval_dir = os.path.join(app_config.get('STATIC_FOLDER', 'static'), 'evaluation')
                        eval_results = evaluate_model(X_scaled, y, model, output_dir=eval_dir)
                        
                        # アノテーション影響分析
                        analyze_annotation_impact(task["dataset_dir"], model_path, output_dir=eval_dir)
                        
                        # 処理状態の更新
                        processing_status[task_id] = {
                            "status": "completed", 
                            "message": "モデル評価が完了しました。",
                            "results": eval_results
                        }
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        processing_status[task_id] = {
                            "status": "error", 
                            "message": f"モデル評価中にエラーが発生しました: {str(e)}"
                        }
            
            processing_queue.task_done()
            
        except Exception as e:
            print(f"処理ワーカーエラー: {str(e)}")
            if 'task_id' in locals():
                processing_status[task_id] = {"status": "error", "message": f"エラー: {str(e)}"}
            processing_queue.task_done()