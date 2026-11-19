import QRCode from 'qrcode';
import type { Bill, SettlementResult } from '../types/bill';
import { formatMoney, formatSignedMoney } from './money';
import { buildShareUrl } from './shareCodec';

const CANVAS_WIDTH = 750;
const OUTER_PAD_X = 32;
const OUTER_PAD_Y = 36;
const RECEIPT_WIDTH = CANVAS_WIDTH - OUTER_PAD_X * 2;
const INNER_PAD_X = 34;
const TOOTH_SIZE = 14;
const TOOTH_HEIGHT = 10;

const FONT_SANS =
  '"Space Grotesk", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
const FONT_MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color = '#CFC8BA'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawDoubleSolidLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color = '#141413'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y + 5);
  ctx.lineTo(x2, y + 5);
  ctx.stroke();
  ctx.restore();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function drawZigZagReceiptPaper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const teethCount = Math.floor(w / TOOTH_SIZE);
  const actualToothW = w / teethCount;

  ctx.save();
  ctx.shadowColor = 'rgba(20, 20, 19, 0.14)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;

  ctx.beginPath();
  // 顶部锯齿（从左到右）
  ctx.moveTo(x, y + TOOTH_HEIGHT);
  for (let i = 0; i < teethCount; i++) {
    const tx = x + i * actualToothW;
    ctx.lineTo(tx + actualToothW / 2, y);
    ctx.lineTo(tx + actualToothW, y + TOOTH_HEIGHT);
  }

  // 右侧直边
  ctx.lineTo(x + w, y + h - TOOTH_HEIGHT);

  // 底部锯齿（从右到左）
  for (let i = teethCount - 1; i >= 0; i--) {
    const tx = x + i * actualToothW;
    ctx.lineTo(tx + actualToothW / 2, y + h);
    ctx.lineTo(tx, y + h - TOOTH_HEIGHT);
  }

  // 左侧直边闭合
  ctx.closePath();
  ctx.fillStyle = '#FCF9F2';
  ctx.fill();
  ctx.restore();

  // 叠加细微纸张颗粒感
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(20, 20, 19, 0.018)';
  for (let py = y + 12; py < y + h - 12; py += 16) {
    for (let px = x + 12; px < x + w - 12; px += 18) {
      if ((px + py) % 3 === 0) {
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    }
  }
  ctx.restore();
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

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  seedStr: string
) {
  const widths: number[] = [];
  for (let i = 0; i < 42; i++) {
    const code = seedStr.charCodeAt(i % seedStr.length) + i * 17;
    widths.push((code % 4) + 1.5);
  }
  const totalW = widths.reduce((a, b) => a + b + 2.5, 0);
  let curX = centerX - totalW / 2;

  ctx.save();
  ctx.fillStyle = '#141413';
  for (let i = 0; i < widths.length; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(curX, y, widths[i], 34);
    }
    curX += widths[i] + 2.5;
  }
  ctx.restore();
}

/**
 * 绘制高质感热敏纸小票长图，返回 PNG DataURL
 */
export async function generateReceiptImage(
  bill: Bill,
  settlement: SettlementResult,
  shareUrlOverride?: string
): Promise<string> {
  const memberMap = new Map(bill.members.map((m) => [m.id, m]));
  const shareUrl = shareUrlOverride ?? buildShareUrl(bill);

  // 先生成二维码离屏 Canvas
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, shareUrl, {
    width: 176,
    margin: 1,
    color: {
      dark: '#141413',
      light: '#FCF9F2',
    },
    errorCorrectionLevel: 'M',
  });

  // 预先精确测算总高度
  const headerH = 205;
  const expensesHeaderH = 54;
  const expenseRowH = 68;
  const expensesSectionH =
    expensesHeaderH + Math.max(1, bill.expenses.length) * expenseRowH + 20;
  const totalSectionH = 92;

  const balancesHeaderH = 56;
  const balanceRowH = 44;
  const balancesSectionH =
    balancesHeaderH + Math.max(1, settlement.balances.length) * balanceRowH + 20;

  const transfersHeaderH = 62;
  const transferCardH = 74;
  const transfersSectionH =
    transfersHeaderH +
    (settlement.transfers.length > 0
      ? settlement.transfers.length * (transferCardH + 12)
      : 78) +
    24;

  const qrSectionH = 250;
  const footerBarcodeH = 104;

  const receiptHeight =
    TOOTH_HEIGHT * 2 +
    headerH +
    expensesSectionH +
    totalSectionH +
    balancesSectionH +
    transfersSectionH +
    qrSectionH +
    footerBarcodeH;

  const totalHeight = receiptHeight + OUTER_PAD_Y * 2;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // 外围暖灰桌面背景
  ctx.fillStyle = '#E6E1D6';
  ctx.fillRect(0, 0, CANVAS_WIDTH, totalHeight);

  // 绘制带锯齿的热敏纸主体
  const rx = OUTER_PAD_X;
  const ry = OUTER_PAD_Y;
  drawZigZagReceiptPaper(ctx, rx, ry, RECEIPT_WIDTH, receiptHeight);

  const left = rx + INNER_PAD_X;
  const right = rx + RECEIPT_WIDTH - INNER_PAD_X;
  const contentW = right - left;
  const centerX = rx + RECEIPT_WIDTH / 2;

  let y = ry + TOOTH_HEIGHT + 34;

  // ====== 1. 顶部抬头 ======
  ctx.fillStyle = '#141413';
  ctx.font = `700 16px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('SPLITSNAP // 极速分账电子小票', centerX, y);

  y += 42;
  ctx.font = `700 34px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText(truncateText(ctx, bill.title, contentW), centerX, y);

  y += 32;
  ctx.font = `500 18px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText(
    `NO.${bill.receiptNo}  ·  ${formatDateTime(bill.updatedAt)}`,
    centerX,
    y
  );

  y += 32;
  const memberSummary = `${bill.members.length} 位成员：${bill.members
    .map((m) => m.name)
    .join(' / ')}`;
  ctx.font = `500 18px ${FONT_SANS}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText(truncateText(ctx, memberSummary, contentW), centerX, y);

  y += 28;
  drawDoubleSolidLine(ctx, left, right, y);
  y += 34;

  // ====== 2. 消费明细列表 ======
  ctx.textAlign = 'left';
  ctx.font = `700 16px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText(`ITEMS // 消费明细 (${bill.expenses.length})`, left, y);
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', right, y);
  y += 18;
  drawDashedLine(ctx, left, right, y);
  y += 30;

  if (bill.expenses.length === 0) {
    ctx.textAlign = 'center';
    ctx.font = `500 20px ${FONT_SANS}`;
    ctx.fillStyle = '#9A958A';
    ctx.fillText('暂无消费记录', centerX, y + 18);
    y += expenseRowH;
  } else {
    for (const exp of bill.expenses) {
      const payer = memberMap.get(exp.payerId);
      const payerName = payer?.name ?? '未知';
      const splitDesc =
        exp.splitMode === 'custom'
          ? `自定义分摊 (${Object.keys(exp.customSharesCents ?? {}).length}人)`
          : exp.participantIds.length === bill.members.length
            ? `全员 ${exp.participantIds.length} 人均摊`
            : `${exp.participantIds.length}/${bill.members.length} 人均摊`;

      ctx.textAlign = 'left';
      ctx.font = `600 23px ${FONT_SANS}`;
      ctx.fillStyle = '#141413';
      ctx.fillText(truncateText(ctx, exp.title, contentW - 170), left, y);

      ctx.textAlign = 'right';
      ctx.font = `700 23px ${FONT_MONO}`;
      ctx.fillStyle = '#141413';
      ctx.fillText(formatMoney(exp.amountCents, bill.currency), right, y);

      y += 26;
      ctx.textAlign = 'left';
      ctx.font = `500 17px ${FONT_SANS}`;
      ctx.fillStyle = '#68645B';
      ctx.fillText(
        truncateText(ctx, `${payerName} 垫付 · ${splitDesc}`, contentW),
        left,
        y
      );

      y += 42;
    }
  }

  // ====== 3. 总额汇总 ======
  drawDoubleSolidLine(ctx, left, right, y - 10);
  y += 32;
  ctx.textAlign = 'left';
  ctx.font = `700 22px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText('总计消费 TOTAL', left, y);

  ctx.textAlign = 'right';
  ctx.font = `700 34px ${FONT_MONO}`;
  ctx.fillStyle = '#FF4D1A';
  ctx.fillText(
    formatMoney(settlement.totalExpenseCents, bill.currency),
    right,
    y + 4
  );

  y += 30;
  drawDashedLine(ctx, left, right, y);
  y += 36;

  // ====== 4. 成员收支汇总 ======
  ctx.textAlign = 'left';
  ctx.font = `700 16px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText('BALANCE // 成员净额 (垫付 / 应付 / 净额)', left, y);
  y += 28;

  for (const b of settlement.balances) {
    const m = memberMap.get(b.memberId);
    const name = m?.name ?? b.memberId;

    ctx.textAlign = 'left';
    ctx.font = `600 20px ${FONT_SANS}`;
    ctx.fillStyle = '#141413';
    ctx.fillText(truncateText(ctx, name, 140), left, y);

    ctx.textAlign = 'right';
    ctx.font = `500 17px ${FONT_MONO}`;
    ctx.fillStyle = '#68645B';
    ctx.fillText(
      `付${formatMoney(b.paidCents, bill.currency)} / 应${formatMoney(b.owedCents, bill.currency)}`,
      right - 148,
      y
    );

    ctx.font = `700 20px ${FONT_MONO}`;
    ctx.fillStyle =
      b.netCents > 0 ? '#0D9468' : b.netCents < 0 ? '#FF4D1A' : '#68645B';
    ctx.fillText(formatSignedMoney(b.netCents, bill.currency), right, y);

    y += balanceRowH;
  }

  y += 6;
  drawDashedLine(ctx, left, right, y);
  y += 36;

  // ====== 5. 最优转账方案 ======
  ctx.textAlign = 'left';
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.fillStyle = '#141413';
  ctx.fillText(
    `SETTLEMENT // 最少转账方案 (${settlement.transfers.length} 笔)`,
    left,
    y
  );

  if (settlement.savedTransferCount > 0) {
    ctx.textAlign = 'right';
    ctx.font = `600 16px ${FONT_SANS}`;
    ctx.fillStyle = '#0D9468';
    ctx.fillText(`已精简 ${settlement.savedTransferCount} 笔往来`, right, y);
  }
  y += 26;

  if (settlement.transfers.length === 0) {
    drawRoundedRect(ctx, left, y, contentW, 64, 12);
    ctx.fillStyle = '#E9F7F1';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `700 21px ${FONT_SANS}`;
    ctx.fillStyle = '#0D9468';
    ctx.fillText('全员账目已平，无需转账 ✓', centerX, y + 40);
    y += 84;
  } else {
    const settledSet = new Set(bill.settledKeys);
    for (const tr of settlement.transfers) {
      const fromName = memberMap.get(tr.fromId)?.name ?? tr.fromId;
      const toName = memberMap.get(tr.toId)?.name ?? tr.toId;
      const isSettled = settledSet.has(tr.key);

      drawRoundedRect(ctx, left, y, contentW, transferCardH, 12);
      ctx.fillStyle = isSettled ? '#EFF8F4' : '#F3EFE6';
      ctx.fill();
      ctx.strokeStyle = isSettled ? '#0D9468' : '#DCD5C7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = `700 23px ${FONT_SANS}`;
      ctx.fillStyle = isSettled ? '#0D9468' : '#141413';
      ctx.fillText(
        truncateText(ctx, `${fromName}  →  ${toName}`, contentW - 210),
        left + 20,
        y + 45
      );

      ctx.textAlign = 'right';
      ctx.font = `700 26px ${FONT_MONO}`;
      ctx.fillStyle = isSettled ? '#0D9468' : '#FF4D1A';
      ctx.fillText(
        formatMoney(tr.amountCents, bill.currency),
        right - 20,
        y + 46
      );

      if (isSettled) {
        // 复古已结清小印章
        ctx.save();
        ctx.translate(right - 160, y + 36);
        ctx.rotate(-0.12);
        ctx.strokeStyle = '#0D9468';
        ctx.lineWidth = 2;
        ctx.strokeRect(-42, -16, 84, 30);
        ctx.font = `700 14px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0D9468';
        ctx.fillText('已结清', 0, 5);
        ctx.restore();
      }

      y += transferCardH + 12;
    }
  }

  y += 14;
  drawDashedLine(ctx, left, right, y);
  y += 28;

  // ====== 6. 账单二维码分享区 ======
  const qrSize = 166;
  const qrX = left + 8;
  const qrY = y;

  // 轻微边框衬托二维码
  drawRoundedRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10);
  ctx.fillStyle = '#FCF9F2';
  ctx.fill();
  ctx.strokeStyle = '#DED8CC';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  const qrTextX = qrX + qrSize + 28;
  ctx.textAlign = 'left';
  ctx.font = `700 24px ${FONT_SANS}`;
  ctx.fillStyle = '#141413';
  ctx.fillText('微信扫码查看实时账单', qrTextX, qrY + 46);

  ctx.font = `500 18px ${FONT_SANS}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText('无需登录 · 完整消费明细', qrTextX, qrY + 84);
  ctx.fillText('自动还原 · 一键保存副本', qrTextX, qrY + 114);

  ctx.font = `600 15px ${FONT_MONO}`;
  ctx.fillStyle = '#FF4D1A';
  ctx.fillText('POWERED BY SPLITSNAP', qrTextX, qrY + 152);

  y += qrSize + 44;

  // ====== 7. 模拟条形码 & 致谢语 ======
  drawBarcode(ctx, centerX, y, `${bill.receiptNo}${settlement.totalExpenseCents}`);
  y += 58;
  ctx.textAlign = 'center';
  ctx.font = `600 16px ${FONT_MONO}`;
  ctx.fillStyle = '#68645B';
  ctx.fillText('*** THANK YOU · 聚会愉快 · 明算账不伤感情 ***', centerX, y);

  return canvas.toDataURL('image/png');
}
