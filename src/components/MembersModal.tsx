import { useState } from 'react';
import { Trash2, UserPlus, X } from 'lucide-react';
import { MEMBER_AVATARS, type Expense, type Member } from '../types/bill';
import { MemberAvatar } from './MemberAvatar';

interface MembersModalProps {
  open: boolean;
  members: Member[];
  expenses: Expense[];
  onClose: () => void;
  onAddMember: (name: string) => void;
  onRemoveMember: (memberId: string) => void;
  onCycleAvatar: (memberId: string) => void;
}

export function MembersModal({
  open,
  members,
  expenses,
  onClose,
  onAddMember,
  onRemoveMember,
  onCycleAvatar,
}: MembersModalProps) {
  const [name, setName] = useState('');
  const [tip, setTip] = useState<string | null>(null);

  if (!open) return null;

  const usedIds = new Set<string>();
  for (const exp of expenses) {
    usedIds.add(exp.payerId);
    for (const pid of exp.participantIds) usedIds.add(pid);
    if (exp.customSharesCents) {
      for (const [k, v] of Object.entries(exp.customSharesCents)) {
        if (v > 0) usedIds.add(k);
      }
    }
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) return;
    if (members.some((m) => m.name === cleaned)) {
      setTip(`成员「${cleaned}」已存在`);
      return;
    }
    onAddMember(cleaned);
    setName('');
    setTip(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] animate-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[82dvh] bg-[#FAF7F0] rounded-t-3xl border-t border-x border-[#DED8CC] flex flex-col overflow-hidden shadow-2xl animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="管理参与成员"
      >
        <div className="px-4 py-3.5 border-b border-dashed border-[#DED8CC] bg-[#FFFDF9] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#141413]">
              参与成员 ({members.length})
            </h2>
            <p className="text-[11px] text-[#68645B]">
              点击头像可切换可爱图标（{MEMBER_AVATARS.length} 款）
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
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              data-testid="add-member-input"
              placeholder="输入新成员昵称（如：阿凯）"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTip(null);
              }}
              maxLength={12}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FFFDF9] border border-[#DED8CC] text-sm font-medium focus:outline-none focus:border-[#141413]"
            />
            <button
              type="submit"
              data-testid="add-member-submit"
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-[#141413] text-white text-xs font-semibold active:scale-95 transition shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              添加
            </button>
          </form>

          {tip && (
            <div className="px-3 py-2 rounded-xl bg-[#FFF0EB] text-[#C2360F] text-xs font-medium">
              {tip}
            </div>
          )}

          <ul className="space-y-2">
            {members.map((m) => {
              const inUse = usedIds.has(m.id);
              const canDelete = !inUse && members.length > 2;
              return (
                <li
                  key={m.id}
                  className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => onCycleAvatar(m.id)}
                      title="点击更换头像"
                      className="active:scale-90 transition cursor-pointer"
                    >
                      <MemberAvatar member={m} size="md" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#141413] truncate">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-[#68645B]">
                        {inUse ? '已关联消费记录' : '尚未参与消费'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => onRemoveMember(m.id)}
                    title={
                      inUse
                        ? '该成员已有消费记录，无法删除'
                        : members.length <= 2
                          ? '至少保留 2 位成员'
                          : '移除成员'
                    }
                    className={`p-2 rounded-xl transition ${
                      canDelete
                        ? 'text-[#68645B] hover:text-[#FF4D1A] hover:bg-[#FFF0EB] cursor-pointer'
                        : 'text-[#CFC8BA] cursor-not-allowed'
                    }`}
                    aria-label={`移除成员 ${m.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
