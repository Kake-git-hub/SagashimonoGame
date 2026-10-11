// オフライン: 一度ホームを開いただけで、サーバーが無くても全部遊べるか
// - Playwright の context.setOffline は Service Worker の通信を止めないので、
//   自前の静的サーバーで dist を配り、それを閉じて本当のオフラインにする
const http = require('http');
const fs = require('fs');
const path = require('path');
const { launch, gotoHome, report, OUT } = require('./common.cjs');

const DIST = path.join(__dirname, '../../dist');
const PORT = Number(process.env.E2E_OFFLINE_PORT || 4190);
const BASE = `http://localhost:${PORT}/SagashimonoGame/`;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let file = decodeURIComponent(new URL(req.url, BASE).pathname).replace(/^\/SagashimonoGame\//, '');
  if (file === '') file = 'index.html';
  const full = path.join(DIST, file);
  if (!full.startsWith(DIST) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
});

const brokenImages = page => page.$$eval('img', imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));

(async () => {
  await new Promise(resolve => server.listen(PORT, resolve));
  const { browser, page, errors } = await launch();
  let ok = true;

  // オンラインではホームを開くだけ（さがしもの・ネジはずしは開かない）
  await gotoHome(page, BASE);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

  server.close();
  server.closeAllConnections();

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('text=あそぶゲームをえらんでね', { timeout: 15000 });
  console.log('offline home OK');

  await page.click('text=さがしもの');
  await page.waitForSelector('text=パズルをえらんでね', { timeout: 15000 });
  await page.waitForTimeout(1500);
  let broken = await brokenImages(page);
  console.log('さがしもの一覧の絵（出なかった数）:', broken.length);
  if (broken.length) ok = false;
  await page.screenshot({ path: `${OUT}/offline-sagashimono-list.png` });

  await page.click('text=うみのなか');
  await page.waitForTimeout(1500);
  broken = await brokenImages(page);
  console.log('さがしものゲーム画面の絵（出なかった数）:', broken.length);
  if (broken.length) ok = false;
  await page.screenshot({ path: `${OUT}/offline-sagashimono-game.png` });

  await page.goto(BASE);
  await page.waitForSelector('text=あそぶゲームをえらんでね', { timeout: 15000 });
  await page.click('text=ネジはずし');
  await page.waitForSelector('text=ステージをえらんでね', { timeout: 15000 });
  await page.click('button[aria-label$="であそぶ"]');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/offline-neji.png` });
  console.log('offline neji OK');

  await browser.close();
  // オフラインになってからの読み込み失敗はここで判定済みなので、console.error は数えない
  const rest = errors.filter(e => !e.includes('Failed to load resource'));
  process.exit(report(rest) && ok ? 0 : 1);
})().catch(e => {
  console.error('FAILED', e);
  process.exit(1);
});
