/**
 * メイクの描画（WebGL）
 * 1. 映像を canvas いっぱいに描く
 * 2. 塗ってあるレイヤーごとに、顔メッシュ（三角形の網）を今の顔の点の位置に置き、塗った絵（UV）を貼って合成する
 *    合成は乗算（リップ・チークなど）/ スクリーン（ハイライト）/ 普通（ベース）。乗算のあとに少し色を足して発色を補う
 * 映像ごと描くのは、<video> の上に乗せた要素の mix-blend-mode が iOS で効かないことがあるため。
 * 塗るものが無いときは canvas を透明にして、下の <video> をそのまま見せる。
 *
 * テクスチャ・バッファは最初に 1 回だけ作り、毎フレーム作り直さない（iOS でメモリが尽きて落ちるのを防ぐ）
 */
import { MESH_POINT_COUNT, PAINT_TRIANGLES } from '../logic/faceMesh';
import { MESH_UV } from '../logic/meshData';
import { BlendMode, LayerId } from '../logic/layers';
import { Point3 } from '../types';
import { FrameSource } from '../services/faceTracker';

export interface RenderLayer {
  id: LayerId;
  canvas: HTMLCanvasElement;  // 塗った絵（UV）
  version: number;            // 絵が変わるたびに増える番号（変わったときだけ GPU へ送り直す）
  alpha: number;              // 濃さ（0〜1）
  blend: BlendMode;
  tint: number;               // 乗算のあとに普通合成で足す割合
}

const QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const QUAD_FS = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0);
}`;

const MESH_VS = `
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos.x * 2.0 - 1.0, 1.0 - aPos.y * 2.0, 0.0, 1.0);
}`;

// uMode: 0 = 普通、1 = 乗算、2 = スクリーン。塗った絵は「色 × アルファ」（乗算済み）で入っている
const MESH_FS = `
precision mediump float;
uniform sampler2D uPaint;
uniform sampler2D uEdge;
uniform float uAlpha;
uniform float uMode;
varying vec2 vUv;
void main() {
  vec4 p = texture2D(uPaint, vUv);
  float a = p.a * uAlpha * texture2D(uEdge, vUv).a;
  vec3 c = p.a > 0.003 ? p.rgb / p.a : vec3(0.0);
  if (uMode < 0.5) {
    gl_FragColor = vec4(c * a, a);
  } else if (uMode < 1.5) {
    gl_FragColor = vec4(mix(vec3(1.0), c, a), 1.0);
  } else {
    gl_FragColor = vec4(c * a, 1.0);
  }
}`;

const ATTR_POS = 0;
const ATTR_UV = 1;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  const v = compile(gl, gl.VERTEX_SHADER, vs), f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  // 属性の番号を決めておく（プログラムごとに違う番号になると、切り替えのたびに有効・無効を合わせ直す必要がある）
  gl.bindAttribLocation(program, ATTR_POS, 'aPos');
  gl.bindAttribLocation(program, ATTR_UV, 'aUv');
  gl.linkProgram(program);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${log}`);
  }
  return program;
}

function makeTexture(gl: WebGLRenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // 2 のべき乗でない大きさ（映像）でも使えるように、端は伸ばし、ミップマップは使わない
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

interface Resources {
  quadProgram: WebGLProgram;
  quadTex: WebGLUniformLocation | null;
  meshProgram: WebGLProgram;
  uPaint: WebGLUniformLocation | null;
  uEdge: WebGLUniformLocation | null;
  uAlpha: WebGLUniformLocation | null;
  uMode: WebGLUniformLocation | null;
  quadBuffer: WebGLBuffer;
  posBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  videoTex: WebGLTexture;
  edgeTex: WebGLTexture;
}

export class MakeupRenderer {
  readonly output: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private res: Resources | null = null;
  private layerTex = new Map<LayerId, { tex: WebGLTexture; version: number }>();
  // 写真（動かない絵）は、替わったときだけ GPU へ送る
  private stillKey = '';
  private positions = new Float32Array(MESH_POINT_COUNT * 2);
  private edgeSource: HTMLCanvasElement;
  // 直前の render で映像とメイクを描いたか（保存のとき、この canvas を使えるか）
  lastDrew = false;

  /**
   * @param edge  顔の輪郭でなじませるための絵（UV、アルファ）
   */
  constructor(output: HTMLCanvasElement, edge: HTMLCanvasElement) {
    this.output = output;
    this.edgeSource = edge;
    const gl = output.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;
    if (!gl) throw new Error('webgl unavailable');
    this.gl = gl;
    // コンテキストが失われている間は何も作れない。戻ってきたとき（webglcontextrestored）に init() が呼ばれる
    if (!gl.isContextLost()) this.init();
  }

  // GPU 側のものを作る。コンテキストが失われて戻ったときにも呼ぶ
  init(): void {
    const gl = this.gl;
    this.layerTex.clear();
    this.stillKey = '';
    const quadProgram = link(gl, QUAD_VS, QUAD_FS);
    const meshProgram = link(gl, MESH_VS, MESH_FS);

    const buffer = (target: number, data: BufferSource, usage: number): WebGLBuffer => {
      const b = gl.createBuffer();
      if (!b) throw new Error('createBuffer failed');
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, usage);
      return b;
    };
    const quadBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posBuffer = buffer(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
    const uvBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(MESH_UV.slice(0, MESH_POINT_COUNT * 2)), gl.STATIC_DRAW);
    const indexBuffer = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(PAINT_TRIANGLES), gl.STATIC_DRAW);

    const videoTex = makeTexture(gl);
    const edgeTex = makeTexture(gl);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.edgeSource);

    this.res = {
      quadProgram,
      quadTex: gl.getUniformLocation(quadProgram, 'uTex'),
      meshProgram,
      uPaint: gl.getUniformLocation(meshProgram, 'uPaint'),
      uEdge: gl.getUniformLocation(meshProgram, 'uEdge'),
      uAlpha: gl.getUniformLocation(meshProgram, 'uAlpha'),
      uMode: gl.getUniformLocation(meshProgram, 'uMode'),
      quadBuffer, posBuffer, uvBuffer, indexBuffer, videoTex, edgeTex,
    };
    gl.disable(gl.DEPTH_TEST);
    // 横を向いて裏返った三角形は描かない（重なって二重に塗られないように）。
    // 塗る三角形は画面の座標系（y が下）で時計回りにそろえてあり、GL の座標系（y が上）でも時計回りに見える
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CW);
    gl.cullFace(gl.BACK);
    this.lastDrew = false;
  }

  // コンテキストが失われたら、作ったものは無効になる
  contextLost(): void {
    this.res = null;
    this.layerTex.clear();
    this.stillKey = '';
    this.lastDrew = false;
  }

  resize(w: number, h: number): void {
    if (this.output.width !== w) this.output.width = w;
    if (this.output.height !== h) this.output.height = h;
  }

  private clear(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.output.width, this.output.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * 1 フレーム描く。描くものが無ければ透明にして false を返す（下の <video> が見える）
   */
  render(source: FrameSource | null, landmarks: readonly Point3[] | null, layers: readonly RenderLayer[], hidden: boolean): boolean {
    const gl = this.gl;
    const res = this.res;
    if (!res || gl.isContextLost()) {
      this.lastDrew = false;
      return false;
    }
    const visible = layers.filter(l => l.alpha > 0);
    if (!source || hidden || visible.length === 0 || !landmarks || landmarks.length < MESH_POINT_COUNT || this.output.width === 0) {
      if (this.lastDrew || hidden) this.clear();
      this.lastDrew = false;
      return false;
    }

    gl.viewport(0, 0, this.output.width, this.output.height);

    // 映像
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, res.videoTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    // 動画は毎回送る。写真は替わったときだけ送る（同じ絵を何度も送らない）
    const stillKey = source instanceof HTMLImageElement ? `${source.currentSrc || source.src}|${source.naturalWidth}x${source.naturalHeight}` : '';
    try {
      if (!stillKey || stillKey !== this.stillKey) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        this.stillKey = stillKey;
      }
    } catch {
      // まだ映像が読めない（準備中・別オリジンなど）
      if (this.lastDrew) this.clear();
      this.lastDrew = false;
      return false;
    }
    gl.disable(gl.BLEND);
    gl.useProgram(res.quadProgram);
    gl.uniform1i(res.quadTex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.quadBuffer);
    gl.enableVertexAttribArray(ATTR_POS);
    gl.disableVertexAttribArray(ATTR_UV);
    gl.vertexAttribPointer(ATTR_POS, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.CULL_FACE);

    // 顔メッシュの点を今の位置に
    const pos = this.positions;
    for (let i = 0; i < MESH_POINT_COUNT; i++) {
      pos[i * 2] = landmarks[i].x;
      pos[i * 2 + 1] = landmarks[i].y;
    }
    gl.useProgram(res.meshProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.vertexAttribPointer(ATTR_POS, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.uvBuffer);
    gl.enableVertexAttribArray(ATTR_UV);
    gl.vertexAttribPointer(ATTR_UV, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, res.indexBuffer);
    gl.uniform1i(res.uPaint, 0);
    gl.uniform1i(res.uEdge, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, res.edgeTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

    // 使わなくなったレイヤーのテクスチャを捨てる
    for (const [id, entry] of this.layerTex) {
      if (!layers.some(l => l.id === id)) {
        gl.deleteTexture(entry.tex);
        this.layerTex.delete(id);
      }
    }

    const count = PAINT_TRIANGLES.length;
    for (const layer of visible) {
      let entry = this.layerTex.get(layer.id);
      if (!entry) {
        entry = { tex: makeTexture(gl), version: -1 };
        this.layerTex.set(layer.id, entry);
      }
      gl.bindTexture(gl.TEXTURE_2D, entry.tex);
      if (entry.version !== layer.version) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.canvas);
        entry.version = layer.version;
      }
      const alpha = Math.max(0, Math.min(1, layer.alpha));
      // どの合成でも、canvas のアルファは 1 のまま保つ
      if (layer.blend === 'multiply') {
        gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
        gl.uniform1f(res.uMode, 1);
        gl.uniform1f(res.uAlpha, alpha);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
        if (layer.tint > 0) {
          gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
          gl.uniform1f(res.uMode, 0);
          gl.uniform1f(res.uAlpha, alpha * layer.tint);
          gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
        }
      } else if (layer.blend === 'screen') {
        gl.blendFuncSeparate(gl.ONE_MINUS_DST_COLOR, gl.ONE, gl.ZERO, gl.ONE);
        gl.uniform1f(res.uMode, 2);
        gl.uniform1f(res.uAlpha, alpha);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      } else {
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
        gl.uniform1f(res.uMode, 0);
        gl.uniform1f(res.uAlpha, alpha);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      }
    }
    gl.disable(gl.BLEND);
    this.lastDrew = true;
    return true;
  }

  // 画面を離れるとき: GPU 側のものを捨てる
  dispose(): void {
    const gl = this.gl;
    const res = this.res;
    if (res && !gl.isContextLost()) {
      for (const entry of this.layerTex.values()) gl.deleteTexture(entry.tex);
      gl.deleteTexture(res.videoTex);
      gl.deleteTexture(res.edgeTex);
      gl.deleteBuffer(res.quadBuffer);
      gl.deleteBuffer(res.posBuffer);
      gl.deleteBuffer(res.uvBuffer);
      gl.deleteBuffer(res.indexBuffer);
      gl.deleteProgram(res.quadProgram);
      gl.deleteProgram(res.meshProgram);
    }
    this.layerTex.clear();
    this.res = null;
  }
}
