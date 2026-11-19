import {
  MEMBER_AVATARS,
  MEMBER_PALETTE,
  type Bill,
  type Member,
} from '../types/bill';

const STORAGE_KEY = 'splitsnap_bills_v1';
const ACTIVE_ID_KEY = 'splitsnap_active_bill_v1';

export function generateShortId(prefix = 'id'): string {
  return `${prefix}${Math.random().toString(36).slice(2, 7)}`;
}

export function generateReceiptNo(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 90) + 10);
  return `SS-${yy}${mm}${dd}-${seq}`;
}

export function createMember(name: string, index: number): Member {
  return {
    id: generateShortId('m'),
    name: name.trim(),
    color: MEMBER_PALETTE[index % MEMBER_PALETTE.length],
    avatar: MEMBER_AVATARS[index % MEMBER_AVATARS.length],
  };
}

/**
 * 预置示例账单：覆盖全员均摊、排除不喝酒成员、部分拼车、自定义金额四大高频真实痛点
 */
export function createSampleBill(): Bill {
  const now = Date.now();
  const members: Member[] = [
    { id: 'm1', name: '阿杰', color: MEMBER_PALETTE[0], avatar: MEMBER_AVATARS[0] },
    { id: 'm2', name: '林溪', color: MEMBER_PALETTE[1], avatar: MEMBER_AVATARS[1] },
    { id: 'm3', name: '老周', color: MEMBER_PALETTE[2], avatar: MEMBER_AVATARS[2] },
    { id: 'm4', name: '小美', color: MEMBER_PALETTE[3], avatar: MEMBER_AVATARS[3] },
    { id: 'm5', name: '大宇', color: MEMBER_PALETTE[4], avatar: MEMBER_AVATARS[4] },
  ];

  return {
    id: generateShortId('bill_'),
    title: '周五重庆火锅局（示例）',
    receiptNo: generateReceiptNo(),
    currency: '¥',
    members,
    expenses: [
      {
        id: 'e1',
        title: '老火锅锅底与肉菜',
        amountCents: 46800,
        payerId: 'm1',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm3', 'm4', 'm5'],
        createdAt: now - 3600_000 * 3,
        note: '全员 5 人均摊',
      },
      {
        id: 'e2',
        title: '精酿啤酒 & 乌苏',
        amountCents: 13600,
        payerId: 'm3',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm3', 'm5'],
        createdAt: now - 3600_000 * 2,
        note: '小美不喝酒，4 人分摊',
      },
      {
        id: 'e3',
        title: '手工冰粉 & 红糖糍粑',
        amountCents: 6800,
        payerId: 'm4',
        splitMode: 'custom',
        participantIds: ['m2', 'm4', 'm5'],
        customSharesCents: {
          m2: 2400,
          m4: 2400,
          m5: 2000,
        },
        createdAt: now - 3600_000,
        note: '按各自点单金额自定义',
      },
      {
        id: 'e4',
        title: '返程专车拼车',
        amountCents: 5100,
        payerId: 'm2',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm4'],
        createdAt: now - 1800_000,
        note: '同方向 3 人顺路',
      },
    ],
    settledKeys: [],
    createdAt: now - 3600_000 * 4,
    updatedAt: now,
  };
}

export function createNewBill(
  title: string,
  memberNames: string[] = ['我', '朋友A', '朋友B']
): Bill {
  const now = Date.now();
  const cleanNames = memberNames
    .map((n) => n.trim())
    .filter(Boolean);
  const finalNames = cleanNames.length >= 2 ? cleanNames : ['我', '朋友A'];

  return {
    id: generateShortId('bill_'),
    title: title.trim() || '新建分账局',
    receiptNo: generateReceiptNo(),
    currency: '¥',
    members: finalNames.map((name, idx) => createMember(name, idx)),
    expenses: [],
    settledKeys: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function loadLocalBills(): Bill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Bill[];
  } catch {
    return [];
  }
}

export function saveLocalBills(bills: Bill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
  } catch {
    // 隐私模式或配额不足时静默降级
  }
}

export function loadActiveBillId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function saveActiveBillId(billId: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, billId);
  } catch {
    // 忽略存储异常
  }
}
