// ホーム画面、さがしものゲームの一覧とゲーム画面、ネジはずしの一覧が表示できる
const { launch, report, OUT, BASE } = require('./common.cjs');

(async () => {
  for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 1024, height: 768 }]]) {
    const { browser, page, errors } = await launch(viewport);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=あそぶゲームをえらんでね');
    await page.waitForTimeout(500);
    console.log(label, 'home counts:', (await page.$$eval('text=/クリア/', els => els.map(e => e.textContent))).join(' | '));
    await page.screenshot({ path: `${OUT}/${label}-home.png` });
    await page.click('text=さがしものゲーム');
    await page.waitForSelector('text=パズルをえらんでね');
    await page.screenshot({ path: `${OUT}/${label}-sagashimono-list.png` });
    await page.click('text=おもちゃのへや');
    await page.waitForSelector('img[alt="おもちゃのへや"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${label}-sagashimono-game.png` });
    await page.click('button:has-text("←")');
    await page.waitForSelector('text=パズルをえらんでね');
    await page.click('button[aria-label="ホームへもどる"]');
    await page.waitForSelector('text=あそぶゲームをえらんでね');
    await page.click('text=ネジはずし');
    await page.waitForSelector('text=ステージをえらんでね');
    await page.screenshot({ path: `${OUT}/${label}-neji-list.png` });
    await browser.close();
    if (!report(errors)) process.exit(1);
  }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
