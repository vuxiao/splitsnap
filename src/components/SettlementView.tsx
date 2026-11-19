import {
  ArrowRight,
  Check,
  CheckCircle2,
  QrCode,
  Receipt,
  Sparkles,
} from 'lucide-react';
import type { Bill, Member, SettlementResult } from '../types/bill';
import { formatMoney, formatSignedMoney } from '../core/money';
import { MemberAvatar } from './MemberAvatar';

interface SettlementViewProps {
  bill: Bill;
  settlement: SettlementResult;
  onToggleSettled: (transferKey: string) => void;
  onOpenReceipt: () => void;
  onOpenShare: () => void;
}

export function SettlementView({
  bill,
  settlement,
  onToggleSettled,
  onOpenReceipt,
  onOpenShare,
}: SettlementViewProps) {
  const memberMap = new Map<string, Member>(bill.members.map((m) => [m.id, m]));
  const settledSet = new Set(bill.settledKeys);
  const completedCount = settlement.transfers.filter((t) =>
    settledSet.has(t.key)
  ).length;
  const allSettled =
    settlement.transfers.length > 0 &&
    completedCount === settlement.transfers.length;

  const maxAbsNet = Math.max(
    1,
    ...settlement.balances.map((b) => Math.abs(b.netCents))
  );

  return (
    <div className="space-y-4">
      {/* 1. 最优转账方案卡片 */}
      <section className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
        <div className="px-4 py-3 border-b border-dashed border-[#DED8CC] bg-[#FAF7F0] flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#68645B]">
              MIN-CASH-FLOW · 最少转账方案
            </div>
            <div className="text-sm font-bold text-[#141413] mt-0.5 flex items-center gap-1.5">
              <span>
                共需{' '}
                <span className="tabular-money text-[#FF4D1A]">
                  {settlement.transfers.length}
                </span>{' '}
                笔转账
              </span>
              {settlement.transfers.length > 0 && (
                <span className="text-xs font-normal text-[#68645B] tabular-money">
                  （已结清 {completedCount}/{settlement.transfers.length}）
                </span>
              )}
            </div>
          </div>

          {settlement.savedTransferCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E9F7F1] border border-[#0D9468]/25 text-[#0D9468] text-[11px] font-semibold shrink-0">
              <Sparkles className="w-3 h-3" />
              省 {settlement.savedTransferCount} 笔
            </span>
          )}
        </div>

        <div className="p-3.5">
          {settlement.transfers.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-9 h-9 text-[#0D9468] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#141413]">
                {bill.expenses.length === 0
                  ? '暂无待结算账目'
                  : '全员收支已完全平衡，无需转账'}
              </p>
              <p className="text-xs text-[#68645B] mt-1">
                {bill.expenses.length === 0
                  ? '录入消费后将自动计算最少转账路径'
                  : '每一分钱都已精准对齐'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allSettled && (
                <div className="px-3 py-2 rounded-xl bg-[#E9F7F1] border border-[#0D9468]/30 text-[#0D9468] text-xs font-semibold text-center">
                  本局所有转账均已结清 · 聚会愉快！
                </div>
              )}

              {settlement.transfers.map((tr, index) => {
                const from = memberMap.get(tr.fromId);
                const to = memberMap.get(tr.toId);
                if (!from || !to) return null;
                const isSettled = settledSet.has(tr.key);

                return (
                  <button
                    key={tr.key}
                    type="button"
                    onClick={() => onToggleSettled(tr.key)}
                    data-testid={`transfer-item-${index}`}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] ${
                      isSettled
                        ? 'bg-[#F2FAF6] border-[#0D9468]/35'
                        : 'bg-[#FAF8F3] border-[#E5E0D5] hover:border-[#CFC8BA]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition ${
                          isSettled
                            ? 'bg-[#0D9468] border-[#0D9468] text-white'
                            : 'bg-white border-[#CFC8BA] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-sm text-[#141413]">
                            <MemberAvatar member={from} size="xs" />
                            <span className={isSettled ? 'line-through opacity-60' : ''}>
                              {from.name}
                            </span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#9A958A] shrink-0" />
                          <span className="inline-flex items-center gap-1 font-semibold text-sm text-[#141413]">
                            <MemberAvatar member={to} size="xs" />
                            <span className={isSettled ? 'line-through opacity-60' : ''}>
                              {to.name}
                            </span>
                          </span>
                        </div>
                        <div className="text-[11px] text-[#68645B] mt-0.5">
                          {isSettled ? '已标记结清（点击可撤销）' : '点击勾选标记为已结清'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`tabular-money text-lg font-bold ${
                          isSettled ? 'text-[#0D9468] line-through opacity-75' : 'text-[#FF4D1A]'
                        }`}
                      >
                        {formatMoney(tr.amountCents, bill.currency)}
                      </div>
                      {isSettled && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded border border-[#0D9468] text-[#0D9468] text-[10px] font-mono font-bold tracking-wider">
                          PAID
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部一键分享与热敏小票 */}
        <div className="px-3.5 pb-3.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenReceipt}
            data-testid="settlement-receipt-btn"
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#141413] text-[#FFFDF9] text-xs font-semibold active:scale-95 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            生成热敏小票长图
          </button>
          <button
            type="button"
            onClick={onOpenShare}
            data-testid="settlement-share-btn"
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#F5F2EB] border border-[#DED8CC] text-[#141413] text-xs font-semibold active:scale-95 transition cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#FF4D1A]" />
            扫码分享给同桌
          </button>
        </div>
      </section>

      {/* 2. 成员收支净额明细表 */}
      <section className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
        <div className="px-4 py-2.5 border-b border-dashed border-[#DED8CC] bg-[#FAF7F0] flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#68645B]">
          <span>LEDGER · 每人收支明细</span>
          <span>净应收 / 应付</span>
        </div>

        <ul className="divide-y divide-dashed divide-[#E5E0D5]">
          {settlement.balances.map((b) => {
            const member = memberMap.get(b.memberId);
            if (!member) return null;
            const ratio = Math.min(100, Math.round((Math.abs(b.netCents) / maxAbsNet) * 100));

            return (
              <li key={b.memberId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MemberAvatar member={member} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#141413] truncate">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-[#68645B] tabular-money">
                        垫付 {formatMoney(b.paidCents, bill.currency)} · 应付{' '}
                        {formatMoney(b.owedCents, bill.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`tabular-money text-[15px] font-bold ${
                        b.netCents > 0
                          ? 'text-[#0D9468]'
                          : b.netCents < 0
                            ? 'text-[#FF4D1A]'
                            : 'text-[#68645B]'
                      }`}
                    >
                      {formatSignedMoney(b.netCents, bill.currency)}
                    </div>
                    <div className="text-[10px] text-[#9A958A]">
                      {b.netCents > 0 ? '应收回' : b.netCents < 0 ? '需转出' : '已平账'}
                    </div>
                  </div>
                </div>

                {/* 瑞士风极简进度条 */}
                <div className="mt-2 h-1.5 rounded-full bg-[#F0ECE2] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      b.netCents > 0
                        ? 'bg-[#0D9468]'
                        : b.netCents < 0
                          ? 'bg-[#FF4D1A]'
                          : 'bg-[#CFC8BA]'
                    }`}
                    style={{ width: `${b.netCents === 0 ? 0 : Math.max(8, ratio)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
