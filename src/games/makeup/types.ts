// マジックメイクミラーの型

// 顔の点（映像の正規化座標 0〜1。z は x と同じスケールの奥行きで、小さいほど手前）
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

// 1 フレーム分の顔認識の結果
export interface FaceFrame {
  landmarks: Point3[];              // 478 点
  blendshapes: Record<string, number>; // 表情の係数（0〜1）。名前は MediaPipe のもの（mouthSmileLeft など）
  timestamp: number;                // performance.now() 基準（ms）
}

// 頭の向き（度）。yaw: 左右（右を向くと正）、pitch: 上下（上を向くと正）、roll: 傾き（時計回りが正。映像の座標で）
export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

// 状態欄に出す顔の状態
export type FaceStatus = 'ok' | 'none' | 'far' | 'close' | 'dark' | 'turned';

// 顔認識の読み込み状態
export type TrackerLoadState =
  | { phase: 'idle' }
  | { phase: 'downloading'; loaded: number; total: number }   // bytes
  | { phase: 'starting' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

export type Delegate = 'GPU' | 'CPU';

// 設定（端末ごと）
export interface MakeupSettings {
  mirrored: boolean;
  delegate: Delegate;
  showLandmarks: boolean;
  showStats: boolean;
  guideOpacity: number; // 0〜1
}
