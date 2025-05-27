"""
ウニ生殖乳頭分析システム - 統合分析エンジン
機械学習を用いた生殖乳頭検出機能を実装した改良版
"""

import cv2
import numpy as np
import os
import uuid
import json
import joblib
import traceback
from datetime import datetime
from skimage.metrics import structural_similarity as ssim

# PapillaeDetector（YOLOv5ベース）のインポート
from .PapillaeDetector import PapillaeDetector
from .YoloDetector import YoloDetector

class UnifiedAnalyzer:
    """統合ウニ生殖乳頭分析エンジン"""
    
    def __init__(self):
        # パラメータ設定
        self.similarity_threshold = 0.85
        self.focus_measure_threshold = 100.0

        # モデル関連
        self.rf_model = None
        self.scaler = None
        self.model_loaded = self.load_models()  # 結果を保持
        
        # モデルがない場合の警告
        if not self.model_loaded:
            print("警告: RandomForestモデルが見つかりません。学習が必要です。")
        
        try:
            self.yolo_detector = YoloDetector(conf_threshold=0.4)
            print("YOLOv5ベースの生殖乳頭検出器を初期化しました")
            
            if self.yolo_detector.model is None:
                raise Exception("YOLOv5モデルのロードに失敗しました")
                
        except Exception as e:
            print(f"生殖乳頭検出器の初期化エラー: {e}")
            self.yolo_detector = None
            # YOLOは必須ではないが、警告を出す
            print("警告: YOLO検出器が利用できません。基本的な特徴抽出のみ使用します。")

    # ================================
    # メイン機能: 雌雄判定
    # ================================
    
    def classify_image():
        """
        画像をアップロードして雌雄判定を実行
        """
        from app import app
        from app_utils.file_handlers import allowed_file, is_image_file
        from core.analyzer import UnifiedAnalyzer
        from core.YoloDetector import YoloDetector
        
        if 'image' not in request.files:
            return jsonify({"error": "画像ファイルがありません"}), 400
            
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({"error": "ファイルが選択されていません"}), 400
        
        if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_image_file(file.filename):
            # 安全なファイル名に変換
            filename = secure_filename(file.filename)
            
            # 同名ファイルが既に存在する場合はユニークな名前に変更
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.exists(file_path):
                name, ext = os.path.splitext(filename)
                unique_suffix = uuid.uuid4().hex[:8]
                filename = f"{name}_{unique_suffix}{ext}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # ファイルを保存
            file.save(file_path)
            current_app.logger.info(f"画像をアップロード: {filename}")
            
            try:
                # 画像の判別
                analyzer = UnifiedAnalyzer()
                result = analyzer.classify_image(file_path)
                
                # デバッグログ
                current_app.logger.info(f"分析結果: {result}")
                
                # モデル未学習の場合の処理を修正
                if result.get("status") == "model_not_trained":
                    current_app.logger.info("モデル未学習を検出")
                    
                    # 画像へのURLを追加
                    result["image_url"] = url_for('main.get_uploaded_file', filename=filename, _external=True)
                    result["filename"] = filename
                    
                    # YOLOで検出画像を生成（可能な場合）
                    try:
                        detector = YoloDetector()
                        detection_result = detector.detect(file_path)
                        
                        if detection_result and "annotated_image" in detection_result:
                            # 検出結果画像を保存
                            marked_filename = f"marked_{filename}"
                            marked_path = os.path.join(app.config['UPLOAD_FOLDER'], marked_filename)
                            cv2.imwrite(marked_path, detection_result["annotated_image"])
                            
                            result["marked_image_url"] = url_for('main.get_uploaded_file', filename=marked_filename, _external=True)
                    except Exception as e:
                        current_app.logger.warning(f"YOLO検出エラー（継続）: {str(e)}")
                    
                    # 重要: errorフィールドを削除してstatusを保持
                    if "error" in result:
                        del result["error"]  # errorフィールドを削除
                    
                    # 200 OKで返す
                    return jsonify(result), 200
                
                # 通常のエラーの場合
                if "error" in result and "status" not in result:
                    current_app.logger.error(f"画像分析エラー: {result['error']}")
                    
                    # YOLOv5関連のエラーの場合、詳細なメッセージを返す
                    if "YOLO" in result["error"] or "検出器" in result["error"]:
                        return jsonify({
                            "error": "YOLOv5が利用できません。セットアップが必要です。",
                            "details": result["error"],
                            "solution": "python setup_yolo.py を実行してください"
                        }), 500
                    
                    return jsonify({"error": result["error"]}), 400
                
                # 正常な判定結果の場合
                # 画像へのURLを追加
                result["image_url"] = url_for('main.get_uploaded_file', filename=filename, _external=True)
                result["filename"] = filename
                
                # YOLOで検出画像を生成
                try:
                    detector = YoloDetector()
                    detection_result = detector.detect(file_path)

                    if detection_result and "annotated_image" in detection_result:
                        # 検出結果画像を保存
                        marked_filename = f"marked_{filename}"
                        marked_path = os.path.join(app.config['UPLOAD_FOLDER'], marked_filename)
                        cv2.imwrite(marked_path, detection_result["annotated_image"])
                        
                        result["marked_image_url"] = url_for('main.get_uploaded_file', filename=marked_filename, _external=True)
                        result["papillae_count"] = detection_result["count"]
                        result["papillae_details"] = detection_result.get("detections", [])
                except Exception as e:
                    current_app.logger.warning(f"YOLO検出エラー: {str(e)}")
                
                # 判定履歴に記録
                record_classification_history(filename, result)
                
                current_app.logger.info(f"雌雄判定完了: {filename} -> {result.get('gender', 'unknown')}")
                
                return jsonify(result)
            
            except Exception as e:
                current_app.logger.error(f"画像処理エラー: {str(e)}")
                traceback.print_exc()
                return jsonify({"error": f"画像処理中にエラーが発生しました: {str(e)}"}), 500
        
        return jsonify({"error": "無効なファイル形式です"}), 400

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
            processing_status = {}  # ダミー
        
        if global_status:
            processing_status[task_id] = {
                "status": "processing", 
                "progress": 0, 
                "message": "モデル学習を開始"
            }
        
        try:
            # 統一された設定から学習データパスを取得
            from config import TRAINING_IMAGES_DIR, METADATA_FILE
            
            # データセット検証
            if not os.path.exists(TRAINING_IMAGES_DIR):
                raise Exception(f"学習データディレクトリが見つかりません: {TRAINING_IMAGES_DIR}")
            
            # メタデータ読み込み
            metadata = {}
            if os.path.exists(METADATA_FILE):
                try:
                    with open(METADATA_FILE, 'r') as f:
                        metadata = json.load(f)
                except:
                    print("メタデータの読み込みに失敗しました")
            
            # 画像の分類
            male_images = []
            female_images = []
            
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    image_info = metadata.get(filename, {})
                    gender = image_info.get('gender', 'unknown')
                    
                    if gender == 'male':
                        male_images.append(filename)
                    elif gender == 'female':
                        female_images.append(filename)
            
            if len(male_images) == 0 and len(female_images) == 0:
                raise Exception("学習データが見つかりません")
            
            # より緩い条件
            if len(male_images) == 0 or len(female_images) == 0:
                print(f"警告: 片方の性別のデータがありません。オス:{len(male_images)}枚, メス:{len(female_images)}枚")
                # 警告は出すが続行
            
            print(f"学習データ: オス{len(male_images)}枚, メス{len(female_images)}枚")
            
            # アノテーション情報読み込み
            annotation_mapping = self._load_annotation_mapping()
            
            # 特徴量抽出
            X, y = self._extract_dataset_features(
                TRAINING_IMAGES_DIR, male_images, female_images, 
                metadata, annotation_mapping, task_id, global_status, processing_status
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
            accuracy = self._train_classification_model(X, y, task_id, global_status, processing_status)
            
            # モデルを再読み込み
            self.model_loaded = self.load_models()
            
            if global_status:
                processing_status[task_id] = {
                    "status": "completed",
                    "message": f"学習完了 (精度: {accuracy:.2f})",
                    "accuracy": float(accuracy),
                    "male_images": len(male_images),
                    "female_images": len(female_images),
                    "result": {
                        "accuracy": float(accuracy),
                        "male_images": len(male_images),
                        "female_images": len(female_images),
                        "feature_importance": self._get_feature_importance()
                    }
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
            # YoloDetectorを使用（利用可能な場合）
            if self.yolo_detector is not None:
                # 検出実行
                result = self.yolo_detector.detect(image)
                
                if result['count'] > 0:
                    # 検出された領域から特徴量を抽出
                    features_list = []
                    for detection in result['detections']:
                        bbox = detection['bbox']
                        x1, y1, x2, y2 = bbox
                        roi = image[y1:y2, x1:x2]
                        
                        # 各検出領域から特徴を抽出
                        feature = self._extract_features_from_roi(roi)
                        if feature:
                            features_list.append(feature)
                    
                    if features_list:
                        return np.mean(features_list, axis=0).tolist()
            
            # YOLOで検出されなかった場合、または利用できない場合は従来の画像処理を使用
            print("YOLOが利用できない、または検出されなかったため、従来の画像処理を使用します")
            
            # 画像全体から特徴を抽出
            feature = self._extract_features_from_roi(image)
            if feature:
                return feature
            
            # それでも抽出できない場合はデフォルト値
            return [1000.0, 150.0, 0.7, 0.8, 1.0]
                
        except Exception as e:
            print(f"特徴量抽出エラー: {str(e)}")
            # エラー時もデフォルト値を返す
            return [1000.0, 150.0, 0.7, 0.8, 1.0]

    def _extract_features_from_roi(self, roi):
        """ROI（関心領域）から特徴量を抽出"""
        try:
            if roi is None or roi.size == 0:
                return None
                
            # グレースケール変換
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi
            
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
            print(f"ROI特徴量抽出エラー: {str(e)}")
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
                self.rf_model = None
                self.scaler = None
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

    def _extract_dataset_features(self, images_dir, male_images, female_images, 
                                  metadata, annotation_mapping, task_id, global_status, processing_status):
        """データセットから特徴量を抽出"""
        X, y = [], []
        
        # オス画像処理
        for i, img_file in enumerate(male_images):
            if global_status:
                progress = 20 + (i / len(male_images)) * 30 if male_images else 20
                processing_status[task_id] = {
                    "status": "processing",
                    "progress": progress,
                    "message": f"オス画像処理中: {i+1}/{len(male_images)}"
                }
            
            img_path = os.path.join(images_dir, img_file)
            features = self._extract_features_from_image(cv2.imread(img_path))
            if features:
                X.append(features)
                y.append(0)  # オス = 0
        
        # メス画像処理  
        for i, img_file in enumerate(female_images):
            if global_status:
                progress = 50 + (i / len(female_images)) * 30 if female_images else 50
                processing_status[task_id] = {
                    "status": "processing",
                    "progress": progress,
                    "message": f"メス画像処理中: {i+1}/{len(female_images)}"
                }
            
            img_path = os.path.join(images_dir, img_file)
            features = self._extract_features_from_image(cv2.imread(img_path))
            if features:
                X.append(features)
                y.append(1)  # メス = 1
        
        return np.array(X), np.array(y)

    def _train_classification_model(self, X, y, task_id, global_status, processing_status):
        """分類モデルの学習"""
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score
        
        if global_status:
            processing_status[task_id] = {
                "status": "processing",
                "progress": 80,
                "message": "モデル学習中..."
            }
        
        # データ分割
        if len(X) < 4:
            # データが少ない場合は全データで学習
            X_train, X_test = X, X
            y_train, y_test = y, y
        else:
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

    def _get_feature_importance(self):
        """特徴重要度を取得"""
        if self.rf_model and hasattr(self.rf_model, 'feature_importances_'):
            feature_names = ['面積', '周囲長', '円形度', '充実度', 'アスペクト比']
            importance_dict = {}
            for name, importance in zip(feature_names, self.rf_model.feature_importances_):
                importance_dict[name] = float(importance)
            return importance_dict
        return {}


# 後方互換性のためのエイリアス
UrchinPapillaeAnalyzer = UnifiedAnalyzer
PapillaeAnalyzer = UnifiedAnalyzer