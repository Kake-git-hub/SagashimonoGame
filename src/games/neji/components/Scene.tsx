import { useEffect, useMemo, useRef, ComponentRef } from 'react';
import { PerspectiveCamera, TOUCH, Vector3 } from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Stage } from '../types';
import { BlockedFeedback } from '../logic/gameReducer';
import { computeModelBounds, ModelBounds, screwHeadTop } from '../logic/geometry';
import { partFallDirection } from '../logic/rules';
import { PartMesh } from './PartMesh';
import { ScrewMesh, ScreenPoint } from './ScrewMesh';

interface Props {
  stage: Stage;
  remainingParts: ReadonlySet<string>;
  remainingScrews: ReadonlySet<string>;
  removingScrews: readonly string[];
  fallingParts: readonly string[];
  feedback: BlockedFeedback | null;
  highlightActive: boolean;
  viewResetKey: number;
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

// 図形全体が画面に収まるようにカメラを置き、回転・ズーム操作を提供する
function CameraRig({ bounds, resetKey }: { bounds: ModelBounds; resetKey: number }) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsRef>(null);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distance = (bounds.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.08;

    const viewDir = new Vector3(0.9, 0.7, 1.2).normalize();
    cam.position.copy(bounds.center).addScaledVector(viewDir, distance);
    cam.near = Math.max(distance / 100, 0.05);
    cam.far = distance * 20;
    cam.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(bounds.center);
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 1.6;
      controls.update();
    }
  }, [bounds, resetKey, size.width, size.height, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.75}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI - 0.25}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
    />
  );
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

  const blockerIds = useMemo(
    () => new Set(highlightActive && feedback ? feedback.blockers.map(b => b.id) : []),
    [feedback, highlightActive],
  );

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

      <CameraRig bounds={bounds} resetKey={viewResetKey} />
      {DEBUG_ENABLED && <DebugProbe stage={stage} remainingScrews={remainingScrews} onTapScrew={onTapScrew} />}

      {visibleParts.map(part => (
        <PartMesh
          key={part.id}
          part={part}
          falling={fallingParts.includes(part.id)}
          fallDir={fallDirs.get(part.id) ?? new Vector3(0, 1, 0)}
          highlighted={blockerIds.has(part.id)}
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
    </Canvas>
  );
}
