// 幾何学・展開図・漢字ステージ: さいころを解いて展開図になるのを確認し、各ステージの途中をスクリーンショットに保存する
const { launch, openStage, tapScrew, hudText, report, OUT } = require('./common.cjs');

(async () => {
  const { browser, page, errors } = await launch({ width: 844, height: 390 });
  const check = (label, ok, detail = '') => {
    console.log(`${ok ? 'OK ' : 'NG '} ${label} ${detail}`);
    if (!ok) errors.push(`check failed: ${label}`);
  };

  // さいころ: 側面を 2 つ開いたところで撮る → 全部開いてクリア
  await openStage(page, 'さいころの てんかいず');
  for (const id of ['px1', 'px2', 'pz1', 'pz2']) { await tapScrew(page, id); await page.waitForTimeout(300); }
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/geo-dice-unfolding.png` });
  for (const id of ['nx1', 'nx2', 'nz1', 'nz2', 't1', 't2', 't3', 't4']) { await tapScrew(page, id); await page.waitForTimeout(300); }
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/geo-dice-net.png` });
  await page.waitForSelector('text=おめでとう！', { timeout: 10000 });
  check('dice net cleared', true);

  // ピラミッド: 上の段を外さないと下の段のネジは外せない
  await openStage(page, 'ピラミッド');
  await page.screenshot({ path: `${OUT}/geo-pyramid.png` });
  await tapScrew(page, 'a0');
  await page.waitForTimeout(150);
  check('pyramid lower screw blocked', (await hudText(page)).includes('のこり 15'), await hudText(page));

  // 漢字「木」: 横棒の下のネジはブロックされる
  await openStage(page, 'かんじ「木」');
  await page.screenshot({ path: `${OUT}/geo-kanji-ki.png` });
  await tapScrew(page, 't3');
  await page.waitForTimeout(150);
  check('kanji hidden screw blocked', (await hudText(page)).includes('のこり 12'), await hudText(page));

  for (const name of ['ろっかくの はこ', 'かんじ「田」']) {
    await openStage(page, name);
    await page.screenshot({ path: `${OUT}/geo-${name}.png` });
  }

  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
