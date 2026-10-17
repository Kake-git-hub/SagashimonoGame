// ネジはずし: ステージ 1 をクリア、ブロック表示、色仕分け（一時置き場 → 箱の入れ替え）
const { launch, openStage, clickScrew, tapScrew, hudText, report, OUT, playsFor, findStageWith } = require('./common.cjs');

(async () => {
  const { browser, page, errors } = await launch();
  const check = (label, actual, expected) => {
    const ok = actual.includes(expected);
    console.log(`${ok ? 'OK ' : 'NG '} ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
    if (!ok) errors.push(`check failed: ${label}`);
  };

  // ステージ 1: 画面上のネジを実際にクリックして全部外す
  await openStage(page, 'はこ');
  await page.screenshot({ path: `${OUT}/neji-stage1.png` });
  const ids = await page.evaluate(() => Object.keys(window.__nejiDebug.screws));
  for (const id of ids) { await clickScrew(page, id); await page.waitForTimeout(250); }
  await page.waitForSelector('text=おめでとう！', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/neji-stage1-clear.png` });
  console.log('OK  stage1 cleared by clicking every screw');

  // ステージ 2: かさの下のネジはブロックされ、かさが落ちれば外せる
  await openStage(page, 'きのこ');
  await tapScrew(page, 'u1');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/neji-stage2-blocked.png` });
  check('blocked tap keeps count', await hudText(page), 'のこり 12');
  await tapScrew(page, 'cap1'); await page.waitForTimeout(600);
  await tapScrew(page, 'cap2'); await page.waitForTimeout(1400);
  await tapScrew(page, 'u1'); await page.waitForTimeout(600);
  check('after cap fell', await hudText(page), 'のこり 9');

  // 色仕分け: おきばを使う手順でクリアする。ボックスの無い色は一時置き場に置かれ、その色のボックスが来ると移る（最後は置き場が空）
  const demoStage = findStageWith('demo', { treasure: false }); // 発掘ステージはクリア時の画面が違うので除く
  await openStage(page, demoStage);
  let bufferUsed = false;
  for (const id of playsFor(demoStage).demo) {
    await tapScrew(page, id);
    await page.waitForTimeout(350);
    if (!bufferUsed && /おきば [1-9]/.test(await hudText(page))) {
      bufferUsed = true;
      await page.screenshot({ path: `${OUT}/neji-sort-buffer.png` });
    }
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/neji-sort-clear.png` });
  check(`buffer was used during ${demoStage}`, bufferUsed ? 'yes' : 'no', 'yes');
  check('buffer emptied', await hudText(page), 'おきば 0/6'); // 6 さいのプロフィールなので +1
  await page.waitForSelector('text=おめでとう！', { timeout: 10000 });

  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
