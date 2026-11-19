export interface Member {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

export type SplitMode = 'equal' | 'custom';

export interface Expense {
  id: string;
  title: string;
  /** 金额，统一以整数「分」存储，彻底规避浮点误差 */
  amountCents: number;
  payerId: string;
  splitMode: SplitMode;
  /** 均摊模式下的参与成员 ID 列表 */
  participantIds: string[];
  /** 自定义分摊模式下各成员应付金额（分） */
  customSharesCents?: Record<string, number>;
  createdAt: number;
  note?: string;
}

export interface Bill {
  id: string;
  title: string;
  receiptNo: string;
  currency: string;
  members: Member[];
  expenses: Expense[];
  /** 已结清的转账记录 key，格式 `${fromId}->${toId}` */
  settledKeys: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MemberBalance {
  memberId: string;
  paidCents: number;
  owedCents: number;
  /** netCents = paidCents - owedCents; >0 应收, <0 应付 */
  netCents: number;
}

export interface Transfer {
  key: string;
  fromId: string;
  toId: string;
  amountCents: number;
}

export interface SettlementResult {
  totalExpenseCents: number;
  balances: MemberBalance[];
  transfers: Transfer[];
  /** 原始不优化情况下可能产生的成对往来笔数 */
  rawPairCount: number;
  /** 经最小现金流算法节省的转账笔数 */
  savedTransferCount: number;
}

export const MEMBER_PALETTE = [
  '#141413', // 炭黑
  '#FF4D1A', // 复古荧光橙
  '#0D9468', // 翠绿
  '#2563EB', // 瑞士钴蓝
  '#D97706', // 琥珀赭黄
  '#7C3AED', // 绛紫
  '#DB2777', // 玫瑰红
  '#0891B2', // 青蓝
] as const;

export const MEMBER_AVATARS = [
  '🦊',
  '🐻',
  '🐼',
  '🐰',
  '🐯',
  '🦁',
  '🐸',
  '🐧',
  '🦉',
  '🐙',
  '🐳',
  '🦄',
] as const;
