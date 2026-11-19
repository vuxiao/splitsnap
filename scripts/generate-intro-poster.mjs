import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const TARGET_URL = process.argv[2] || 'https://vuxiao.github.io/splitsnap/';
const OUTPUT_PATH =
  process.argv[3] ||
  path.resolve(process.cwd(), 'product-intro-qr.png');
const CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
    });

    await page.goto(TARGET_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    // 等待网页字体就绪，保证海报 Canvas 使用最锐利的瑞士字体渲染
    await page.evaluate(() => document.fonts.ready);

    const dataUrl = await page.evaluate(async (url) => {
      if (typeof window.__generateIntroPoster !== 'function') {
        throw new Error('window.__generateIntroPoster 未挂载');
      }
      return window.__generateIntroPoster(url);
    }, TARGET_URL);

    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('生成海报 DataURL 格式无效');
    }

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(OUTPUT_PATH, buffer);

    // 真实像素级解码校验：先对整张海报运行 jsQR，再在需要时裁剪右下角二维码区域复核
    const png = PNG.sync.read(buffer);
    let decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height
    );

    if (!decoded) {
      // 裁剪右下角票根二维码区 (x: 560..1020, y: 1280..1760) 进行局部精确解码
      const cropX = 560;
      const cropY = 1280;
      const cropW = Math.min(460, png.width - cropX);
      const cropH = Math.min(480, png.height - cropY);
      const cropped = new Uint8ClampedArray(cropW * cropH * 4);
      for (let row = 0; row < cropH; row++) {
        const srcStart = ((cropY + row) * png.width + cropX) * 4;
        const dstStart = row * cropW * 4;
        cropped.set(
          png.data.subarray(srcStart, srcStart + cropW * 4),
          dstStart
        );
      }
      decoded = jsQR(cropped, cropW, cropH);
    }

    if (!decoded || decoded.data !== TARGET_URL) {
      console.error('❌ 产品介绍海报二维码解码校验失败！', {
        expected: TARGET_URL,
        actual: decoded?.data ?? null,
      });
      process.exit(1);
    }

    console.log('✅ 产品介绍二维码海报已生成并完成 jsQR 像素级解码校验：');
    console.log(`   文件路径：${OUTPUT_PATH}`);
    console.log(`   图片尺寸：${png.width}x${png.height}px (${buffer.length} bytes)`);
    console.log(`   解码内容：${decoded.data}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ 生成官方海报失败：', err);
  process.exit(1);
});
