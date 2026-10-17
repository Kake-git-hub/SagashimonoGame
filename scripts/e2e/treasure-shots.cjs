// 発掘ステージの土を外した状態（たからものが見える状態）をスクリーンショットに保存する
const { launch, openStage, tapScrew, report, OUT, solutionFor } = require('./common.cjs');

(async () => {
  const { browser, page, errors } = await launch({ width: 844, height: 390 });
  // 発掘ステージ全部。順番はソルバーの解（最後の 1 本を残して、たからものが見えた状態で撮る）
  const names = require('../../public/neji/index.json').filter(s => s.treasure).map(s => s.name);
  const shots = names.map(name => [name, solutionFor(name).slice(0, -1)]);
  for (const [name, ids] of shots) {
    await openStage(page, name);
    for (const id of ids) { await tapScrew(page, id); await page.waitForTimeout(250); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/treasure-${name}.png` });
    console.log('shot:', name);
  }
  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
