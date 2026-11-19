import type {
  Expense,
  Member,
  MemberBalance,
  SettlementResult,
  Transfer,
} from '../types/bill';

/**
 * 计算单笔消费中每个参与人的应付金额（单位：分）。
 *
 * 均摊模式下的 0.01 元（1 分）余数处理：
 * - 先每人分配 floor(amountCents / n) 分；
 * - 剩余 r = amountCents % n 分，按确定性偏移 `rotationSeed` 轮转分给 r 位参与人，
 *   确保：
 *   1. 总和严格等于 amountCents（分毫不差守恒）；
 *   2. 同一账单在任何设备/时间重算结果完全一致（确定性）；
 *   3. 多笔产生余数的消费不会总是让列表第 1 个人多付 1 分（公平轮转）。
 */
export function computeExpenseShares(
  expense: Expense,
  validMemberIds: Set<string>,
  rotationSeed = 0
): Record<string, number> {
  const shares: Record<string, number> = {};
  if (expense.amountCents <= 0) {
    return shares;
  }

  if (expense.splitMode === 'custom' && expense.customSharesCents) {
    let customTotal = 0;
    const entries = Object.entries(expense.customSharesCents).filter(
      ([memberId, cents]) => validMemberIds.has(memberId) && cents > 0
    );

    for (const [memberId, cents] of entries) {
      const rounded = Math.round(cents);
      shares[memberId] = rounded;
      customTotal += rounded;
    }

    // 兜底：若历史或外部篡改数据导致自定义总额与账单总额差几分，按比例或补差到首项保持守恒
    if (entries.length > 0 && customTotal !== expense.amountCents) {
      const diff = expense.amountCents - customTotal;
      const firstId = entries[0][0];
      shares[firstId] = Math.max(0, (shares[firstId] ?? 0) + diff);
    }
    return shares;
  }

  // 均摊模式：过滤有效参与人并去重保序
  const participants: string[] = [];
  const seen = new Set<string>();
  for (const id of expense.participantIds) {
    if (validMemberIds.has(id) && !seen.has(id)) {
      seen.add(id);
      participants.push(id);
    }
  }

  if (participants.length === 0) {
    return shares;
  }

  const count = participants.length;
  const base = Math.floor(expense.amountCents / count);
  const remainder = expense.amountCents % count;
  const startOffset = ((rotationSeed % count) + count) % count;

  for (let i = 0; i < count; i++) {
    shares[participants[i]] = base;
  }
  for (let r = 0; r < remainder; r++) {
    const idx = (startOffset + r) % count;
    shares[participants[idx]] += 1;
  }

  return shares;
}

/**
 * 统计每个成员的总垫付、总应付、净应收/应付余额。
 */
export function calculateBalances(
  members: Member[],
  expenses: Expense[]
): {
  totalExpenseCents: number;
  balances: MemberBalance[];
  rawPairCount: number;
} {
  const validIds = new Set(members.map((m) => m.id));
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  for (const m of members) {
    paidMap.set(m.id, 0);
    owedMap.set(m.id, 0);
  }

  let totalExpenseCents = 0;
  const rawDirectedPairs = new Set<string>();

  expenses.forEach((expense, index) => {
    if (expense.amountCents <= 0 || !validIds.has(expense.payerId)) {
      return;
    }

    const shares = computeExpenseShares(expense, validIds, index);
    const shareSum = Object.values(shares).reduce((acc, v) => acc + v, 0);
    if (shareSum <= 0) {
      return;
    }

    totalExpenseCents += shareSum;
    paidMap.set(expense.payerId, (paidMap.get(expense.payerId) ?? 0) + shareSum);

    for (const [memberId, cents] of Object.entries(shares)) {
      if (cents <= 0) continue;
      owedMap.set(memberId, (owedMap.get(memberId) ?? 0) + cents);
      if (memberId !== expense.payerId) {
        rawDirectedPairs.add(`${memberId}->${expense.payerId}`);
      }
    }
  });

  const balances: MemberBalance[] = members.map((m) => {
    const paidCents = paidMap.get(m.id) ?? 0;
    const owedCents = owedMap.get(m.id) ?? 0;
    return {
      memberId: m.id,
      paidCents,
      owedCents,
      netCents: paidCents - owedCents,
    };
  });

  return {
    totalExpenseCents,
    balances,
    rawPairCount: rawDirectedPairs.size,
  };
}

interface NodeBalance {
  memberId: string;
  amount: number;
}

/**
 * 最小转账路径结算算法（Exact-Match Pruning + Greedy Min-Cash-Flow）：
 *
 * 1. 分离净应付（debtors）与净应收（creditors），忽略 0 余额节点。
 * 2. 阶段一（精确抵消优化）：若存在债务人欠款 === 债权人应收，优先直接配对结清，
 *    一次转账同时消除 2 个节点（优于朴素贪心）。
 * 3. 阶段二（贪心最小现金流）：每轮取当前最大欠款人与最大应收人，
 *    结算 min(debt, credit)，至少彻底结清一方，重复直至全部清零。
 *
 * 数学保证：
 * - 守恒性：所有转账总额流向严格等于每个人的净余额；
 * - 上界：最多 N - 1 笔转账；存在对称子集时笔数进一步显著减少；
 * - 确定性：按金额降序 + memberId 字典序打破平局，结果稳定可复现。
 */
export function computeMinimumTransfers(balances: MemberBalance[]): Transfer[] {
  const debtors: NodeBalance[] = [];
  const creditors: NodeBalance[] = [];

  for (const b of balances) {
    if (b.netCents < 0) {
      debtors.push({ memberId: b.memberId, amount: -b.netCents });
    } else if (b.netCents > 0) {
      creditors.push({ memberId: b.memberId, amount: b.netCents });
    }
  }

  const sortDesc = (a: NodeBalance, b: NodeBalance) =>
    b.amount - a.amount || a.memberId.localeCompare(b.memberId);

  debtors.sort(sortDesc);
  creditors.sort(sortDesc);

  const transfers: Transfer[] = [];

  // 阶段 1：精确金额 1-to-1 直接抵消
  for (let i = debtors.length - 1; i >= 0; i--) {
    const d = debtors[i];
    const matchIdx = creditors.findIndex((c) => c.amount === d.amount);
    if (matchIdx !== -1) {
      const c = creditors[matchIdx];
      transfers.push({
        key: `${d.memberId}->${c.memberId}`,
        fromId: d.memberId,
        toId: c.memberId,
        amountCents: d.amount,
      });
      debtors.splice(i, 1);
      creditors.splice(matchIdx, 1);
    }
  }

  // 阶段 2：最大债权人 vs 最大债务人 贪心消元
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(sortDesc);
    creditors.sort(sortDesc);

    const maxDebtor = debtors[0];
    const maxCreditor = creditors[0];
    const transferAmount = Math.min(maxDebtor.amount, maxCreditor.amount);

    if (transferAmount > 0) {
      transfers.push({
        key: `${maxDebtor.memberId}->${maxCreditor.memberId}`,
        fromId: maxDebtor.memberId,
        toId: maxCreditor.memberId,
        amountCents: transferAmount,
      });
    }

    maxDebtor.amount -= transferAmount;
    maxCreditor.amount -= transferAmount;

    if (maxDebtor.amount === 0) {
      debtors.shift();
    }
    if (maxCreditor.amount === 0) {
      creditors.shift();
    }
  }

  // 最终按转账金额从大到小稳定排序
  transfers.sort(
    (a, b) =>
      b.amountCents - a.amountCents ||
      a.fromId.localeCompare(b.fromId) ||
      a.toId.localeCompare(b.toId)
  );

  return transfers;
}

/**
 * 完整结算入口：输入成员与消费明细，输出余额、最小转账方案及优化统计。
 */
export function settleBill(
  members: Member[],
  expenses: Expense[]
): SettlementResult {
  const { totalExpenseCents, balances, rawPairCount } = calculateBalances(
    members,
    expenses
  );
  const transfers = computeMinimumTransfers(balances);
  const savedTransferCount = Math.max(0, rawPairCount - transfers.length);

  return {
    totalExpenseCents,
    balances,
    transfers,
    rawPairCount,
    savedTransferCount,
  };
}
