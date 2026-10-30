// マジックメイクミラー: 顔のある映像で顔認識が動くか
//   1. 偽カメラ（顔写真から作った y4m）で ミラー画面 → 顔が見つかる（478 点）→ せってい で点を表示 → スクリーンショット
//   2. しゃしんモード（ファイル選択）でも同じ → 点群を fixture に書き出す（E2E_WRITE_FIXTURE=1 のとき）
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
  return true;
}

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

  if (haveVideo) {
    const { browser, page, errors } = await launch({ width: 390, height: 844 }, { fakeCamera: PORTRAIT_Y4M });
    await gotoHome(page, `${require('./common.cjs').BASE}?makeupdebug=1`);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
    await page.click('text=カメラを つかう');
    const info = await waitForFace(page);
    console.log('camera:', JSON.stringify(info));
    if (info.count !== 478) errors.push(`camera: expected 478 landmarks, got ${info.count}`);
    await showLandmarks(page);
    await page.screenshot({ path: `${OUT}/phone-makeup-face-camera.png` });
    await browser.close();
    if (!report(errors)) process.exit(1);
  }

  // しゃしんモード（最後にカメラへ切り替えるので、偽カメラの合成映像を使えるようにしておく）
  {
    const { browser, page, errors } = await launch({ width: 390, height: 844 }, { fakeCamera: true });
    await gotoHome(page, `${require('./common.cjs').BASE}?makeupdebug=1`);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
    await page.setInputFiles('input[type="file"]', PORTRAIT);
    const info = await waitForFace(page);
    console.log('photo:', JSON.stringify(info));
    if (info.count !== 478) errors.push(`photo: expected 478 landmarks, got ${info.count}`);
    await showLandmarks(page);
    await page.screenshot({ path: `${OUT}/phone-makeup-face-photo.png` });

    // ためす: リップ・チーク・アイシャドウ・アイライン・まゆ・ハイライト を選ぶ → 描画される → ほぞん → ぜんぶ けす
    await page.click('button[aria-label="せってい"]');
    await page.click('.mmm-setting-row:has-text("かおの てんを みせる") input');
    await page.click('text=とじる');
    for (const [part, color] of [['リップ', 'ローズ'], ['チーク', 'ピーチ'], ['アイシャドウ', 'ブラウン'], ['アイライン', 'ブラック'], ['まゆ', 'ナチュラルブラウン'], ['ハイライト', 'パール']]) {
      await page.click(`.mmm-part:has-text("${part}")`);
      await page.click(`.mmm-swatch[aria-label="${color}"]`);
    }
    await page.waitForFunction(() => window.__makeupDebug.makeupDrawn === true, null, { timeout: 10000 });
    const look = await page.evaluate(() => window.__makeupDebug.look);
    console.log('look:', JSON.stringify(look));
    if (Object.keys(look).length !== 6) errors.push(`expected 6 layers, got ${Object.keys(look).length}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/phone-makeup-look-photo.png` });
    await page.click('.mmm-part:has-text("リップ")');
    await page.screenshot({ path: `${OUT}/phone-makeup-look-photo-lip.png` });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button:has-text("ほぞん")'),
    ]);
    console.log('download:', download.suggestedFilename());
    if (!/^makeup-\d{8}-\d{6}\.jpg$/.test(download.suggestedFilename())) errors.push(`unexpected filename ${download.suggestedFilename()}`);
    await download.saveAs(`${OUT}/phone-makeup-saved.jpg`);
    await page.click('button:has-text("ぜんぶ けす")');
    await page.waitForFunction(() => Object.keys(window.__makeupDebug.look).length === 0 && window.__makeupDebug.makeupDrawn === false, null, { timeout: 5000 });
    console.log('cleared: ok');

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
