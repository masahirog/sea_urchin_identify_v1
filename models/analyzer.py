import cv2
import numpy as np
import os
import time
import uuid
from datetime import datetime
from skimage.metrics import structural_similarity as ssim
import base64
import joblib

# ユーティリティ関数のインポート
from utils.image_processing import variance_of_laplacian, detect_papillae, is_similar_to_previous, extract_features
from utils.image_processing import enhance_sea_urchin_image, detect_papillae_improved


class UrchinPapillaeAnalyzer:
    def __init__(self):
        # パラメータ設定
        self.min_contour_area = 500  # 検出する輪郭の最小サイズ
        self.similarity_threshold = 0.85  # 画像の類似度のしきい値
        self.frame_interval = 15  # フレーム間隔（どれくらい離れたフレームを抽出するか）
        self.min_frames_between_captures = 30  # 連続キャプチャ間の最小フレーム数
        self.focus_measure_threshold = 100.0  # ピント判定のしきい値
        self.last_capture_frame = -self.min_frames_between_captures  # 最後にキャプチャしたフレーム
        self.rf_model = None
        self.scaler = None
        
        # モデルの読み込み
        self.load_models()

    def load_models(self):
        """保存されたモデルを読み込む"""
        model_path = os.path.join('models/saved', "sea_urchin_rf_model.pkl")
        if os.path.exists(model_path):
            try:
                self.rf_model, self.scaler = joblib.load(model_path)
                print("モデルを読み込みました")
                return True
            except Exception as e:
                print(f"モデル読み込みエラー: {str(e)}")
        return False

    def process_video(self, video_path, output_dir, task_id, max_images=10):
        """
        ビデオを処理して生殖乳頭の画像を抽出
        
        Parameters:
        - video_path: 入力ビデオのパス
        - output_dir: 出力画像を保存するディレクトリ
        - task_id: 処理タスクのID
        - max_images: 抽出する最大画像数
        """
        # グローバル変数
        try:
            from app import processing_status, processing_results
            global_status = True
        except ImportError:
            global_status = False
        
        # 出力ディレクトリの作成
        task_output_dir = os.path.join(output_dir, task_id)
        os.makedirs(task_output_dir, exist_ok=True)
        
        # 処理状態の更新
        if global_status:
            processing_status[task_id] = {"status": "processing", "progress": 0, "message": "処理を開始しました"}
        
        # ビデオのキャプチャ
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            if global_status:
                processing_status[task_id] = {"status": "error", "message": f"ビデオ '{video_path}' を開けませんでした"}
            print(f"エラー: ビデオ '{video_path}' を開けませんでした")
            return []

        # ビデオの情報を取得
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps
        print(f"ビデオ情報: {frame_count} フレーム, {fps} FPS, 長さ: {duration:.2f} 秒")
        
        # 処理用の変数
        extracted_images = []
        previous_frames = []
        frame_idx = 0
        
        # 処理開始
        start_time = time.time()
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # 進捗状況の更新
            progress = (frame_idx / max(frame_count, 1)) * 100  # 0除算を避ける
            elapsed_time = time.time() - start_time
            if elapsed_time > 0:
                frames_per_second = frame_idx / elapsed_time
                remaining_time = (frame_count - frame_idx) / max(frames_per_second, 0.001)  # 0除算を避ける
                if global_status:
                    processing_status[task_id] = {
                        "status": "processing", 
                        "progress": progress,
                        "message": f"進捗: {progress:.1f}%, フレーム: {frame_idx}/{frame_count}, 残り時間: {remaining_time:.1f}秒"
                    }
                print(f"進捗: {progress:.1f}%, フレーム: {frame_idx}/{frame_count}, 残り時間: {remaining_time:.1f}秒", end="\r")
            
            # 一定間隔でフレームを処理
            if frame_idx % self.frame_interval == 0:
                # 生殖乳頭の検出
                papillae_contours, processed_frame = detect_papillae_improved(
                    frame, 
                    min_area=self.min_contour_area, 
                    max_area=5000,  # 生殖乳頭の最大サイズを調整
                    circularity_threshold=0.3  # 円形度の閾値を調整
                )
                gray_frame = processed_frame  # 処理済みの画像を使用
                
                # 生殖乳頭が検出された場合
                if len(papillae_contours) > 0:
                    # ピント判定
                    focus_measure = variance_of_laplacian(gray_frame)
                    
                    # 前回のキャプチャから十分なフレーム数が経過しているか確認
                    frames_since_last_capture = frame_idx - self.last_capture_frame
                    
                    # 条件を満たせば画像を保存
                    if (focus_measure > self.focus_measure_threshold and
                            frames_since_last_capture >= self.min_frames_between_captures and
                            not is_similar_to_previous(frame, previous_frames, self.similarity_threshold) and
                            len(extracted_images) < max_images):
                        
                        # 検出された乳頭を描画
                        overlay = frame.copy()
                        cv2.drawContours(overlay, papillae_contours, -1, (0, 255, 0), 2)
                        
                        # 半透明のオーバーレイを適用
                        alpha = 0.4
                        marked_frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)
                        
                        # 追加情報を描画
                        cv2.putText(marked_frame, f"Focus: {focus_measure:.2f}", (10, 30), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                        cv2.putText(marked_frame, f"Papillae: {len(papillae_contours)}", (10, 60), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                        
                        # ファイル名の生成
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"papillae_{timestamp}_frame{frame_idx}.jpg"
                        output_path = os.path.join(task_output_dir, filename)
                        
                        # 画像を保存
                        cv2.imwrite(output_path, marked_frame)
                        print(f"\n画像を保存しました: {output_path}")
                        
                        # 処理した画像を記録
                        extracted_images.append(output_path)
                        previous_frames.append(frame.copy())
                        self.last_capture_frame = frame_idx
                        
                        # 最大数に達したら終了
                        if len(extracted_images) >= max_images:
                            break
            
            frame_idx += 1
        
        # リソースの解放
        cap.release()
        
        # 処理結果の保存
        if global_status:
            processing_results[task_id] = extracted_images
            
            # 状態の更新
            if extracted_images:
                processing_status[task_id] = {
                    "status": "completed", 
                    "message": f"処理が完了しました。{len(extracted_images)}枚の画像を抽出しました。",
                    "image_count": len(extracted_images)
                }
            else:
                processing_status[task_id] = {
                    "status": "completed", 
                    "message": "生殖乳頭が検出されませんでした。パラメーターを調整して再試行してください。",
                    "image_count": 0
                }
        
        print(f"\n処理が完了しました。{len(extracted_images)}枚の画像を抽出しました。")
        return extracted_images

    def classify_image(self, image_path, extract_only=False):
        """
        画像を分類する
        
        Parameters:
        - image_path: 分類する画像ファイルのパス
        - extract_only: Trueの場合、特徴量の抽出のみを行う
        
        Returns:
        - result: 分類結果の辞書（クラスとその確率）
        """
        try:
            if extract_only:
                print(f"特徴量抽出のみモード: {image_path}")
            
            # 画像の読み込み
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"画像の読み込みに失敗しました: {image_path}")
            
            # 前処理（グレースケールに変換）
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # 画像の二値化
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # 輪郭検出
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                raise ValueError("輪郭が検出されませんでした。")
            
            # 最大の輪郭を取得
            largest_contour = max(contours, key=cv2.contourArea)
            
            # 特徴量の計算
            area = cv2.contourArea(largest_contour)
            perimeter = cv2.arcLength(largest_contour, True)
            
            # 円形度: 4π×(面積)/(周囲長)²
            circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
            
            # 凸包を計算
            hull = cv2.convexHull(largest_contour)
            hull_area = cv2.contourArea(hull)
            
            # 充実度: 面積/凸包の面積
            solidity = area / hull_area if hull_area > 0 else 0
            
            # 境界矩形を計算
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # アスペクト比: 幅/高さ
            aspect_ratio = w / h if h > 0 else 0
            
            # 特徴量ベクトルの作成
            features = [area, perimeter, circularity, solidity, aspect_ratio]
            
            if extract_only:
                print(f"抽出した特徴量: {features}")
                return {"features": features}
            
            # モデルが読み込まれていない場合はロード
            if self.rf_model is None:
                self.load_model()
            
            # 特徴量のスケーリング
            features_scaled = self.scaler.transform([features])
            
            # 予測の実行
            prediction = self.rf_model.predict(features_scaled)[0]
            probabilities = self.rf_model.predict_proba(features_scaled)[0]
            
            # クラスラベルの取得
            class_label = "male" if prediction == 0 else "female"
            class_proba = probabilities[0] if prediction == 0 else probabilities[1]
            
            return {
                "class": class_label,
                "probability": float(class_proba),
                "features": features
            }
            
        except Exception as e:
            print(f"分類エラー: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None


    def train_model(self, dataset_dir, task_id):
        """モデルを訓練"""
        # グローバル変数
        try:
            from app import processing_status
            global_status = True
        except ImportError:
            global_status = False
        
        # 処理状態の更新
        if global_status:
            processing_status[task_id] = {"status": "processing", "progress": 0, "message": "モデル訓練を開始しました"}
        
        try:
            # データセットの確認
            male_dir = os.path.join(dataset_dir, "male")
            female_dir = os.path.join(dataset_dir, "female")
            
            if not os.path.exists(male_dir) or not os.path.exists(female_dir):
                if global_status:
                    processing_status[task_id] = {"status": "error", "message": "データセットディレクトリが正しくありません"}
                print("エラー: データセットディレクトリが正しくありません")
                return False
            
            male_images = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            female_images = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            
            if len(male_images) == 0 or len(female_images) == 0:
                if global_status:
                    processing_status[task_id] = {"status": "error", "message": "オスまたはメスの画像が見つかりません"}
                print("エラー: オスまたはメスの画像が見つかりません")
                return False
            
            print(f"データセット: オス画像 {len(male_images)}枚, メス画像 {len(female_images)}枚")
            
            # 特徴量データセットの構築
            X = []
            y = []
            
            # オス画像の処理
            for i, img_file in enumerate(male_images):
                try:
                    progress = (i / len(male_images)) * 50
                    if global_status:
                        processing_status[task_id] = {
                            "status": "processing", 
                            "progress": progress,
                            "message": f"オス画像を処理中... {i+1}/{len(male_images)}"
                        }
                    print(f"オス画像を処理中... {i+1}/{len(male_images)}", end="\r")
                    
                    img_path = os.path.join(male_dir, img_file)
                    img = cv2.imread(img_path)
                    if img is None:
                        continue
                        
                    papillae_contours, gray = detect_papillae(img, self.min_contour_area)
                    
                    if papillae_contours:
                        features = extract_features(gray, papillae_contours)
                        if features is not None:
                            X.append(features)
                            y.append(0)  # 0:オス
                    
                except Exception as e:
                    print(f"\n画像処理中にエラー: {img_file} - {str(e)}")
            
            print()  # 改行
            
            # メス画像の処理
            for i, img_file in enumerate(female_images):
                try:
                    progress = 50 + (i / len(female_images)) * 50
                    if global_status:
                        processing_status[task_id] = {
                            "status": "processing", 
                            "progress": progress,
                            "message": f"メス画像を処理中... {i+1}/{len(female_images)}"
                        }
                    print(f"メス画像を処理中... {i+1}/{len(female_images)}", end="\r")
                    
                    img_path = os.path.join(female_dir, img_file)
                    img = cv2.imread(img_path)
                    if img is None:
                        continue
                        
                    papillae_contours, gray = detect_papillae(img, self.min_contour_area)
                    
                    if papillae_contours:
                        features = extract_features(gray, papillae_contours)
                        if features is not None:
                            X.append(features)
                            y.append(1)  # 1:メス
                    
                except Exception as e:
                    print(f"\n画像処理中にエラー: {img_file} - {str(e)}")
            
            print()  # 改行
            
            # モデルの訓練
            if len(X) > 0 and len(y) > 0:
                X = np.array(X)
                y = np.array(y)
                
                print(f"学習データ: {len(X)}サンプル")
                
                # データのシャッフルと分割
                from sklearn.model_selection import train_test_split
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                
                # 特徴量のスケーリング
                from sklearn.preprocessing import StandardScaler
                self.scaler = StandardScaler()
                X_train_scaled = self.scaler.fit_transform(X_train)
                X_test_scaled = self.scaler.transform(X_test)
                
                # ランダムフォレスト分類器
                from sklearn.ensemble import RandomForestClassifier
                self.rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
                self.rf_model.fit(X_train_scaled, y_train)
                
                # モデル評価
                from sklearn.metrics import accuracy_score, classification_report
                y_pred = self.rf_model.predict(X_test_scaled)
                accuracy = accuracy_score(y_test, y_pred)
                
                print(f"モデル精度: {accuracy:.2f}")
                print(classification_report(y_test, y_pred, target_names=["male", "female"]))
                
                # モデルの保存
                os.makedirs('models/saved', exist_ok=True)
                model_path = os.path.join('models/saved', "sea_urchin_rf_model.pkl")
                joblib.dump((self.rf_model, self.scaler), model_path)
                
                # 特徴量の重要度
                feature_names = ["Area", "Perimeter", "Circularity", "Solidity", "Aspect Ratio"]
                importance = dict(zip(feature_names, self.rf_model.feature_importances_))
                
                if global_status:
                    processing_status[task_id] = {
                        "status": "completed", 
                        "message": f"モデルの訓練が完了しました（精度: {accuracy:.2f}）",
                        "accuracy": float(accuracy),
                        "feature_importance": importance,
                        "male_images": len(male_images),
                        "female_images": len(female_images),
                        "train_samples": len(X_train)
                    }
                
                return True
            else:
                if global_status:
                    processing_status[task_id] = {
                        "status": "error", 
                        "message": "特徴量を抽出できませんでした。データセットを確認してください。"
                    }
                print("エラー: 特徴量を抽出できませんでした。データセットを確認してください。")
                return False
                
        except Exception as e:
            import traceback
            error_msg = f"モデル訓練中にエラーが発生しました: {str(e)}\n{traceback.format_exc()}"
            if global_status:
                processing_status[task_id] = {
                    "status": "error", 
                    "message": error_msg
                }
            print(f"エラー: {error_msg}")
            return False



    def visualize_detection(self, image, contours=None, title="検出結果"):
        """検出結果を視覚化する"""
        # 入力画像のコピー
        if len(image.shape) == 2:
            # グレースケール画像をRGBに変換
            vis_img = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        else:
            vis_img = image.copy()
        
        # 検出された輪郭を描画
        if contours is not None:
            cv2.drawContours(vis_img, contours, -1, (0, 255, 0), 2)
            
            # 各輪郭の中心に番号を描画
            for i, cnt in enumerate(contours):
                M = cv2.moments(cnt)
                if M["m00"] > 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    cv2.putText(vis_img, str(i+1), (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 
                               0.5, (255, 0, 0), 1, cv2.LINE_AA)
        
        # タイトルと検出された輪郭数を描画
        cv2.putText(vis_img, f"{title}: {len(contours) if contours else 0} 個", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2, cv2.LINE_AA)
        
        return vis_img

    def detect_papillae_improved(self, image, min_area=500, max_area=5000, circularity_threshold=0.3):
        """クラスメソッドとしてdetect_papillae_improvedを実装"""
        from utils.image_processing import detect_papillae_improved
        return detect_papillae_improved(image, min_area, max_area, circularity_threshold)







def train_model(self, dataset_dir, task_id):
        """モデルを訓練"""
        # グローバル変数
        try:
            from app import processing_status
            global_status = True
        except ImportError:
            global_status = False
        
        # 処理状態の更新
        if global_status:
            processing_status[task_id] = {"status": "processing", "progress": 0, "message": "モデル訓練を開始しました"}
        
        try:
            # データセットの確認
            male_dir = os.path.join(dataset_dir, "male")
            female_dir = os.path.join(dataset_dir, "female")
            
            if not os.path.exists(male_dir) or not os.path.exists(female_dir):
                if global_status:
                    processing_status[task_id] = {"status": "error", "message": "データセットディレクトリが正しくありません"}
                print("エラー: データセットディレクトリが正しくありません")
                return False
            
            male_images = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            female_images = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            
            if len(male_images) == 0 or len(female_images) == 0:
                if global_status:
                    processing_status[task_id] = {"status": "error", "message": "オスまたはメスの画像が見つかりません"}
                print("エラー: オスまたはメスの画像が見つかりません")
                return False
            
            print(f"データセット: オス画像 {len(male_images)}枚, メス画像 {len(female_images)}枚")
            
            # アノテーションマッピングの読み込み
            annotation_mapping = {}
            annotation_file = os.path.join('static', 'annotation_mapping.json')
            if os.path.exists(annotation_file):
                try:
                    with open(annotation_file, 'r') as f:
                        annotation_mapping = json.load(f)
                    print(f"アノテーションマッピングを読み込みました: {len(annotation_mapping)}件")
                except Exception as e:
                    print(f"アノテーションマッピング読み込みエラー: {str(e)}")
            
            # 特徴量データセットの構築
            X = []
            y = []
            
            # アノテーション使用状況の追跡
            male_annotated = 0
            male_unannotated = 0
            female_annotated = 0
            female_unannotated = 0
            
            # オス画像の処理
            for i, img_file in enumerate(male_images):
                try:
                    progress = (i / len(male_images)) * 50
                    if global_status:
                        processing_status[task_id] = {
                            "status": "processing", 
                            "progress": progress,
                            "message": f"オス画像を処理中... {i+1}/{len(male_images)}"
                        }
                    print(f"オス画像を処理中... {i+1}/{len(male_images)}", end="\r")
                    
                    img_path = os.path.join(male_dir, img_file)
                    
                    # アノテーションの確認
                    annotation_path = None
                    rel_path = f"papillae/male/{img_file}"
                    if rel_path in annotation_mapping:
                        annotation_path = os.path.join('static', annotation_mapping[rel_path])
                        if os.path.exists(annotation_path):
                            # アノテーションから特徴量抽出を試みる
                            try:
                                from utils.image_analysis import analyze_shape_features
                                shape_features = analyze_shape_features(annotation_path, {})
                                if shape_features and len(shape_features) > 0:
                                    # アノテーションベースの特徴量
                                    features = [
                                        shape_features.get('area', 0),
                                        shape_features.get('perimeter', 0),
                                        shape_features.get('circularity', 0),
                                        0.8,  # デフォルトのsolidity
                                        1.0   # デフォルトのアスペクト比
                                    ]
                                    X.append(features)
                                    y.append(0)  # 0:オス
                                    male_annotated += 1
                                    continue
                            except Exception as e:
                                print(f"\nアノテーション処理エラー: {img_file} - {str(e)}")
                    
                    # 通常の画像処理（アノテーションがないか、アノテーション処理に失敗した場合）
                    img = cv2.imread(img_path)
                    if img is None:
                        continue
                        
                    papillae_contours, gray = detect_papillae_improved(
                        img, 
                        min_area=self.min_contour_area,
                        max_area=5000,
                        circularity_threshold=0.3
                    )
                    
                    if papillae_contours:
                        features = extract_features(gray, papillae_contours)
                        if features is not None:
                            X.append(features)
                            y.append(0)  # 0:オス
                            male_unannotated += 1
                    
                except Exception as e:
                    print(f"\n画像処理中にエラー: {img_file} - {str(e)}")
            
            print()  # 改行
            
            # メス画像の処理
            for i, img_file in enumerate(female_images):
                try:
                    progress = 50 + (i / len(female_images)) * 50
                    if global_status:
                        processing_status[task_id] = {
                            "status": "processing", 
                            "progress": progress,
                            "message": f"メス画像を処理中... {i+1}/{len(female_images)}"
                        }
                    print(f"メス画像を処理中... {i+1}/{len(female_images)}", end="\r")
                    
                    img_path = os.path.join(female_dir, img_file)
                    
                    # アノテーションの確認
                    annotation_path = None
                    rel_path = f"papillae/female/{img_file}"
                    if rel_path in annotation_mapping:
                        annotation_path = os.path.join('static', annotation_mapping[rel_path])
                        if os.path.exists(annotation_path):
                            # アノテーションから特徴量抽出を試みる
                            try:
                                from utils.image_analysis import analyze_shape_features
                                shape_features = analyze_shape_features(annotation_path, {})
                                if shape_features and len(shape_features) > 0:
                                    # アノテーションベースの特徴量
                                    features = [
                                        shape_features.get('area', 0),
                                        shape_features.get('perimeter', 0),
                                        shape_features.get('circularity', 0),
                                        0.8,  # デフォルトのsolidity
                                        1.0   # デフォルトのアスペクト比
                                    ]
                                    X.append(features)
                                    y.append(1)  # 1:メス
                                    female_annotated += 1
                                    continue
                            except Exception as e:
                                print(f"\nアノテーション処理エラー: {img_file} - {str(e)}")
                    
                    # 通常の画像処理（アノテーションがないか、アノテーション処理に失敗した場合）
                    img = cv2.imread(img_path)
                    if img is None:
                        continue
                        
                    papillae_contours, gray = detect_papillae_improved(
                        img, 
                        min_area=self.min_contour_area,
                        max_area=5000,
                        circularity_threshold=0.3
                    )
                    
                    if papillae_contours:
                        features = extract_features(gray, papillae_contours)
                        if features is not None:
                            X.append(features)
                            y.append(1)  # 1:メス
                            female_unannotated += 1
                    
                except Exception as e:
                    print(f"\n画像処理中にエラー: {img_file} - {str(e)}")
            
            print()  # 改行
            
            # モデルの訓練
            if len(X) > 0 and len(y) > 0:
                X = np.array(X)
                y = np.array(y)
                
                print(f"学習データ: {len(X)}サンプル")
                print(f"アノテーション使用: オス {male_annotated}枚, メス {female_annotated}枚")
                print(f"自動検出使用: オス {male_unannotated}枚, メス {female_unannotated}枚")
                
                # データのシャッフルと分割
                from sklearn.model_selection import train_test_split
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                
                # 特徴量のスケーリング
                from sklearn.preprocessing import StandardScaler
                self.scaler = StandardScaler()
                X_train_scaled = self.scaler.fit_transform(X_train)
                X_test_scaled = self.scaler.transform(X_test)
                
                # ランダムフォレスト分類器
                from sklearn.ensemble import RandomForestClassifier
                self.rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
                self.rf_model.fit(X_train_scaled, y_train)
                
                # モデル評価
                from sklearn.metrics import accuracy_score, classification_report
                y_pred = self.rf_model.predict(X_test_scaled)
                accuracy = accuracy_score(y_test, y_pred)
                
                print(f"モデル精度: {accuracy:.2f}")
                class_report = classification_report(y_test, y_pred, target_names=["male", "female"])
                print(class_report)
                
                # モデルの保存
                os.makedirs('models/saved', exist_ok=True)
                model_path = os.path.join('models/saved', "sea_urchin_rf_model.pkl")
                joblib.dump((self.rf_model, self.scaler), model_path)
                
                # 特徴量の重要度
                feature_names = ["Area", "Perimeter", "Circularity", "Solidity", "Aspect Ratio"]
                importance = dict(zip(feature_names, self.rf_model.feature_importances_))
                
                # アノテーション効果の分析
                annotation_effect = None
                if male_annotated + female_annotated > 0:
                    annotation_effect = {
                        "used_count": male_annotated + female_annotated,
                        "total_count": len(X),
                        "ratio": (male_annotated + female_annotated) / len(X),
                        "distribution": {
                            "male_annotated": male_annotated,
                            "male_unannotated": male_unannotated,
                            "female_annotated": female_annotated,
                            "female_unannotated": female_unannotated
                        }
                    }
                
                if global_status:
                    processing_status[task_id] = {
                        "status": "completed", 
                        "message": f"モデルの訓練が完了しました（精度: {accuracy:.2f}）",
                        "accuracy": float(accuracy),
                        "feature_importance": importance,
                        "male_images": len(male_images),
                        "female_images": len(female_images),
                        "train_samples": len(X_train),
                        "annotation_effect": annotation_effect
                    }
                
                return True
            else:
                if global_status:
                    processing_status[task_id] = {
                        "status": "error", 
                        "message": "特徴量を抽出できませんでした。データセットを確認してください。"
                    }
                print("エラー: 特徴量を抽出できませんでした。データセットを確認してください。")
                return False
                
        except Exception as e:
            import traceback
            error_msg = f"モデル訓練中にエラーが発生しました: {str(e)}\n{traceback.format_exc()}"
            if global_status:
                processing_status[task_id] = {
                    "status": "error", 
                    "message": error_msg
                }
            print(f"エラー: {error_msg}")
            return False