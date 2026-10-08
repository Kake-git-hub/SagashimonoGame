// ネジはずし: ステージ 1 をクリア、ブロック表示、色仕分け（一時置き場 → 箱の入れ替え）
const { launch, openStage, clickScrew, tapScrew, hudText, report, OUT } = require('./common.cjs');

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
  check('blocked tap keeps count', await hudText(page), 'のこり 9');
  await tapScrew(page, 'cap1'); await page.waitForTimeout(600);
  await tapScrew(page, 'cap2'); await page.waitForTimeout(1400);
  await tapScrew(page, 'u1'); await page.waitForTimeout(600);
  check('after cap fell', await hudText(page), 'のこり 6');

  // ステージ 3: 赤は箱が無いので一時置き場 → 青 3 本で箱が満杯 → 赤の箱が来て置き場から移動
  await openStage(page, 'ピンのとう');
  await tapScrew(page, 'top'); await page.waitForTimeout(1200);
  check('red goes to buffer', await hudText(page), 'おきば 1/5');
  for (const id of ['pinX', 'pinZ', 'free']) { await tapScrew(page, id); await page.waitForTimeout(300); }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/neji-stage3-redbox.png` });
  check('red box arrived with buffered screw', await hudText(page), 'あかのはこ 1/3');
  check('buffer emptied', await hudText(page), 'おきば 0/5');

  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
