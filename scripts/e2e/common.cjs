const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 4173;
const OUT = process.env.E2E_OUT || `${__dirname}/out`;
const BASE = `http://localhost:${PORT}/SagashimonoGame/`;
const DEBUG_URL = `${BASE}?nejidebug=1`;

async function launch(viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  return { browser, context, page, errors };
}

// ネジはずしのステージを開き、デバッグ情報が出るまで待つ
async function openStage(page, stageName) {
  await page.goto(DEBUG_URL, { waitUntil: 'networkidle' });
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

module.exports = { BASE, DEBUG_URL, OUT, launch, openStage, clickScrew, tapScrew, hudText, report };
