# core/YoloTrainer.py

import os
import subprocess
import json
import threading
import time
from datetime import datetime
import logging

# ロガーの設定
logger = logging.getLogger(__name__)

class YoloTrainer:
    """YOLOv5モデルのトレーニングを管理するクラス"""
    
    def __init__(self, yolo_dir='yolov5', data_yaml='data/yolo_dataset/data.yaml'):
        """
        トレーナーの初期化
        
        Args:
            yolo_dir: YOLOv5のディレクトリパス
            data_yaml: データ設定ファイルのパス
        """
        self.yolo_dir = yolo_dir
        self.data_yaml = data_yaml
        self.training_process = None
        self.training_thread = None
        self.is_training = False
        self.start_time = None
        self.log_file = None
        self.current_epoch = 0
        self.total_epochs = 0
        self.training_id = None
        self.metrics = {
            'box_loss': [],
            'obj_loss': [],
            'cls_loss': [],
            'precision': [],
            'recall': [],
            'mAP50': [],
            'mAP50-95': []
        }
    
    def start_training(self, weights='yolov5s.pt', batch_size=4, epochs=50, img_size=640,
                       device='', workers=4, name='exp', exist_ok=False, **kwargs):

        """
        トレーニングを開始する
        
        Args:
            weights: 初期ウェイトファイル
            batch_size: バッチサイズ
            epochs: エポック数
            img_size: 画像サイズ
            device: デバイス指定（GPUの場合は '0'、CPUの場合は ''）
            workers: データローダーのワーカー数
            name: 実験名
            exist_ok: 同名の実験が存在する場合に上書きするかどうか
            
        Returns:
            bool: トレーニングが開始されたかどうか
        """
        self.training_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        if self.is_training:
            logger.warning("既にトレーニングが実行中です")
            return False
        
        logger.info(f"トレーニング開始: weights={weights}, batch_size={batch_size}, epochs={epochs}")
        
        # YOLOv5ディレクトリの存在確認
        if not os.path.exists(self.yolo_dir):
            logger.error(f"YOLOv5ディレクトリが存在しません: {self.yolo_dir}")
            return False
        
        # データ設定ファイルの存在確認
        full_data_yaml = os.path.join(os.getcwd(), self.data_yaml)
        if not os.path.exists(full_data_yaml):
            logger.error(f"データ設定ファイルが存在しません: {full_data_yaml}")
            return False
        
        # train.pyの存在確認
        train_script = os.path.join(self.yolo_dir, 'train.py')
        if not os.path.exists(train_script):
            logger.error(f"train.pyが存在しません: {train_script}")
            return False
        
        # トレーニングの設定を保存
        self.training_config = {
            'weights': weights,
            'batch_size': batch_size,
            'epochs': epochs,
            'img_size': img_size,
            'device': device,
            'workers': workers,
            'name': name,
            'exist_ok': exist_ok
        }
        
        # トレーニングスレッドを開始
        self.training_thread = threading.Thread(
            target=self._run_training_process,
            args=(weights, batch_size, epochs, img_size, device, workers, name, exist_ok)
        )
        self.training_thread.daemon = True
        self.training_thread.start()
        
        # スレッドが開始されるまで少し待つ
        time.sleep(0.5)
        
        return True
    
    def _run_training_process(self, weights, batch_size, epochs, img_size, device, workers, name, exist_ok):
        """トレーニングプロセスを実行する（内部メソッド）"""
        self.is_training = True
        self.start_time = datetime.now()
        self.total_epochs = epochs
        self.current_epoch = 0
        
        # ログファイルの設定
        log_dir = 'logs'
        os.makedirs(log_dir, exist_ok=True)
        # 古いログファイルを削除（5個より多い場合）
        import glob
        old_logs = sorted(glob.glob(os.path.join(log_dir, 'yolo_training_*.log')))
        if len(old_logs) > 5:
            for old_log in old_logs[:-5]:  # 最新5個を残して削除
                try:
                    os.remove(old_log)
                except:
                    pass
        self.log_file = os.path.join(log_dir, f'yolo_training_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        
        logger.info(f"トレーニングプロセス開始: {self.log_file}")
        
        # 絶対パスを使用
        data_yaml_path = os.path.abspath(self.data_yaml)
        
        # コマンドラインの構築
        cmd = [
            'python', 'train.py',
            '--img', str(img_size),
            '--batch', str(batch_size),
            '--epochs', str(epochs),
            '--data', data_yaml_path,
            '--weights', weights,
            '--workers', str(workers),
            '--name', name
        ]
        
        if exist_ok:
            cmd.append('--exist-ok')
            
        if device:
            cmd.extend(['--device', device])
        
        logger.info(f"実行コマンド: {' '.join(cmd)}")
        logger.info(f"作業ディレクトリ: {self.yolo_dir}")
        
        # プロセスの実行
        try:
            with open(self.log_file, 'w') as log_file:
                # 環境変数の設定（必要に応じて）
                env = os.environ.copy()
                env['PYTHONUNBUFFERED'] = '1'  # 出力をバッファリングしない
                
                self.training_process = subprocess.Popen(
                    cmd,
                    cwd=self.yolo_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    bufsize=1,
                    env=env
                )
                
                logger.info(f"プロセスID: {self.training_process.pid}")
                
                # 出力の監視とメトリクスの更新
                for line in self.training_process.stdout:
                    log_file.write(line)
                    log_file.flush()
                    
                    # コンソールにも出力（デバッグ用）
                    print(f"[YOLO] {line.strip()}")
                    
                    # エポック情報の抽出（修正版）
                    # YOLOv5の出力形式: "     0/99         0G     0.1276    0.02734     0.0309          8        640"
                    line_stripped = line.strip()
                    if '/' in line_stripped and len(line_stripped.split()) > 6:
                        parts = line_stripped.split()
                        if '/' in parts[0]:
                            try:
                                current, total = parts[0].split('/')
                                self.current_epoch = int(current) + 1  # 0ベースなので+1
                                self.total_epochs = int(total)
                                logger.info(f"エポック進捗: {self.current_epoch}/{self.total_epochs}")
                                
                                # メトリクスの更新
                                if len(parts) >= 7:
                                    try:
                                        self.metrics['box_loss'].append(float(parts[2]))
                                        self.metrics['obj_loss'].append(float(parts[3]))
                                        self.metrics['cls_loss'].append(float(parts[4]))
                                    except ValueError:
                                        pass
                            except ValueError:
                                pass
                    
                    # 評価メトリクスの抽出（修正版）
                    # "       all          3          1    0.00172          1     0.0076    0.00152"
                    if line_stripped.startswith('all') and len(line_stripped.split()) >= 7:
                        try:
                            parts = [p for p in line_stripped.split() if p]
                            if len(parts) >= 7:
                                # parts[0] = 'all'
                                # parts[1] = images
                                # parts[2] = instances  
                                # parts[3] = P
                                # parts[4] = R
                                # parts[5] = mAP50
                                # parts[6] = mAP50-95
                                self.metrics['precision'].append(float(parts[3]))
                                self.metrics['recall'].append(float(parts[4]))
                                self.metrics['mAP50'].append(float(parts[5]))
                                self.metrics['mAP50-95'].append(float(parts[6]))
                                logger.info(f"評価メトリクス更新: P={parts[3]}, R={parts[4]}, mAP50={parts[5]}")
                        except (ValueError, IndexError) as e:
                            logger.debug(f"メトリクス解析エラー: {e}")
                    
                    # トレーニング完了の検出
                    if "epochs completed in" in line:
                        logger.info("トレーニングが完了しました")
                        self.current_epoch = self.total_epochs
                # プロセスの終了を待つ
                return_code = self.training_process.wait()
                logger.info(f"トレーニングプロセス終了: 返り値={return_code}")
                
                if return_code != 0:
                    logger.error(f"トレーニングが異常終了しました: 返り値={return_code}")
                if "Class" in line and "Images" in line and "Instances" in line:
                    # 次の行も読み込んで詳細を確認
                    logger.info(f"検証結果詳細: {line}")
                    
                # 警告の検出
                if "WARNING" in line or "No labels found" in line:
                    logger.warning(f"YOLO警告: {line.strip()}")
        
        except Exception as e:
            logger.error(f"トレーニングエラー: {e}", exc_info=True)
        
        finally:
            self.is_training = False
            self.training_process = None
            logger.info("トレーニングプロセス終了処理完了")
    
    @staticmethod
    def get_latest_training():
        """最新のトレーニング状態を取得"""
        import glob
        state_files = glob.glob('logs/training_state_*.json')
        if not state_files:
            return None
            
        latest_file = max(state_files, key=os.path.getctime)
        with open(latest_file, 'r') as f:
            return json.load(f)

    def get_training_status(self):
        """現在のトレーニング状況を取得する（改善版）"""
        if not self.is_training and not self.start_time:
            return {
                'status': 'not_started',
                'message': 'トレーニングはまだ開始されていません'
            }
        
        # 経過時間の計算
        elapsed = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        hours, remainder = divmod(elapsed, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        # 進捗率の計算（エポックベース）
        if self.total_epochs > 0:
            progress = (self.current_epoch / self.total_epochs)
        else:
            progress = 0
        
        status = {
            'status': 'running' if self.is_training else 'completed',
            'start_time': self.start_time.strftime('%Y-%m-%d %H:%M:%S') if self.start_time else None,
            'elapsed_time': f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}",
            'current_epoch': self.current_epoch,
            'total_epochs': self.total_epochs,
            'progress': progress,
            'metrics': self.metrics,
            'message': f'エポック {self.current_epoch}/{self.total_epochs} を実行中...' if self.is_training else 'トレーニング完了'
        }
        
        # 最新の実験ディレクトリを取得
        if os.path.exists(os.path.join(self.yolo_dir, 'runs/train')):
            exp_dirs = sorted([d for d in os.listdir(os.path.join(self.yolo_dir, 'runs/train')) 
                              if d.startswith('exp')])
            if exp_dirs:
                latest_exp = exp_dirs[-1]
                exp_dir = os.path.join(self.yolo_dir, 'runs/train', latest_exp)
                
                # 結果画像のパスを追加
                status['result_images'] = {
                    'labels': f'/static/runs/train/{latest_exp}/labels.jpg' if os.path.exists(os.path.join(exp_dir, 'labels.jpg')) else None,
                    'train_batch': f'/static/runs/train/{latest_exp}/train_batch0.jpg' if os.path.exists(os.path.join(exp_dir, 'train_batch0.jpg')) else None,
                    'val_batch': f'/static/runs/train/{latest_exp}/val_batch0_pred.jpg' if os.path.exists(os.path.join(exp_dir, 'val_batch0_pred.jpg')) else None,
                    'results': f'/static/runs/train/{latest_exp}/results.png' if os.path.exists(os.path.join(exp_dir, 'results.png')) else None,
                    'confusion_matrix': f'/static/runs/train/{latest_exp}/confusion_matrix.png' if os.path.exists(os.path.join(exp_dir, 'confusion_matrix.png')) else None,
                    'PR_curve': f'/static/runs/train/{latest_exp}/PR_curve.png' if os.path.exists(os.path.join(exp_dir, 'PR_curve.png')) else None
                }
                
                # モデルファイルのパス
                best_model_path = os.path.join(exp_dir, 'weights/best.pt')
                if os.path.exists(best_model_path):
                    status['best_model_path'] = best_model_path
                
                # 結果ファイルの読み込み
                results_csv = os.path.join(exp_dir, 'results.csv')
                if os.path.exists(results_csv):
                    try:
                        with open(results_csv, 'r') as f:
                            lines = f.readlines()
                            if len(lines) > 1:
                                headers = [h.strip() for h in lines[0].split(',')]
                                values = [v.strip() for v in lines[-1].split(',')]
                                status['latest_results'] = dict(zip(headers, values))
                    except Exception as e:
                        logger.error(f"結果ファイル読み込みエラー: {e}")
        
        return status