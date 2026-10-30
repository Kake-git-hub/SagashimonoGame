const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 4173;
const OUT = process.env.E2E_OUT || `${__dirname}/out`;
const BASE = `http://localhost:${PORT}/SagashimonoGame/`;
const DEBUG_URL = `${BASE}?nejidebug=1`;

// options.fakeCamera: 偽のカメラ（Chromium の合成映像、または y4m ファイルの映像）を使い、許可も自動で出す
async function launch(viewport = { width: 390, height: 844 }, options = {}) {
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const contextOptions = { viewport, deviceScaleFactor: 1 };
  if (options.fakeCamera) {
    args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream');
    if (typeof options.fakeCamera === 'string') args.push(`--use-file-for-fake-video-capture=${options.fakeCamera}`);
    contextOptions.permissions = ['camera'];
  }
  const browser = await chromium.launch({ args });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  return { browser, context, page, errors };
}

// ホーム画面を開く。初回はプロフィール作成画面（なんさい？）が出るので 6 さいで作る
async function gotoHome(page, url = BASE) {
  await page.goto(url, { waitUntil: 'networkidle' });
  const first = await page.$('text=はじめまして');
  if (first) {
    await page.click('button:has-text("6さい")');
    await page.click('text=これで はじめる！');
  } else if (await page.$('text=だれが あそぶ？')) {
    await page.click('button[aria-label$="であそぶ"]');
  }
  await page.waitForSelector('text=あそぶゲームをえらんでね');
}

// ステージ id → 手順（npm run gen:neji が書き出す。6 さいのプロフィール = おきば +1 の条件）
//   order: ソルバーの解  fail: 先を読まずに外しておきばがあふれる手順  demo: おきばを使いつつクリアする手順
const SOLUTIONS = require('./solutions.json');
const STAGE_INDEX = require('../../public/neji/index.json');
function playsFor(stageName) {
  const entry = STAGE_INDEX.find(s => s.name === stageName);
  if (!entry || !SOLUTIONS[entry.id]) throw new Error(`no plays for ${stageName} (run npm run gen:neji)`);
  return SOLUTIONS[entry.id];
}
const solutionFor = stageName => playsFor(stageName).order;
// 一覧の順（やさしい順）で、条件に合う手順を持つ最初のステージ名を返す
function findStageWith(kind, { treasure = true } = {}) {
  const entry = STAGE_INDEX.find(s => SOLUTIONS[s.id] && SOLUTIONS[s.id][kind] && (treasure || !s.treasure));
  if (!entry) throw new Error(`no stage with ${kind} play`);
  return entry.name;
}

// ネジはずしのステージを開き、デバッグ情報が出るまで待つ
async function openStage(page, stageName) {
  await gotoHome(page, DEBUG_URL);
  await page.click('text=ネジはずし');
  await page.waitForSelector('text=ステージをえらんでね');
  await page.click(`button[aria-label="${stageName}であそぶ"]`);
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => window.__nejiDebug && Object.keys(window.__nejiDebug.screws).length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(500);
}

// 画面上の位置を実際にクリックしてネジを外す（当たり判定も含めて確認）
async function clickScrew(page, id) {
  const pos = await page.evaluate(id => {
    const info = window.__nejiDebug;
    const canvas = document.querySelector('canvas');
    if (!info || !canvas || !info.screws[id]) return null;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + info.screws[id].x, y: r.top + info.screws[id].y };
  }, id);
  if (!pos) throw new Error(`screw ${id} not on screen`);
  await page.mouse.click(pos.x, pos.y);
}

// 当たり判定を通さずにタップ（隠れているネジのブロック判定を確認するとき）
const tapScrew = (page, id) => page.evaluate(id => window.__nejiDebug.tap(id), id);

async function hudText(page) {
  const boxes = await page.$$eval('.neji-box[data-box-uid]', els => els.map(e => e.getAttribute('aria-label')));
  const buffer = await page.$eval('.neji-buffer', el => el.getAttribute('aria-label'));
  const remaining = await page.textContent('text=/のこり/');
  return `${remaining} | ${boxes.join(' / ')} | ${buffer}`;
}

function report(errors) {
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
  return errors.length === 0;
}

module.exports = { BASE, DEBUG_URL, OUT, launch, gotoHome, openStage, clickScrew, tapScrew, hudText, report, solutionFor, playsFor, findStageWith };
