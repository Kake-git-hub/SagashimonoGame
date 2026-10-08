import { useEffect, useMemo, useRef } from 'react';
import { ExtrudeGeometry, Group, MeshStandardMaterial, Quaternion, Shape, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { FancyPartDef, PartDef } from '../types';
import { ANIM, PART_DEFAULT_COLOR } from '../constants';
import { partQuaternion, perpendicularBasis, toVector3, unfoldPose } from '../logic/geometry';

interface Props {
  part: PartDef;
  falling: boolean;     // 外れて落ちる / 開く アニメーション中
  unfolded: boolean;    // 展開図のパーツが開き終わって、そのまま残っている
  fallDir: Vector3;
  highlighted: boolean; // 邪魔している物として赤く光らせる
  treasure?: boolean;   // たからもの（核ブロック）: 光沢を強くする
  onFallDone: (id: string) => void;
}

// 5 つの角の星（XY 平面）
function starShape(outer: number): Shape {
  const shape = new Shape();
  const inner = outer * 0.47;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// ハート（XY 平面）。外接円の半径 r に収まる大きさ
function heartShape(r: number): Shape {
  const s = r / 1.0;
  const shape = new Shape();
  shape.moveTo(0, -s * 0.95);
  shape.bezierCurveTo(0, -s * 0.95, -s * 1.1, -s * 0.3, -s * 1.0, s * 0.25);
  shape.bezierCurveTo(-s * 0.95, s * 0.75, -s * 0.35, s * 0.95, 0, s * 0.45);
  shape.bezierCurveTo(s * 0.35, s * 0.95, s * 0.95, s * 0.75, s * 1.0, s * 0.25);
  shape.bezierCurveTo(s * 1.1, -s * 0.3, 0, -s * 0.95, 0, -s * 0.95);
  return shape;
}

// 板状の形を押し出して、厚みがローカル Y 軸方向になるよう寝かせる
function extrudeFlat(shape: Shape, thickness: number): ExtrudeGeometry {
  const bevel = Math.min(thickness * 0.25, 0.08);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(thickness - bevel * 2, 0.02),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geometry.center();
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function FancyGeometry({ part, material }: { part: FancyPartDef; material: MeshStandardMaterial }) {
  const extruded = useMemo(() => {
    if (part.shape === 'star') return extrudeFlat(starShape(part.radius), part.height);
    if (part.shape === 'heart') return extrudeFlat(heartShape(part.radius), part.height);
    return null;
  }, [part]);

  useEffect(() => () => extruded?.dispose(), [extruded]);

  switch (part.shape) {
    case 'star':
    case 'heart':
      return <mesh geometry={extruded!} material={material} />;
    case 'gem':
      // 八面体を縦に伸ばした宝石
      return (
        <mesh material={material} scale={[1, part.height / 2 / part.radius, 1]}>
          <octahedronGeometry args={[part.radius, 0]} />
        </mesh>
      );
    case 'bone': {
      // 骨: 細い軸と両端のこぶ（ローカル Y 軸方向に長い）
      const knob = part.radius;
      const half = part.height / 2 - knob * 0.8;
      const shaft = Math.max(part.height - knob * 1.6, 0.1);
      return (
        <group>
          <mesh material={material}>
            <cylinderGeometry args={[knob * 0.45, knob * 0.45, shaft, 14]} />
          </mesh>
          {[half, -half].map(y =>
            [-knob * 0.45, knob * 0.45].map(x => (
              <mesh key={`${y}:${x}`} material={material} position={[x, y, 0]}>
                <sphereGeometry args={[knob * 0.62, 18, 14]} />
              </mesh>
            )),
          )}
        </group>
      );
    }
  }
}

function PartGeometry({ part, material }: { part: PartDef; material: MeshStandardMaterial }) {
  switch (part.shape) {
    case 'box':
      return (
        <mesh material={material}>
          <boxGeometry args={part.size} />
        </mesh>
      );
    case 'cylinder':
      return (
        <mesh material={material}>
          <cylinderGeometry args={[part.radius, part.radius, part.height, part.segments ?? 32]} />
        </mesh>
      );
    case 'sphere':
      return (
        <mesh material={material}>
          <sphereGeometry args={[part.radius, 32, 24]} />
        </mesh>
      );
    default:
      return <FancyGeometry part={part} material={material} />;
  }
}

// なめらかに開く（ゆっくり始まってゆっくり止まる）
function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export function PartMesh({ part, falling, unfolded, fallDir, highlighted, treasure = false, onFallDone }: Props) {
  const groupRef = useRef<Group>(null);
  const basePosition = useMemo(() => toVector3(part.position), [part]);
  const baseQuaternion = useMemo(() => partQuaternion(part), [part]);
  const tumbleAxis = useMemo(() => perpendicularBasis(fallDir)[0], [fallDir]);
  const hinges = part.unfold;
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  // 複数メッシュ（骨など）で共有するマテリアル
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: part.color ?? PART_DEFAULT_COLOR,
        roughness: treasure ? 0.2 : 0.55,
        metalness: treasure ? 0.55 : 0.08,
      }),
    [part.color, treasure],
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.emissive.set(highlighted ? '#ff1a1a' : treasure ? (part.color ?? PART_DEFAULT_COLOR) : '#000000');
    material.emissiveIntensity = highlighted ? 1.0 : treasure ? 0.18 : 0;
  }, [material, highlighted, treasure, part.color]);

  // アニメーション中でなければ、元の姿勢（または開き終わった姿勢）に置く
  useEffect(() => {
    if (falling) return;
    startRef.current = null;
    doneRef.current = false;
    const group = groupRef.current;
    if (group) {
      if (unfolded && hinges) {
        const pose = unfoldPose(part, hinges, 1);
        group.position.copy(pose.position);
        group.quaternion.copy(pose.quaternion);
      } else {
        group.position.copy(basePosition);
        group.quaternion.copy(baseQuaternion);
      }
    }
    material.transparent = false;
    material.opacity = 1;
  }, [falling, unfolded, hinges, part, basePosition, baseQuaternion, material]);

  useFrame(() => {
    if (!falling) return;
    const group = groupRef.current;
    if (!group) return;

    const now = performance.now();
    if (startRef.current === null) {
      startRef.current = now;
      material.transparent = !hinges;
    }

    if (hinges) {
      // 展開図: ちょうつがいで順に開く。開いたあとは消えずに残る
      const p = Math.min(1, (now - startRef.current) / ANIM.UNFOLD_MS);
      const pose = unfoldPose(part, hinges, easeInOut(p));
      group.position.copy(pose.position);
      group.quaternion.copy(pose.quaternion);
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        onFallDone(part.id);
      }
      return;
    }

    const p = Math.min(1, (now - startRef.current) / ANIM.FALL_MS);

    // 外向きに押し出されつつ、重力で加速しながら落ちる
    group.position
      .copy(basePosition)
      .addScaledVector(fallDir, p * 1.2)
      .add(new Vector3(0, -7 * p * p, 0));
    group.quaternion.copy(baseQuaternion).multiply(new Quaternion().setFromAxisAngle(tumbleAxis, p * 1.4));
    material.opacity = 1 - p * p;

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onFallDone(part.id);
    }
  });

  return (
    <group ref={groupRef} position={basePosition} quaternion={baseQuaternion}>
      <PartGeometry part={part} material={material} />
    </group>
  );
}
