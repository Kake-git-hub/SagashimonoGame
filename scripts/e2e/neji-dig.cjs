// ネジはずし: 発掘ステージ（ハート）を解いてたからばこに入る、＋おきば（クイズ）、しっぱい → つづきから（クイズ）
const { launch, gotoHome, openStage, tapScrew, hudText, report, OUT, DEBUG_URL } = require('./common.cjs');

async function answerQuiz(page) {
  await page.waitForSelector('[aria-label="べんきょうクイズ"]', { timeout: 5000 });
  await page.waitForTimeout(1100); // 出た直後は連打対策でボタンが押せない
  await page.screenshot({ path: `${OUT}/neji-quiz.png` });
  // 正解の選択肢はテストから分からないので、全部の選択肢を順に試す（不正解なら次の問題が出る）
  for (let i = 0; i < 12; i++) {
    const buttons = await page.$$('[aria-label="べんきょうクイズ"] button:not(:disabled)');
    const choices = buttons.filter(async () => true).slice(0, -1); // 最後は「やめる」
    const pick = choices[Math.floor(Math.random() * choices.length)];
    await pick.click();
    await page.waitForTimeout(1600);
    if (!(await page.$('[aria-label="べんきょうクイズ"]'))) return;
  }
  throw new Error('quiz not passed');
}

(async () => {
  const { browser, page, errors } = await launch({ width: 844, height: 390 }); // 横向き
  const check = (label, ok, detail = '') => {
    console.log(`${ok ? 'OK ' : 'NG '} ${label} ${detail}`);
    if (!ok) errors.push(`check failed: ${label}`);
  };

  // ＋おきば: クイズに正解すると穴が増える
  await openStage(page, 'ハートのはっくつ');
  await page.screenshot({ path: `${OUT}/neji-dig-landscape.png` });
  check('buffer before', (await hudText(page)).includes('おきば 0/6'), await hudText(page)); // 6 さいなので +1
  await page.click('button[aria-label="おきばをふやす"]');
  await answerQuiz(page);
  check('buffer after quiz', (await hudText(page)).includes('おきば 0/7'), await hudText(page));

  // 前ぶたの下のネジはブロックされる
  await tapScrew(page, 'sL');
  await page.waitForTimeout(150);
  check('blocked under front lid', (await hudText(page)).includes('のこり 15'), await hudText(page));

  // 解いてクリア → たからもの発見
  const order = ['b0', 'b1', 'b2', 'f1', 'f2', 'k1', 'c1', 'c2', 'c3', 'sL', 'sR', 't0', 'k2', 't1', 't2'];
  for (const [n, id] of order.entries()) {
    await tapScrew(page, id);
    await page.waitForTimeout(350);
    if (n === 8) { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/neji-dig-revealed.png` }); }
  }
  // クリア → まず、たからものをじっくり見るモード（HUD が消えて、カメラが寄って回る）
  await page.waitForSelector('text=ゆびで まわして', { timeout: 10000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/neji-dig-reveal.png` });
  check('reveal mode shows treasure name', await page.$('text=「ピンクのハート」を はっけん！') !== null);
  await page.click('button:has-text("たからばこに いれる")');
  await page.waitForSelector('text=はっけん！', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/neji-dig-clear.png` });
  check('treasure found', await page.$('text=たからばこに いれたよ') !== null);

  // つぎのステージへ → クイズ → 次のステージが開く
  await page.click('text=つぎのステージへ');
  await answerQuiz(page);
  await page.waitForSelector('text=さいころの てんかいず', { timeout: 10000 });
  check('next stage after quiz', true);

  // たからばこに入っている
  await gotoHome(page, DEBUG_URL);
  await page.click('text=ネジはずし');
  await page.waitForSelector('text=ステージをえらんでね');
  await page.click('button[aria-label="たからばこをみる"]');
  await page.waitForSelector('text=ピンクのハート');
  await page.screenshot({ path: `${OUT}/neji-collection.png` });
  check('collection has heart', true);

  // 縦向きの表示と、しっぱい → つづきから（クイズ）
  await page.setViewportSize({ width: 390, height: 844 });
  await openStage(page, 'くるま');
  await page.screenshot({ path: `${OUT}/neji-portrait.png` });
  // 箱の無い色（黄・緑・紫）を 7 本外すと、おきば 6 こではあふれて失敗
  for (const id of ['c1', 'c2', 'r2', 'wBL', 'wBR', 'r1', 'd1']) { await tapScrew(page, id); await page.waitForTimeout(300); }
  await page.waitForSelector('text=おきばが いっぱい！', { timeout: 10000 });
  // 出た直後の連打は無視される（ボタンは押せない）
  const disabledAtFirst = await page.$eval('button:has-text("つづきから")', b => b.disabled);
  check('result buttons ignore taps right after appearing', disabledAtFirst);
  await page.screenshot({ path: `${OUT}/neji-failed.png` });
  await page.click('button:has-text("つづきから")');
  await answerQuiz(page);
  await page.waitForTimeout(500);
  const after = await hudText(page);
  check('rewound 3 moves after quiz', after.includes('のこり 11') && after.includes('おきば 4/6'), after);
  check('result overlay closed', (await page.$('text=おきばが いっぱい！')) === null);
  await page.screenshot({ path: `${OUT}/neji-continued.png` });

  await browser.close();
  process.exit(report(errors) ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
