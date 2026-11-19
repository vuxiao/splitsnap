import QRCode from 'qrcode';

export const OFFICIAL_PUBLIC_URL = 'https://vuxiao.github.io/splitsnap/';

const POSTER_W = 1080;
const POSTER_H = 1920;

const FONT_SANS =
  '"Space Grotesk", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif';
const FONT_MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/**
 * 获取用于官方宣传海报的公网根地址（剥离单次账单的 #s= / ?s= 参数）。
 * 本地开发预览时自动指向正式公网 HTTPS 入口，确保海报二维码始终公网可用。
 */
export function getOfficialRootUrl(overrideUrl?: string): string {
  if (overrideUrl) return overrideUrl;
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin, pathname } = window.location;
    if (
      protocol === 'https:' &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1'
    ) {
      const normalizedPath = pathname.endsWith('/')
        ? pathname
        : pathname.replace(/\/[^/]*$/, '/');
      return `${origin}${normalizedPath}`;
    }
  }
  return OFFICIAL_PUBLIC_URL;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color = '#CFC8BA',
  lineWidth = 2.5
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawDoubleRule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number
) {
  ctx.save();
  ctx.strokeStyle = '#141413';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, y + 7);
  ctx.lineTo(x2, y + 7);
  ctx.stroke();
  ctx.restore();
}

function drawRegistrationMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20, 20, 19, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawReceiptBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const toothW = 22;
  const toothH = 14;
  const count = Math.floor(w / toothW);
  const actualToothW = w / count;

  ctx.save();
  ctx.shadowColor = 'rgba(20, 20, 19, 0.16)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 20;

  ctx.beginPath();
  // 顶部平齐插入出纸槽
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  // 右侧直边
  ctx.lineTo(x + w, y + h - toothH);
  // 底部锯齿撕裂边
  for (let i = count - 1; i >= 0; i--) {
    const tx = x + i * actualToothW;
    ctx.lineTo(tx + actualToothW / 2, y + h);
    ctx.lineTo(tx, y + h - toothH);
  }
  ctx.closePath();

  ctx.fillStyle = '#FCF9F2';
  ctx.fill();
  ctx.restore();

  // 顶部出纸口投射在纸面上的逼真内阴影
  ctx.save();
  const topGrad = ctx.createLinearGradient(0, y, 0, y + 34);
  topGrad.addColorStop(0, 'rgba(20, 20, 19, 0.14)');
  topGrad.addColorStop(0.55, 'rgba(20, 20, 19, 0.04)');
  topGrad.addColorStop(1, 'rgba(20, 20, 19, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(x, y, w, 34);

  // 细腻纸张颗粒噪点
  ctx.fillStyle = 'rgba(20, 20, 19, 0.02)';
  for (let py = y + 20; py < y + h - 22; py += 20) {
    for (let px = x + 16; px < x + w - 16; px += 22) {
      if ((px * 3 + py) % 5 === 0) {
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }
  ctx.restore();
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const pattern = [
    3, 2, 1, 2, 4, 1, 2, 1, 3, 2, 1, 3, 2, 1, 4, 2, 1, 2, 3, 1, 2, 3, 1, 2, 4,
    1, 2, 1, 3, 2, 2, 1, 3, 1, 2, 2,
  ];
  const totalUnits = pattern.reduce((a, b) => a + b, 0);
  const unitW = width / totalUnits;
  let curX = x;

  ctx.save();
  ctx.fillStyle = '#141413';
  pattern.forEach((units, idx) => {
    const barW = units * unitW;
    if (idx % 2 === 0) {
      ctx.fillRect(curX, y, Math.max(1.5, barW - 0.5), height);
    }
    curX += barW;
  });
  ctx.restore();
}

/**
 * 绘制「乱账 7 笔 ➔ 算法精简 2 笔」瑞士信息图卡片
 */
function drawCompressionDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  drawRoundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = '#F3EFE6';
  ctx.fill();
  ctx.strokeStyle = '#DED8CC';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 顶部小标题栏
  ctx.fillStyle = '#68645B';
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('MIN-CASH-FLOW ENGINE // 最小现金流压缩算法', x + 28, y + 38);

  // 左盒：7 笔交叉乱账
  const leftBoxX = x + 28;
  const boxY = y + 58;
  const boxW = 326;
  const boxH = h - 84;

  drawRoundedRect(ctx, leftBoxX, boxY, boxW, boxH, 14);
  ctx.fillStyle = '#FCF9F2';
  ctx.fill();
  ctx.strokeStyle = '#DED8CC';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 左侧交叉网络图（4 节点 7 条虚线）
  const nodesL = [
    { cx: leftBoxX + 74, cy: boxY + 52, label: 'A' },
    { cx: leftBoxX + 252, cy: boxY + 52, label: 'B' },
    { cx: leftBoxX + 74, cy: boxY + 132, label: 'C' },
    { cx: leftBoxX + 252, cy: boxY + 132, label: 'D' },
  ];
  const chaoticEdges: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [0, 2],
    [1, 3],
    [2, 0],
  ];
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 77, 26, 0.45)';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([5, 4]);
  for (const [a, b] of chaoticEdges) {
    ctx.beginPath();
    ctx.moveTo(nodesL[a].cx, nodesL[a].cy);
    ctx.lineTo(nodesL[b].cx, nodesL[b].cy);
    ctx.stroke();
  }
  ctx.restore();

  for (const n of nodesL) {
    ctx.beginPath();
    ctx.arc(n.cx, n.cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#141413';
    ctx.fill();
    ctx.fillStyle = '#FCF9F2';
    ctx.font = `700 17px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(n.label, n.cx, n.cy + 6);
  }

  ctx.textAlign = 'center';
  ctx.font = `700 22px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText('多人交叉垫付', leftBoxX + boxW / 2, boxY + 185);
  ctx.font = `700 20px ${FONT_MONO}`;
  ctx.fillStyle = '#FF4D1A';
  ctx.fillText('7 笔往来乱账', leftBoxX + boxW / 2, boxY + 216);

  // 中间信号橙大箭头
  const midX = x + w / 2;
  const midY = boxY + boxH / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(midX, midY, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#FF4D1A';
  ctx.fill();
  ctx.strokeStyle = '#FCF9F2';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(midX - 13, midY);
  ctx.lineTo(midX + 12, midY);
  ctx.moveTo(midX + 3, midY - 10);
  ctx.lineTo(midX + 13, midY);
  ctx.lineTo(midX + 3, midY + 10);
  ctx.stroke();
  ctx.restore();

  // 右盒：2 笔结清
  const rightBoxX = x + w - 28 - boxW;
  drawRoundedRect(ctx, rightBoxX, boxY, boxW, boxH, 14);
  ctx.fillStyle = '#EFF8F4';
  ctx.fill();
  ctx.strokeStyle = '#0D9468';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 两条干净的邮政绿直连线
  const rRow1Y = boxY + 58;
  const rRow2Y = boxY + 124;
  const drawCleanFlow = (ry: number, from: string, to: string, amt: string) => {
    const lx = rightBoxX + 44;
    const rx = rightBoxX + 168;
    ctx.beginPath();
    ctx.arc(lx, ry, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#FCF9F2';
    ctx.fill();
    ctx.strokeStyle = '#0D9468';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#0D9468';
    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(from, lx, ry + 6);

    ctx.strokeStyle = '#0D9468';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx + 24, ry);
    ctx.lineTo(rx - 24, ry);
    ctx.moveTo(rx - 33, ry - 7);
    ctx.lineTo(rx - 23, ry);
    ctx.lineTo(rx - 33, ry + 7);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rx, ry, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#0D9468';
    ctx.fill();
    ctx.fillStyle = '#FCF9F2';
    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(to, rx, ry + 6);

    ctx.textAlign = 'right';
    ctx.font = `700 20px ${FONT_MONO}`;
    ctx.fillStyle = '#0D9468';
    ctx.fillText(amt, rightBoxX + boxW - 22, ry + 7);
  };

  drawCleanFlow(rRow1Y, 'C', 'A', '¥145');
  drawCleanFlow(rRow2Y, 'D', 'B', '¥60');

  ctx.textAlign = 'center';
  ctx.font = `700 22px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText('算法精简最优解', rightBoxX + boxW / 2, boxY + 185);
  ctx.font = `700 20px ${FONT_MONO}`;
  ctx.fillStyle = '#0D9468';
  ctx.fillText('仅需 2 笔彻底结清', rightBoxX + boxW / 2, boxY + 216);
}

/**
 * 生成 1080×1920 高清竖版「极速分账 · SplitSnap 产品介绍二维码海报」
 * 底部票根右下角嵌入公网根地址二维码（H 级容错，高对比静区保证扫码秒开）
 */
export async function generateIntroPosterImage(
  publicUrlOverride?: string
): Promise<string> {
  const targetUrl = getOfficialRootUrl(publicUrlOverride);

  // 先生成高清公网入口二维码离屏 Canvas
  const qrSize = 276;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, targetUrl, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#141413',
      light: '#FFFFFF',
    },
  });

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // ====== 1. 海报暖灰纸板底与瑞士暗网格 ======
  ctx.fillStyle = '#E6E1D6';
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  ctx.save();
  ctx.strokeStyle = 'rgba(20, 20, 19, 0.045)';
  ctx.lineWidth = 1;
  for (let gx = 60; gx < POSTER_W; gx += 60) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, POSTER_H);
    ctx.stroke();
  }
  for (let gy = 60; gy < POSTER_H; gy += 60) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(POSTER_W, gy);
    ctx.stroke();
  }
  ctx.restore();

  // 四角印刷套准标记 + 顶底极简工业边栏
  drawRegistrationMark(ctx, 48, 48);
  drawRegistrationMark(ctx, POSTER_W - 48, 48);
  drawRegistrationMark(ctx, 48, POSTER_H - 48);
  drawRegistrationMark(ctx, POSTER_W - 48, POSTER_H - 48);

  ctx.fillStyle = '#68645B';
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    'SWISS RECEIPT UTILITY  //  NO LOGIN  //  ZERO BACKEND',
    POSTER_W / 2,
    54
  );

  // ====== 2. 顶部拟真金属热敏机出纸槽 ======
  const slotOuterX = 56;
  const slotOuterY = 92;
  const slotOuterW = POSTER_W - 112;
  const slotOuterH = 74;

  drawRoundedRect(ctx, slotOuterX, slotOuterY, slotOuterW, slotOuterH, 18);
  const metalGrad = ctx.createLinearGradient(0, slotOuterY, 0, slotOuterY + slotOuterH);
  metalGrad.addColorStop(0, '#262624');
  metalGrad.addColorStop(0.55, '#171715');
  metalGrad.addColorStop(1, '#10100F');
  ctx.fillStyle = metalGrad;
  ctx.fill();

  // 机身上沿指示灯与工业型号字样
  ctx.beginPath();
  ctx.arc(slotOuterX + 34, slotOuterY + 26, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0D9468';
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = `700 15px ${FONT_MONO}`;
  ctx.fillStyle = '#A8A399';
  ctx.fillText('THERMAL PRINTER // MODEL SS-01', slotOuterX + 52, slotOuterY + 31);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#FF4D1A';
  ctx.fillText('READY · 2026', slotOuterX + slotOuterW - 28, slotOuterY + 31);

  // 内凹深黑出纸缝隙
  drawRoundedRect(ctx, slotOuterX + 22, slotOuterY + 46, slotOuterW - 44, 16, 8);
  ctx.fillStyle = '#070706';
  ctx.fill();

  // ====== 3. 从出纸口吐出的立体热敏纸说明书主体 ======
  const rx = 86;
  const ry = slotOuterY + 54;
  const rw = POSTER_W - 172; // 908px
  const rh = 1696;
  drawReceiptBody(ctx, rx, ry, rw, rh);

  const left = rx + 54;
  const right = rx + rw - 54;
  const contentW = right - left; // 800px
  const centerX = rx + rw / 2;

  let y = ry + 64;

  // 顶部票据元信息栏
  ctx.textAlign = 'left';
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText('OFFICIAL GUIDE // 产品说明书', left, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#141413';
  ctx.fillText('NO. SS-2026-PRO', right, y);

  y += 24;
  drawDoubleRule(ctx, left, right, y);
  y += 78;

  // 品牌超大瑞士标题 + 橙色英文字标
  ctx.textAlign = 'left';
  ctx.font = `700 84px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText('极速分账', left, y);

  // 右侧复古信号橙印章徽标
  drawRoundedRect(ctx, right - 224, y - 62, 224, 58, 12);
  ctx.fillStyle = '#FF4D1A';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = `700 28px ${FONT_MONO}`;
  ctx.fillStyle = '#FFFDF9';
  ctx.fillText('SPLITSNAP', right - 112, y - 24);

  y += 50;
  ctx.textAlign = 'left';
  ctx.font = `600 31px ${FONT_SANS}`;
  ctx.fillStyle = '#4A463F';
  ctx.fillText('聚餐旅行 AA 乱账，30 秒压缩成最少转账', left, y);

  y += 38;
  drawDashedLine(ctx, left, right, y);
  y += 34;

  // ====== 4. 核心算法对比信息图（7 笔乱账 ➔ 2 笔结清） ======
  drawCompressionDiagram(ctx, left, y, contentW, 314);
  y += 352;

  // ====== 5. 三条瑞士网格特性清单 ======
  ctx.textAlign = 'left';
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText('FEATURES // 三大核心能力', left, y);
  y += 22;
  drawDoubleRule(ctx, left, right, y);
  y += 46;

  const features = [
    {
      num: '01',
      accent: '#FF4D1A',
      title: '灵活均摊 · 排除不喝酒成员',
      desc: '单手勾选参与人，支持「+」号连加合算与自定义金额校验，0.01 元公平轮转绝不差一分。',
    },
    {
      num: '02',
      accent: '#0D9468',
      title: '零后端扫码同步 · 微信直看',
      desc: '整本账经 LZ 压缩进链接与二维码，无需注册登录，同桌扫码秒看明细并一键存副本。',
    },
    {
      num: '03',
      accent: '#141413',
      title: '高颜值热敏小票长图导出',
      desc: '一键打印带锯齿撕裂边、已结清印章与账单码的电子小票，发微信群明算账不伤感情。',
    },
  ];

  features.forEach((feat, idx) => {
    // 编号徽章
    drawRoundedRect(ctx, left, y - 34, 72, 48, 10);
    ctx.fillStyle = feat.accent;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `700 26px ${FONT_MONO}`;
    ctx.fillStyle = '#FFFDF9';
    ctx.fillText(feat.num, left + 36, y - 1);

    // 特性标题
    const textX = left + 96;
    ctx.textAlign = 'left';
    ctx.font = `700 30px ${FONT_SANS}`;
    ctx.fillStyle = '#141413';
    ctx.fillText(feat.title, textX, y - 4);

    // 特性说明（双行精排）
    ctx.font = `500 22px ${FONT_SANS}`;
    ctx.fillStyle = '#68645B';
    const maxLineW = right - textX;
    let line1 = '';
    let line2 = '';
    for (const ch of feat.desc) {
      if (!line2 && ctx.measureText(line1 + ch).width <= maxLineW) {
        line1 += ch;
      } else {
        line2 += ch;
      }
    }
    ctx.fillText(line1, textX, y + 36);
    if (line2) {
      ctx.fillText(line2, textX, y + 68);
    }

    y += 108;
    if (idx < features.length - 1) {
      drawDashedLine(ctx, left, right, y - 14, '#E2DCD0', 1.8);
      y += 28;
    }
  });

  y += 22;

  // ====== 6. 撕裂虚线与票根扫码区（右下角公网入口二维码） ======
  // 左右半圆票根缺口营造真实撕票感
  ctx.save();
  ctx.fillStyle = '#E6E1D6';
  ctx.beginPath();
  ctx.arc(rx, y, 18, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rx + rw, y, 18, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.fill();
  ctx.restore();

  drawDashedLine(ctx, rx + 26, rx + rw - 26, y, '#BDB6A7', 2.5);
  y += 46;

  // 右下角高清二维码卡片
  const qrCardSize = qrSize + 28;
  const qrCardX = right - qrCardSize;
  const qrCardY = y;

  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#141413';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.drawImage(qrCanvas, qrCardX + 14, qrCardY + 14, qrSize, qrSize);

  // 左侧扫码文案与引导
  const leftColW = qrCardX - left - 32;
  ctx.textAlign = 'left';

  drawRoundedRect(ctx, left, y + 4, 186, 36, 8);
  ctx.fillStyle = '#FFF0EB';
  ctx.fill();
  ctx.font = `700 17px ${FONT_MONO}`;
  ctx.fillStyle = '#FF4D1A';
  ctx.fillText('SCAN TO LAUNCH', left + 16, y + 28);

  ctx.font = `700 42px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText('微信扫码立即算账', left, y + 98);

  ctx.font = `500 23px ${FONT_SANS}`;
  ctx.fillStyle = '#4A463F';
  ctx.fillText('✓ 免费开源 · 打开浏览器即用', left, y + 146);
  ctx.fillText('✓ 无需下载 App · 无需注册登录', left, y + 184);
  ctx.fillText('✓ 本地离线保存 · 随时回顾历史局', left, y + 222);

  // 公网短网址胶囊
  const displayUrl = targetUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  drawRoundedRect(ctx, left, y + 248, Math.min(leftColW, 444), 48, 10);
  ctx.fillStyle = '#F3EFE6';
  ctx.fill();
  ctx.strokeStyle = '#DED8CC';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = `600 20px ${FONT_MONO}`;
  ctx.fillStyle = '#141413';
  ctx.fillText(displayUrl, left + 18, y + 280);

  // 底部条形码装饰 + 收尾语
  const barcodeY = qrCardY + qrCardSize + 44;
  drawBarcode(ctx, centerX - 200, barcodeY, 400, 48);

  ctx.textAlign = 'center';
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText(
    'SPLITSNAP · 聚餐旅行明算账 · 扫码推荐给身边的朋友',
    centerX,
    barcodeY + 80
  );

  // 海报最底边页脚
  ctx.font = `600 16px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText('SWISS GRID × THERMAL RECEIPT  ·  1080×1920', POSTER_W / 2, POSTER_H - 36);

  return canvas.toDataURL('image/png');
}
