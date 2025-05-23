# core/YoloTrainer.py
import os
import subprocess
import threading
import time
import glob
import json
from datetime import datetime

class YoloTrainer:
    """YOLOv5のトレーニングを管理するクラス"""
    
    def __init__(self):
        """初期化"""
        self.process = None
        self.status = {
            'status': 'not_started',
            'progress': 0,
            'current_epoch': 0,
            'total_epochs': 0,
            'elapsed_time': '00:00:00',
            'message': 'トレーニングはまだ開始されていません',
            'metrics': {
                'box_loss': [],
                'obj_loss': [],
                'mAP50': []
            },
            'result_images': {}
        }
        self.lock = threading.Lock()
    
    def start_training(self, weights='yolov5s.pt', batch_size=16, epochs=100, img_size=640, device='', workers=4, name='exp', exist_ok=False):
        """
        YOLOv5のトレーニングを開始
        
        Args:
            weights: 初期重みファイル
            batch_size: バッチサイズ
            epochs: エポック数
            img_size: 画像サイズ
            device: 使用するデバイス（空文字列はCPU、'0'はGPU 0番）
            workers: データローディングのワーカー数
            name: 実験名
            exist_ok: 同名の実験が存在する場合に上書きするか
            
        Returns:
            bool: トレーニングが開始されたかどうか
        """
        # すでにトレーニングが実行中の場合は開始しない
        if self.process and self.process.poll() is None:
            print("トレーニングはすでに実行中です")
            return False
        
        try:
            # トレーニングコマンドの構築
            cmd = [
                'python', 'train.py',
                '--data', 'data/yolo_dataset/data.yaml',
                '--weights', weights,
                '--batch-size', str(batch_size),
                '--epochs', str(epochs),
                '--img', str(img_size),
                '--workers', str(workers),
                '--name', name
            ]
            
            if device:
                cmd.extend(['--device', device])
            
            if exist_ok:
                cmd.append('--exist-ok')
            
            # 作業ディレクトリを指定
            cwd = 'yolov5'
            
            # ステータスの初期化
            with self.lock:
                self.status = {
                    'status': 'starting',
                    'progress': 0,
                    'current_epoch': 0,
                    'total_epochs': epochs,
                    'elapsed_time': '00:00:00',
                    'message': 'トレーニングを開始しています...',
                    'metrics': {
                        'box_loss': [],
                        'obj_loss': [],
                        'mAP50': []
                    },
                    'result_images': {}
                }
            
            # プロセスの開始
            self.process = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # 出力の監視スレッドを開始
            threading.Thread(target=self._monitor_output, daemon=True).start()
            
            print(f"トレーニングを開始しました: {' '.join(cmd)}")
            return True
        
        except Exception as e:
            print(f"トレーニング開始エラー: {e}")
            with self.lock:
                self.status = {
                    'status': 'error',
                    'progress': 0,
                    'current_epoch': 0,
                    'total_epochs': 0,
                    'elapsed_time': '00:00:00',
                    'message': f'トレーニング開始エラー: {str(e)}',
                    'metrics': {
                        'box_loss': [],
                        'obj_loss': [],
                        'mAP50': []
                    },
                    'result_images': {}
                }
            return False
    
    def stop_training(self):
        """
        実行中のトレーニングを停止
        
        Returns:
            bool: 停止が成功したかどうか
        """
        if not self.process or self.process.poll() is not None:
            return False
        
        try:
            # プロセスを終了
            self.process.terminate()
            
            # 最大5秒待機
            for _ in range(5):
                if self.process.poll() is not None:
                    break
                time.sleep(1)
            
            # 終了しない場合は強制終了
            if self.process.poll() is None:
                self.process.kill()
                time.sleep(1)
            
            with self.lock:
                self.status['status'] = 'stopped'
                self.status['message'] = 'トレーニングが手動で停止されました'
            
            return True
        
        except Exception as e:
            print(f"トレーニング停止エラー: {e}")
            return False
    
    def get_training_status(self):
        """
        現在のトレーニング状態を取得
        
        Returns:
            dict: トレーニングの状態情報
        """
        with self.lock:
            # プロセスの状態を確認
            if self.process and self.process.poll() is not None:
                # プロセスが終了している場合
                exit_code = self.process.poll()
                if exit_code == 0:
                    self.status['status'] = 'completed'
                    self.status['message'] = 'トレーニングが完了しました'
                    self.status['progress'] = 100
                else:
                    self.status['status'] = 'failed'
                    self.status['message'] = f'トレーニングが失敗しました (終了コード: {exit_code})'
            
            # 結果画像のパスを更新
            self._update_result_images()
            
            return self.status.copy()
    
    def _monitor_output(self):
        """トレーニングプロセスの出力を監視"""
        for line in self.process.stdout:
            self._parse_output_line(line)
    
    def _parse_output_line(self, line):
        """
        トレーニング出力行を解析
        
        Args:
            line: 出力行
        """
        try:
            # エポック情報の抽出
            if 'Epoch:' in line and '/' in line:
                parts = line.split()
                for i, part in enumerate(parts):
                    if part == 'Epoch:':
                        epoch_info = parts[i+1]
                        if '/' in epoch_info:
                            current_epoch, total_epochs = map(int, epoch_info.split('/'))
                            
                            with self.lock:
                                self.status['current_epoch'] = current_epoch
                                self.status['total_epochs'] = total_epochs
                                self.status['progress'] = round((current_epoch / total_epochs) * 100)
                                self.status['status'] = 'running'
                                self.status['message'] = f'エポック {current_epoch}/{total_epochs} を実行中...'
                            break
            
            # 経過時間の抽出
            if 'time:' in line:
                parts = line.split()
                for i, part in enumerate(parts):
                    if part == 'time:':
                        elapsed_time = parts[i+1]
                        with self.lock:
                            self.status['elapsed_time'] = elapsed_time
                        break
            
            # ロスとメトリクスの抽出
            if 'box_loss:' in line and 'obj_loss:' in line:
                parts = line.split()
                box_loss = None
                obj_loss = None
                
                for i, part in enumerate(parts):
                    if part == 'box_loss:':
                        box_loss = float(parts[i+1])
                    elif part == 'obj_loss:':
                        obj_loss = float(parts[i+1])
                
                with self.lock:
                    if box_loss is not None:
                        self.status['metrics']['box_loss'].append(box_loss)
                    if obj_loss is not None:
                        self.status['metrics']['obj_loss'].append(obj_loss)
            
            # mAP値の抽出
            if 'mAP@0.5' in line:
                parts = line.split()
                for i, part in enumerate(parts):
                    if part.startswith('mAP@0.5'):
                        # カンマや括弧などを除去
                        value_str = parts[i+1].strip(',():')
                        try:
                            map50 = float(value_str)
                            with self.lock:
                                self.status['metrics']['mAP50'].append(map50)
                        except ValueError:
                            pass
                        break
        
        except Exception as e:
            print(f"出力解析エラー: {e}")
    
    def _update_result_images(self):
        """結果画像のパスを更新"""
        try:
            # 最新のexpディレクトリを検索
            exp_dirs = sorted([d for d in os.listdir('yolov5/runs/train') if d.startswith('exp')])
            if not exp_dirs:
                return
            
            latest_exp = exp_dirs[-1]
            exp_dir = os.path.join('yolov5/runs/train', latest_exp)
            
            # 結果画像のパスを収集
            result_images = {}
            
            # トレーニングバッチ画像
            batch_files = glob.glob(os.path.join(exp_dir, 'train_batch*.jpg'))
            if batch_files:
                result_images['train_batch'] = f"/static/runs/train/{latest_exp}/{os.path.basename(batch_files[0])}"
            
            # ラベル画像
            label_path = os.path.join(exp_dir, 'labels.jpg')
            if os.path.exists(label_path):
                result_images['labels'] = f"/static/runs/train/{latest_exp}/labels.jpg"
            
            # 結果画像
            results_path = os.path.join(exp_dir, 'results.png')
            if os.path.exists(results_path):
                result_images['results'] = f"/static/runs/train/{latest_exp}/results.png"
            
            # 混同行列
            confusion_path = os.path.join(exp_dir, 'confusion_matrix.png')
            if os.path.exists(confusion_path):
                result_images['confusion_matrix'] = f"/static/runs/train/{latest_exp}/confusion_matrix.png"
            
            with self.lock:
                self.status['result_images'] = result_images
        
        except Exception as e:
            print(f"結果画像更新エラー: {e}")
    
    def save_training_results(self):
        """
        トレーニング結果を保存
        
        Returns:
            dict: 保存結果
        """
        try:
            # 最新のexpディレクトリを検索
            exp_dirs = sorted([d for d in os.listdir('yolov5/runs/train') if d.startswith('exp')])
            if not exp_dirs:
                return {'status': 'error', 'message': '学習結果が見つかりません'}
            
            latest_exp = exp_dirs[-1]
            exp_dir = os.path.join('yolov5/runs/train', latest_exp)
            
            # 結果ディレクトリ
            results_dir = 'data/evaluations'
            os.makedirs(results_dir, exist_ok=True)
            
            # タイムスタンプ
            timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%f')
            
            # メトリクスとステータスを取得
            status = self.get_training_status()
            
            # 結果データを構築
            results = {
                'timestamp': timestamp,
                'exp_dir': latest_exp,
                'epochs': status['total_epochs'],
                'metrics': status['metrics'],
                'result_images': status['result_images']
            }
            
            # 結果をJSONファイルに保存
            results_file = os.path.join(results_dir, f'training_results_{timestamp}.json')
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2)
            
            return {
                'status': 'success',
                'message': '学習結果を保存しました',
                'results_file': results_file,
                'results': results
            }
        
        except Exception as e:
            print(f"結果保存エラー: {e}")
            return {'status': 'error', 'message': f'結果保存エラー: {str(e)}'}