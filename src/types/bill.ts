export interface Member {
  id: string;
  name: string;
  color: string;
  /** 瑞士印刷体印章样式标识（兼容旧分享链接中的任意字符串） */
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

/**
 * 严守瑞士热敏纸四色体系：暖纸白 + 炭黑墨 + 荧光信号橙 + 邮政绿（及暖灰墨变体）
 */
export const MEMBER_PALETTE = [
  '#141413', // 炭黑墨
  '#FF4D1A', // 荧光信号橙
  '#0D9468', // 邮政绿
  '#4A463F', // 深暖灰墨
  '#141413', // 炭黑方章
  '#FF4D1A', // 信号橙框章
  '#0D9468', // 邮政绿框章
  '#68645B', // 票据双环章
] as const;

/**
 * 8 款纯矢量瑞士印刷体印章样式标识（替代系统彩色 Emoji）
 */
export const MEMBER_AVATARS = [
  'ink-solid',
  'orange-ring',
  'green-solid',
  'ink-square',
  'orange-solid',
  'green-ring',
  'slate-solid',
  'paper-double',
] as const;

export type SwissStampVariant = (typeof MEMBER_AVATARS)[number];
