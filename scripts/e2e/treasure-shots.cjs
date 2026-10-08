// 発掘ステージの土を外した状態（たからものが見える状態）をスクリーンショットに保存する
const { launch, openStage, tapScrew, report, OUT } = require('./common.cjs');

(async () => {
  const { browser, page, errors } = await launch({ width: 844, height: 390 });
  const shots = [
    // 順番はソルバーの解（最後の 1 本を残して、たからものが見えた状態で撮る）
    ['ほしのはっくつ', ['c1', 'c2', 'l1', 'l2', 'c3', 'f1', 'f2', 'sL', 'l3', 'k1', 'k2', 'b2', 'sR', 'b0', 'b1', 't0', 't1']],
    ['ダイヤのはっくつ', ['oE0', 'oE1', 'oS0', 'oS1', 'oN0', 'oT0', 'oT1', 'oB0', 'oB1', 'oN1', 'iE', 'iS', 'iT', 'iB', 'iN', 'oW0', 'oW1']],
    ['きょうりゅうのかせき', ['L0', 'L1', 'L2', 'R0', 'R1', 'R2', 's00', 's01', 's02', 's12', 'g0', 'g1', 'g2', 's10', 's20', 's22', 's30', 's11', 's21', 's31']],
  ];
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
