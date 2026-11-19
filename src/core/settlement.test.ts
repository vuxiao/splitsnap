import { describe, expect, it } from 'vitest';
import {
  calculateBalances,
  computeExpenseShares,
  computeMinimumTransfers,
  settleBill,
} from './settlement';
import { formatMoney, parseYuanToCents } from './money';
import { decodeBillFromToken, encodeBillToToken } from './shareCodec';
import { createSampleBill } from './storage';
import type { Expense, Member } from '../types/bill';

const mkMembers = (names: string[]): Member[] =>
  names.map((name, i) => ({
    id: `m${i + 1}`,
    name,
    color: '#141413',
    avatar: '🦊',
  }));

describe('金额字符串精确解析与格式化', () => {
  it('杜绝浮点数 0.1 + 0.2 与 19.99 * 100 精度误差', () => {
    expect(parseYuanToCents('19.99')).toBe(1999);
    expect(parseYuanToCents('0.01')).toBe(1);
    expect(parseYuanToCents('100.1')).toBe(10010);
    expect(parseYuanToCents('¥1,234.56')).toBe(123456);
    expect(parseYuanToCents('0.1') + parseYuanToCents('0.2')).toBe(30);
    expect(formatMoney(1999)).toBe('¥19.99');
    expect(formatMoney(-350)).toBe('-¥3.50');
  });
});

describe('最小转账路径结算算法 (settleBill)', () => {
  it('场景 1：基础全员均摊（单人垫付）', () => {
    const members = mkMembers(['A', 'B', 'C', 'D']);
    const expenses: Expense[] = [
      {
        id: 'e1',
        title: '火锅',
        amountCents: 40000,
        payerId: 'm1',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm3', 'm4'],
        createdAt: 1,
      },
    ];

    const res = settleBill(members, expenses);
    expect(res.totalExpenseCents).toBe(40000);
    expect(res.balances.find((b) => b.memberId === 'm1')?.netCents).toBe(30000);
    expect(res.transfers).toHaveLength(3);
    for (const tr of res.transfers) {
      expect(tr.toId).toBe('m1');
      expect(tr.amountCents).toBe(10000);
    }
  });

  it('场景 2：排除部分成员（例如小美不喝酒）', () => {
    const members = mkMembers(['阿杰', '林溪', '小美']);
    const expenses: Expense[] = [
      {
        id: 'e1',
        title: '烧烤',
        amountCents: 30000,
        payerId: 'm1',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm3'], // 每人 100
        createdAt: 1,
      },
      {
        id: 'e2',
        title: '精酿啤酒',
        amountCents: 10000,
        payerId: 'm2',
        splitMode: 'equal',
        participantIds: ['m1', 'm2'], // 排除 m3 小美，每人 50
        createdAt: 2,
      },
    ];

    const res = settleBill(members, expenses);
    // m1: 付 300，应 150，净 +150
    // m2: 付 100，应 150，净 -50
    // m3: 付 0，  应 100，净 -100
    expect(res.balances.find((b) => b.memberId === 'm1')?.netCents).toBe(15000);
    expect(res.balances.find((b) => b.memberId === 'm2')?.netCents).toBe(-5000);
    expect(res.balances.find((b) => b.memberId === 'm3')?.netCents).toBe(-10000);
    expect(res.transfers).toEqual([
      { key: 'm3->m1', fromId: 'm3', toId: 'm1', amountCents: 10000 },
      { key: 'm2->m1', fromId: 'm2', toId: 'm1', amountCents: 5000 },
    ]);
  });

  it('场景 3：多人交替垫付形成循环债务，压缩为最少转账笔数', () => {
    const members = mkMembers(['A', 'B', 'C', 'D']);
    // A 为 B 垫 100，B 为 C 垫 100，C 为 D 垫 100，D 为 A 垫 100 -> 净额全部为 0，0 笔转账！
    const expenses: Expense[] = [
      { id: 'e1', title: '1', amountCents: 10000, payerId: 'm1', splitMode: 'equal', participantIds: ['m2'], createdAt: 1 },
      { id: 'e2', title: '2', amountCents: 10000, payerId: 'm2', splitMode: 'equal', participantIds: ['m3'], createdAt: 2 },
      { id: 'e3', title: '3', amountCents: 10000, payerId: 'm3', splitMode: 'equal', participantIds: ['m4'], createdAt: 3 },
      { id: 'e4', title: '4', amountCents: 10000, payerId: 'm4', splitMode: 'equal', participantIds: ['m1'], createdAt: 4 },
    ];

    const res = settleBill(members, expenses);
    expect(res.transfers).toHaveLength(0);
    expect(res.rawPairCount).toBe(4);
    expect(res.savedTransferCount).toBe(4);
  });

  it('场景 4：精确匹配优先优化（2 对精确抵消仅需 2 笔，优于朴素贪心的 3 笔）', () => {
    // 净额：m1=+100, m2=+60, m3=-100, m4=-60
    // 若精确抵消：m3->m1 (100), m4->m2 (60) => 2 笔！
    // 测试另一组易触发朴素贪心次优的案例：
    // 净额：m1=+100, m2=+50, m3=-50, m4=-60, m5=-40
    // 精确抵消先匹配 m3(-50)->m2(+50)，剩余 m1(+100) 由 m4(-60) & m5(-40) 转入，共 3 笔（而朴素贪心若先用 m4(-60) 转 m1(+100) 会拆出 4 笔）
    const transfers = computeMinimumTransfers([
      { memberId: 'm1', paidCents: 10000, owedCents: 0, netCents: 10000 },
      { memberId: 'm2', paidCents: 5000, owedCents: 0, netCents: 5000 },
      { memberId: 'm3', paidCents: 0, owedCents: 5000, netCents: -5000 },
      { memberId: 'm4', paidCents: 0, owedCents: 6000, netCents: -6000 },
      { memberId: 'm5', paidCents: 0, owedCents: 4000, netCents: -4000 },
    ]);

    expect(transfers).toHaveLength(3);
    // 验证现金流守恒
    const flow = new Map<string, number>();
    for (const tr of transfers) {
      flow.set(tr.fromId, (flow.get(tr.fromId) ?? 0) - tr.amountCents);
      flow.set(tr.toId, (flow.get(tr.toId) ?? 0) + tr.amountCents);
    }
    expect(flow.get('m1')).toBe(10000);
    expect(flow.get('m2')).toBe(5000);
    expect(flow.get('m3')).toBe(-5000);
    expect(flow.get('m4')).toBe(-6000);
    expect(flow.get('m5')).toBe(-4000);
  });

  it('场景 5：浮点精度 0.01 元余数分摊守恒与多笔公平轮转', () => {
    const members = mkMembers(['甲', '乙', '丙']);
    // 100.00 元 3 人均摊：33.34 + 33.33 + 33.33 = 100.00，一分不差
    const singleExp: Expense = {
      id: 'e1',
      title: '100元均摊',
      amountCents: 10000,
      payerId: 'm1',
      splitMode: 'equal',
      participantIds: ['m1', 'm2', 'm3'],
      createdAt: 1,
    };
    const shares = computeExpenseShares(singleExp, new Set(['m1', 'm2', 'm3']), 0);
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
    expect(Object.values(shares).sort((a, b) => a - b)).toEqual([3333, 3333, 3334]);

    // 连续 3 笔 100.00 元 3 人均摊：轮转后每人累计应付恰好都是 100.00 元！
    const threeExpenses: Expense[] = [
      { ...singleExp, id: 'e1', payerId: 'm1' },
      { ...singleExp, id: 'e2', payerId: 'm2' },
      { ...singleExp, id: 'e3', payerId: 'm3' },
    ];
    const res = settleBill(members, threeExpenses);
    expect(res.totalExpenseCents).toBe(30000);
    for (const b of res.balances) {
      expect(b.owedCents).toBe(10000);
      expect(b.netCents).toBe(0);
    }
    expect(res.transfers).toHaveLength(0);
  });

  it('场景 6：0.01 元极端小额 3 人均摊 + 自定义金额混合校验净额守恒', () => {
    const members = mkMembers(['A', 'B', 'C', 'D', 'E']);
    const expenses: Expense[] = [
      {
        id: 'e1',
        title: '一分钱测试',
        amountCents: 1,
        payerId: 'm1',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm3'],
        createdAt: 1,
      },
      {
        id: 'e2',
        title: '自定义甜品',
        amountCents: 12345,
        payerId: 'm4',
        splitMode: 'custom',
        participantIds: ['m2', 'm3', 'm5'],
        customSharesCents: { m2: 4000, m3: 3345, m5: 5000 },
        createdAt: 2,
      },
      {
        id: 'e3',
        title: '7人式余数',
        amountCents: 9999,
        payerId: 'm5',
        splitMode: 'equal',
        participantIds: ['m1', 'm2', 'm3', 'm4', 'm5'],
        createdAt: 3,
      },
    ];

    const res = settleBill(members, expenses);
    // 所有人净余额代数和必须严格为 0
    const netSum = res.balances.reduce((acc, b) => acc + b.netCents, 0);
    expect(netSum).toBe(0);

    // 验证按转账方案执行后，所有人余额精确归零
    const remaining = new Map(res.balances.map((b) => [b.memberId, b.netCents]));
    for (const tr of res.transfers) {
      remaining.set(tr.fromId, (remaining.get(tr.fromId) ?? 0) + tr.amountCents);
      remaining.set(tr.toId, (remaining.get(tr.toId) ?? 0) - tr.amountCents);
    }
    for (const val of remaining.values()) {
      expect(val).toBe(0);
    }
  });

  it('场景 7：无消费或已自付场景不产生无效转账', () => {
    const members = mkMembers(['A', 'B']);
    const emptyRes = settleBill(members, []);
    expect(emptyRes.totalExpenseCents).toBe(0);
    expect(emptyRes.transfers).toHaveLength(0);

    const selfRes = calculateBalances(members, [
      {
        id: 'e1',
        title: '自买咖啡',
        amountCents: 2800,
        payerId: 'm1',
        splitMode: 'equal',
        participantIds: ['m1'],
        createdAt: 1,
      },
    ]);
    expect(computeMinimumTransfers(selfRes.balances)).toHaveLength(0);
  });
});

describe('无后端 URL 压缩编解码 (shareCodec)', () => {
  it('示例账单（含均摊/排除/自定义/已结清标记）可 100% 无损压缩与还原', () => {
    const sample = createSampleBill();
    sample.settledKeys = ['m5->m1'];

    const token = encodeBillToToken(sample);
    expect(token.length).toBeGreaterThan(10);
    expect(token.length).toBeLessThan(800); // 确保二维码紧凑易扫

    const restored = decodeBillFromToken(token);
    expect(restored).not.toBeNull();
    expect(restored?.title).toBe(sample.title);
    expect(restored?.receiptNo).toBe(sample.receiptNo);
    expect(restored?.members).toEqual(sample.members);
    expect(restored?.settledKeys).toEqual(['m5->m1']);
    expect(restored?.expenses).toHaveLength(sample.expenses.length);

    // 验证还原前后的结算结果 100% 一致
    const origSettle = settleBill(sample.members, sample.expenses);
    const restoredSettle = settleBill(restored!.members, restored!.expenses);
    expect(restoredSettle).toEqual(origSettle);
  });

  it('非法或损坏的分享码安全返回 null 不抛出异常', () => {
    expect(decodeBillFromToken('')).toBeNull();
    expect(decodeBillFromToken('invalid-garbage-$$$')).toBeNull();
  });
});
