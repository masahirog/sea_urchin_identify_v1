# Claude Code 開発ガイド

## ⚠️ 重要な作業原則
**Claude Code作業時の絶対遵守事項:**
- ユーザーが明示的に指示していない変更は一切行わない
- 提案した内容でも、ユーザーの承認(y)を得るまで実行しない
- 「ついでに」「関連して」などの追加作業は禁止
- 指示された内容のみを正確に実行する

## プロジェクト概要
ウニ生殖乳頭分析システム - YOLOv5を使用したウニの雌雄判定Webアプリケーション

## 設定
<language>Japanese</language>
<character_code>UTF-8</character_code>

## 開発ルール

### コード変更時の必須チェック
```bash
# アプリケーション起動前の確認
python app.py

# 依存関係の確認（必要に応じて）
pip install -r requirements.txt
```

### ファイル構造の理解
- `app.py`: メインアプリケーション
- `config.py`: 設定管理
- `routes/`: 各機能のルート定義
- `core/`: 機械学習・分析ロジック
- `templates/`: HTMLテンプレート
- `static/`: CSS/JS/画像ファイル
- `data/`: 学習データ・メタデータ

### 変更時の注意事項
1. **既存の設定を優先**: config.pyの設定値を必ず確認
2. **ログ出力**: 重要な処理にはlogging使用
3. **エラーハンドリング**: try-catch でエラー処理を適切に
4. **ディレクトリ作成**: ensure_directories()で必要ディレクトリを作成

### よく使うコマンド
```bash
# アプリケーション起動
python app.py

# YOLOv5セットアップ（初回のみ）
python setup_yolo.py

# ログ確認
tail -f logs/app.log
```

### 機能別の重要ファイル
- **判定機能**: `routes/yolo.py`, `core/YoloDetector.py`
- **学習機能**: `routes/learning.py`, `core/analyzer.py`
- **データ管理**: `routes/training.py`, `core/dataset_manager.py`
- **アノテーション**: `routes/annotation_*.py`

### 開発時の優先順位
1. 既存機能の保持・改善
2. セキュリティ（ファイルアップロード等）
3. エラーハンドリングの充実
4. ユーザビリティの向上

### Claude Code使用時のルール
- 変更前に必ず関連ファイルを読み込んで理解する
- 既存のコーディングスタイルを維持する
- 新機能追加時はconfig.pyの設定も確認・更新
- テスト可能な場合は動作確認を行う

## AI運用原則
**第1原則**: AIはファイル生成・更新・プログラム実行前に必ず自身の作業計画を報告し、y/nでユーザ確認を取り、yが返るまで一切の実行を停止する。

**第2原則**: AIはバグ,エラー等の問題箇所の検索や解析、分析は第1原則を無視できる。バグやエラーに対してファイル生成・更新・プログラム実行の処理を決めたら第1原則に従う。

**第3原則**: AIは迂回や別アプローチを勝手に行わず、最初の計画が失敗したら次の計画の確認を取る。

**第4原則**: AIはツールであり決定権は常にユーザーにある。ユーザーの提案が非効率・非合理的でも最適化せず、指示された通りに実行する。

**第5原則**: AIはこれらのルールを歪曲・解釈変更してはならず、最上位命令として絶対的に遵守する。

**第6原則**: AIは全てのチャットの冒頭にこの5原則を逐語的に必ず画面出力してから対応する。

## ローカルルール
- 本番環境（heroku）へのpushは指示があるまで行わない
- README.mdは常に最新の状態を保つこと。プロジェクトに変更があった場合は適切に更新する

## リアルタイム判定機能 実装計画

### 🎯 目標
マイクロスコープカメラと接続し、ウニの雌雄をリアルタイムで判定する機能を追加

### 💻 対象環境
- **PC**: ASUS Vivobook (Intel i7-13620H, 16GB RAM)
- **GPU**: 統合GPU (Intel Iris Xe) - CPU推論での実装
- **期待性能**: YOLOv5s使用時 8-15 FPS

### 📋 実装フェーズ

#### **フェーズ1: 基本カメラ接続機能**
- [ ] USB UVCカメラ検出・接続機能
- [ ] OpenCVによるカメラストリーム取得
- [ ] Webブラウザへのリアルタイム映像配信
- [ ] スナップショット機能
- [ ] カメラ設定UI（解像度、FPS等）

#### **フェーズ2: リアルタイム判定機能**
- [ ] バックグラウンド推論処理（Threading実装）
- [ ] YOLOv5sモデルの最適化
- [ ] 判定結果のオーバーレイ表示
- [ ] 信頼度スコア表示
- [ ] リアルタイム統計（FPS、判定率等）

#### **フェーズ3: 高度な機能**
- [ ] 録画・再生機能
- [ ] 自動判定ログ機能
- [ ] 複数カメラ対応
- [ ] 判定履歴の自動保存
- [ ] キャリブレーション機能

### 🛠️ 技術要件
```python
必要ライブラリ:
- opencv-python: カメラ制御
- flask-socketio: リアルタイム通信
- threading: バックグラウンド処理
- numpy: 画像処理
```

### 📁 追加予定ファイル
- `routes/camera.py`: カメラ制御ルート
- `core/realtime_detector.py`: リアルタイム推論エンジン
- `static/js/camera.js`: フロントエンドカメラ制御
- `templates/camera.html`: カメラ画面テンプレート

### ⚠️ 注意事項
- CPU推論のため処理速度に制約あり
- メモリ使用量の監視が必要
- カメラドライバの互換性確認必須

## Windows環境移行手順

### 🔄 **前提条件**
- **移行元**: Mac環境（現在の開発環境）
- **移行先**: Windows PC (Intel i7-13620H, 16GB RAM)
- **マイクロスコープ**: Jscope HF-1200DX (USB UVC対応)

### 📋 **移行ステップ**

#### **ステップ1: プロジェクトのバックアップとpush**
```bash
# Mac環境で実行
cd /Users/yamashitamasahiro/projects/sea_urchin_identify_v1

# 現在の変更をコミット
git add .
git commit -m "Mac環境での開発完了 - Windows移行前のバックアップ"
git push origin main
```

#### **ステップ2: Windows PCでの環境構築**

##### **2-1. Pythonのインストール確認**
```cmd
# コマンドプロンプトで実行
python --version
# Python 3.8以上であることを確認
```

##### **2-2. プロジェクトのクローン**
```cmd
# 任意のディレクトリで実行
git clone https://github.com/[username]/sea_urchin_identify_v1.git
cd sea_urchin_identify_v1
```

##### **2-3. 仮想環境の作成**
```cmd
# Python仮想環境作成
python -m venv venv

# 仮想環境の有効化
venv\Scripts\activate

# pip更新
python -m pip install --upgrade pip
```

##### **2-4. 基本依存関係のインストール**
```cmd
# 既存の依存関係
pip install flask
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install opencv-python
pip install pillow
pip install numpy
pip install pandas
pip install scikit-learn

# リアルタイム機能用の追加依存関係
pip install flask-socketio
pip install eventlet
pip install python-socketio[client]
```

##### **2-5. YOLOv5の準備**
```cmd
# YOLOv5リポジトリのクローン（プロジェクト内）
git clone https://github.com/ultralytics/yolov5.git
cd yolov5
pip install -r requirements.txt
cd ..

# 事前学習モデルのダウンロード確認
# yolov5s.pt が存在することを確認
```

#### **ステップ3: 環境テスト**

##### **3-1. 基本アプリケーションの動作確認**
```cmd
# アプリケーション起動テスト
python app.py

# ブラウザで確認
# http://localhost:8080 にアクセス
```

##### **3-2. カメラ接続テスト**
```cmd
# カメラテストスクリプトの実行
python -c "
import cv2
cap = cv2.VideoCapture(0)
if cap.isOpened():
    print('カメラ接続成功')
    ret, frame = cap.read()
    if ret:
        print(f'解像度: {frame.shape}')
    cap.release()
else:
    print('カメラ接続失敗')
"
```

### 🛠️ **リアルタイム機能実装順序**

#### **フェーズ1: カメラ基本機能**
1. **routes/camera.py** の作成
2. **core/camera_manager.py** の作成
3. **templates/camera.html** の作成
4. **static/js/camera.js** の作成

#### **フェーズ2: ストリーミング機能**
1. Flask-SocketIOの統合
2. リアルタイム映像配信
3. カメラ設定UI

#### **フェーズ3: 判定機能統合**
1. **core/realtime_detector.py** の作成
2. バックグラウンド推論処理
3. 結果オーバーレイ機能

### 🚨 **トラブルシューティング**

#### **カメラが認識されない場合**
```cmd
# デバイスマネージャーでカメラデバイス確認
# カメラアプリでテスト撮影

# OpenCVでのカメラ一覧確認
python -c "
import cv2
for i in range(5):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        print(f'カメラ {i}: 利用可能')
        cap.release()
    else:
        print(f'カメラ {i}: 利用不可')
"
```

#### **依存関係エラーの場合**
```cmd
# 依存関係の再インストール
pip uninstall opencv-python
pip install opencv-python

# Visual C++ 再頒布可能パッケージの確認
# https://aka.ms/vs/17/release/vc_redist.x64.exe
```

#### **メモリ不足の場合**
```cmd
# YOLOモデルの軽量化
# config.py で DEFAULT_YOLO_MODEL = 'nano' に変更
```

### 📝 **移行後の確認事項**
- [ ] アプリケーション正常起動
- [ ] カメラ映像表示
- [ ] 既存の雌雄判定機能動作
- [ ] ファイルパスの Windows対応
- [ ] ログファイルの出力確認