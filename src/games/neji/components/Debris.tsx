import { useEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

export interface DebrisBurstDef {
  id: string;
  origin: Vector3;
  color: string;
  size: number;      // パーツの大きさの目安（かけらの大きさと飛び散り方に使う）
}

interface Props {
  burst: DebrisBurstDef;
  onDone: (id: string) => void;
}

const COUNT = 14;
const LIFE_MS = 1100;
const GRAVITY = 9;

interface Fragment {
  velocity: Vector3;
  axis: Vector3;
  spin: number;
  scale: number;
}

// パーツが落ちるときに飛び散る小さなかけら（発掘感の演出）
export function DebrisBurst({ burst, onDone }: Props) {
  const meshRef = useRef<InstancedMesh>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const matrix = useMemo(() => new Matrix4(), []);
  const quat = useMemo(() => new Quaternion(), []);
  const pos = useMemo(() => new Vector3(), []);
  const scl = useMemo(() => new Vector3(), []);

  const fragments = useMemo<Fragment[]>(() => {
    const list: Fragment[] = [];
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 1.5 + Math.random() * 2.5;
      const out = (0.8 + Math.random() * 1.6) * Math.max(0.6, burst.size * 0.5);
      list.push({
        velocity: new Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
        axis: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: (Math.random() - 0.5) * 12,
        scale: (0.06 + Math.random() * 0.1) * Math.max(0.8, burst.size),
      });
    }
    return list;
  }, [burst.size]);

  const material = useMemo(() => {
    const c = new Color(burst.color);
    c.offsetHSL(0, -0.05, -0.08);
    return new MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, transparent: true });
  }, [burst.color]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const now = performance.now();
    if (startRef.current === null) startRef.current = now;
    const t = (now - startRef.current) / 1000;
    const p = Math.min(1, (now - startRef.current) / LIFE_MS);

    for (let i = 0; i < COUNT; i++) {
      const f = fragments[i];
      pos.copy(burst.origin).addScaledVector(f.velocity, t);
      pos.y -= 0.5 * GRAVITY * t * t;
      quat.setFromAxisAngle(f.axis, f.spin * t);
      scl.setScalar(f.scale * (1 - p * 0.5));
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    material.opacity = 1 - p * p;

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDone(burst.id);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
