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

    console.log(`1. 打开公网地址：${TARGET_URL}`);
    const response = await page.goto(TARGET_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    assert(response && response.status() === 200, `HTTP 状态码应为 200，实际为 ${response?.status()}`);

    // 校验 390px 视口无横向滚动条
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    assert(!hasHorizontalOverflow, '390px 移动端视口不应存在横向滚动条');
    console.log('   ✓ HTTP 200，390x844 无横向滚动条');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01-home-sample.png') });

    // 2. 新建账本「川西周末游」
    console.log('2. 新建账本「川西周末游」');
    await page.getByTestId('bill-switcher-btn').click();
    await page.getByTestId('open-new-bill-form-btn').click();
    await page.getByTestId('new-bill-title-input').fill('川西周末游');
    await page.getByTestId('new-bill-members-input').fill('阿杰, 林溪, 老周, 小美');
    await page.getByTestId('new-bill-confirm-btn').click();

    const billTitle = await page.getByTestId('current-bill-title').textContent();
    assert(billTitle?.trim() === '川西周末游', `账本标题应为川西周末游，实际为 ${billTitle}`);
    console.log('   ✓ 账本创建成功');

    // 3. 录入 3 笔消费（全员均摊 + 排除不喝酒成员 + 自定义金额）
    console.log('3. 录入 3 笔消费');

    // 第 1 笔：均摊全员 480 元（阿杰垫付）
    await page.getByTestId('add-expense-fab').click();
    await page.getByTestId('expense-amount-input').fill('480');
    await page.getByTestId('expense-title-input').fill('包车油费过路费');
    await page.getByTestId('payer-option-阿杰').click();
    await page.getByTestId('expense-submit-btn').click();

    // 第 2 笔：均摊排除小美 120 元（老周垫付）
    await page.getByTestId('add-expense-fab').click();
    await page.getByTestId('expense-amount-input').fill('120');
    await page.getByTestId('expense-title-input').fill('藏式青稞酒');
    await page.getByTestId('payer-option-老周').click();
    await page.getByTestId('participant-toggle-小美').click(); // 排除小美
    await page.getByTestId('expense-submit-btn').click();

    // 第 3 笔：自定义金额 75 元（林溪垫付：阿杰25、林溪25、小美25）
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
    console.log(`   ✓ 3 笔消费录入完成，总消费 ${totalText}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02-expenses-list.png') });

    // 4. 查看结算方案 & 勾选第一笔为已结清
    console.log('4. 切换结算方案并勾选已结清');
    await page.getByTestId('tab-settlement').click();
    const firstTransfer = page.getByTestId('transfer-item-0');
    await firstTransfer.waitFor({ state: 'visible' });
    const transferText = await firstTransfer.textContent();
    await firstTransfer.click();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03-settlement.png') });
    console.log(`   ✓ 结算方案渲染成功，已勾选首笔：${transferText?.replace(/\s+/g, ' ').trim()}`);

    // 5. 生成分享链接 & 校验分享二维码
    console.log('5. 生成分享链接并校验分享二维码');
    await page.getByTestId('settlement-share-btn').click();
    const shareUrl = await page.getByTestId('share-url-input').inputValue();
    assert(shareUrl.includes('#s='), `分享链接应包含 #s= 载荷，实际：${shareUrl}`);
    const qrSrc = await page.getByTestId('share-qr-image').getAttribute('src');
    assert(qrSrc && qrSrc.startsWith('data:image/png;base64,'), '分享二维码图片未正确生成');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04-share-modal.png') });
    console.log(`   ✓ 分享链接已生成（长度 ${shareUrl.length} 字符）`);

    // 6. 在隔离的新浏览器上下文（模拟完全陌生的朋友微信扫码）打开分享链接验证 100% 还原
    console.log('6. 新建无缓存上下文验证分享链接 100% 还原');
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
    await friendPage.getByTestId('shared-mode-banner').waitFor({ state: 'visible' });
    const restoredTitle = await friendPage.getByTestId('current-bill-title').textContent();
    const restoredTotal = await friendPage.getByTestId('total-spent-amount').textContent();
    assert(restoredTitle?.trim() === '川西周末游', `还原标题错误：${restoredTitle}`);
    assert(restoredTotal?.trim() === '¥675.00', `还原总额错误：${restoredTotal}`);

    // 验证已结清状态同步还原（PAID 徽标可见）
    const paidBadgeCount = await friendPage.getByText('PAID', { exact: true }).count();
    assert(paidBadgeCount >= 1, '已结清标记应随分享链接同步还原');

    // 验证明细也全部还原为 3 笔
    await friendPage.getByTestId('tab-expenses').click();
    await friendPage.getByTestId('expense-item-2').waitFor({ state: 'visible' });
    console.log('   ✓ 新标签页 100% 无损还原账本标题、3 笔消费、总额 ¥675.00 与已结清状态');
    await friendPage.screenshot({ path: path.join(ARTIFACT_DIR, '05-shared-restored.png') });

    // 7. 生成热敏小票长图并验证 Canvas 产物
    console.log('7. 生成热敏小票长图并验证尺寸');
    await friendPage.getByTestId('bottom-receipt-btn').click();
    const receiptImg = friendPage.getByTestId('receipt-preview-image');
    await receiptImg.waitFor({ state: 'visible', timeout: 15000 });

    const receiptInfo = await receiptImg.evaluate((img) => ({
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      srcPrefix: img.src.slice(0, 22),
      dataUrl: img.src,
    }));

    assert(
      receiptInfo.complete &&
        receiptInfo.naturalWidth === 750 &&
        receiptInfo.naturalHeight > 700 &&
        receiptInfo.srcPrefix === 'data:image/png;base64,',
      `热敏小票长图渲染异常：${JSON.stringify({ ...receiptInfo, dataUrl: undefined })}`
    );

    // 导出小票长图到验收目录以便人工/视觉检查
    const base64Data = receiptInfo.dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '06-receipt-generated.png'),
      Buffer.from(base64Data, 'base64')
    );
    await friendPage.screenshot({ path: path.join(ARTIFACT_DIR, '06-receipt-modal.png') });
    console.log(
      `   ✓ 热敏小票长图渲染成功 (${receiptInfo.naturalWidth}x${receiptInfo.naturalHeight}px)`
    );

    assert(consoleErrors.length === 0, `控制台存在错误：${consoleErrors.join('; ')}`);
    assert(pageErrors.length === 0, `页面存在未捕获异常：${pageErrors.join('; ')}`);

    console.log('\n🎉 全部 7 项移动端 E2E 验收测试通过（0 报错）！');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ E2E 验收失败：', err.message);
  process.exit(1);
});
