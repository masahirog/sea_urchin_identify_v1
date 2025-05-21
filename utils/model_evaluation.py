"""
モデル評価と分析機能を提供するモジュール
学習曲線、混同行列、クロスバリデーションを実装
"""

import os
import numpy as np
import pandas as pd
import pickle
import json
from datetime import datetime
import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, classification_report, roc_curve, auc
from sklearn.model_selection import cross_val_score, learning_curve, StratifiedKFold
import io
import base64

def evaluate_model(X, y, model, model_path=None, output_dir='static/evaluation'):
    """
    モデルの評価を行い、結果を保存する
    
    Parameters:
    - X: 特徴量データ
    - y: ラベルデータ
    - model: 学習済みモデル
    - model_path: モデルファイルパス（Noneの場合はmodelパラメータを使用）
    - output_dir: 評価結果出力ディレクトリ
    
    Returns:
    - eval_results: 評価結果の辞書
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # モデルが未指定の場合ファイルから読み込み
    if model is None and model_path is not None:
        try:
            model, _ = joblib.load(model_path)
        except Exception as e:
            return {"error": f"モデル読み込みエラー: {str(e)}"}
    
    if model is None:
        return {"error": "モデルが指定されていません"}
    
    # 学習曲線の計算
    train_sizes, train_scores, test_scores = learning_curve(
        model, X, y, cv=5, train_sizes=np.linspace(0.1, 1.0, 10),
        scoring="accuracy", n_jobs=-1
    )
    
    # クロスバリデーション
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
    
    # 混同行列
    y_pred = model.predict(X)
    cm = confusion_matrix(y, y_pred)
    
    # クラスレポート
    report = classification_report(y, y_pred, target_names=["male", "female"], output_dict=True)
    
    # ROCカーブ用の予測確率
    try:
        y_proba = model.predict_proba(X)[:, 1]
        fpr, tpr, _ = roc_curve(y, y_proba)
        roc_auc = auc(fpr, tpr)
    except:
        fpr, tpr = [], []
        roc_auc = 0
    
    # 評価結果を保存
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_path = os.path.join(output_dir, f"eval_{timestamp}.json")
    
    eval_results = {
        "timestamp": timestamp,
        "train_sizes": train_sizes.tolist(),
        "train_scores_mean": train_scores.mean(axis=1).tolist(),
        "train_scores_std": train_scores.std(axis=1).tolist(),
        "test_scores_mean": test_scores.mean(axis=1).tolist(),
        "test_scores_std": test_scores.std(axis=1).tolist(),
        "cv_scores": cv_scores.tolist(),
        "cv_mean": cv_scores.mean(),
        "cv_std": cv_scores.std(),
        "confusion_matrix": cm.tolist(),
        "classification_report": report,
        "roc_auc": roc_auc,
        "fpr": fpr.tolist() if len(fpr) > 0 else [],
        "tpr": tpr.tolist() if len(tpr) > 0 else []
    }
    
    # 結果をJSONで保存
    with open(result_path, 'w') as f:
        json.dump(eval_results, f, indent=2)
    
    # グラフを生成して保存
    create_evaluation_plots(eval_results, output_dir, timestamp)
    
    return eval_results

def create_evaluation_plots(eval_results, output_dir, timestamp):
    """評価結果からグラフを生成して保存"""
    # 学習曲線のプロット
    plt.figure(figsize=(10, 6))
    train_sizes = eval_results["train_sizes"]
    train_scores_mean = eval_results["train_scores_mean"]
    train_scores_std = eval_results["train_scores_std"]
    test_scores_mean = eval_results["test_scores_mean"]
    test_scores_std = eval_results["test_scores_std"]
    
    plt.fill_between(train_sizes, 
                    [m - s for m, s in zip(train_scores_mean, train_scores_std)],
                    [m + s for m, s in zip(train_scores_mean, train_scores_std)], 
                    alpha=0.1, color="blue")
    plt.fill_between(train_sizes, 
                    [m - s for m, s in zip(test_scores_mean, test_scores_std)],
                    [m + s for m, s in zip(test_scores_mean, test_scores_std)], 
                    alpha=0.1, color="green")
    plt.plot(train_sizes, train_scores_mean, 'o-', color="blue", label="学習データ")
    plt.plot(train_sizes, test_scores_mean, 'o-', color="green", label="検証データ")
    plt.xlabel('学習サンプル数')
    plt.ylabel('精度')
    plt.title('学習曲線')
    plt.legend(loc="best")
    plt.grid(True)
    plt.savefig(os.path.join(output_dir, f"learning_curve_{timestamp}.png"), dpi=100, bbox_inches='tight')
    plt.close()
    
    # 混同行列のプロット
    plt.figure(figsize=(8, 6))
    cm = np.array(eval_results["confusion_matrix"])
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title('混同行列')
    plt.colorbar()
    tick_marks = np.arange(2)
    plt.xticks(tick_marks, ['オス', 'メス'])
    plt.yticks(tick_marks, ['オス', 'メス'])
    
    # 値を表示
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black")
    
    plt.ylabel('実際のクラス')
    plt.xlabel('予測されたクラス')
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"confusion_matrix_{timestamp}.png"), dpi=100, bbox_inches='tight')
    plt.close()
    
    # ROCカーブのプロット
    plt.figure(figsize=(8, 6))
    if "fpr" in eval_results and len(eval_results["fpr"]) > 0:
        fpr = eval_results["fpr"]
        tpr = eval_results["tpr"]
        roc_auc = eval_results["roc_auc"]
        plt.plot(fpr, tpr, color='darkorange', lw=2, 
                label=f'ROC曲線 (AUC = {roc_auc:.2f})')
        plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('偽陽性率')
        plt.ylabel('真陽性率')
        plt.title('ROC曲線')
        plt.legend(loc="lower right")
        plt.grid(True)
        plt.savefig(os.path.join(output_dir, f"roc_curve_{timestamp}.png"), dpi=100, bbox_inches='tight')
    plt.close()

def plot_to_base64(plt):
    """matplotlib プロットをbase64エンコードした画像に変換"""
    img_buf = io.BytesIO()
    plt.savefig(img_buf, format='png', bbox_inches='tight')
    img_buf.seek(0)
    img_data = base64.b64encode(img_buf.read()).decode('utf-8')
    return img_data

def get_model_evaluation_history(evaluation_dir='static/evaluation'):
    """評価履歴を取得する"""
    if not os.path.exists(evaluation_dir):
        return []
    
    eval_files = [f for f in os.listdir(evaluation_dir) if f.endswith('.json')]
    eval_history = []
    
    for eval_file in eval_files:
        try:
            with open(os.path.join(evaluation_dir, eval_file), 'r') as f:
                data = json.load(f)
                
            # ファイル名から日時を抽出
            timestamp = data.get("timestamp", eval_file.replace("eval_", "").replace(".json", ""))
            
            # 要約情報を追加
            summary = {
                "timestamp": timestamp,
                "cv_mean": data.get("cv_mean", 0),
                "classification_report": data.get("classification_report", {}),
                "file": eval_file,
                "images": {
                    "learning_curve": f"learning_curve_{timestamp}.png",
                    "confusion_matrix": f"confusion_matrix_{timestamp}.png",
                    "roc_curve": f"roc_curve_{timestamp}.png"
                }
            }
            
            eval_history.append(summary)
            
        except Exception as e:
            print(f"評価ファイル読み込みエラー: {eval_file} - {str(e)}")
    
    # 日時でソート（新しい順）
    eval_history.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return eval_history

def analyze_annotation_impact(dataset_dir, model_path, output_dir='static/evaluation'):
    """
    アノテーションの影響を分析する
    
    Parameters:
    - dataset_dir: データセットディレクトリ
    - model_path: モデルファイルパス
    - output_dir: 出力ディレクトリ
    
    Returns:
    - analysis: 分析結果
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # アノテーションデータの取得
    annotation_mapping_file = os.path.join('static', 'annotation_mapping.json')
    annotations = {}
    
    if os.path.exists(annotation_mapping_file):
        try:
            with open(annotation_mapping_file, 'r') as f:
                annotations = json.load(f)
        except Exception as e:
            print(f"アノテーションマッピング読み込みエラー: {str(e)}")
    
    # カテゴリ別のファイル数をカウント
    male_dir = os.path.join(dataset_dir, "male")
    female_dir = os.path.join(dataset_dir, "female")
    
    male_files = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(male_dir) else []
    female_files = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(female_dir) else []
    
    # アノテーション済みの画像をカウント
    male_annotated = 0
    female_annotated = 0
    
    for src_path in annotations.keys():
        # パスのフォーマットを確認（papillae/male/xxx.png など）
        if "/male/" in src_path:
            male_annotated += 1
        elif "/female/" in src_path:
            female_annotated += 1
    
    # モデルのロード
    try:
        model, scaler = joblib.load(model_path)
        model_loaded = True
    except Exception as e:
        print(f"モデル読み込みエラー: {str(e)}")
        model_loaded = False
        model = None
        scaler = None
    
    # 分析結果の作成
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    analysis = {
        "timestamp": timestamp,
        "dataset": {
            "male_total": len(male_files),
            "female_total": len(female_files),
            "male_annotated": male_annotated,
            "female_annotated": female_annotated,
            "annotation_rate": (male_annotated + female_annotated) / max(1, len(male_files) + len(female_files))
        },
        "model_loaded": model_loaded
    }
    
    # 結果をJSONで保存
    analysis_path = os.path.join(output_dir, f"annotation_impact_{timestamp}.json")
    with open(analysis_path, 'w') as f:
        json.dump(analysis, f, indent=2)
    
    # グラフを生成
    plt.figure(figsize=(10, 6))
    labels = ['オス', 'メス', '合計']
    annotated = [male_annotated, female_annotated, male_annotated + female_annotated]
    total = [len(male_files), len(female_files), len(male_files) + len(female_files)]
    non_annotated = [t - a for t, a in zip(total, annotated)]
    
    x = np.arange(len(labels))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(10, 6))
    rects1 = ax.bar(x - width/2, annotated, width, label='アノテーション済み')
    rects2 = ax.bar(x + width/2, non_annotated, width, label='未アノテーション')
    
    ax.set_title('データセットのアノテーション状況')
    ax.set_ylabel('画像数')
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.legend()
    
    # バーに数値を追加
    def add_labels(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{height}',
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha='center', va='bottom')
    
    add_labels(rects1)
    add_labels(rects2)
    
    fig.tight_layout()
    plt.savefig(os.path.join(output_dir, f"annotation_impact_{timestamp}.png"), dpi=100, bbox_inches='tight')
    plt.close()
    
    return analysis