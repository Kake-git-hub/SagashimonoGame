import { useEffect, useMemo, useRef } from 'react';
import { Group } from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { ScrewDef } from '../types';
import { ANIM, SCREW, SCREW_COLOR_HEX } from '../constants';
import { perpendicularBasis, screwDirection, screwLength, screwQuaternion, toVector3 } from '../logic/geometry';

// キャンバス内のピクセル座標
export interface ScreenPoint {
  x: number;
  y: number;
}

interface Props {
  screw: ScrewDef;
  removing: boolean;        // 取り外しアニメーション中
  shakeSeq: number;         // 変わるたびに震える（0 は震えない）
  highlighted: boolean;     // 邪魔している物として赤く光らせる
  onTap: (id: string) => void;
  onRemoveDone: (id: string, at: ScreenPoint) => void;
}

// タップとドラッグの区別
const TAP_MAX_DISTANCE = 12; // px
const TAP_MAX_MS = 700;

export function ScrewMesh({ screw, removing, shakeSeq, highlighted, onTap, onRemoveDone }: Props) {
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const seat = useMemo(() => toVector3(screw.position), [screw]);
  const dir = useMemo(() => screwDirection(screw), [screw]);
  const quaternion = useMemo(() => screwQuaternion(screw), [screw]);
  const lateralAxis = useMemo(() => perpendicularBasis(dir)[0], [dir]);
  const length = screwLength(screw);
  const color = SCREW_COLOR_HEX[screw.color];

  const removeStartRef = useRef<number | null>(null);
  const removeDoneRef = useRef(false);
  const shakeStartRef = useRef<number | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (shakeSeq > 0) shakeStartRef.current = performance.now();
  }, [shakeSeq]);

  useEffect(() => {
    if (removing) return;
    removeStartRef.current = null;
    removeDoneRef.current = false;
    if (spinRef.current) spinRef.current.rotation.y = 0;
  }, [removing]);

  useFrame(({ camera, size }) => {
    const group = groupRef.current;
    if (!group) return;
    const now = performance.now();

    let travel = 0;
    if (removing) {
      if (removeStartRef.current === null) removeStartRef.current = now;
      const p = Math.min(1, (now - removeStartRef.current) / ANIM.REMOVE_MS);
      travel = p * p * (length + SCREW.HEAD_HEIGHT);
      if (spinRef.current) spinRef.current.rotation.y = p * Math.PI * 2 * 3;
      if (p >= 1 && !removeDoneRef.current) {
        removeDoneRef.current = true;
        const head = seat.clone().addScaledVector(dir, travel + SCREW.HEAD_HEIGHT / 2).project(camera);
        onRemoveDone(screw.id, {
          x: ((head.x + 1) / 2) * size.width,
          y: ((1 - head.y) / 2) * size.height,
        });
      }
    }

    const position = seat.clone().addScaledVector(dir, travel);
    if (shakeStartRef.current !== null) {
      const p = (now - shakeStartRef.current) / ANIM.SHAKE_MS;
      if (p >= 1) {
        shakeStartRef.current = null;
      } else {
        position.addScaledVector(lateralAxis, Math.sin(p * Math.PI * 8) * 0.08 * (1 - p));
      }
    }
    group.position.copy(position);
  });

  // 一番手前のネジだけがタップを受け取る（奥のネジへ伝播させない）
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerDownRef.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const down = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!down || removing) return;
    const distance = Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y);
    if (distance <= TAP_MAX_DISTANCE && performance.now() - down.t <= TAP_MAX_MS) {
      onTap(screw.id);
    }
  };

  const emissive = highlighted ? '#ff2a2a' : '#000000';
  const emissiveIntensity = highlighted ? 0.8 : 0;

  return (
    <group
      ref={groupRef}
      position={seat}
      quaternion={quaternion}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <group ref={spinRef}>
        {/* 六角の頭 */}
        <mesh position={[0, SCREW.HEAD_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[SCREW.HEAD_RADIUS, SCREW.HEAD_RADIUS, SCREW.HEAD_HEIGHT, 6]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.35} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
        {/* 十字の溝 */}
        <mesh position={[0, SCREW.HEAD_HEIGHT + 0.006, 0]}>
          <boxGeometry args={[SCREW.HEAD_RADIUS * 1.3, 0.02, 0.07]} />
          <meshStandardMaterial color="#2b2b2b" roughness={0.8} />
        </mesh>
        <mesh position={[0, SCREW.HEAD_HEIGHT + 0.006, 0]}>
          <boxGeometry args={[0.07, 0.02, SCREW.HEAD_RADIUS * 1.3]} />
          <meshStandardMaterial color="#2b2b2b" roughness={0.8} />
        </mesh>
        {/* 軸 */}
        <mesh position={[0, -length / 2, 0]}>
          <cylinderGeometry args={[SCREW.SHAFT_RADIUS, SCREW.SHAFT_RADIUS, length, 12]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.45} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
      </group>
      {/* タップしやすくするための見えない当たり判定（頭より少し大きい程度） */}
      <mesh position={[0, SCREW.HEAD_HEIGHT / 2, 0]} visible={false}>
        <cylinderGeometry args={[SCREW.HEAD_RADIUS * 1.25, SCREW.HEAD_RADIUS * 1.25, SCREW.HEAD_HEIGHT * 1.6, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
