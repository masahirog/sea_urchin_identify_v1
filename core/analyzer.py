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

# YoloDetectorのみをインポート
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
    
    def classify_image(self, image_path, extract_only=False):
        """
        画像から雌雄を判定
        
        Args:
            image_path: 画像ファイルのパス
            extract_only: 特徴抽出のみ行うかどうか
            
        Returns:
            dict: 判定結果
        """
        try:
            # 画像読み込み
            image = cv2.imread(image_path)
            if image is None:
                return {"error": "画像の読み込みに失敗しました"}
            
            # Step 1: YOLO検出（可能な場合）
            detection_info = {}
            if self.yolo_detector is not None:
                try:
                    detection_result = self.yolo_detector.detect(image_path)
                    detection_info = {
                        "papillae_count": detection_result.get("count", 0),
                        "detections": detection_result.get("detections", []),
                        "annotated_image": detection_result.get("annotated_image")
                    }
                except Exception as e:
                    print(f"YOLO検出エラー（継続）: {str(e)}")
            
            # Step 2: 特徴量抽出
            features = self._extract_features_from_image(image)
            
            # 特徴抽出のみの場合
            if extract_only:
                return {
                    "features": features,
                    "detection_info": detection_info
                }
            
            # Step 3: RandomForestモデルによる雌雄判定
            if not self.model_loaded or self.rf_model is None:
                # モデル未学習の場合
                return {
                    "status": "model_not_trained",
                    "message": "雌雄判定モデルが未学習です。「機械学習」メニューから学習を実行してください。",
                    "features": features,
                    "guide": {
                        "steps": [
                            "1. 「学習データ」メニューでオス・メスの画像をアップロード（各5枚以上推奨）",
                            "2. 「機械学習」メニューでクイック学習を実行（1-2分）",
                            "3. 学習完了後、このページで雌雄判定が可能になります"
                        ],
                        "quick_start": True
                    },
                    **detection_info  # YOLO検出情報を含める
                }
            
            try:
                # 特徴量のスケーリング
                features_scaled = self.scaler.transform([features])
                
                # 予測
                prediction = self.rf_model.predict(features_scaled)[0]
                probabilities = self.rf_model.predict_proba(features_scaled)[0]
                
                # 結果の整形
                gender = "male" if prediction == 0 else "female"
                confidence = float(max(probabilities))
                
                # 特徴重要度
                feature_importance = self._get_feature_importance()
                
                return {
                    "gender": gender,
                    "confidence": confidence,
                    "features": features.tolist() if hasattr(features, 'tolist') else features,
                    "feature_importance": feature_importance,
                    **detection_info  # YOLO検出情報を含める
                }
                
            except Exception as e:
                print(f"予測エラー: {str(e)}")
                traceback.print_exc()
                return {
                    "error": f"予測中にエラーが発生しました: {str(e)}",
                    **detection_info
                }
                
        except Exception as e:
            print(f"画像分析エラー: {str(e)}")
            traceback.print_exc()
            return {"error": f"画像分析中にエラーが発生しました: {str(e)}"}

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