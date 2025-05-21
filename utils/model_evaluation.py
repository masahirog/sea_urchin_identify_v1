
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
# matplotlib設定を先頭に追加（GUIなしの環境用）
import matplotlib
matplotlib.use('Agg')  # GUIが不要なバックエンドを選択
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
    print(f"モデル評価開始 - サンプル数: {len(X) if X is not None else 'None'}")
    print(f"出力ディレクトリ: {output_dir}")
    
    try:
        os.makedirs(output_dir, exist_ok=True)
        print(f"出力ディレクトリ作成/確認完了: {os.path.exists(output_dir)}")
        
        # モデルが未指定の場合ファイルから読み込み
        if model is None and model_path is not None:
            try:
                print(f"モデルファイルからロード中: {model_path}")
                model, _ = joblib.load(model_path)
                print("モデルロード成功")
            except Exception as e:
                error_msg = f"モデル読み込みエラー: {str(e)}"
                print(error_msg)
                import traceback
                print(traceback.format_exc())
                return {"error": error_msg}
        
        if model is None:
            error_msg = "モデルが指定されていません"
            print(error_msg)
            return {"error": error_msg}
        
        if X is None or y is None:
            error_msg = "特徴量またはラベルデータがありません"
            print(error_msg)
            return {"error": error_msg}
            
        # 学習曲線の計算
        print("学習曲線の計算開始")
        train_sizes, train_scores, test_scores = learning_curve(
            model, X, y, cv=5, train_sizes=np.linspace(0.1, 1.0, 10),
            scoring="accuracy", n_jobs=-1
        )
        print("学習曲線の計算完了")
        
        # クロスバリデーション
        print("クロスバリデーション開始")
        cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
        print(f"クロスバリデーション完了 - スコア: {cv_scores}")
        
        # 混同行列
        print("混同行列の計算開始")
        y_pred = model.predict(X)
        cm = confusion_matrix(y, y_pred)
        print(f"混同行列: {cm}")
        
        # クラスレポート
        print("分類レポートの生成開始")
        report = classification_report(y, y_pred, target_names=["male", "female"], output_dict=True)
        print("分類レポート生成完了")
        
        # ROCカーブ用の予測確率
        try:
            print("ROCカーブ用の予測確率計算開始")
            y_proba = model.predict_proba(X)[:, 1]
            fpr, tpr, _ = roc_curve(y, y_proba)
            roc_auc = auc(fpr, tpr)
            print(f"ROCカーブ計算完了 - AUC: {roc_auc}")
        except Exception as e:
            print(f"ROCカーブ計算エラー: {str(e)}")
            import traceback
            print(traceback.format_exc())
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
        
        print(f"評価結果JSONの保存先: {result_path}")
        try:
            with open(result_path, 'w') as f:
                json.dump(eval_results, f, indent=2)
            print(f"評価結果JSONを保存しました: {result_path}")
            print(f"ファイル存在確認: {os.path.exists(result_path)}")
        except Exception as e:
            print(f"評価結果JSON保存エラー: {str(e)}")
            import traceback
            print(traceback.format_exc())
        
        # グラフを生成して保存
        create_evaluation_plots(eval_results, output_dir, timestamp)
        
        print("モデル評価完了")
        return eval_results
        
    except Exception as e:
        error_msg = f"モデル評価中にエラーが発生: {str(e)}"
        print(error_msg)
        import traceback
        print(traceback.format_exc())
        return {"error": error_msg}


def create_evaluation_plots(eval_results, output_dir, timestamp):
    """評価結果からグラフを生成して保存"""
    print(f"グラフ生成開始: {output_dir}, timestamp: {timestamp}")
    
    try:
        # 出力ディレクトリの確認
        os.makedirs(output_dir, exist_ok=True)
        print(f"出力ディレクトリ存在確認: {os.path.exists(output_dir)}")
        
        print("学習曲線のプロット生成開始")
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
        
        learning_curve_path = os.path.join(output_dir, f"learning_curve_{timestamp}.png")
        print(f"学習曲線の保存先: {learning_curve_path}")
        plt.savefig(learning_curve_path, dpi=100, bbox_inches='tight')
        print(f"学習曲線を保存しました: {learning_curve_path}")
        print(f"ファイル存在確認: {os.path.exists(learning_curve_path)}")
        plt.close()
        
        print("混同行列のプロット生成開始")
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
        confusion_matrix_path = os.path.join(output_dir, f"confusion_matrix_{timestamp}.png")
        print(f"混同行列の保存先: {confusion_matrix_path}")
        plt.savefig(confusion_matrix_path, dpi=100, bbox_inches='tight')
        print(f"混同行列を保存しました: {confusion_matrix_path}")
        print(f"ファイル存在確認: {os.path.exists(confusion_matrix_path)}")
        plt.close()
        
        print("ROCカーブのプロット生成開始")
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
            roc_curve_path = os.path.join(output_dir, f"roc_curve_{timestamp}.png")
            print(f"ROCカーブの保存先: {roc_curve_path}")
            plt.savefig(roc_curve_path, dpi=100, bbox_inches='tight')
            print(f"ROCカーブを保存しました: {roc_curve_path}")
            print(f"ファイル存在確認: {os.path.exists(roc_curve_path)}")
        plt.close()
        
        print("グラフ生成完了")
    except Exception as e:
        import traceback
        print(f"グラフ生成エラー: {str(e)}")
        print(traceback.format_exc())

def plot_to_base64(plt):
    """matplotlib プロットをbase64エンコードした画像に変換"""
    img_buf = io.BytesIO()
    plt.savefig(img_buf, format='png', bbox_inches='tight')
    img_buf.seek(0)
    img_data = base64.b64encode(img_buf.read()).decode('utf-8')
    return img_data


def get_model_evaluation_history(evaluation_dir='static/evaluation'):
    """評価履歴を取得する"""
    print(f"評価履歴取得開始: {evaluation_dir}")
    
    if not os.path.exists(evaluation_dir):
        print(f"評価ディレクトリが存在しません: {evaluation_dir}")
        return []
    
    # ディレクトリ内の全ファイルを一覧表示
    all_files = os.listdir(evaluation_dir)
    print(f"ディレクトリ内のファイル: {all_files}")
    
    # JSONファイルのみを抽出
    json_files = [f for f in all_files if f.endswith('.json')]
    print(f"JSONファイル: {json_files}")
    
    # 評価JSONファイルとアノテーション影響JSONファイルを分けて抽出
    eval_files = [f for f in json_files if f.startswith('eval_')]
    annotation_files = [f for f in json_files if f.startswith('annotation_impact_')]
    
    print(f"評価ファイル: {eval_files}, アノテーションファイル: {annotation_files}")
    
    # 評価履歴の結果を格納するリスト
    eval_history = []
    
    # 評価ファイルの処理
    for eval_file in eval_files:
        try:
            process_evaluation_file(evaluation_dir, eval_file, eval_history)
        except Exception as e:
            import traceback
            print(f"評価ファイル読み込みエラー: {eval_file} - {str(e)}")
            print(traceback.format_exc())
    
    # 評価ファイルがない場合は、アノテーションファイルから履歴を作成
    if len(eval_files) == 0 and len(annotation_files) > 0:
        print("評価ファイルがありません。アノテーション影響ファイルから履歴を作成します。")
        for anno_file in annotation_files:
            try:
                process_annotation_file(evaluation_dir, anno_file, eval_history)
            except Exception as e:
                import traceback
                print(f"アノテーションファイル読み込みエラー: {anno_file} - {str(e)}")
                print(traceback.format_exc())
    
    # 日時でソート（新しい順）
    eval_history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    print(f"評価履歴取得完了: {len(eval_history)}件")
    return eval_history

def process_evaluation_file(evaluation_dir, eval_file, eval_history):
    """評価ファイルを処理して履歴に追加する"""
    file_path = os.path.join(evaluation_dir, eval_file)
    print(f"評価ファイル読み込み: {file_path}")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # タイムスタンプの抽出
    timestamp = data.get("timestamp", eval_file.replace("eval_", "").replace(".json", ""))
    print(f"タイムスタンプ: {timestamp}")
    
    # 関連する画像ファイルの存在確認
    learning_curve_path = os.path.join(evaluation_dir, f"learning_curve_{timestamp}.png")
    confusion_matrix_path = os.path.join(evaluation_dir, f"confusion_matrix_{timestamp}.png")
    roc_curve_path = os.path.join(evaluation_dir, f"roc_curve_{timestamp}.png")
    
    lc_exists = os.path.exists(learning_curve_path)
    cm_exists = os.path.exists(confusion_matrix_path)
    roc_exists = os.path.exists(roc_curve_path)
    
    print(f"関連画像ファイル存在確認: 学習曲線={lc_exists}, 混同行列={cm_exists}, ROCカーブ={roc_exists}")
    
    # 要約情報を追加
    summary = {
        "timestamp": timestamp,
        "cv_mean": data.get("cv_mean", 0),
        "classification_report": data.get("classification_report", {}),
        "file": eval_file,
        "type": "evaluation",
        "images": {
            "learning_curve": f"learning_curve_{timestamp}.png" if lc_exists else None,
            "confusion_matrix": f"confusion_matrix_{timestamp}.png" if cm_exists else None,
            "roc_curve": f"roc_curve_{timestamp}.png" if roc_exists else None
        },
        "files_exist": {
            "learning_curve": lc_exists,
            "confusion_matrix": cm_exists,
            "roc_curve": roc_exists
        }
    }
    
    eval_history.append(summary)

def process_annotation_file(evaluation_dir, anno_file, eval_history):
    """アノテーション影響ファイルを処理して履歴に追加する"""
    file_path = os.path.join(evaluation_dir, anno_file)
    print(f"アノテーションファイル読み込み: {file_path}")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # タイムスタンプの抽出
    timestamp = data.get("timestamp", anno_file.replace("annotation_impact_", "").replace(".json", ""))
    print(f"タイムスタンプ: {timestamp}")
    
    # アノテーション影響グラフの存在確認
    annotation_impact_path = os.path.join(evaluation_dir, f"annotation_impact_{timestamp}.png")
    anno_exists = os.path.exists(annotation_impact_path)
    
    print(f"アノテーション影響グラフ存在確認: {anno_exists}")
    
    # データセット情報
    dataset = data.get("dataset", {})
    male_total = dataset.get("male_total", 0)
    female_total = dataset.get("female_total", 0)
    male_annotated = dataset.get("male_annotated", 0)
    female_annotated = dataset.get("female_annotated", 0)
    
    # アノテーション率をCV平均として使用
    annotation_rate = dataset.get("annotation_rate", 0)
    
    # 要約情報を追加
    summary = {
        "timestamp": timestamp,
        "cv_mean": annotation_rate,  # アノテーション率をCV平均として表示
        "type": "annotation",
        "file": anno_file,
        "images": {
            "annotation_impact": f"annotation_impact_{timestamp}.png" if anno_exists else None
        },
        "dataset": {
            "male_total": male_total,
            "female_total": female_total,
            "male_annotated": male_annotated,
            "female_annotated": female_annotated,
            "annotation_rate": annotation_rate
        }
    }
    
    eval_history.append(summary)


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
    print(f"アノテーション分析結果の保存先: {analysis_path}")
    with open(analysis_path, 'w') as f:
        json.dump(analysis, f, indent=2)
    print(f"アノテーション分析結果を保存しました: {analysis_path}")
    print(f"ファイル存在確認: {os.path.exists(analysis_path)}")
    
    # グラフを生成
    try:
        print(f"アノテーション分析グラフ生成開始: {output_dir}")
        
        # 出力ディレクトリの確認
        os.makedirs(output_dir, exist_ok=True)
        print(f"出力ディレクトリ存在確認: {os.path.exists(output_dir)}")
        
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
        annotation_impact_path = os.path.join(output_dir, f"annotation_impact_{timestamp}.png")
        print(f"アノテーション影響グラフの保存先: {annotation_impact_path}")
        plt.savefig(annotation_impact_path, dpi=100, bbox_inches='tight')
        print(f"アノテーション影響グラフを保存しました: {annotation_impact_path}")
        print(f"ファイル存在確認: {os.path.exists(annotation_impact_path)}")
        plt.close()
        
        print("アノテーション分析グラフ生成完了")
    except Exception as e:
        import traceback
        print(f"アノテーション分析グラフ生成エラー: {str(e)}")
        print(traceback.format_exc())