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
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
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
    // レイアウト: 映像が画面の真ん中に来る（横向きはパレットが左右、縦向きはパレットが下）
    const layout = await page.evaluate(() => {
      const r = sel => { const b = document.querySelector(sel).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
      return { stage: r('.mmm-stage'), parts: r('.mmm-parts'), swatches: r('.mmm-swatches'), vw: innerWidth };
    });
    const stageCenter = (layout.stage.left + layout.stage.right) / 2;
    console.log(label, 'layout: stage', `${Math.round(layout.stage.left)}-${Math.round(layout.stage.right)}`, 'of', layout.vw);
    if (Math.abs(stageCenter - layout.vw / 2) > 2) errors.push(`stage is not centred: ${stageCenter} of ${layout.vw}`);
    if (label === 'tablet-landscape') {
      if (!(layout.parts.right <= layout.stage.left + 1)) errors.push('landscape: the parts palette should be left of the stage');
      if (!(layout.swatches.left >= layout.stage.right - 1)) errors.push('landscape: the colour palette should be right of the stage');
    } else if (!(layout.parts.top >= layout.stage.bottom - 1 && layout.swatches.top >= layout.stage.bottom - 1)) {
      errors.push('portrait: the palettes should be below the stage');
    }
    // せってい に、落ちる原因を切り分けるスイッチと、デバッグの記録を開くボタンがある
    await page.click('button[aria-label="せってい"]');
    await page.waitForSelector('.mmm-setting-row:has-text("かおを みつけない")');
    await page.click('button:has-text("デバッグの きろくを みる")');
    await page.waitForSelector('[data-testid="debug-log"]');
    const log = await page.textContent('[data-testid="debug-log"]');
    for (const needle of ['=== きどう ===', '[makeup] がめん: mirror', '[makeup] カメラ: はじまった', '[makeup] にんしき: よみこみ']) {
      if (!log.includes(needle)) errors.push(`debug log is missing "${needle}"`);
    }
    await page.click('[role="dialog"][aria-label="デバッグ"] button:has-text("とじる")');
    await page.click('.mmm-sheet button:has-text("とじる")');
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
    // ホームからもデバッグの記録を開ける
    await page.click('button[aria-label="デバッグ"]');
    await page.waitForSelector('[data-testid="debug-log"]');
    await page.click('[role="dialog"][aria-label="デバッグ"] button:has-text("とじる")');

    // ミラー画面を開いたまま落ちたことにして開き直す → はじめに に「まえに とまった」と出て、記録に手がかりが残っている
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('.mmm-primary-button:not([disabled])');
    await page.click('text=カメラを つかう');
    await page.waitForSelector('.mmm-video');
    await page.waitForTimeout(500);
    // 落ちたときは pagehide が来ないので、「画面を表示したまま終わった」印が残る。それをまねる
    // （ページを移るときは普通に閉じた扱いになるので、次に開く直前に印を付け直す）
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e_fake_crash')) {
        sessionStorage.removeItem('e2e_fake_crash');
        localStorage.setItem('asobi_debug_alive', '1');
      }
    });
    await page.evaluate(() => sessionStorage.setItem('e2e_fake_crash', '1'));
    await gotoHome(page);
    await page.click('text=マジックメイクミラー');
    await page.waitForSelector('text=とちゅうで とまってしまったみたい');
    await page.click('.mmm-intro-error button:has-text("デバッグの きろくを みる")');
    const crashLog = await page.textContent('[data-testid="debug-log"]');
    if (!crashLog.includes('まえの かいは とちゅうで おわった')) errors.push('crash was not recorded in the debug log');
    console.log(label, 'crash notice: ok');
    await browser.close();
    if (!report(errors)) process.exit(1);
  }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
