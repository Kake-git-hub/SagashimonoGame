// 全ステージの初期表示をスクリーンショットに保存する
const { launch, openStage, report, OUT, DEBUG_URL } = require('./common.cjs');

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(DEBUG_URL, { waitUntil: 'networkidle' });
  await page.click('text=ネジはずし');
  await page.waitForSelector('text=ステージをえらんでね');
  const names = await page.$$eval('button[aria-label$="であそぶ"]', els => els.map(e => e.getAttribute('aria-label').replace('であそぶ', '')));
  await page.screenshot({ path: `${OUT}/stage-list.png`, fullPage: true });
  for (const name of names) {
    await openStage(page, name);
    await page.screenshot({ path: `${OUT}/stage-${name}.png` });
    console.log('shot:', name);
  }
  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
