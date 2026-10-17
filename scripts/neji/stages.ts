/**
 * 生成で作るステージの定義（npm run gen:neji）
 * 形だけを決める。色は logic/colorize.ts が混ぜて決める
 *
 * 置き方の約束（docs/ネジはずし開発ガイド.md の「レシピ」も参照）:
 * - ふた（覆い）の下のネジは、頭の高さ 0.2 + すきま 0.25 を空ける。ふたのネジは下のネジから横に 0.6 以上ずらす
 * - 貫くパーツは partIds に全部書く（先頭は頭が乗っているパーツ）
 * - 平行なネジの頭同士は 0.6 以上、軸同士は 0.24 以上はなす
 */
import { PartDef, ScrewDef } from '../../src/games/neji/types';
import { BACK, box, buildDig, cyl, DOWN, fancy, FRONT, LEFT, RIGHT, screw, sph, StageSpec, UP, v } from './lib';

// === ちょうちょ: 後ろのはね → 前のはね → もよう の 3 層 ===
function butterfly(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  parts.push(box('body', [1.0, 4.6, 0.6], [0, 0.2, 0], '#4a3b8f', { fixed: true }));
  parts.push(sph('head', 0.75, [0, 2.95, 0], '#5b48a8'));
  parts.push(cyl('antL', 0.08, 1.3, [-0.45, 3.9, 0], '#5b48a8', { rotation: [0, 0, 25] }));
  parts.push(cyl('antR', 0.08, 1.3, [0.45, 3.9, 0], '#5b48a8', { rotation: [0, 0, -25] }));
  screws.push(screw('head', [0, 3.7, 0], UP, 1.5, ['head', 'antL', 'antR', 'body']));

  for (const [side, sx] of [['L', -1], ['R', 1]] as const) {
    // 後ろのはね（下）
    parts.push(box(`wH${side}`, [2.8, 2.4, 0.4], v(sx * 1.9, -0.9, 0), side === 'L' ? '#ff9f1c' : '#ffbf47'));
    screws.push(screw(`h${side}1`, v(sx * 2.4, -0.1, 0.2), FRONT, 0.4, [`wH${side}`]));   // 前のはねの下に隠れる
    screws.push(screw(`h${side}2`, v(sx * 2.6, -1.5, -0.2), BACK, 0.4, [`wH${side}`]));   // うらがわ
    // 前のはね（上。0.25 浮かせて後ろのはねと胴を覆う）
    parts.push(box(`wF${side}`, [3.1, 2.8, 0.4], v(sx * 1.95, 0.9, 0.75), side === 'L' ? '#ff5d8f' : '#ff7fa8'));
    screws.push(screw(`f${side}1`, v(sx * 1.0, -0.1, 0.95), FRONT, 1.15, [`wF${side}`, `wH${side}`]));
    screws.push(screw(`f${side}2`, v(sx * 0.9, 2.0, 0.95), FRONT, 1.15, [`wF${side}`]));
    screws.push(screw(`f${side}3`, v(sx * 2.85, 0.6, 0.95), FRONT, 1.15, [`wF${side}`]));  // もようの下に隠れる
    // もよう（まるい板。はねから 0.25 浮かせる）
    parts.push(cyl(`spot${side}1`, 0.8, 0.3, v(sx * 2.2, 0.6, 1.35), '#ffffff', { rotation: [90, 0, 0] }));
    screws.push(screw(`s${side}1`, v(sx * 2.2, 0.6, 1.5), FRONT, 0.95, [`spot${side}1`, `wF${side}`]));
    parts.push(cyl(`spot${side}2`, 0.6, 0.3, v(sx * 1.6, 1.6, 1.35), '#fff3b0', { rotation: [90, 0, 0] }));
    screws.push(screw(`s${side}2`, v(sx * 1.6, 1.6, 1.5), FRONT, 0.95, [`spot${side}2`, `wF${side}`]));
  }
  // 胴
  screws.push(screw('bodyF', [0, 0.5, 0.3], FRONT, 0.5, ['body']));
  screws.push(screw('bodyK', [0, -0.4, -0.3], BACK, 0.5, ['body']));
  screws.push(screw('bodyB', [0, -2.1, 0], DOWN, 1.0, ['body']));
  return { id: 'stage-23', name: 'ちょうちょ', emoji: '🦋', difficulty: 4, parts, screws };
}

// === ひこうき: つばさの下・エンジン・車輪 ===
function airplane(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  parts.push(box('fuse', [6, 1.2, 1.2], [0, 0, 0], '#f1f3f5', { fixed: true }));
  parts.push(cyl('nose', 0.6, 0.8, [3.4, 0, 0], '#e63946', { rotation: [0, 0, 90] }));
  parts.push(box('propV', [0.25, 2.4, 0.15], [3.95, 0, 0], '#495057'));
  parts.push(box('propH', [0.25, 0.15, 2.4], [3.95, 0, 0], '#495057'));
  screws.push(screw('prop', [4.08, 0, 0], RIGHT, 1.5, ['propV', 'propH', 'nose', 'fuse']));
  screws.push(screw('noseT', [3.4, 0.6, 0], UP, 0.3, ['nose']));
  // 主翼（胴から 0.25 浮かせる。下に胴のネジ）
  parts.push(box('wing', [1.6, 0.3, 7], [0.3, 1.0, 0], '#4cc9f0'));
  screws.push(screw('wing1', [0.3, 1.15, 1.2], UP, 1.05, ['wing', 'fuse']));
  screws.push(screw('wing2', [0.3, 1.15, -1.2], UP, 1.05, ['wing', 'fuse']));
  screws.push(screw('wing3', [0.3, 1.15, 3.0], UP, 0.3, ['wing']));
  screws.push(screw('wing4', [0.3, 1.15, -3.0], UP, 0.3, ['wing']));
  screws.push(screw('under1', [0.3, 0.6, 0.3], UP, 0.8, ['fuse']));
  screws.push(screw('under2', [0.3, 0.6, -0.3], UP, 0.8, ['fuse']));
  // エンジン（つばさの下に吊る）
  parts.push(cyl('engL', 0.4, 1.4, [0.3, 0.45, 2.0], '#adb5bd', { rotation: [0, 0, 90] }));
  parts.push(cyl('engR', 0.4, 1.4, [0.3, 0.45, -2.0], '#adb5bd', { rotation: [0, 0, 90] }));
  screws.push(screw('engL', [0.3, 0.05, 2.0], DOWN, 1.1, ['engL', 'wing']));
  screws.push(screw('engR', [0.3, 0.05, -2.0], DOWN, 1.1, ['engR', 'wing']));
  // 尾翼: 水平尾翼の上に垂直尾翼
  parts.push(box('stab', [1.0, 0.25, 3], [-2.6, 0.725, 0], '#4cc9f0'));
  parts.push(box('fin', [1.2, 1.4, 0.3], [-2.5, 1.55, 0], '#e63946'));
  screws.push(screw('finT', [-2.5, 2.25, 0], UP, 1.9, ['fin', 'stab', 'fuse']));
  screws.push(screw('finS', [-2.1, 1.3, 0.15], FRONT, 0.3, ['fin']));
  screws.push(screw('stabL', [-2.6, 0.85, 1.1], UP, 1.0, ['stab', 'fuse']));
  screws.push(screw('stabR', [-2.6, 0.85, -1.1], UP, 1.0, ['stab', 'fuse']));
  // 操縦席の窓
  parts.push(box('cockpit', [1.2, 0.5, 0.9], [1.8, 0.85, 0], '#90e0ef'));
  screws.push(screw('cockpit', [1.8, 1.1, 0], UP, 1.0, ['cockpit', 'fuse']));
  // 車輪
  parts.push(box('strut', [0.3, 0.5, 1.2], [1.0, -0.8, 0], '#495057'));
  parts.push(cyl('wheelL', 0.45, 0.3, [1.0, -1.0, 0.75], '#212529', { rotation: [90, 0, 0] }));
  parts.push(cyl('wheelR', 0.45, 0.3, [1.0, -1.0, -0.75], '#212529', { rotation: [90, 0, 0] }));
  screws.push(screw('strut', [1.0, -1.05, 0], DOWN, 1.0, ['strut', 'fuse']));
  screws.push(screw('wheelL', [1.0, -1.0, 0.9], FRONT, 0.4, ['wheelL', 'strut']));
  screws.push(screw('wheelR', [1.0, -1.0, -0.9], BACK, 0.4, ['wheelR', 'strut']));
  // 胴
  screws.push(screw('tail', [-3.0, 0, 0], LEFT, 1.0, ['fuse']));
  screws.push(screw('sideF', [-1.5, 0.25, 0.6], FRONT, 0.5, ['fuse']));
  screws.push(screw('sideK', [-1.5, -0.25, -0.6], BACK, 0.5, ['fuse']));
  return { id: 'stage-24', name: 'ひこうき', emoji: '✈️', difficulty: 4, parts, screws };
}

// === ふね: 船体 → 甲板 → 船室 → ブリッジ の層。船底にもネジ ===
function ship(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  parts.push(box('hull', [6, 1.2, 2.4], [0, 0, 0], '#1d3557', { fixed: true }));
  parts.push(box('bow', [1.0, 1.2, 1.4], [3.5, 0, 0], '#1d3557'));
  screws.push(screw('bow', [4.0, 0, 0], RIGHT, 1.4, ['bow', 'hull']));
  // 甲板（船体から 0.25 浮かせる。下に船体のネジ）
  parts.push(box('deck', [5.6, 0.3, 2.2], [0, 1.0, 0], '#c9a66b'));
  screws.push(screw('deck1', [2.3, 1.15, 0.7], UP, 1.05, ['deck', 'hull']));
  screws.push(screw('deck2', [2.3, 1.15, -0.7], UP, 1.05, ['deck', 'hull']));
  screws.push(screw('deck3', [-2.4, 1.15, -0.7], UP, 1.05, ['deck', 'hull']));
  screws.push(screw('hullU1', [1.2, 0.6, 0.7], UP, 0.8, ['hull']));
  screws.push(screw('hullU2', [-1.3, 0.6, -0.7], UP, 0.8, ['hull']));
  // 船室（甲板の上）とブリッジ（船室の上）
  parts.push(box('cabin', [2.2, 1.2, 1.5], [-0.5, 1.75, 0], '#f8f9fa'));
  screws.push(screw('cabin1', [0.3, 2.35, 0.45], UP, 1.55, ['cabin', 'deck']));
  screws.push(screw('cabin2', [0.3, 2.35, -0.45], UP, 1.55, ['cabin', 'deck']));
  parts.push(box('bridge', [1.2, 0.8, 1.0], [-0.7, 2.75, 0], '#ffb703'));
  screws.push(screw('bridge', [-0.7, 3.15, 0], UP, 1.6, ['bridge', 'cabin']));
  screws.push(screw('cabinF', [0.0, 1.75, 0.75], FRONT, 0.8, ['cabin']));
  // えんとつ（船室の後ろ）
  parts.push(cyl('funnel', 0.35, 1.3, [-2.2, 1.8, 0], '#e63946'));
  screws.push(screw('funnel', [-2.2, 2.45, 0], UP, 1.9, ['funnel', 'deck', 'hull']));
  // マストと旗（船首側）
  parts.push(cyl('mast', 0.22, 2.6, [2.0, 2.3, 0], '#8d6e63'));
  parts.push(box('flag', [1.0, 0.6, 0.1], [2.65, 3.2, 0], '#2a9d8f'));
  screws.push(screw('mast', [2.0, 3.6, 0], UP, 2.6, ['mast', 'deck', 'hull']));
  screws.push(screw('flag', [2.75, 3.2, 0.05], FRONT, 0.1, ['flag']));
  // 救命ボート（左右の側面に吊る）
  parts.push(cyl('boatF', 0.3, 1.2, [-0.5, 0.9, 1.45], '#ff8c1a', { rotation: [0, 0, 90] }));
  parts.push(cyl('boatK', 0.3, 1.2, [0.8, 0.9, -1.45], '#ff8c1a', { rotation: [0, 0, 90] }));
  screws.push(screw('boatF', [-0.5, 0.9, 1.75], FRONT, 1.2, ['boatF', 'deck']));
  screws.push(screw('boatK', [0.8, 0.9, -1.75], BACK, 1.2, ['boatK', 'deck']));
  // 船底・船尾
  screws.push(screw('keel1', [1.5, -0.6, 0], DOWN, 1.0, ['hull']));
  screws.push(screw('keel2', [-1.5, -0.6, 0], DOWN, 1.0, ['hull']));
  screws.push(screw('stern', [-3.0, 0, 0], LEFT, 1.0, ['hull']));
  screws.push(screw('sideF', [0.4, -0.2, 1.2], FRONT, 1.0, ['hull']));
  screws.push(screw('sideK', [-0.6, -0.2, -1.2], BACK, 1.0, ['hull']));
  screws.push(screw('sideF2', [-2.0, 0.3, 1.2], FRONT, 1.0, ['hull']));
  return { id: 'stage-25', name: 'ふね', emoji: '🚢', difficulty: 5, parts, screws };
}

// === きしゃ: 車輪をつなぐ棒が車輪のネジをふさぐ。屋根の下に運転室のネジ ===
function train(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  parts.push(box('chassis', [6, 0.6, 2.0], [0, 0, 0], '#343a40', { fixed: true }));
  parts.push(cyl('boiler', 0.9, 3.6, [1.0, 1.2, 0], '#2a9d8f', { rotation: [0, 0, 90] }));
  parts.push(box('cab', [1.8, 2.2, 2.0], [-2.0, 1.4, 0], '#e9c46a'));
  parts.push(box('roof', [2.2, 0.3, 2.4], [-2.0, 2.9, 0], '#e63946'));
  screws.push(screw('roof1', [-2.0, 3.05, 0.9], UP, 1.15, ['roof', 'cab']));
  screws.push(screw('roof2', [-2.0, 3.05, -0.9], UP, 1.15, ['roof', 'cab']));
  screws.push(screw('cabT1', [-2.5, 2.5, 0.4], UP, 1.0, ['cab']));
  screws.push(screw('cabT2', [-1.5, 2.5, -0.4], UP, 1.0, ['cab']));
  screws.push(screw('cabK', [-2.9, 1.4, 0], LEFT, 1.0, ['cab']));
  screws.push(screw('cabF', [-2.0, 0.8, 1.0], FRONT, 1.0, ['cab']));
  // えんとつ・ドーム・ライト
  parts.push(cyl('chimney', 0.35, 1.0, [2.3, 2.6, 0], '#212529'));
  screws.push(screw('chimney', [2.3, 3.1, 0], UP, 1.6, ['chimney', 'boiler']));
  parts.push(cyl('dome', 0.45, 0.5, [0.8, 2.35, 0], '#f4a261'));
  screws.push(screw('dome', [0.8, 2.6, 0], UP, 1.2, ['dome', 'boiler']));
  parts.push(cyl('lamp', 0.3, 0.3, [2.95, 1.6, 0], '#ffd60a', { rotation: [0, 0, 90] }));
  screws.push(screw('lamp', [3.1, 1.6, 0], RIGHT, 0.5, ['lamp', 'boiler']));
  screws.push(screw('boilerT', [1.6, 2.1, 0], UP, 1.0, ['boiler']));
  screws.push(screw('boilerK', [0.4, 1.2, -0.9], BACK, 0.8, ['boiler']));
  // 車輪 3 × 2 と、それをつなぐ棒（棒のかげに車輪のネジ）
  for (const [side, sz] of [['F', 1], ['K', -1]] as const) {
    for (const [i, x] of [-1.8, 0.0, 1.8].entries()) {
      parts.push(cyl(`wheel${side}${i}`, 0.7, 0.3, v(x, -0.2, sz * 1.15), '#6c757d', { rotation: [90, 0, 0] }));
      screws.push(screw(`axle${side}${i}`, v(x, -0.2, sz * 1.3), sz > 0 ? FRONT : BACK, 0.6, [`wheel${side}${i}`, 'chassis']));
    }
    parts.push(box(`rod${side}`, [4.4, 0.25, 0.15], v(0, -0.2, sz * 1.625), '#e63946'));
    screws.push(screw(`rod${side}1`, v(-0.9, -0.2, sz * 1.7), sz > 0 ? FRONT : BACK, 0.5, [`rod${side}`]));
    screws.push(screw(`rod${side}2`, v(0.9, -0.2, sz * 1.7), sz > 0 ? FRONT : BACK, 0.5, [`rod${side}`]));
  }
  // 前の排障器と底
  parts.push(box('cow', [0.6, 0.9, 2.2], [3.3, 0.15, 0], '#e63946'));
  screws.push(screw('cow', [3.6, 0.15, 0], RIGHT, 1.0, ['cow', 'chassis']));
  screws.push(screw('bottom1', [-0.9, -0.3, 0], DOWN, 0.6, ['chassis']));
  screws.push(screw('bottom2', [0.9, -0.3, 0], DOWN, 0.6, ['chassis']));
  return { id: 'stage-26', name: 'きしゃ', emoji: '🚂', difficulty: 4, parts, screws };
}

// === くま: 球を組み合わせる。おなかのもようの下にネジ ===
function bear(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  parts.push(sph('body', 1.5, [0, 0, 0], '#a9714b', { fixed: true }));
  parts.push(sph('head', 1.1, [0, 2.2, 0], '#b07a52'));
  screws.push(screw('head', [0, 3.3, 0], UP, 2.0, ['head', 'body']));
  parts.push(cyl('earL', 0.4, 0.3, [-1.05, 3.1, 0], '#8c5a3c', { rotation: [90, 0, 0] }));
  parts.push(cyl('earR', 0.4, 0.3, [1.05, 3.1, 0], '#8c5a3c', { rotation: [90, 0, 0] }));
  screws.push(screw('earL', [-1.05, 3.1, 0.15], FRONT, 0.3, ['earL']));
  screws.push(screw('earR', [1.05, 3.1, 0.15], FRONT, 0.3, ['earR']));
  parts.push(cyl('snout', 0.5, 0.4, [0, 2.0, 1.1], '#e8c39e', { rotation: [90, 0, 0] }));
  screws.push(screw('snout', [0, 2.0, 1.3], FRONT, 1.0, ['snout', 'head']));
  parts.push(sph('pawL', 0.55, [-1.6, 0.2, 0.6], '#8c5a3c'));
  parts.push(sph('pawR', 0.55, [1.6, 0.2, 0.6], '#8c5a3c'));
  screws.push(screw('pawL', [-2.15, 0.2, 0.6], LEFT, 1.4, ['pawL', 'body']));
  screws.push(screw('pawR', [2.15, 0.2, 0.6], RIGHT, 1.4, ['pawR', 'body']));
  parts.push(sph('legL', 0.6, [-0.8, -1.4, 0.5], '#8c5a3c'));
  parts.push(sph('legR', 0.6, [0.8, -1.4, 0.5], '#8c5a3c'));
  screws.push(screw('legL', [-0.8, -2.0, 0.5], DOWN, 1.4, ['legL', 'body']));
  screws.push(screw('legR', [0.8, -2.0, 0.5], DOWN, 1.4, ['legR', 'body']));
  // おなかのもよう（0.25 浮かせる）。その下に胴のネジ
  parts.push(cyl('belly', 0.7, 0.3, [0, -0.1, 1.9], '#e8c39e', { rotation: [90, 0, 0] }));
  screws.push(screw('belly', [0, -0.1, 2.05], FRONT, 1.05, ['belly', 'body']));
  screws.push(screw('hidden', [-0.45, 0.35, 1.39], FRONT, 0.8, ['body']));
  screws.push(screw('back1', [0, 0, -1.5], BACK, 1.0, ['body']));
  screws.push(screw('back2', [0, -0.8, -1.27], BACK, 1.0, ['body']));
  return { id: 'stage-27', name: 'くま', emoji: '🐻', difficulty: 2, parts, screws };
}

// === とけい: 土台 → 文字盤 → 針 → 中心のネジ 1 本が 5 つを貫く ===
function clock(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  const polar = (r: number, deg: number): [number, number] => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  parts.push(cyl('base', 3.0, 0.5, [0, 0, 0], '#8d6e63', { rotation: [90, 0, 0], fixed: true }));
  parts.push(cyl('dial', 2.6, 0.3, [0, 0, 0.65], '#fffaf0', { rotation: [90, 0, 0] }));
  for (const [i, deg] of [30, 120, 210, 300].entries()) {
    const [x, y] = polar(2.3, deg);
    screws.push(screw(`dial${i}`, v(x, y, 0.8), FRONT, 0.95, ['dial', 'base']));
  }
  for (const [i, deg] of [45, 135, 225, 315].entries()) {
    const [x, y] = polar(1.9, deg);
    screws.push(screw(`baseH${i}`, v(x, y, 0.25), FRONT, 0.8, ['base']));
  }
  for (const [i, deg] of [90, 0, 270, 180].entries()) {
    const [x, y] = polar(2.0, deg);
    parts.push(box(`num${i}`, [0.5, 0.5, 0.3], v(x, y, 0.95), '#1d3557'));
    screws.push(screw(`num${i}`, v(x, y, 1.1), FRONT, 0.7, [`num${i}`, 'dial']));
  }
  parts.push(box('minute', [0.4, 1.9, 0.2], [0, 0.65, 0.95], '#1d3557'));
  parts.push(box('hour', [1.6, 0.4, 0.2], [0.6, 0, 1.15], '#e63946'));
  parts.push(cyl('hub', 0.45, 0.3, [0, 0, 1.4], '#ffb703', { rotation: [90, 0, 0] }));
  screws.push(screw('center', [0, 0, 1.55], FRONT, 1.55, ['hub', 'hour', 'minute', 'dial', 'base']));
  screws.push(screw('minuteT', [0, 1.3, 1.05], FRONT, 0.55, ['minute', 'dial']));
  screws.push(screw('hourT', [1.25, 0, 1.25], FRONT, 0.75, ['hour', 'dial']));
  screws.push(screw('dialH', [0.62, 0, 0.8], FRONT, 0.3, ['dial']));
  // ふりこ
  parts.push(box('rod', [0.2, 2.0, 0.2], [0, -3.8, 0], '#495057'));
  parts.push(cyl('bob', 0.5, 0.3, [0, -5.1, 0], '#ffb703', { rotation: [90, 0, 0] }));
  screws.push(screw('pendulum', [0, -5.6, 0], DOWN, 2.9, ['bob', 'rod', 'base']));
  for (const [i, deg] of [45, 135, 225, 315].entries()) {
    const [x, y] = polar(2.4, deg);
    screws.push(screw(`back${i}`, v(x, y, -0.25), BACK, 0.45, ['base']));
  }
  return { id: 'stage-28', name: 'とけい', emoji: '🕰️', difficulty: 5, parts, screws };
}

// === さかな: しましまの下に胴のネジ、目の下にしまのネジ ===
function fish(): StageSpec {
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  parts.push(box('body', [4.6, 2.4, 0.6], [0.4, 0, 0], '#4cc9f0', { fixed: true }));
  parts.push(box('tail', [1.3, 1.3, 0.5], [-2.5, 0, 0], '#4895ef', { rotation: [0, 0, 45] }));
  screws.push(screw('tailF', [-2.5, 0.3, 0.25], FRONT, 0.5, ['tail']));
  screws.push(screw('tailK', [-2.5, -0.3, -0.25], BACK, 0.5, ['tail']));
  for (const [i, x] of [-1.0, 0.1, 1.2].entries()) {
    parts.push(box(`stripe${i}`, [0.6, 2.0, 0.3], v(x, 0, 0.7), i % 2 === 0 ? '#f72585' : '#ffb703'));
    const sy = i === 2 ? 0.5 : -0.5;
    screws.push(screw(`stripe${i}`, v(x, sy, 0.85), FRONT, 1.05, [`stripe${i}`, 'body']));
    screws.push(screw(`under${i}`, v(x, -sy, 0.3), FRONT, 0.5, ['body']));
  }
  parts.push(cyl('eye', 0.8, 0.3, [1.8, 0.6, 1.25], '#ffffff', { rotation: [90, 0, 0] }));
  screws.push(screw('eye', [1.8, 0.6, 1.4], FRONT, 1.4, ['eye', 'body']));
  parts.push(box('finT', [1.6, 0.8, 0.4], [0.0, 1.6, 0], '#4895ef'));
  screws.push(screw('finT', [0, 2.0, 0], UP, 1.2, ['finT', 'body']));
  parts.push(box('finB', [1.2, 0.7, 0.4], [0.3, -1.55, 0], '#4895ef'));
  screws.push(screw('finB', [0.6, -1.9, 0], DOWN, 1.1, ['finB', 'body']));
  for (const [i, x] of [-1.0, 0.1, 1.2].entries()) {
    screws.push(screw(`back${i}`, v(x, -1.0, -0.3), BACK, 0.5, ['body']));
  }
  screws.push(screw('mouth', [2.7, 0, 0], RIGHT, 1.0, ['body']));
  return { id: 'stage-29', name: 'しましまの さかな', emoji: '🐟', difficulty: 3, parts, screws };
}

// === 発掘ステージ ===
function digEgg(): StageSpec {
  return buildDig({
    id: 'stage-30', name: 'たまごのはっくつ', emoji: '🥚', difficulty: 3,
    treasure: { id: 'egg', name: 'きょうりゅうのたまご', emoji: '🥚', parts: [fancy('egg', 'egg', 0.75, 1.5, [0, 0, 0], '#f4f1de')] },
    cell: [2.0, 2.0], depth: 1.6, cols: 3, rows: 3,
    blockColors: ['#c9a66b', '#d4b483', '#bf9b5f', '#caa472'],
    lidColor: '#a67c52',
    lids: { front: true, back: true, top: true },
    stones: { color: '#8d99ae', count: 2 },
  });
}

function digCrown(): StageSpec {
  return buildDig({
    id: 'stage-31', name: 'おうかんのはっくつ', emoji: '👑', difficulty: 4,
    treasure: { id: 'crown', name: 'おうさまの おうかん', emoji: '👑', parts: [fancy('crown', 'crown', 0.85, 1.2, [0, 0, 0], '#ffd166')] },
    cell: [2.0, 2.0], depth: 1.6, cols: 3, rows: 3,
    blockColors: ['#6c757d', '#868e96', '#5c636a', '#7d868f'],
    lidColor: '#495057',
    lids: { front: true, back: true, top: true, bottom: true },
    stones: { color: '#adb5bd', count: 2 },
  });
}

function digRing(): StageSpec {
  return buildDig({
    id: 'stage-32', name: 'ゆびわのはっくつ', emoji: '💍', difficulty: 4,
    treasure: {
      id: 'ring', name: 'ほうせきの ゆびわ', emoji: '💍',
      parts: [
        fancy('ring', 'ring', 0.8, 0.3, [0, -0.2, 0], '#ffd700', { rotation: [90, 0, 0] }),
        fancy('ringGem', 'gem', 0.35, 0.6, [0, 0.75, 0], '#ff4d6d'),
      ],
    },
    cell: [2.0, 2.0], depth: 1.6, cols: 3, rows: 3,
    blockColors: ['#9c6644', '#b08968', '#7f5539', '#a37b5c'],
    lidColor: '#6f4e37',
    lids: { front: true, back: true, bottom: true },
    planks: 3,
    stones: { color: '#8d99ae', count: 3 },
  });
}

function digCoins(): StageSpec {
  return buildDig({
    id: 'stage-33', name: 'きんかのはっくつ', emoji: '🪙', difficulty: 5,
    treasure: {
      id: 'coins', name: 'かいぞくの きんか', emoji: '🪙',
      parts: [
        cyl('coin0', 0.75, 0.22, [0, -0.5, 0], '#ffd700'),
        cyl('coin1', 0.75, 0.22, [0.15, -0.26, 0.1], '#f5c518', { rotation: [0, 20, 0] }),
        cyl('coin2', 0.75, 0.22, [-0.1, -0.02, -0.05], '#ffd700', { rotation: [0, 50, 0] }),
        cyl('coin3', 0.75, 0.22, [0.05, 0.22, 0.12], '#f5c518', { rotation: [0, 75, 0] }),
        cyl('coin4', 0.75, 0.22, [-0.05, 0.46, -0.08], '#ffd700', { rotation: [0, 100, 0] }),
      ],
    },
    cell: [2.0, 2.0], depth: 1.6, cols: 3, rows: 3,
    blockColors: ['#e9c46a', '#f1d58c', '#d9b25a', '#e6c87a'],
    lidColor: '#8d6e63',
    lids: { front: true, back: true, top: true, bottom: true },
    planks: 2,
    stones: { color: '#6c757d', count: 3 },
  });
}

function digShell(): StageSpec {
  return buildDig({
    id: 'stage-34', name: 'アンモナイトのはっくつ', emoji: '🐚', difficulty: 5,
    treasure: { id: 'shell', name: 'アンモナイトの かせき', emoji: '🐚', parts: [fancy('shell', 'shell', 0.85, 0.5, [0, 0, 0], '#c9b79c', { rotation: [90, 0, 0] })] },
    cell: [2.0, 2.0], depth: 1.6, cols: 3, rows: 5, coreRows: 1,
    blockColors: ['#6c757d', '#5c636a', '#7d868f', '#868e96'],
    lidColor: '#3f474e',
    lids: { front: true, back: true, top: true, bottom: true },
    stones: { color: '#adb5bd', count: 3 },
  });
}

export const NEW_STAGES: (() => StageSpec)[] = [butterfly, airplane, ship, train, bear, clock, fish, digEgg, digCrown, digRing, digCoins, digShell];
