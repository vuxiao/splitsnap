/**
 * 将「元」字符串安全解析为整数「分」，彻底规避 parseFloat * 100 的二进制浮点精度误差。
 * 例：parseYuanToCents("19.99") => 1999, parseYuanToCents("100.1") => 10010
 */
export function parseYuanToCents(input: string): number {
  const cleaned = input.trim().replace(/[¥￥,\s]/g, '');
  if (!cleaned || !/^\d+(\.\d*)?$/.test(cleaned)) {
    return 0;
  }
  const [intPart, decPart = ''] = cleaned.split('.');
  const paddedDec = (decPart + '00').slice(0, 2);
  const cents = Number(intPart) * 100 + Number(paddedDec);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    return 0;
  }
  return cents;
}

/**
 * 将整数「分」格式化为两位小数金额字符串（不含货币符号）。
 */
export function formatCents(cents: number): string {
  const safe = Math.round(cents);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const yuan = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${yuan.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`;
}

/**
 * 带货币符号格式化，例：¥128.50 或 -¥32.00
 */
export function formatMoney(cents: number, currency = '¥'): string {
  const safe = Math.round(cents);
  if (safe < 0) {
    return `-${currency}${formatCents(Math.abs(safe))}`;
  }
  return `${currency}${formatCents(safe)}`;
}

/**
 * 带显式正负号格式化，例：+¥85.00 / -¥42.50 / ¥0.00
 */
export function formatSignedMoney(cents: number, currency = '¥'): string {
  const safe = Math.round(cents);
  if (safe > 0) {
    return `+${currency}${formatCents(safe)}`;
  }
  if (safe < 0) {
    return `-${currency}${formatCents(Math.abs(safe))}`;
  }
  return `${currency}0.00`;
}

/**
 * 用于输入框回填的纯数字元字符串（不带千分位）
 */
export function centsToPlainInput(cents: number): string {
  if (cents <= 0) return '';
  const yuan = Math.floor(cents / 100);
  const rem = cents % 100;
  if (rem === 0) return String(yuan);
  if (rem % 10 === 0) return `${yuan}.${rem / 10}`;
  return `${yuan}.${String(rem).padStart(2, '0')}`;
}
