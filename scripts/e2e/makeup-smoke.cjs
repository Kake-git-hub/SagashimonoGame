// マジックメイクミラー: ホームのカード → はじめに → カメラ許可（偽カメラ）→ ミラー画面に映像が出る → もどる でカメラが止まる
const { launch, gotoHome, report, OUT } = require('./common.cjs');

(async () => {
  for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['tablet-landscape', { width: 1024, height: 768 }]]) {
    const { browser, page, errors } = await launch(viewport, { fakeCamera: true });
    await gotoHome(page);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('text=カメラを つかう');
    await page.screenshot({ path: `${OUT}/${label}-makeup-intro.png` });
    // 出てすぐはボタンが押せない（連打対策）
    await page.waitForFunction(() => !document.querySelector('.mmm-primary-button').disabled);
    await page.click('text=カメラを つかう');
    await page.waitForSelector('.mmm-video');
    await page.waitForFunction(() => {
      const v = document.querySelector('.mmm-video');
      return v && v.videoWidth > 0 && v.readyState >= 2;
    }, null, { timeout: 15000 });
    const size = await page.$eval('.mmm-video', v => `${v.videoWidth}x${v.videoHeight}`);
    const status = await page.textContent('.mmm-status');
    console.log(label, 'video', size, '| status:', status);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${label}-makeup-mirror.png` });
    // もどる → はじめに に戻り、カメラのトラックが止まっている
    await page.click('button[aria-label="もどる"]');
    await page.waitForSelector('text=カメラを つかう');
    const live = await page.evaluate(() => {
      const v = document.querySelector('.mmm-video');
      return v && v.srcObject ? v.srcObject.getTracks().filter(t => t.readyState === 'live').length : 0;
    });
    console.log(label, 'live tracks after back:', live);
    if (live > 0) errors.push('camera still running after back');
    await page.click('button[aria-label="ホームへもどる"]');
    await page.waitForSelector('text=あそぶゲームをえらんでね');
    await browser.close();
    if (!report(errors)) process.exit(1);
  }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
