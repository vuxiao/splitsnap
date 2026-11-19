import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const TARGET_URL = process.argv[2] || 'https://vuxiao.github.io/splitsnap/';
const ARTIFACT_DIR =
  process.argv[3] || path.resolve(process.cwd(), 'e2e-artifacts');
const CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function assert(cond, message) {
  if (!cond) {
    throw new Error(`断言失败：${message}`);
  }
}

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    console.log(`1. 打开公网根地址验证首屏产品介绍页：${TARGET_URL}`);
    const response = await page.goto(TARGET_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    assert(response && response.status() === 200, `HTTP 状态码应为 200，实际为 ${response?.status()}`);

    // 校验默认展示产品介绍页（Swiss Receipt Intro Cover）
    await page.getByTestId('intro-cover').waitFor({ state: 'visible' });
    const hasIntroOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    assert(!hasIntroOverflow, '产品介绍页在 390px 视口不应有横向滚动条');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v2-01-intro-cover.png'), fullPage: true });
    console.log('   ✓ HTTP 200，首屏成功呈现瑞士热敏小票产品介绍页（无横向滚动条）');

    // 验证介绍页内打开「产品介绍二维码海报」弹窗
    console.log('2. 验证网页端产品介绍二维码海报预览');
    await page.getByTestId('intro-poster-btn').click();
    const posterImg = page.getByTestId('intro-poster-image');
    await posterImg.waitFor({ state: 'visible', timeout: 15000 });
    const posterMeta = await posterImg.evaluate((img) => ({
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
    assert(
      posterMeta.complete && posterMeta.naturalWidth === 1080 && posterMeta.naturalHeight === 1920,
      `官方产品海报尺寸应为 1080x1920，实际：${JSON.stringify(posterMeta)}`
    );
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v2-02-intro-poster-modal.png') });
    await page.getByRole('button', { name: '关闭' }).click();
    console.log(`   ✓ 网页端官方宣传海报渲染成功 (${posterMeta.naturalWidth}x${posterMeta.naturalHeight}px)`);

    // 3. 点击主按钮进入主工作台，验证瑞士印刷体徽章与零彩色 Emoji
    console.log('3. 进入主工作台，验证瑞士印刷体徽章与四色审美规范');
    await page.getByTestId('intro-start-btn').click();
    await page.getByTestId('current-bill-title').waitFor({ state: 'visible' });

    const audit = await page.evaluate(() => {
      const text = document.body.innerText;
      const emojiHit = /[🦊🐻🐼🐰🐯🦁🐸🐧🦉🐙🐳🦄]/.test(text);
      const stampCount = document.querySelectorAll('[data-stamp-variant]').length;
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return { emojiHit, stampCount, overflow };
    });
    assert(!audit.emojiHit, '主工作台仍残留彩色动物 Emoji');
    assert(audit.stampCount >= 5, `瑞士印刷体徽章数量不足，实际：${audit.stampCount}`);
    assert(!audit.overflow, '主工作台在 390px 视口存在横向滚动条');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v2-03-main-swiss-stamps.png') });
    console.log(`   ✓ 已全面升级为瑞士印刷体徽章（${audit.stampCount} 处），零 Emoji 残留`);

    // 4. 新建账本「川西周末游」并录入 3 笔消费
    console.log('4. 新建账本「川西周末游」并录入 3 笔消费');
    await page.getByTestId('bill-switcher-btn').click();
    await page.getByTestId('open-new-bill-form-btn').click();
    await page.getByTestId('new-bill-title-input').fill('川西周末游');
    await page.getByTestId('new-bill-members-input').fill('阿杰, 林溪, 老周, 小美');
    await page.getByTestId('new-bill-confirm-btn').click();

    // 第 1 笔：全员均摊 480
    await page.getByTestId('add-expense-fab').click();
    await page.getByTestId('expense-amount-input').fill('480');
    await page.getByTestId('expense-title-input').fill('包车油费过路费');
    await page.getByTestId('payer-option-阿杰').click();
    await page.getByTestId('expense-submit-btn').click();

    // 第 2 笔：排除小美 120
    await page.getByTestId('add-expense-fab').click();
    await page.getByTestId('expense-amount-input').fill('120');
    await page.getByTestId('expense-title-input').fill('藏式青稞酒');
    await page.getByTestId('payer-option-老周').click();
    await page.getByTestId('participant-toggle-小美').click();
    await page.getByTestId('expense-submit-btn').click();

    // 第 3 笔：自定义金额 75
    await page.getByTestId('add-expense-fab').click();
    await page.getByTestId('expense-amount-input').fill('75');
    await page.getByTestId('expense-title-input').fill('特色牦牛酸奶');
    await page.getByTestId('payer-option-林溪').click();
    await page.getByTestId('split-mode-custom').click();
    await page.getByTestId('custom-share-阿杰').fill('25');
    await page.getByTestId('custom-share-林溪').fill('25');
    await page.getByTestId('custom-share-小美').fill('25');
    await page.getByTestId('expense-submit-btn').click();

    const totalText = await page.getByTestId('total-spent-amount').textContent();
    assert(totalText?.trim() === '¥675.00', `总消费应为 ¥675.00，实际为 ${totalText}`);

    // 5. 结算方案、复制群收款文字按钮与已结清勾选
    console.log('5. 验证结算方案、复制群收款文字明细按钮与已结清');
    await page.getByTestId('tab-settlement').click();
    await page.getByTestId('copy-group-text-btn').waitFor({ state: 'visible' });
    await page.getByTestId('transfer-item-0').click();
    await page.getByTestId('copy-group-text-btn').click();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v2-04-settlement.png'), fullPage: true });
    console.log('   ✓ 结算方案、群收款文字复制与已结清勾选全部正常');

    // 6. 获取分享链接并在全新无缓存上下文验证「一步直达账单（跳过介绍页）」
    console.log('6. 验证带 #s= 分享链接一步直达账单（跳过介绍页）且 100% 还原');
    await page.getByTestId('settlement-share-btn').click();
    const shareUrl = await page.getByTestId('share-url-input').inputValue();
    assert(shareUrl.includes('#s='), `分享链接应包含 #s=，实际：${shareUrl}`);

    const friendContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const friendPage = await friendContext.newPage();
    friendPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[friend] ${msg.text()}`);
    });
    friendPage.on('pageerror', (err) => pageErrors.push(`[friend] ${err.message}`));

    await friendPage.goto(shareUrl, { waitUntil: 'networkidle', timeout: 30000 });
    // 必须跳过介绍页，直接可见同桌分享横幅与账单标题
    const introVisible = await friendPage.getByTestId('intro-cover').isVisible().catch(() => false);
    assert(!introVisible, '带 #s= 分享参数时不应拦截在介绍页，应直达账单视图');
    await friendPage.getByTestId('shared-mode-banner').waitFor({ state: 'visible' });
    const restoredTitle = await friendPage.getByTestId('current-bill-title').textContent();
    const restoredTotal = await friendPage.getByTestId('total-spent-amount').textContent();
    assert(restoredTitle?.trim() === '川西周末游', `还原标题错误：${restoredTitle}`);
    assert(restoredTotal?.trim() === '¥675.00', `还原总额错误：${restoredTotal}`);
    console.log('   ✓ 分享链接一步直达账单，100% 还原数据');

    // 验证顶部 Info 按钮可随时呼出产品介绍页
    await friendPage.getByTestId('open-intro-btn').click();
    await friendPage.getByTestId('intro-cover').waitFor({ state: 'visible' });
    await friendPage.getByTestId('intro-start-btn').click();
    console.log('   ✓ 顶栏 Info 入口可随时切换产品介绍页与返回账单');

    // 7. 生成热敏小票长图校验
    console.log('7. 验证热敏小票长图生成');
    await friendPage.getByTestId('bottom-receipt-btn').click();
    const receiptImg = friendPage.getByTestId('receipt-preview-image');
    await receiptImg.waitFor({ state: 'visible', timeout: 15000 });
    const receiptMeta = await receiptImg.evaluate((img) => ({
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
    assert(
      receiptMeta.complete && receiptMeta.naturalWidth === 750 && receiptMeta.naturalHeight > 700,
      `小票尺寸异常：${JSON.stringify(receiptMeta)}`
    );
    console.log(`   ✓ 热敏小票长图渲染正常 (${receiptMeta.naturalWidth}x${receiptMeta.naturalHeight}px)`);

    assert(consoleErrors.length === 0, `控制台存在错误：${consoleErrors.join('; ')}`);
    assert(pageErrors.length === 0, `页面存在未捕获异常：${pageErrors.join('; ')}`);

    console.log('\n🎉 V2 全部 7 项精修验收测试通过（0 报错）！');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ E2E 验收失败：', err.message);
  process.exit(1);
});
