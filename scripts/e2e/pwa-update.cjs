// PWA: 旧ビルド起動 → 新ビルド公開 → 自動更新でバンドルが切り替わる → オフラインで起動できる
const { execSync } = require('child_process');
const { launch, report, OUT, BASE } = require('./common.cjs');

(async () => {
  const { browser, context, page, errors } = await launch();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=バージョン:');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
  const bundle1 = await page.evaluate(() => document.querySelector('script[src*="/assets/index-"]').getAttribute('src'));
  console.log('v1 bundle:', bundle1);

  // 新しいビルドを公開（ビルド日時が変わるので内容が変わる）
  execSync('npm run build', { stdio: 'ignore' });

  // 更新チェック（本番では起動時・前面復帰時・1 時間ごと）→ ホーム画面なので自動適用 → リロード
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForFunction(old => {
    const s = document.querySelector('script[src*="/assets/index-"]');
    return s && s.getAttribute('src') !== old && document.body.innerText.includes('バージョン:');
  }, bundle1, { timeout: 30000 });
  console.log('v2 bundle:', await page.evaluate(() => document.querySelector('script[src*="/assets/index-"]').getAttribute('src')));
  await page.screenshot({ path: `${OUT}/pwa-after-update.png` });

  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('text=あそぶゲームをえらんでね', { timeout: 15000 });
  await page.click('text=ネジはずし');
  await page.waitForSelector('text=ステージをえらんでね', { timeout: 15000 });
  console.log('offline launch OK');
  await context.setOffline(false);

  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
