import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BookmarkPlus,
  ChevronDown,
  Info,
  Plus,
  QrCode,
  Receipt,
  ReceiptText,
  RotateCcw,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  MEMBER_AVATARS,
  type Bill,
  type Expense,
} from './types/bill';
import { formatMoney, formatSignedMoney } from './core/money';
import { settleBill } from './core/settlement';
import {
  decodeBillFromToken,
  extractTokenFromLocation,
} from './core/shareCodec';
import {
  createMember,
  createNewBill,
  createSampleBill,
  generateShortId,
  loadActiveBillId,
  loadLocalBills,
  saveActiveBillId,
  saveLocalBills,
} from './core/storage';
import { generateIntroPosterImage } from './core/introPosterCanvas';
import { MemberAvatar } from './components/MemberAvatar';
import { ExpenseListView } from './components/ExpenseListView';
import { SettlementView } from './components/SettlementView';
import { ExpenseSheet } from './components/ExpenseSheet';
import { BillDrawer } from './components/BillDrawer';
import { MembersModal } from './components/MembersModal';
import { ShareModal, type ShareModalTab } from './components/ShareModal';
import { IntroCover } from './components/IntroCover';
import { IntroPosterModal } from './components/IntroPosterModal';

type MainTab = 'expenses' | 'settlement';

declare global {
  interface Window {
    __generateIntroPoster?: (overrideUrl?: string) => Promise<string>;
  }
}

function initLocalState(): {
  bills: Bill[];
  activeId: string;
  hadSavedBills: boolean;
} {
  const existing = loadLocalBills();
  if (existing.length > 0) {
    const savedActive = loadActiveBillId();
    const validActive = existing.some((b) => b.id === savedActive)
      ? (savedActive as string)
      : existing[0].id;
    return { bills: existing, activeId: validActive, hadSavedBills: true };
  }
  const sample = createSampleBill();
  saveLocalBills([sample]);
  saveActiveBillId(sample.id);
  return { bills: [sample], activeId: sample.id, hadSavedBills: false };
}

function initSharedFromUrl(): { bill: Bill | null; invalid: boolean } {
  const token = extractTokenFromLocation(window.location);
  if (!token) return { bill: null, invalid: false };
  const decoded = decodeBillFromToken(token);
  if (!decoded) return { bill: null, invalid: true };
  return { bill: decoded, invalid: false };
}

export default function App() {
  const initialLocal = useMemo(() => initLocalState(), []);
  const initialShared = useMemo(() => initSharedFromUrl(), []);

  const [bills, setBills] = useState<Bill[]>(initialLocal.bills);
  const [activeBillId, setActiveBillId] = useState<string>(
    initialLocal.activeId
  );
  const [sharedBill, setSharedBill] = useState<Bill | null>(initialShared.bill);
  const [invalidShareLink, setInvalidShareLink] = useState<boolean>(
    initialShared.invalid
  );

  // 普通根地址访问默认先展示「瑞士小票产品介绍页」；带 #s= / ?s= 分享参数时一步直达账单
  const [showIntro, setShowIntro] = useState<boolean>(!initialShared.bill);
  const [introPosterOpen, setIntroPosterOpen] = useState<boolean>(false);

  const [mainTab, setMainTab] = useState<MainTab>(
    initialShared.bill ? 'settlement' : 'expenses'
  );
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [billDrawerOpen, setBillDrawerOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<ShareModalTab>('share');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  // 暴露官方海报生成器以便构建脚本以相同字体与管线导出根目录 product-intro-qr.png
  useEffect(() => {
    window.__generateIntroPoster = generateIntroPosterImage;
    return () => {
      delete window.__generateIntroPoster;
    };
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2400);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // 持久化本地账本
  useEffect(() => {
    saveLocalBills(bills);
  }, [bills]);

  useEffect(() => {
    saveActiveBillId(activeBillId);
  }, [activeBillId]);

  // 监听 URL hash 变化以支持直接切换分享链接
  useEffect(() => {
    const onHashChange = () => {
      const token = extractTokenFromLocation(window.location);
      if (!token) {
        setSharedBill(null);
        setInvalidShareLink(false);
        return;
      }
      const decoded = decodeBillFromToken(token);
      if (decoded) {
        setSharedBill(decoded);
        setInvalidShareLink(false);
        setFilterMemberId(null);
        setShowIntro(false);
        setMainTab('settlement');
      } else {
        setInvalidShareLink(true);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const isViewingShared = sharedBill !== null;
  const currentBill = useMemo(() => {
    if (sharedBill) return sharedBill;
    return bills.find((b) => b.id === activeBillId) ?? bills[0];
  }, [sharedBill, bills, activeBillId]);

  const settlement = useMemo(
    () => settleBill(currentBill.members, currentBill.expenses),
    [currentBill.members, currentBill.expenses]
  );

  const balanceMap = useMemo(
    () => new Map(settlement.balances.map((b) => [b.memberId, b])),
    [settlement.balances]
  );

  const unsettledTransferCount = useMemo(() => {
    const settledSet = new Set(currentBill.settledKeys);
    return settlement.transfers.filter((t) => !settledSet.has(t.key)).length;
  }, [settlement.transfers, currentBill.settledKeys]);

  // 通用更新当前账本函数（支持本地账本或分享态临时编辑）
  const updateCurrentBill = useCallback(
    (updater: (prev: Bill) => Bill) => {
      if (sharedBill) {
        setSharedBill((prev) =>
          prev ? { ...updater(prev), updatedAt: Date.now() } : prev
        );
        return;
      }
      setBills((prev) =>
        prev.map((b) =>
          b.id === activeBillId ? { ...updater(b), updatedAt: Date.now() } : b
        )
      );
    },
    [sharedBill, activeBillId]
  );

  const handleSaveExpense = (expense: Expense) => {
    updateCurrentBill((prev) => {
      const exists = prev.expenses.some((e) => e.id === expense.id);
      const nextExpenses = exists
        ? prev.expenses.map((e) => (e.id === expense.id ? expense : e))
        : [...prev.expenses, expense];
      return { ...prev, expenses: nextExpenses };
    });
    setExpenseSheetOpen(false);
    setEditingExpense(null);
    showToast(editingExpense ? '已更新该笔消费' : '已记入账本');
  };

  const handleDeleteExpense = (expenseId: string) => {
    updateCurrentBill((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }));
    setExpenseSheetOpen(false);
    setEditingExpense(null);
    showToast('已删除该笔消费');
  };

  const handleToggleSettled = (transferKey: string) => {
    updateCurrentBill((prev) => {
      const exists = prev.settledKeys.includes(transferKey);
      const nextKeys = exists
        ? prev.settledKeys.filter((k) => k !== transferKey)
        : [...prev.settledKeys, transferKey];
      return { ...prev, settledKeys: nextKeys };
    });
  };

  const handleAddMember = (name: string) => {
    updateCurrentBill((prev) => ({
      ...prev,
      members: [...prev.members, createMember(name, prev.members.length)],
    }));
    showToast(`已添加成员「${name}」`);
  };

  const handleRemoveMember = (memberId: string) => {
    updateCurrentBill((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== memberId),
    }));
    if (filterMemberId === memberId) setFilterMemberId(null);
    showToast('已移除成员');
  };

  const handleCycleAvatar = (memberId: string) => {
    updateCurrentBill((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id !== memberId) return m;
        const idx = (MEMBER_AVATARS as readonly string[]).indexOf(m.avatar);
        const nextAvatar = MEMBER_AVATARS[(idx + 1) % MEMBER_AVATARS.length];
        return { ...m, avatar: nextAvatar };
      }),
    }));
  };

  const clearShareHash = () => {
    if (window.location.hash || window.location.search.includes('s=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleSaveSharedCopy = () => {
    if (!sharedBill) return;
    const copy: Bill = {
      ...sharedBill,
      id: generateShortId('bill_'),
      updatedAt: Date.now(),
    };
    setBills((prev) => [copy, ...prev]);
    setActiveBillId(copy.id);
    setSharedBill(null);
    clearShareHash();
    showToast('已保存为本地副本，可随时离线查看与编辑');
  };

  const handleExitSharedMode = () => {
    setSharedBill(null);
    setInvalidShareLink(false);
    clearShareHash();
  };

  const handleCreateBill = (title: string, memberNames: string[]) => {
    const next = createNewBill(title, memberNames);
    setSharedBill(null);
    clearShareHash();
    setBills((prev) => [next, ...prev]);
    setActiveBillId(next.id);
    setFilterMemberId(null);
    setMainTab('expenses');
    showToast(`已创建新账本「${next.title}」`);
  };

  const handleCreateSampleBill = () => {
    const sample = createSampleBill();
    setSharedBill(null);
    clearShareHash();
    setBills((prev) => [sample, ...prev]);
    setActiveBillId(sample.id);
    setFilterMemberId(null);
    setMainTab('expenses');
    setShowIntro(false);
    showToast('已载入示例账单，可切换「结算方案」查看最少转账');
  };

  const handleEnterSampleFromIntro = () => {
    const existingSample = bills.find((b) => b.title.includes('示例'));
    if (existingSample) {
      setSharedBill(null);
      clearShareHash();
      setActiveBillId(existingSample.id);
      setFilterMemberId(null);
      setMainTab('expenses');
      setShowIntro(false);
      return;
    }
    handleCreateSampleBill();
  };

  const handleSelectBill = (billId: string) => {
    setSharedBill(null);
    clearShareHash();
    setActiveBillId(billId);
    setFilterMemberId(null);
  };

  const handleDeleteBill = (billId: string) => {
    setBills((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((b) => b.id !== billId);
      if (billId === activeBillId) {
        setActiveBillId(next[0].id);
      }
      return next;
    });
    showToast('已删除该历史账本');
  };

  const openShareModal = (tab: ShareModalTab) => {
    setShareModalTab(tab);
    setShareModalOpen(true);
  };

  // 首屏「瑞士热敏小票产品介绍页」
  if (showIntro) {
    return (
      <>
        <IntroCover
          hasExistingSession={initialLocal.hadSavedBills || bills.length > 1}
          onStartNow={() => setShowIntro(false)}
          onTrySample={handleEnterSampleFromIntro}
          onOpenPoster={() => setIntroPosterOpen(true)}
        />

        {/* 安全区顶部居中 Toast */}
        {toastMsg && (
          <div className="fixed top-[max(12px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[350px] w-max px-4 py-2 rounded-full bg-[#141413] text-[#FFFDF9] border border-white/15 text-xs font-semibold shadow-[0_8px_24px_rgba(20,20,19,0.28)]">
            {toastMsg}
          </div>
        )}

        <IntroPosterModal
          open={introPosterOpen}
          onClose={() => setIntroPosterOpen(false)}
          onToast={showToast}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh w-full flex justify-center bg-[#E4DFD5]">
      {/* 手机端主容器（375px~430px 满屏，桌面端居中热敏纸工作台） */}
      <div className="w-full max-w-[430px] min-h-dvh paper-texture relative flex flex-col shadow-[0_0_40px_rgba(20,20,19,0.08)]">
        {/* 损坏链接友好提示 */}
        {invalidShareLink && (
          <div className="bg-[#FFF0EB] border-b border-[#FF4D1A]/30 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="text-[#C2360F] font-medium">
              分享链接数据不完整或已损坏，已展示你的本地账本。
            </span>
            <button
              type="button"
              onClick={handleExitSharedMode}
              className="text-[#FF4D1A] font-bold shrink-0 cursor-pointer"
            >
              知道了
            </button>
          </div>
        )}

        {/* 分享预览态横幅 */}
        {isViewingShared && (
          <div
            data-testid="shared-mode-banner"
            className="bg-[#141413] text-[#FFFDF9] px-4 py-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-mono text-[#FF7A52] tracking-wider">
                SHARED SNAPSHOT · 同桌分享账单
              </div>
              <div className="text-xs text-[#E5E0D5] truncate">
                已从链接完整还原，无需登录
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="save-shared-copy-btn"
                onClick={handleSaveSharedCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FF4D1A] text-white text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                存到本地
              </button>
              <button
                type="button"
                onClick={handleExitSharedMode}
                className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                title="返回我的账本"
                aria-label="返回我的账本"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-30 bg-[#F5F2EB]/95 backdrop-blur-md border-b border-[#DED8CC] px-4 pt-safe pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="bill-switcher-btn"
              onClick={() => setBillDrawerOpen(true)}
              className="flex items-center gap-2 min-w-0 py-1 pr-1.5 rounded-xl hover:bg-[#EAE5DA] active:scale-[0.98] transition cursor-pointer"
            >
              <span className="w-8 h-8 rounded-xl bg-[#141413] text-[#FFFDF9] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                SS
              </span>
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1">
                  <h1
                    data-testid="current-bill-title"
                    className="text-[15px] font-bold text-[#141413] truncate max-w-[148px]"
                  >
                    {currentBill.title}
                  </h1>
                  <ChevronDown className="w-4 h-4 text-[#68645B] shrink-0" />
                </div>
                <div className="text-[10px] font-mono text-[#68645B] tracking-wider whitespace-nowrap truncate max-w-[162px]">
                  NO.{currentBill.receiptNo}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="open-intro-btn"
                onClick={() => setShowIntro(true)}
                title="关于产品 / 推荐给朋友"
                aria-label="关于产品与推荐海报"
                className="w-8 h-8 rounded-xl bg-[#FFFDF9] border border-[#DED8CC] text-[#68645B] hover:text-[#141413] flex items-center justify-center active:scale-95 transition cursor-pointer"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="open-members-btn"
                onClick={() => setMembersModalOpen(true)}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl bg-[#FFFDF9] border border-[#DED8CC] text-xs font-semibold text-[#141413] active:scale-95 transition cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#68645B]" />
                <span className="tabular-money">{currentBill.members.length}</span>
              </button>
              <button
                type="button"
                data-testid="top-share-btn"
                onClick={() => openShareModal('share')}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl bg-[#141413] text-[#FFFDF9] text-xs font-semibold active:scale-95 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>分享</span>
              </button>
            </div>
          </div>
        </header>

        {/* 主体内容滚动区（pb-36 确保滑到底部绝不被悬浮操作栏遮挡） */}
        <main className="flex-1 px-4 pt-3.5 pb-36 space-y-4">
          {/* 热敏纸锯齿 Hero 汇总卡（瑞士网格 3 列 KPI + 成员实时净额） */}
          <section className="bg-[#FFFDF9] border border-[#DED8CC] rounded-t-2xl receipt-zig-zag-bottom shadow-[0_2px_10px_rgba(20,20,19,0.05)]">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#68645B]">
                    TOTAL SPENT · 账本总支出
                  </div>
                  <div
                    data-testid="total-spent-amount"
                    className="tabular-money text-[34px] leading-tight font-bold text-[#141413] mt-0.5"
                  >
                    {formatMoney(settlement.totalExpenseCents, currentBill.currency)}
                  </div>
                </div>

                {settlement.transfers.length > 0 && unsettledTransferCount === 0 ? (
                  <span className="px-2.5 py-1 rounded-lg border-2 border-[#0D9468] text-[#0D9468] text-[11px] font-mono font-bold tracking-wider -rotate-3">
                    ALL SETTLED
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg bg-[#F5F2EB] border border-[#E5E0D5] text-[11px] font-mono text-[#68645B]">
                    人均{' '}
                    <strong className="text-[#141413]">
                      {currentBill.members.length > 0
                        ? formatMoney(
                            Math.round(
                              settlement.totalExpenseCents /
                                currentBill.members.length
                            ),
                            currentBill.currency
                          )
                        : `${currentBill.currency}0.00`}
                    </strong>
                  </span>
                )}
              </div>

              {/* 瑞士网格 3 列 KPI（紧凑对称等宽排版） */}
              <div className="mt-3.5 pt-3 border-t border-dashed border-[#DED8CC] grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] font-mono text-[#9A958A]">消费笔数</div>
                  <div className="tabular-money text-base font-bold text-[#141413] mt-0.5 flex items-baseline gap-1">
                    <span>{currentBill.expenses.length}</span>
                    <span className="text-[11px] font-sans font-normal text-[#68645B]">
                      笔
                    </span>
                  </div>
                </div>
                <div className="border-l border-dashed border-[#E5E0D5] pl-2.5">
                  <div className="text-[10px] font-mono text-[#9A958A]">待结转账</div>
                  <div
                    data-testid="kpi-unsettled"
                    className="tabular-money text-base font-bold mt-0.5 flex items-baseline"
                  >
                    <span className="text-[#FF4D1A]">{unsettledTransferCount}</span>
                    <span className="text-[#9A958A] text-xs mx-1 font-normal">/</span>
                    <span className="text-[#141413]">{settlement.transfers.length}</span>
                    <span className="text-[11px] font-sans font-normal text-[#68645B] ml-1">
                      笔
                    </span>
                  </div>
                </div>
                <div className="border-l border-dashed border-[#E5E0D5] pl-2.5">
                  <div className="text-[10px] font-mono text-[#9A958A]">算法精简</div>
                  <div className="tabular-money text-base font-bold text-[#0D9468] mt-0.5 flex items-baseline gap-1">
                    <span>
                      {settlement.savedTransferCount > 0
                        ? `-${settlement.savedTransferCount}`
                        : '最优'}
                    </span>
                    {settlement.savedTransferCount > 0 && (
                      <span className="text-[11px] font-sans font-normal text-[#68645B]">
                        笔
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 成员实时净额横向滚动条 */}
            <div className="px-4 pb-3.5 pt-2 border-t border-[#F0ECE2]">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {currentBill.members.map((m) => {
                  const bal = balanceMap.get(m.id);
                  const net = bal?.netCents ?? 0;
                  const isSelected = filterMemberId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setFilterMemberId((prev) => (prev === m.id ? null : m.id));
                        if (mainTab !== 'expenses') setMainTab('expenses');
                      }}
                      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border shrink-0 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#141413] text-white border-[#141413]'
                          : 'bg-[#FAF7F0] text-[#141413] border-[#E5E0D5]'
                      }`}
                    >
                      <MemberAvatar member={m} size="xs" />
                      <span className="text-xs font-semibold">{m.name}</span>
                      <span
                        className={`tabular-money text-[11px] font-bold ${
                          isSelected
                            ? 'text-white/90'
                            : net > 0
                              ? 'text-[#0D9468]'
                              : net < 0
                                ? 'text-[#FF4D1A]'
                                : 'text-[#9A958A]'
                        }`}
                      >
                        {formatSignedMoney(net, currentBill.currency)}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setMembersModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-[#CFC8BA] text-[11px] font-semibold text-[#68645B] hover:border-[#141413] hover:text-[#141413] shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  成员
                </button>
              </div>
            </div>
          </section>

          {/* 主视图分段切换控制器 */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#EAE5DA] border border-[#DED8CC]">
            <button
              type="button"
              data-testid="tab-expenses"
              onClick={() => setMainTab('expenses')}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mainTab === 'expenses'
                  ? 'bg-[#FFFDF9] text-[#141413] shadow-[0_1px_3px_rgba(20,20,19,0.08)]'
                  : 'text-[#68645B]'
              }`}
            >
              <ReceiptText className="w-4 h-4" />
              消费明细 ({currentBill.expenses.length})
            </button>
            <button
              type="button"
              data-testid="tab-settlement"
              onClick={() => setMainTab('settlement')}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mainTab === 'settlement'
                  ? 'bg-[#FFFDF9] text-[#141413] shadow-[0_1px_3px_rgba(20,20,19,0.08)]'
                  : 'text-[#68645B]'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              结算方案
              {unsettledTransferCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#FF4D1A] text-white text-[10px] tabular-money">
                  {unsettledTransferCount}
                </span>
              )}
            </button>
          </div>

          {/* 视图内容 */}
          {mainTab === 'expenses' ? (
            <ExpenseListView
              bill={currentBill}
              filterMemberId={filterMemberId}
              onClearFilter={() => setFilterMemberId(null)}
              onEditExpense={(exp) => {
                setEditingExpense(exp);
                setExpenseSheetOpen(true);
              }}
              onAddExpense={() => {
                setEditingExpense(null);
                setExpenseSheetOpen(true);
              }}
              onLoadSample={handleCreateSampleBill}
            />
          ) : (
            <SettlementView
              bill={currentBill}
              settlement={settlement}
              onToggleSettled={handleToggleSettled}
              onOpenReceipt={() => openShareModal('receipt')}
              onOpenShare={() => openShareModal('share')}
              onToast={showToast}
            />
          )}
        </main>

        {/* 底部干净悬浮胶囊底座（无脏糊渐变遮罩） */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 pointer-events-none px-4 pb-safe">
          <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-[22px] bg-[#FFFDF9]/96 backdrop-blur-md border border-[#DED8CC] shadow-[0_10px_30px_rgba(20,20,19,0.14)]">
            <button
              type="button"
              data-testid="bottom-receipt-btn"
              onClick={() => openShareModal('receipt')}
              className="h-12 px-3.5 rounded-2xl bg-[#F5F2EB] text-[#141413] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition shrink-0 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-[#141413]" />
              <span className="text-[10px] font-bold">小票图</span>
            </button>

            <button
              type="button"
              data-testid="add-expense-fab"
              onClick={() => {
                setEditingExpense(null);
                setExpenseSheetOpen(true);
              }}
              className="flex-1 h-12 rounded-2xl bg-[#FF4D1A] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(255,77,26,0.3)] active:scale-[0.98] transition cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.8]" />
              <span>记一笔</span>
            </button>

            <button
              type="button"
              data-testid="bottom-share-btn"
              onClick={() => openShareModal('share')}
              className="h-12 px-3.5 rounded-2xl bg-[#F5F2EB] text-[#141413] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition shrink-0 cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-[#FF4D1A]" />
              <span className="text-[10px] font-bold">扫码享</span>
            </button>
          </div>
        </div>

        {/* 安全区顶部居中悬浮 Toast（不压在导航栏与卡片交界线上） */}
        {toastMsg && (
          <div className="fixed top-[max(12px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[350px] w-max px-4 py-2 rounded-full bg-[#141413] text-[#FFFDF9] border border-white/15 text-xs font-semibold shadow-[0_8px_24px_rgba(20,20,19,0.28)]">
            {toastMsg}
          </div>
        )}

        {/* 抽屉与弹窗 */}
        <ExpenseSheet
          open={expenseSheetOpen}
          members={currentBill.members}
          currency={currentBill.currency}
          initialExpense={editingExpense}
          onClose={() => {
            setExpenseSheetOpen(false);
            setEditingExpense(null);
          }}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
        />

        <BillDrawer
          open={billDrawerOpen}
          bills={bills}
          activeBillId={currentBill.id}
          onClose={() => setBillDrawerOpen(false)}
          onSelectBill={handleSelectBill}
          onCreateBill={handleCreateBill}
          onCreateSampleBill={handleCreateSampleBill}
          onDeleteBill={handleDeleteBill}
        />

        <MembersModal
          open={membersModalOpen}
          members={currentBill.members}
          expenses={currentBill.expenses}
          onClose={() => setMembersModalOpen(false)}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onCycleAvatar={handleCycleAvatar}
        />

        <ShareModal
          open={shareModalOpen}
          initialTab={shareModalTab}
          bill={currentBill}
          settlement={settlement}
          onClose={() => setShareModalOpen(false)}
          onToast={showToast}
        />

        <IntroPosterModal
          open={introPosterOpen}
          onClose={() => setIntroPosterOpen(false)}
          onToast={showToast}
        />
      </div>
    </div>
  );
}
