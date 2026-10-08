import { useCallback, useEffect, useMemo, useRef, useState, ComponentRef } from 'react';
import { PerspectiveCamera, TOUCH, Vector3 } from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PartDef, Stage } from '../types';
import { PART_DEFAULT_COLOR } from '../constants';
import { BlockedFeedback } from '../logic/gameReducer';
import { computeModelBounds, ModelBounds, partCornerPoints, screwHeadTop, toVector3 } from '../logic/geometry';
import { partFallDirection } from '../logic/rules';
import { PartMesh } from './PartMesh';
import { ScrewMesh, ScreenPoint } from './ScrewMesh';
import { DebrisBurst, DebrisBurstDef } from './Debris';

// HUD に隠れる領域（CSS px）。この内側に図形を収める
export interface ViewInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  stage: Stage;
  remainingParts: ReadonlySet<string>;
  remainingScrews: ReadonlySet<string>;
  removingScrews: readonly string[];
  fallingParts: readonly string[];
  feedback: BlockedFeedback | null;
  highlightActive: boolean;
  viewResetKey: number;
  insets: ViewInsets;
  onTapScrew: (id: string) => void;
  onScrewRemoveDone: (id: string, at: ScreenPoint) => void;
  onPartFallDone: (id: string) => void;
  onPointerMissed?: () => void;
}

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

// 自動テスト用: URL に ?nejidebug=1 があるとき、残っているネジの画面座標を window に書き出す
const DEBUG_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nejidebug');

interface NejiDebugInfo {
  screws: Record<string, { x: number; y: number }>;
  tap: (id: string) => void; // 当たり判定を通さずにタップする
}

declare global {
  interface Window {
    __nejiDebug?: NejiDebugInfo;
  }
}

function DebugProbe({
  stage,
  remainingScrews,
  onTapScrew,
}: {
  stage: Stage;
  remainingScrews: ReadonlySet<string>;
  onTapScrew: (id: string) => void;
}) {
  const frameRef = useRef(0);
  useFrame(({ camera, size }) => {
    if (frameRef.current++ % 10 !== 0) return;
    const screws: NejiDebugInfo['screws'] = {};
    for (const screw of stage.screws) {
      if (!remainingScrews.has(screw.id)) continue;
      const p = screwHeadTop(screw).project(camera);
      screws[screw.id] = { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
    }
    window.__nejiDebug = { screws, tap: onTapScrew };
  });
  return null;
}

// 図形全体が HUD に隠れない領域に収まるようにカメラを置き、回転・ズーム操作を提供する
function CameraRig({ bounds, resetKey, insets }: { bounds: ModelBounds; resetKey: number; insets: ViewInsets }) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsRef>(null);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);

    // HUD を除いた領域の中心に図形の中心が来るよう、投影をずらす
    const availW = Math.max(size.width - insets.left - insets.right, 80);
    const availH = Math.max(size.height - insets.top - insets.bottom, 80);
    const cx = insets.left + availW / 2;
    const cy = insets.top + availH / 2;
    cam.setViewOffset(size.width, size.height, size.width / 2 - cx, size.height / 2 - cy, size.width, size.height);

    // その領域に収まる距離（まず外接球で置いてから、AABB の頂点を投影して詰める）
    const tanV = Math.tan(vFov / 2) * (availH / size.height);
    const tanH = Math.tan(vFov / 2) * aspect * (availW / size.width);
    const halfFov = Math.atan(Math.min(tanV, tanH));
    let distance = (bounds.radius / Math.sin(halfFov)) * 1.08;

    const viewDir = new Vector3(0.9, 0.7, 1.2).normalize();
    const place = () => {
      cam.position.copy(bounds.center).addScaledVector(viewDir, distance);
      cam.near = Math.max(distance / 100, 0.05);
      cam.far = distance * 20;
      cam.lookAt(bounds.center);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    };
    place();
    const limitX = (availW / size.width) * 0.86;
    const limitY = (availH / size.height) * 0.86;
    for (let i = 0; i < 3 && bounds.corners.length > 0; i++) {
      let ratio = 0;
      for (const corner of bounds.corners) {
        const p = corner.clone().project(cam);
        ratio = Math.max(ratio, Math.abs(p.x) / limitX, Math.abs(p.y) / limitY);
      }
      if (ratio <= 0) break;
      distance *= ratio;
      place();
    }

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(bounds.center);
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 1.6;
      controls.update();
    }
  }, [bounds, resetKey, size.width, size.height, camera, insets]);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    return () => {
      cam.clearViewOffset();
    };
  }, [camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.75}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI - 0.15}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
    />
  );
}

// パーツのだいたいの大きさ（かけらの飛び散り方に使う）
function partSize(part: PartDef): number {
  const points = partCornerPoints(part);
  let max = 0;
  for (const p of points) max = Math.max(max, p.distanceTo(toVector3(part.position)));
  return max;
}

export function Scene({
  stage,
  remainingParts,
  remainingScrews,
  removingScrews,
  fallingParts,
  feedback,
  highlightActive,
  viewResetKey,
  insets,
  onTapScrew,
  onScrewRemoveDone,
  onPartFallDone,
  onPointerMissed,
}: Props) {
  const bounds = useMemo(() => computeModelBounds(stage), [stage]);
  const fallDirs = useMemo(() => {
    const map = new Map<string, Vector3>();
    for (const part of stage.parts) map.set(part.id, partFallDirection(stage, part));
    return map;
  }, [stage]);
  const treasureIds = useMemo(() => new Set(stage.treasure?.partIds ?? []), [stage]);

  const blockerIds = useMemo(
    () => new Set(highlightActive && feedback ? feedback.blockers.map(b => b.id) : []),
    [feedback, highlightActive],
  );

  // パーツが落ち始めたら、かけらを飛び散らせる
  const [bursts, setBursts] = useState<DebrisBurstDef[]>([]);
  const seenFallingRef = useRef(new Set<string>());
  useEffect(() => {
    const fresh = fallingParts.filter(id => !seenFallingRef.current.has(id));
    if (fallingParts.length === 0) seenFallingRef.current.clear();
    if (fresh.length === 0) return;
    const next: DebrisBurstDef[] = [];
    for (const id of fresh) {
      seenFallingRef.current.add(id);
      const part = stage.parts.find(p => p.id === id);
      if (!part) continue;
      next.push({
        id: `${id}-${performance.now().toFixed(0)}`,
        origin: toVector3(part.position),
        color: part.color ?? PART_DEFAULT_COLOR,
        size: partSize(part),
      });
    }
    setBursts(prev => [...prev, ...next]);
  }, [fallingParts, stage]);
  const handleBurstDone = useCallback((id: string) => setBursts(prev => prev.filter(b => b.id !== id)), []);

  const visibleParts = stage.parts.filter(p => remainingParts.has(p.id) || fallingParts.includes(p.id));
  const visibleScrews = stage.screws.filter(s => remainingScrews.has(s.id) || removingScrews.includes(s.id));

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 40, near: 0.1, far: 200, position: [0, 0, 10] }}
      style={{ touchAction: 'none' }}
      onPointerMissed={onPointerMissed}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#ffffff', '#3d4a6b', 0.7]} />
      <directionalLight position={[5, 10, 7]} intensity={1.6} />
      <directionalLight position={[-6, 4, -5]} intensity={0.5} />
      <directionalLight position={[2, -8, 3]} intensity={0.45} />

      <CameraRig bounds={bounds} resetKey={viewResetKey} insets={insets} />
      {DEBUG_ENABLED && <DebugProbe stage={stage} remainingScrews={remainingScrews} onTapScrew={onTapScrew} />}

      {visibleParts.map(part => (
        <PartMesh
          key={part.id}
          part={part}
          falling={fallingParts.includes(part.id)}
          fallDir={fallDirs.get(part.id) ?? new Vector3(0, 1, 0)}
          highlighted={blockerIds.has(part.id)}
          treasure={treasureIds.has(part.id)}
          onFallDone={onPartFallDone}
        />
      ))}

      {visibleScrews.map(screw => (
        <ScrewMesh
          key={screw.id}
          screw={screw}
          removing={removingScrews.includes(screw.id)}
          shakeSeq={feedback && feedback.screwId === screw.id ? feedback.seq : 0}
          highlighted={blockerIds.has(screw.id)}
          onTap={onTapScrew}
          onRemoveDone={onScrewRemoveDone}
        />
      ))}

      {bursts.map(burst => (
        <DebrisBurst key={burst.id} burst={burst} onDone={handleBurstDone} />
      ))}
    </Canvas>
  );
}
