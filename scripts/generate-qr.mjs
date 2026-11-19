import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const TARGET_URL = process.argv[2] || 'https://vuxiao.github.io/splitsnap/';
const OUTPUT_PATH =
  process.argv[3] ||
  path.resolve(process.cwd(), 'qrcode.png');

async function main() {
  await QRCode.toFile(OUTPUT_PATH, TARGET_URL, {
    type: 'png',
    width: 600,
    margin: 3,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#141413',
      light: '#FFFDF9',
    },
  });

  // 立即读取 PNG 并用 jsQR 进行真实像素解码校验
  const buffer = fs.readFileSync(OUTPUT_PATH);
  const png = PNG.sync.read(buffer);
  const decoded = jsQR(
    new Uint8ClampedArray(png.data),
    png.width,
    png.height
  );

  if (!decoded || decoded.data !== TARGET_URL) {
    console.error('❌ 二维码解码校验失败！', {
      expected: TARGET_URL,
      actual: decoded?.data ?? null,
    });
    process.exit(1);
  }

  console.log(`✅ 高清入口二维码已生成并解码校验通过：`);
  console.log(`   文件路径：${OUTPUT_PATH}`);
  console.log(`   图片尺寸：${png.width}x${png.height}px (${buffer.length} bytes)`);
  console.log(`   解码内容：${decoded.data}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
