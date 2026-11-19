import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Check,
  Delete,
  Trash2,
  X,
} from 'lucide-react';
import type { Expense, Member, SplitMode } from '../types/bill';
import {
  centsToPlainInput,
  formatMoney,
  parseYuanToCents,
} from '../core/money';
import { generateShortId } from '../core/storage';
import { MemberAvatar } from './MemberAvatar';

interface ExpenseSheetProps {
  open: boolean;
  members: Member[];
  currency: string;
  initialExpense: Expense | null;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  onDelete?: (expenseId: string) => void;
}

const QUICK_PRESETS = [
  '火锅',
  '烧烤',
  '酒水',
  '奶茶甜品',
  '打车',
  '门票',
  '住宿',
  '零食超市',
];

function evaluateExpressionToCents(expr: string): number {
  const trimmed = expr.trim();
  if (!trimmed) return 0;
  // 支持用 + 连接多个金额（如 128.5+45），方便聚餐快速合计小票
  const parts = trimmed.split('+').filter((p) => p.trim().length > 0);
  if (parts.length === 0) return 0;
  let total = 0;
  for (const part of parts) {
    total += parseYuanToCents(part);
  }
  return total;
}

export function ExpenseSheet({
  open,
  members,
  currency,
  initialExpense,
  onClose,
  onSave,
  onDelete,
}: ExpenseSheetProps) {
  const [title, setTitle] = useState('');
  const [amountExpr, setAmountExpr] = useState('');
  const [payerId, setPayerId] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showKeypad, setShowKeypad] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setShowKeypad(false);

    if (initialExpense) {
      setTitle(initialExpense.title);
      setAmountExpr(centsToPlainInput(initialExpense.amountCents));
      setPayerId(initialExpense.payerId || members[0]?.id || '');
      setSplitMode(initialExpense.splitMode);
      setParticipantIds(
        initialExpense.participantIds.length > 0
          ? initialExpense.participantIds
          : members.map((m) => m.id)
      );
      const inputs: Record<string, string> = {};
      for (const m of members) {
        const c = initialExpense.customSharesCents?.[m.id] ?? 0;
        inputs[m.id] = c > 0 ? centsToPlainInput(c) : '';
      }
      setCustomInputs(inputs);
    } else {
      setTitle('');
      setAmountExpr('');
      setPayerId(members[0]?.id || '');
      setSplitMode('equal');
      setParticipantIds(members.map((m) => m.id));
      const inputs: Record<string, string> = {};
      for (const m of members) {
        inputs[m.id] = '';
      }
      setCustomInputs(inputs);
    }
  }, [open, initialExpense, members]);

  const amountCents = useMemo(
    () => evaluateExpressionToCents(amountExpr),
    [amountExpr]
  );

  const customTotalCents = useMemo(() => {
    let sum = 0;
    for (const m of members) {
      sum += parseYuanToCents(customInputs[m.id] || '');
    }
    return sum;
  }, [customInputs, members]);

  const customDiffCents = amountCents - customTotalCents;

  if (!open) return null;

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setParticipantIds(members.map((m) => m.id));
  };

  const handleEqualFillCustom = () => {
    if (amountCents <= 0 || members.length === 0) return;
    const base = Math.floor(amountCents / members.length);
    const rem = amountCents % members.length;
    const next: Record<string, string> = {};
    members.forEach((m, i) => {
      const c = base + (i < rem ? 1 : 0);
      next[m.id] = centsToPlainInput(c);
    });
    setCustomInputs(next);
  };

  const handleAssignRemainingTo = (memberId: string) => {
    if (customDiffCents <= 0) return;
    const cur = parseYuanToCents(customInputs[memberId] || '');
    setCustomInputs((prev) => ({
      ...prev,
      [memberId]: centsToPlainInput(cur + customDiffCents),
    }));
  };

  const handleKeypadPress = (key: string) => {
    setErrorMsg(null);
    if (key === 'C') {
      setAmountExpr('');
      return;
    }
    if (key === 'DEL') {
      setAmountExpr((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '=') {
      const evaluated = evaluateExpressionToCents(amountExpr);
      setAmountExpr(evaluated > 0 ? centsToPlainInput(evaluated) : '');
      return;
    }
    if (key === '+') {
      if (!amountExpr || amountExpr.endsWith('+')) return;
      setAmountExpr((prev) => `${prev}+`);
      return;
    }
    if (key === '.') {
      const lastSeg = amountExpr.split('+').pop() ?? '';
      if (lastSeg.includes('.')) return;
      setAmountExpr((prev) => (lastSeg === '' ? `${prev}0.` : `${prev}.`));
      return;
    }
    // 数字键：限制小数点后最多 2 位
    const lastSeg = amountExpr.split('+').pop() ?? '';
    if (lastSeg.includes('.') && lastSeg.split('.')[1].length >= 2) {
      return;
    }
    if (lastSeg === '0') {
      setAmountExpr((prev) => `${prev.slice(0, -1)}${key}`);
      return;
    }
    setAmountExpr((prev) => `${prev}${key}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amountCents <= 0) {
      setErrorMsg('请输入大于 0 的消费金额');
      return;
    }
    if (!payerId) {
      setErrorMsg('请选择垫付人');
      return;
    }

    const finalTitle = title.trim() || '聚会消费';

    if (splitMode === 'equal') {
      if (participantIds.length === 0) {
        setErrorMsg('请至少勾选 1 位参与分摊的成员');
        return;
      }
      onSave({
        id: initialExpense?.id ?? generateShortId('e'),
        title: finalTitle,
        amountCents,
        payerId,
        splitMode: 'equal',
        participantIds,
        createdAt: initialExpense?.createdAt ?? Date.now(),
      });
      return;
    }

    // 自定义金额校验
    if (customDiffCents !== 0) {
      setErrorMsg(
        customDiffCents > 0
          ? `还有 ${formatMoney(customDiffCents, currency)} 未分配，请补全或点击「余数补给」`
          : `分配总额超出 ${formatMoney(Math.abs(customDiffCents), currency)}，请调整`
      );
      return;
    }

    const customSharesCents: Record<string, number> = {};
    const customParticipants: string[] = [];
    for (const m of members) {
      const c = parseYuanToCents(customInputs[m.id] || '');
      if (c > 0) {
        customSharesCents[m.id] = c;
        customParticipants.push(m.id);
      }
    }
    if (customParticipants.length === 0) {
      setErrorMsg('请至少为 1 位成员填写分摊金额');
      return;
    }

    onSave({
      id: initialExpense?.id ?? generateShortId('e'),
      title: finalTitle,
      amountCents,
      payerId,
      splitMode: 'custom',
      participantIds: customParticipants,
      customSharesCents,
      createdAt: initialExpense?.createdAt ?? Date.now(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] animate-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[92dvh] bg-[#FAF7F0] rounded-t-3xl border-t border-x border-[#DED8CC] flex flex-col overflow-hidden shadow-2xl animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initialExpense ? '编辑消费' : '记一笔'}
      >
        {/* 顶部拖拽条与标题 */}
        <div className="pt-2.5 pb-2 px-4 border-b border-dashed border-[#DED8CC] bg-[#FFFDF9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#141413]">
              {initialExpense ? '编辑消费' : '记一笔消费'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {initialExpense && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(initialExpense.id)}
                className="p-2 rounded-xl text-[#FF4D1A] hover:bg-[#FFF0EB] transition cursor-pointer"
                aria-label="删除这笔消费"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#68645B] hover:bg-[#F0ECE2] transition cursor-pointer"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4"
        >
          {/* 金额主输入区 */}
          <div className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="expense-amount-input"
                className="text-[11px] font-mono uppercase tracking-wider text-[#68645B]"
              >
                AMOUNT · 消费金额
              </label>
              <button
                type="button"
                onClick={() => setShowKeypad((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  showKeypad
                    ? 'bg-[#141413] text-white'
                    : 'bg-[#F5F2EB] text-[#68645B]'
                }`}
              >
                <Calculator className="w-3 h-3" />
                {showKeypad ? '收起小键盘' : '快捷数字键盘'}
              </button>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="tabular-money text-2xl font-bold text-[#FF4D1A]">
                {currency}
              </span>
              <input
                id="expense-amount-input"
                data-testid="expense-amount-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountExpr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.+]/g, '');
                  setAmountExpr(v);
                  setErrorMsg(null);
                }}
                className="w-full bg-transparent tabular-money text-3xl font-bold text-[#141413] placeholder:text-[#CFC8BA] focus:outline-none"
              />
            </div>

            {amountExpr.includes('+') && (
              <div className="mt-1 text-xs text-[#0D9468] tabular-money font-semibold">
                合计 = {formatMoney(amountCents, currency)}
              </div>
            )}

            {/* 内置可展开快捷数字键盘（单手拇指极速输入 + 加法合算） */}
            {showKeypad && (
              <div className="mt-3 pt-3 border-t border-dashed border-[#E5E0D5] grid grid-cols-4 gap-1.5 select-none">
                {['7', '8', '9', 'DEL', '4', '5', '6', '+', '1', '2', '3', 'C', '0', '00', '.', '='].map(
                  (key) => {
                    const isAction = ['DEL', '+', 'C', '='].includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === '00') {
                            handleKeypadPress('0');
                            handleKeypadPress('0');
                          } else {
                            handleKeypadPress(key);
                          }
                        }}
                        className={`h-11 rounded-xl font-mono text-base font-bold active:scale-95 transition flex items-center justify-center cursor-pointer ${
                          key === '='
                            ? 'bg-[#141413] text-white'
                            : isAction
                              ? 'bg-[#EFEAE0] text-[#141413]'
                              : 'bg-[#F8F5EE] border border-[#E5E0D5] text-[#141413]'
                        }`}
                      >
                        {key === 'DEL' ? <Delete className="w-4 h-4" /> : key}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* 消费名称 + 常用快捷胶囊 */}
          <div>
            <label
              htmlFor="expense-title-input"
              className="block text-[11px] font-mono uppercase tracking-wider text-[#68645B] mb-1.5"
            >
              ITEM · 消费项目
            </label>
            <input
              id="expense-title-input"
              data-testid="expense-title-input"
              type="text"
              placeholder="如：重庆老火锅、精酿啤酒、打车..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={32}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFDF9] border border-[#DED8CC] text-sm font-medium text-[#141413] placeholder:text-[#9A958A] focus:outline-none focus:border-[#141413]"
            />
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTitle(preset)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 border transition cursor-pointer ${
                    title === preset
                      ? 'bg-[#141413] text-white border-[#141413]'
                      : 'bg-[#FFFDF9] text-[#68645B] border-[#DED8CC] hover:border-[#9A958A]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 谁垫付的 */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#68645B] mb-1.5">
              PAYER · 谁付的钱
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = payerId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`payer-option-${m.name}`}
                    onClick={() => setPayerId(m.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                      selected
                        ? 'bg-[#141413] text-white border-[#141413] shadow-xs'
                        : 'bg-[#FFFDF9] text-[#141413] border-[#DED8CC]'
                    }`}
                  >
                    <MemberAvatar member={m} size="xs" />
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分摊模式 */}
          <div className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#68645B]">
                SPLIT · 分摊方式
              </div>
              <div className="inline-flex p-0.5 rounded-xl bg-[#F0ECE2] border border-[#DED8CC]">
                <button
                  type="button"
                  data-testid="split-mode-equal"
                  onClick={() => {
                    setSplitMode('equal');
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    splitMode === 'equal'
                      ? 'bg-[#FFFDF9] text-[#141413] shadow-xs'
                      : 'text-[#68645B]'
                  }`}
                >
                  均摊
                </button>
                <button
                  type="button"
                  data-testid="split-mode-custom"
                  onClick={() => {
                    setSplitMode('custom');
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    splitMode === 'custom'
                      ? 'bg-[#FFFDF9] text-[#141413] shadow-xs'
                      : 'text-[#68645B]'
                  }`}
                >
                  自定义金额
                </button>
              </div>
            </div>

            {splitMode === 'equal' ? (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[#68645B]">
                    已选 <strong className="text-[#141413]">{participantIds.length}</strong>/
                    {members.length} 人
                    {amountCents > 0 && participantIds.length > 0 && (
                      <span className="ml-1.5 tabular-money text-[#0D9468] font-semibold">
                        约 {formatMoney(Math.round(amountCents / participantIds.length), currency)}/人
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[#FF4D1A] font-semibold cursor-pointer"
                  >
                    全选
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {members.map((m) => {
                    const checked = participantIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        data-testid={`participant-toggle-${m.name}`}
                        onClick={() => toggleParticipant(m.id)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          checked
                            ? 'bg-[#FFF0EB] border-[#FF4D1A]/50 text-[#141413]'
                            : 'bg-[#FAF7F0] border-[#E5E0D5] text-[#9A958A]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <MemberAvatar member={m} size="xs" />
                          <span className="truncate">{m.name}</span>
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-[#FF4D1A] text-white'
                              : 'border border-[#CFC8BA]'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* 差额实时校验条 */}
                <div
                  className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 ${
                    customDiffCents === 0 && amountCents > 0
                      ? 'bg-[#E9F7F1] text-[#0D9468]'
                      : 'bg-[#FFF0EB] text-[#C2360F]'
                  }`}
                >
                  <span className="tabular-money font-semibold">
                    {customDiffCents === 0
                      ? amountCents > 0
                        ? '金额已精确对齐 ✓'
                        : '请先输入总金额'
                      : customDiffCents > 0
                        ? `未分配差额：${formatMoney(customDiffCents, currency)}`
                        : `已超出总额：${formatMoney(Math.abs(customDiffCents), currency)}`}
                  </span>
                  {amountCents > 0 && (
                    <button
                      type="button"
                      onClick={handleEqualFillCustom}
                      className="underline font-semibold shrink-0 cursor-pointer"
                    >
                      均分填入
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 bg-[#FAF7F0] border border-[#E5E0D5] rounded-xl px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MemberAvatar member={m} size="xs" />
                        <span className="text-xs font-semibold text-[#141413] truncate">
                          {m.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {customDiffCents > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAssignRemainingTo(m.id)}
                            className="px-1.5 py-0.5 rounded bg-[#EFEAE0] text-[10px] font-semibold text-[#68645B] hover:text-[#141413] cursor-pointer"
                          >
                            +余数
                          </button>
                        )}
                        <div className="flex items-center bg-[#FFFDF9] border border-[#DED8CC] rounded-lg px-2 py-1 w-24">
                          <span className="text-xs text-[#9A958A] font-mono mr-1">
                            {currency}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            data-testid={`custom-share-${m.name}`}
                            placeholder="0.00"
                            value={customInputs[m.id] ?? ''}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                              setCustomInputs((prev) => ({
                                ...prev,
                                [m.id]: cleaned,
                              }));
                              setErrorMsg(null);
                            }}
                            className="w-full text-right tabular-money text-sm font-semibold text-[#141413] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="px-3 py-2 rounded-xl bg-[#FFF0EB] border border-[#FF4D1A]/40 text-xs font-semibold text-[#C2360F]">
              {errorMsg}
            </div>
          )}

          {/* 底部提交按钮 */}
          <div className="pt-1 pb-safe">
            <button
              type="submit"
              data-testid="expense-submit-btn"
              className="w-full py-3.5 rounded-2xl bg-[#FF4D1A] text-white text-sm font-bold shadow-[0_6px_18px_rgba(255,77,26,0.28)] active:scale-[0.98] transition cursor-pointer"
            >
              {initialExpense ? '保存修改' : '确认记一笔'}
              {amountCents > 0 && (
                <span className="ml-1.5 tabular-money">
                  ({formatMoney(amountCents, currency)})
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
