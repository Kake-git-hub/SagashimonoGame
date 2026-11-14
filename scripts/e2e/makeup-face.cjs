// マジックメイクミラー: 顔のある映像で顔認識と「なぞって塗る」が動くか
//   1. 偽カメラ（顔写真から作った y4m、鏡像）で 顔が見つかる（478 点）→ 頬をなぞる → なぞった側の頬だけ色が変わる
//   2. 近づいた映像（顔の幅が映像の短い辺の 1.7 倍）でも顔が見つかり（余白つきの認識に切り替わる）、塗れる
//   3. しゃしんモード: 色を選んだだけでは付かない → 唇をなぞる（はみださない）→ じゆうに ぬる → けしゴム → ほぞん → ぜんぶ けす
//      → おしえて（できあがりを みる / もとに もどす）→ ていあん。Safari と同じく canvas の filter が無い状態で動かし、
//      描画中に canvas を作り続けていないこと（iPad で落ちた原因）も確かめる
//      点群を fixture に書き出す（E2E_WRITE_FIXTURE=1 のとき）
// テスト用の顔写真は MediaPipe のサンプル画像をダウンロードして使う（リポジトリには入れない）
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const { launch, gotoHome, report, OUT } = require('./common.cjs');

const ASSETS = path.join(__dirname, 'assets');
const PORTRAIT_URL = 'https://storage.googleapis.com/mediapipe-assets/portrait.jpg';
const PORTRAIT = path.join(ASSETS, 'portrait.jpg');
const PORTRAIT_Y4M = path.join(ASSETS, 'portrait.y4m');
const CLOSE_Y4M = path.join(ASSETS, 'portrait-close.y4m');
// 近づいた映像: 顔の幅が映像の短い辺の何倍か
const CLOSE_RATIO = 1.7;
const FIXTURE = path.join(__dirname, '..', '..', 'src', 'games', 'makeup', 'logic', 'fixtures', 'portrait-frame.json');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode !== 200) { reject(new Error(`download ${url}: ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function ensureAssets() {
  fs.mkdirSync(ASSETS, { recursive: true });
  if (!fs.existsSync(PORTRAIT)) await download(PORTRAIT_URL, PORTRAIT);
  if (!fs.existsSync(PORTRAIT_Y4M)) {
    try {
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', PORTRAIT, '-t', '1', '-r', '10',
        // 鏡を見ているときのように顔が大きく映るよう、顔のまわり（820x1024 の写真の上のほう）を 4:3 に切り出す
        '-vf', 'crop=560:420:128:60,scale=640:480,format=yuv420p', '-pix_fmt', 'yuv420p', PORTRAIT_Y4M]);
    } catch (e) {
      console.log('ffmpeg not available, skipping camera test:', e.message);
      return false;
    }
  }
  if (!fs.existsSync(CLOSE_Y4M)) {
    // 顔の位置と幅は fixture（同じ写真の点群）から求め、顔が はみ出すくらい大きく切り出す
    const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const px = i => [fx.landmarks[i][0] * fx.width, fx.landmarks[i][1] * fx.height];
    const faceWidth = Math.abs(px(454)[0] - px(234)[0]);
    const cx = (px(454)[0] + px(234)[0]) / 2, cy = (px(10)[1] + px(152)[1]) / 2;
    const ch = Math.round(faceWidth / CLOSE_RATIO), cw = Math.round((ch * 4) / 3);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', PORTRAIT, '-t', '1', '-r', '10',
      '-vf', `crop=${cw}:${ch}:${Math.round(cx - cw / 2)}:${Math.round(cy - ch / 2)},scale=640:480,format=yuv420p`, '-pix_fmt', 'yuv420p', CLOSE_Y4M]);
  }
  return true;
}

// 顔の点（番号）をつないで、画面の上を実際にドラッグする
async function drag(page, ids, steps = 8) {
  const pts = [];
  for (const i of ids) pts.push(await page.evaluate(i => window.__makeupDebug.facePoint(i), i));
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps });
  await page.mouse.up();
  return pts;
}

// 顔の点の位置に見えている色
const colorAt = (page, id) => page.evaluate(id => {
  const p = window.__makeupDebug.facePoint(id);
  return window.__makeupDebug.pixelAt(p.x, p.y);
}, id);
const colorDiff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

// スクリーンショット（実際に画面に出ている絵）の、顔の点の位置のあたりの色。
// pixelAt は内部の変換を使うので、表示（CSS の cover・鏡像・顔に合わせたずらし）と合っているかは、こちらで確かめる
async function screenColorAt(page, id) {
  const p = await page.evaluate(id => window.__makeupDebug.facePoint(id), id);
  const png = await page.screenshot({ clip: { x: Math.round(p.x) - 3, y: Math.round(p.y) - 3, width: 7, height: 7 } });
  return page.evaluate(async b64 => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
    return sum.map(v => Math.round(v / (d.length / 4)));
  }, png.toString('base64'));
}

// 塗ったものが画面に出るまで待つ
const waitDrawn = page => page.waitForFunction(() => window.__makeupDebug.makeupDrawn === true, null, { timeout: 10000 });

async function waitForFace(page) {
  await page.waitForSelector('.mmm-status[data-face]');
  await page.waitForFunction(() => document.querySelector('.mmm-status').dataset.face === 'ok', null, { timeout: 90000 });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const d = window.__makeupDebug;
    return { count: d.frame ? d.frame.landmarks.length : 0, status: d.status, stats: d.stats, frameSize: d.frameSize,
      smile: d.frame ? Math.round((d.frame.blendshapes.mouthSmileLeft || 0) * 100) / 100 : null };
  });
}

async function showLandmarks(page) {
  await page.click('button[aria-label="せってい"]');
  await page.waitForSelector('.mmm-sheet');
  const checked = await page.$eval('.mmm-setting-row:has-text("かおの てんを みせる") input', el => el.checked);
  if (!checked) await page.click('.mmm-setting-row:has-text("かおの てんを みせる") input');
  await page.click('text=とじる');
  await page.waitForTimeout(400);
}

(async () => {
  const haveVideo = await ensureAssets();
  const DEBUG = `${require('./common.cjs').BASE}?makeupdebug=1`;

  if (haveVideo) {
    // 1. カメラ（鏡像）
    const { browser, page, errors } = await launch({ width: 390, height: 844 }, { fakeCamera: PORTRAIT_Y4M });
    await gotoHome(page, DEBUG);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
    await page.click('text=カメラを つかう');
    const info = await waitForFace(page);
    console.log('camera:', JSON.stringify(info));
    if (info.count !== 478) errors.push(`camera: expected 478 landmarks, got ${info.count}`);
    await showLandmarks(page);
    await page.screenshot({ path: `${OUT}/phone-makeup-face-camera.png` });
    await page.click('button[aria-label="せってい"]');
    await page.click('.mmm-setting-row:has-text("かおの てんを みせる") input');
    await page.click('text=とじる');

    // 頬（自分の右頬 = 鏡像では画面の右側）をなぞる → その頬だけ色が変わる
    await page.click('.mmm-part:has-text("チーク")');
    await page.click('.mmm-swatch[aria-label="ローズ"]');
    // 点線の目安が消えるのを待ってから、画面の色を覚えておく
    await page.waitForFunction(() => window.__makeupDebug.outline === null, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const before = { right: await colorAt(page, 50), left: await colorAt(page, 280) };
    const screenBefore = { right: await screenColorAt(page, 50), left: await screenColorAt(page, 280) };
    const pts = await drag(page, [50, 123, 50, 205]);
    const stage = await page.$eval('.mmm-stage', el => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width }; });
    if (pts[0].x < stage.left + stage.width / 2) errors.push('mirrored: own right cheek should appear on the right half of the screen');
    await waitDrawn(page);
    await page.waitForTimeout(400);
    const after = { right: await colorAt(page, 50), left: await colorAt(page, 280) };
    console.log('camera paint: right cheek', JSON.stringify(before.right), '→', JSON.stringify(after.right), '| left cheek', JSON.stringify(before.left), '→', JSON.stringify(after.left));
    if (colorDiff(before.right, after.right) < 20) errors.push('camera: the stroked cheek did not change colour');
    if (colorDiff(before.left, after.left) > 12) errors.push('camera: the other cheek changed colour');
    // 画面の上でも、なぞった位置に色が出ている（表示と当たり判定がずれていない）
    await page.waitForFunction(() => window.__makeupDebug.outline === null, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const screenAfter = { right: await screenColorAt(page, 50), left: await screenColorAt(page, 280) };
    const pan = await page.evaluate(() => window.__makeupDebug.pan);
    console.log('camera paint on screen: right cheek', JSON.stringify(screenBefore.right), '→', JSON.stringify(screenAfter.right), '| left cheek diff', colorDiff(screenBefore.left, screenAfter.left), '| pan', JSON.stringify(pan));
    if (colorDiff(screenBefore.right, screenAfter.right) < 20) errors.push('camera: the stroked cheek did not change colour on screen');
    if (colorDiff(screenBefore.left, screenAfter.left) > 12) errors.push('camera: the other cheek changed colour on screen');
    // 塗った色は、内部の絵と画面とで同じ場所にある
    if (colorDiff(after.right, screenAfter.right) > 30) errors.push(`camera: screen and capture disagree at the stroked cheek: ${after.right} vs ${screenAfter.right}`);
    // 指（タッチ）でなぞっても塗れる: もう片方の頬を、タッチのドラッグでなぞる（スクロールに取られて途中で切れないこと）
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const touchPts = [];
    for (const i of [280, 352, 280, 425]) touchPts.push(await page.evaluate(i => window.__makeupDebug.facePoint(i), i));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchPts[0].x, y: touchPts[0].y }] });
    for (let k = 1; k < touchPts.length; k++) {
      for (let t = 1; t <= 6; t++) {
        const x = touchPts[k - 1].x + ((touchPts[k].x - touchPts[k - 1].x) * t) / 6, y = touchPts[k - 1].y + ((touchPts[k].y - touchPts[k - 1].y) * t) / 6;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      }
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const touched = await colorAt(page, 280);
    console.log('camera paint by touch: left cheek', JSON.stringify(after.left), '→', JSON.stringify(touched));
    if (colorDiff(after.left, touched) < 20) errors.push('camera: a touch drag did not paint the cheek');
    await page.screenshot({ path: `${OUT}/phone-makeup-paint-camera.png` });
    await browser.close();
    if (!report(errors)) process.exit(1);
  }

  if (haveVideo) {
    // 2. 近づいた映像（顔が映像からはみ出す）
    const { browser, page, errors } = await launch({ width: 1024, height: 768 }, { fakeCamera: CLOSE_Y4M });
    await gotoHome(page, DEBUG);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
    await page.click('text=カメラを つかう');
    await page.waitForSelector('.mmm-status[data-face]');
    await page.waitForFunction(() => window.__makeupDebug.frame && window.__makeupDebug.stats.padded === true, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const close = await page.evaluate(() => {
      const d = window.__makeupDebug, lm = d.frame && d.frame.landmarks;
      return { count: lm ? lm.length : 0, status: d.status, padded: d.stats.padded,
        widthRatio: lm ? Math.round(Math.abs(lm[454].x - lm[234].x) * (d.frameSize.w / d.frameSize.h) * 100) / 100 : null };
    });
    console.log('close-up:', JSON.stringify(close));
    if (close.count !== 478) errors.push(`close-up: expected 478 landmarks, got ${close.count}`);
    if (!(close.widthRatio > 1.4)) errors.push(`close-up: face should be wider than the frame, got ${close.widthRatio}`);
    if (close.status === 'none') errors.push('close-up: status should not be none');
    // 鼻すじをなぞる（じゆうに ぬる）
    await page.click('button[role="switch"]:has-text("はみださない")');
    await page.click('.mmm-part:has-text("ハイライト")');
    await page.click('.mmm-swatch[aria-label="パール"]');
    const noseBefore = await screenColorAt(page, 195);
    await drag(page, [168, 6, 195, 4]);
    await drag(page, [168, 6, 195, 4]);
    await waitDrawn(page);
    const paintedClose = await page.evaluate(() => window.__makeupDebug.painted);
    if (!paintedClose.includes('highlight')) errors.push('close-up: stroke was not painted');
    await page.waitForTimeout(400);
    const noseAfter = await screenColorAt(page, 195);
    console.log('close-up paint on screen: nose', JSON.stringify(noseBefore), '→', JSON.stringify(noseAfter));
    if (colorDiff(noseBefore, noseAfter) < 8) errors.push('close-up: the stroke is not visible on screen');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/tablet-makeup-close.png` });
    await browser.close();
    if (!report(errors)) process.exit(1);
  }

  // 3. しゃしんモード（最後にカメラへ切り替えるので、偽カメラの合成映像を使えるようにしておく）
  {
    const { browser, page, errors } = await launch({ width: 1024, height: 768 }, { fakeCamera: true });
    // Safari と同じく canvas の filter を無くし、canvas を作った数を数える
    await page.addInitScript(() => {
      delete CanvasRenderingContext2D.prototype.filter;
      const orig = Document.prototype.createElement;
      window.__canvasCount = 0;
      Document.prototype.createElement = function (tag, ...rest) {
        if (String(tag).toLowerCase() === 'canvas') window.__canvasCount++;
        return orig.call(this, tag, ...rest);
      };
    });
    await gotoHome(page, DEBUG);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
    await page.setInputFiles('input[type="file"]', PORTRAIT);
    const info = await waitForFace(page);
    console.log('photo:', JSON.stringify(info));
    if (info.count !== 478) errors.push(`photo: expected 478 landmarks, got ${info.count}`);
    await showLandmarks(page);
    await page.screenshot({ path: `${OUT}/tablet-makeup-face-photo.png` });
    await page.click('button[aria-label="せってい"]');
    await page.click('.mmm-setting-row:has-text("かおの てんを みせる") input');
    await page.click('text=とじる');

    // 色を選んだだけでは顔に付かない
    await page.click('.mmm-part:has-text("リップ")');
    await page.click('.mmm-swatch[aria-label="ローズ"]');
    await page.waitForTimeout(500);
    const idle = await page.evaluate(() => ({ painted: window.__makeupDebug.painted, drawn: window.__makeupDebug.makeupDrawn, outline: window.__makeupDebug.outline }));
    console.log('colour picked:', JSON.stringify(idle));
    if (idle.painted.length !== 0 || idle.drawn) errors.push('picking a colour should not apply makeup by itself');
    if (!idle.outline || idle.outline[0] !== 'lipsOuter') errors.push('the lip outline hint should be shown after picking the part');
    await page.screenshot({ path: `${OUT}/tablet-makeup-outline.png` });

    // はみださない: 唇を ざっくり なぞる → 唇に色が付き、唇の外（鼻の下・あご）には付かない
    const base = { lip: await colorAt(page, 17), aboveLip: await colorAt(page, 164), chin: await colorAt(page, 200), forehead: await colorAt(page, 151) };
    await drag(page, [61, 164, 291]);   // 上唇の少し上（鼻の下）を通って はみ出すように
    await drag(page, [61, 0, 291]);
    await drag(page, [61, 17, 291]);
    await drag(page, [61, 200, 291]);   // あごの方まで はみ出すように
    await waitDrawn(page);
    await page.waitForTimeout(400);
    const assisted = { lip: await colorAt(page, 17), aboveLip: await colorAt(page, 164), chin: await colorAt(page, 200) };
    console.log('assist paint: lip', JSON.stringify(base.lip), '→', JSON.stringify(assisted.lip), '| above lip diff', colorDiff(base.aboveLip, assisted.aboveLip), '| chin diff', colorDiff(base.chin, assisted.chin));
    if (colorDiff(base.lip, assisted.lip) < 20) errors.push('assist: the lip did not change colour');
    if (colorDiff(base.aboveLip, assisted.aboveLip) > 12) errors.push('assist: colour went outside the lips (above)');
    if (colorDiff(base.chin, assisted.chin) > 12) errors.push('assist: colour went outside the lips (chin)');
    await page.screenshot({ path: `${OUT}/tablet-makeup-paint-assist.png` });

    // チーク・アイシャドウ・まゆ も なぞる
    for (const [part, color, strokes] of [
      ['チーク', 'ピーチ', [[50, 123, 116], [205, 50, 117], [280, 352, 345], [425, 280, 346]]],
      ['アイシャドウ', 'ブラウン', [[33, 27, 133], [263, 257, 362]]],
      ['まゆ', 'ナチュラルブラウン', [[70, 105, 107], [300, 334, 336]]],
    ]) {
      await page.click(`.mmm-part:has-text("${part}")`);
      await page.click(`.mmm-swatch[aria-label="${color}"]`);
      for (const ids of strokes) await drag(page, ids);
    }
    const painted = await page.evaluate(() => window.__makeupDebug.painted);
    console.log('painted:', JSON.stringify(painted));
    if (painted.length !== 4) errors.push(`expected 4 painted layers, got ${painted.length}`);

    // じゆうに ぬる（はみださない を切る）: リップの色で おでこ に線が引ける → けしゴム で消える
    await page.click('button[role="switch"]:has-text("はみださない")');
    await page.click('.mmm-part:has-text("リップ")');
    await page.click('button[aria-label="ふとさ ふとい"]');
    await drag(page, [104, 151, 333]);
    await page.waitForTimeout(400);
    const free = await colorAt(page, 151);
    console.log('free paint: forehead', JSON.stringify(base.forehead), '→', JSON.stringify(free));
    if (colorDiff(base.forehead, free) < 20) errors.push('free: the forehead stroke did not change colour');
    await page.screenshot({ path: `${OUT}/tablet-makeup-paint-free.png` });
    await page.click('button[aria-label="けしゴム"]');
    await drag(page, [104, 151, 333]);
    await drag(page, [104, 151, 333]);
    await page.waitForTimeout(400);
    const erased = await colorAt(page, 151);
    console.log('erased: forehead diff', colorDiff(base.forehead, erased));
    if (colorDiff(base.forehead, erased) > 12) errors.push('eraser: the forehead stroke is still visible');

    // 塗ったまま描き続けても canvas を作り続けない（iPad で落ちた原因: 毎フレーム canvas を作っていた）
    const c0 = await page.evaluate(() => window.__canvasCount);
    await page.waitForTimeout(3000);
    const c1 = await page.evaluate(() => window.__canvasCount);
    console.log(`canvases created while rendering for 3s: ${c1 - c0} (total so far ${c1})`);
    if (c1 - c0 > 0) errors.push(`canvases are being created every frame: +${c1 - c0} in 3s`);
    if (c1 > 60) errors.push(`too many canvases created in total: ${c1}`);

    // くらべる を押している間は すっぴん
    await page.dispatchEvent('button:has-text("くらべる")', 'pointerdown');
    await page.waitForFunction(() => window.__makeupDebug.makeupDrawn === false, null, { timeout: 5000 });
    await page.dispatchEvent('button:has-text("くらべる")', 'pointerup');
    await waitDrawn(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button:has-text("ほぞん")'),
    ]);
    console.log('download:', download.suggestedFilename());
    if (!/^makeup-\d{8}-\d{6}\.jpg$/.test(download.suggestedFilename())) errors.push(`unexpected filename ${download.suggestedFilename()}`);
    await download.saveAs(`${OUT}/tablet-makeup-saved.jpg`);
    await page.click('button:has-text("ぜんぶ けす")');
    await page.waitForFunction(() => window.__makeupDebug.painted.length === 0 && window.__makeupDebug.makeupDrawn === false, null, { timeout: 5000 });
    console.log('cleared: ok');

    // おしえて: ナチュラル を選んで チーク のステップまで進める（にっこりの判定、矢印の表示）→ できあがりを みる → さいごまで
    await page.click('.mmm-mode:has-text("おしえて")');
    await page.waitForSelector('button[aria-label="ナチュラルの てじゅん"]');
    await page.screenshot({ path: `${OUT}/tablet-makeup-guide-list.png` });
    await page.click('button[aria-label="ナチュラルの てじゅん"]');
    await page.waitForSelector('text=ステップ 1 / 10');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/tablet-makeup-guide-base.png` });
    for (let i = 0; i < 6; i++) await page.click('button:has-text("つぎへ")');
    await page.waitForSelector('.mmm-guide[data-step="blush"]');
    await page.waitForTimeout(700);
    const guide = await page.evaluate(() => ({ step: window.__makeupDebug.guideStep, poseOk: window.__makeupDebug.poseOk }));
    console.log('guide:', JSON.stringify(guide));
    if (guide.step !== 'blush') errors.push(`expected blush step, got ${guide.step}`);
    if (!guide.poseOk) errors.push('smile should be detected on the sample portrait');
    await page.screenshot({ path: `${OUT}/tablet-makeup-guide-blush.png` });
    // できあがりを みる: 型どおりに自動で塗られる → もとに もどす で消える
    await page.click('button:has-text("できあがりを みる")');
    await page.waitForFunction(() => window.__makeupDebug.makeupDrawn === true && window.__makeupDebug.painted.length >= 5, null, { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/tablet-makeup-guide-result.png` });
    await page.click('button:has-text("もとに もどす")');
    await page.waitForFunction(() => window.__makeupDebug.painted.length === 0, null, { timeout: 5000 });
    for (let i = 0; i < 3; i++) await page.click('button:has-text("つぎへ")');
    await page.click('button:has-text("できあがり！")');
    await page.waitForSelector('text=とっても すてき');
    await page.click('button:has-text("ほかの てじゅん")');
    await page.waitForSelector('button[aria-label="チークだけの てじゅん"]');
    console.log('guide flow: ok');

    // ていあん: しんだん → かおの かたち などが出る → この いろで ためす → ためす に切り替わり、型どおりに塗られる
    await page.click('.mmm-mode:has-text("ていあん")');
    await page.waitForSelector('button:has-text("しんだん する"):not([disabled])');
    await page.click('button:has-text("しんだん する")');
    await page.waitForSelector('.mmm-suggest[data-face-shape]');
    const suggestion = await page.evaluate(() => {
      const sg = window.__makeupDebug.suggestion;
      return { faceShape: sg.faceShape, eyeShape: sg.eyeShape, eyeSize: sg.eyeSize, skinTone: sg.skinTone, skinBrightness: sg.skinBrightness, recipeId: sg.recipeId,
        metrics: Object.fromEntries(Object.entries(sg.metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000])) };
    });
    console.log('suggestion:', JSON.stringify(suggestion));
    if (suggestion.faceShape !== 'oval') errors.push(`expected oval face for the sample, got ${suggestion.faceShape}`);
    if (suggestion.skinTone === 'unknown') errors.push('skin tone should be measurable on the sample');
    await page.screenshot({ path: `${OUT}/tablet-makeup-suggest.png` });
    await page.click('button:has-text("この いろで ためす")');
    await page.waitForFunction(() => window.__makeupDebug.mode === 'try' && window.__makeupDebug.painted.length >= 4 && window.__makeupDebug.makeupDrawn === true, null, { timeout: 10000 });
    console.log('suggest flow: ok');
    await page.click('button:has-text("ぜんぶ けす")');

    if (process.env.E2E_WRITE_FIXTURE === '1') {
      const frame = await page.evaluate(() => {
        const f = window.__makeupDebug.frame;
        const r = v => Math.round(v * 10000) / 10000;
        return { width: window.__makeupDebug.frameSize.w, height: window.__makeupDebug.frameSize.h,
          landmarks: f.landmarks.map(p => [r(p.x), r(p.y), r(p.z)]),
          blendshapes: Object.fromEntries(Object.entries(f.blendshapes).map(([k, v]) => [k, r(v)])) };
      });
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(FIXTURE, JSON.stringify(frame));
      console.log('fixture written:', FIXTURE, `${frame.landmarks.length} points`);
    }
    // カメラに戻す → 合成映像（顔なし）になり、状態が「かおを うつしてね」になる
    await page.click('text=カメラに する');
    await page.waitForFunction(() => {
      const v = document.querySelector('video.mmm-video');
      return v && v.videoWidth > 0 && document.querySelector('.mmm-status').dataset.face === 'none';
    }, null, { timeout: 30000 });
    console.log('photo → camera: ok (no face in synthetic video)');
    await browser.close();
    if (!report(errors)) process.exit(1);
  }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
