"""
テスト用のモデルを生成するスクリプト
開発環境や初回セットアップ用
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

def create_test_model(output_path='models'):
    """
    テスト用のランダムフォレストモデルを生成する
    
    Parameters:
    - output_path: モデルの保存先ディレクトリ
    """
    print("テストモデル生成開始")
    
    # 出力ディレクトリの確認
    os.makedirs(output_path, exist_ok=True)
    
    # 特徴量の次元
    n_features = 5
    
    # 各クラス100サンプルずつ、合計200サンプル
    n_samples_per_class = 100
    
    # 乱数の種を固定
    np.random.seed(42)
    
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
    
    # 特徴量のスケーリング
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # ランダムフォレストモデルの作成と学習
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    rf_model.fit(X_scaled, y)
    
    # モデルの保存
    model_path = os.path.join(output_path, 'sea_urchin_rf_model.pkl')
    joblib.dump((rf_model, scaler), model_path)
    
    print(f"テストモデルを保存しました: {model_path}")
    
    return model_path

if __name__ == '__main__':
    create_test_model()