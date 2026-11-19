import { Pencil, Plus, ReceiptText, Sparkles } from 'lucide-react';
import type { Bill, Expense, Member } from '../types/bill';
import { formatMoney } from '../core/money';
import { MemberAvatar } from './MemberAvatar';

interface ExpenseListViewProps {
  bill: Bill;
  filterMemberId: string | null;
  onClearFilter: () => void;
  onEditExpense: (expense: Expense) => void;
  onAddExpense: () => void;
  onLoadSample: () => void;
}

export function ExpenseListView({
  bill,
  filterMemberId,
  onClearFilter,
  onEditExpense,
  onAddExpense,
  onLoadSample,
}: ExpenseListViewProps) {
  const memberMap = new Map<string, Member>(bill.members.map((m) => [m.id, m]));

  const visibleExpenses = filterMemberId
    ? bill.expenses.filter(
        (e) =>
          e.payerId === filterMemberId ||
          e.participantIds.includes(filterMemberId) ||
          (e.customSharesCents && (e.customSharesCents[filterMemberId] ?? 0) > 0)
      )
    : bill.expenses;

  const filterMember = filterMemberId ? memberMap.get(filterMemberId) : null;

  if (bill.expenses.length === 0) {
    return (
      <div className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl p-7 text-center shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
        <div className="w-12 h-12 rounded-2xl bg-[#F5F2EB] border border-[#DED8CC] mx-auto flex items-center justify-center mb-3">
          <ReceiptText className="w-6 h-6 text-[#68645B]" />
        </div>
        <h3 className="text-base font-bold text-[#141413]">账本还是空的</h3>
        <p className="text-xs text-[#68645B] mt-1.5 leading-relaxed">
          点击底部「记一笔」录入第一笔垫付消费，
          <br />
          支持均摊排除不喝酒成员或自定义金额。
        </p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onAddExpense}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF4D1A] text-white text-xs font-semibold active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            记第一笔
          </button>
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F5F2EB] border border-[#DED8CC] text-[#141413] text-xs font-semibold active:scale-95 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF4D1A]" />
            看示例账单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {filterMember && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFF0EB] border border-[#FF4D1A]/25 text-xs">
          <span className="text-[#141413] font-medium">
            正在筛选与 <strong>{filterMember.name}</strong> 相关的消费（
            {visibleExpenses.length} 笔）
          </span>
          <button
            type="button"
            onClick={onClearFilter}
            className="text-[#FF4D1A] font-semibold underline cursor-pointer"
          >
            查看全部
          </button>
        </div>
      )}

      <div className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
        {/* 小票表头 */}
        <div className="px-4 py-2.5 border-b border-dashed border-[#DED8CC] flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#68645B] bg-[#FAF7F0]">
          <span>ITEMS · 消费明细 ({visibleExpenses.length})</span>
          <span>AMOUNT</span>
        </div>

        <ul className="divide-y divide-dashed divide-[#E5E0D5]">
          {visibleExpenses.map((exp, idx) => {
            const payer = memberMap.get(exp.payerId);
            const excludedMembers =
              exp.splitMode === 'equal'
                ? bill.members.filter((m) => !exp.participantIds.includes(m.id))
                : [];

            const splitLabel =
              exp.splitMode === 'custom'
                ? `自定义 · ${Object.keys(exp.customSharesCents ?? {}).length} 人`
                : excludedMembers.length === 0
                  ? `全员 ${exp.participantIds.length} 人均摊`
                  : excludedMembers.length <= 2
                    ? `${exp.participantIds.length}/${bill.members.length} 均摊 · 排除${excludedMembers.map((m) => m.name).join('、')}`
                    : `${exp.participantIds.length}/${bill.members.length} 人均摊`;

            const perHeadCents =
              exp.splitMode === 'equal' && exp.participantIds.length > 0
                ? Math.round(exp.amountCents / exp.participantIds.length)
                : null;

            return (
              <li key={exp.id}>
                <button
                  type="button"
                  onClick={() => onEditExpense(exp)}
                  className="w-full text-left px-4 py-3.5 hover:bg-[#FAF7F0] active:bg-[#F3EFE6] transition flex items-start justify-between gap-3 cursor-pointer"
                  data-testid={`expense-item-${idx}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#9A958A] shrink-0">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[15px] font-semibold text-[#141413] truncate">
                        {exp.title}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#68645B]">
                      {payer && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F5F2EB] border border-[#E5E0D5] text-[#141413] font-medium">
                          <MemberAvatar member={payer} size="xs" />
                          <span>{payer.name} 垫付</span>
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-medium ${
                          exp.splitMode === 'custom'
                            ? 'bg-[#141413] text-[#FFFDF9]'
                            : excludedMembers.length > 0
                              ? 'bg-[#FFF0EB] text-[#C2360F]'
                              : 'bg-[#F5F2EB] text-[#68645B]'
                        }`}
                      >
                        {splitLabel}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="tabular-money text-[17px] font-bold text-[#141413]">
                      {formatMoney(exp.amountCents, bill.currency)}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#9A958A] tabular-money">
                      {perHeadCents !== null ? (
                        <span>{formatMoney(perHeadCents, bill.currency)}/人</span>
                      ) : (
                        <span>按实录入</span>
                      )}
                      <Pencil className="w-3 h-3 ml-0.5" />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
