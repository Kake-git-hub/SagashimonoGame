// 顔メッシュのデータ（三角形と、塗る絵の座標 = UV）を src/games/makeup/logic/meshData.ts に書き出す
//   三角形: @mediapipe/tasks-vision の FACE_LANDMARKS_TESSELATION（辺が 3 本ずつ三角形の順に並んでいる）
//   UV:     MediaPipe の標準の顔モデル（canonical face model）の UV。@tensorflow-models/facemesh@0.0.5 の
//           dist/uv_coords.js に入っている（Apache-2.0）。リポジトリの依存には入れていないので、パスを引数で渡す
// 使い方: node scripts/makeup/gen-mesh.mjs <uv_coords.js のパス>
// MediaPipe のモデルを入れ替えない限り、作り直す必要はない
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FaceLandmarker } from '@mediapipe/tasks-vision';

const uvPath = process.argv[2];
if (!uvPath) {
  console.error('usage: node scripts/makeup/gen-mesh.mjs <path to uv_coords.js>');
  process.exit(2);
}

// UV はプログラムとして実行せず、文字として読んで数値の組だけを取り出す
const text = fs.readFileSync(uvPath, 'utf8');
const uv = [];
for (const m of text.matchAll(/\[\s*([0-9.eE+-]+)\s*,\s*([0-9.eE+-]+)\s*\]/g)) uv.push([Number(m[1]), Number(m[2])]);
if (uv.length !== 468) throw new Error(`expected 468 uv coords, got ${uv.length}`);
if (uv.some(([u, v]) => !(u >= 0 && u <= 1 && v >= 0 && v <= 1))) throw new Error('uv out of range');

const edges = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
if (edges.length % 3 !== 0) throw new Error('tesselation is not a multiple of 3 edges');
const triangles = [];
for (let i = 0; i < edges.length; i += 3) {
  const a = edges[i], b = edges[i + 1], c = edges[i + 2];
  if (a.end !== b.start || b.end !== c.start || c.end !== a.start) throw new Error(`edges ${i}.. do not form a triangle`);
  triangles.push(a.start, b.start, c.start);
}

const r = v => Math.round(v * 10000) / 10000;
const rows = (list, perRow) => {
  const out = [];
  for (let i = 0; i < list.length; i += perRow) out.push('  ' + list.slice(i, i + perRow).join(', ') + ',');
  return out.join('\n');
};
const out = `// このファイルは scripts/makeup/gen-mesh.mjs が書き出す。手で編集しない
// 三角形: MediaPipe Face Landmarker の FACE_LANDMARKS_TESSELATION / UV: MediaPipe の標準の顔モデル（Apache-2.0）

// 顔メッシュの三角形（点の番号を 3 つずつ。${triangles.length / 3} 枚）
export const MESH_TRIANGLES: readonly number[] = [
${rows(triangles, 24)}
];

// 点ごとの UV（u, v の順に 468 点ぶん。0〜1、v は上が 0）。正面を向いた標準の顔を平らに開いたもの
export const MESH_UV: readonly number[] = [
${rows(uv.flatMap(([u, v]) => [r(u), r(v)]), 12)}
];
`;
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'games', 'makeup', 'logic', 'meshData.ts');
fs.writeFileSync(dest, out);
console.log(`wrote ${dest}: ${triangles.length / 3} triangles, ${uv.length} uv`);
