import { useEffect, useMemo, useRef } from 'react';
import { Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { PartDef } from '../types';
import { ANIM, PART_DEFAULT_COLOR } from '../constants';
import { partQuaternion, perpendicularBasis, toVector3 } from '../logic/geometry';

interface Props {
  part: PartDef;
  falling: boolean;
  fallDir: Vector3;
  highlighted: boolean; // 邪魔している物として赤く光らせる
  onFallDone: (id: string) => void;
}

function PartGeometry({ part }: { part: PartDef }) {
  switch (part.shape) {
    case 'box':
      return <boxGeometry args={part.size} />;
    case 'cylinder':
      return <cylinderGeometry args={[part.radius, part.radius, part.height, 32]} />;
    case 'sphere':
      return <sphereGeometry args={[part.radius, 32, 24]} />;
  }
}

export function PartMesh({ part, falling, fallDir, highlighted, onFallDone }: Props) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const basePosition = useMemo(() => toVector3(part.position), [part]);
  const baseQuaternion = useMemo(() => partQuaternion(part), [part]);
  const tumbleAxis = useMemo(() => perpendicularBasis(fallDir)[0], [fallDir]);
  const fallStartRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (falling) return;
    fallStartRef.current = null;
    doneRef.current = false;
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (mesh) {
      mesh.position.copy(basePosition);
      mesh.quaternion.copy(baseQuaternion);
    }
    if (material) {
      material.transparent = false;
      material.opacity = 1;
    }
  }, [falling, basePosition, baseQuaternion]);

  useFrame(() => {
    if (!falling) return;
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const now = performance.now();
    if (fallStartRef.current === null) {
      fallStartRef.current = now;
      material.transparent = true;
    }
    const p = Math.min(1, (now - fallStartRef.current) / ANIM.FALL_MS);

    // 外向きに押し出されつつ、重力で加速しながら落ちる
    mesh.position
      .copy(basePosition)
      .addScaledVector(fallDir, p * 1.2)
      .add(new Vector3(0, -7 * p * p, 0));
    mesh.quaternion.copy(baseQuaternion).multiply(new Quaternion().setFromAxisAngle(tumbleAxis, p * 1.4));
    material.opacity = 1 - p * p;

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onFallDone(part.id);
    }
  });

  return (
    <mesh ref={meshRef} position={basePosition} quaternion={baseQuaternion}>
      <PartGeometry part={part} />
      <meshStandardMaterial
        ref={materialRef}
        color={part.color ?? PART_DEFAULT_COLOR}
        roughness={0.55}
        metalness={0.08}
        emissive={highlighted ? '#ff2a2a' : '#000000'}
        emissiveIntensity={highlighted ? 0.55 : 0}
      />
    </mesh>
  );
}
