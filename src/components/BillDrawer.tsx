import { useState } from 'react';
import {
  Check,
  FolderPlus,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { Bill } from '../types/bill';
import { formatMoney } from '../core/money';

interface BillDrawerProps {
  open: boolean;
  bills: Bill[];
  activeBillId: string;
  onClose: () => void;
  onSelectBill: (billId: string) => void;
  onCreateBill: (title: string, memberNames: string[]) => void;
  onCreateSampleBill: () => void;
  onDeleteBill: (billId: string) => void;
}

const SCENE_TEMPLATES = [
  { label: '周五火锅局', members: ['阿杰', '林溪', '老周', '小美'] },
  { label: '川西周末游', members: ['我', '大宇', '阿凯', '欣欣'] },
  { label: '桌游密室局', members: ['我', '小陈', '小赵', '小吴'] },
];

export function BillDrawer({
  open,
  bills,
  activeBillId,
  onClose,
  onSelectBill,
  onCreateBill,
  onCreateSampleBill,
  onDeleteBill,
}: BillDrawerProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [membersText, setMembersText] = useState('阿杰, 林溪, 老周, 小美');

  if (!open) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const names = membersText
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onCreateBill(title.trim() || '新建分账局', names.length >= 2 ? names : ['我', '朋友A']);
    setTitle('');
    setCreating(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] animate-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[88dvh] bg-[#FAF7F0] rounded-t-3xl border-t border-x border-[#DED8CC] flex flex-col overflow-hidden shadow-2xl animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="我的账本"
      >
        <div className="px-4 py-3.5 border-b border-dashed border-[#DED8CC] bg-[#FFFDF9] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#141413]">账本切换与历史</h2>
            <p className="text-[11px] text-[#68645B]">
              数据保存在本机浏览器，共 {bills.length} 个账本
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#68645B] hover:bg-[#F0ECE2] cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 pb-safe">
          {/* 顶部快捷操作按钮 */}
          {!creating ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="open-new-bill-form-btn"
                onClick={() => setCreating(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#141413] text-white text-xs font-semibold active:scale-95 transition cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                新建账本
              </button>
              <button
                type="button"
                data-testid="create-sample-bill-btn"
                onClick={() => {
                  onCreateSampleBill();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#FFFDF9] border border-[#DED8CC] text-[#141413] text-xs font-semibold active:scale-95 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#FF4D1A]" />
                生成示例账单
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleCreate}
              className="bg-[#FFFDF9] border border-[#141413] rounded-2xl p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141413]">创建新账本</span>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-xs text-[#68645B] cursor-pointer"
                >
                  取消
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SCENE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => {
                      setTitle(tpl.label);
                      setMembersText(tpl.members.join(', '));
                    }}
                    className="px-2.5 py-1 rounded-full bg-[#F5F2EB] border border-[#DED8CC] text-[11px] font-medium text-[#141413] cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#68645B] mb-1">
                  账本名称
                </label>
                <input
                  type="text"
                  data-testid="new-bill-title-input"
                  placeholder="如：川西周末游 / 周五火锅局"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#DED8CC] text-sm font-medium focus:outline-none focus:border-[#141413]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#68645B] mb-1">
                  初始参与人（用逗号或空格分隔）
                </label>
                <input
                  type="text"
                  data-testid="new-bill-members-input"
                  placeholder="例如：阿杰, 林溪, 老周, 小美"
                  value={membersText}
                  onChange={(e) => setMembersText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#DED8CC] text-sm font-medium focus:outline-none focus:border-[#141413]"
                />
              </div>

              <button
                type="submit"
                data-testid="new-bill-confirm-btn"
                className="w-full py-2.5 rounded-xl bg-[#FF4D1A] text-white text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                立即建账
              </button>
            </form>
          )}

          {/* 历史账本列表 */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#68645B]">
              HISTORY · 本地账本列表
            </div>

            {bills.map((b) => {
              const isActive = b.id === activeBillId;
              const totalCents = b.expenses.reduce((s, e) => s + e.amountCents, 0);
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-3 flex items-center justify-between gap-2 transition ${
                    isActive
                      ? 'bg-[#FFFDF9] border-[#141413] shadow-xs'
                      : 'bg-[#FFFDF9]/80 border-[#DED8CC]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBill(b.id);
                      onClose();
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#141413] truncate">
                        {b.title}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#141413] text-white text-[10px] font-semibold shrink-0">
                          <Check className="w-2.5 h-2.5" />
                          当前
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2.5 text-[11px] text-[#68645B] tabular-money">
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="w-3 h-3" />
                        {b.members.length}人
                      </span>
                      <span>{b.expenses.length} 笔</span>
                      <span className="font-semibold text-[#141413]">
                        {formatMoney(totalCents, b.currency)}
                      </span>
                    </div>
                  </button>

                  {bills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteBill(b.id)}
                      className="p-2 rounded-xl text-[#9A958A] hover:text-[#FF4D1A] hover:bg-[#FFF0EB] transition cursor-pointer"
                      aria-label={`删除账本 ${b.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
