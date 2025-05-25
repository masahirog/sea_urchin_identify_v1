"""
ウニ生殖乳頭分析システム - 統合分析エンジン
機械学習を用いた生殖乳頭検出機能を実装した改良版
"""

import cv2
import numpy as np
import os
import time
import uuid
import json
import joblib
import traceback
from datetime import datetime
from skimage.metrics import structural_similarity as ssim

# PapillaeDetector（YOLOv5ベース）のインポート
from .PapillaeDetector import PapillaeDetector

class UnifiedAnalyzer:
    """統合ウニ生殖乳頭分析エンジン"""
    
    def __init__(self):
        # パラメータ設定
        self.similarity_threshold = 0.85
        self.frame_interval = 15
        self.min_frames_between_captures = 30
        self.focus_measure_threshold = 100.0
        self.last_capture_frame = -self.min_frames_between_captures

        # モデル関連
        self.rf_model = None
        self.scaler = None
        self.load_models()
        
        # YOLOv5ベースの生殖乳頭検出器を初期化
        try:
            self.papillae_detector = PapillaeDetector(conf_threshold=0.4)
            print("YOLOv5ベースの生殖乳頭検出器を初期化しました")
        except Exception as e:
            print(f"生殖乳頭検出器の初期化エラー: {e}")
            self.papillae_detector = None
            # エラーでも処理を継続しない（YOLO必須）
            raise Exception("YOLOv5検出器の初期化に失敗しました。処理を中止します。")

    # ================================
    # メイン機能: 雌雄判定
    # ================================
    
    def classify_image(self, image_path, extract_only=False):
        """
        画像から雌雄を判定する
        
        Args:
            image_path: 分析する画像のパス
            extract_only: Trueの場合、特徴量の抽出のみを行う
            
        Returns:
            dict: 分類結果 {"gender": str, "confidence": float, "features": list}
        """
        try:
            print(f"画像分析開始: {image_path}")
            
            # 画像読み込み
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"画像の読み込みに失敗: {image_path}")
            
            # 特徴量抽出
            features = self._extract_features_from_image(img)
            if features is None:
                return {"error": "特徴量の抽出に失敗しました"}
            
            # 特徴量のみ返す場合
            if extract_only:
                return {"features": features}
            
            # モデル確認
            if self.rf_model is None:
                return {"error": "分類モデルが読み込めませんでした"}
            
            # 予測実行
            features_scaled = self.scaler.transform([features])
            prediction = self.rf_model.predict(features_scaled)[0]
            probabilities = self.rf_model.predict_proba(features_scaled)[0]
            
            # 結果作成
            gender = "male" if prediction == 0 else "female"
            confidence = probabilities[0] if prediction == 0 else probabilities[1]
            
            return {
                "gender": gender,
                "confidence": float(confidence),
                "features": features
            }
            
        except Exception as e:
            print(f"分類エラー: {str(e)}")
            traceback.print_exc()
            return {"error": f"分類処理中にエラー: {str(e)}"}

    # ================================
    # メイン機能: 動画処理
    # ================================
    
    def process_video(self, video_path, output_dir, task_id, max_images=10):
        """
        動画から生殖乳頭画像を抽出
        
        Args:
            video_path: 入力動画のパス
            output_dir: 出力ディレクトリ
            task_id: 処理タスクID
            max_images: 抽出する最大画像数
            
        Returns:
            list: 抽出された画像パスのリスト
        """
        # グローバル状態管理の取得
        try:
            from app import processing_status, processing_results
            global_status = True
            print(f"グローバル状態管理取得成功: {task_id}")
        except ImportError:
            global_status = False
            print(f"グローバル状態管理取得失敗: {task_id}")
        
        # 出力ディレクトリ作成
        task_output_dir = os.path.join(output_dir, task_id)
        os.makedirs(task_output_dir, exist_ok=True)
        print(f"出力ディレクトリ作成: {task_output_dir}")
        
        # 状態初期化
        if global_status:
            processing_status[task_id] = {
                "status": "running", 
                "progress": 20,  # 開始進捗を20%に変更
                "message": "動画解析を開始しました"
            }
            print(f"状態更新: 動画解析開始 - 進捗20%")
        
        # 動画キャプチャ
        print(f"動画ファイルを開く: {video_path}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            error_msg = f"動画を開けませんでした: {video_path}"
            print(error_msg)
            if global_status:
                processing_status[task_id] = {
                    "status": "error", 
                    "message": error_msg,
                    "progress": 100
                }
            return []

        # 動画情報取得
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        print(f"動画情報: {frame_count}フレーム, {fps}FPS, 長さ: {duration:.2f}秒")
        
        # 状態更新
        if global_status:
            processing_status[task_id] = {
                "status": "running", 
                "progress": 30,
                "message": f"動画解析中: {frame_count}フレーム, {duration:.2f}秒"
            }
            print(f"状態更新: 動画情報取得完了 - 進捗30%")
        
        # 抽出処理
        extracted_images = []
        previous_frames = []
        frame_idx = 0
        start_time = time.time()
        
        # デバッグ用にフレーム処理の間隔を出力
        last_debug_time = time.time()
        last_progress_update = time.time()
        
        while cap.isOpened() and len(extracted_images) < max_images:
            ret, frame = cap.read()
            if not ret:
                print(f"動画の読み込みが終了または失敗: frame_idx={frame_idx}")
                break
                
            # 定期的なデバッグ出力
            current_time = time.time()
            if current_time - last_debug_time > 5.0:  # 5秒ごとにデバッグ出力
                print(f"フレーム処理中: {frame_idx}/{frame_count} (経過時間: {current_time - start_time:.1f}秒)")
                last_debug_time = current_time
                
            # 進捗更新 - より頻繁に更新
            progress = min(30 + (frame_idx / max(frame_count, 1)) * 60, 90)  # 30%～90%の範囲で進捗
            if global_status and (current_time - last_progress_update > 2.0 or frame_idx % 30 == 0):  # 2秒ごとに更新
                elapsed = current_time - start_time
                remaining = (frame_count - frame_idx) / max(frame_idx / elapsed, 0.001) if frame_idx > 0 else 0
                processing_status[task_id] = {
                    "status": "running",
                    "progress": int(progress),
                    "message": f"解析中: {frame_idx}/{frame_count} (残り{remaining:.1f}秒)"
                }
                last_progress_update = current_time
                
            # フレーム間隔チェック
            if frame_idx % self.frame_interval == 0:
                # 生殖乳頭検出 - YOLOv5ベースの検出器を使用
                papillae_contours, processed_frame = self._detect_papillae_improved(frame)
                
                if len(papillae_contours) > 0:
                    # ピント・類似度チェック
                    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
                    focus_measure = self._variance_of_laplacian(gray_frame)
                    frames_since_last = frame_idx - self.last_capture_frame
                    
                    if (focus_measure > self.focus_measure_threshold and
                        frames_since_last >= self.min_frames_between_captures and
                        not self._is_similar_to_previous(frame, previous_frames)):
                        
                        # 画像保存
                        saved_path = self._save_detected_frame(
                            frame, papillae_contours, task_output_dir, frame_idx, focus_measure
                        )
                        
                        if saved_path:
                            extracted_images.append(saved_path)
                            previous_frames.append(frame.copy())
                            self.last_capture_frame = frame_idx
                            print(f"画像保存: {len(extracted_images)}/{max_images}")
                            
                            # 画像保存時の進捗更新（30%～90%を画像枚数に応じて分割）
                            if global_status:
                                img_progress = 30 + (len(extracted_images) / max(max_images, 1)) * 60
                                processing_status[task_id] = {
                                    "status": "running",
                                    "progress": int(img_progress),
                                    "message": f"画像抽出中: {len(extracted_images)}/{max_images}枚"
                                }
            
            frame_idx += 1
        
        cap.release()
        print(f"動画処理完了: 全{frame_idx}フレーム中{len(extracted_images)}枚の画像を抽出")
        
        # 結果保存
        if global_status:
            processing_results[task_id] = extracted_images
            processing_status[task_id] = {
                "status": "completed",
                "message": f"抽出完了: {len(extracted_images)}枚",
                "image_count": len(extracted_images),
                "progress": 100  # 重要: 100%に設定
            }
            print(f"状態更新: 処理完了 - 進捗100%")
        
        return extracted_images

    # ================================
    # メイン機能: モデル学習
    # ================================
    
    def train_model(self, dataset_dir, task_id):
        """
        データセットからモデルを学習
        
        Args:
            dataset_dir: データセットディレクトリ（互換性のため残すが使用しない）
            task_id: 学習タスクID
            
        Returns:
            bool: 学習成功の可否
        """
        # グローバル状態管理
        try:
            from app import processing_status
            global_status = True
        except ImportError:
            global_status = False
        
        if global_status:
            processing_status[task_id] = {
                "status": "processing", 
                "progress": 0, 
                "message": "モデル学習を開始"
            }
        
        try:
            # 統一された設定から学習データパスを取得
            from config import TRAINING_DATA_MALE, TRAINING_DATA_FEMALE
            
            # データセット検証
            if not os.path.exists(TRAINING_DATA_MALE) or not os.path.exists(TRAINING_DATA_FEMALE):
                raise Exception(f"学習データディレクトリが見つかりません")
            
            male_images = [f for f in os.listdir(TRAINING_DATA_MALE) 
                          if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            female_images = [f for f in os.listdir(TRAINING_DATA_FEMALE) 
                            if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            
            if len(male_images) == 0 and len(female_images) == 0:
                raise Exception("学習データが見つかりません")
            
            # より緩い条件
            if len(male_images) == 0 or len(female_images) == 0:
                print(f"警告: 片方の性別のデータがありません。オス:{len(male_images)}枚, メス:{len(female_images)}枚")
                # 警告は出すが続行
            
            print(f"学習データ: オス{len(male_images)}枚, メス{len(female_images)}枚")
            
            # アノテーション情報読み込み
            annotation_mapping = self._load_annotation_mapping()
            
            # 特徴量抽出（統一されたパスを使用）
            X, y = self._extract_dataset_features(
                TRAINING_DATA_MALE, TRAINING_DATA_FEMALE, 
                male_images, female_images, 
                annotation_mapping, task_id
            )
            
            if len(X) == 0:
                raise Exception("特徴量が抽出できませんでした")
            
            # 最小データ数チェック
            if len(X) < 2:
                raise Exception(f"学習には最低2つのサンプルが必要です。現在: {len(X)}個")
            
            # クラス数チェック
            unique_classes = len(set(y))
            if unique_classes < 2:
                raise Exception(f"学習には最低2つのクラスが必要です。現在: {unique_classes}クラス")
            
            # モデル学習
            accuracy = self._train_classification_model(X, y, task_id)
            
            if global_status:
                processing_status[task_id] = {
                    "status": "completed",
                    "message": f"学習完了 (精度: {accuracy:.2f})",
                    "accuracy": float(accuracy),
                    "male_images": len(male_images),
                    "female_images": len(female_images)
                }
            
            return True
            
        except Exception as e:
            error_msg = f"学習エラー: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            
            if global_status:
                processing_status[task_id] = {
                    "status": "error",
                    "message": error_msg
                }
            
            return False

    # ================================
    # 内部メソッド: 特徴量抽出
    # ================================
    
    def _extract_features_from_image(self, image):
        """画像から特徴量を抽出"""
        try:
            # YOLOv5検出器を使用して生殖乳頭を検出
            if self.papillae_detector is not None:
                try:
                    # 検出実行
                    detections, _ = self.papillae_detector.detect_papillae(image)
                    
                    # 特徴量抽出
                    if detections:
                        features = self.papillae_detector.extract_papillae_features(image, detections)
                        if features and len(features) > 0:
                            # 特徴量の平均を取る（複数の生殖乳頭が検出された場合）
                            return np.mean(features, axis=0).tolist()
                except Exception as e:
                    print(f"YOLOv5検出エラー: {str(e)}")
                    # エラー時は従来の手法にフォールバック
            
            # 従来の特徴量抽出手法（フォールバック）
            # グレースケール変換
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            
            # 二値化
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # 輪郭検出
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return None
            
            # 最大輪郭から特徴量計算
            largest_contour = max(contours, key=cv2.contourArea)
            
            # 基本特徴量
            area = cv2.contourArea(largest_contour)
            perimeter = cv2.arcLength(largest_contour, True)
            circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
            
            # 凸包特徴量
            hull = cv2.convexHull(largest_contour)
            hull_area = cv2.contourArea(hull)
            solidity = area / hull_area if hull_area > 0 else 0
            
            # 境界矩形特徴量
            x, y, w, h = cv2.boundingRect(largest_contour)
            aspect_ratio = w / h if h > 0 else 0
            
            return [area, perimeter, circularity, solidity, aspect_ratio]
            
        except Exception as e:
            print(f"特徴量抽出エラー: {str(e)}")
            return None

    # ================================
    # 内部メソッド: 画像処理
    # ================================
    
    def _detect_papillae_improved(self, frame, min_area=500, max_area=5000, circularity_threshold=0.3):
        """
        改良された生殖乳頭検出（YOLOv5ベース専用）
        """
        # YOLOv5検出器を使用
        if self.papillae_detector is not None:
            try:
                # 検出実行
                detections, processed_frame = self.papillae_detector.detect_papillae(frame)
                
                # 検出結果から輪郭情報を生成
                papillae_contours = []
                for det in detections:
                    bbox = det['bbox']
                    x1, y1, x2, y2 = bbox
                    
                    # 矩形から輪郭を作成
                    contour = np.array([
                        [[x1, y1]],
                        [[x2, y1]],
                        [[x2, y2]],
                        [[x1, y2]]
                    ], dtype=np.int32)
                    
                    papillae_contours.append(contour)
                
                return papillae_contours, processed_frame
                
            except Exception as e:
                print(f"YOLOv5検出エラー: {str(e)}")
                # エラー時は空の結果を返す
                return [], frame
        else:
            print("警告: YOLOv5検出器が初期化されていません")
            return [], frame

    def _variance_of_laplacian(self, image):
        """ピント測定（ラプラシアン分散）"""
        return cv2.Laplacian(image, cv2.CV_64F).var()

    def _is_similar_to_previous(self, current_frame, previous_frames):
        """フレーム類似度判定"""
        if not previous_frames:
            return False
        
        current_small = cv2.resize(current_frame, (160, 120))
        current_gray = cv2.cvtColor(current_small, cv2.COLOR_BGR2GRAY) if len(current_small.shape) == 3 else current_small
        
        for prev_frame in previous_frames:
            prev_small = cv2.resize(prev_frame, (160, 120))
            prev_gray = cv2.cvtColor(prev_small, cv2.COLOR_BGR2GRAY) if len(prev_small.shape) == 3 else prev_small
            
            score, _ = ssim(current_gray, prev_gray, full=True)
            if score > self.similarity_threshold:
                return True
        
        return False

    def _save_detected_frame(self, frame, contours, output_dir, frame_idx, focus_measure):
        """検出フレームの保存"""
        try:
            # 検出結果描画
            overlay = frame.copy()
            cv2.drawContours(overlay, contours, -1, (0, 255, 0), 2)
            
            # 情報描画
            cv2.putText(overlay, f"Focus: {focus_measure:.2f}", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(overlay, f"Papillae: {len(contours)}", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # 半透明合成
            alpha = 0.4
            marked_frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)
            
            # ファイル保存
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"papillae_{timestamp}_frame{frame_idx}.jpg"
            output_path = os.path.join(output_dir, filename)
            
            cv2.imwrite(output_path, marked_frame)
            return output_path
            
        except Exception as e:
            print(f"フレーム保存エラー: {str(e)}")
            return None

    # ================================
    # 内部メソッド: モデル関連
    # ================================
    
    def load_models(self):
        """保存されたモデルの読み込み"""
        from config import MODELS_DIR
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        
        if os.path.exists(model_path):
            try:
                self.rf_model, self.scaler = joblib.load(model_path)
                print("モデル読み込み成功")
                return True
            except Exception as e:
                print(f"モデル読み込みエラー: {str(e)}")
        return False

    def _load_annotation_mapping(self):
        """アノテーションマッピング読み込み"""
        annotation_file = os.path.join('static', 'annotation_mapping.json')
        if os.path.exists(annotation_file):
            try:
                with open(annotation_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"アノテーション読み込みエラー: {str(e)}")
        return {}

    def _extract_dataset_features(self, male_dir, female_dir, male_images, female_images, annotation_mapping, task_id):
        """データセットから特徴量を抽出"""
        X, y = [], []
        
        # グローバル状態取得
        try:
            from app import processing_status
            global_status = True
        except ImportError:
            global_status = False
        
        # オス画像処理
        for i, img_file in enumerate(male_images):
            if global_status:
                progress = 20 + (i / len(male_images)) * 30
                processing_status[task_id] = {
                    "status": "processing",
                    "progress": progress,
                    "message": f"オス画像処理中: {i+1}/{len(male_images)}"
                }
            
            img_path = os.path.join(male_dir, img_file)
            features = self._extract_features_from_image(cv2.imread(img_path))
            if features:
                X.append(features)
                y.append(0)  # オス = 0
        
        # メス画像処理  
        for i, img_file in enumerate(female_images):
            if global_status:
                progress = 50 + (i / len(female_images)) * 30
                processing_status[task_id] = {
                    "status": "processing",
                    "progress": progress,
                    "message": f"メス画像処理中: {i+1}/{len(female_images)}"
                }
            
            img_path = os.path.join(female_dir, img_file)
            features = self._extract_features_from_image(cv2.imread(img_path))
            if features:
                X.append(features)
                y.append(1)  # メス = 1
        
        return np.array(X), np.array(y)

    def _train_classification_model(self, X, y, task_id):
        """分類モデルの学習"""
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score
        
        # グローバル状態取得
        try:
            from app import processing_status
            global_status = True
        except ImportError:
            global_status = False
        
        if global_status:
            processing_status[task_id] = {
                "status": "processing",
                "progress": 80,
                "message": "モデル学習中..."
            }
        
        # データ分割
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # スケーリング
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # モデル学習
        self.rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.rf_model.fit(X_train_scaled, y_train)
        
        # 評価
        y_pred = self.rf_model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        # モデル保存
        from config import MODELS_DIR
        os.makedirs(os.path.join(MODELS_DIR, 'saved'), exist_ok=True)
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        joblib.dump((self.rf_model, self.scaler), model_path)
        
        print(f"モデル学習完了 - 精度: {accuracy:.2f}")
        return accuracy


# 後方互換性のためのエイリアス
UrchinPapillaeAnalyzer = UnifiedAnalyzer
PapillaeAnalyzer = UnifiedAnalyzer